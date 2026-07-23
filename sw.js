/* PrintCalc Pro — service worker (PWA installable + offline-first).
 * Aplikasi tetap satu file HTML; SW hanya meng-cache "kulit" app agar bisa
 * dibuka offline setelah dipasang ke home screen. TIDAK menyentuh data —
 * order/klien/stok/keuangan tetap di IndexedDB/localStorage per HP.
 *
 * NAIKKAN nomor versi cache tiap rilis (v1 -> v2 ...) supaya HP mengambil
 * index.html baru. Untuk MEMBATALKAN PWA sepenuhnya: ganti isi file ini
 * dengan skrip self-unregister (unregister + hapus semua cache) lalu deploy —
 * itu "kill-switch" yang membersihkan SW yang sudah lengket di HP.
 */
const CACHE = "printcalc-v8";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // lintas-origin (mis. Google Fonts) dibiarkan apa adanya

  // Dokumen (navigasi): utamakan jaringan agar rilis baru terambil; offline -> cache.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        c.put("./index.html", net.clone());
        return net;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Aset lain (ikon/manifest): cache-first, isi cache saat pertama kali online.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      if (net && net.ok) { const c = await caches.open(CACHE); c.put(req, net.clone()); }
      return net;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
