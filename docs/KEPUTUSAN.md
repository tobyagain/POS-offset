# Log keputusan — POS-offset

Keputusan produk & bisnis yang sudah diambil Toby. Jangan diubah tanpa
persetujuan eksplisit; kalau ragu, tanya dulu.

## Aturan bisnis kalkulasi
- Inshiet +100 pcs = buffer reject gratis → overprint ditagih dari druk NETT.
- Gripper dimatikan saat ukuran = maksimal mesin; "tidak muat" di situ normal.
- gsm adalah gram/m². Kertas Minyak: terukur 83 gsm (1000 lembar 30×40 = 10 kg).
- Formula markup: margin % naik mengikuti oplah — dipertahankan secara sadar;
  opsi markup bertingkat DITOLAK.
- Layout potong campuran (hybrid) DITOLAK; indikator waste % DITOLAK.

## POS (flow disepakati sebelum dibangun)
- Alur: kalkulasi → penawaran → klien ACC → "jadikan order" (tanpa double entry).
- Landing screen = daftar Order; nav Order · Kalkulator · Klien · Stok · Pengaturan.
- Harga & kalkulasi di-SNAPSHOT ke order (bukan referensi settings).
- Repeat order: hitung ulang tarif sekarang + pembanding harga lama, bisa override.
- Nomor order otomatis ORD-YYMM-XXX (counter di meta).
- Preview desain cukup TEKS (nama file / lokasi film-plat) — bukan upload gambar.
- Single device dulu; IndexedDB + export/import JSON; sync/backend nanti.
- Pembayaran multi-entri; DP norma; overpay perlu konfirmasi.

## Stok kertas
- Flow just-in-time per order: order masuk → cek kebutuhan vs sisa → beli sesuai
  kekurangan (dibulatkan per rim) → sisa dicatat. BUKAN forecast historis/minimum.
- Stok berkurang otomatis saat order disimpan (ACC); boleh minus = kertas belum
  dibeli; hapus order mengembalikan stok.
- Isi per rim default 500, bisa diatur per jenis kertas.

## Keuangan (v28)
- Nav bertambah: Order · Kalkulator · Klien · Stok · Keuangan · Pengaturan.
- Kategori pengeluaran = TEKS BEBAS (bukan daftar tetap) — pengeluaran adalah
  catatan keluar kas apa adanya, termasuk pengeluaran dadakan operasional.
  Kategori yang pernah dipakai muncul sebagai saran (datalist).
- Laporan menampilkan DUA basis sekaligus: nilai order (basis order dibuat)
  dan kas masuk (basis tanggal bayar) — DP dan pelunasan sering beda bulan.
- Profit bersih = nilai order − HPP snapshot order − pengeluaran operasional.
- Belanja bahan (kertas dsb.) boleh dicatat sebagai pengeluaran untuk arus kas,
  tapi diberi tanda "sudah terhitung HPP" supaya TIDAK dobel mengurangi profit
  (biaya kertas sudah ada di HPP order). Tampil terpisah di laporan.
- Piutang dihitung dari semua order belum lunas, tidak mengikuti periode.

## Resi thermal (v29)
- Printer: Blueprint, koneksi USB (via driver, printer terpasang di komputer).
- Jalur cetak: tampilan HTML + window.print lewat dialog print browser —
  BUKAN ESC/POS langsung. ESC/POS via Web Bluetooth/USB boleh ditambah nanti
  kalau alur dialog terasa lambat di lapangan, tanpa membongkar yang ada.
- Lebar kertas 58/80 mm dipilih di detail order, tersimpan di meta (`thermal`).
- @page memakai area cetak efektif (48/72 mm), bukan lebar kertas — driver
  thermal mendefinisikan halaman selebar area cetak; pakai 58/80 membuat
  konten diskalakan/terpotong (temuan uji printer pertama).
- Font resi: sans-serif tebal ukuran besar, bukan monospace tipis — head
  thermal 1-bit mencetak font tipis jadi abu-abu/putus (temuan uji yang sama).
- Resi memuat identitas usaha (konsisten aturan "identitas hanya di nota"),
  ringkasan pekerjaan, pembayaran, sisa tagihan, dan blok LUNAS bila lunas.
- Dua jenis resi (v30): **resi order** = struk pembayaran untuk order
  offline/di tempat; **resi kirim** = label paket berisi penerima (data klien)
  dan pengirim (identitas usaha) saja, TANPA harga — datanya dari form klien
  dan form identitas usaha yang sudah ada, tidak ada form baru.
- Resi kirim tanpa alamat klien: minta konfirmasi dulu (alamat bisa ditulis
  tangan), bukan ditolak.
- Resi kirim — PENGIRIM cukup nama/perusahaan + telepon, TANPA alamat
  (alamat pengirim tak diperlukan kurir; keputusan v31). Penerima tetap
  lengkap dengan alamat.

## Kertas dari klien & order partner (v31)
- **Kertas dari klien** (jasa cetak saja): centang di form kalkulator;
  harga kertas keluar dari HPP, ongkos cetak & potong TETAP ditagih
  (konfirmasi Toby). Layout tetap dihitung agar tahu kebutuhan plano yang
  harus disiapkan klien. Stok tidak berkurang. Satu-satunya edit blok inti
  yang disetujui: `priceP = 0` saat centang aktif.
- **Order partner** (makloon, saat antrian penuh): partner memberi harga
  jadi, kita markup untuk profit. Tanpa kalkulator — form sendiri
  (deskripsi bebas, modal partner, markup % otomatis menghitung harga jual,
  harga jual tetap bisa diedit manual).
- Modal partner = HPP snapshot order → laporan profit otomatis benar.
  Pembayaran ke partner JANGAN dicatat lagi sebagai pengeluaran biasa
  (dobel hitung) — kalau mau tercatat di arus kas, pakai tanda
  "sudah terhitung HPP".
- Modal partner TIDAK PERNAH tampil di nota/resi klien; hanya di detail
  order (baris "Modal partner" + profit) dan laporan.
- Order partner ikut nomor ORD normal, status, pembayaran, nota, resi,
  repeat (prefill form partner + banner harga lama), badge "Partner".
- Order partner TETAP bisa kirim penawaran ke klien seperti order biasa
  (klien berhak tahu detail ordernya) — isi: deskripsi + harga jual, TANPA
  modal partner dan TANPA identitas usaha (konsisten keputusan v25).

## Nota & identitas
- Kirim HPP ke front office DIHAPUS (front office pakai POS).
- Identitas usaha (Dahlia Pack) + logo hanya di NOTA (PDF & teks WA);
  teks penawaran ke klien tetap tanpa identitas (keputusan v25).
- Logo bukan alat autentikasi — nilai verifikasi ada di nomor order + telepon.
- Watermark: logo di-tile rapat (88/halaman), miring -15°, opacity 5%.
- Blok tanda tangan "Hormat kami" + gambar ttd opsional (kosong = teken manual).
- Stempel LUNAS vektor merah miring -12° + tanggal pelunasan, otomatis saat
  paid ≥ price.

## Backup & fresh start (v32)
- **Auto-backup saat aplikasi ditutup DITOLAK secara teknis**: browser tidak
  mengizinkan unduh/share file saat halaman ditutup, dan event "close"
  (`beforeunload`) tidak andal di HP (sering tak jalan saat pindah aplikasi).
  Memaksakannya = rasa aman palsu. Menutup aplikasi TIDAK menghilangkan data
  (tetap di IndexedDB); risiko nyata hanya HP hilang / "hapus data browser",
  yang butuh salinan keluar-HP (file ke Drive/WA) — dan itu wajib satu ketukan.
- Sebagai gantinya: **banner pengingat** ("belum di-backup") muncul tiap buka
  aplikasi selama ada perubahan yang belum di-backup. BUKAN modal — modal
  `askConfirm` yang muncul otomatis membajak dialog konfirmasi bersama dan
  bentrok dgn flow lain (mis. hapus order). Banner: tombol "Backup sekarang"
  (1 ketuk ekspor) + tutup (hilang utk sesi ini, muncul lagi sesi berikutnya).
- Deteksi "belum di-backup": `meta.lastChange` (di-bump `idbPut` tiap tulis
  data) > `meta.lastBackup`. Import dihitung sebagai sudah-backup.
- **Tombol "Hapus semua data"** di Pengaturan (mulai fresh): kosongkan semua
  store IndexedDB + localStorage settings, dgn konfirmasi. Dibuat karena file
  `file://` sulit dibersihkan lewat menu browser; tombol dalam aplikasi lebih
  praktis & bisa dipakai ulang.

## Poles UI (v33)
- Audit Hallmark: app dinilai sudah matang (bukan AI-slop) — token OKLCH,
  angka tabular, focus-visible, motif CMYK. Perubahan hanya poles, bukan rombak.
- Nav 6 tab: `flex:1 0 auto` + scrollbar disembunyikan → mengisi lebar di
  desktop, bisa di-scroll di HP tanpa label bertabrakan (siap tab ke-7+).
- Kartu order & chip: tambah `:active` + `-webkit-tap-highlight-color` →
  umpan balik saat disentuh (pemakaian utama di HP).
- Badge amber (produksi/DP): token `--amber-text` L44 untuk kontras cukup.
- Tombol hapus: border `--danger-edge` agar aksi destruktif terlihat jelas
  tanpa perlu hover.
- **Nama tetap "PrintCalc Pro"** (keputusan Toby). Kunci penyimpanan internal
  (`printcalc_settings_v3`, `printcalc_pos`, `app:"printcalc"`) TIDAK BOLEH
  diganti walau nama tampilan berubah — mengubahnya = data tim hilang & backup
  lama tak bisa di-import.

## Order multi-item (v35)
- Kebutuhan nyata: klien pesan beberapa ukuran/kertas dalam satu order.
- Model: `o.items[]` (tiap item snapshot kalkulasi sendiri). Order lama
  (`o.calc` tunggal) dibungkus jadi 1 item lewat `orderItems(o)` — TANPA
  migrasi; `o.calc`/`o.inputs` disimpan sebagai cermin item pertama.
- Cara menambah: **keranjang draft dari kalkulator** (keputusan Toby). Hitung
  1 item → "Tambah ke order" → hitung item berikut → tambah → "Buat order"
  sekali (klien, deadline, DP). Order 1 item = alur lama, tak berubah.
- Harga total = jumlah subtotal item, tetap bisa di-override (diskon/bulat).
- HPP order = jumlah HPP item → laporan profit otomatis benar.
- Stok: tiap item mengurangi kertasnya masing-masing; dikembalikan saat hapus.
  Item "kertas klien" tak menyentuh stok.
- Nota/resi/detail menampilkan tiap item + subtotal, lalu total.
- Repeat multi-item: **susun ulang semua item** ke draft, dihitung ulang tarif
  sekarang (keputusan Toby). Aman dari dialog gripper karena config yang sudah
  valid tak memicu reminder.
- Order partner tetap 1 item (makloon = 1 harga borongan).

## Rincian per pcs — order partner (v36)
- Kebutuhan: klien lihat **harga /pcs** duluan; Toby perlu rincian saat menyusun
  penawaran order partner (makloon).
- Ditambah di form order partner (saat Jumlah/pcs diisi) & di detail order:
  **Modal partner / pcs (HPP)**, **Harga jual / pcs**, **Untung / pcs** + markup%.
- Bukan input baru — hanya tampilan turunan. Markup partner (untung/HPP) per pcs
  identik dengan markup total karena skala linear terhadap qty, jadi input harga
  tetap satu jalur (Modal + Markup% → Harga jual, seperti sebelumnya).
- Jumlah/pcs tetap opsional; rincian per pcs disembunyikan saat kosong.
- Order lama tanpa qty tak berubah (rincian /pcs cuma muncul bila ada qty).

## Kas harian + buka/tutup POS (v37)
- **Rekap kas harian: DIKERJAKAN.** Kartu "Kas hari ini" di atas tab
  Keuangan → Laporan: uang masuk (pembayaran hari ini), uang keluar (SEMUA
  pengeluaran hari ini — arus kas, termasuk belanja bahan), selisih, + jumlah
  order baru hari ini. Dipatok ke tanggal hari ini, lepas dari pilihan periode
  (mirip kartu piutang). Data sudah ada (`payments[].ts`, `expenses[].date`) —
  hanya lensa harian lewat `dayAgg()`, tanpa store baru / migrasi.
- Beda dgn laporan bulanan yang berbasis PROFIT: kartu harian murni ARUS KAS
  (uang keluar = semua pengeluaran, tidak memisah operasional vs bahan).
- **Sistem buka/tutup kas (shift) per jam kerja: DITUNDA (sengaja).**
  Alasan: model Dahlia Pack = job-order (order + DP + pelunasan lintas hari,
  banyak transfer), bukan kasir ritel frekuensi tinggi. Ritual buka/tutup
  menambah beban harian + mode gagal (lupa buka → data bolong), sementara
  payoff-nya (rekonsiliasi uang laci fisik vs sistem) kecil bila tunai sedikit.
  Baru worth bila: ada laci kas fisik + kasir bergiliran + perlu cek selisih
  fisik. Alternatif lebih ringan bila cuma butuh saldo laci: "saldo kas
  berjalan" tanpa ritual. Jangan bangun buka/tutup tanpa keputusan Toby.

## PWA — installable ke home screen (v38)
- Keputusan Toby: **installable saja, data tetap per-HP** (bukan sinkron).
  Multi-device sync ditolak untuk sekarang (itu butuh backend — roadmap #3).
- Model kirim berubah: dari "kirim `index.html` via WA/Drive (dibuka `file://`)"
  → **di-host di satu URL HTTPS (GitHub Pages)**. SEBAB TEKNIS: service worker &
  prompt install TIDAK jalan dari `file://`, hanya di HTTPS/localhost.
- **Data TIDAK ke server/repo.** GitHub Pages hanya menyajikan "kulit" app.
  Order/klien/stok/keuangan tetap di IndexedDB/localStorage per HP — sama seperti
  sebelumnya. Pages publik, tapi pengunjung asing cuma dapat app kosong.
- File yang ditambah (aditif, tak menyentuh logika app): `manifest.webmanifest`,
  `sw.js`, `icons/` (192/512 + apple-touch 180, dibuat dari SVG offset: kertas +
  colorbar CMYK, full-bleed brand #0061ab), `.nojekyll`, + meta/link di `<head>`
  & 1 skrip registrasi SW (hanya jalan bila `location.protocol==="https:"` —
  jadi `file://` melewatinya diam-diam; tes headless jsdom juga aman).
- **SW strategy**: dokumen = network-first (rilis baru langsung terambil saat
  online) → fallback cache saat offline; aset ikon/manifest = cache-first.
  Lintas-origin (Google Fonts) dibiarkan; offline → font fallback sistem.
- **Disiplin rilis**: tiap rilis, NAIKKAN `CACHE` di `sw.js` (`printcalc-v1` →
  `v2` …) supaya HP mengambil `index.html` baru (kalau tidak, cache lama lengket).
- **Revert aman**: (a) kode aditif → hapus file/branch; (b) SW lengket di HP →
  cara mundur benar = deploy `sw.js` "kill-switch" (unregister + hapus cache),
  bukan sekadar hapus file; (c) data ikut origin, tak hilang — file `file://`
  lama tak tersentuh; pindah balik = export/import backup sekali.
- **Hosting belum diaktifkan otomatis**: Toby aktifkan GitHub Pages (Settings →
  Pages → source `main` / root) setelah merge, lalu uji install di HP.
- Buka/tutup kas shift TETAP ditunda (lihat v37). PWA tidak mengubah itu.

## Poles UI/harga (v39) — dari uji pakai lapangan
- **Alamat/teks panjang membungkus rapi — cross-check semua area.** Alamat klien
  (mis. copy-paste Tokopedia) sebelumnya meluber di beberapa tempat. Diaudit &
  diperbaiki menyeluruh:
  - **HTML detail order**: utilitas `.row.stack` (tumpuk label + nilai penuh
    membungkus, tanpa titik-titik) di baris Alamat, Desain/file, dan Item
    (deskripsi order partner).
  - **Nota PDF** (perakit manual, tak auto-wrap): helper `pdfWrap(t,maxW,size)`
    memecah per kata (kata super-panjang dipotong per karakter). Alamat klien &
    alamat usaha (kop, dibatasi 2 baris) kini membungkus; `row()` jadi
    wrap-aware — nilai panjang (desain/deskripsi) turun ke baris sendiri rata
    kiri, nilai pendek (harga/qty) tetap rata kanan seperti semula.
  - **Resi thermal**: `#resiPrint { overflow-wrap: anywhere }` agar token panjang
    tak meluber di kertas sempit (58/72 mm).
  - Laporan keuangan PDF hanya angka + label pendek → tak perlu wrap.
- **Kalkulator bersih setelah simpan order.** Dulu hasil kalkulasi lama tetap
  tampil saat mulai order berikutnya (membingungkan + risiko dobel "jadikan
  order"). `resetCalcView()` menol-kan `lastCalc`/`lastAlts` & sembunyikan
  `#results` setelah `saveNewOrder`. Form (mesin/kertas/ukuran) TIDAK dihapus —
  cuma hasilnya, jadi order baru wajib hitung ulang.
- **Watermark logo nota PDF 5% → 7%.** ExtGState `ca/CA 0.05 → 0.07` (permintaan
  Toby: tile logo terlalu pudar). Tetap disiplin tile miring -15°.
- **Total penawaran dibulatkan KE ATAS ke kelipatan Rp 1.000.** Di `quoteFor`:
  `totalOffer = ceil(rawOffer/1000)*1000`, `roundAdj = totalOffer - rawOffer`.
  Baris "Pembulatan ke atas (+Rp X)" muncul di Penawaran hanya bila `roundAdj>0`
  (permintaan Toby: tetap ada rinciannya). Pembulatan mengalir ke profit
  (omzet naik → laporan tetap konsisten). Unit `OFFER_ROUND` gampang diubah bila
  Toby mau kelipatan lain (500/5.000). Berlaku juga utk perbandingan oplah & alts.

## Temuan uji pakai v40 (ongkir, stok, resi)
- **Stok opname TIDAK memengaruhi omzet/HPP/laporan.** Dikonfirmasi dari kode:
  `stockApply()` hanya menulis `POS.stock` (qty + log). Laporan (`periodAgg`)
  dihitung dari order (`o.price`/`ordProduk`, `orderHpp`) + pengeluaran — tak
  pernah membaca stok. Aman.
- **Lebar kertas resi (58/80) pindah ke Pengaturan.** Dropdown per-cetak di
  detail order dihapus (`#odResiW`); jadi satu setting di Pengaturan (`#setResiW`
  → `meta.thermal`). Alasan Toby: printer thermal-nya tetap, dan dialog print
  browser toh sudah minta pilih printer — dropdown per-cetak mubazir.
- **Ongkir ditagihkan ke klien, di luar omzet/profit.**
  - Model: `o.price` = **total tagihan (produk + ongkir)** → semua jalur
    pembayaran/piutang/lunas/nota/resi/kartu pakai `o.price` apa adanya (tak ada
    threading rumit). `o.ongkir` disimpan terpisah (opsional). Helper
    `ordProduk(o) = o.price − ongkir`.
  - **Omzet & profit pakai `ordProduk`** (produk saja) — ongkir bukan penjualan,
    bukan profit; ia titipan yang diteruskan. Kas masuk (pembayaran) tetap uang
    riil termasuk bagian ongkir; piutang = total tagihan − dibayar (incl ongkir).
    Kalau Toby bayar kurir sendiri, catat lewat Pengeluaran (opsional).
  - Form order (biasa & partner): "Harga produk"/"Harga jual" + "Ongkir" →
    "Total tagihan". Rincian Produk/Ongkir/Total muncul di detail, nota WA, nota
    PDF, dan resi HANYA bila `o.ongkir > 0` (order lama tanpa ongkir tak berubah).
  - Order partner: `calc.totalOffer` tetap = jual (tanpa ongkir); profit partner
    pakai `ordProduk` supaya ongkir tak terhitung sebagai untung makloon.
- **Format resi multi-item dirapikan.** Dulu satu baris padat
  "bahan · qty · harga" → berantakan di kertas sempit. Sekarang per item: header
  tebal "N. UkuranxUkuran cm, K warna", baris bahan+qty, lalu `Subtotal` rata
  kanan (pakai `.r-row`). Konsisten dgn baris TOTAL/SISA.

## Input uang berpemisah ribuan + poles tombol (v41)
- **Angka uang berpemisah ribuan saat diketik.** `<input type="number">` tak bisa
  menampilkan titik ribuan, jadi 9 field uang (noPrice, noOngkir, noDP, poCost,
  poPrice, poOngkir, poDP, baseProfit, expAmt) diubah ke `type="text"
  inputmode="numeric"` + `oninput="fmtNum(this)"`. Helper baru: `fmtNum(el)`
  format live (id-ID → titik), `pInt(v)` baca balik ke integer (buang non-digit),
  `grp(n)` untuk mengisi `.value` terformat. SEMUA baca (`parseInt(...value)`) →
  `pInt`, SEMUA tulis prefill (`.value = n`) → `grp(n)`. Field non-uang
  (pW/pH/qty/gsm/markup%/dimensi) TETAP `number` — magnitudonya kecil/struktural.
  Tes: `.value` field uang dibaca via `num()` (bukan `parseInt`, yg berhenti di
  titik pertama). Stok (lembar) belum diformat — kandidat lanjutan bila diminta.
- **Tombol Resi order/kirim dirapikan.** Dulu di `.pay-add` (sisa dropdown lebar
  kertas yg dipindah ke Pengaturan) → dua tombol `width:auto` kecil rata kiri,
  tak konsisten. Sekarang `.btn-row` (flex:1 each) → dua tombol sama lebar.
- **Repeat order dikonfirmasi BERFUNGSI.** Diuji ulang (jsdom + runtime): klik
  Repeat → prefill form + hitung ulang → pindah ke layar Hasil, tanpa error.
  Kesan "tidak berfungsi" kemungkinan dari kartu tombol yg berantakan (sudah
  dirapikan). Tidak ada perubahan logika repeat.

## Diskon order + Pengaturan accordion (v42)
- **Diskon = potongan Rp nominal per order** (bukan %, bukan per item) — keputusan
  Toby. Satu field "Diskon (Rp)" di form order, di antara Harga produk & Ongkir.
  Konsisten dgn field uang lain (fmtNum/pInt/grp).
- **Diskon MENGURANGI omzet & profit** (beda dari ongkir yang netral) — keputusan
  Toby. Ini potongan harga jual nyata, jadi pendapatan produk memang turun.
  Implementasi: diskon dipotong dari harga produk SEBELUM masuk `o.price`
  (`o.price = (produk − diskon) + ongkir`), sehingga `ordProduk(o)` otomatis =
  produk netto → omzet/profit ikut turun tanpa jalur khusus. `o.disc` disimpan
  hanya untuk tampilan rincian; `ordBruto(o) = ordProduk + o.disc` = harga sebelum
  diskon. Kas masuk (pembayaran) tetap uang riil atas total tagihan setelah diskon.
- **Validasi:** diskon tak boleh minus & tak boleh melebihi harga produk.
- **Order partner TIDAK punya diskon** — harga jual ke klien sudah disetel langsung
  (mau kasih potongan → turunkan harga jual). Menjaga scope & logika markup partner.
- **Menu Pengaturan jadi accordion** ("agar tidak banyak scroll"). Tiap bagian
  (Mesin, Kertas, Parameter lain, Identitas usaha, Data & backup) = `<details
  class="set-acc">` yang bisa dilipat; awalnya tertutup. Native `<details>` (tanpa
  JS) → robust & tak ganggu tes (elemen tetap di DOM saat terlipat). `#settingsCard`
  tetap div (display-nya = sentinel buka/tutup layar Pengaturan, dibaca blok nav).
  Tombol Simpan/Reset tetap di luar accordion agar selalu terlihat.

## Arah teknis
- Tetap single-file vanilla; TANPA library runtime; PDF dirakit manual.
- Roadmap: git (selesai) → modul+Vite+PWA saat berat → PocketBase saat sync/jualan.
- JANGAN rewrite ke framework tanpa keputusan Toby.
- Diketahui: rename kertas di Pengaturan memisahkan stoknya (orphan) —
  penanganan rename belum dibangun.
- Diketahui: karakter non-latin di-skip di PDF (font standar Helvetica).
