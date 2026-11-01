// Ruta a Medida: permite abrir la app y ver rutas guardadas sin internet.
const VERSION = "rm-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];
const TILES = "rm-tiles";
const MAX_TILES = 400;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES), keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Las rutas y la búsqueda de lugares siempre van a internet.
  if (url.hostname === "api.openrouteservice.org") return;
  // Mapa: usa lo guardado y descarga lo nuevo.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); trimTiles(); }
      return res;
    }));
    return;
  }
  // App: primero internet (para recibir mejoras), si no hay, lo guardado.
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.origin === location.origin || url.hostname === "cdnjs.cloudflare.com" || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com")) {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
});
