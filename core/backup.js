/* ===================== SAO LƯU / XUẤT DỮ LIỆU (v45) =====================
   Xuất toàn bộ các bộ dữ liệu ra một tệp JSON để lưu trước mỗi lần nâng cấp. Chỉ đọc, không thay đổi dữ liệu.
   Không đưa trường "password" của tài khoản vào tệp sao lưu. */
const AMG_BACKUP_COLLECTIONS = ["orders", "staff", "machines", "scrap", "auditLog", "attendance", "schedule", "users", "certificates", "productionRuns", "productionEntries"];
function amgPlain(v) {
  if (v === null || v === undefined) return v;
  if (typeof v.toDate === "function") { try { return v.toDate().toISOString(); } catch (e) { return null; } }
  if (Array.isArray(v)) return v.map(amgPlain);
  if (typeof v === "object") { const o = {}; Object.keys(v).forEach(k => { o[k] = amgPlain(v[k]); }); return o; }
  return v;
}
async function amgExportAll() {
  const out = { meta: { app: "AOMAGA MES", version: AMG_CONFIG.version, exportedAt: new Date().toISOString(),
    exportedBy: (window.__AMG_USER && (window.__AMG_USER.username || window.__AMG_USER.fullName)) || "", counts: {} }, data: {} };
  for (const c of AMG_BACKUP_COLLECTIONS) {
    const coll = window.__db.collection(c);
    // Firestore thật có .get(); bản offline (localStorage) chỉ có onSnapshot → đọc một lần rồi hủy đăng ký
    const snap = typeof coll.get === "function" ? await coll.get() : await new Promise((res, rej) => {
      let un = null, got = false;
      un = coll.onSnapshot(s => { if (got) return; got = true; res(s); if (un) un(); else Promise.resolve().then(() => un && un()); }, rej);
    });
    const docs = [];
    snap.docs.forEach(d => {
      const obj = amgPlain(Object.assign({ id: d.id }, d.data()));
      if (c === "users") delete obj.password;
      docs.push(obj);
    });
    out.data[c] = docs;
    out.meta.counts[c] = docs.length;
  }
  return out;
}
async function amgDownloadBackup() {
  const obj = await amgExportAll();
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url; a.download = "aomaga-mes-sao-luu-" + stamp + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return obj.meta;
}
