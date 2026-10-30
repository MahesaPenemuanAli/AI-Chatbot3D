# Kontrak API Nusa AI

Basis bawaan: /api. Kirim Accept: application/json. Endpoint akun/riwayat/pesan memerlukan Authorization: Bearer <token>. Token dan kunci penyedia tidak boleh ditaruh di URL.

## Daftar endpoint

| Metode | Jalur | Akses | Hasil |
| --- | --- | --- | --- |
| GET | /status | Publik | Konfigurasi penyedia dan batas unggahan efektif |
| POST | /register | Publik, dibatasi | Membuat akun dan token, 201 |
| POST | /login | Publik, dibatasi | Memverifikasi akun dan menerbitkan token, 200 |
| GET | /user | Bearer | Profil akun saat ini |
| POST | /logout | Bearer | Mencabut token yang sedang dipakai |
| GET | /chat/sessions | Bearer | Daftar sesi milik akun, terbaru dahulu |
| GET | /chat/sessions/{id}/messages | Bearer, pemilik | Pesan berurutan dan metadata lampiran |
| POST | /chat/sessions/{id}/messages | Bearer, pemilik, dibatasi | Mengirim pesan dan menerima jawaban AI |
| DELETE | /chat/sessions/{id} | Bearer, pemilik | Menghapus sesi dan berkas lampirannya |
| GET | /chat/attachments/{attachment}?expires=…&signature=… | Tanda tangan sementara | Membaca lampiran yang diizinkan |

Tidak ada endpoint POST /chat/sessions. Frontend membuat ID sesi; backend membuat sesi baru bersama giliran pertama yang berhasil. Untuk sesi baru gunakan UUID v4. Sesi akun lain mengembalikan 404 dan tidak memanggil penyedia.

## Status layanan

GET /status tidak menghubungi Gemini dan tidak membuktikan kuota/konektivitas. Contoh proses PHP dengan batas unggahan yang cukup:

```json
{
  "provider": "gemini",
  "configured": true,
  "code": "AI_CONFIGURED",
  "message": "Layanan AI telah dikonfigurasi.",
  "upload_limits": {
    "max_attachment_bytes": 20971520,
    "max_total_attachment_bytes": 20971520,
    "max_attachment_count": 4
  }
}
```

Batas upload_limits mengikuti minimum batas aplikasi dan PHP yang melayani HTTP. Ukuran body menyisakan 256 KiB untuk metadata multipart. Nilai nol berarti unggahan tidak tersedia. Batas reverse proxy tetap perlu diselaraskan karena tidak dapat dideteksi PHP.

## Akun

POST /register menerima JSON name, email, password, password_confirmation. Nama/email maksimal 255 karakter; sandi minimal 8 karakter dan maksimal 72 byte karena bcrypt. Email dinormalisasi menjadi huruf kecil dan spasi tepi dibuang; akun dengan email yang sama ditolak.

POST /login menerima email dan password. Keduanya mengembalikan objek user serta token; hash sandi tidak dikembalikan. Token terikat pada layanan yang menerbitkannya di frontend. Masa berlaku bawaan 10080 menit (7 hari), dapat dikonfigurasi dengan SANCTUM_TOKEN_EXPIRATION. Token kedaluwarsa memerlukan login ulang.

Batas aplikasi: login 5 percobaan/menit per kombinasi IP+email serta 20/menit per IP; register 3/menit per IP; pesan AI 10/menit per akun. Respons429 memuat Retry-After dan pesan yang bisa ditampilkan pengguna. Cache backend harus persisten pada deployment agar pembatasan tetap berlaku lintas worker.

## Mengirim pesan

Untuk teks saja, kirim JSON berikut ke POST /chat/sessions/{id}/messages:

```json
{"message":"Bantu susun perjalanan tiga hari ke Yogyakarta."}
```

Untuk media, kirim multipart/form-data dengan message opsional dan attachments[0] sampai attachments[3]. Biarkan browser mengatur Content-Type multipart beserta boundary. Harus ada teks yang tidak kosong atau minimal satu lampiran. Batas API teks 12000 karakter; kotak input UI membatasi 10000 karakter.

Lampiran baru yang didukung: JPEG, PNG, WebP, HEIC/HEIF; format audio MPEG/MP3, WAV, OGG, FLAC, AAC, MP4/WebM; video MP4, WebM, QuickTime/MOV, MPEG, 3GP. Validasi memakai MIME isi berkas di server, bukan hanya ekstensi. GIF/AVIF, SVG, HTML, dokumen, berkas kosong, jumlah/total berlebihan ditolak. Maksimal 4 berkas, 20 MiB per berkas dan total per pesan, tunduk pada upload_limits.

Respons berhasil200:

```json
{
  "user_message": {
    "id": 101,
    "role": "user",
    "content": "Bantu susun perjalanan tiga hari ke Yogyakarta.",
    "created_at": "2026-10-27T07:00:00.000000Z",
    "attachments": []
  },
  "ai_message": {
    "id": 102,
    "role": "assistant",
    "content": "Berikut ide perjalananmu…",
    "model": "gemini-3.5-flash-lite",
    "fallback_used": false,
    "created_at": "2026-10-27T07:00:00.000000Z"
  }
}
```

Backend menyimpan satu giliran lengkap setelah jawaban penyedia berhasil. Kegagalan penyedia tidak menyimpan pesan maupun unggahan baru. Respons adalah JSON lengkap; animasi pengetikan hanya dilakukan frontend. Konteks penyedia dibatasi 20 pesan terbaru dan total anggaran media 20 MiB termasuk lampiran baru; arsip akun tidak dipotong.

`ai_message.model` adalah model yang benar-benar menghasilkan jawaban.
`fallback_used` bernilai true jika model cadangan dipakai ketika model utama
timeout atau tidak tersedia. Kedua field juga tersedia pada GET riwayat pesan;
pesan lama yang belum mempunyai metadata model mengembalikan model null.
Nilai ini disimpan per pesan, sehingga pemulihan model utama tidak mengubah
atribusi jawaban sebelumnya. Bawaan: model utama Gemini 3.5 Flash Lite,
tanpa model cadangan dan tanpa percobaan ke Gemini 3.8. Jika cadangan
diaktifkan secara eksplisit, cache kesehatan model selama 60 detik menghindari
penantian yang sama pada setiap pertanyaan selama gangguan.

## Lampiran privat

Metadata lampiran memuat id, attachment_type, file_name, mime_type, file_size, file_path, dan download_url. file_path adalah penanda penyimpanan internal; jangan membentuk URL publik dari field tersebut. Gunakan download_url yang diberikan server. URL bertanda tangan relatif pada jalur /api/chat/attachments/{id}, berlaku 15 menit, serta dapat dibuka oleh pemegang URL tanpa header Bearer sampai kedaluwarsa. Tanda tangan hilang/diubah/kedaluwarsa mengembalikan 403. Meminta metadata/tautan baru tetap membutuhkan akun pemilik.

Frontend hanya menerima tautan lampiran dari alamat dan jalur backend aktif, tidak menyimpannya sebagai URL permanen, serta menyediakan tombol pembaruan setelah kegagalan pratinjau. Respons unduhan memakai nosniff, private/no-store, dan no-referrer.

Unggahan publik dari versi lama tetap perlu dimigrasikan. Dari backend jalankan php artisan attachments:privatize untuk laporan tanpa perubahan. Setelah cadangan dan peninjauan, php artisan attachments:privatize --apply memindahkan berkas terverifikasi ke penyimpanan privat. Audit pengembangan tidak menjalankan --apply pada data pengguna.

## Kesalahan

| Status | Arti |
| --- | --- |
| 401 | Token tidak ada/kedaluwarsa; masuk ulang |
| 403 | Tanda tangan lampiran tidak sah atau kedaluwarsa |
| 404 | Sesi bukan milik akun, lampiran/jalur tidak tersedia |
| 413 | Body melebihi batas PHP/proxy |
| 422 | Validasi pesan/lampiran gagal atau isi ditolak penyedia |
| 429 | Pembatasan aplikasi atau kuota penyedia; coba setelah jeda |
| 502/503 | Jawaban kosong, penyedia/jaringan/model/TLS/konfigurasi bermasalah |
| 504 | AI_TIMEOUT: seluruh jalur AI belum memberi jawaban dalam batas waktu |

Kesalahan penyedia terkontrol memuat message, code, retryable (dan response untuk kompatibilitas). Frontend hanya memakai AI langsung dan menampilkan kegagalan agar permintaan dapat dicoba ulang. Detail kunci atau respons mentah penyedia tidak dikembalikan.
