# Audit dan pengembangan backend — 27 Oktober 2026

## Analisis (bukti sebelum perubahan)

| ID | Prioritas | Bukti kode awal | Dampak |
| --- | --- | --- | --- |
| BE-01 | P1 | `ChatController::sendMessage` hanya memvalidasi `file|max:20480`, tanpa MIME/jumlah/ukuran gabungan; `store(..., 'public')`. | HTML/SVG atau berkas lain dapat dipublikasikan; batas 4 berkas/total 20 MiB di frontend dapat dilewati melalui API. |
| BE-02 | P1 | `routes/api.php` login/register/sendMessage tidak mempunyai middleware throttle. | Percobaan sandi dan panggilan AI berbiaya dapat diulang tanpa pembatasan aplikasi. |
| BE-03 | P2 | `deleteSession` hanya menjalankan `$session->delete()`; relasi memakai cascade DB. | Berkas lampiran tetap tersimpan setelah percakapan dihapus. |
| BE-04 | P2 | Seluruh riwayat dan seluruh isi lampiran dibaca/base64 pada setiap permintaan. | Penggunaan memori dan payload AI bertambah tanpa batas seiring percakapan. |
| BE-05 | P2 | Register membuat user kemudian token di luar transaksi; token Sanctum tidak mempunyai waktu kedaluwarsa. | Kegagalan penerbitan token meninggalkan akun parsial; kredensial yang lama tidak berakhir otomatis. |
| BE-06 | P1 | Pemeriksaan runtime PHP lokal: `upload_max_filesize=2M`, `post_max_size=8M`; UI awal menyebut 20 MB. | Berkas yang diterima UI dapat ditolak PHP sebelum controller memprosesnya. |
| BE-07 | P2 | Daftar awal frontend menerima GIF/AVIF, sedangkan [dokumentasi Gemini](https://ai.google.dev/gemini-api/docs/image-understanding) mencantumkan PNG/JPEG/WEBP/HEIC/HEIF. | Pengguna dapat memilih gambar yang tidak didukung penyedia. |
| BE-08 | P1 | Probe runtime menemukan `GEMINI_CA_BUNDLE` berisi assignment/path yang tidak valid; Guzzle melempar `InvalidArgumentException` sebelum jaringan, sedangkan service hanya menangkap `ConnectionException`. | Konfigurasi CA yang rusak menghasilkan 500 dan dapat menyingkap path server saat debug aktif. |

Pemeriksaan positif: pemeriksaan pemilik sesi terjadi sebelum panggilan AI; kegagalan AI tidak menyimpan giliran atau berkas; token/password tidak masuk respons user; kunci Gemini berada pada header dan pesan kesalahan penyedia tidak diteruskan mentah.

## Planning

1. Samakan validasi unggahan dengan UI: gambar/audio/video yang didukung, maksimal 4 berkas, maksimal gabungan 20 MiB; tolak sebelum provider/storage.
2. Tambahkan pembatasan percobaan autentikasi per IP/akun dan pesan per user; respons 429 berbahasa Indonesia beserta Retry-After.
3. Hapus berkas saat penghapusan sesi berhasil, dengan pemeriksaan kepemilikan tetap berlaku.
4. Batasi riwayat outbound AI pada pesan terbaru dan anggaran payload; arsip DB tetap utuh.
5. Transaksi register/token, waktu berlaku token yang terkonfigurasi, validasi/normalisasi identitas akun yang konsisten.
6. Regresi offline menggunakan database SQLite di memori dan HTTP/storage fake; tidak memakai kunci AI atau database pengguna.
7. Publikasikan batas unggahan efektif PHP melalui status API, konsumsi di frontend, dan sediakan prosedur migrasi lampiran lama yang dapat diperiksa sebelum diterapkan.

## Eksekusi

- Unggahan baru disimpan pada disk `local` privat (`storage/app/private/attachments`), dengan metadata `private/attachments/...`. Batas aplikasi 4 berkas/20 MiB gabungan diperkecil bila konfigurasi PHP lebih rendah. MIME diperiksa dari isi berkas; HTML/SVG/dokumen/format gambar yang tidak didukung ditolak sebelum AI dipanggil. Nama berkas dibatasi 255 byte.
- `GET /api/status` menambah `upload_limits` berisi `max_attachment_bytes`, `max_total_attachment_bytes`, dan `max_attachment_count`. Total menyediakan cadangan multipart 256 KiB. PHP ukuran `0` tetap dibatasi batas aplikasi; unggahan yang dimatikan menghasilkan jumlah 0. Batas lokal efektif: 2 MiB/berkas, 7,75 MiB gabungan, 4 berkas.
- Respons unggah dan riwayat pemilik menambah `download_url`, berupa URL relatif bertanda tangan 15 menit pada `/api/chat/attachments/{id}?expires=...&signature=...`. Awalan subfolder deployment dipertahankan. Tidak perlu menaruh token akun pada URL. URL ini memberikan akses kepada pemegangnya sampai kedaluwarsa; jangan membagikannya. URL tanpa tanda tangan, diubah, atau kedaluwarsa ditolak. Respons media memakai `nosniff`, `no-store`, dan `no-referrer`. GIF/AVIF lama masih dapat dipratinjau dengan aman, tetapi tidak diterima sebagai unggahan AI baru.
- Menghapus sesi memeriksa pemilik lalu menghapus berkas privat/publik lama yang dimiliki sesi. Kegagalan penghapusan penyimpanan menghasilkan 503, bukan laporan sukses.
- Outbound AI memuat maksimal 20 pesan riwayat terbaru secara kronologis; anggaran media gabungan riwayat+unggahan baru 20 MiB. Riwayat lengkap tetap tersimpan. Lampiran lama yang tidak tersedia/tidak muat diganti penanda yang meminta unggah ulang bila diperlukan. [Dokumentasi metode masukan Gemini](https://ai.google.dev/gemini-api/docs/file-input-methods) menjadi rujukan perilaku inline; batas aplikasi sengaja lebih kecil daripada batas penyedia.
- Login dibatasi 5/menit per IP+email (email dinormalisasi) dan 20/menit per IP; register 3/menit per IP; chat 10/menit per user. Respons 429 menyertakan `Retry-After`.
- Register dan penerbitan token berada dalam satu transaksi. Email dinormalisasi; akun lama dengan kapitalisasi berbeda masih dapat masuk. Validasi input rusak dan kata sandi multibita yang melampaui batas bcrypt menghasilkan 422. Token berlaku 7 hari, dapat dikonfigurasi dengan `SANCTUM_TOKEN_EXPIRATION` (menit). Logout mencabut token saat ini saja.
- `attachments:privatize` menyediakan laporan lampiran publik lama tanpa mengubah data secara default; `--apply` menyalin ke privat, memverifikasi SHA-256, memperbarui metadata, dan menghapus salinan publik. Pemeriksaan dry-run data lokal nyata menemukan 0 lampiran lama dan 0 masalah; mode `--apply` hanya diuji pada storage/database tiruan.
- Konfigurasi CA eksplisit diperiksa sebagai berkas yang dapat dibaca sebelum HTTP provider. Path yang hilang, direktori, atau assignment CA yang salah menghasilkan `AI_TLS_ERROR` 503 yang aman dan tidak dapat diulang sampai konfigurasi diperbaiki; path/kunci tidak diteruskan ke pengguna.

## Monitoring

Percobaan baseline tidak dapat memulai PHPUnit karena pemeriksaan `is_readable` PHP ditolak pembatasan berkas Windows meski berkas ada. Pengujian kemudian dijalankan dengan runner yang telah disetujui. Pengujian awal implementasi mengungkap fixture dokumen lama yang kini tidak didukung dan benturan nama helper tes; keduanya diperbaiki sebelum verifikasi akhir.

Verifikasi akhir setelah pembaruan dependensi keamanan dan perbaikan konfigurasi CA: **33 tes, 233 assertions, seluruhnya lulus** (`php vendor\phpunit\phpunit\phpunit`; pengujian terakhir koordinator 2,081 detik). `git diff --check -- backend` juga lulus.

Cakupan: konfigurasi AI/kegagalan provider dan retry tanpa duplikasi; akses lintas akun; unggahan HTML/SVG, jumlah, ukuran gabungan; penyimpanan privat; tautan media tanpa tanda tangan/diubah/kedaluwarsa, penyegaran, subfolder; penghapusan lampiran privat/publik; migrasi dry-run/apply/idempoten dengan berkas tiruan; batas/urutan riwayat; pembatasan login/chat; register normalisasi/rollback; input email rusak/kata sandi multibita; masa berlaku token dan logout; konversi batas PHP termasuk ukuran 0.

Seluruh tes regresi memakai SQLite `:memory:`, HTTP fake, dan Storage fake. Tes tidak memanggil AI nyata, memigrasikan database pengguna, atau memindahkan lampiran nyata. Setelah probe runtime terpisah menemukan CA yang rusak, hanya nilai `GEMINI_CA_BUNDLE` pada `.env` lokal diperbaiki ke bundle tepercaya proyek; kunci AI dan konfigurasi database tetap. Probe langsung memakai konfigurasi lingkungan yang telah diperbaiki berhasil memperoleh jawaban nyata `gemini-2.5-flash` (117 karakter). Tes provider mengatur CA sendiri agar tidak bergantung konfigurasi pengguna.

## Finalisasi

Perbaikan backend telah lolos regresi lokal dan satu probe Gemini langsung setelah koreksi CA. Sebelum deployment, konfigurasi hosting harus sesuai petunjuk proyek (document root `backend/public`, HTTPS, debug nonaktif, database/cache persisten, hak tulis penyimpanan). Probe lokal tidak menjamin konfigurasi/kuota pada hosting produksi.

Lampiran publik yang sudah ada **tetap publik sampai migrasi diterapkan**. Siapkan backup database dan kedua lokasi storage, jalankan `php artisan attachments:privatize` untuk laporan, lalu `php artisan attachments:privatize --apply` pada jendela pemeliharaan. Periksa kode keluar dan laporan masalah; ulangi laporan sampai tidak tersisa baris publik. Filesystem dan transaksi database tidak dapat berkomit secara atomik: jika terjadi kegagalan I/O/commit, salinan privat sengaja dipertahankan dan perlu rekonsiliasi dari backup/laporan. Jangan menghapus backup sebelum memeriksa akses pemilik dan hilangnya URL publik lama. Cache/CDN publik lama juga perlu dibersihkan oleh operator bila digunakan.
