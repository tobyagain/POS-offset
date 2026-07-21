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

  // ================= MODE WIZARD (HP) =================
  console.log("\n== WIZARD (mobile) ==");
  let w = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d = w.document;

  // Intent: landing = daftar order, bukan kalkulator
  ok(vis(w, "scrOrders") && !vis(w, "scrForm") && !vis(w, "scrHasil"), "landing screen = daftar Order");
  ok(d.querySelector('#mainNav button[data-nav="orders"]').classList.contains("act"), "nav 'Order' aktif");
  ok(d.getElementById("orderList").textContent.includes("Belum ada order"), "empty state tampil");

  // Kalkulasi seperti biasa
  w.navGo("form");
  ok(vis(w, "scrForm") && !vis(w, "scrOrders"), "nav ke Kalkulator");
  d.getElementById("pW").value = "25"; d.getElementById("pH").value = "35";
  d.getElementById("qty").value = "1000";
  w.calculate();
  await tick();
  const offerNow = num(d.getElementById("sTotal").innerText);
  ok(offerNow > 0, "kalkulasi jalan, total penawaran terisi (offer=" + offerNow + ")");
  ok(vis(w, "scrHasil"), "layar hasil tampil setelah kalkulasi");

  // ACC -> order baru; harga terprefill dari penawaran
  w.openNewOrder();
  ok(vis(w, "scrNewOrder"), "layar order baru tampil setelah ACC");
  ok(parseInt(d.getElementById("noPrice").value) === offerNow, "harga terprefill dari total penawaran");

  // Validasi: tanpa nama klien harus ditolak
  await w.saveNewOrder();
  ok(vis(w, "scrNewOrder"), "order tanpa nama klien ditolak (tetap di form)");

  // Simpan order klien baru dengan DP
  const priceNow = parseInt(d.getElementById("noPrice").value);
  d.getElementById("noName").value = "Toko ABC";
  d.getElementById("noPhone").value = "0812345678";
  d.getElementById("noDeadline").value = "2026-07-25";
  d.getElementById("noDesign").value = "nota-abc-v2.pdf, plat rak B";
  d.getElementById("noDP").value = "100000";
  await w.saveNewOrder();
  await tick();
  ok(vis(w, "scrOrderDetail"), "setelah simpan langsung ke detail order");
  const no1 = d.getElementById("odTitle").innerText;
  ok(/^ORD-2607-001$/.test(no1), "nomor order otomatis ORD-2607-001 (dapat: " + no1 + ")");
  ok(d.getElementById("odBody").textContent.includes("Toko ABC"), "detail memuat nama klien");
  ok(d.getElementById("odBody").textContent.includes("nota-abc-v2.pdf"), "catatan desain tersimpan");
  ok(d.getElementById("odBody").innerHTML.includes("pay-dp"), "DP 100rb tercatat sebagai status DP");

  // Intent: snapshot — harga order TIDAK berubah saat settings berubah (lewat UI settings asli)
  const savedPrice = priceNow;
  w.navGo("settings");
  await tick();
  d.querySelectorAll("#paperList .paper-row").forEach(row => {
    const inp = row.querySelectorAll("input")[3];
    inp.value = String(parseFloat(inp.value) * 3);
    inp.dispatchEvent(new w.Event("change"));
  });
  w.navGo("orders");
  ok(d.getElementById("orderList").textContent.includes(rpID(savedPrice)),
    "snapshot: harga order tetap walau harga kertas di settings naik 3x");

  // Daftar order & filter
  ok(d.querySelectorAll("#orderList .ocard").length === 1, "daftar order berisi 1 order");
  w.setOrderFilter("riwayat");
  ok(d.getElementById("orderList").textContent.includes("Belum ada order selesai"), "filter Riwayat kosong (order masih aktif)");
  w.setOrderFilter("aktif");

  // Status & pembayaran
  d.querySelector("#orderList .ocard").click();
  await tick();
  await w.posSetStatus("produksi");
  await tick();
  ok(d.getElementById("odBody").innerHTML.includes("st-produksi") || d.getElementById("odStatus").value === "produksi", "status berubah ke Produksi");
  d.getElementById("odPayAmt").value = String(savedPrice - 100000);
  const payP = w.posAddPayment(); await tick(); await payP; await tick();
  ok(d.getElementById("odBody").innerHTML.includes("pay-full"), "pelunasan sisa -> badge Lunas");
  // Overpay butuh konfirmasi
  d.getElementById("odPayAmt").value = "50000";
  const op = w.posAddPayment(); await confirmDialog(w, false); await op;
  ok(!d.getElementById("odBody").textContent.includes(rpID(savedPrice + 50000)), "overpay dibatalkan lewat dialog konfirmasi");

  // Klien: daftar, riwayat, edit
  w.navGo("clients");
  ok(vis(w, "scrClients") && d.getElementById("clientList").textContent.includes("Toko ABC"), "daftar klien memuat Toko ABC");
  ok(d.getElementById("clientList").textContent.includes("1 order"), "hitungan order per klien benar");
  d.querySelector("#clientList .ocard").click();
  await tick();
  ok(vis(w, "scrClientDetail") && d.getElementById("cdBody").textContent.includes("Riwayat order (1)"), "detail klien + riwayat 1 order");
  d.getElementById("cdPhone").value = "0899999999";
  await w.posSaveClient(); await tick();
  ok(d.getElementById("cdPhone").value === "0899999999", "edit klien tersimpan");

  // Repeat order: prefill + banner + harga lama sebagai pembanding + klien terpaut
  const oid = w.__posOrders ? null : null;
  const firstCard = d.querySelector("#cdBody .ocard");
  const idMatch = firstCard.getAttribute("onclick").match(/\d+/)[0];
  w.posRepeat(parseInt(idMatch));
  await tick();
  ok(parseInt(d.getElementById("qty").value) === 1000 && d.getElementById("pW").value == "25", "repeat: input kalkulator terprefill dari order lama");
  ok(!d.getElementById("repeatBanner").hidden && d.getElementById("repeatBanner").textContent.includes("Toko ABC"), "repeat: banner klien + harga lama tampil");
  const offerRepeat = num(d.getElementById("sTotal").innerText);
  ok(offerRepeat > savedPrice, "repeat: harga baru dihitung ulang dengan tarif sekarang (" + offerRepeat + " > " + savedPrice + ")");
  w.openNewOrder();
  ok(!d.getElementById("noOldPrice").hidden && d.getElementById("noOldPrice").textContent.includes(rpID(savedPrice)), "repeat: harga sebelumnya tampil sebagai pembanding");
  ok(d.getElementById("noClientSel").value !== "" && d.getElementById("noName").value === "Toko ABC", "repeat: klien lama terpilih otomatis");
  await w.saveNewOrder(); await tick();
  const no2 = d.getElementById("odTitle").innerText;
  ok(no2 === "ORD-2607-002", "nomor order berlanjut: " + no2);
  ok(d.getElementById("odBody").textContent.includes("Repeat dari ORD-2607-001"), "order baru mencatat asal repeat + harga lama");

  // Export: payload lengkap
  await w.exportData(); await tick();
  ok(String(w.__downloaded || "").startsWith("printcalc-backup-"), "export mengunduh file backup");
  const payload = JSON.parse(await w.__lastBlob.text());
  console.log("   [debug] settings:", payload.settings === null ? "null" : "ada", "| orders:", payload.orders.length, "| clients:", payload.clients.length, "| lastBackupInfo:", JSON.stringify(d.getElementById("lastBackupInfo").innerText));
  ok(payload.app === "printcalc" && payload.orders.length === 2 && payload.clients.length === 1 && payload.settings, "payload backup: 2 order, 1 klien, settings ikut");
  ok(String(d.getElementById("lastBackupInfo").innerText).includes("Backup terakhir"), "info backup terakhir ter-update");

  // Hapus order kedua (konfirmasi)
  const delP = w.posDelOrder(); await confirmDialog(w, true); await delP; await tick();
  ok(vis(w, "scrOrders") && d.querySelectorAll("#orderList .ocard").length === 1, "hapus order: kembali ke daftar, sisa 1 order");

  // ================= PERSISTENSI (reload dengan IDB sama) =================
  console.log("\n== PERSISTENSI (muat ulang) ==");
  let w2 = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  const d2 = w2.document;
  ok(d2.querySelectorAll("#orderList .ocard").length === 1 && d2.getElementById("orderList").textContent.includes("ORD-2607-001"),
    "order bertahan setelah reload (IndexedDB)");
  w2.navGo("clients");
  ok(d2.getElementById("clientList").textContent.includes("Toko ABC"), "klien bertahan setelah reload");

  // Import mengganti data
  const impPayload = JSON.parse(JSON.stringify(payload));
  impPayload.clients[0].name = "Toko IMPORT";
  const fakeFile = { text: async () => JSON.stringify(impPayload) };
  let reloaded = false;
  w2.location.reload = () => { reloaded = true; };
  const ip = w2.importData(fakeFile); await confirmDialog(w2, true); await ip; await tick(1200);
  let w3 = boot({ width: 390, idb: sharedIdb });
  await tick(80);
  w3.navGo("clients");
  ok(w3.document.getElementById("clientList").textContent.includes("Toko IMPORT"), "import mengganti data (nama klien berubah)");
  ok(w3.document.querySelectorAll("#orderList .ocard, #clientList .ocard").length >= 1, "data import terbaca setelah reload");

  // ================= MODE WORKBENCH (desktop) =================
  console.log("\n== WORKBENCH (desktop) ==");
  let w4 = boot({ width: 1280, idb: sharedIdb });
  await tick(80);
  const d4 = w4.document;
  ok(d4.body.classList.contains("wb"), "mode workbench aktif");
  ok(vis(w4, "scrOrders") && !vis(w4, "scrForm") && !vis(w4, "scrHasil"), "workbench: landing Order layar penuh, form+hasil tersembunyi");
  w4.navGo("form");
  ok(vis(w4, "scrForm") && vis(w4, "scrHasil") && !vis(w4, "scrOrders"), "workbench: Kalkulator = form+hasil berdampingan");
  d4.getElementById("qty").value = "2000";
  w4.calculate(); await tick();
  w4.openNewOrder();
  ok(vis(w4, "scrNewOrder") && !vis(w4, "scrForm") && !vis(w4, "scrHasil"), "workbench: layar order baru tampil penuh");
  d4.getElementById("noClientSel").value = ""; w4.onClientSelChange();
  d4.getElementById("noName").value = "CV Desktop";
  await w4.saveNewOrder(); await tick();
  ok(vis(w4, "scrOrderDetail") && d4.getElementById("odTitle").innerText === "ORD-2607-003", "workbench: order tersimpan, nomor lanjut ORD-2607-003");
  w4.navGo("settings");
  ok(vis(w4, "scrSettings") && d4.getElementById("lastBackupInfo"), "workbench: nav Pengaturan membuka layar settings + kartu backup");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
