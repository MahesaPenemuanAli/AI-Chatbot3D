# Audit performa, aset, dan aksesibilitas — 27 Oktober 2026

## Analisis

Audit ini menggunakan pembacaan sumber dan pengukuran berkas lokal. Pengukuran jaringan browser, Lighthouse, Core Web Vitals, dan inspeksi visual belum dilakukan: alat browser menghentikan pengujian karena alamat halaman aktif tidak dapat diverifikasi dengan aman. Permintaan HTTP lokal tambahan juga ditolak oleh izin socket lingkungan; hasil itu tidak digunakan sebagai bukti perilaku server.

| ID | Prioritas | Bukti kondisi awal | Dampak dan tindakan yang disarankan |
| --- | --- | --- | --- |
| PERF-01 | P1 | `src/App.jsx` langsung merender `AvatarCanvas` di bagian perkenalan, meskipun bagian itu berada di bawah hero. `React.lazy` menunda impor sampai komponen dirender, sedangkan komponen tersebut tetap langsung dirender. `AvatarCanvas.jsx` hanya mengubah `frameloop` berdasarkan visibilitas; `Canvas` dan `AnimeAvatar` tetap dipasang. Efek pemasangan `AnimeAvatar.jsx` memanggil `fetch` model. | Pengunjung halaman awal dapat memuat mesin 3D sebesar 1.079.247 byte dan model VRM sebesar 21.043.628 byte sebelum memerlukannya. Tunda pemasangan avatar landing sampai mendekati viewport; pertahankan fallback dan tombol sapaan. |
| PERF-02 | P2 | Build awal menyalin seluruh `public`: `anime-darkness.tmp.zip` 17.205.973 byte, `anime-victoria.tmp.zip` 12.244.783 byte, `misa-api.tmp.json` 103 byte, serta kandidat Victoria berupa model 15.321.932 byte dan preview 2.119.704 byte. Pencarian sumber tidak menemukan referensi ke aset Victoria maupun arsip sementara. | Sebanyak 46.892.495 byte yang tidak dipakai ikut paket publik. Keluarkan aset eksperimen tersebut dari hasil build sambil mempertahankan sumber bila diperlukan. Ukuran direktori awal `public`: 75.711.385 byte; `dist`: 77.137.654 byte. Angka paket ini bukan ukuran unduhan halaman. |
| A11Y-01 | P2 | `ChatWorkspace.css` menggunakan teks petunjuk 8 px, footer 7 px (6 px pada ponsel), dan label formulir 10 px. Perhitungan kontras dari warna CSS tercantum di bawah. | Teks fungsional sulit dibaca. Tingkatkan ukuran teks petunjuk/formulir dan kontras warna secara terarah, beserta ukuran sasaran sentuh. Verifikasi ulang layout pada ponsel setelah perubahan. |
| DOC-01 | P2 | `docs/README.md` menyebut PHP 8.2+, sedangkan `backend/composer.json` mensyaratkan PHP `^8.3`. Dokumen meminta `artisan install:api` padahal routing API dan Sanctum sudah ada. Dokumen mengklaim streaming dan beberapa penyedia, sedangkan frontend menerima respons JSON Gemini melalui backend. README utama menyebut batas unggahan 20 MB per berkas tanpa menyebut batas total 20 MB dan empat berkas pada validator frontend. | Dokumentasi dapat mengarahkan instalasi dan ekspektasi fitur secara keliru. Selaraskan petunjuk dengan kode, konfigurasi, dan kontrak API setelah perbaikan backend. |

### Perhitungan kontras kondisi awal

Perhitungan menggunakan luminans relatif sRGB dan rasio `(Lterang + 0,05) / (Lgelap + 0,05)`. Ini pemeriksaan warna sumber, bukan hasil audit browser atau sertifikasi aksesibilitas.

| Elemen | Warna teks | Latar | Rasio |
| --- | --- | --- | --- |
| Placeholder composer | `#98a08f` | `#ffffff` | 2,71 |
| Petunjuk composer | `#a0aa95` | `#ffffff` | 2,42 |
| Footer composer | `#a0a996` | `#f8f9f5` | 2,31 |
| Alat pesan | `#98a28d` | `#f8f9f5` | 2,52 |
| Paragraf pengaturan | `#8a9680` | `#fcfdf9` | 3,04 |
| Label pengaturan | `#728362` | `#fcfdf9` | 4,00 |
| Teks pesan utama | `#64745f` | `#f8f9f5` | 4,72 |

## Planning

1. Pertahankan pemisahan chunk chat dan avatar; tambahkan penundaan pemasangan avatar khusus landing berdasarkan viewport.
2. Cegah arsip sementara dan kandidat yang tidak digunakan masuk distribusi. Jangan menghapus model aktif, fallback aktif, maupun atribusi/lisensi.
3. Perbaiki teks dan kontrol yang terbukti kecil atau berkontras rendah. Hindari perombakan visual tanpa temuan.
4. Perbarui dokumentasi instalasi, unggahan, dan deployment sesuai implementasi final.

## Eksekusi, monitoring, dan finalisasi

Implementasi dikoordinasikan oleh audit utama agar tidak bertabrakan dengan perubahan frontend. Rujuk laporan pengembangan utama untuk daftar perubahan dan hasil build akhir.

Pemeriksaan akhir yang diperlukan: build/lint frontend, tes regresi alur data, verifikasi keluaran build untuk aset terpakai dan aset yang dikecualikan, lalu pemeriksaan visual desktop/ponsel dan keyboard ketika alat browser tersedia. Belum ada klaim peningkatan waktu muat terukur, FPS, atau skor Lighthouse.

## Addendum verifikasi implementasi

- `npm run build` dan `npm run lint` lulus pada peninjauan setelah penundaan avatar dan pemindahan aset.
- `LandingAvatar` sekarang menunggu `IntersectionObserver` dengan margin 200 px sebelum merender komponen avatar. Impor mesin dan efek fetch model tidak dipanggil oleh komponen itu sebelum kondisi tersebut terpenuhi. Area avatar tetap memiliki tinggi/lebar penuh dan fallback; pemeriksaan ini berbasis sumber, bukan rekaman jaringan.
- Aset eksperimen dipindahkan ke `frontend/reference-assets`. Kelima berkas yang dipindahkan mempunyai object hash Git identik dengan sumber awal. Tidak ada data biner yang hilang.
- Semua 14 jalur aset runtime/atribusi yang diperiksa tersedia pada `dist`: model anime aktif, preview aktif, robot opsional, atribusi model/foto, tiga foto destinasi, video, dua font, dua lisensi font, dan favicon.
- Keluaran build tidak mengandung kandidat Victoria, ZIP sementara, JSON sementara, atau referensi ke folder aset pengembangan.
- Ukuran keluaran build saat peninjauan: **30.254.019 byte**, dari baseline **77.137.654 byte**, berkurang bersih **46.883.635 byte**. Pengurangan aset sendiri sebesar **46.892.495 byte**; selisihnya adalah pertumbuhan kode/CSS. Angka dapat sedikit berubah setelah perubahan frontend terakhir dan bukan ukuran transfer halaman.
- Build masih memperingatkan chunk avatar sekitar 1,08 MB sebelum gzip. Chunk itu tetap terpisah dan pemuatannya ditunda; model aktif tetap sekitar 21 MB. Tidak mengklaim masalah ukuran mesin/model sudah seluruhnya selesai.
- Teks fungsional chat dinaikkan menjadi minimal 12 px, teks pesan 14 px, composer 15 px (16 px pada ponsel), dengan warna petunjuk/formulir yang lebih gelap. Kontrol utama ponsel diberi ukuran minimal 44 px dan header dapat membungkus. Peninjauan sumber mengidentifikasi kebutuhan `min-width: 0`/wrapping pada teks companion; rekomendasi disampaikan ke pengembang utama.
- Fokus setelah pergantian halaman, Escape menu, dan pemulihan kegagalan lazy chunk ditambahkan. Verifikasi visual, interaksi keyboard nyata, dan pembungkusan layout tetap harus dilakukan ketika browser tersedia.

### Pengukuran sumber akhir

Perbaikan warna sumber menghasilkan kontras petunjuk #526449 pada putih 6,41:1 dan latar chat 6,06:1; placeholder #65735d pada putih 5,04:1. Sebanyak 107 deklarasi teks chat kecil ditingkatkan minimal 12 px, isi pesan 14 px, input ponsel 16 px, dan kontrol utama ponsel 44 px. Ini pengukuran sumber; tampilan serta target aktual belum diaudit melalui browser.

Build terpadu terakhir setelah semua perubahan dan pembaruan npm berhasil. Paket tetap sekitar 30,25 MB, berkurang sekitar 46,88 MB dari baseline 77,14 MB. Pemeriksaan HTTP lokal melalui preview sudah berhasil untuk halaman 200, /api/status 200, poster 200, model 200, serta riwayat tanpa token 401; ini melengkapi keterbatasan socket pada audit awal. Tidak ada klaim Core Web Vitals atau pemeriksaan visual.
