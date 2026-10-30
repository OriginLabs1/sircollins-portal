import { describe, expect, it } from 'vitest';
import { createSovereignStore } from '../src/lib/storage.ts';
import {
  ACK_ROLES,
  buildCollectionGraph,
  buildPersonGraph,
  buildWebSiteGraph,
} from '../src/lib/schema.ts';
import type { Entry } from '../src/lib/schema.ts';
import {
  ACK_WEIGHT,
  addAcknowledgment,
  ackLink,
  computeRarity,
  createAckPayload,
  decodeAck,
  emptyState,
  encodeAckPayload,
  parseSocialUrl,
  parseState,
  payloadToAck,
  tierFor,
  toggleLove,
} from '../src/lib/portal.ts';
import type { Acknowledgment } from '../src/lib/portal.ts';

/** Minimal in-memory Storage implementation, typed to the DOM interface. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function blockedStorage(): Storage {
  const thrower = (): never => {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError');
  };
  return {
    length: 0,
    clear: thrower,
    getItem: thrower,
    key: thrower,
    removeItem: thrower,
    setItem: thrower,
  };
}

const ENTRY: Entry = {
  id: 'love-is-the-best-life',
  kind: 'inspiration',
  theme: 'Love',
  text: 'The best LIFE to live is LOVE.',
  attribution: 'Sir Collins',
  weight: 5,
};

const VALID_IDS = new Set([ENTRY.id]);

function ack(partial: Partial<Acknowledgment> = {}): Acknowledgment {
  return {
    entry: ENTRY.id,
    name: 'Ada',
    role: 'observer',
    at: '2026-10-30T10:00:00.000Z',
    source: 'local',
    ...partial,
  };
}

describe('createSovereignStore', () => {
  it('uses localStorage when OPFS is unavailable', async () => {
    const store = await createSovereignStore({ opfs: false, storage: fakeStorage() });
    expect(store.engine).toBe('localstorage');
    expect(store.volatile).toBe(false);
  });

  it('round-trips values through localStorage', async () => {
    const storage = fakeStorage();
    const store = await createSovereignStore({ opfs: false, storage });
    await store.set('profile', { name: 'Sir Collins Chris' });
    expect(await store.get<{ name: string }>('profile')).toEqual({ name: 'Sir Collins Chris' });
    expect(await store.keys()).toContain('profile');
  });

  it('removes keys', async () => {
    const store = await createSovereignStore({ opfs: false, storage: fakeStorage() });
    await store.set('a', 1);
    await store.remove('a');
    expect(await store.get('a')).toBeUndefined();
    expect(await store.keys()).not.toContain('a');
  });

  it('returns undefined for missing keys rather than throwing', async () => {
    const store = await createSovereignStore({ opfs: false, storage: fakeStorage() });
    expect(await store.get('nope')).toBeUndefined();
  });

  it('falls back to volatile memory when storage writes throw', async () => {
    const store = await createSovereignStore({ opfs: false, storage: blockedStorage() });
    expect(store.engine).toBe('memory');
    expect(store.volatile).toBe(true);
    await store.set('k', 'v');
    expect(await store.get('k')).toBe('v');
  });

  it('survives corrupt persisted JSON', async () => {
    const storage = fakeStorage();
    storage.setItem('sircollins:portal:v1', '{ not json');
    const store = await createSovereignStore({ opfs: false, storage });
    expect(await store.keys()).toEqual([]);
    await store.set('fresh', true);
    expect(await store.get('fresh')).toBe(true);
  });
});

describe('JSON-LD graphs', () => {
  it('builds a Person graph with the professional email and no portrait', () => {
    const person = buildPersonGraph();
    expect(person['@type']).toBe('Person');
    expect(person.email).toBe('access1@tutamail.com');
    expect(person.jobTitle).toContain('ICT Strategist');
    expect(person.url).toBe('https://sircollins.coreconcept1.net/');
    expect('image' in person).toBe(false);
  });

  it('builds a WebSite graph in English', () => {
    expect(buildWebSiteGraph().inLanguage).toBe('en');
  });

  it('maps inspirations to Quotations and reflections to Questions', () => {
    const collection = buildCollectionGraph([
      ENTRY,
      {
        id: 'the-truth',
        kind: 'reflection',
        theme: 'Truth',
        text: 'What is THE TRUTH about past, recent and present realities?',
        weight: 4,
      },
    ]);
    expect(collection['@type']).toBe('CollectionPage');
    expect(collection.hasPart).toHaveLength(2);
    expect(collection.hasPart[0]?.['@type']).toBe('Quotation');
    expect(collection.hasPart[1]?.['@type']).toBe('Question');
    expect(collection.hasPart[0]?.url).toBe(
      'https://sircollins.coreconcept1.net/#entry-love-is-the-best-life',
    );
  });

  it('serialises to valid JSON', () => {
    expect(() => JSON.stringify(buildCollectionGraph([ENTRY]))).not.toThrow();
  });
});

describe('acknowledgment payloads', () => {
  it('round-trips through a carrier code', () => {
    const payload = createAckPayload({
      entry: ENTRY.id,
      name: '  Ada  Lovelace ',
      role: 'communicator',
      x: 'x.com/ada',
      note: 'Carried this to my team.',
      at: '2026-10-30T10:00:00.000Z',
    });
    expect(payload).not.toBeNull();
    if (payload === null) return;

    expect(payload.name).toBe('Ada Lovelace');
    expect(payload.x).toBe('https://x.com/ada');

    const decoded = decodeAck(encodeAckPayload(payload), VALID_IDS);
    expect(decoded).toEqual(payload);
  });

  it('carries a community membership role through a link', () => {
    const payload = createAckPayload({
      entry: ENTRY.id,
      name: 'Ada',
      role: 'active-member',
      at: '2026-10-30T10:00:00.000Z',
    });
    if (payload === null) throw new Error('payload');
    const decoded = decodeAck(encodeAckPayload(payload), VALID_IDS);
    expect(decoded?.role).toBe('active-member');
  });

  it('rejects unknown entries and bad roles', () => {
    const raw = encodeAckPayload({
      v: 1,
      entry: 'not-an-entry',
      name: 'Ada',
      role: 'observer',
      at: '2026-10-30T10:00:00.000Z',
    });
    expect(decodeAck(raw, VALID_IDS)).toBeNull();
  });

  it('rejects malformed carrier codes instead of throwing', () => {
    expect(decodeAck('!!!!', VALID_IDS)).toBeNull();
    expect(decodeAck('', VALID_IDS)).toBeNull();
  });

  it('only accepts the named social networks', () => {
    expect(parseSocialUrl('x.com/ada', 'x')).toEqual({ url: 'https://x.com/ada' });
    expect(parseSocialUrl('https://facebook.com/ada', 'facebook')).toEqual({
      url: 'https://facebook.com/ada',
    });
    const wrong = parseSocialUrl('x.com/ada', 'facebook');
    expect(wrong !== null && 'error' in wrong).toBe(true);
    expect(parseSocialUrl('', 'x')).toBeNull();
  });

  it('builds a shareable link that carries the payload', () => {
    const payload = createAckPayload({
      entry: ENTRY.id,
      name: 'Ada',
      role: 'observer',
      at: '2026-10-30T10:00:00.000Z',
    });
    expect(payload).not.toBeNull();
    if (payload === null) return;
    const link = ackLink('https://sircollins.coreconcept1.net/', payload);
    expect(link.startsWith('https://sircollins.coreconcept1.net/#ack=')).toBe(true);
    const code = link.slice(link.indexOf('#ack=') + 5);
    expect(decodeAck(code, VALID_IDS)).toEqual(payload);
  });
});

describe('portal state', () => {
  it('loves and un-loves an entry', () => {
    const loved = toggleLove(emptyState(), ENTRY.id);
    expect(loved.loved).toEqual([ENTRY.id]);
    expect(toggleLove(loved, ENTRY.id).loved).toEqual([]);
  });

  it('deduplicates acknowledgments by entry, name and time', () => {
    const one = addAcknowledgment(emptyState(), ack());
    const two = addAcknowledgment(one, ack());
    expect(two.acknowledgments).toHaveLength(1);
    const three = addAcknowledgment(two, ack({ name: 'Grace' }));
    expect(three.acknowledgments).toHaveLength(2);
  });

  it('drops corrupt records when parsing stored state', () => {
    const parsed = parseState({
      version: 1,
      loved: ['a', 'a', 7],
      acknowledgments: [{ entry: ENTRY.id, name: '', role: 'observer', at: 'nope' }, ack()],
      receptive: true,
    });
    expect(parsed.loved).toEqual(['a']);
    expect(parsed.acknowledgments).toHaveLength(1);
    expect(parsed.receptive).toBe(true);
  });

  it('survives entirely invalid state', () => {
    expect(parseState('nope')).toEqual(emptyState());
    expect(parseState(null)).toEqual(emptyState());
  });

  it('imports a carried acknowledgment with source "link"', () => {
    const payload = createAckPayload({
      entry: ENTRY.id,
      name: 'Ada',
      role: 'responder',
      at: '2026-10-30T10:00:00.000Z',
    });
    if (payload === null) throw new Error('payload');
    const imported = payloadToAck(payload, 'link');
    expect(imported.source).toBe('link');
    expect(imported.role).toBe('responder');
  });
});

describe('rarity', () => {
  it('starts at the curation floor with no acknowledgments', () => {
    const rarity = computeRarity(ENTRY, []);
    expect(rarity.intrinsic).toBe(5);
    expect(rarity.social).toBe(0);
    expect(rarity.tier.id).toBe('common');
  });

  it('weights witness by depth, not by raw count', () => {
    const rarity = computeRarity(ENTRY, [
      ack({ role: 'observer' }),
      ack({ role: 'communicator', name: 'Grace' }),
      ack({ role: 'responder', name: 'Alan' }),
    ]);
    expect(rarity.social).toBe(
      ACK_WEIGHT.observer + ACK_WEIGHT.communicator + ACK_WEIGHT.responder,
    );
    expect(rarity.counts).toEqual({
      observer: 1,
      aspirant: 0,
      communicator: 1,
      'active-member': 0,
      responder: 1,
    });
    expect(rarity.score).toBe(rarity.intrinsic + rarity.social);
  });

  it('clamps the curation weight to the 0-5 band', () => {
    expect(computeRarity({ ...ENTRY, weight: 99 }, []).intrinsic).toBe(5);
    expect(computeRarity({ ...ENTRY, weight: -4 }, []).intrinsic).toBe(0);
  });

  it('maps scores onto the five tiers', () => {
    expect(tierFor(0).id).toBe('very-common');
    expect(tierFor(3).id).toBe('common');
    expect(tierFor(6).id).toBe('uncommon');
    expect(tierFor(10).id).toBe('rare');
    expect(tierFor(15).id).toBe('unique');
    expect(tierFor(999).id).toBe('unique');
  });

  it('offers all five acknowledgment roles, including the community ones', () => {
    expect([...ACK_ROLES]).toEqual([
      'observer',
      'aspirant',
      'communicator',
      'active-member',
      'responder',
    ]);
    expect(ACK_WEIGHT['active-member']).toBeLessThan(ACK_WEIGHT.responder);
    expect(ACK_WEIGHT.aspirant).toBeLessThan(ACK_WEIGHT.communicator);
  });
});
