/* ===================== DỮ LIỆU CÁC PHÂN HỆ MỚI (v45) =====================
   Đăng ký theo dõi (onSnapshot) các bộ dữ liệu mới và cung cấp hàm ghi duy nhất:
   kiểm tra quyền (cổng ghi), khóa phiên bản, và ghi MỘT dòng vào nhật ký chung (auditLog). */
function amgNewId(prefix) {
  return prefix + "-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}
function amgSaveRecord(col, rec, user, detail) {
  const meta = AMG_COLLECTIONS[col];
  if (!meta) return Promise.reject(new Error("Bộ dữ liệu không hợp lệ: " + col));
  const now = new Date().toISOString();
  const who = (user && (user.fullName || user.username)) || "";
  const isNew = !rec.id;
  const id = rec.id || amgNewId(meta.prefix);
  const audit = action => {
    const aid = amgNewId("AL");
    return window.__db.collection(FS.audit).doc(aid).set({
      id: aid, ts: now, type: "record_" + action, col, targetId: id, user: who,
      detail: detail || `${action === "create" ? "Tạo" : action === "delete" ? "Xóa" : "Cập nhật"} ${meta.label.toLowerCase()} ${id}`
    }).catch(() => {});
  };
  if (isNew) {
    const doc = Object.assign({}, rec, { id, version: 1, createdAt: now, createdBy: who, updatedAt: now, updatedBy: who });
    return window.__db.collection(col).doc(id).set(doc).then(() => { audit("create"); return doc; });
  }
  const expected = rec.version || 0;
  return amgSafeUpdate(col, id, cur => {
    if ((cur.version || 0) !== expected) {
      const e = new Error("Bản ghi vừa được người khác cập nhật. Hãy đóng và mở lại để xem bản mới nhất.");
      e.code = "version-conflict"; throw e;
    }
    return Object.assign({}, cur, rec, { id, updatedAt: now, updatedBy: who });
  }).then(doc => { audit("update"); return doc; });
}
function amgDeleteRecord(col, id, user, detail) {
  const meta = AMG_COLLECTIONS[col];
  const aid = amgNewId("AL");
  return window.__db.collection(col).doc(id).delete().then(() => window.__db.collection(FS.audit).doc(aid).set({
    id: aid, ts: new Date().toISOString(), type: "record_delete", col, targetId: id, user: (user && (user.fullName || user.username)) || "",
    detail: detail || `Xóa ${meta.label.toLowerCase()} ${id}`
  }).catch(() => {}));
}
function useExtraData(enabled) {
  const [state, setState] = useState(() => { const s = {}; Object.keys(AMG_COLLECTIONS).forEach(k => { s[k] = []; }); return s; });
  useEffect(() => {
    if (!enabled) return;
    const unsubs = Object.keys(AMG_COLLECTIONS).map(col => {
      try {
        return amgSnapDedup(window.__db.collection(col), s => {
          const rows = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
          setState(prev => Object.assign({}, prev, { [col]: rows }));
        }, () => {});
      } catch (e) { return null; }
    });
    return () => unsubs.forEach(u => { try { u && u(); } catch (e) {} });
  }, [enabled]);
  return state;
}
