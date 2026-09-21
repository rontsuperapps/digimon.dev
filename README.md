# DIGIMON — Frontend (Tailwind CSS v4)

Frontend statis PWA. Backend (`code.gs`, Google Apps Script) TIDAK berubah.

## Struktur
```
index.html  login.html  sw.js  manifest.json
assets/app.css            <- hasil build (jangan diedit tangan)
src/input.css             <- entry Tailwind
src/theme.css             <- token warna/teks/bayangan (ganti skala --color-brand-* untuk ubah aksen)
src/components.css        <- komponen (sidebar, kartu, pivot, tabel, modal, login)
src/icons.css             <- ikon SVG-mask (class fa-*)
icons/                    <- icon-192, icon-512, icon-512-maskable, favicon-32 (pakai punyamu)
```

## Build CSS (hanya saat mengubah tampilan)
```
npm install
npm run build:css      # sekali jalan -> assets/app.css
npm run watch:css      # otomatis saat file berubah
```
Tailwind memindai `index.html` dan `login.html`, jadi class baru di kedua file itu ikut ter-build.
Class yang dirender lewat JS (baris tabel, pivot, badge) didefinisikan di `src/components.css`.

## Deploy
Upload `index.html`, `login.html`, `sw.js`, `manifest.json`, `assets/app.css` (+ folder `icons/` bila belum ada).
`sw.js` memakai network-first untuk HTML/CSS/JS, jadi versi baru langsung tampil.
Naikkan `SHELL_CACHE` di `sw.js` bila daftar `SHELL_FILES` berubah.
File `assets/wallpaper-*.jpg` tidak dipakai lagi oleh halaman login.
