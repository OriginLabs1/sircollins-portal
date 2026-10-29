/**
 * Sovereign storage adapter.
 *
 * Priority order:
 *   1. OPFS (Origin Private File System) — fast, private, persistent.
 *   2. localStorage — graceful degradation when OPFS is unavailable
 *      (Safari private mode, older WebViews, blocked storage).
 *   3. In-memory — last resort so the UI never throws. Data is lost on reload;
 *      `engine` reports `memory` so callers can warn the user.
 *
 * All access is async so swapping the backend later cannot break call sites.
 */

export type StorageEngine = 'opfs' | 'localstorage' | 'memory';

export interface SovereignStore {
  readonly engine: StorageEngine;
  /** True when writes do not survive a reload. */
  readonly volatile: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export interface StoreOptions {
  /** Force-disable OPFS probing (used by tests). */
  opfs?: boolean;
  /** Override the localStorage implementation (used by tests). */
  storage?: Storage | null;
  /** Root file name inside OPFS. */
  fileName?: string;
}

interface Snapshot {
  version: 1;
  updatedAt: string;
  records: Record<string, unknown>;
}

const EMPTY: Snapshot = { version: 1, updatedAt: new Date(0).toISOString(), records: {} };

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Snapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.records === 'object' &&
    candidate.records !== null
  );
}

function parseSnapshot(raw: string | null): Snapshot {
  if (raw === null) return { ...EMPTY, records: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSnapshot(parsed)) return parsed;
  } catch {
    // Corrupt payload: fall back to empty rather than crash the app.
  }
  return { ...EMPTY, records: {} };
}

/** Shared behaviour: mutate an in-memory snapshot, then flush it. */
abstract class SnapshotStore implements SovereignStore {
  abstract readonly engine: StorageEngine;
  abstract readonly volatile: boolean;

  protected snapshot: Snapshot = { ...EMPTY, records: {} };
  protected ready: Promise<void> | null = null;

  protected abstract load(): Promise<Snapshot>;
  protected abstract persist(snapshot: Snapshot): Promise<void>;

  private async hydrate(): Promise<void> {
    if (this.snapshot.updatedAt === EMPTY.updatedAt) {
      this.snapshot = await this.load();
    }
  }

  private async init(): Promise<void> {
    if (this.ready === null) this.ready = this.hydrate();
    await this.ready;
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.init();
    return this.snapshot.records[key] as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.init();
    this.snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      records: { ...this.snapshot.records, [key]: value },
    };
    await this.persist(this.snapshot);
  }

  async remove(key: string): Promise<void> {
    await this.init();
    const records = { ...this.snapshot.records };
    delete records[key];
    this.snapshot = { version: 1, updatedAt: new Date().toISOString(), records };
    await this.persist(this.snapshot);
  }

  async keys(): Promise<string[]> {
    await this.init();
    return Object.keys(this.snapshot.records);
  }

  async clear(): Promise<void> {
    this.snapshot = { version: 1, updatedAt: new Date().toISOString(), records: {} };
    await this.persist(this.snapshot);
  }
}

class MemoryStore extends SnapshotStore {
  readonly engine: StorageEngine = 'memory';
  readonly volatile = true;

  protected override async load(): Promise<Snapshot> {
    return { ...EMPTY, records: {} };
  }

  protected override async persist(): Promise<void> {
    // Intentionally a no-op: nothing survives a reload.
  }
}

class LocalStorageStore extends SnapshotStore {
  readonly engine: StorageEngine = 'localstorage';
  readonly volatile = false;

  private readonly storageKey: string;

  constructor(private readonly storage: Storage, storageKey = 'sircollins:portal:v1') {
    super();
    this.storageKey = storageKey;
  }

  protected override async load(): Promise<Snapshot> {
    return parseSnapshot(this.storage.getItem(this.storageKey));
  }

  protected override async persist(snapshot: Snapshot): Promise<void> {
    this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
  }
}

class OpfsStore extends SnapshotStore {
  readonly engine: StorageEngine = 'opfs';
  readonly volatile = false;

  constructor(
    private readonly root: FileSystemDirectoryHandle,
    private readonly fileName: string,
  ) {
    super();
  }

  private async handle(): Promise<FileSystemFileHandle> {
    return this.root.getFileHandle(this.fileName, { create: true });
  }

  protected override async load(): Promise<Snapshot> {
    const handle = await this.handle();
    const file = await handle.getFile();
    return parseSnapshot(await file.text());
  }

  protected override async persist(snapshot: Snapshot): Promise<void> {
    const handle = await this.handle();
    const writable = await handle.createWritable();
    try {
      await writable.write(JSON.stringify(snapshot));
    } finally {
      await writable.close();
    }
  }
}

async function probeOpfs(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === 'undefined') return null;
    const storage = navigator.storage as StorageManager | undefined;
    if (storage === undefined || typeof storage.getDirectory !== 'function') return null;
    return await storage.getDirectory();
  } catch {
    return null;
  }
}

function probeLocalStorage(options: StoreOptions): Storage | null {
  if (options.storage !== undefined) return options.storage;
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = 'sircollins:probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

async function canUseOpfs(store: OpfsStore): Promise<boolean> {
  try {
    await store.set('__probe__', Date.now());
    await store.remove('__probe__');
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the best available store. Never rejects: if every backend fails,
 * the returned store reports `engine: 'memory'` and the UI degrades visibly.
 */
export async function createSovereignStore(options: StoreOptions = {}): Promise<SovereignStore> {
  const fileName = options.fileName ?? 'portal-data.json';

  if (options.opfs !== false) {
    const root = await probeOpfs();
    if (root !== null) {
      const store = new OpfsStore(root, fileName);
      if (await canUseOpfs(store)) return store;
    }
  }

  const storage = probeLocalStorage(options);
  if (storage !== null) {
    const store = new LocalStorageStore(storage);
    try {
      await store.set('__probe__', Date.now());
      await store.remove('__probe__');
      return store;
    } catch {
      // Quota exceeded or write-blocked: fall through to memory.
    }
  }

  return new MemoryStore();
}
