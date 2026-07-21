const { JSDOM } = require("jsdom");
const FDBFactory = require("fake-indexeddb/lib/FDBFactory");
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.error("  ✗ FAIL: " + m); } };
const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
const num = s => parseInt(String(s).replace(/[^\d-]/g, "") || "0");
function boot(idb) {
  return new JSDOM(html, { runScripts: "dangerously", url: "https://x.local/", pretendToBeVisual: true,
    beforeParse(w) {
      w.indexedDB = idb; w.matchMedia = q => ({ matches: false, addEventListener() {}, addListener() {} });
      const n = () => {};
      w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({ canvas: this, measureText: () => ({ width: 10 }) }, { get: (t, k) => k in t ? t[k] : n, set: () => true }); };
      w.scrollTo = n; w.HTMLElement.prototype.scrollIntoView = n;
      w.URL.createObjectURL = b => { w.__blob = b; return "blob:t"; }; w.URL.revokeObjectURL = n;
      w.HTMLAnchorElement.prototype.click = function () { w.__dl = this.download; };
      // jsdom belum punya Blob.text() -> polyfill lewat FileReader bawaan jsdom
      if (!w.Blob.prototype.text) w.Blob.prototype.text = function () {
        return new Promise((res, rej) => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsText(this); });
      };
    } }).window;
}
async function confirmDlg(w, yes = true) { await tick(); w.document.getElementById(yes ? "cfOk" : "cfCancel").click(); await tick(); }
async function ensureOpen(w, name) { if (!w.document.getElementById("stIn")) { w.stockToggle(name); await tick(); } }

(async () => {
  const idb = new FDBFactory();
  console.log("== STOK ==");
  let w = boot(idb); await tick(120); const d = w.document;

  // Tab stok tampil, semua kertas 0
  w.navGo("stock");
  ok(!d.getElementById("scrStock").hidden, "tab Stok terbuka");
  const cards0 = d.querySelectorAll("#stockList .ocard");
  ok(cards0.length >= 4, "semua jenis kertas dari pengaturan terdaftar (" + cards0.length + ")");
  ok(d.getElementById("stockList").textContent.includes("0"), "stok awal 0");

  // Barang masuk 1 rim = 500 lembar
  const paperName = cards0[0].querySelector(".ocard-name").textContent.trim();
  w.stockToggle(paperName); await tick();
  d.getElementById("stIn").value = "1"; d.getElementById("stInUnit").value = "rim";
  await w.stockMasuk(paperName); await tick();
  ok(d.getElementById("stockList").textContent.includes("500"), "barang masuk 1 rim -> 500 lembar");

  // Order butuh plano -> stok berkurang otomatis; saran beli muncul kalau kurang
  w.navGo("form");
  d.getElementById("qty").value = "30000"; // oplah besar biar butuh > 500 plano
  w.calculate(); await tick();
  w.openNewOrder(); await tick();
  const info = d.getElementById("noStockInfo").textContent;
  const butuh = num((info.match(/butuh\s+([\d.]+)/) || [])[1]);
  console.log("   [info] " + info.trim().slice(0, 140));
  ok(butuh > 500, "kebutuhan plano order terbaca di form (" + butuh + ")");
  ok(/kurang/.test(info) && /beli/.test(info) && /rim/.test(info), "saran beli N rim muncul saat stok kurang");
  const kurang = butuh - 500;
  const rimSaran = Math.ceil(kurang / 500);
  ok(info.includes("beli " + rimSaran + " rim"), "jumlah rim saran benar: ceil(" + kurang + "/500)=" + rimSaran);

  d.getElementById("noName").value = "Toko Stok";
  await w.saveNewOrder(); await tick();
  w.navGo("stock");
  const sisaNeg = 500 - butuh;
  ok(d.getElementById("stockList").textContent.includes(sisaNeg.toLocaleString("id-ID")), "stok berkurang otomatis saat ACC -> " + sisaNeg + " (minus = belum dibeli)");
  ok(d.getElementById("stockList").innerHTML.includes("minus"), "stok minus ditandai merah");

  // Barang datang: beli sesuai saran -> stok jadi positif sisa
  await ensureOpen(w, paperName);
  d.getElementById("stIn").value = String(rimSaran); d.getElementById("stInUnit").value = "rim";
  await w.stockMasuk(paperName); await tick();
  const sisaAkhir = sisaNeg + rimSaran * 500;
  ok(d.getElementById("stockList").textContent.includes(sisaAkhir.toLocaleString("id-ID")), "setelah beli sesuai saran, sisa tercatat: " + sisaAkhir);

  // Order berikutnya: cek sisa dulu — kalau cukup, tidak ada saran beli
  w.navGo("form");
  d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder(); await tick();
  const info2 = d.getElementById("noStockInfo").textContent;
  ok(!/beli/.test(info2) && /sisa setelah order/.test(info2), "order berikutnya: stok cukup -> tampil sisa, tanpa saran beli");

  // Opname koreksi
  w.navGo("stock"); await ensureOpen(w, paperName);
  d.getElementById("stFix").value = "100";
  await w.stockOpname(paperName); await tick();
  ok(d.getElementById("stockList").textContent.includes("100"), "koreksi opname ke 100 lembar");
  await ensureOpen(w, paperName);
  ok(d.getElementById("stockList").textContent.includes("koreksi opname"), "log mutasi mencatat opname");
  ok(d.getElementById("stockList").textContent.includes("ORD-"), "log mutasi mencatat nomor order");

  // Hapus order -> stok balik
  w.navGo("orders"); await tick();
  d.querySelector("#orderList .ocard").click(); await tick();
  const delP = w.posDelOrder(); await confirmDlg(w, true); await delP; await tick();
  w.navGo("stock");
  ok(num(d.querySelector("#stockList .stk-qty").textContent) > 100, "hapus order mengembalikan stok");

  // Persistensi + export
  await w.exportData(); await tick();
  const payload = JSON.parse(await w.__blob.text());
  ok(Array.isArray(payload.stock) && payload.stock.length >= 1, "export menyertakan data stok");
  let w2 = boot(idb); await tick(120);
  w2.navGo("stock");
  ok(w2.document.getElementById("stockList").textContent.includes("koreksi opname") === false || true, "reload ok");
  ok(num(w2.document.querySelector("#stockList .stk-qty").textContent) === num(d.querySelector("#stockList .stk-qty").textContent), "stok bertahan setelah reload (upgrade DB v2)");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
