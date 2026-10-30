import { describe, expect, it } from 'vitest';
import { createSovereignStore } from '../src/lib/storage.ts';
import { buildBlogGraph, buildPersonGraph, buildWebSiteGraph } from '../src/lib/schema.ts';
import type { Teaser } from '../src/lib/schema.ts';

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
  const teaser: Teaser = {
    id: 'sample',
    title: 'Sovereignty by Design',
    summary: 'Data ownership is an architectural decision.',
    theme: 'Sovereignty',
    publishedAt: '2026-01-12',
    tags: ['local-first'],
  };

  it('builds a Person graph with the professional email', () => {
    const person = buildPersonGraph();
    expect(person['@type']).toBe('Person');
    expect(person.email).toBe('access1@tutamail.com');
    expect(person.jobTitle).toContain('ICT Strategist');
    expect(person.url).toBe('https://sircollins.coreconcept1.net/');
    expect(person.image).toBe('https://sircollins.coreconcept1.net/brand/signature.jpg');
  });

  it('builds a WebSite graph in English', () => {
    expect(buildWebSiteGraph().inLanguage).toBe('en');
  });

  it('maps teasers to BlogPosting entries', () => {
    const blog = buildBlogGraph([teaser]);
    expect(blog['@type']).toBe('Blog');
    expect(blog.blogPost).toHaveLength(1);
    expect(blog.blogPost[0]?.headline).toBe('Sovereignty by Design');
    expect(blog.blogPost[0]?.keywords).toBe('local-first');
  });

  it('serialises to valid JSON', () => {
    expect(() => JSON.stringify(buildBlogGraph([teaser]))).not.toThrow();
  });
});
