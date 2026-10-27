# Video latar Nusa

Sumber video latar adalah foto Pulau Padar milik Rizknas yang sudah disimpan di
`frontend/public/images/padar.jpg`; sumber dan lisensinya tercantum pada
`frontend/public/images/ATTRIBUTION.md`. Kamera bergerak secara perlahan dan
kembali ke posisi awal untuk menghasilkan loop 12 detik. Ini adalah animasi
foto, bukan rekaman udara baru. Tidak ada suara atau teks yang dibakar ke video.

Hasil siap pakai berada di `frontend/public/videos/nusa-landscape.mp4` sehingga
pengunjung tidak perlu memuat pustaka HyperFrames atau layanan media eksternal.

Untuk membuat ulang, dari folder ini jalankan:

```bash
npm run check
npm run render
```

Gunakan `NPM_CONFIG_CACHE=/workspace/.cache/npm` pada mesin cloud ini bila
direktori cache pengguna tidak dapat ditulis. FFmpeg, Chromium, dan Node 22+
dibutuhkan hanya saat membuat ulang video.
Di mesin cloud ini, pilih Chromium yang sudah tersedia dengan
`HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium npm run render`.
