const scopePath = new URL(self.registration.scope).pathname;
const CACHE_PREFIX = `dailo-release:${scopePath}:`;
const CACHE_NAME = `${CACHE_PREFIX}__APP_VERSION__`;
const previousCache = scopePath.endsWith("/v2/") ? /^dailo-v2-preview-/ : /^dailo-v\d+\.\d+\.\d+$/;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./replay.html",
  "./styles.css?v=__APP_VERSION__",
  "./replay.css?v=__APP_VERSION__",
  "./night.css?v=__APP_VERSION__",
  "./manifest.webmanifest",
  "./manifest-dark.webmanifest",
  "./scripts/app.js?v=__APP_VERSION__",
  "./scripts/install-appearance.js?v=__APP_VERSION__",
  "./scripts/game.js",
  "./scripts/replay.js",
  "./scripts/state.js",
  "./assets/words.js",
  "./assets/icon-home.png",
  "./assets/dark/header-icon.webp",
  "./assets/install-icon-adaptive-180.png",
  "./assets/icon-lighthouse-192.png",
  "./assets/icon-lighthouse-512.png",
  "./assets/dark/install-icon-192.png",
  "./assets/dark/install-icon-512.png",
  "./assets/dark/header.webp",
  "./assets/dark/footer.webp",
  "./assets/dark/board.webp",
  "./assets/wordmark.png",
  "./assets/header-background.png",
  "./assets/footer-background.png",
  "./assets/board-background-v2.png",
  "./assets/submit-button.png",
  "./assets/tile-empty.png",
  "./assets/tile-correct.png",
  "./assets/tile-present.png",
  "./assets/tile-absent.png",
  "./assets/game-1-complete.png",
  "./assets/game-1-incomplete.png",
  "./assets/game-2-complete.png",
  "./assets/game-2-incomplete.png",
  "./assets/game-3-complete.png",
  "./assets/game-3-incomplete.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(CORE_ASSETS))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) =>
      key !== CACHE_NAME && (key.startsWith(CACHE_PREFIX) || previousCache.test(key))
    ).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    if (event.request.mode === "navigate") {
      try {
        return await fetch(event.request);
      } catch {
        return await cache.match(event.request, { ignoreSearch: true }) || Response.error();
      }
    }
    return await cache.match(event.request) || fetch(event.request);
  }));
});
