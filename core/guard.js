/* ===================== CỔNG GHI DỮ LIỆU (v45) =====================
   Mọi thao tác ghi (set/update/delete/add, kể cả batch) đều đi qua amgCheckWrite ở tầng dữ liệu,
   không chỉ ẩn nút trên giao diện. Từ chối → thao tác không được thực hiện và ghi 1 dòng nhật ký.
   Đọc dữ liệu / onSnapshot không bị ảnh hưởng.
   Giới hạn: đây là kiểm soát phía trình duyệt. Chặn ở máy chủ cần Firestore Security Rules (firestore.rules). */
(function amgInstallGuard() {
  const raw = window.__db;
  if (!raw || raw.__amgGuarded) return;
  const rawCollection = raw.collection.bind(raw);
  const rawBatch = raw.batch.bind(raw);
  const colOf = ref => ref && (ref.col || (ref.parent && ref.parent.id) || String(ref.path || "").split("/")[0]);
  function check(col, op, id, data) {
    return amgCheckWrite(window.__AMG_USER, col, op, id, data);
  }
  function deny(col, op, id, reason) {
    const u = window.__AMG_USER;
    try { console.warn("[AMG] Từ chối ghi:", col, op, id, reason); } catch (e) {}
    try {
      const logId = "DENY_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      rawCollection("auditLog").doc(logId).set({
        id: logId, type: "permission_denied",
        detail: `Từ chối ${op} trên "${col}${id ? "/" + id : ""}": ${reason}`,
        targetId: id || "", user: (u && (u.fullName || u.username)) || "chưa đăng nhập",
        ts: window.firebase && firebase.firestore && firebase.firestore.FieldValue
          ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}
    const err = new Error("Bạn không có quyền thực hiện thao tác này: " + reason);
    err.code = "permission-denied";
    return err;
  }
  function guardDoc(ref, col) {
    if (!ref || ref.__amgGuarded) return ref;
    ["set", "update", "delete"].forEach(m => {
      const orig = ref[m];
      if (typeof orig !== "function") return;
      ref[m] = function () {
        const r = check(col, m, ref.id, arguments[0]);
        if (!r.ok) return Promise.reject(deny(col, m, ref.id, r.reason));
        return orig.apply(ref, arguments);
      };
    });
    try { ref.__amgGuarded = true; } catch (e) {}
    return ref;
  }
  raw.collection = function (col) {
    const c = rawCollection(col);
    if (!c || c.__amgGuarded) return c;
    const od = c.doc.bind(c);
    c.doc = function (id) { return guardDoc(id === undefined ? od() : od(id), col); };
    if (typeof c.add === "function") {
      const oa = c.add.bind(c);
      c.add = function (data) {
        const r = check(col, "add", "", data);
        if (!r.ok) return Promise.reject(deny(col, "add", "", r.reason));
        return oa(data);
      };
    }
    try { c.__amgGuarded = true; } catch (e) {}
    return c;
  };
  raw.batch = function () {
    const b = rawBatch();
    let denied = null;
    ["set", "update", "delete"].forEach(m => {
      const o = b[m].bind(b);
      b[m] = function (ref) {
        const col = colOf(ref);
        const r = check(col, m, ref && ref.id, arguments[1]);
        if (!r.ok) { denied = denied || deny(col, m, ref && ref.id, r.reason); return b; }
        return o.apply(null, arguments);
      };
    });
    const oc = b.commit.bind(b);
    b.commit = function () { return denied ? Promise.reject(denied) : oc(); };
    return b;
  };
  raw.__amgGuarded = true;
})();
