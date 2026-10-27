# Audit dan pembaruan dependensi backend — 27 Oktober 2026

## Analisis

Audit Composer awal yang dijalankan pengembang utama menemukan advisori pada paket terkunci Guzzle, Laravel Framework, CommonMark, Flysystem, dan Symfony HttpFoundation. Pembaruan ini didasarkan pada temuan audit tersebut, bukan penambahan fitur atau migrasi framework.

## Planning

1. Perbarui paket terdampak beserta dependensi yang diperlukan dengan `--with-all-dependencies --minimal-changes`.
2. Pertahankan versi utama yang sudah digunakan, persyaratan `composer.json`, serta database dan konfigurasi pengguna.
3. Gunakan `--no-scripts` agar skrip lifecycle proyek tidak memublikasikan aset atau menjalankan tindakan setup.
4. Verifikasi lockfile, persyaratan platform, audit keamanan, dan tes regresi backend setelah vendor selesai diperbarui.

## Eksekusi

Perubahan akhir hanya pada `backend/composer.lock` dan paket terpasang dalam `vendor` yang tidak dilacak Git. `composer.json` tidak berubah. Delapan paket diperbarui:

| Paket | Sebelum | Sesudah |
| --- | --- | --- |
| guzzlehttp/guzzle | 7.12.3 | 7.16.0 |
| guzzlehttp/promises | 2.5.0 | 2.6.0 |
| guzzlehttp/psr7 | 2.12.3 | 2.13.2 |
| laravel/framework | 13.17.0 | 13.38.0 |
| laravel/prompts | 0.3.21 | 0.3.26 |
| league/commonmark | 2.8.2 | 2.10.4 |
| league/flysystem | 3.35.1 | 3.36.0 |
| symfony/http-foundation | 8.1.1 | 8.1.9 |

Resolver awal memilih Guzzle 8 yang diizinkan dependensi Laravel. Pilihan itu diperbaiki sebelum finalisasi dengan batas versi eksplisit Guzzle 7.16.0, Promises 2.6.0, dan PSR7 2.13.2. Seluruh versi utama awal akhirnya dipertahankan. Tidak menonaktifkan pemblokiran paket rentan atau mengabaikan advisori. Metadata versi dapat diperiksa melalui [Packagist Guzzle](https://packagist.org/packages/guzzlehttp/guzzle) dan [Packagist PSR7](https://packagist.org/packages/guzzlehttp/psr7).

## Monitoring

| Pemeriksaan setelah pembaruan | Hasil |
| --- | --- |
| `composer audit --locked --format=json` | PASS, exit 0; `advisories: []`, `abandoned: []` |
| `composer validate --no-check-publish` | PASS, composer.json valid |
| `composer check-platform-reqs` | PASS pada PHP CLI 8.5.4 dan ekstensi terpasang |
| Skrip lifecycle Composer | Tidak dijalankan (`--no-scripts`) |
| Tes regresi aplikasi setelah pembaruan | Dikoordinasikan dengan laporan backend dan laporan pengembangan utama |

Catatan platform: `composer.json` mengizinkan PHP `^8.3`, tetapi lockfile yang sudah menggunakan Symfony 8.1 mensyaratkan **PHP 8.4.1+** untuk `composer install`. Persyaratan ini sudah ada pada Symfony 8.1.1 sebelum pembaruan; pengujian memakai PHP 8.5.4. Jangan menyimpulkan kompatibilitas checkout ini dengan PHP 8.3 hanya dari persyaratan langsung Laravel.

## Finalisasi

Lockfile siap digunakan melalui `composer install` agar lingkungan lain mendapat versi yang sama. Hasil audit menyatakan tidak ada advisori yang diketahui oleh sumber audit Composer pada saat pemeriksaan; hasil tersebut bukan jaminan tidak adanya seluruh kerentanan. Pengujian API, alur penyedia AI, dan akses berkas tetap diperlukan dan dicatat dalam laporan pengembangan utama. Tidak ada perubahan database, `.env`, kunci, atau unggahan pengguna oleh pembaruan ini.

## Tambahan audit frontend

Audit npm awal menemukan 5 paket terdampak (fflate, nanoid, postcss, source-map-js, Vite). npm audit fix --ignore-scripts memperbarui paket dalam rentang yang sudah diizinkan tanpa --force. Versi akhir meliputi Vite 8.3.5, PostCSS 8.5.32, NanoID 3.3.20, source-map-js 1.2.2, dan fflate 0.6.11. Komponen native Rolldown Windows sempat terlewat; npm install --ignore-scripts --include=optional memperbaiki instalasinya tanpa menghapus lockfile.

Verifikasi akhir npm audit --json: 0 vulnerabilities; npm test: 12/12 lulus; lint dan build lulus. Hasil frontend ini melengkapi audit backend di atas. Perbaikan didasarkan pada advisori registri resmi yang ditemukan pada pemeriksaan, bukan perubahan versi secara spekulatif.
