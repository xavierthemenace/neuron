/**
 * Neuron's service worker.
 *
 * Generated from this template by scripts/build-sw.mjs, which replaces
 * 090d374845b8 with a hash of the build output. Do not edit public/sw.js
 * directly — it is overwritten on every build.
 *
 * Caching strategy, by request kind:
 *
 *   navigations   network-first, falling back to the cached shell. Keeps the
 *                 app openable offline without ever pinning a stale HTML
 *                 document on a good connection.
 *   build assets  cache-first. Everything under /_next/static is already
 *                 content-hashed, so a cached copy can never be wrong.
 *   everything    stale-while-revalidate. Serves instantly, refreshes behind.
 *   else
 *
 * The cache name carries the build id, so a new release starts from an empty
 * cache and the activate handler deletes every older one. The previous
 * hand-maintained version string meant any release where someone forgot to
 * bump it kept serving the old application shell forever.
 */
const BUILD = "090d374845b8";
const CACHE = `neuron-${BUILD}`;
const CORE = ["/", "/manifest.webmanifest", "/favicon.ico", "/neuron-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      // Waiting forever behind an old worker is how users end up weeks behind.
      // The page is told about the update and decides when to reload.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("neuron-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      // Navigation preload shaves the worker's startup cost off the first
      // navigation, which is exactly when a cold worker is most expensive.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (event.data?.type === "BUILD_ID") {
    event.source?.postMessage({ type: "BUILD_ID", build: BUILD });
    return;
  }
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;

  const urls = event.data.urls.filter((value) => {
    if (typeof value !== "string") return false;
    try {
      return new URL(value, self.location.origin).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled(urls.map((url) => cache.add(url)));
    }),
  );
});

/** Content-hashed build output can be served from cache without revalidating. */
function isImmutable(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          const response = preloaded || (await fetch(request));
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("/")) ||
            new Response("Neuron is offline and has no cached shell yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })(),
    );
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
