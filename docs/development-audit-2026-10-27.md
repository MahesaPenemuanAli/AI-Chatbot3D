# Pengembangan Nusa AI — 27 Oktober 2026

## 1. Analisis

Audit berdasarkan kode yang tersedia, build lokal, tes otomatis, ukuran aset, dan respons HTTP. Tidak ada riset pengguna langsung; kebutuhan di bawah diturunkan dari kegagalan alur yang sudah tersedia. Tidak menambahkan fitur produk berdasarkan dugaan.

Baseline: working tree bersih; build frontend dan lint lulus; tiga tes utilitas frontend lulus. Mesin avatar menghasilkan chunk 1.079.247 byte dan model aktif 21.043.628 byte. UI browser tidak dapat diperiksa: alat computer-use berhenti karena URL browser Windows tidak dapat diverifikasi dengan aman. Tidak mencoba melewati penghentian tersebut.

| ID | Prioritas | Bukti awal | Dampak dan rencana |
| --- | --- | --- | --- |
| SEC-01 | P1 | ChatController menerima file tanpa allowlist MIME/batas jumlah, menyimpan ke disk public | Batasi jenis, jumlah, total ukuran; simpan unggahan baru secara privat dengan akses bertanda tangan; tes akses dan penolakan |
| SEC-02 | P1 | routes/api.php tidak memasang throttle login/register/chat | Batasi brute force dan penggunaan penyedia; tes respons 429 |
| SEC-03 | P1 | Field alamat layanan langsung mengubah config yang digunakan fetch /user dengan Bearer token | Gunakan draft alamat yang divalidasi, terapkan secara eksplisit, reset kredensial saat layanan berubah |
| DATA-01 | P2 | Riwayat server diambil saat login saja; Promise.all gagal seluruhnya jika satu sesi gagal | Muat ulang setelah verifikasi token, toleransi kegagalan parsial, normalisasi data |
| DATA-02 | P2 | Penghapusan sesi hanya menghapus record; seluruh lampiran lama dibaca setiap permintaan AI | Bersihkan berkas milik sesi; batasi konteks dan anggaran media sebelum alokasi |
| PERF-01 | P2 | App.jsx langsung memasang AvatarCanvas di landing; AnimeAvatar fetch model pada mount | Tunda mount sampai mendekati viewport; pertahankan fallback dan ukuran panel |
| PERF-02 | P2 | public berisi ZIP sementara dan model alternatif yang ikut dist tetapi tidak digunakan | Keluarkan aset pengembangan dari hasil build tanpa menghapus sumber |
| PERF-03 | P2 | Riwayat localStorage diserialisasi pada setiap perubahan teks animasi | Debounce penulisan dengan flush saat keluar |
| UX-01 | P2 | Banyak label chat berukuran 6–10 px; contoh #8b9586 di #fcfdf9 memiliki kontras rendah | Tingkatkan keterbacaan, ukuran kontrol dan wrapping; verifikasi pasangan warna secara matematis |
| UX-02 | P2 | Sidebar tertutup masih memiliki kontrol fokus; modal tidak mengisolasi latar; navigasi hash tidak memindahkan fokus | Perbaiki inert/fokus, Escape menu dan pemulihan fokus saat ganti halaman |
| REL-01 | P2 | Lazy ChatWorkspace tidak memiliki error boundary di App | Sediakan pesan pemulihan dan tombol muat ulang ketika chunk gagal |
| DOC-01 | P2 | docs/README menyebut PHP 8.2, streaming, dan endpoint create session yang tidak ada | Sesuaikan dokumentasi runtime/API dengan implementasi aktual dan batas deployment |
| SEC-04 | P1 | Audit npm menemukan 5 paket terdampak; audit Composer menemukan advisori pada Laravel, Guzzle, CommonMark, Flysystem, dan Symfony | Perbarui dalam rentang kompatibel, pertahankan versi utama, audit ulang dan uji regresi |
| REL-02 | P2 | Peninjauan silang menemukan initialPrompt ditandai terkirim sebelum pemeriksaan penyedia selesai | Tunggu status; simpan prompt di composer jika belum dapat dikirim; tandai terkirim sesudah enqueue |
| REL-03 | P1 | Probe Gemini nyata gagal karena nilai GEMINI_CA_BUNDLE lokal bukan path sertifikat yang valid; Guzzle melempar InvalidArgumentException | Koreksi hanya path CA lokal, pertahankan verifikasi HTTPS, kembalikan kesalahan konfigurasi terkontrol dan tes regresi |
| UX-03 | P2 | PHP lokal membatasi upload 2M/post 8M sementara UI menyatakan 20 MB | Laporkan batas efektif melalui /status; validasi/UI mengikuti nilai server termasuk unggahan dinonaktifkan |

P1 = keamanan atau kebocoran kredensial; P2 = keandalan, efisiensi, aksesibilitas, dan dokumentasi. Rincian reproduksi serta perubahan tersedia di laporan backend, frontend, dan performa pendamping.

## 2. Planning

1. Perbaiki batas kepercayaan dan validasi API; tambahkan regresi untuk akses antar akun, unggahan, rate limit, dan kegagalan penyedia.
2. Selaraskan kontrak frontend/backend; perbaiki pergantian layanan, riwayat, penyimpanan lokal, dan modal.
3. Optimalkan pemuatan avatar serta keluaran build; perbaiki fokus, keterbacaan, dan ukuran kontrol.
4. Jalankan build/lint/tes, tinjau perubahan lintas lapisan, cek HTTP lokal tanpa mengubah data pengguna.
5. Perbarui panduan API/setup dan catat hasil serta batas verifikasi. Tidak menyatakan siap produksi hanya berdasarkan tes tiruan.

## 3. Eksekusi

Perubahan sumber telah diimplementasikan sesuai temuan:

- Keamanan: media baru privat, tautan15 menit dengan tanda tangan, MIME/count/total/PHP limits, pembatasan login/register/chat, transaksi registrasi, token 7 hari, pembersihan berkas sesi, dan migrasi lampiran lama dengan dry-run bawaan.
- Keandalan: token terikat layanan, pergantian alamat eksplisit, normalisasi data, riwayat pulih setelah verifikasi akun, kegagalan parsial bisa dicoba ulang, perlindungan respons lama serta prompt destinasi, dan pemulihan kegagalan chunk.
- Performa: avatar landing menunggu viewport, penulisan localStorage ditunda 300 ms, konteks penyedia dibatasi 20 pesan/20 MiB media. Aset percobaan 46.892.495 byte dipindahkan ke reference-assets tanpa mengubah isi.
- UI: 107 deklarasi teks chat kecil dinaikkan minimal 12 px, isi pesan 14 px, input ponsel 16 px, sasaran tombol utama ponsel 44 px, wrapping layar sempit, kontras petunjuk/formulir diperbaiki, fokus rute serta isolasi drawer/dialog dan Escape menu ditambahkan.
- Dependensi: delapan paket backend diperbarui tanpa perpindahan versi utama; paket frontend terdampak diperbarui melalui audit fix tanpa force. Komponen build Windows opsional yang sempat hilang dipasang ulang; build akhir berhasil.
- Konfigurasi lokal: hanya GEMINI_CA_BUNDLE di backend/.env dikoreksi ke resources/certificates/cacert.pem yang sudah tersedia dan hash-nya cocok dengan atribusi. Kunci API, database, dan berkas pengguna tidak diubah. Ini pengecualian terhadap rencana awal mempertahankan seluruh .env karena probe nyata membuktikan kesalahan konfigurasi.
- Dokumentasi setup/API/deployment diselaraskan dengan implementasi, termasuk PHP 8.4.1+ yang dibutuhkan lockfile.

Rincian: [backend](backend-audit-2026-10-27.md), [frontend](frontend-audit-2026-10-27.md), [performa](performance-audit-2026-10-27.md), dan [dependensi](dependency-audit-2026-10-27.md).

## 4. Monitoring

Baseline frontend: build PASS; lint PASS; 3/3 tes PASS. Hasil pengujian akhir:

| Pemeriksaan | Hasil |
| --- | --- |
| Frontend npm test | PASS 12/12 tes regresi utilitas/data |
| Frontend lint dan production build | PASS; peringatan ukuran chunk mesin 3D tetap dicatat |
| Backend PHPUnit | PASS, 33/33 tes dan 233 assertions sesudah regresi CA |
| npm audit | PASS, 0 kerentanan yang diketahui |
| composer audit --locked | PASS, 0 advisori/0 abandoned |
| HTTP lokal melalui preview/reverse proxy | Halaman 200, /api/status 200, poster 200, model 200 (21.043.628 byte), riwayat tanpa token 401 |
| Batas unggahan proses lokal yang direkomendasikan | 20.971.520 byte per berkas/total, 4 berkas |
| Migrasi privat pada data lokal | Dry-run saja: 0 lampiran lama, 0 masalah; tidak mengubah data |
| Gemini nyata | PASS dengan konfigurasi lokal sesudah koreksi CA, model gemini-2.5-flash, jawaban teks 117 karakter; tidak memakai riwayat/berkas pengguna |
| Warna sumber setelah perbaikan | Petunjuk #526449 pada putih 6,41:1, latar chat 6,06:1; placeholder #65735d pada putih 5,04:1 |
| git diff --check | PASS |

Ukuran distribusi sekitar 30,25 MB, dari 77,14 MB; pengurangan bersih sekitar 46,88 MB. Angka ini ukuran seluruh paket, bukan ukuran unduhan halaman atau hasil Core Web Vitals. Build tetap memisahkan mesin 3D sekitar 1,08 MB (284 KB gzip); model 21 MB masih diperlukan ketika avatar digunakan. Tidak menyembunyikan peringatan build tersebut.

Tes backend menggunakan SQLite dalam memori, HTTP fake, dan Storage fake. Probe HTTP lokal tidak membuat akun/data; server sementara dihentikan setelah pemeriksaan. Probe penyedia nyata dilakukan terpisah dengan prompt wisata generik dan keluaran tersanitasi.

## 5. Finalisasi

Implementasi dan verifikasi kode/API selesai sesuai cakupan yang dapat diuji. **Belum dinyatakan siap produksi sepenuhnya**: alat browser menghentikan otomasi karena URL Windows tidak dapat diverifikasi dengan aman, sehingga tampilan desktop/ponsel, urutan fokus aktual, mikrofon, suara perangkat, FPS, dan Core Web Vitals belum diuji langsung. Media ke penyedia diuji dengan respons tiruan; probe Gemini nyata menguji teks saja. Satu jawaban nyata tidak menjamin kuota/ketersediaan di masa depan atau konfigurasi hosting lain.

Sebelum rilis, operator perlu melakukan pemeriksaan visual/keyboard/perangkat dan media nyata, menjalankan checklist deployment di [panduan proyek](README.md), serta login ulang sekali untuk kredensial versi lama. Tidak ada migrasi lampiran nyata yang diperlukan pada database lokal saat audit (hasil dry-run 0); hosting lain tetap harus diperiksa. Perubahan sumber dibiarkan di working tree untuk ditinjau; tidak ada commit, deployment publik, atau perubahan data pengguna.

Referensi pengukuran kontras teks normal: [W3C WCAG 2.2, Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) (4,5:1). Perbaikan sumber bukan sertifikasi kesesuaian WCAG menyeluruh.
