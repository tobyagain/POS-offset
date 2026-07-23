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
const rpID = n => "Rp " + Math.round(n).toLocaleString("id-ID");

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
    }
  });
  return dom.window;
}

(async () => {
  const sharedIdb = new FDBFactory();

  console.log("\n== RESI THERMAL ==");
  let w = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d = w.document;

  // Buat order dengan DP
  w.navGo("form");
  d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder();
  d.getElementById("noName").value = "Toko Resi";
  d.getElementById("noPhone").value = "081234000";
  d.getElementById("noAddr").value = "Jl. Mawar No. 1, Blitar";
  d.getElementById("noDP").value = "100000";
  const price = num(d.getElementById("noPrice").value);
  await w.saveNewOrder(); await tick();
  const orderNo = d.getElementById("odTitle").innerText;

  // Pilihan lebar kertas resi kini di Pengaturan (bukan per-cetak), default 58 mm
  ok(!d.getElementById("odResiW"), "pilihan kertas per-cetak dihapus dari detail order");
  ok(!!d.getElementById("setResiW") && d.getElementById("setResiW").value === "58", "pilihan lebar kertas ada di Pengaturan, default 58 mm");

  // Cetak resi 58 mm
  w.posPrintResi();
  ok(w.__printed === 1, "posPrintResi memanggil window.print");
  ok(d.body.classList.contains("print-resi"), "mode print-resi aktif saat cetak");
  const resi = d.getElementById("resiPrint");
  ok(resi.textContent.includes(orderNo) && resi.textContent.includes("Toko Resi"), "resi memuat nomor order + nama klien");
  ok(resi.textContent.includes("TOTAL") && resi.textContent.includes(rpID(price)), "resi memuat harga total");
  ok(resi.textContent.includes("SISA") && resi.textContent.includes(rpID(price - 100000)), "resi memuat sisa tagihan setelah DP");
  ok(!resi.innerHTML.includes("r-lunas"), "belum lunas: blok LUNAS tidak tampil");
  ok(d.getElementById("resiPageStyle").textContent.includes("size: 48mm"), "@page = area cetak 48 mm untuk kertas 58");
  ok(!resi.className.includes("w80"), "kertas 58: tanpa kelas w80");
  w.dispatchEvent(new w.Event("afterprint"));
  ok(!d.body.classList.contains("print-resi"), "afterprint mengembalikan tampilan normal");

  // Ganti ke 80 mm -> tersimpan + dipakai saat cetak
  await w.thermalSetWidth("80"); await tick();
  w.posPrintResi();
  ok(d.getElementById("resiPageStyle").textContent.includes("size: 72mm") && resi.className.includes("w80"), "ganti kertas 80: @page = area cetak 72 mm + kelas w80");
  w.dispatchEvent(new w.Event("afterprint"));

  // Lunas -> blok LUNAS tampil di resi
  d.getElementById("odPayAmt").value = String(price - 100000);
  const payP = w.posAddPayment(); await tick(); await payP; await tick();
  w.posPrintResi();
  ok(resi.innerHTML.includes("r-lunas") && resi.textContent.includes("LUNAS"), "order lunas: blok LUNAS tampil di resi");
  w.dispatchEvent(new w.Event("afterprint"));

  // ===== Resi kirim: penerima (klien) + pengirim (identitas usaha), tanpa harga =====
  console.log("\n== RESI KIRIM ==");
  w.navGo("settings");
  d.getElementById("bizName").value = "Dahlia Pack";
  d.getElementById("bizPhone").value = "0812000111";
  d.getElementById("bizAddr").value = "Jl. Melati 2, Blitar";
  await w.bizSave(); await tick();
  w.navGo("orders");
  d.querySelector("#orderList .ocard").click();
  await tick();
  ok(d.getElementById("odBody").innerHTML.includes("posPrintResiKirim"), "tombol Resi kirim tampil di detail order");
  const printedBefore = w.__printed;
  await w.posPrintResiKirim();
  ok(w.__printed === printedBefore + 1, "resi kirim tercetak langsung (alamat klien lengkap)");
  ok(resi.textContent.includes("PENERIMA") && resi.textContent.includes("Toko Resi") && resi.textContent.includes("Jl. Mawar No. 1"), "resi kirim memuat penerima + alamat klien");
  ok(resi.textContent.includes("PENGIRIM") && resi.textContent.includes("Dahlia Pack") && resi.textContent.includes("0812000111"), "resi kirim memuat pengirim (nama + telepon) dari identitas usaha");
  ok(!resi.textContent.includes("Jl. Melati 2"), "resi kirim TIDAK memuat alamat pengirim");
  ok(!resi.textContent.includes("TOTAL") && !resi.textContent.includes(rpID(price)), "resi kirim tanpa info harga/pembayaran");
  ok(resi.textContent.includes(orderNo), "resi kirim mencantumkan nomor order sebagai referensi");
  w.dispatchEvent(new w.Event("afterprint"));

  // Klien tanpa alamat -> konfirmasi dulu
  w.navGo("form");
  d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder();
  d.getElementById("noClientSel").value = ""; w.onClientSelChange();
  d.getElementById("noName").value = "Tanpa Alamat";
  await w.saveNewOrder(); await tick();
  const printed2 = w.__printed;
  let pk = w.posPrintResiKirim();
  await new Promise(r => setTimeout(r, 30));
  d.getElementById("cfCancel").click(); await pk; await tick();
  ok(w.__printed === printed2, "alamat kosong: batal di konfirmasi -> tidak mencetak");
  pk = w.posPrintResiKirim();
  await new Promise(r => setTimeout(r, 30));
  d.getElementById("cfOk").click(); await pk; await tick();
  ok(w.__printed === printed2 + 1 && resi.textContent.includes("Tanpa Alamat"), "alamat kosong: konfirmasi -> tetap cetak");
  w.dispatchEvent(new w.Event("afterprint"));

  // Persistensi lebar kertas
  console.log("\n== PERSISTENSI RESI ==");
  let w2 = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  w2.navGo("orders");
  for (let i = 0; i < 30 && !w2.document.querySelector("#orderList .ocard"); i++) { await tick(50); w2.navGo("orders"); } // tunggu IDB termuat
  w2.document.querySelector("#orderList .ocard").click();
  await tick();
  ok(w2.document.getElementById("setResiW").value === "80", "pilihan lebar 80 mm bertahan setelah reload (di Pengaturan)");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
