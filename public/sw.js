// Building Block service worker: makes the app open and work offline once it has been visited.
// Diagrams are never stored here; only the app's own pages, scripts, styles and fonts are cached.

const CACHE = "bb-app-v1";
/** Pages to have ready offline. Their scripts, styles and fonts are cached with them. */
const SHELL = ["/", "/diagrams", "/editor", "/templates", "/privacy", "/contact"];
/** Old build files pile up across releases; keep the cache to roughly this many entries. */
const MAX_ENTRIES = 400;

const STATIC_PREFIX = "/_next/static/";

/**
 * In-app navigation (router.push) fetches a page's data, not its HTML, with an `RSC: 1` header. Offline,
 * a failed fetch makes Next reload the whole page, which would drop the diagram open in memory, so a
 * full copy of each page's data is kept under its own key too.
 */
const isRsc = (request) => request.headers.get("RSC") === "1";
const isPrefetch = (request) => request.headers.has("Next-Router-Prefetch") || request.headers.has("Next-Router-Segment-Prefetch");
const rscKey = (pathname) => new Request(`${self.location.origin}/__rsc${pathname}`);

function assetUrls(text) {
  return [...new Set(text.match(/\/_next\/static\/[^"'\s)\\<>]+/g) ?? [])];
}

async function cacheShell() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const path of SHELL) {
    try {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) continue;
      await cache.put(path, response.clone());
      assetUrls(await response.text()).forEach((url) => assets.add(url));
      const data = await fetch(path, { cache: "reload", headers: { RSC: "1" } });
      if (data.ok) await cache.put(rscKey(path), data);
    } catch {
      // Offline or failing while installing: that page is cached the next time it's visited.
    }
  }
  for (const url of assets) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      await cache.put(url, response.clone());
      // Fonts are only named in the stylesheets.
      if (url.endsWith(".css")) {
        for (const font of assetUrls(await response.text())) {
          const fontResponse = await fetch(font).catch(() => null);
          if (fontResponse?.ok) await cache.put(font, fontResponse);
        }
      }
    } catch {
      // Picked up at runtime instead.
    }
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

/** Build files never change under the same name, so the cached copy is always right. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
    void trim(cache);
  }
  return response;
}

/**
 * Always ask the server first, so people get the latest version (and the maintenance page while it's
 * on); fall back to the cached copy only when the network is unreachable.
 */
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // Only good answers are kept: never a maintenance 503 or an error page.
    if (response.ok && response.type === "basic") await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    // A page that was never visited: the start page still lets people open their file.
    if (request.mode === "navigate") {
      const fallback = (await cache.match("/diagrams")) ?? (await cache.match("/"));
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    // Pages are keyed by path, so /editor?x=1 still finds /editor offline.
    event.respondWith(networkFirst(request, url.pathname));
  } else if (isRsc(request)) {
    // Prefetches are partial; only full answers are worth keeping for offline navigation.
    event.respondWith(isPrefetch(request) ? fetch(request) : networkFirst(request, rscKey(url.pathname)));
  } else {
    event.respondWith(networkFirst(request, request));
  }
});
