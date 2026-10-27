# Dokumentasi Nusa AI

Nusa AI terdiri dari frontend React/Vite dan API Laravel/Sanctum dengan penyedia Gemini. Halaman pengenalan dan demo memakai aset serta jawaban lokal; AI langsung memerlukan akun, backend, dan kunci penyedia.

## Panduan utama

- [Menjalankan aplikasi dan fitur](../README.md)
- [Kontrak API yang tersedia](api-endpoints.md)
- [Audit lima tahap, prioritas, dan hasil pengujian](development-audit-2026-10-27.md)
- [Audit backend](backend-audit-2026-10-27.md)
- [Audit frontend](frontend-audit-2026-10-27.md)
- [Audit performa dan aksesibilitas](performance-audit-2026-10-27.md)

## Persyaratan dan instalasi

Gunakan PHP 8.4.1+ untuk lockfile proyek saat ini (diuji dengan PHP 8.5.4), Composer, Node.js yang memenuhi engines Vite pada package-lock.json, npm, dan SQLite atau MySQL. Rentang langsung composer.json mengizinkan PHP 8.3, tetapi paket Symfony pada lockfile membutuhkan versi lebih baru. Instalasi development juga harus memenuhi persyaratan PHP paket pengujian Composer. Jangan menimpa .env atau database yang sudah ada.

Untuk checkout baru:

1. Di backend, jalankan composer install. Salin .env.example ke .env hanya bila .env belum tersedia; isi database, APP_URL, dan GEMINI_API_KEY melalui konfigurasi lokal yang aman.
2. Untuk instalasi baru saja, jalankan php artisan key:generate lalu php artisan migrate. API dan Sanctum sudah terpasang; tidak perlu menjalankan artisan install:api ulang.
3. Untuk menjalankan API lokal dengan batas unggahan yang sesuai UI:

```powershell
cd backend
php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8000 -t public public/index.php
```

4. Di terminal terpisah:

```powershell
cd frontend
npm ci
npm run dev
```

Vite meneruskan /api dan /storage ke port 8000. Alamat API bawaan /api; pengaturan alamat khusus diterapkan melalui tombol, dan mengganti layanan mengeluarkan akun dari perangkat. Login lama yang belum terikat alamat layanan perlu dilakukan ulang setelah pembaruan keamanan.

## Perilaku dan batas yang sudah diimplementasikan

- Backend mengembalikan JSON setelah jawaban Gemini lengkap. Animasi teks frontend bukan streaming dari server.
- Riwayat demo disimpan lokal. Riwayat akun dipisahkan menurut layanan/akun dan diperbarui setelah verifikasi login; kegagalan sebagian riwayat memiliki tombol coba lagi.
- Lampiran berupa gambar, audio, atau video yang diizinkan: maksimal empat berkas, 20 MiB per berkas dan total satu pesan. Batas efektif juga mengikuti PHP/hosting dan dilaporkan endpoint status. Batas PHP lokal awal audit adalah 2M per berkas dan 8M per permintaan; perintah server di atas mengaturnya hanya untuk proses lokal tersebut.
- Unggahan baru disimpan privat. URL pratinjau bertanda tangan berlaku 15 menit; muat ulang riwayat melalui Pengaturan untuk memperbaruinya. URL ini dapat dipakai siapa pun yang memilikinya selama masa berlaku, sehingga jangan dibagikan.
- Riwayat yang dikirim ke Gemini dibatasi 20 pesan terbaru serta total anggaran media 20 MiB termasuk pesan baru. Arsip percakapan tetap tersimpan; unggah ulang lampiran lama bila dibutuhkan dalam konteks baru.
- Dikte dan pembacaan jawaban memakai kemampuan browser/perangkat. Tidak ada layanan TTS berbayar atau pemesanan hotel/tiket yang diimplementasikan.

## Deployment

Sajikan hanya frontend/dist sebagai situs statis dan backend/public sebagai document root PHP. Jangan mengekspos direktori proyek, .env, vendor, storage privat, atau reference-assets. Server Vite development/preview bukan server produksi.

Gunakan HTTPS, APP_ENV=production, APP_DEBUG=false, APP_URL yang benar, kunci aplikasi unik, database/cache yang persisten, serta reverse proxy /api menuju backend. Untuk backend pada origin berbeda, atur alamat API dan izin origin hosting sesuai domain frontend. Setel upload_max_filesize minimal20M dan post_max_size minimal24M pada PHP yang benar-benar melayani HTTP; periksa juga batas body reverse proxy.

Unggahan publik lama tidak otomatis dipindahkan saat deploy. Jalankan pemeriksaan migrasi privat yang dijelaskan di laporan backend, tinjau hasilnya, lalu jalankan migrasi secara eksplisit. Simpan cadangan sebelum melakukan operasi pada data produksi.

## Pemeriksaan

```powershell
cd frontend
npm test
npm run lint
npm run build
npm audit

cd ../backend
php vendor/phpunit/phpunit/phpunit
composer audit --locked
```

Tes backend memakai database SQLite dalam memori, penyimpanan tiruan, dan respons HTTP penyedia tiruan. Tes tidak memerlukan kunci AI. Audit keamanan dependensi hanya mendeteksi advisori yang dikenal saat pemeriksaan.

Pemeriksaan visual desktop/ponsel, dikte, suara perangkat, dan koneksi/kuota AI langsung masih memerlukan validasi lingkungan nyata; hasil otomatis tidak menggantikannya.

## Dokumen perancangan historis

[Proposal sistem](proposal-perancangan-sistem.md), [daftar pengembangan awal](list-pengerjaan-development.md), dan [rancangan database](database-design.md) memuat gagasan serta target awal. Bagian TTS eksternal, viseme, dan penyedia alternatif di sana merupakan rancangan, bukan klaim fitur yang sudah tersedia. Gunakan kontrak API dan kode saat ini untuk integrasi.

Pada audit lokal 27 Oktober 2026, hanya jalur GEMINI_CA_BUNDLE dalam .env yang dikoreksi ke bundel sertifikat proyek setelah probe nyata membuktikan jalur sebelumnya tidak valid. Verifikasi HTTPS tetap aktif; kunci API dan data pengguna tidak diubah. Probe Gemini teks dengan konfigurasi lokal yang sudah diperbaiki berhasil. Pemeriksaan visual, suara, perangkat, dan media ke AI nyata tetap menjadi batas verifikasi.
