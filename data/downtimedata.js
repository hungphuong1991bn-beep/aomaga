/* ===================== DỮ LIỆU THEO DÕI DỪNG MÁY (v55) =====================
   Nguồn số liệu: productionRuns[].pauses (Kế hoạch sản xuất). File này KHÔNG tạo bộ số liệu thứ hai, chỉ có:
     1) Sổ lịch sử downtimeEvents/{mã sự kiện}: ai tạo, ai xác nhận, ai sửa, trước → sau, hủy/xóa nguồn.
        Ghi TRONG CÙNG giao dịch với thao tác ở Kế hoạch (tạm dừng / tiếp tục / kết thúc / sửa / hủy / xóa đơn)
        → hai nơi không thể lệch nhau, bấm lại nhiều lần không tạo thêm bản ghi (id xác định theo lệnh + số thứ tự).
     2) Sửa / hủy một lần dừng (có lý do, có nhật ký trước/sau).
     3) Ngưỡng cảnh báo theo máy: downtimeSettings/thresholds (chỉ Admin / Quản đốc ghi). */

const AMG_DT_MAX_REV = 40; // giữ tối đa 40 lần chỉnh sửa gần nhất trên mỗi sự kiện

function amgDtPauseView(p) {
  return { reason: (p && p.reason) || "", startAt: (p && p.at) || "", endAt: (p && p.resumedAt) || null, cancelled: !!(p && p.cancelled) };
}
// Ghi/cập nhật MỘT dòng sổ lịch sử trong giao dịch đang mở. action: create | resume | close | edit | cancel | removed
async function amgDtLedgerWrite(ctx, run, order, idx, action, before, after, extra) {
  const snap = amgDtSnapshotFromRun(run, order, idx);
  const cur = await ctx.get(AMG_DT_COLS.events, snap.id);
  const now = amgNowIso(), who = amgWho();
  const rev = (cur && cur.revisions) || [];
  const entry = { ts: now, by: who, action, before: before || null, after: after || null };
  if (extra && extra.note) entry.note = extra.note;
  const doc = Object.assign({}, cur || {}, snap, {
    status: action === "cancel" || action === "removed" ? "cancelled" : "active",
    createdAt: (cur && cur.createdAt) || now, createdBy: (cur && cur.createdBy) || (action === "create" ? who : (run.pauses[idx] && run.pauses[idx].by) || who),
    updatedAt: now, updatedBy: who,
    revisions: rev.concat([entry]).slice(-AMG_DT_MAX_REV)
  }, extra && extra.fields ? extra.fields : {});
  doc.id = snap.id;
  ctx.set(AMG_DT_COLS.events, snap.id, doc);
  return doc;
}

function amgDtCheckOrder(pauses, idx, startMs, endMs, run) {
  if (Number.isNaN(startMs)) throw new Error("Thời điểm bắt đầu dừng không hợp lệ");
  if (endMs !== null && Number.isNaN(endMs)) throw new Error("Thời điểm kết thúc dừng không hợp lệ");
  if (endMs !== null && endMs < startMs) throw new Error("Thời điểm kết thúc phải sau thời điểm bắt đầu");
  const rs = amgMs(run.startedAt);
  if (!Number.isNaN(rs) && startMs < rs) throw new Error("Lần dừng không được bắt đầu trước lúc lệnh bắt đầu chạy");
  const re = amgMs(run.endedAt);
  if (!Number.isNaN(re) && ((endMs !== null && endMs > re) || startMs > re)) throw new Error("Lần dừng không được vượt quá thời điểm kết thúc lệnh");
  if (endMs !== null && endMs > Date.now() + 60000) throw new Error("Thời điểm kết thúc không được ở tương lai");
  pauses.forEach((q, i) => {
    if (i === idx || q.cancelled) return;
    const qs = amgMs(q.at), qr = amgMs(q.resumedAt), qe = Number.isNaN(qr) ? Infinity : qr;
    const e = endMs === null ? Infinity : endMs;
    if (startMs < qe && e > qs) throw new Error(`Trùng thời gian với lần dừng #${i + 1} của cùng lệnh`);
  });
}

/* ---------- Sửa nguyên nhân / thời gian của một lần dừng (tại Kế hoạch sản xuất) ---------- */
// patch: { reason, startAt, endAt } (ISO). Lần dừng đang mở: không đặt endAt (phải bấm "Tiếp tục" ở Kế hoạch).
async function amgFlowEditPause(runId, idx, patch, note) {
  amgFlowRequire("plan", "sửa lần dừng máy");
  const why = String(note || "").trim();
  if (why.length < 3) throw new Error("Vui lòng ghi lý do chỉnh sửa");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    const p = (run.pauses || [])[idx];
    if (!p) throw new Error("Không tìm thấy lần dừng #" + (idx + 1));
    if (p.cancelled) throw new Error("Lần dừng này đã bị hủy — không sửa được");
    const reason = patch.reason === undefined ? p.reason : String(patch.reason || "").trim();
    if (reason.length < 3) throw new Error("Nguyên nhân dừng cần ít nhất 3 ký tự");
    const startAt = patch.startAt === undefined ? p.at : patch.startAt;
    const endAt = patch.endAt === undefined ? (p.resumedAt || null) : patch.endAt;
    if (!p.resumedAt && endAt) throw new Error("Lần dừng đang mở: hãy bấm \"Tiếp tục\" ở Kế hoạch sản xuất để kết thúc, không đặt giờ kết thúc ở đây");
    if (p.resumedAt && !endAt) throw new Error("Lần dừng đã kết thúc: không thể mở lại");
    amgDtCheckOrder(run.pauses, idx, amgMs(startAt), endAt ? amgMs(endAt) : null, run);
    if (reason === p.reason && startAt === p.at && (endAt || null) === (p.resumedAt || null)) return { duplicate: true, run };
    const before = amgDtPauseView(p);
    const np = Object.assign({}, p, { reason, at: startAt, resumedAt: endAt || null, editedAt: amgNowIso(), editedBy: amgWho() });
    const pauses = run.pauses.map((x, i) => (i === idx ? np : x));
    const order = run.orderId ? await ctx.get(FS.orders, run.orderId) : null;
    ctx.set(AMG_FLOW_COLS.runs, runId, { pauses, version: (run.version || 0) + 1 }, true);
    await amgDtLedgerWrite(ctx, Object.assign({}, run, { pauses }), order, idx, "edit", before, amgDtPauseView(np), { note: why });
    amgFlowAudit(ctx, "dt_edit", `Sửa lần dừng ${amgDtEventId(runId, idx)} (máy ${run.machineId}): ${why}`, run.orderId, { machineId: run.machineId, stageKey: run.stageKey, runId, eventId: amgDtEventId(runId, idx) });
    return { run: Object.assign({}, run, { pauses }) };
  });
}

/* ---------- Hủy một lần dừng (nhập nhầm). Không xóa vật lý: giữ bản ghi + lý do để truy xuất ---------- */
async function amgFlowCancelPause(runId, idx, reason) {
  amgFlowRequire("plan", "hủy lần dừng máy");
  const why = String(reason || "").trim();
  if (why.length < 3) throw new Error("Vui lòng ghi lý do hủy");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    const p = (run.pauses || [])[idx];
    if (!p) throw new Error("Không tìm thấy lần dừng #" + (idx + 1));
    if (p.cancelled) return { duplicate: true, run };
    if (!p.resumedAt) throw new Error("Lần dừng đang mở — bấm \"Tiếp tục\" hoặc kết thúc lệnh trước, rồi mới hủy được");
    const np = Object.assign({}, p, { cancelled: true, cancelReason: why, cancelledAt: amgNowIso(), cancelledBy: amgWho() });
    const pauses = run.pauses.map((x, i) => (i === idx ? np : x));
    const order = run.orderId ? await ctx.get(FS.orders, run.orderId) : null;
    ctx.set(AMG_FLOW_COLS.runs, runId, { pauses, version: (run.version || 0) + 1 }, true);
    await amgDtLedgerWrite(ctx, Object.assign({}, run, { pauses }), order, idx, "cancel", amgDtPauseView(p), amgDtPauseView(np), { note: why, fields: { cancelReason: why, cancelledAt: np.cancelledAt, cancelledBy: np.cancelledBy } });
    amgFlowAudit(ctx, "dt_cancel", `Hủy lần dừng ${amgDtEventId(runId, idx)} (máy ${run.machineId}): ${why}`, run.orderId, { machineId: run.machineId, stageKey: run.stageKey, runId, eventId: amgDtEventId(runId, idx) });
    return { run: Object.assign({}, run, { pauses }) };
  });
}

/* ---------- Cài đặt ngưỡng (Admin / Quản đốc) ---------- */
async function amgDtSaveSettings(doc) {
  const u = window.__AMG_USER;
  if (!amgIsPower(u)) throw new Error("Chỉ Quản trị viên / Quản đốc được cài đặt ngưỡng cảnh báo");
  const clean = { id: AMG_DT_SETTINGS_ID, defaults: doc.defaults || {}, machines: doc.machines || {}, updatedAt: amgNowIso(), updatedBy: amgWho() };
  await window.__db.collection(AMG_DT_COLS.settings).doc(AMG_DT_SETTINGS_ID).set(clean);
  try {
    const aid = amgNewKey("AL");
    await window.__db.collection(FS.audit).doc(aid).set({ id: aid, type: "dt_settings", detail: "Cập nhật ngưỡng cảnh báo dừng máy", targetId: AMG_DT_SETTINGS_ID, user: amgWho(), ts: firebase.firestore.FieldValue.serverTimestamp(), date: amgTodayKey() });
  } catch (e) { /* nhật ký lỗi không làm hỏng việc lưu ngưỡng */ }
  return clean;
}

/* ---------- Hook realtime: sổ lịch sử + ngưỡng ---------- */
function useDowntimeData(enabled) {
  const [ledger, setLedger] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return undefined;
    const subs = [];
    const fail = col => e => setError(`Không đọc được "${col}": ${(e && (e.code || e.message)) || e}. Số liệu dừng máy vẫn hiển thị từ Kế hoạch; chỉ thiếu lịch sử chỉnh sửa/ngưỡng — kiểm tra Rules của cơ sở dữ liệu.`);
    try { subs.push(amgSnapDedup(window.__db.collection(AMG_DT_COLS.events), s => { setLedger(s.docs.map(d => Object.assign({ id: d.id }, d.data()))); setError(""); }, fail(AMG_DT_COLS.events))); } catch (e) { fail(AMG_DT_COLS.events)(e); }
    try { subs.push(amgSnapDedup(window.__db.collection(AMG_DT_COLS.settings), s => { const d = s.docs.find(x => x.id === AMG_DT_SETTINGS_ID); setSettings(d ? Object.assign({ id: d.id }, d.data()) : null); }, fail(AMG_DT_COLS.settings))); } catch (e) { fail(AMG_DT_COLS.settings)(e); }
    return () => subs.forEach(u => { try { u && u(); } catch (e) {} });
  }, [enabled]);
  return { ledger, settings, error };
}
