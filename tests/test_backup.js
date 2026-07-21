const { JSDOM, VirtualConsole } = require("jsdom");
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

// wipeAllData memanggil location.reload — jsdom tak mengimplementasikannya & tak
// bisa di-stub; bungkam error "navigation" itu, sisanya tetap tampil.
const vc = new VirtualConsole();
vc.sendTo(console, { omitJSDOMErrors: true });
vc.on("jsdomError", e => { if (!/Not implemented: navigation/.test(e.message)) console.error(e); });

function boot({ idb } = {}) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://printcalc.local/",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.indexedDB = idb || new FDBFactory();
      w.IDBKeyRange = FDBKeyRange;
      Object.defineProperty(w, "innerWidth", { value: 390, configurable: true });
      w.matchMedia = q => ({ matches: false, addEventListener() {}, addListener() {} });
      const noop = () => {};
      w.HTMLCanvasElement.prototype.getContext = function () {
        return new Proxy({ canvas: this, measureText: () => ({ width: 10 }) }, {
          get(t, k) { return k in t ? t[k] : noop; }, set() { return true; }
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
const bannerShown = w => !w.document.getElementById("backupBanner").hidden;
async function answer(w, yes) { w.document.getElementById(yes ? "cfOk" : "cfCancel").click(); await tick(); }
async function makeOrder(w, name) {
  const d = w.document;
  w.navGo("form");
  d.getElementById("qty").value = "1000";
  w.calculate(); await tick();
  w.openNewOrder();
  d.getElementById("noClientSel").value = ""; w.onClientSelChange();
  d.getElementById("noName").value = name;
  await w.saveNewOrder(); await tick();
}

(async () => {
  const idb = new FDBFactory();

  // ===== Boot 1: aplikasi kosong -> tidak ada banner =====
  console.log("\n== PENGINGAT BACKUP (banner) ==");
  let w = boot({ idb });
  await tick(120);
  ok(!bannerShown(w), "aplikasi kosong: banner backup tidak tampil");
  await makeOrder(w, "Toko Satu");
  w.navGo("orders");
  ok(bannerShown(w), "ada data & belum pernah backup: banner muncul");
  ok(w.document.getElementById("backupBanner").textContent.includes("belum pernah"), "banner menyebut belum pernah backup");
  ok(w.document.getElementById("backupBanner").innerHTML.includes("exportData"), "banner punya tombol 'Backup sekarang'");

  // ===== Boot 2: banner tetap muncul setelah reload (belum backup) =====
  let w2 = boot({ idb });
  await tick(120);
  ok(bannerShown(w2), "banner bertahan setelah buka ulang selama belum backup");
  ok(w2.document.getElementById("lastBackupInfo").innerText.includes("belum di-backup"), "info Pengaturan menandai belum di-backup");
  // Satu ketuk backup -> ekspor jalan + banner hilang
  await w2.exportData(); await tick();
  ok(String(w2.__downloaded || "").startsWith("printcalc-backup-"), "'Backup sekarang' mengekspor file");
  ok(!bannerShown(w2), "setelah backup: banner langsung hilang");

  // ===== Boot 3: sudah backup, tak ada perubahan -> tidak ada banner =====
  let w3 = boot({ idb });
  await tick(120);
  ok(!bannerShown(w3), "sudah backup & tanpa perubahan: banner tidak tampil");
  // Perubahan baru setelah backup
  await tick(5);
  await makeOrder(w3, "Toko Dua");
  w3.navGo("orders");
  ok(bannerShown(w3), "ada perubahan sejak backup: banner muncul lagi");
  ok(w3.document.getElementById("backupBanner").textContent.includes("belum di-backup sejak"), "banner menyebut perubahan sejak backup terakhir");
  // Tutup banner -> hilang untuk sesi ini
  w3.dismissBackupBanner();
  ok(!bannerShown(w3), "tombol tutup menyembunyikan banner");
  w3.navGo("stock"); w3.navGo("orders");
  ok(!bannerShown(w3), "banner tetap tertutup setelah pindah layar (sesi ini)");

  // ===== Boot 4: banner muncul lagi di sesi berikutnya =====
  let w4 = boot({ idb });
  await tick(120);
  ok(bannerShown(w4), "sesi baru: banner muncul lagi (perubahan belum di-backup)");

  // ===== Hapus semua data (mulai fresh) =====
  console.log("\n== HAPUS SEMUA DATA ==");
  w4.navGo("settings");
  ok(w4.document.getElementById("lastBackupInfo").parentElement.innerHTML.includes("wipeAllData"), "tombol Hapus semua data ada di Pengaturan");
  // batal dulu -> data tetap utuh
  let wp = w4.wipeAllData(); await answer(w4, false); await wp; await tick();
  w4.navGo("orders");
  ok(w4.document.querySelectorAll("#orderList .ocard").length === 2, "wipe dibatalkan: data tetap utuh (2 order)");
  // konfirmasi -> stores dikosongkan (reload asli di-abaikan jsdom)
  wp = w4.wipeAllData(); await answer(w4, true); await wp; await tick();

  // Boot 5: benar-benar kosong
  let w5 = boot({ idb });
  await tick(120);
  ok(w5.document.querySelectorAll("#orderList .ocard").length === 0, "setelah wipe: daftar order kosong");
  ok(w5.document.getElementById("orderList").textContent.includes("Belum ada order"), "setelah wipe: empty state tampil");
  ok(!bannerShown(w5), "setelah wipe: tidak ada data -> tidak ada banner");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e); process.exit(1); });
