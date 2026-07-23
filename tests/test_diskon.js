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
  console.log("\n== DISKON (potongan harga produk; mengurangi omzet & profit) ==");
  let w = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d = w.document;

  // Kalkulasi + order: produk 100rb, diskon 15rb, ongkir 10rb, DP 50rb
  w.navGo("form");
  d.getElementById("pW").value = "25"; d.getElementById("pH").value = "35"; d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder();
  d.getElementById("noName").value = "Toko Diskon";
  d.getElementById("noPrice").value = "100000";
  d.getElementById("noDisc").value = "15000";
  d.getElementById("noOngkir").value = "10000";
  d.getElementById("noDP").value = "50000";
  w.noBillInfo();
  // total tagihan = (produk - diskon) + ongkir = (100rb - 15rb) + 10rb = 95rb
  ok(num(d.getElementById("noTotal").value) === 95000, "form: total = (produk - diskon) + ongkir = 95.000");
  await w.saveNewOrder(); await tick();
  ok(vis(w, "scrOrderDetail"), "order tersimpan -> detail");

  // Detail: Produk (bruto 100rb), Diskon 15rb, Ongkir 10rb, Total tagihan 95rb, Sisa 45rb
  const body = d.getElementById("odBody").textContent;
  ok(body.includes("Produk") && body.includes("Diskon") && body.includes("Total tagihan"), "detail memuat Produk + Diskon + Total tagihan");
  ok(body.includes("100.000"), "detail: harga produk bruto 100.000 (sebelum diskon)");
  ok(body.includes("15.000"), "detail: baris diskon 15.000");
  ok(body.includes("95.000"), "detail: total tagihan 95.000 (produk - diskon + ongkir)");
  ok(body.includes("45.000"), "detail: sisa tagihan 45.000 (95rb - 50rb DP)");

  // Nota WA: baris Diskon + total setelah diskon
  w.__shared = "";
  w.posShareNota();
  ok(w.__shared.includes("Diskon: -Rp 15.000") && w.__shared.includes("Total tagihan: Rp 95.000"), "nota WA memuat Diskon + total tagihan setelah diskon");

  // Resi order: baris Diskon + TOTAL setelah diskon
  w.posPrintResi();
  const resi = d.getElementById("resiPrint").textContent;
  ok(resi.includes("Diskon") && resi.includes("TOTAL") && resi.includes("95.000"), "resi order memuat Diskon + TOTAL 95.000");
  w.dispatchEvent(new w.Event("afterprint"));

  // Nota PDF valid + memuat Diskon
  await w.posShareNotaPdf(); await tick();
  const pdf = await w.__lastBlob.text();
  ok(pdf.startsWith("%PDF-") && pdf.includes("Diskon"), "nota PDF valid + memuat baris Diskon");

  // Laporan: OMZET = produk NETTO setelah diskon (85rb) — diskon MENGURANGI omzet & profit
  // (beda dgn ongkir yg netral). Piutang = 95rb - 50rb DP = 45rb.
  w.navGo("finance"); w.finTab("laporan");
  ok(num(d.getElementById("rptOmzet").textContent) === 85000, "laporan: omzet = produk setelah diskon 85rb (diskon mengurangi omzet)");
  ok(num(d.getElementById("rptKas").textContent) === 50000, "laporan: kas masuk = DP 50rb");
  ok(num(d.getElementById("rptPiutang").textContent) === 45000, "laporan: piutang = 95rb - 50rb = 45rb");
  const omzet = num(d.getElementById("rptOmzet").textContent), hpp = num(d.getElementById("rptHpp").textContent);
  const pTxt = d.getElementById("rptProfit").textContent.trim();
  const profitSigned = (pTxt.startsWith("-") ? -1 : 1) * num(pTxt);
  ok(profitSigned === omzet - hpp, "laporan: profit = omzet(setelah diskon) - HPP");

  // Validasi: diskon > harga produk ditolak (tak tersimpan)
  w.navGo("form");
  d.getElementById("pW").value = "25"; d.getElementById("pH").value = "35"; d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder();
  d.getElementById("noName").value = "Diskon Kebesaran";
  d.getElementById("noPrice").value = "50000";
  d.getElementById("noDisc").value = "60000";
  w.noBillInfo();
  await w.saveNewOrder(); await tick();
  ok(d.getElementById("noDisc").classList.contains("err"), "validasi: diskon > harga produk ditandai error");
  ok(!vis(w, "scrOrderDetail"), "validasi: order diskon berlebih tidak lolos ke detail");

  // Tanpa diskon & tanpa ongkir: total = harga produk apa adanya
  d.getElementById("noDisc").value = "";
  d.getElementById("noPrice").value = "70000";
  w.noBillInfo();
  ok(num(d.getElementById("noTotal").value) === 70000, "form: tanpa diskon/ongkir, total = harga produk");

  w.navGo("orders");
  ok(!d.getElementById("orderList").textContent.includes("Diskon Kebesaran"), "validasi: order dgn diskon berlebih TIDAK tersimpan (tak muncul di daftar)");

  console.log(`\n== PENGATURAN accordion (bagian bisa dilipat) ==`);
  ok(d.querySelectorAll("#scrSettings .set-acc").length >= 4, "Pengaturan: minimal 4 bagian lipat (mesin/kertas/parameter/identitas/backup)");
  ok(!!d.getElementById("machineList").closest("details") && !!d.getElementById("bizName").closest("details") && !!d.getElementById("lastBackupInfo").closest("details"),
     "Pengaturan: mesin, identitas usaha, dan data/backup berada dalam bagian lipat");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
