/*
 * Service worker: offline shell + cache-first same-origin assets.
 *
 * Strategy:
 * - Navigations: network first, cached shell as fallback (fresh content when
 *   online, instant load when not).
 * - Same-origin static assets (hashed bundles, fonts, images): cache first.
 *   Filenames carry a hash or a long max-age, so a cached copy is never stale
 *   within a cache generation; a new deploy bumps CACHE_VERSION.
 * - Cross-origin requests are left alone.
 *
 * Bump CACHE_VERSION on every deploy that changes the shell.
 */
const CACHE_VERSION = 'v9';
const SHELL_CACHE = `sircollins-shell-${CACHE_VERSION}`;
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/mark.svg',
  '/icons/maskable.svg',
  '/brand/logo.png',
  '/media/tedx-jalingo.jpg',
  '/fonts/inter-latin.woff2',
  '/fonts/inter-latin-ext.woff2',
  '/fonts/jetbrains-mono-latin.woff2',
  '/fonts/jetbrains-mono-latin-ext.woff2',
];

async function remember(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await cache.put(url, response);
    return response;
  } catch {
    return null;
  }
}

/**
 * The HTML points at hashed bundles that change every deploy. Read the shell
 * once during install and precache whatever it names, plus the files it loads.
 * One failure must not abort the whole install, so each file is independent.
 */
async function precache(cache) {
  await Promise.all(SHELL_ASSETS.map((url) => remember(cache, url)));
  try {
    const response = await fetch('/index.html', { cache: 'reload' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put('/index.html', response);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    await Promise.all(assets.map((url) => remember(cache, url)));
  } catch {
    // A missing bundle must not abort the install; the runtime cache fills in.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(precache)
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  return new URL(url, self.location.origin).origin === self.location.origin;
}

/**
 * Cache keys created by install may differ from a page request only in headers
 * (Vary). Ignoring Vary is safe here because a cache generation is immutable.
 */
async function matchCached(cache, request) {
  return (
    (await cache.match(request, { ignoreVary: true })) ??
    (await cache.match(request.url, { ignoreVary: true })) ??
    null
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!isSameOrigin(request.url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const copy = response.clone();
          const cache = await caches.open(SHELL_CACHE);
          await cache.put('/index.html', copy);
          return response;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await matchCached(cache, '/index.html')) ??
            (await matchCached(cache, '/')) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await matchCached(cache, request);
      if (cached !== null) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
