# POS-offset (PrintCalc Pro)

Aplikasi POS + kalkulator kalkulasi cetak offset untuk percetakan **Dahlia Pack** (Toby).
Satu file HTML (`index.html`), vanilla JS, tanpa library runtime, offline-first.
Dipakai tim di HP (wizard) dan desktop (workbench). Bahasa UI: Indonesia.

## Perintah

```bash
npm install        # sekali saja (jsdom + fake-indexeddb untuk tes)
npm test           # WAJIB lulus sebelum commit apa pun (226 asertsi)
```

Tidak ada build step. `index.html` adalah source sekaligus artefak distribusi.
Rilis = git tag (`v27`, `v28`, ...), bukan rename file.

**Distribusi (v38): PWA di-host di satu URL HTTPS (GitHub Pages), installable ke
home screen.** Data TETAP per-HP (IndexedDB/localStorage) — hosting hanya
menyajikan "kulit" app, TIDAK ada sinkronisasi/server data. File PWA aditif:
`manifest.webmanifest`, `sw.js`, `icons/`, `.nojekyll`. **Tiap rilis: NAIKKAN
`CACHE` di `sw.js`** (`printcalc-v1` → `v2` …) agar HP mengambil `index.html`
baru. SW hanya aktif di HTTPS; buka `file://` melewatinya. (Model lama "kirim
file via WA" masih jalan sebagai `file://`, tanpa PWA.)

## Arsitektur — tiga blok `<script>` berurutan di index.html

1. **Blok inti kalkulasi** — mesin hitung layout/HPP/penawaran + settings + canvas.
   JANGAN ubah blok ini kecuali diminta eksplisit. Semua fitur baru dibangun
   sebagai lapisan di atasnya (pola yang dipakai sejak v24).
   Pengecualian yang sudah disetujui Toby (v31): opsi "kertas disediakan klien"
   (`#paperByClient` menol-kan `priceP` di `updateData`, flag ikut `lastCalc`).
2. **Lapisan nav (v26)** — wizard 3 langkah (mobile) / workbench 2 panel (desktop ≥980px),
   registry `SCREENS`, `showScreen` diekspos sebagai `window.navScreen`,
   hook `window.onScreenChange`.
3. **Lapisan POS (v27-v29)** — order, klien, stok, identitas usaha, nota PDF,
   keuangan (pengeluaran + laporan omzet/profit), resi thermal 58/80 mm.
   IIFE; fungsi publik ditempel ke `window.*`.

Catatan scope: `let`/`const` top-level di blok 1-2 (mis. `lastCalc`, `SET`, `rp`, `esc`,
`showToast`, `askConfirm`) BISA diakses dari blok berikutnya, tapi TIDAK muncul di
`window` — tes headless harus membaca lewat DOM, bukan `w.namaVariabel`.

## Data

- **localStorage**: `printcalc_settings_v3` (SET: mesin, kertas+gsm, druk, dsb),
  `printcalc_lastsel`.
- **IndexedDB `printcalc_pos` versi 3**: `orders` (autoInc id), `clients` (autoInc id),
  `meta` (key), `stock` (key = nama kertas), `expenses` (autoInc id).
  Naikkan versi DB + `onupgradeneeded` bila menambah store.
- `meta` berisi: counter nomor order `seq-YYMM`, `lastBackup`, `lastChange`
  (di-bump otomatis oleh `idbPut` di setiap tulis data — dasar deteksi
  "belum di-backup"), `biz` {name,address,phone}, `logo` {dataUrl,w,h},
  `sign` {dataUrl,w,h}, `thermal` {width: 58|80}.
- `expenses` berisi: {date "YYYY-MM-DD", cat (teks bebas), amt, note, hpp (bool
  "sudah terhitung HPP order"), ts}.

## Invarian (jangan dilanggar)

- **Snapshot harga**: order menyimpan salinan penuh kalkulasi (`o.calc`) + input
  (`o.inputs`). Order lama TIDAK boleh berubah saat settings berubah.
- **Order multi-item (v35)**: satu order bisa berisi >1 item cetak (`o.items[]`,
  tiap item {calc, inputs, price}). `o.calc`/`o.inputs` = cermin item pertama
  (kompatibilitas). Order lama tanpa `o.items` dibungkus jadi 1 item lewat
  `orderItems(o)` — TIDAK ada migrasi data. HPP order = `orderHpp(o)` (jumlah
  item). Semua tampilan (kartu/detail/nota/resi/stok/laporan) loop lewat helper
  ini. Item dikumpulkan via keranjang draft (`CART`) di kalkulator. Order
  partner tetap 1 item.
- **Pembulatan penawaran (v39)**: total penawaran kalkulator dibulatkan KE ATAS
  ke kelipatan `OFFER_ROUND` (Rp 1.000) di `quoteFor`. Selisih (`roundAdj`) tampil
  sebagai baris "Pembulatan ke atas" di Penawaran & ikut menambah profit. Semua
  turunan (harga/pcs, order price, perbandingan oplah, share) memakai nilai bulat.
- **Kalkulator bersih setelah simpan order (v39)**: `resetCalcView()` menol-kan
  `lastCalc`/`lastAlts` & sembunyikan `#results` supaya order berikutnya tidak
  diawali sisa hitungan lama (harus hitung ulang).
- **Ongkir (v40)**: `o.price` = **total tagihan ke klien = produk + ongkir**;
  SEMUA jalur pembayaran/piutang/lunas/nota/resi pakai `o.price` apa adanya.
  `o.ongkir` disimpan terpisah (opsional; order lama tanpa field → 0). Helper
  `ordProduk(o) = o.price − ongkir` = nilai produk saja; dipakai untuk **omzet &
  profit** (ongkir BUKAN omzet, BUKAN profit — titipan yang diteruskan ke klien).
  Kas masuk (pembayaran) tetap uang riil (termasuk bagian ongkir). Form: "Harga
  produk" + "Ongkir" → "Total tagihan". Order partner: `calc.totalOffer` = jual
  (tanpa ongkir); profit partner pakai `ordProduk`.
- **Repeat order** = hitung ulang dengan tarif sekarang + tampilkan harga lama
  sebagai pembanding (keputusan produk, bukan bug).
- **Stok** terikat NAMA kertas; boleh minus (= order jalan, kertas belum dibeli);
  berkurang otomatis saat order disimpan; dikembalikan saat order dihapus.
  Order "kertas dari klien" dan order partner TIDAK menyentuh stok.
- **Order partner** (`o.calc.partner`): tanpa kalkulator; modal partner
  tersimpan sebagai `calc.hppTotal` (laporan profit otomatis benar) dan
  TIDAK BOLEH tampil di nota/resi/penawaran klien — hanya di detail order &
  laporan. Tetap bisa kirim penawaran ke klien (deskripsi + harga jual).
- **Nomor order** `ORD-YYMM-XXX` dari counter meta — jangan hitung dari daftar order.
- **Nota PDF** dirakit manual level byte (tanpa library): teks ASCII-only lewat
  `pdfSan()`, offset xref = panjang byte, JPEG via DCTDecode, watermark logo
  di-tile miring -15° dgn ExtGState ca 0.07, stempel LUNAS vektor (hanya jika
  paid ≥ price), blok tanda tangan "Hormat kami". Penomoran objek dinamis —
  ikuti pola yang ada saat menambah objek.
- **Identitas usaha hanya di nota** (PDF + teks WA). Teks penawaran ke klien
  TETAP tanpa identitas (keputusan v25).
- **Laporan keuangan**: profit bersih = nilai order − HPP snapshot − pengeluaran
  operasional. Pengeluaran bertanda `hpp` (belanja bahan) hanya masuk arus kas,
  TIDAK dikurangkan lagi ke profit (mencegah dobel hitung dgn HPP order).
  Kategori pengeluaran teks bebas — keputusan Toby, jangan diganti dropdown.
- **Resi thermal** lewat dialog print browser (driver printer Blueprint USB),
  BUKAN ESC/POS. Konten dirakit ke `#resiPrint`, `@page` disuntik dinamis
  memakai AREA CETAK efektif (kertas 58 → 48 mm, kertas 80 → 72 mm; pilihan
  58/80 diset SEKALI di Pengaturan → `meta.thermal`, BUKAN per-cetak — dialog
  print sudah memilih printer; v40), font sans tebal (head thermal 1-bit — font tipis
  tercetak abu/putus), `body.print-resi` menyembunyikan sisa halaman saat print.
  Dua jenis: **resi order** (pembayaran, utk order offline/di tempat) dan
  **resi kirim** (penerima=klien lengkap + pengirim=nama & telp usaha saja
  tanpa alamat, TANPA harga).

## Aturan bisnis percetakan (jangan "diperbaiki")

- **Inshiet** (+100 pcs default) = buffer reject gratis; overprint ditagih dari
  druk NETT, bukan druk total. Disengaja.
- **Gripper wajib mati di ukuran maksimal mesin** (mis. 50×70 di Mesin 72);
  "tidak muat" di kondisi itu adalah perilaku benar.
- **gsm** = gram per m² (bukan per lembar plano). Kertas Minyak terukur 83 gsm.
- Markup% naik mengikuti oplah — Toby sadar ini melawan norma pasar dan
  memutuskan mempertahankannya.

## Konvensi

- Bahasa Indonesia untuk UI, komentar, pesan commit.
- Tanpa dependency runtime; devDependency hanya untuk tes.
- Perubahan bedah (surgical): baca dulu, edit sekecil mungkin, jangan refactor
  di luar scope. Jalankan `npm test` sebelum commit; tambah tes untuk fitur baru.
- Emoji hanya di toast (✔️ ⚠️ 🗑️ 💾), tidak di teks lain.

## Roadmap yang sudah disepakati

1. ~~Masuk git~~ (repo ini).
2. Saat single-file mulai berat: pecah modul + Vite (output tetap satu file) + PWA.
3. Saat butuh multi-device sync / dijual ke percetakan lain: backend PocketBase,
   frontend tetap vanilla bicara ke API. JANGAN rewrite ke framework tanpa
   keputusan eksplisit dari Toby.

## Riwayat singkat

v1-v17 kalkulator (chat) → v18-v22 redesign → PrintCalc Pro arah SaaS →
v23 fitur komersial → v24 wizard → v25 berat kertas → v26 adaptif
mobile/desktop → v27 POS (order, klien, stok, nota PDF ber-logo/watermark/ttd/
stempel LUNAS) → v28 keuangan (pengeluaran kategori bebas + laporan omzet/
profit bulanan-tahunan + piutang) → v29 resi thermal 58/80 mm (Blueprint USB
via print dialog) → v30 optimasi cetak (area cetak 48/72, font tebal) + resi
kirim (penerima/pengirim tanpa harga) → v31 kertas dari klien (jasa cetak
saja, stok tak berkurang) + order partner (makloon: modal partner = HPP,
markup utk profit) → v32 pengingat backup (banner "belum di-backup" tiap buka)
+ tombol hapus semua data → v33 poles UI (nav bisa di-scroll, umpan balik
sentuh di kartu/chip, kontras badge, tombol hapus lebih jelas) → v34 cari
order (nomor/klien/pekerjaan) + ekspor laporan keuangan PDF → v35 order
multi-item (beberapa ukuran/kertas dalam satu order via keranjang draft) →
v36 rincian per pcs order partner (HPP/pcs, harga jual/pcs, untung/pcs +
markup% — tampilan turunan, muncul bila Jumlah/pcs diisi) → v37 kartu "Kas
hari ini" di laporan keuangan (arus kas harian: masuk/keluar/selisih + order
hari ini, dipatok tanggal hari ini; buka/tutup kas shift SENGAJA ditunda) →
v38 PWA installable (manifest + service worker + ikon; di-host GitHub Pages;
data tetap per-HP, TANPA sinkron/server) → v39 poles: alamat panjang membungkus
rapi (baris tumpuk), kalkulator bersih setelah simpan order, watermark nota PDF
7%, pembulatan total penawaran ke atas (kelipatan Rp 1.000) + baris rinciannya
+ alamat/teks panjang membungkus rapi (HTML detail, nota PDF via `pdfWrap`,
resi) → v40 ongkir (ditagihkan ke klien, di luar omzet/profit) + lebar kertas
resi pindah ke Pengaturan + format resi multi-item dirapikan (subtotal per item)
→ v41 input uang berpemisah ribuan (field uang = text+inputmode numeric, format
live via `fmtNum`, baca balik via `pInt`, tulis via `grp`) + tombol resi
order/kirim dirapikan (equal-width `btn-row`).
Detail keputusan: `docs/KEPUTUSAN.md`.
