# Audit dan pengembangan frontend — 27 Oktober 2026

## Analisis

Audit mencakup `ChatWorkspace.jsx`, `chatData.js`, alur autentikasi dan pemulihan riwayat, lampiran, penyimpanan lokal, serta akses keyboard. Temuan di bawah didasarkan pada kode awal dan kontrak API yang diperiksa bersama audit backend.

| Prioritas | Temuan dan bukti awal | Dampak |
| --- | --- | --- |
| P1 | Input alamat layanan langsung memanggil `setConfig` pada setiap ketikan; efek `/user` mengirim token yang sama ke `backendUrl` baru. Tidak ada validasi atau penghapusan kredensial ketika layanan berganti. | Token dapat terkirim ke layanan berbeda; hasil login lama dapat diterapkan setelah layanan berubah. |
| P1 | Pemulihan riwayat server hanya berada di dalam fungsi login; pemulihan token tersimpan hanya membaca `/user`. `Promise.all` untuk riwayat membatalkan seluruh hasil saat satu permintaan gagal. Daftar dibatasi diam-diam menjadi 15 sesi. | Riwayat tidak tersinkron ketika aplikasi dibuka kembali; satu sesi bermasalah menyembunyikan sesi lain. |
| P1 | Lampiran memakai alamat `storage/attachments/...` langsung. Audit backend mengonfirmasi unggahan publik dan menggantinya dengan tautan bertanda tangan yang kedaluwarsa. | Frontend perlu mengikuti kontrol akses baru dan menyediakan pembaruan tautan. |
| P1 | Batas unggahan UI tetap 20 MB, sedangkan pemeriksaan runtime menemukan batas PHP 2 MB per berkas dan 8 MB per permintaan. | Pengguna dapat memilih berkas yang pasti ditolak server. |
| P2 | Pemulihan data lokal hanya memvalidasi nama lampiran; `type` yang bukan string dapat mematahkan pemanggilan `startsWith`. Metadata server juga menganggap lampiran selalu array. | Riwayat cacat atau respons tidak sesuai skema dapat membuat tampilan chat gagal. |
| P2 | Efek penyimpanan menjalankan serialisasi seluruh riwayat pada setiap perubahan karakter respons (interval 22 ms). Pemangkasan mengambil 40 sesi pertama, tanpa mempertimbangkan sesi yang baru dipakai. | Kerja sinkron berulang pada main thread dan percakapan terbaru dapat tidak tersimpan. |
| P2 | Drawer ponsel hanya disembunyikan lewat CSS; tombol di luar dialog pengaturan tidak dibuat inert. Fokus dialog memasukkan kontrol dalam `details` yang tertutup. | Navigasi keyboard dapat berpindah ke area yang tidak terlihat atau ke belakang dialog. |

## Planning

1. Pisahkan draf alamat dari konfigurasi aktif; validasi alamat, terapkan melalui tombol, ikat kredensial ke layanan, dan batalkan respons autentikasi yang sudah tidak relevan.
2. Sinkronkan riwayat sesudah akun terverifikasi, termasuk pemulihan akun tersimpan; batasi konkurensi dan pertahankan hasil sesi yang berhasil dimuat.
3. Dukung kontrak lampiran privat dan batas unggahan efektif dari `/status`; periksa kembali batas ketika mengirim.
4. Normalisasikan skema data lokal/server, pertahankan sesi yang sedang menerima respons ketika sinkronisasi, dan cegah sesi yang dihapus muncul kembali dari permintaan lama.
5. Kurangi frekuensi penyimpanan, pertahankan 40 sesi yang paling baru digunakan, dan perbaiki isolasi fokus dialog/drawer.

## Eksekusi

- Alamat API menerima jalur lokal atau HTTP/HTTPS lengkap, menolak kredensial URL, parameter, fragmen, alamat relatif ambigu, serta HTTP ketika halaman menggunakan HTTPS. Validasi juga berlaku untuk nilai bawaan build.
- Mengganti layanan membatalkan pekerjaan dan login berjalan, membersihkan kredensial, dan meminta login untuk layanan baru. Kredensial `nusa_account_v2` memiliki identitas layanan. Token format lama yang tidak terikat layanan memerlukan satu kali login ulang.
- Riwayat dimuat setelah verifikasi akun melalui kelompok empat permintaan; kegagalan sebagian mendapat status yang dapat dicoba ulang. Data akun/riwayat divalidasi. Penggabungan menghormati identitas layanan/akun dan melindungi sesi yang sedang menerima jawaban.
- Tautan lampiran hanya diterima dari origin dan jalur API yang dipilih, memiliki masa berlaku dan signature, serta tidak disimpan sebagai URL permanen. Ada tombol pembaruan pada lampiran yang tidak tersedia dan di pengaturan; audio/video dapat dibuka melalui tautan yang sama. Tautan yang kedaluwarsa saat diklik diperbarui tanpa membuka halaman error.
- `upload_limits` dari API menentukan jumlah, batas per berkas, dan total; batas nol mempertahankan status unggahan dinonaktifkan. Nilai tidak valid memakai batas aplikasi; nilai server tidak dapat memperbesar batas aplikasi. MIME unggahan mengikuti backend. GIF/AVIF diminta dikonversi ke JPG/PNG karena tidak ada dalam format gambar penyedia yang didukung; pratinjau berkas lama tetap dapat dibuka melalui tautan privat.
- Data lokal dinormalisasi dan URL lama dihapus. Serialisasi ditunda 300 ms serta diselesaikan saat halaman ditinggalkan/komponen dilepas. Sesi diurutkan berdasarkan waktu penggunaan sebelum batas 40 diterapkan.
- Drawer dan dialog mengisolasi fokus, mendukung Escape, hanya menghitung kontrol yang terlihat, memulihkan fokus ke pemicu, dan membuat area belakang inert.

## Monitoring

Perintah `node --test src/lib/chatData.test.js` lulus **12 tes**. Cakupan: migrasi alamat API; isolasi akun; URL lampiran bertanda tangan, termasuk prefix subdirektori; validasi konfigurasi dan kredensial tersimpan; normalisasi riwayat; perlindungan respons berjalan saat sinkronisasi; validasi unggahan; pembuangan URL sementara dari penyimpanan; batas efektif/unggahan dinonaktifkan; data lokal cacat; serta retensi sesi terbaru.

`npm run lint` selesai dengan kode keluar 0. Build pertama menemukan paket native Rolldown opsional yang hilang dari instalasi lokal; perbaikan dependensi dan pengujian build terpadu dikerjakan pada finalisasi utama proyek. Audit frontend ini tidak mengklaim verifikasi interaksi visual browser: akses otomasi browser pada sesi ini dibatasi, dan hasil pemeriksaan runtime/API dilaporkan dalam laporan utama.

## Finalisasi

Perubahan mempertahankan demo lokal, akun, chat langsung, suara browser, lampiran, penghentian respons, penghapusan sesi, serta isolasi riwayat akun. Tidak ada layanan baru atau fitur perjalanan yang dibuat berdasarkan perkiraan. Pengujian AI sebenarnya memerlukan penyedia yang dikonfigurasi dan koneksi; tes regresi API menggunakan respons penyedia tiruan pada audit backend. Pemeriksaan UI visual, responsivitas, aset, dependensi, dan hasil build akhir tercantum pada laporan pengembangan utama.

### Temuan tambahan dari peninjauan silang

Prompt destinasi dapat hilang bila verifikasi akun tersimpan selesai lebih cepat daripada pemeriksaan penyedia. Perbaikannya menunggu status penyedia sebelum pengiriman otomatis. Ketika layanan belum siap, teks dipertahankan di composer dengan pemberitahuan; penanda terkirim dipasang setelah pesan diterima alur pengiriman. Demo anonim tetap tersedia tanpa menunggu backend.

Verifikasi terpadu terakhir: 12 tes frontend lulus, lint lulus, production build Vite 8.3.5 berhasil. Peringatan ukuran chunk mesin 3D tetap dicatat di laporan utama. Probe teks Gemini nyata berhasil setelah koreksi path CA lokal; media/akses API diuji melalui respons tiruan dan pemeriksaan HTTP lokal.
