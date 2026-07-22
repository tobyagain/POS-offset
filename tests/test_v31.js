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
      w.matchMedia = q => ({
        matches: width >= 980 && /min-width:\s*980px/.test(q),
        addEventListener() {}, addListener() {}
      });
      const noop = () => {};
      w.HTMLCanvasElement.prototype.getContext = function () {
        return new Proxy({ canvas: this, measureText: () => ({ width: 10 }) }, {
          get(t, k) { return k in t ? t[k] : noop; },
          set() { return true; }
        });
      };
      w.URL.createObjectURL = blob => { w.__lastBlob = blob; return "blob:test"; };
      w.URL.revokeObjectURL = noop;
      w.HTMLAnchorElement.prototype.click = function () { w.__downloaded = this.download; };
      w.scrollTo = noop;
      w.HTMLElement.prototype.scrollIntoView = noop;
      w.print = () => { w.__printed = (w.__printed || 0) + 1; };
      // tangkap teks penawaran yang dibagikan (shareText -> clipboard)
      w.navigator.clipboard = { writeText: t => { w.__shared = t; return Promise.resolve(); } };
    }
  });
  return dom.window;
}
const vis = (w, id) => !w.document.getElementById(id).hidden;

(async () => {
  const sharedIdb = new FDBFactory();

  // ===== A. Kertas disediakan klien (jasa cetak saja) =====
  console.log("\n== KERTAS DARI KLIEN ==");
  let w = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d = w.document;

  w.navGo("form");
  d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  const offerNormal = num(d.getElementById("sTotal").innerText);
  const hppNormal = num(d.getElementById("fHPP").innerText);
  ok(!vis(w, "pbcNote") === false || d.getElementById("pbcNote").hidden, "tanpa centang: catatan kertas klien tersembunyi");

  d.getElementById("paperByClient").checked = true;
  w.calculate(); await tick();
  const offerJasa = num(d.getElementById("sTotal").innerText);
  const hppJasa = num(d.getElementById("fHPP").innerText);
  ok(!d.getElementById("pbcNote").hidden && d.getElementById("pbcNote").textContent.includes("plano"), "catatan 'klien perlu menyiapkan X plano' tampil");
  ok(d.getElementById("fPaper").innerText.includes("Rp 0"), "rincian: biaya kertas Rp 0 (dari klien)");
  ok(offerJasa < offerNormal && hppJasa < hppNormal, `harga jasa (${offerJasa}) < harga normal (${offerNormal}), HPP ikut turun`);

  // Simpan order -> stok tidak berkurang
  w.openNewOrder();
  ok(d.getElementById("noStockInfo").textContent.includes("stok tidak dipakai"), "form order: info stok tidak dipakai");
  d.getElementById("noName").value = "Klien Bawa Kertas";
  await w.saveNewOrder(); await tick();
  ok(d.getElementById("odBody").textContent.includes("dari klien"), "detail order mencatat kertas dari klien");
  w.navGo("stock");
  ok(!d.querySelector(".stk-qty.minus"), "stok TIDAK berkurang (tidak ada stok minus)");
  w.navGo("orders");
  ok(d.getElementById("orderList").textContent.includes("kertas klien"), "daftar order menandai kertas klien");

  // Repeat -> centang ikut terprefill
  const idA = d.querySelector("#orderList .ocard").getAttribute("onclick").match(/\d+/)[0];
  w.posRepeat(parseInt(idA)); await tick();
  ok(d.getElementById("paperByClient").checked === true, "repeat: centang kertas klien terprefill");
  d.getElementById("paperByClient").checked = false; // bersihkan utk bagian B

  // ===== B. Order partner (makloon) =====
  console.log("\n== ORDER PARTNER ==");
  w.openPartnerOrder();
  ok(vis(w, "scrPartnerOrder"), "form order partner terbuka");
  d.getElementById("poName").value = "CV Lempar";
  d.getElementById("poDesc").value = "Nota NCR 2 ply, 100 buku";
  d.getElementById("poQty").value = "100";
  d.getElementById("poPartner").value = "Percetakan X";
  d.getElementById("poCost").value = "500000";
  d.getElementById("poMarkup").value = "20";
  w.poRecalc();
  ok(parseInt(d.getElementById("poPrice").value) === 600000, "markup 20% otomatis: modal 500rb -> jual 600rb");
  // poProfit ditulis via innerText (expando di jsdom) — baca lewat innerText
  ok(String(d.getElementById("poProfit").innerText).includes("100.000"), "info profit 100rb tampil");

  // Rincian per pcs (qty 100): HPP/pcs 5rb, jual/pcs 6rb, untung/pcs 1rb + markup 20%
  const brk = d.getElementById("poBreak");
  ok(!brk.hidden, "rincian per pcs tampil saat jumlah diisi");
  ok(brk.textContent.includes("5.000") && brk.textContent.includes("Modal partner / pcs"), "rincian: modal/pcs = 5.000");
  ok(brk.textContent.includes("6.000") && brk.textContent.includes("Harga jual / pcs"), "rincian: harga jual/pcs = 6.000");
  ok(brk.textContent.includes("1.000") && brk.textContent.includes("markup 20%"), "rincian: untung/pcs = 1.000 (markup 20%)");
  // Tanpa jumlah: rincian per pcs disembunyikan (order partner boleh tanpa qty)
  d.getElementById("poQty").value = ""; w.poInfo();
  ok(brk.hidden, "rincian per pcs disembunyikan saat jumlah kosong");
  d.getElementById("poQty").value = "100"; w.poInfo();

  // Penawaran ke klien: deskripsi + harga jual, TANPA modal partner & TANPA identitas usaha
  w.__shared = "";
  w.poSharePenawaran();
  ok(w.__shared.includes("PENAWARAN") && w.__shared.includes("Nota NCR 2 ply") && w.__shared.includes("600.000"), "penawaran partner memuat deskripsi + harga jual");
  ok(!w.__shared.includes("500.000"), "penawaran partner TIDAK membocorkan modal partner");
  ok(!w.__shared.includes("Dahlia Pack"), "penawaran partner tanpa identitas usaha (keputusan v25)");

  d.getElementById("poDP").value = "200000";
  await w.savePartnerOrder(); await tick();
  ok(vis(w, "scrOrderDetail") && d.getElementById("odBody").textContent.includes("Nota NCR 2 ply"), "order partner tersimpan, detail memuat deskripsi");
  ok(d.getElementById("odBody").textContent.includes("Percetakan X") && d.getElementById("odBody").textContent.includes("500.000"), "detail memuat nama partner + modal");
  ok(d.getElementById("odBody").textContent.includes("5.000/pcs") && d.getElementById("odBody").textContent.includes("Harga jual / pcs"), "detail order partner memuat rincian per pcs");
  const partnerNo = d.getElementById("odTitle").innerText;

  // Resi order partner: deskripsi tampil, tanpa data kalkulasi & tanpa modal
  w.posPrintResi();
  const resi = d.getElementById("resiPrint");
  ok(resi.textContent.includes("Nota NCR 2 ply") && !resi.textContent.includes("undefined"), "resi order partner memuat deskripsi tanpa data rusak");
  ok(!resi.textContent.includes("500.000") && resi.textContent.includes("600.000"), "resi tidak membocorkan modal partner, hanya harga jual");
  w.dispatchEvent(new w.Event("afterprint"));

  // Daftar order: badge partner
  w.navGo("orders");
  ok(d.getElementById("orderList").innerHTML.includes(">Partner<") && d.getElementById("orderList").textContent.includes("via partner"), "daftar order menandai order partner");

  // Laporan: modal partner = HPP -> profit benar
  w.navGo("finance"); w.finTab("laporan");
  const omzet = num(d.getElementById("rptOmzet").textContent);
  const hpp = num(d.getElementById("rptHpp").textContent);
  const profit = num(d.getElementById("rptProfit").textContent);
  ok(omzet === offerJasa + 600000, "laporan: omzet = order jasa + order partner");
  ok(Math.abs(hpp - (hppJasa + 500000)) <= 1, "laporan: HPP memuat modal partner 500rb");
  ok(Math.abs(profit - (omzet - hpp)) <= 1, "laporan: profit = omzet - HPP (tanpa pengeluaran)");
  ok(num(d.getElementById("rptKas").textContent) === 200000, "laporan: kas masuk = DP order partner");

  // Repeat order partner -> form terprefill + banner harga lama
  w.navGo("orders");
  const pCard = [...d.querySelectorAll("#orderList .ocard")].find(c => c.textContent.includes("via partner"));
  w.posRepeat(parseInt(pCard.getAttribute("onclick").match(/\d+/)[0])); await tick();
  ok(vis(w, "scrPartnerOrder") && d.getElementById("poCost").value === "500000" && d.getElementById("poDesc").value.includes("Nota NCR"), "repeat partner: form terprefill dari order lama");
  ok(!d.getElementById("poOldPrice").hidden && d.getElementById("poOldPrice").textContent.includes("600.000"), "repeat partner: banner harga lama tampil");

  // Persistensi
  console.log("\n== PERSISTENSI V31 ==");
  let w2 = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  w2.navGo("orders");
  for (let i = 0; i < 30 && !w2.document.querySelector("#orderList .ocard"); i++) { await tick(50); w2.navGo("orders"); }
  ok(w2.document.getElementById("orderList").textContent.includes("via partner") && w2.document.getElementById("orderList").textContent.includes("kertas klien"), "kedua jenis order bertahan setelah reload");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
