const CACHE_NAME = "dailo-v__APP_VERSION__";
const APP_SHELL = [
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
  "./assets/icon-lighthouse-180.png",
  "./assets/icon-lighthouse-192.png",
  "./assets/icon-lighthouse-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => {
      if (event.request.mode === "navigate") return caches.match("./index.html");
      throw new Error("Offline and not cached");
    }))
  );
});
