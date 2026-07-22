const { JSDOM } = require("jsdom");
const FDBFactory = require("fake-indexeddb/lib/FDBFactory");
const FDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.error("  ✗ FAIL: " + msg); }
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const num = s => parseInt(String(s).replace(/[^\d]/g, "") || "0");

function boot({ width = 390, idb } = {}) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://printcalc.local/",
    pretendToBeVisual: true,
    beforeParse(w) {
      w.indexedDB = idb || new FDBFactory();
      w.IDBKeyRange = FDBKeyRange;
      Object.defineProperty(w, "innerWidth", { value: width, configurable: true });
      w.matchMedia = q => ({ matches: width >= 980 && /min-width:\s*980px/.test(q), addEventListener() {}, addListener() {} });
      const noop = () => {};
      w.HTMLCanvasElement.prototype.getContext = function () {
        return new Proxy({ canvas: this, measureText: () => ({ width: 10 }) }, { get(t, k) { return k in t ? t[k] : noop; }, set() { return true; } });
      };
      w.URL.createObjectURL = blob => { w.__lastBlob = blob; return "blob:test"; };
      w.URL.revokeObjectURL = noop;
      w.HTMLAnchorElement.prototype.click = function () { w.__downloaded = this.download; };
      w.scrollTo = noop;
      w.HTMLElement.prototype.scrollIntoView = noop;
      w.print = () => { w.__printed = (w.__printed || 0) + 1; };
      w.navigator.clipboard = { writeText: t => { w.__shared = t; return Promise.resolve(); } };
      w.TextEncoder = TextEncoder;
      if (!w.Blob.prototype.text) w.Blob.prototype.text = function () {
        return new Promise((res, rej) => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsText(this); });
      };
    }
  });
  return dom.window;
}
const vis = (w, id) => !w.document.getElementById(id).hidden;

(async () => {
  const sharedIdb = new FDBFactory();
  console.log("\n== ONGKIR (ditagihkan ke klien, di luar omzet/profit) ==");
  let w = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d = w.document;

  // Kalkulasi + order dengan produk 100rb, ongkir 20rb, DP 50rb
  w.navGo("form");
  d.getElementById("pW").value = "25"; d.getElementById("pH").value = "35"; d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder();
  d.getElementById("noName").value = "Toko Ongkir";
  d.getElementById("noPrice").value = "100000";
  d.getElementById("noOngkir").value = "20000";
  d.getElementById("noDP").value = "50000";
  w.noBillInfo();
  ok(num(d.getElementById("noTotal").value) === 120000, "form: total tagihan = produk + ongkir = 120.000");
  await w.saveNewOrder(); await tick();
  ok(vis(w, "scrOrderDetail"), "order tersimpan -> detail");

  // Detail: rincian produk + ongkir + total tagihan (o.price = 120rb)
  const body = d.getElementById("odBody").textContent;
  ok(body.includes("Produk") && body.includes("Ongkir") && body.includes("Total tagihan"), "detail memuat rincian Produk + Ongkir + Total tagihan");
  ok(body.includes("120.000"), "detail: total tagihan 120.000 (produk+ongkir)");
  ok(body.includes("20.000"), "detail: baris ongkir 20.000");
  // Sisa tagihan = 120rb - 50rb DP = 70rb (dihitung atas total termasuk ongkir)
  ok(body.includes("70.000"), "detail: sisa tagihan 70.000 (atas total termasuk ongkir)");

  // Nota WA: rincian ongkir + total termasuk ongkir
  w.__shared = "";
  w.posShareNota();
  ok(w.__shared.includes("Ongkir") && w.__shared.includes("20.000") && w.__shared.includes("Total tagihan: Rp 120.000"), "nota WA memuat ongkir + total tagihan");

  // Resi order: baris Ongkir + TOTAL termasuk ongkir
  w.posPrintResi();
  const resi = d.getElementById("resiPrint").textContent;
  ok(resi.includes("Ongkir") && resi.includes("TOTAL") && resi.includes("120.000"), "resi order memuat ongkir + TOTAL 120.000");
  w.dispatchEvent(new w.Event("afterprint"));

  // Nota PDF valid + memuat ongkir
  await w.posShareNotaPdf(); await tick();
  const pdf = await w.__lastBlob.text();
  ok(pdf.startsWith("%PDF-") && pdf.includes("Ongkir"), "nota PDF valid + memuat baris Ongkir");

  // Laporan: OMZET = produk saja (100rb), ongkir TIDAK masuk omzet/profit.
  // Kas masuk = DP 50rb (uang riil termasuk bagian ongkir). Piutang = 120rb - 50rb = 70rb.
  w.navGo("finance"); w.finTab("laporan");
  ok(num(d.getElementById("rptOmzet").textContent) === 100000, "laporan: omzet = produk 100rb (ongkir TIDAK menambah omzet)");
  ok(num(d.getElementById("rptKas").textContent) === 50000, "laporan: kas masuk = DP 50rb");
  ok(num(d.getElementById("rptPiutang").textContent) === 70000, "laporan: piutang = total tagihan 120rb - 50rb = 70rb (termasuk ongkir)");
  // Profit bersih tidak terangkat oleh ongkir (omzet - HPP; ongkir bukan komponen)
  const omzet = num(d.getElementById("rptOmzet").textContent), hpp = num(d.getElementById("rptHpp").textContent);
  const pTxt = d.getElementById("rptProfit").textContent.trim();
  const profitSigned = (pTxt.startsWith("-") ? -1 : 1) * num(pTxt);
  ok(profitSigned === omzet - hpp, "laporan: profit = omzet(produk) - HPP, ongkir tak mengangkat profit");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
