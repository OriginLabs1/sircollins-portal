import './styles/base.css';
import './styles/glass.css';
import teaserData from './data/teasers.json';
import { createSovereignStore } from './lib/storage.ts';
import type { StorageEngine } from './lib/storage.ts';
import {
  CONTACT,
  ROLES,
  SITE_NAME,
  buildBlogGraph,
  buildPersonGraph,
  buildWebSiteGraph,
} from './lib/schema.ts';
import type { Teaser } from './lib/schema.ts';

const TEASERS_KEY = 'teasers';

function query<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`Missing required element: ${selector}`);
  return node;
}

function readTeasers(): readonly Teaser[] {
  const raw: unknown = teaserData;
  if (typeof raw !== 'object' || raw === null || !('items' in raw)) return [];
  const { items } = raw as { items: unknown };
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is Teaser => {
    const candidate = item as Partial<Teaser>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.summary === 'string' &&
      typeof candidate.theme === 'string' &&
      typeof candidate.publishedAt === 'string' &&
      Array.isArray(candidate.tags)
    );
  });
}

function writeJsonLd(): void {
  const teasers = readTeasers();
  const graphs: readonly unknown[] = [
    buildPersonGraph(),
    buildWebSiteGraph(),
    buildBlogGraph(teasers),
  ];
  for (const graph of graphs) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(graph);
    document.head.append(script);
  }
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function renderTeasers(teasers: readonly Teaser[]): void {
  const grid = query<HTMLDivElement>('#teaser-grid');
  const fragment = document.createDocumentFragment();

  for (const teaser of teasers) {
    const article = document.createElement('article');
    article.className = 'teaser glass';
    article.dataset['theme'] = teaser.theme;

    const theme = document.createElement('p');
    theme.className = 'teaser__theme';
    theme.textContent = teaser.theme;

    const title = document.createElement('h3');
    title.className = 'teaser__title';
    title.textContent = teaser.title;

    const summary = document.createElement('p');
    summary.className = 'teaser__summary';
    summary.textContent = teaser.summary;

    const footer = document.createElement('footer');
    footer.className = 'teaser__footer';

    const time = document.createElement('time');
    time.dateTime = teaser.publishedAt;
    time.textContent = formatDate(teaser.publishedAt);

    const tags = document.createElement('ul');
    tags.className = 'teaser__tags';
    for (const tag of teaser.tags) {
      const item = document.createElement('li');
      item.textContent = tag;
      tags.append(item);
    }

    footer.append(time, tags);
    article.append(theme, title, summary, footer);
    fragment.append(article);
  }

  grid.replaceChildren(fragment);
}

function renderRoles(): void {
  const list = query<HTMLUListElement>('#role-list');
  const fragment = document.createDocumentFragment();
  for (const role of ROLES) {
    const item = document.createElement('li');
    item.textContent = role;
    fragment.append(item);
  }
  list.replaceChildren(fragment);
}

function renderContacts(): void {
  const email = query<HTMLAnchorElement>('#contact-email');
  email.href = `mailto:${CONTACT.professionalEmail}`;
  email.textContent = CONTACT.professionalEmail;

  const telegram = query<HTMLAnchorElement>('#contact-telegram');
  telegram.href = CONTACT.telegram;
  telegram.textContent = 'Telegram';
}

const ENGINE_LABEL: Record<StorageEngine, string> = {
  opfs: 'Sovereign storage: OPFS',
  localstorage: 'Storage: localStorage fallback',
  memory: 'Storage: in-memory only (not persisted)',
};

function reportStorage(engine: StorageEngine): void {
  const badge = query<HTMLSpanElement>('#storage-status');
  badge.textContent = ENGINE_LABEL[engine];
  badge.dataset['engine'] = engine;
  badge.hidden = engine === 'opfs';
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Offline support is an enhancement; never block the page on it.
  }
}

function renderYear(): void {
  const year = new Date().getFullYear();
  const node = document.querySelector<HTMLSpanElement>('#year');
  if (node !== null) node.textContent = String(year);
}

async function boot(): Promise<void> {
  writeJsonLd();
  renderRoles();
  renderContacts();
  renderYear();

  const store = await createSovereignStore();
  reportStorage(store.engine);

  // Cached teasers win only when the network copy is missing.
  const cached = await store.get<readonly Teaser[]>(TEASERS_KEY);
  const teasers = cached ?? readTeasers();
  if (cached === undefined) {
    await store.set(TEASERS_KEY, [...teasers]);
  }
  renderTeasers(teasers);

  document.documentElement.dataset['ready'] = 'true';
  document.title = `${SITE_NAME} — Sovereign Digital Twin`;

  await registerServiceWorker();
}

void boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const banner = document.querySelector<HTMLParagraphElement>('#fatal');
  if (banner !== null) {
    banner.textContent = `Interface degraded: ${message}`;
    banner.hidden = false;
  }
});
