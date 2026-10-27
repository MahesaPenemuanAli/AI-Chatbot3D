# Nusa AI frontend

React 19, Vite 8, Three.js, React Three Fiber, dan Lucide.

```powershell
npm install
npm run dev
npm run build
npm run lint
node --test src/lib/chatData.test.js
```

Landing page berada di `/`; ruang chat berada di `/#chat`. Mode demo dapat digunakan tanpa backend. Mode AI membutuhkan Laravel, akun Sanctum, dan penyedia Gemini yang sudah dikonfigurasi.

Alamat API bawaan `/api` diproksikan oleh Vite ke `http://127.0.0.1:8000`.
Jalur `/storage` memakai proxy yang sama. Untuk deployment dengan API berbeda,
isi `VITE_API_URL` saat build atau ubah alamat pada pengaturan koneksi.
Kunci Gemini disimpan pada server, melalui pengaturan lingkungan atau `.env`
backend, dan tidak dimasukkan ke bundle frontend.

Hero memakai kompas dan globe 3D prosedural dengan perubahan posisi/rotasi
mengikuti guliran. `LandingStory` mengatur tiga bagian cerita tanpa melakukan
render ulang seluruh halaman pada setiap frame scroll. Galeri destinasi
bergerak horizontal pada desktop dan memakai scroll native pada ponsel atau
mode reduced motion. Aset dan tekstur eksternal tidak diperlukan untuk kompas.

Video wisata di bagian tersendiri berada di `public/videos/nusa-landscape.mp4`;
sumber dan petunjuk pembuatan ulang tersedia di `video/landing-loop/README.md`.
Video ini adalah animasi foto lokal yang berulang. Preferensi reduced motion
menampilkan poster diam. Avatar memakai model anime VRM lokal dengan gerakan
tubuh dan ekspresi, dimuat saat bagian perkenalan mendekati layar; lisensinya
tercantum di `public/models/ATTRIBUTION.md`.

Petunjuk lengkap: [README proyek](../README.md).
