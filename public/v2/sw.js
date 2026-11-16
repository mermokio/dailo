const CACHE_NAME = "dailo-v2-preview-2.0.15";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./replay.html",
  "./styles.css",
  "./replay.css",
  "./manifest.webmanifest",
  "./scripts/app.js",
  "./scripts/game.js",
  "./scripts/replay.js",
  "./assets/words.js",
  "./assets/icon-home.png",
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
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("dailo-v2-") && key !== CACHE_NAME).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && url.pathname.includes("/v2/")) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
