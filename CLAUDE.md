# POS-offset (PrintCalc Pro)

Aplikasi POS + kalkulator kalkulasi cetak offset untuk percetakan **Dahlia Pack** (Toby).
Satu file HTML (`index.html`), vanilla JS, tanpa library runtime, offline-first.
Dipakai tim di HP (wizard) dan desktop (workbench). Bahasa UI: Indonesia.

## Perintah

```bash
npm install        # sekali saja (jsdom + fake-indexeddb untuk tes)
npm test           # WAJIB lulus sebelum commit apa pun (85 asertsi)
```

Tidak ada build step. `index.html` adalah source sekaligus artefak distribusi
(dikirim ke tim via WA/Drive). Rilis = git tag (`v27`, `v28`, ...), bukan rename file.

## Arsitektur — tiga blok `<script>` berurutan di index.html

1. **Blok inti kalkulasi** — mesin hitung layout/HPP/penawaran + settings + canvas.
   JANGAN ubah blok ini kecuali diminta eksplisit. Semua fitur baru dibangun
   sebagai lapisan di atasnya (pola yang dipakai sejak v24).
2. **Lapisan nav (v26)** — wizard 3 langkah (mobile) / workbench 2 panel (desktop ≥980px),
   registry `SCREENS`, `showScreen` diekspos sebagai `window.navScreen`,
   hook `window.onScreenChange`.
3. **Lapisan POS (v27-v28)** — order, klien, stok, identitas usaha, nota PDF,
   keuangan (pengeluaran + laporan omzet/profit). IIFE; fungsi publik ditempel
   ke `window.*`.

Catatan scope: `let`/`const` top-level di blok 1-2 (mis. `lastCalc`, `SET`, `rp`, `esc`,
`showToast`, `askConfirm`) BISA diakses dari blok berikutnya, tapi TIDAK muncul di
`window` — tes headless harus membaca lewat DOM, bukan `w.namaVariabel`.

## Data

- **localStorage**: `printcalc_settings_v3` (SET: mesin, kertas+gsm, druk, dsb),
  `printcalc_lastsel`.
- **IndexedDB `printcalc_pos` versi 3**: `orders` (autoInc id), `clients` (autoInc id),
  `meta` (key), `stock` (key = nama kertas), `expenses` (autoInc id).
  Naikkan versi DB + `onupgradeneeded` bila menambah store.
- `meta` berisi: counter nomor order `seq-YYMM`, `lastBackup`, `biz` {name,address,phone},
  `logo` {dataUrl,w,h}, `sign` {dataUrl,w,h}.
- `expenses` berisi: {date "YYYY-MM-DD", cat (teks bebas), amt, note, hpp (bool
  "sudah terhitung HPP order"), ts}.

## Invarian (jangan dilanggar)

- **Snapshot harga**: order menyimpan salinan penuh kalkulasi (`o.calc`) + input
  (`o.inputs`). Order lama TIDAK boleh berubah saat settings berubah.
- **Repeat order** = hitung ulang dengan tarif sekarang + tampilkan harga lama
  sebagai pembanding (keputusan produk, bukan bug).
- **Stok** terikat NAMA kertas; boleh minus (= order jalan, kertas belum dibeli);
  berkurang otomatis saat order disimpan; dikembalikan saat order dihapus.
- **Nomor order** `ORD-YYMM-XXX` dari counter meta — jangan hitung dari daftar order.
- **Nota PDF** dirakit manual level byte (tanpa library): teks ASCII-only lewat
  `pdfSan()`, offset xref = panjang byte, JPEG via DCTDecode, watermark logo
  di-tile miring -15° dgn ExtGState ca 0.05, stempel LUNAS vektor (hanya jika
  paid ≥ price), blok tanda tangan "Hormat kami". Penomoran objek dinamis —
  ikuti pola yang ada saat menambah objek.
- **Identitas usaha hanya di nota** (PDF + teks WA). Teks penawaran ke klien
  TETAP tanpa identitas (keputusan v25).
- **Laporan keuangan**: profit bersih = nilai order − HPP snapshot − pengeluaran
  operasional. Pengeluaran bertanda `hpp` (belanja bahan) hanya masuk arus kas,
  TIDAK dikurangkan lagi ke profit (mencegah dobel hitung dgn HPP order).
  Kategori pengeluaran teks bebas — keputusan Toby, jangan diganti dropdown.

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
profit bulanan-tahunan + piutang). Detail keputusan: `docs/KEPUTUSAN.md`.
