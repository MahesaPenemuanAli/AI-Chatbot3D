# Nusa AI — teman perjalanan 3D

Nusa AI adalah aplikasi pemandu wisata Indonesia dengan landing page, ruang percakapan, dan avatar robot 3D yang bereaksi saat diam, berpikir, mendengarkan, dan menjawab.

## Menjalankan aplikasi

Frontend dapat langsung dicoba dalam mode demo:

```powershell
cd frontend
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya http://localhost:5173. Halaman utama menampilkan pengenalan aplikasi; tombol **Mulai petualangan** membuka ruang chat di `/#chat`.

Untuk AI langsung, jalankan backend Laravel pada terminal terpisah:

```powershell
cd backend
composer install
php artisan migrate
php artisan storage:link
php artisan serve
```

Isi `GEMINI_API_KEY` pada `backend/.env` menggunakan kunci milikmu. Pertahankan konfigurasi database yang sudah digunakan proyek. Buka **Pengaturan dan akun** pada ruang chat, periksa alamat layanan (default `http://localhost:8000/api`), lalu masuk atau buat akun.

Mode demo menggunakan jawaban contoh lokal dan selalu diberi label. Mode AI langsung menggunakan API Laravel yang terhubung. Kegagalan API ditampilkan sebagai pemberitahuan dan tidak diganti dengan jawaban demo tanpa penjelasan.

## Pengalaman aplikasi

- Landing page dalam bahasa Indonesia dengan foto destinasi lokal, marquee, animasi masuk saat scroll, parallax kartu, filter wilayah, FAQ, dan tombol yang membuka percakapan.
- Robot 3D lokal berlisensi CC0. Animasi Idle, Wave, Yes, dan ThumbsUp dipadukan dengan napas, kedipan, gerakan kepala, ekspresi berpikir, dan gerakan mulut saat merespons.
- Ruang chat dengan riwayat lokal, percakapan baru, hapus sesi, salin jawaban, hentikan respons, akun, dan koneksi Laravel.
- Dikte dan pembacaan jawaban menggunakan kemampuan browser. Ketersediaan suara Indonesia dan pengenalan suara bergantung browser/perangkat. Izin mikrofon diminta saat pengguna menekan tombol dikte.
- Unggahan gambar, audio, dan video pada sesi AI langsung diteruskan ke backend; ukuran maksimal 20 MB per berkas.
- Tata letak desktop, tablet, dan ponsel. Avatar tampil dalam panel di desktop dan bar ringkas pada layar kecil.
- Preferensi **reduced motion** dari perangkat dihormati. Rendering 3D berhenti ketika halaman atau avatar tidak terlihat; fallback tersedia jika WebGL tidak dapat dipakai.
- Model, foto, dan font disimpan di `frontend/public`. Halaman pengenalan dan demo tidak memerlukan layanan aset eksternal.

## Struktur

```text
frontend/src/App.jsx                   Landing page dan navigasi hash
frontend/src/App.css                   Tata letak dan animasi landing
frontend/src/components/ChatWorkspace  Ruang percakapan dan koneksi akun
frontend/src/components/AvatarCanvas   Model dan siklus animasi avatar
frontend/src/lib/travelDemo.js         Jawaban contoh lokal
frontend/public/models                Avatar dan atribusi
frontend/public/images                Foto destinasi dan sumber
frontend/public/fonts                 Font lokal dan lisensi
backend/                              Laravel API, Sanctum, dan Gemini
```

## Pemeriksaan

```powershell
cd frontend
npm run build
npm run lint

cd ../backend
php artisan test --filter=ChatSessionAccessTest
```

Tes akses sesi memverifikasi bahwa pengguna tidak dapat menulis ke percakapan akun lain serta sesi UUID baru dapat menerima jawaban. Panggilan penyedia AI dalam tes menggunakan respons tiruan.

Build memisahkan ruang chat dan mesin 3D dari kode awal landing page. Paket mesin 3D tetap lebih besar daripada komponen UI karena memuat Three.js.

## Aset

Sumber dan lisensi avatar: [frontend/public/models/ATTRIBUTION.md](frontend/public/models/ATTRIBUTION.md).

Sumber foto: [frontend/public/images/ATTRIBUTION.md](frontend/public/images/ATTRIBUTION.md).

Font DM Sans dan Manrope menggunakan SIL Open Font License; salinan lisensi tersedia di folder font.
