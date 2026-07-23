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

function boot({ idb, width = 390 } = {}) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url: "https://printcalc.local/", pretendToBeVisual: true,
    beforeParse(w) {
      w.indexedDB = idb || new FDBFactory();
      w.IDBKeyRange = FDBKeyRange;
      Object.defineProperty(w, "innerWidth", { value: width, configurable: true });
      w.matchMedia = q => ({ matches: width >= 980 && /min-width:\s*980px/.test(q), addEventListener() {}, addListener() {} });
      const noop = () => {};
      w.HTMLCanvasElement.prototype.getContext = function () {
        return new Proxy({ canvas: this, measureText: () => ({ width: 10 }) }, { get(t, k) { return k in t ? t[k] : noop; }, set() { return true; } });
      };
      w.URL.createObjectURL = b => { w.__lastBlob = b; return "blob:t"; };
      w.URL.revokeObjectURL = noop;
      w.HTMLAnchorElement.prototype.click = function () { w.__downloaded = this.download; };
      w.scrollTo = noop; w.HTMLElement.prototype.scrollIntoView = noop;
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

function calcItem(w, { paper = 0, pW, pH, qty }) {
  const d = w.document;
  w.navGo("form");
  d.getElementById("paperType").value = String(paper);
  d.getElementById("pW").value = String(pW);
  d.getElementById("pH").value = String(pH);
  d.getElementById("qty").value = String(qty);
  w.calculate();
}

(async () => {
  const idb = new FDBFactory();
  console.log("\n== ORDER MULTI-ITEM ==");
  let w = boot({ idb });
  await tick(80);
  const d = w.document;

  // Item 1
  calcItem(w, { paper: 0, pW: 25, pH: 35, qty: 1000 });
  await tick();
  const hpp1 = num(d.getElementById("fHPP").innerText);
  w.cartAdd();
  ok(!d.getElementById("cartInd").hidden && d.getElementById("cartInd").textContent.includes("1 item"), "cartAdd: indikator draft '1 item' tampil");

  // Item 2 (kertas & ukuran beda)
  calcItem(w, { paper: 1, pW: 10, pH: 16, qty: 500 });
  await tick();
  const hpp2 = num(d.getElementById("fHPP").innerText);
  w.cartAdd();
  ok(d.getElementById("cartInd").textContent.includes("2 item"), "cartAdd: indikator draft '2 item'");
  ok(d.getElementById("btnMakeOrder").textContent.includes("Buat order (2 item)"), "tombol berubah jadi 'Buat order (2 item)'");

  // Kirim penawaran dgn draft multi-item: KEDUA item harus terlist (bukan cuma lastCalc)
  w.__shared = "";
  w.shareClient();
  ok(w.__shared.includes("PENAWARAN") && /1\. Cetak/.test(w.__shared) && /2\. Cetak/.test(w.__shared), "kirim penawaran draft multi: kedua item terlist di WA");
  ok(w.__shared.includes("Total") && !/HPP|modal/i.test(w.__shared), "penawaran multi: ada Total, tanpa HPP/modal (aman untuk klien)");

  // Finalisasi
  w.openNewOrder();
  ok(vis(w, "scrNewOrder"), "layar order baru tampil");
  ok(d.getElementById("noCalcSum").textContent.includes("Item 1") && d.getElementById("noCalcSum").textContent.includes("Item 2"), "ringkasan order menampilkan 2 item");
  const priceSum = num(d.getElementById("noPrice").value);
  ok(priceSum > 0, "harga terisi jumlah kedua item (" + priceSum + ")");
  d.getElementById("noName").value = "Toko Multi";
  await w.saveNewOrder(); await tick();
  ok(vis(w, "scrOrderDetail"), "tersimpan -> detail order");
  ok(d.getElementById("odBody").textContent.includes("Item 1") && d.getElementById("odBody").textContent.includes("Item 2"), "detail order memuat 2 item");
  ok(d.getElementById("odBody").innerHTML.includes("2 item"), "badge '2 item' tampil di detail");
  const orderNo = d.getElementById("odTitle").innerText;

  // Draft dikosongkan setelah simpan
  w.navGo("form"); w.calculate(); await tick();
  ok(d.getElementById("cartInd").hidden, "draft kosong setelah order tersimpan");

  // Stok: dua kertas berbeda sama-sama berkurang
  w.navGo("stock");
  ok(d.querySelectorAll("#stockList .stk-qty.minus").length >= 2, "stok dua jenis kertas sama-sama berkurang (2 minus)");

  // Laporan: HPP = jumlah HPP kedua item
  w.navGo("finance"); w.finTab("laporan");
  ok(Math.abs(num(d.getElementById("rptHpp").textContent) - (hpp1 + hpp2)) <= 2, "laporan HPP = HPP item1 + item2");
  ok(num(d.getElementById("rptOmzet").textContent) === priceSum, "laporan omzet = total order multi-item");

  // Resi order: kedua item tampil, tanpa data rusak
  w.navGo("orders");
  d.querySelector("#orderList .ocard").click(); await tick();
  w.posPrintResi();
  ok(d.getElementById("resiPrint").textContent.includes("1. ") && d.getElementById("resiPrint").textContent.includes("2. ") && d.getElementById("resiPrint").textContent.includes("Subtotal"), "resi order memuat kedua item + subtotal per item");
  ok(!d.getElementById("resiPrint").textContent.includes("undefined"), "resi multi-item tanpa data rusak");
  w.dispatchEvent(new w.Event("afterprint"));

  // Nota PDF multi-item valid
  await w.posShareNotaPdf(); await tick();
  ok(w.__lastBlob && (await w.__lastBlob.text()).startsWith("%PDF-"), "nota PDF multi-item berupa PDF valid");

  // Kartu daftar menandai '+1 item'
  ok(d.getElementById("orderList").innerHTML.includes("+1 item"), "kartu daftar order menandai '+1 item'");

  // Repeat multi-item -> draft tersusun ulang
  const idM = d.querySelector("#orderList .ocard").getAttribute("onclick").match(/\d+/)[0];
  w.posRepeat(parseInt(idM)); await tick();
  ok(d.getElementById("cartInd").textContent.includes("2 item"), "repeat multi-item: 2 item tersusun ulang di draft");
  ok(!d.getElementById("repeatBanner").hidden && d.getElementById("repeatBanner").textContent.includes("2 item"), "repeat multi-item: banner menyebut 2 item");
  w.openNewOrder();
  ok(d.getElementById("noCalcSum").textContent.includes("Item 2"), "repeat: order baru berisi 2 item");
  ok(!d.getElementById("noOldPrice").hidden, "repeat: banner harga lama tampil");

  // Regresi workbench (v41): repeat multi-item HARUS pindah ke kalkulator, tidak
  // mangkrak di detail order. Bug lama: cabang multi-item lupa navScreen("form")
  // — di HP calculate() kebetulan pindah ke Hasil, tapi di workbench (≥980px)
  // layar tetap di detail order (seolah tombol tak berfungsi).
  const wWb = boot({ idb, width: 1000 });
  await tick(80);
  const dw = wWb.document;
  wWb.navGo("orders");
  for (let i = 0; i < 30 && !dw.querySelector("#orderList .ocard"); i++) { await tick(50); wWb.navGo("orders"); }
  dw.querySelector("#orderList .ocard").click(); await tick();
  ok(vis(wWb, "scrOrderDetail"), "workbench: detail order terbuka sebelum repeat");
  const ridWb = parseInt(dw.getElementById("odBody").innerHTML.match(/posRepeat\((\d+)\)/)[1]);
  wWb.posRepeat(ridWb); await tick();
  ok(!vis(wWb, "scrOrderDetail"), "workbench: repeat multi-item pindah ke kalkulator (tidak mangkrak di detail order)");
  ok(!dw.getElementById("repeatBanner").hidden && dw.getElementById("cartInd").textContent.includes("2 item"), "workbench: banner + draft 2 item aktif setelah repeat");

  // ===== Kompatibilitas mundur: order format lama (hanya o.calc, tanpa items) =====
  console.log("\n== ORDER FORMAT LAMA ==");
  await new Promise((res, rej) => {
    const op = idb.open("printcalc_pos", 3);
    op.onsuccess = () => {
      const db = op.result;
      const tx = db.transaction(["orders", "clients"], "readwrite");
      tx.objectStore("clients").put({ id: 9999, name: "Klien Lama", phone: "", address: "", createdAt: Date.now() });
      tx.objectStore("orders").put({
        id: 8888, no: "ORD-2501-009", clientId: 9999, createdAt: Date.now(), status: "order",
        payments: [], price: 500000, designNote: "",
        calc: { pW: 20, pH: 30, colorCount: 1, paper: "Kertas Lama (65x100)", mName: "Mesin 72", qty: 1000, mata: 4, totalPlano: 250, hppTotal: 300000, hppPerUnit: 300 },
        inputs: { paper: "Kertas Lama", pW: 20, pH: 30, colors: 1, qty: 1000 }
      });
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
    op.onerror = () => rej(op.error);
  });
  let w2 = boot({ idb });
  await tick(80);
  const d2 = w2.document;
  w2.navGo("orders");
  d2.getElementById("orderSearch").value = "ORD-2501-009"; w2.renderOrders();
  ok(d2.querySelectorAll("#orderList .ocard").length === 1, "order format lama muncul di daftar");
  d2.querySelector("#orderList .ocard").click(); await tick();
  ok(d2.getElementById("odBody").textContent.includes("Kertas Lama") && d2.getElementById("odBody").textContent.includes("20×30"), "order lama ter-render sebagai 1 item (tanpa migrasi)");
  w2.posPrintResi();
  ok(d2.getElementById("resiPrint").textContent.includes("ORD-2501-009") && !d2.getElementById("resiPrint").textContent.includes("undefined"), "resi order lama tetap benar");
  w2.dispatchEvent(new w2.Event("afterprint"));
  w2.navGo("finance"); w2.finTab("laporan");
  d2.getElementById("rptMonth").value = "all"; w2.renderReport();
  ok(num(d2.getElementById("rptHpp").textContent) >= 300000, "HPP laporan menghitung order lama lewat orderHpp()");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
