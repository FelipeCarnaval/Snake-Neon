// Service worker do Snake Neon: stale-while-revalidate
// Serve o app shell do cache (offline) e atualiza em segundo plano quando online.
// Troque CACHE ao publicar uma versão nova para limpar cache antigo de dev.
const CACHE = "snake-v1";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // só o app shell, nada de terceiros

  e.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((resp) => {
          if (resp && resp.ok && resp.type === "basic") {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});