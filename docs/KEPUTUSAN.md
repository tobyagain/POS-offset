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

## Arah teknis
- Tetap single-file vanilla; TANPA library runtime; PDF dirakit manual.
- Roadmap: git (selesai) → modul+Vite+PWA saat berat → PocketBase saat sync/jualan.
- JANGAN rewrite ke framework tanpa keputusan Toby.
- Diketahui: rename kertas di Pengaturan memisahkan stoknya (orphan) —
  penanganan rename belum dibangun.
- Diketahui: karakter non-latin di-skip di PDF (font standar Helvetica).
