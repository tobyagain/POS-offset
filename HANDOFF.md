# Handoff sesi — PrintCalc Pro (POS-offset)

Potret status untuk lanjut di sesi baru. Konteks durable ada di `CLAUDE.md`
(dibaca otomatis) & `docs/KEPUTUSAN.md` (log keputusan). Dokumen ini = status
terkini + gotcha penting sesi ini.

## Repo & cara kerja
- Repo: `tobyagain/POS-offset` · satu file `index.html` (vanilla JS, offline, tanpa library runtime).
- Tes: `npm install` (sekali) lalu `npm test` (jsdom + fake-indexeddb) — **WAJIB lulus sebelum commit**. Saat ini **226 asertsi**.
- Rilis = git tag (`v27`…), bukan rename file. `index.html` = source sekaligus artefak.
- Alur: branch → `npm test` → commit → push → PR → merge → **Toby buat tag** (push tag diblokir dari lingkungan sesi).
- **PENTING cara tes app:** jangan lewat GitHub (raw/preview TIDAK menjalankan JS). Unduh `index.html`, **buka langsung di browser** (`file://`) → jalan penuh. PWA install/service-worker cuma aktif di HTTPS.

## Status terakhir
- `main` di **v41** (merge commit `92d1d64`, PR #8). Bersih, 226 tes lulus.
- Branch kerja sesi ini: `claude/pos-pricing-details-client-e5251f` (sudah di-merge).
- **TAG PENDING** — Toby buat sesuai preferensi. Peta versi → commit:
  - v36 `6eb5b40` · v37 `976053c` · v38 `6870ff1` · v39 `d2b0c07` · v40 `d148192` · v41 `c8503a1`
  - (v35 `e613c4f` mungkin masih pending dari sesi lalu — cek `git tag`.)
  - `git fetch origin main && git tag vNN <commit> && git push origin vNN`

## Yang dikerjakan sesi ini (v36 → v41 + fix)
- **v36** Rincian per pcs order partner (HPP/pcs, jual/pcs, untung/pcs + markup%).
- **v37** Kartu "Kas hari ini" di Keuangan (arus kas harian; buka/tutup kas shift SENGAJA ditunda).
- **v38** PWA installable (manifest + `sw.js` + ikon + `.nojekyll`). Data TETAP per-HP.
- **v39** Pembulatan penawaran ke atas (kelipatan Rp 1.000) + baris rinciannya; kalkulator bersih setelah simpan; watermark PDF 7%; **alamat/teks panjang wrap** di detail/nota PDF (`pdfWrap`)/resi.
- **v40** **Ongkir** (ditagihkan ke klien, di luar omzet/profit); lebar kertas resi pindah ke Pengaturan; format resi multi-item rapi.
- **v41** **Input uang berpemisah ribuan** (fmtNum/pInt/grp); tombol resi equal-width; baris pembayaran resi rapi (dd/mm/yy).
- **Fix** Repeat order multi-item mangkrak di detail (workbench) — cabang multi lupa `navScreen("form")`.
- **Fix** Kirim penawaran multi-item ke WA hanya 1 item — `shareClient` mengabaikan `CART`; kini list semua item.

## Invarian BARU penting (detail di CLAUDE.md)
- **Ongkir (v40):** `o.price` = total tagihan = **produk + ongkir**. Semua bayar/piutang/lunas/nota/resi pakai `o.price` apa adanya. `o.ongkir` disimpan terpisah (order lama → 0). `ordProduk(o) = o.price − ongkir` dipakai untuk **omzet & profit** (ongkir BUKAN omzet/profit). Order partner: `calc.totalOffer` = jual tanpa ongkir; profit partner pakai `ordProduk`.
- **Pembulatan (v39):** `quoteFor` bulatkan `totalOffer` ke atas ke kelipatan `OFFER_ROUND`(=1000); `roundAdj` tampil sbg baris "Pembulatan". Semua turunan pakai nilai bulat.
- **Input uang (v41):** field uang = `type="text" inputmode="numeric"` + `oninput="fmtNum(this)"`. Baca via **`pInt(el.value)`** (bukan `parseInt` — berhenti di titik!), tulis prefill via **`grp(n)`**. Field non-uang (pW/pH/qty/gsm/markup%/dimensi) tetap `number`.

## Gotcha sesi ini (hemat waktu)
- **Tes jsdom jalan di lebar 390px (HP).** Bug khusus **workbench (≥980px)** TIDAK tertangkap kecuali `boot({ width: 1000 })`. Bug repeat multi-item persis begini. Untuk fitur yg beda antara wizard/workbench, tambah tes lebar ≥980.
- **Reproduksi bug "browser sungguhan":** jsdom sering menutupi. Teknik yang dipakai: jalankan Chromium headless (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) dgn `--remote-debugging-port`, lalu Node (v22 punya `WebSocket` global) connect CDP → `Runtime.evaluate` `awaitPromise` untuk menyetir app & baca hasil.
  - **HARUS strip `<link>` Google Fonts** dari copy html dulu — kalau tidak, tanpa jaringan halaman **stuck loading** (render-blocking) → app tak init.
  - IndexedDB butuh **real time** (virtual-time-budget bikin `saveNewOrder` menggantung). Jangan pakai virtual time untuk alur yang menulis IDB.
- **Baca balik `.value` field uang di TES pakai `num()`**, bukan `parseInt` (yg berhenti di titik pertama). Beberapa tes sudah disesuaikan.
- **Blok arsitektur:** blok 1 (kalkulasi inti) JANGAN diubah kecuali diminta. `shareClient` ada di blok 1 tapi butuh `CART` (blok 3, IIFE-internal) → di-**override** `window.shareClient` dari blok 3 (pola aman, blok 1 tak disentuh).
- **PWA rilis:** tiap ubah `index.html`, **NAIKKAN `CACHE` di `sw.js`** (`printcalc-v1`→…). Sekarang di **`printcalc-v7`**.

## Keputusan produk (jangan diubah tanpa Toby)
- **Hapus order = hard delete.** Berlaku semua status (order/DP/LUNAS). Efek: order hilang dari DB; **stok kertas kembali** (kecuali partner & "kertas klien"); **laporan berkurang total** termasuk **kas masuk (DP/pelunasan) IKUT HILANG** (pembayaran tersimpan di dalam order); pengeluaran tak terpengaruh; nomor order tak dipakai ulang. Tak ada undo.
  - Solusi Toby bila perlu koreksi order berbayar: **hapus lalu buat ulang + input DP lagi**. Sadari: nomor jadi baru & **tanggal DP jadi hari input ulang** (menggeser periode di laporan bulanan/Kas hari ini). Pengaman "konfirmasi tegas kalau sudah dibayar" **DILEWATI** atas keputusan Toby (2026-07). Jangan bangun tanpa diminta.
- **PWA:** pilihan **A — installable saja, data per-HP** (bukan sinkron). Multi-device sync ditolak untuk sekarang (itu butuh backend, roadmap #3). GitHub Pages hanya "kulit" app; data TIDAK ke server/repo.
- **Buka/tutup kas shift:** ditunda (model job-order belum butuh rekonsiliasi laci). Lihat v37 di KEPUTUSAN.

## Kandidat pekerjaan berikutnya
1. **Aktifkan GitHub Pages** (Settings → Pages → source `main`/root) → uji install di HP → bagikan URL ke tim. Ingat: user lama perlu **export → import backup sekali** (origin `file://` → `https://`). Repo perlu public (atau GitHub Pro).
2. (Opsional) Format ribuan juga utk input **stok** (`stIn`/`stFix`/`stUnit`) & **`sCutCost`** di Pengaturan — belum diformat (scope v41 hanya field order/keuangan).
3. (Opsional/ditunda) Pengaman hapus order berbayar; status "Batal" soft-cancel; buka/tutup kas.

## Cara lanjut cepat
```bash
npm install      # sekali
npm test         # harus 226 lulus
```
Kembangkan di branch baru dari `main`, tambah tes (uji juga lebar ≥980 bila menyentuh nav/screen), jaga `CLAUDE.md` + `docs/KEPUTUSAN.md`, PR → merge → Toby tag → NAIKKAN cache `sw.js`.
