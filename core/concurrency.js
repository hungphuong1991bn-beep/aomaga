/* ===================== KIỂM SOÁT GHI ĐỒNG THỜI (v45) =====================
   amgSafeUpdate: đọc bản ghi mới nhất rồi áp dụng thay đổi trong MỘT giao dịch, tăng "version".
   Hai người sửa cùng một bản ghi sẽ không còn ghi đè mất số liệu của nhau.
   Hiện tại là nền tảng: các tab sẽ chuyển sang dùng hàm này ở Giai đoạn 4 (mỗi lần một tab, có kiểm thử). */
async function amgSafeUpdate(col, id, mutator) {
  const r = amgCheckWrite(window.__AMG_USER, col, "update", id);
  if (!r.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + r.reason);
  const ref = window.__db.collection(col).doc(id);
  const exists = s => (typeof s.exists === "function" ? s.exists() : s.exists);
  // v59: trên Realtime Database (REST) KHÔNG có runTransaction — trước đây hàm rơi xuống nhánh "đọc rồi ghi tuần tự" nên hai thiết bị cùng sửa có thể mất một lần cập nhật.
  // Nay dùng ghi có điều kiện theo ETag (casDoc): đọc bản mới nhất từ máy chủ → áp dụng → ghi kèm if-match, bị người khác ghi xen thì tự đọc lại và áp dụng lại.
  // Chỉ khi KHÔNG có mạng (hoặc máy chủ không công khai ETag) mới ghi cục bộ + xếp hàng đợi; khi gửi lên, hàng đợi ghép theo từng trường và báo xung đột thay vì ghi đè.
  if (typeof window.__db.casDoc === "function") {
    try {
      const res = await window.__db.casDoc(col, id, cur => {
        if (!cur) throw new Error("Không tìm thấy bản ghi " + col + "/" + id);
        const next = Object.assign({}, mutator(cur) || cur);
        const r2 = amgCheckWrite(window.__AMG_USER, col, "update", id, next);
        if (!r2.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + r2.reason);
        next.version = (cur.version || 0) + 1;
        return next;
      });
      return res.doc;
    } catch (e) {
      if (!e || (e.code !== "network" && e.code !== "no-etag")) throw e; // lỗi nghiệp vụ / xung đột phiên bản / không có quyền → báo cho người dùng
    }
  }
  if (typeof window.__db.runTransaction === "function") {
    return window.__db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!exists(snap)) throw new Error("Không tìm thấy bản ghi " + col + "/" + id);
      const cur = snap.data();
      const next = Object.assign({}, mutator(cur) || cur);
      const r2 = amgCheckWrite(window.__AMG_USER, col, "update", id, next);
      if (!r2.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + r2.reason);
      next.version = (cur.version || 0) + 1;
      next.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      tx.update(ref, next);
      return next;
    });
  }
  // Bản offline (localStorage, một trình duyệt): đọc rồi ghi tuần tự
  const snap = await ref.get();
  if (!exists(snap)) throw new Error("Không tìm thấy bản ghi " + col + "/" + id);
  const cur = snap.data();
  const next = Object.assign({}, mutator(cur) || cur);
  const r2 = amgCheckWrite(window.__AMG_USER, col, "update", id, next);
  if (!r2.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + r2.reason);
  next.version = (cur.version || 0) + 1;
  await ref.update(next);
  return next;
}
