# Nusa AI — teman perjalanan 3D

Nusa AI adalah aplikasi pemandu wisata Indonesia dengan landing page berlatar video, ruang percakapan, dan avatar perempuan anime 3D yang bereaksi saat diam, berpikir, mendengarkan, dan menjawab.

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
php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8000 -t public public/index.php
```

Gunakan PHP **8.4.1+** untuk lockfile proyek saat ini (diuji pada PHP 8.5.4). Isi `GEMINI_API_KEY` pada `backend/.env` menggunakan kunci milikmu. Pertahankan konfigurasi database yang sudah digunakan proyek. Buka **Pengaturan dan akun** pada ruang chat, periksa alamat layanan (default `/api`), lalu masuk atau buat akun. Perintah server di atas menyelaraskan batas unggahan untuk proses lokal tanpa mengubah konfigurasi PHP global.

Frontend sekarang menggunakan `/api` sebagai alamat bawaan. Vite meneruskan
`/api` dan `/storage` ke backend pada port 8000, termasuk ketika memakai
`npm run preview`. Ini memungkinkan frontend dibuka dari perangkat lain tanpa
mengarahkan API ke `localhost` milik pengunjung. Untuk backend berbeda, gunakan
pengaturan koneksi atau variabel build `VITE_API_URL`. Deployment statis perlu
reverse proxy untuk kedua jalur tersebut atau alamat API eksplisit.

Di cloud, isi `GEMINI_API_KEY` melalui pengaturan lingkungan yang aman.
`GET /api/status` melaporkan apakah penyedia telah dikonfigurasi; status ini
bukan pemeriksaan koneksi atau kuota penyedia. Akun yang sudah masuk tetap
dapat melihat riwayat ketika penyedia AI belum tersedia. Pesan gagal tidak
disimpan sebagai giliran percakapan yang berhasil.

Mode demo menggunakan jawaban contoh lokal dan selalu diberi label. Mode AI langsung menggunakan API Laravel yang terhubung. Kegagalan API ditampilkan sebagai pemberitahuan dan tidak diganti dengan jawaban demo tanpa penjelasan.

## Pengalaman aplikasi

- Landing page dalam bahasa Indonesia dengan video alam layar penuh, judul putih dan hijau limau, perkenalan avatar, filter destinasi, FAQ, dan tombol yang membuka percakapan. Video dapat dijeda dan berhenti saat tidak terlihat.
- Avatar anime VRM lokal berlisensi CC0, dengan gerakan napas, kedipan, arah kepala, lambaian, ekspresi berpikir/mendengarkan, gerakan mulut saat merespons, dan simulasi rambut/pakaian. Model ini adalah karakter sampel VRoid, bukan model Misa Amane yang persis.
- Ruang chat dengan riwayat lokal, percakapan baru, hapus sesi, salin jawaban, hentikan respons, akun, dan koneksi Laravel.
- Dikte dan pembacaan jawaban menggunakan kemampuan browser. Ketersediaan suara Indonesia dan pengenalan suara bergantung browser/perangkat. Izin mikrofon diminta saat pengguna menekan tombol dikte.
- Unggahan gambar, audio, dan video yang didukung pada sesi AI langsung diteruskan ke backend; maksimal 4 berkas, 20 MiB per berkas dan total per pesan. UI mengikuti batas efektif PHP yang dilaporkan layanan. Unggahan baru disimpan privat dengan tautan sementara 15 menit; riwayat dapat disegarkan untuk memperbarui tautan.
- Tata letak desktop, tablet, dan ponsel. Avatar tampil dalam panel di desktop dan bar ringkas pada layar kecil.
- Preferensi **reduced motion** dari perangkat dihormati. Rendering 3D berhenti ketika halaman atau avatar tidak terlihat; fallback tersedia jika WebGL tidak dapat dipakai.
- Model, foto, dan font disimpan di `frontend/public`. Avatar landing mulai dimuat saat mendekati layar; aset percobaan disimpan di `frontend/reference-assets` agar tidak masuk build. Halaman pengenalan dan demo tidak memerlukan layanan aset eksternal.

## Struktur

```text
frontend/src/App.jsx                   Landing page dan navigasi hash
frontend/src/App.css                   Tata letak dan animasi landing
frontend/src/components/ChatWorkspace  Ruang percakapan dan koneksi akun
frontend/src/components/AvatarCanvas   Model dan siklus animasi avatar
frontend/src/components/AnimeAvatar    Rig VRM, ekspresi, dan animasi anime
frontend/src/components/LandingFilm    Pemutaran video latar yang aksesibel
frontend/src/lib/travelDemo.js         Jawaban contoh lokal
frontend/public/models                Avatar dan atribusi
frontend/public/videos                Video latar siap pakai
frontend/video/landing-loop            Sumber HyperFrames untuk video latar
frontend/public/images                Foto destinasi dan sumber
frontend/public/fonts                 Font lokal dan lisensi
backend/                              Laravel API, Sanctum, dan Gemini
```

## Pemeriksaan

```powershell
cd frontend
npm run build
npm run lint
npm test

cd ../backend
php vendor/phpunit/phpunit/phpunit
```

Tes akses sesi memverifikasi bahwa pengguna tidak dapat menulis ke percakapan akun lain serta sesi UUID baru dapat menerima jawaban. Tes penyedia juga mencakup kunci kosong, autentikasi, kuota, model, TLS, gangguan koneksi, jawaban kosong, dan pengulangan pesan gagal. Panggilan penyedia AI dalam tes menggunakan respons tiruan.

Build memisahkan ruang chat dan mesin 3D dari kode awal landing page. Paket mesin 3D tetap lebih besar daripada komponen UI karena memuat Three.js.

Laporan lima tahap dan batas verifikasi tersedia di [audit pengembangan](docs/development-audit-2026-10-27.md). Panduan deployment, persyaratan platform, dan migrasi lampiran publik lama ada di [dokumentasi proyek](docs/README.md); kontrak yang benar ada di [dokumentasi API](docs/api-endpoints.md). Login lama perlu diulang sekali agar token terikat ke alamat layanan. Hanya jalur sertifikat lokal `GEMINI_CA_BUNDLE` pada `.env` yang dikoreksi setelah ditemukan tidak valid; kunci API, database, dan berkas unggahan pengguna dipertahankan.

## Aset

Sumber dan lisensi avatar: [frontend/public/models/ATTRIBUTION.md](frontend/public/models/ATTRIBUTION.md).

Sumber foto: [frontend/public/images/ATTRIBUTION.md](frontend/public/images/ATTRIBUTION.md).

Video latar adalah animasi kamera pada foto Pulau Padar lokal, tanpa audio;
petunjuk pembuatan ulang ada di
[frontend/video/landing-loop/README.md](frontend/video/landing-loop/README.md).

Font DM Sans dan Manrope menggunakan SIL Open Font License; salinan lisensi tersedia di folder font.
