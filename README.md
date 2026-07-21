# POS-offset — PrintCalc Pro

POS + kalkulator kalkulasi cetak offset untuk Dahlia Pack. Satu file HTML,
vanilla JS, offline, tanpa server.

## Pakai

Buka `index.html` di browser (HP atau desktop). Data tersimpan di perangkat
(localStorage + IndexedDB) — rutin **Ekspor data** dari menu Pengaturan.

## Distribusi ke tim

Kirim `index.html` via WA/Drive, atau aktifkan GitHub Pages di repo ini
(Settings → Pages → branch main) agar tim cukup buka satu URL.

## Development

```bash
npm install
npm test        # 63 asertsi headless (wizard, workbench, POS, stok, persistensi)
```

Instruksi lengkap untuk Claude Code ada di `CLAUDE.md`.
Log keputusan produk/bisnis: `docs/KEPUTUSAN.md`.
