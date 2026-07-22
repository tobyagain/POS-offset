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
      w.TextEncoder = TextEncoder; // jsdom VM tak punya TextEncoder (dipakai perakit PDF); browser punya
      // jsdom belum punya Blob.text() -> polyfill lewat FileReader bawaan jsdom
      if (!w.Blob.prototype.text) w.Blob.prototype.text = function () {
        return new Promise((res, rej) => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsText(this); });
      };
    }
  });
  return dom.window;
}
const vis = (w, id) => !w.document.getElementById(id).hidden;
async function confirmDialog(w, accept = true) {
  await tick();
  w.document.getElementById(accept ? "cfOk" : "cfCancel").click();
  await tick();
}

(async () => {
  const sharedIdb = new FDBFactory();
  const now = new Date();
  const ymd = day => now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");

  console.log("\n== KEUANGAN (laporan + pengeluaran) ==");
  let w = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d = w.document;

  // Layar keuangan: tab Laporan default, laporan kosong = nol semua
  w.navGo("finance");
  ok(vis(w, "scrFinance") && vis(w, "finLaporan") && !vis(w, "finKeluar"), "nav Keuangan: tab Laporan tampil default");
  ok(String(d.getElementById("rptMonth").value) === String(now.getMonth()), "periode default = bulan berjalan");
  ok(num(d.getElementById("rptOmzet").textContent) === 0 && num(d.getElementById("rptProfit").textContent) === 0, "laporan kosong: omzet & profit Rp 0");

  // Catat pengeluaran (kategori bebas)
  w.finTab("keluar");
  ok(!vis(w, "finLaporan") && vis(w, "finKeluar"), "tab Pengeluaran tampil");
  d.getElementById("expDate").value = ymd(5);
  d.getElementById("expCat").value = "Listrik";
  d.getElementById("expAmt").value = "200000";
  d.getElementById("expNote").value = "token bengkel";
  await w.expSave(); await tick();
  ok(d.getElementById("expList").textContent.includes("Listrik") && d.getElementById("expList").textContent.includes("200.000"), "pengeluaran Listrik 200rb tercatat di daftar");
  ok(d.getElementById("expCatDl").innerHTML.includes("Listrik"), "kategori yang pernah dipakai muncul sebagai saran (datalist)");

  // Validasi: tanpa kategori ditolak
  d.getElementById("expAmt").value = "50000";
  await w.expSave(); await tick();
  ok(d.querySelectorAll("#expList .ocard").length === 1, "pengeluaran tanpa kategori ditolak");

  // Belanja bahan bertanda HPP: masuk kas keluar, tidak mengurangi profit
  d.getElementById("expDate").value = ymd(10);
  d.getElementById("expCat").value = "Kertas HVS";
  d.getElementById("expAmt").value = "500000";
  d.getElementById("expHpp").checked = true;
  await w.expSave(); await tick();
  ok(d.querySelectorAll("#expList .ocard").length === 2 && d.getElementById("expList").innerHTML.includes("sudah dalam HPP"), "belanja bahan bertanda HPP tercatat dengan badge");

  // Buat order + DP supaya laporan punya omzet, HPP, kas masuk, piutang
  w.navGo("form");
  d.getElementById("pW").value = "25"; d.getElementById("pH").value = "35";
  d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  // fHPP ditulis aplikasi via innerText (di jsdom jadi properti biasa, bukan node teks)
  const hppShown = num(d.getElementById("fHPP").innerText);
  w.openNewOrder();
  d.getElementById("noName").value = "Toko Laporan";
  d.getElementById("noDP").value = "100000";
  const price = parseInt(d.getElementById("noPrice").value);
  await w.saveNewOrder(); await tick();

  // Laporan bulan berjalan (layar mengingat tab terakhir -> pindah ke Laporan dulu)
  w.navGo("finance");
  w.finTab("laporan");
  ok(num(d.getElementById("rptOmzet").textContent) === price, "omzet = nilai order bulan ini");
  ok(num(d.getElementById("rptKas").textContent) === 100000, "kas masuk = DP yang dibayar");
  ok(Math.abs(num(d.getElementById("rptHpp").textContent) - hppShown) <= 1, "HPP laporan = HPP snapshot order");
  ok(num(d.getElementById("rptExp").textContent) === 200000, "pengeluaran operasional = 200rb (belanja bahan tidak ikut)");
  ok(num(d.getElementById("rptBahan").textContent) === 500000, "belanja bahan tampil terpisah 500rb");
  const expProfit = price - num(d.getElementById("rptHpp").textContent) - 200000;
  ok(Math.abs(num(d.getElementById("rptProfit").textContent) - expProfit) <= 1, "profit bersih = omzet - HPP - operasional");
  ok(num(d.getElementById("rptPiutang").textContent) === price - 100000, "piutang = sisa tagihan order belum lunas");

  // Kas hari ini (arus kas harian, lepas dari periode) — DP & order dibuat "now"
  ok(d.getElementById("rptBody").textContent.includes("Kas hari ini"), "kartu kas hari ini tampil di laporan");
  ok(num(d.getElementById("dayIn").textContent) === 100000, "kas hari ini: uang masuk = DP dibayar hari ini");
  ok(d.getElementById("dayOrders").textContent.includes("1 order"), "kas hari ini: 1 order baru hari ini");
  const dIn = num(d.getElementById("dayIn").textContent), dOut = num(d.getElementById("dayOut").textContent), dNet = num(d.getElementById("dayNet").textContent);
  ok(Math.abs(dIn - dOut) === dNet, "kas hari ini: selisih = uang masuk - uang keluar");

  // Mode setahun penuh: rincian per bulan tampil
  d.getElementById("rptMonth").value = "all";
  w.renderReport();
  ok(d.getElementById("rptBody").textContent.includes("Profit per bulan") && d.getElementById("rptBody").textContent.includes("omzet"), "mode setahun: rincian profit per bulan tampil");
  ok(num(d.getElementById("rptOmzet").textContent) === price, "mode setahun: omzet tahunan benar");

  // Ekspor laporan PDF (v34)
  await w.exportReportPdf(); await tick();
  ok(String(w.__downloaded || "").startsWith("laporan-"), "ekspor laporan PDF mengunduh file");
  ok(w.__lastBlob && w.__lastBlob.type === "application/pdf", "berkas laporan bertipe PDF");
  ok((await w.__lastBlob.text()).startsWith("%PDF-"), "berkas laporan berupa PDF valid (header %PDF)");

  // Hapus pengeluaran (konfirmasi) -> laporan ikut berubah
  const delBtn = [...d.querySelectorAll("#expList .ocard")].find(c => c.textContent.includes("Listrik")).querySelector("button");
  const delP = w.expDel(parseInt(delBtn.getAttribute("onclick").match(/\d+/)[0]));
  await confirmDialog(w, true); await delP; await tick();
  ok(d.querySelectorAll("#expList .ocard").length === 1, "hapus pengeluaran: sisa 1 catatan");
  w.finTab("laporan");
  ok(num(d.getElementById("rptExp").textContent) === 0, "laporan ter-update setelah pengeluaran dihapus");

  // Export membawa pengeluaran
  await w.exportData(); await tick();
  const payload = JSON.parse(await w.__lastBlob.text());
  ok(Array.isArray(payload.expenses) && payload.expenses.length === 1 && payload.expenses[0].cat === "Kertas HVS", "backup menyertakan pengeluaran");

  // Tahun lampau otomatis bisa dipilih begitu ada datanya
  w.finTab("keluar");
  d.getElementById("expDate").value = "2024-03-05";
  d.getElementById("expCat").value = "Sewa";
  d.getElementById("expAmt").value = "300000";
  await w.expSave(); await tick();
  w.navGo("finance");
  w.finTab("laporan");
  ok([...d.getElementById("rptYear").options].some(op => op.value === "2024"), "tahun lampau muncul di pilihan saat ada datanya");
  d.getElementById("rptYear").value = "2024";
  d.getElementById("rptMonth").value = "all";
  w.renderReport();
  ok(num(d.getElementById("rptExp").textContent) === 300000, "laporan setahun 2024 membaca pengeluaran tahun itu");

  // Persistensi setelah reload
  console.log("\n== PERSISTENSI KEUANGAN ==");
  let w2 = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  w2.navGo("finance");
  w2.finTab("keluar");
  ok(w2.document.getElementById("expList").textContent.includes("Kertas HVS"), "pengeluaran bertahan setelah reload (IndexedDB)");
  w2.finTab("laporan");
  ok(num(w2.document.getElementById("rptOmzet").textContent) === price, "laporan terbaca ulang dari data tersimpan");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
