const CACHE_NAME = "dailo-v2-preview-2.0.26";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./replay.html",
  "./styles.css?v=2.0.26",
  "./replay.css?v=2.0.26",
  "./night.css?v=2.0.26",
  "./manifest.webmanifest",
  "./manifest-dark.webmanifest",
  "./scripts/app.js?v=2.0.26",
  "./scripts/install-appearance.js?v=2.0.26",
  "./scripts/game.js",
  "./scripts/replay.js",
  "./assets/words.js",
  "./assets/icon-home.png",
  "./assets/dark/header-icon.webp",
  "./assets/install-icon-adaptive-180.png",
  "../assets/icon-lighthouse-192.png",
  "../assets/icon-lighthouse-512.png",
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("dailo-v2-") && key !== CACHE_NAME).map((key) => caches.delete(key))
  )));
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
