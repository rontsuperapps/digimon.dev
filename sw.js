/* ===================================================================
   DIGIMON — SERVICE WORKER (PWA)
   ===================================================================
   Tanggung jawab file ini HANYA app-shell (HTML/CSS/JS statis, ikon,
   font dari CDN), supaya halaman tetap bisa dibuka walau offline.

   Data dashboard (getDashboardBootstrap, getMonitoringGoLiveData, dst.)
   SENGAJA TIDAK di-cache di sini. Semua panggilan API ke GAS_EXEC_URL
   adalah POST lintas-origin ke script.google.com, dan Cache API tidak
   didesain untuk mem-versi-kan response POST berdasarkan body request.
   Cache "data terakhir" untuk mode offline ditangani di level aplikasi
   (lihat callGAS() di index.html), disimpan per-fn di localStorage.

   STRATEGI (v3):
   - HTML / CSS / JS same-origin  -> NETWORK-FIRST (timeout 4 dtk), cache
     jadi cadangan saat offline/lambat. Ini yang membuat versi baru
     langsung tampil di load pertama setelah deploy (dulu cache-first =
     versi baru baru muncul di load kedua).
   - Gambar/ikon/aset lain same-origin -> cache-first + refresh di belakang.
   - CDN (Google Fonts, dst.) -> stale-while-revalidate.
   NAIKKAN nomor versi cache di bawah setiap kali daftar SHELL_FILES
   berubah, supaya cache lama dibersihkan saat activate.
   =================================================================== */

const SHELL_CACHE   = 'digimon-shell-v3';
const RUNTIME_CACHE = 'digimon-runtime-v3';
const NETWORK_TIMEOUT_MS = 4000;

// File yang WAJIB ada di app-shell. Path relatif terhadap lokasi sw.js
// (taruh sw.js di root yang sama dengan index.html/login.html).
const SHELL_FILES = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './assets/app.css',
  './icons/icon-192.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // cache.addAll gagal total kalau SATU resource gagal -- dipecah
      // per-file supaya yang berhasil tetap ke-cache.
      return Promise.all(
        SHELL_FILES.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] gagal precache:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// Network-first: coba jaringan dulu (maks NETWORK_TIMEOUT_MS), simpan
// hasilnya ke cache; kalau gagal/lambat pakai salinan cache.
async function networkFirst(req) {
  try {
    const res = await fetchWithTimeout(req, NETWORK_TIMEOUT_MS);
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    // Belum ada cache sama sekali (kunjungan pertama + jaringan lambat):
    // coba sekali lagi tanpa batas waktu.
    return fetch(req).catch(() => Response.error());
  }
}

// Cache-first + refresh di belakang layar (gambar, ikon, dll.).
function cacheFirst(req) {
  return caches.match(req).then((cached) => {
    const fetchPromise = fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => cached);
    return cached || fetchPromise;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // JANGAN pernah campur tangan pada request non-GET (semua panggilan
  // API ke GAS_EXEC_URL pakai POST) -- biarkan lewat langsung ke jaringan.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const dest = req.destination;
    const isShell =
      req.mode === 'navigate' ||
      dest === 'document' || dest === 'style' || dest === 'script' ||
      url.pathname.endsWith('/') || url.pathname.endsWith('/sw.js');

    event.respondWith(isShell ? networkFirst(req) : cacheFirst(req));
    return;
  }

  // Aset CDN (Google Fonts, dll.): stale-while-revalidate, supaya halaman
  // tetap bisa dirender walau offline. TIDAK berlaku untuk GAS_EXEC_URL
  // karena itu selalu POST (sudah ditangkap guard di atas).
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
