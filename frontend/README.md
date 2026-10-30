# Nusa AI frontend

React 19, Vite 8, Three.js, React Three Fiber, dan Lucide.

```powershell
npm install
npm run dev
npm run build
npm run lint
node --test src/lib/chatData.test.js
```

Landing page berada di `/`; ruang chat berada di `/#chat`. Percakapan hanya
menggunakan AI langsung dan membutuhkan Laravel, akun Sanctum, serta penyedia
Gemini yang sudah dikonfigurasi. Sesi contoh dari versi lama tidak dimuat lagi.

Alamat API bawaan `/api` diproksikan oleh Vite ke `http://127.0.0.1:8000`.
Jalur `/storage` memakai proxy yang sama. Untuk deployment dengan API berbeda,
isi `VITE_API_URL` saat build atau ubah alamat pada pengaturan koneksi.
Kunci Gemini disimpan pada server, melalui pengaturan lingkungan atau `.env`
backend, dan tidak dimasukkan ke bundle frontend.

Hero memakai kompas dan globe 3D prosedural dengan perubahan posisi/rotasi
mengikuti guliran. `LandingStory` mengatur tiga bagian cerita tanpa melakukan
render ulang seluruh halaman pada setiap frame scroll. Galeri destinasi
bergerak horizontal pada desktop dan memakai scroll native pada ponsel atau
mode reduced motion. Aset dan tekstur eksternal tidak diperlukan untuk kompas.

Setelah perkenalan Nusa, `ExpeditionStory` meneruskan pengalaman dengan empat
bab scroll pada satu panggung 3D layar penuh. Kompas dan globe yang sama
berpindah dari kanan ke tengah dan kiri, membuka atlas, merespons pertanyaan,
lalu menjadi globe keberangkatan. `LandingMotion` mengikuti posisi bab;
`LandingRenderer` memakai satu Canvas dan compositor scissor. Seluruh geometri
dibuat lokal. Kontrol jeda, reduced motion, dan fallback tanpa WebGL tersedia;
adegan di luar layar tidak beranimasi.
Scroll dan pointer dihaluskan berdasarkan waktu, bukan jumlah frame. Resolusi
render menyesuaikan beban perangkat; rute pesawat membentuk loop yang tersambung.

Video wisata di bagian tersendiri berada di `public/videos/nusa-landscape.mp4`;
sumber dan petunjuk pembuatan ulang tersedia di `video/landing-loop/README.md`.
Video ini adalah animasi foto lokal yang berulang. Preferensi reduced motion
menampilkan poster diam. Avatar wanita anime modern dimuat lokal dari
`public/models/nusa-modern.vrm` oleh `AnimeAvatar.jsx` saat bagian perkenalan
mendekati layar. Model resmi pixiv Inc. memakai VRM Public License 1.0;
sumber dan izin tersimpan di `public/models/ATTRIBUTION.md`. Warna kaus
lavender dan animasi diterapkan saat runtime; berkas asli tetap utuh.

Ruang chat memakai putih, lavender, dan teks gelap dengan font DM Sans/Manrope.
`NusaMark` tetap menjadi emblem bersama dengan landing page. Mobile memakai
panggung kepala sampai lutut dengan percakapan dalam panel. `ResizeObserver`
mengukur kontrol/lampiran agar area avatar mengikuti ruang yang tersedia.
Desktop memakai framing percakapan; landing memperlihatkan seluruh tubuh.
`src/lib/animeMotion.js` memadukan napas, perpindahan berat badan, arah pandang,
gestur tangan dan jari. Spring bones VRM menggerakkan rambut. Mulut mengikuti
energi suara nyata, bukan status streaming. Model, kepala, kedua lutut dan
kedua tangan diuji dengan kerangka VRM sebenarnya, termasuk pembatalan
lambaian serta transisi pada 30/60/120 fps. Fallback SVG sesuai karakter baru.

Tombol kamera memakai `CameraCapture` untuk pratinjau dan konfirmasi foto.
Foto diubah menjadi JPEG dengan sisi terpanjang 1600 px, lalu masuk ke
validasi dan pengiriman lampiran biasa. Kamera tidak meminta mikrofon dan
stream berhenti saat dialog ditutup, foto diambil, atau halaman disembunyikan.
Gunakan HTTPS atau localhost untuk pratinjau; input capture perangkat tersedia
jika pratinjau browser tidak didukung. Tes kamera menggunakan stream tiruan,
tanpa mengaktifkan kamera perangkat.

Petunjuk lengkap: [README proyek](../README.md).
