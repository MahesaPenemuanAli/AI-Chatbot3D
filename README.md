# Nusa AI — teman perjalanan 3D

Nusa AI adalah aplikasi pemandu wisata Indonesia dengan landing page 3D interaktif, ruang percakapan, dan maskot penjelajah 3D orisinal yang bereaksi saat diam, berpikir, mendengarkan, dan menjawab.

## Menjalankan aplikasi

Jalankan frontend:

```powershell
cd frontend
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya http://localhost:5173. Halaman utama menampilkan pengenalan aplikasi; tombol **Mulai cerita** membuka ruang chat di `/#chat`.

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

Ruang chat hanya menggunakan AI langsung melalui API Laravel yang terhubung.
Masuk atau buat akun untuk mengirim pesan. Kegagalan API ditampilkan sebagai
pemberitahuan; pesan yang belum terkirim tetap dapat dicoba ulang.

AI langsung menggunakan `GEMINI_MODEL=gemini-3.5-flash-lite`, dengan
`GEMINI_THINKING_LEVEL=low` untuk percakapan yang responsif dan
`GEMINI_MAX_OUTPUT_TOKENS=4096`. `GEMINI_FALLBACK_MODEL` dikosongkan secara
bawaan sehingga permintaan langsung memakai 3.5 Flash Lite tanpa mencoba 3.8.
Pengaturan Gemini 3 menggunakan `thinkingLevel` tanpa parameter sampling
lama. Setelah mengubah `.env`, jalankan `php artisan config:clear`.
Lihat [dokumentasi model Google](https://ai.google.dev/gemini-api/docs/models).

Pada permintaan chat, batas eksekusi PHP yang pendek dinaikkan menjadi 60
detik untuk permintaan itu saja. Waktu tunggu satu panggilan Gemini maksimal
40 detik, seluruh percobaan termasuk fallback berbagi batas 45 detik, dan
frontend menunggu maksimal 65 detik. Jika hosting melarang perubahan batas
PHP, panggilan AI diperpendek agar masih sempat mengirim kesalahan JSON.
Timeout AI menghasilkan `AI_TIMEOUT` yang dapat dicoba ulang tanpa menyimpan
giliran gagal. Batas waktu reverse proxy/hosting perlu mengizinkan setidaknya
65 detik; perubahan ini tidak mengubah `php.ini` global.

Jika model cadangan diaktifkan, `GEMINI_PRIMARY_TIMEOUT_SECONDS=12` membatasi
waktu tunggu awal ke model utama agar masih ada waktu untuk jawaban cadangan.
Setelah timeout atau gangguan model utama, server memakai cadangan selama
60 detik sebelum mencoba model utama lagi. Kesalahan kunci, TLS, kuota,
validasi, dan pemblokiran konten tetap dilaporkan, bukan dialihkan ke model lain.
Model yang benar-benar menjawab disimpan per pesan, dikembalikan melalui API,
dan diberi label di ruang chat; jawaban cadangan tidak ditampilkan sebagai model utama.

Seluruh pertanyaan dan lampiran dikirim langsung ke AI. Riwayat AI dikirim berurutan,
dengan maksimal 20 pesan terbaru, dan instruksi Nusa mengutamakan pertanyaan
terakhir serta preferensi yang sudah disampaikan.

Pembacaan memilih suara Indonesia yang paling alami yang tersedia di browser,
menunggu daftar suara siap, dan membagi jawaban menjadi potongan pendek agar
tidak tersendat. Dikte menghentikan pembacaan lebih dulu agar mikrofon tidak
menangkap suara Nusa sendiri. Gerak mulut mengikuti awal, batas kata, jeda,
dan akhir suara; browser tanpa batas kata memakai perkiraan gerak selama suara
aktif. Gestur tangan, siku, pergelangan, kedipan, dan pandangan bervariasi.
Kualitas timbre tetap bergantung pada suara Indonesia di perangkat; model
`gemini-3.5-flash-lite` menghasilkan teks, bukan audio.

## Pengalaman aplikasi

- Landing page dalam bahasa Indonesia dengan cerita scroll tiga bagian, kompas dan globe 3D yang berubah posisi serta rotasi mengikuti guliran, tipografi besar, dan palet hijau hutan–limau. Galeri destinasi bergeser menyamping pada desktop dan dapat digeser langsung pada ponsel.
- Perkenalan avatar dimuat saat mendekati layar. Video wisata lokal hadir dalam bingkai tersendiri, dengan tombol jeda dan penghentian otomatis saat tidak terlihat. Filter destinasi, FAQ, dan tombol chat tetap dapat dipakai dengan keyboard.
- Pengalaman bawah memakai satu panggung 3D layar penuh dengan empat bab scroll. Kompas–globe yang sama berpindah posisi dan berubah menjadi atlas lipat, penunjuk FAQ, lalu globe keberangkatan. Gerak kamera mengikuti alur konten dengan jeda dan transisi halus; tidak ada unduhan model atau tekstur tambahan. Satu kanvas WebGL merender adegan, berhenti di luar layar, dan menyesuaikan resolusi menurut beban perangkat. Jeda mempertahankan pose terakhir tanpa lompatan.
- Nusa memakai model wanita anime modern resmi pixiv Inc., dimuat lokal sebagai VRM. Kaus lavender, rambut panjang, ekspresi, jari, gerak tubuh berlapis dan spring bones memberi gerakan yang lebih alami. Mulut mengikuti suara yang benar-benar diputar. Sumber dan lisensi disimpan di frontend/public/models/ATTRIBUTION.md.
- Ruang chat dengan riwayat lokal, percakapan baru, hapus sesi, salin jawaban, hentikan respons, akun, dan koneksi Laravel.
- Dikte dan pembacaan jawaban menggunakan kemampuan browser. Ketersediaan suara Indonesia dan pengenalan suara bergantung browser/perangkat. Izin mikrofon diminta saat pengguna menekan tombol dikte.
- Unggahan gambar, audio, dan video yang didukung pada sesi AI langsung diteruskan ke backend; maksimal 4 berkas, 20 MiB per berkas dan total per pesan. UI mengikuti batas efektif PHP yang dilaporkan layanan. Unggahan baru disimpan privat dengan tautan sementara 15 menit; riwayat dapat disegarkan untuk memperbarui tautan.
- Tombol kamera membuka pratinjau kamera depan/belakang, ambil foto, ambil ulang, dan konfirmasi lampiran. Foto JPEG diperkecil hingga sisi terpanjang 1600 px dan memakai validasi unggahan yang sama. Kamera berhenti saat ditutup, foto diambil, atau halaman ditinggalkan. Pratinjau langsung membutuhkan HTTPS atau localhost; kamera native perangkat menjadi alternatif pada browser yang mendukungnya.
- Ruang chat memakai putih/lavender dengan teks gelap dan font DM Sans/Manrope, selaras dengan bagian perkenalan Nusa di landing page. Pada mobile, karakter menjadi panggung layar penuh dengan framing kepala sampai lutut, seperti tampilan panggilan; percakapan dibuka lewat panel dan kontrol pesan tetap di bawah. Tinggi kotak pesan, lampiran, dan pemberitahuan diukur otomatis agar framing menyesuaikan ruang yang tersedia. Desktop tetap memakai panel karakter di samping percakapan. Kamera dan jalur gerak tangan diuji dengan proyeksi Three.js, termasuk transisi pada 30/60/120 fps.
- Preferensi **reduced motion** dari perangkat dihormati. Rendering 3D berhenti ketika halaman atau avatar tidak terlihat; fallback tersedia jika WebGL tidak dapat dipakai.
- Model, foto, dan font disimpan di `frontend/public`. Avatar landing mulai dimuat saat mendekati layar; aset percobaan disimpan di `frontend/reference-assets` agar tidak masuk build. Halaman pengenalan tidak memerlukan layanan aset eksternal.

## Struktur

```text
frontend/src/App.jsx                   Landing page dan navigasi hash
frontend/src/App.css                   Tata letak dan animasi landing
frontend/src/components/ChatWorkspace  Ruang percakapan dan koneksi akun
frontend/src/components/AvatarCanvas   Model dan siklus animasi avatar
frontend/src/components/AnimeAvatar    Model wanita anime, ekspresi dan animasi
frontend/src/components/NusaPortrait   Poster dan fallback SVG karakter
frontend/src/components/MobileCall     Panggung mobile dan kontrol percakapan
frontend/src/lib/animeMotion.js        Pose dan transisi kerangka VRM
frontend/src/components/ExpeditionStory Cerita scroll empat bab dan FAQ
frontend/src/components/ExpeditionWorld Kompas–globe 3D yang mengikuti seluruh cerita
frontend/src/components/LandingMotion  Area adegan, scroll, dan kontrol animasi
frontend/src/components/LandingRenderer Satu kanvas untuk seluruh adegan bawah
frontend/src/components/TravelWorlds   Obrolan, kompas FAQ, dan globe 3D
frontend/src/components/JourneyMapWorld Peta lipat dan miniatur pulau 3D
frontend/src/components/LandingStory   Alur scroll dan adegan pembuka
frontend/src/components/JourneyScene   Kompas, globe, dan jalur pesawat 3D
frontend/src/components/DestinationGallery Galeri destinasi horizontal
frontend/src/components/CompanionIntro Perkenalan avatar yang dimuat bertahap
frontend/src/components/LandingFilm    Pemutaran video wisata yang aksesibel
frontend/src/lib/chatPrompts.js        Inspirasi pertanyaan untuk AI
frontend/src/components/CameraCapture  Pengambilan foto dan pratinjau lampiran
frontend/src/lib/cameraCapture.js      Siklus stream dan pengolahan foto kamera
frontend/public/models                Avatar dan atribusi
frontend/public/videos                Video wisata siap pakai
frontend/video/landing-loop            Sumber HyperFrames untuk video wisata
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

Video wisata adalah animasi kamera pada foto Pulau Padar lokal, tanpa audio;
petunjuk pembuatan ulang ada di
[frontend/video/landing-loop/README.md](frontend/video/landing-loop/README.md).

Font DM Sans dan Manrope menggunakan SIL Open Font License; salinan lisensi tersedia di folder font.
