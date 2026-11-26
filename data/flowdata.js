/* ===================== LỚP GHI DỮ LIỆU CỦA LUỒNG SẢN XUẤT (v46) =====================
   Nguyên tắc:
   1) Mọi thay đổi đa tài liệu (đơn + máy + lệnh + lượt sản lượng) nằm trong MỘT giao dịch Firestore
      → hai người thao tác cùng lúc không thể làm trùng lệnh hoặc trùng sản lượng.
   2) Dữ liệu được ĐỌC LẠI trong giao dịch rồi mới kiểm tra/ghi — không tin dữ liệu đang hiện trên màn hình.
   3) Mỗi lượt ghi có khóa chống trùng (id do giao diện sinh một lần khi mở hộp thoại): nhấn Lưu nhiều lần
      chỉ ghi nhận một lần.
   4) Bản offline (localStorage, không có runTransaction): các thao tác được xếp hàng tuần tự trong trình duyệt.
   Sản lượng nằm duy nhất ở order.stages[key].done (cùng nguồn với toàn hệ thống); lượt ghi chi tiết nằm ở
   productionEntries; mỗi lượt cũng được ghi vào auditLog (type "production_entry") với CÙNG id để các báo cáo
   hiện có (Tổng quan, Báo cáo, Chi tiết đơn) tiếp tục đọc đúng. */

const AMG_FLOW_COLS = { runs: "productionRuns", entries: "productionEntries" };
let AMG_FLOW_QUEUE = Promise.resolve();
function amgFlowSerial(fn) {
  const p = AMG_FLOW_QUEUE.then(fn, fn);
  AMG_FLOW_QUEUE = p.catch(() => {});
  return p;
}
const amgR2 = n => Math.round(n * 100) / 100;
const amgNowIso = () => new Date().toISOString();
function amgWho() {
  const u = window.__AMG_USER;
  return (u && (u.fullName || u.username)) || "";
}

// Lệnh còn "sống" theo trạng thái (kể cả lệnh thiếu khóa liên kết — để người có quyền dọn được)
const amgRunIsLive = run => !!run && AMG_RUN_OPEN.indexOf(run.productionStatus) > -1;

/* ---------- Quyền theo chức vụ (dùng chung cho giao diện và giao dịch) ---------- */
function amgFlowCan(user, what) {
  if (!user) return false;
  if (what === "force_delete") return amgIsRoot(user);       // xóa đơn đang sản xuất / đã có lệnh & sản lượng: CHỈ Admin (không gồm Quản đốc)
  if (amgIsPower(user)) return true;                       // Admin, Quản đốc: toàn quyền
  if (what === "plan") return amgCan(user, "s", "dieuhanh");   // Nhân viên: phân máy, bắt đầu/tạm dừng/kết thúc lệnh
  if (what === "output") return amgCan(user, "t", "dieuhanh"); // Nhân viên: ghi sản lượng
  return false;                                              // xác nhận/mở lại đơn ("manager"): chỉ Admin, Quản đốc
}
function amgFlowRequire(what, label) {
  if (!amgFlowCan(window.__AMG_USER, what)) throw new Error(`Bạn không có quyền ${label}. Liên hệ quản đốc hoặc quản trị viên.`);
}

/* ---------- Giao dịch đa tài liệu ---------- */
async function amgFlowTx(fn) {
  const dbx = window.__db;
  const user = window.__AMG_USER;
  const exists = s => (typeof s.exists === "function" ? s.exists() : s.exists);
  const useTx = typeof dbx.runTransaction === "function";
  const body = async tx => {
    const writes = [], cache = {};
    const ctx = {
      get: async (col, id) => {
        const k = col + "/" + id;
        if (k in cache) return cache[k];
        const ref = dbx.collection(col).doc(id);
        const snap = tx ? await tx.get(ref) : await ref.get();
        cache[k] = exists(snap) ? Object.assign({ id }, snap.data()) : null;
        if (cache[k] && col === AMG_FLOW_COLS.runs) cache[k] = amgNormalizeRun(cache[k]); // bản ghi lệnh cũ thiếu trường vẫn đọc đúng
        return cache[k];
      },
      getAll: pairs => Promise.all(pairs.map(pr => (pr ? ctx.get(pr[0], pr[1]) : Promise.resolve(null)))),
      set: (col, id, data, merge) => { writes.push({ op: "set", col, id, data, merge: !!merge }); },
      del: (col, id) => { writes.push({ op: "delete", col, id }); }
    };
    const result = await fn(ctx);
    writes.forEach(w => {
      const r = amgCheckWrite(user, w.col, w.op === "set" ? "set" : "delete", w.id, w.data);
      if (!r.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + r.reason);
    });
    if (tx) {
      writes.forEach(w => {
        const ref = dbx.collection(w.col).doc(w.id);
        if (w.op === "delete") tx.delete(ref);
        else if (w.merge) tx.set(ref, w.data, { merge: true });
        else tx.set(ref, w.data);
      });
    } else {
      const b = dbx.batch();
      writes.forEach(w => {
        const ref = dbx.collection(w.col).doc(w.id);
        if (w.op === "delete") b.delete(ref);
        else if (w.merge) b.set(ref, w.data, { merge: true });
        else b.set(ref, w.data);
      });
      await b.commit();
    }
    return result;
  };
  const run = () => (useTx ? dbx.runTransaction(tx => body(tx)) : body(null));
  // Giao dịch cần kết nối máy chủ. Nếu quá 25 giây chưa xong thì báo lỗi rõ ràng để người dùng thử lại, và không làm kẹt các thao tác sau.
  return amgFlowSerial(() => Promise.race([run().catch(e => { throw amgIsQuotaError(e) ? new Error(AMG_QUOTA_MSG) : e; }), new Promise((_, rej) => setTimeout(() => rej(new Error("Mạng chậm hoặc mất kết nối — chưa lưu được (hệ thống không ghi dở). Kiểm tra mạng rồi bấm lưu lại; nếu đã có lệnh/sản lượng thì sẽ không bị ghi trùng.")), 25000))]));
}
// Nhật ký: thời gian (ts), người thao tác (user), nội dung (detail) + máy/lệnh/công đoạn + trạng thái trước → sau
function amgFlowAudit(ctx, type, detail, targetId, extra) {
  const id = amgNewKey("AL");
  ctx.set(FS.audit, id, Object.assign({ id, type, detail, targetId: targetId || "", user: amgWho(), ts: firebase.firestore.FieldValue.serverTimestamp(), date: amgTodayKey() }, extra || {}));
}
function amgFlowBump(order, patch) {
  return Object.assign({}, patch, { version: (order.version || 0) + 1, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: amgWho() });
}

/* ---------- Phân máy: tạo lệnh sản xuất ---------- */
// p: { runId (khóa chống trùng), orderId, machineId, stageKey, plannedQuantity, shift, operator, team, note, startNow,
//      knownMachineRunIds (các lệnh đang thấy trên màn hình của máy này — được ĐỌC LẠI trong giao dịch để chặn phân trùng
//      kể cả khi khóa máy bị lệch) }
// Dữ liệu ghi thật vào productionRuns (orderId + machineId + stageKey) và khóa machines/{id}.activeRunId trong CÙNG giao dịch.
async function amgFlowAssign(p) {
  amgFlowRequire("plan", "phân máy");
  const orderId = String(p.orderId || "").trim(), machineId = String(p.machineId || "").trim(), stageKey = String(p.stageKey || "").trim();
  if (!orderId || !machineId || !stageKey) throw new Error("Thiếu thông tin: phải có đủ đơn hàng, máy và công đoạn mới tạo được lệnh");
  const planned = amgParseQty(p.plannedQuantity);
  if (!Number.isFinite(planned) || planned <= 0) throw new Error("Số lượng kế hoạch phải là số lớn hơn 0");
  if (!p.shift) throw new Error("Vui lòng chọn ca");
  if (!String(p.operator || "").trim()) throw new Error("Vui lòng nhập người vận hành");
  const runId = p.runId || amgNewKey("RUN");
  return amgFlowTx(async ctx => {
    const [dup, order, machine] = await ctx.getAll([[AMG_FLOW_COLS.runs, runId], [FS.orders, orderId], [FS.machines, machineId]]);
    if (dup) return { duplicate: true, run: dup };
    if (!order) throw new Error("Không tìm thấy đơn hàng " + orderId);
    if (!machine) throw new Error("Không tìm thấy máy " + machineId);
    const okStage = amgStageAssignable(order, stageKey);
    if (!okStage.ok) throw new Error(okStage.reason);
    if (amgMachineStage(machine) !== stageKey) throw new Error(`Máy ${machine.id} không thuộc công đoạn ${amgStageLabel(stageKey)}`);
    if (machine.status === "broken") throw new Error(`Máy ${machine.id} đang HỎNG/DỪNG — không nhận lệnh mới`);
    if (machine.status === "maintenance") throw new Error(`Máy ${machine.id} đang BẢO TRÌ — không nhận lệnh mới`);
    // Các lệnh có thể đang giữ máy: khóa trên máy + các lệnh đang hiển thị trên màn hình (đọc lại bản mới nhất)
    const cand = [];
    if (machine.activeRunId) cand.push(machine.activeRunId);
    (p.knownMachineRunIds || []).forEach(id => { if (id && cand.indexOf(id) < 0) cand.push(id); });
    const curs = await ctx.getAll(cand.map(id => [AMG_FLOW_COLS.runs, id]));
    for (const cur of curs) {
      if (!cur || !amgRunIsLive(cur) || cur.machineId !== machine.id) continue;
      // Bấm lại / mở lại hộp thoại: cùng đơn + cùng công đoạn + cùng máy → không tạo lệnh thứ hai
      if (cur.orderId === order.id && cur.stageKey === stageKey) return { duplicate: true, run: cur };
      throw new Error(`Máy ${machine.id} vừa được phân lệnh ${cur.id} (đơn ${amgOrderLabelById(cur.orderId)}). Làm mới trang rồi chọn máy khác hoặc kết thúc lệnh đó`);
    }
    const now = amgNowIso(), who = amgWho();
    const run = {
      id: runId, orderId: order.id, machineId: machine.id, stageKey,
      plannedQuantity: planned, producedQuantity: 0, ngQuantity: 0, unit: amgOrderUnit(order),
      assignedAt: now, assignedBy: who,
      productionStatus: p.startNow ? "running" : "assigned",
      shift: p.shift, operator: String(p.operator).trim(), team: p.team || "",
      note: p.note || "", startedAt: p.startNow ? now : null, endedAt: null, pauses: [], version: 1
    };
    ctx.set(AMG_FLOW_COLS.runs, runId, run);
    ctx.set(FS.machines, machine.id, { activeRunId: runId }, true);
    // Luôn ghi đơn: duy trì danh sách lệnh mở (openRunIds) và tạo xung đột giao dịch với "Hoàn thành đơn" chạy cùng lúc
    const orderPatch = { openRunIds: (order.openRunIds || []).filter(x => x !== runId).concat([runId]) };
    if (p.startNow && !order.productionStartedAt) orderPatch.productionStartedAt = now;
    ctx.set(FS.orders, order.id, amgFlowBump(order, orderPatch), true);
    amgFlowAudit(ctx, "plan_assign", `Phân đơn ${order.customer || ""} / ${order.spec || ""} vào máy ${machine.id} — công đoạn ${amgStageLabel(stageKey)}, KH ${fmtNum(planned)}`, order.id, { machineId: machine.id, stageKey, runId, fromStatus: "unassigned", toStatus: run.productionStatus });
    return { run };
  });
}

/* ---------- Bắt đầu / tạm dừng / tiếp tục ---------- */
async function amgFlowStart(runId) {
  amgFlowRequire("plan", "bắt đầu lệnh sản xuất");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    if (run.productionStatus === "running") return { duplicate: true, run };
    if (!amgRunHasRefs(run)) throw new Error("Lệnh thiếu thông tin đơn/máy/công đoạn — không bắt đầu được");
    if (run.productionStatus !== "assigned") throw new Error("Chỉ bắt đầu được lệnh ở trạng thái Đã phân máy");
    const [machine, order] = await ctx.getAll([[FS.machines, run.machineId], [FS.orders, run.orderId]]);
    if (!order || order.status === "completed") throw new Error("Đơn hàng không còn ở trạng thái sản xuất");
    if (machine && (machine.status === "broken" || machine.status === "maintenance")) throw new Error(`Máy ${machine.id} đang ${machine.status === "broken" ? "hỏng" : "bảo trì"} — không thể bắt đầu`);
    // Một máy chỉ chạy MỘT lệnh: nếu khóa máy đang thuộc lệnh mở khác thì không cho bắt đầu
    if (machine && machine.activeRunId && machine.activeRunId !== run.id) {
      const other = await ctx.get(AMG_FLOW_COLS.runs, machine.activeRunId);
      if (other && amgRunIsLive(other) && other.machineId === machine.id) throw new Error(`Máy ${machine.id} đang giữ lệnh ${other.id} (${amgRunStatusMeta(other.productionStatus).label}). Kết thúc lệnh đó trước`);
    }
    const now = amgNowIso();
    ctx.set(AMG_FLOW_COLS.runs, runId, { productionStatus: "running", startedAt: now, version: (run.version || 0) + 1 }, true);
    if (machine && machine.activeRunId !== run.id) ctx.set(FS.machines, machine.id, { activeRunId: run.id }, true);
    if (!order.productionStartedAt) ctx.set(FS.orders, order.id, amgFlowBump(order, { productionStartedAt: now }), true);
    amgFlowAudit(ctx, "run_start", `Bắt đầu chạy lệnh ${runId}: đơn ${amgOrderLabelById(run.orderId)} trên máy ${run.machineId}`, run.orderId, { machineId: run.machineId, stageKey: run.stageKey, runId, fromStatus: "assigned", toStatus: "running" });
    return { run: Object.assign({}, run, { productionStatus: "running", startedAt: now }) };
  });
}
async function amgFlowPause(runId, reason) {
  amgFlowRequire("plan", "tạm dừng lệnh");
  const why = String(reason || "").trim();
  if (why.length < 3) throw new Error("Vui lòng ghi lý do tạm dừng");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    if (run.productionStatus === "paused") return { duplicate: true, run };
    if (run.productionStatus !== "running") throw new Error("Chỉ tạm dừng được lệnh đang chạy");
    const pauses = (run.pauses || []).concat([{ at: amgNowIso(), reason: why, by: amgWho(), resumedAt: null }]);
    ctx.set(AMG_FLOW_COLS.runs, runId, { productionStatus: "paused", pauses, version: (run.version || 0) + 1 }, true);
    // v55: sổ lịch sử dừng máy — ghi trong CÙNG giao dịch; mã sự kiện xác định theo lệnh + số thứ tự nên bấm lại không tạo trùng
    const ordP = run.orderId ? await ctx.get(FS.orders, run.orderId) : null;
    await amgDtLedgerWrite(ctx, Object.assign({}, run, { pauses }), ordP, pauses.length - 1, "create", null, amgDtPauseView(pauses[pauses.length - 1]));
    amgFlowAudit(ctx, "run_pause", `Tạm dừng lệnh ${runId} (máy ${run.machineId}): ${why}`, run.orderId, { machineId: run.machineId, stageKey: run.stageKey, runId, fromStatus: "running", toStatus: "paused" });
    return { run };
  });
}
async function amgFlowResume(runId) {
  amgFlowRequire("plan", "tiếp tục lệnh");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    if (run.productionStatus === "running") return { duplicate: true, run };
    if (run.productionStatus !== "paused") throw new Error("Chỉ tiếp tục được lệnh đang tạm dừng");
    const machine = await ctx.get(FS.machines, run.machineId);
    if (machine && (machine.status === "broken" || machine.status === "maintenance")) throw new Error(`Máy ${machine.id} đang ${machine.status === "broken" ? "hỏng" : "bảo trì"} — chưa thể tiếp tục`);
    const pauses = (run.pauses || []).map((x, i, a) => (i === a.length - 1 && !x.resumedAt ? Object.assign({}, x, { resumedAt: amgNowIso(), resumedBy: amgWho() }) : x));
    ctx.set(AMG_FLOW_COLS.runs, runId, { productionStatus: "running", pauses, version: (run.version || 0) + 1 }, true);
    const li = pauses.length - 1;
    if (li >= 0 && (run.pauses || [])[li] && !(run.pauses[li].resumedAt)) {
      const ordR = run.orderId ? await ctx.get(FS.orders, run.orderId) : null;
      await amgDtLedgerWrite(ctx, Object.assign({}, run, { pauses }), ordR, li, "resume", amgDtPauseView(run.pauses[li]), amgDtPauseView(pauses[li]));
    }
    amgFlowAudit(ctx, "run_resume", `Tiếp tục chạy lệnh ${runId} (máy ${run.machineId})`, run.orderId, { machineId: run.machineId, stageKey: run.stageKey, runId, fromStatus: "paused", toStatus: "running" });
    return { run };
  });
}
// Đổi người vận hành / ca / số lượng kế hoạch / ghi chú của lệnh đang mở
async function amgFlowUpdateRun(runId, patch) {
  amgFlowRequire("plan", "sửa lệnh sản xuất");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    if (!amgRunIsLive(run)) throw new Error("Lệnh đã kết thúc, không sửa được");
    const next = {};
    if (patch.operator !== undefined) { if (!String(patch.operator).trim()) throw new Error("Người vận hành không được để trống"); next.operator = String(patch.operator).trim(); }
    if (patch.shift !== undefined) next.shift = patch.shift;
    if (patch.team !== undefined) next.team = patch.team;
    if (patch.note !== undefined) next.note = patch.note;
    if (patch.plannedQuantity !== undefined) {
      const q = amgParseQty(patch.plannedQuantity);
      if (!Number.isFinite(q) || q <= 0) throw new Error("Số lượng kế hoạch phải lớn hơn 0");
      next.plannedQuantity = q;
    }
    next.version = (run.version || 0) + 1;
    ctx.set(AMG_FLOW_COLS.runs, runId, next, true);
    amgFlowAudit(ctx, "run_update", `Cập nhật lệnh ${runId} (máy ${run.machineId})`, run.orderId, { machineId: run.machineId, runId });
    return { run: Object.assign({}, run, next) };
  });
}

/* ---------- Ghi sản lượng (đồng bộ đơn hàng + thẻ máy + kế hoạch) ---------- */
// p: { clientKey (khóa chống trùng, sinh khi mở hộp thoại), runId, orderId, machineId, stageKey, qty, ng, note, confirmWarnings }
async function amgFlowRecordOutput(p) {
  amgFlowRequire("output", "ghi sản lượng");
  if (!p.clientKey) throw new Error("Thiếu khóa chống ghi trùng");
  const qty = typeof p.qty === "number" ? p.qty : amgParseQty(p.qty);
  const ng = p.ng === undefined || p.ng === "" || p.ng === null ? 0 : amgParseQty(p.ng);
  if (!Number.isFinite(ng) || ng < 0) throw new Error("Số lượng NG phải là số không âm");
  const entryId = "ENT-" + String(p.clientKey).replace(/[^A-Za-z0-9_-]/g, "");
  return amgFlowTx(async ctx => {
    // Đọc song song các tài liệu sẽ dùng (lượt trùng, lệnh, đơn, máy) — ctx.get dùng lại kết quả đã đọc
    const [dup] = await ctx.getAll([[AMG_FLOW_COLS.entries, entryId], [AMG_FLOW_COLS.runs, p.runId], p.orderId ? [FS.orders, p.orderId] : null, p.machineId ? [FS.machines, p.machineId] : null]);
    if (dup) return { duplicate: true, entry: dup };
    const run = await ctx.get(AMG_FLOW_COLS.runs, p.runId);
    if (run && !amgRunHasRefs(run)) throw new Error("Lệnh thiếu thông tin đơn/máy/công đoạn — không ghi sản lượng được. Nhờ quản trị xử lý ở bảng Kiểm tra dữ liệu lệnh");
    const order = run ? await ctx.get(FS.orders, run.orderId) : null;
    const machine = run ? await ctx.get(FS.machines, run.machineId) : null;
    const v = amgValidateOutput({ order, run, machine, qty, orderId: p.orderId, machineId: p.machineId, stageKey: p.stageKey });
    if (v.errors.length) throw new Error(v.errors.join("\n"));
    if (v.warnings.length && !p.confirmWarnings) { const e = new Error(v.warnings.join("\n")); e.code = "needs-confirm"; throw e; }
    const st = (order.stages && order.stages[run.stageKey]) || { done: 0, remain: 0 };
    const newDone = amgR2((st.done || 0) + qty);
    const updated = normalizeOrderStages(Object.assign({}, order, { stages: Object.assign({}, order.stages, { [run.stageKey]: { done: newDone, remain: computeStageRemain(order.quantity, newDone) ?? 0 } }) }));
    const now = amgNowIso();
    const entry = {
      id: entryId, clientKey: p.clientKey, runId: run.id, orderId: order.id, machineId: run.machineId, stageKey: run.stageKey,
      qty, ng, unit: run.unit || amgOrderUnit(order), shift: run.shift || "", operator: run.operator || "", enteredBy: amgWho(), enteredAt: now,
      note: p.note || "", stageDoneAfter: newDone, voided: false
    };
    ctx.set(AMG_FLOW_COLS.entries, entryId, entry);
    ctx.set(AMG_FLOW_COLS.runs, run.id, { producedQuantity: amgR2((run.producedQuantity || 0) + qty), ngQuantity: amgR2((run.ngQuantity || 0) + ng), version: (run.version || 0) + 1 }, true);
    ctx.set(FS.orders, order.id, amgFlowBump(order, { stages: updated.stages, finishedDone: updated.finishedDone, finishedShort: updated.finishedShort }), true);
    // Cùng id với lượt ghi → báo cáo/lịch sử cũ đọc được và việc sửa/xóa đồng bộ về lệnh
    ctx.set(FS.audit, entryId, {
      id: entryId, type: "production_entry", stageKey: run.stageKey, qty, materialCode: order.materialCode || "Khác",
      customer: order.customer || "", spec: order.spec || "", date: amgTodayKey(), note: p.note || "", targetId: order.id,
      runId: run.id, machineId: run.machineId, shift: run.shift || "", operator: run.operator || "", ng, unit: run.unit || amgOrderUnit(order),
      detail: `Nhập ${fmtNum(qty)} cho công đoạn "${amgStageLabel(run.stageKey)}" — máy ${run.machineId} — đơn ${order.customer || ""} / ${order.spec || ""}${p.note ? " · " + p.note : ""}`,
      user: amgWho(), ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { entry, stageDone: newDone, warnings: v.warnings };
  });
}

/* ---------- Kết thúc lệnh (giải phóng máy) ± hoàn thành công đoạn ± hoàn thành đơn ---------- */
// p: { runId, completeStage (bool), shortReason, note, knownSiblingRunIds }
// Ba việc TÁCH BẠCH:
//   A. Kết thúc lệnh máy      : giải phóng máy, lưu thời gian kết thúc, đóng lần tạm dừng còn mở. Không đụng trạng thái đơn.
//   B. Hoàn thành công đoạn   : (tùy chọn) ghi stageComplete[key]; yêu cầu không còn lệnh mở khác của cùng công đoạn.
//   C. Hoàn thành đơn         : KHÔNG làm ở đây. Hàm chỉ báo readyToComplete; người có quyền bấm HOÀN THÀNH ĐƠN (amgFlowCompleteOrder).
async function amgFlowFinishRun(p) {
  amgFlowRequire("plan", "kết thúc lệnh sản xuất");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, p.runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + p.runId);
    if (run.productionStatus === "completed") return { duplicate: true, run };
    if (!amgRunIsLive(run)) throw new Error("Lệnh đã bị hủy hoặc đã kết thúc");
    const order = run.orderId ? await ctx.get(FS.orders, run.orderId) : null;
    const machine = run.machineId ? await ctx.get(FS.machines, run.machineId) : null;
    if (!order && p.completeStage) throw new Error("Không tìm thấy đơn hàng của lệnh — chỉ kết thúc lệnh (bỏ chọn Hoàn thành công đoạn) để giải phóng máy");
    // Các lệnh mở khác của đơn (đọc lại trong giao dịch): từ openRunIds + các lệnh giao diện đang thấy
    const otherLive = [];
    if (order) {
      const ids = [];
      (order.openRunIds || []).concat(p.knownSiblingRunIds || []).forEach(id => { if (id && id !== run.id && ids.indexOf(id) < 0) ids.push(id); });
      for (const id of ids) { const r = await ctx.get(AMG_FLOW_COLS.runs, id); if (r && amgRunIsLive(r) && r.orderId === order.id) otherLive.push(r); }
    }
    if (p.completeStage && otherLive.some(r => r.stageKey === run.stageKey)) {
      throw new Error(`Công đoạn ${amgStageLabel(run.stageKey)} còn lệnh đang mở trên máy ${otherLive.filter(r => r.stageKey === run.stageKey).map(r => r.machineId).join(", ")}. Kết thúc các lệnh đó trước hoặc bỏ chọn Hoàn thành công đoạn`);
    }
    const now = amgNowIso(), who = amgWho();
    // Đóng lần tạm dừng đang mở (nếu kết thúc khi đang tạm dừng) để thời gian tạm dừng/thực tế luôn chính xác
    const pauses = (run.pauses || []).map(x => (x.resumedAt ? x : Object.assign({}, x, { resumedAt: now, closedByFinish: true, resumedBy: who })));
    for (let i = 0; i < pauses.length; i++) {
      if (!(run.pauses[i] && run.pauses[i].resumedAt)) await amgDtLedgerWrite(ctx, Object.assign({}, run, { pauses }), order, i, "close", amgDtPauseView(run.pauses[i]), amgDtPauseView(pauses[i]), { note: "Đóng khi kết thúc lệnh" });
    }
    const tm = amgRunTiming(Object.assign({}, run, { pauses, endedAt: now, productionStatus: "completed" }), Date.parse(now), order);
    const patch = {
      productionStatus: "completed", endedAt: now, endedBy: who, closeNote: p.note || "", version: (run.version || 0) + 1, pauses,
      finalTiming: { elapsedMs: tm.elapsedMs, pausedMs: tm.pausedMs, netMs: tm.netMs, ratePerHour: tm.ratePerHour },
      snapshot: order ? { customer: order.customer || "", spec: order.spec || "", materialCode: order.materialCode || "", orderQuantity: order.quantity ?? null, unit: amgOrderUnit(order), stageDoneAtClose: amgStageDone(order, run.stageKey) } : (run.snapshot || {})
    };
    ctx.set(AMG_FLOW_COLS.runs, run.id, patch, true);
    if (machine && machine.activeRunId === run.id) ctx.set(FS.machines, machine.id, { activeRunId: null, lastRunId: run.id }, true);
    let stageCompleted = false, readyToComplete = false;
    if (order) {
      const orderPatch = { openRunIds: (order.openRunIds || []).filter(id => id !== run.id) };
      let probe = order;
      if (p.completeStage) {
        const q = amgStageQty(order), done = amgStageDone(order, run.stageKey);
        const short = q !== null && done < q * AMG_STAGE_SHORT_TOL;
        if (short && String(p.shortReason || "").trim().length < 3) throw new Error(`Sản lượng ${amgStageLabel(run.stageKey)} (${fmtNum(done)}) chưa đủ số lượng đặt (${fmtNum(q)}). Ghi lý do nếu vẫn hoàn thành công đoạn`);
        orderPatch.stageComplete = Object.assign({}, order.stageComplete || {}, { [run.stageKey]: { at: now, by: who, runId: run.id, short, reason: short ? String(p.shortReason).trim() : "", doneAtClose: done } });
        probe = Object.assign({}, order, { stageComplete: orderPatch.stageComplete });
        stageCompleted = true;
      }
      const rd = amgOrderReadiness(probe);
      readyToComplete = order.status !== "completed" && amgIsFlowOrder(order) && rd.allStages && otherLive.length === 0;
      ctx.set(FS.orders, order.id, amgFlowBump(order, orderPatch), true);
    }
    amgFlowAudit(ctx, "run_finish", `Kết thúc lệnh ${run.id} (máy ${run.machineId}, ${amgStageLabel(run.stageKey)}, đã chạy ${fmtNum(run.producedQuantity || 0)} ${run.unit || "kg"})${stageCompleted ? " — hoàn thành công đoạn" : ""}${readyToComplete ? " — đơn đủ điều kiện, chờ xác nhận hoàn thành" : ""}`, run.orderId, { machineId: run.machineId, stageKey: run.stageKey, runId: run.id, fromStatus: run.productionStatus, toStatus: "completed" });
    return { run: Object.assign({}, run, patch), stageCompleted, readyToComplete, orderCompleted: false };
  });
}
async function amgFlowCancelRun(runId, reason) {
  amgFlowRequire("plan", "hủy lệnh sản xuất");
  const why = String(reason || "").trim();
  if (why.length < 3) throw new Error("Vui lòng ghi lý do hủy lệnh");
  return amgFlowTx(async ctx => {
    const run = await ctx.get(AMG_FLOW_COLS.runs, runId);
    if (!run) throw new Error("Không tìm thấy lệnh " + runId);
    if (run.productionStatus === "cancelled") return { duplicate: true, run };
    if (!amgRunIsLive(run)) throw new Error("Lệnh đã kết thúc, không hủy được");
    if ((run.producedQuantity || 0) > 0) throw new Error("Lệnh đã có sản lượng ghi nhận — hãy Kết thúc lệnh thay vì Hủy để giữ dữ liệu sản xuất");
    const machine = run.machineId ? await ctx.get(FS.machines, run.machineId) : null;
    const ord = run.orderId ? await ctx.get(FS.orders, run.orderId) : null;
    if (ord) ctx.set(FS.orders, ord.id, amgFlowBump(ord, { openRunIds: (ord.openRunIds || []).filter(id => id !== runId) }), true);
    ctx.set(AMG_FLOW_COLS.runs, runId, { productionStatus: "cancelled", endedAt: amgNowIso(), endedBy: amgWho(), closeNote: why, version: (run.version || 0) + 1 }, true);
    if (machine && machine.activeRunId === runId) ctx.set(FS.machines, machine.id, { activeRunId: null }, true);
    amgFlowAudit(ctx, "run_cancel", `Hủy lệnh ${runId} (máy ${run.machineId || "?"}, đơn ${run.orderId || "?"}): ${why}`, run.orderId, { machineId: run.machineId, runId, fromStatus: run.productionStatus, toStatus: "cancelled" });
    return { run };
  });
}

/* ---------- Đồng bộ lại khóa máy (activeRunId) từ lệnh thật ----------
   Không tạo/xóa/sửa lệnh. Chỉ đặt machines/{id}.activeRunId = lệnh mở hợp lệ duy nhất của máy (ưu tiên đang chạy > tạm dừng > đã phân),
   hoặc null nếu máy không còn lệnh mở. candidateRunIds = các lệnh đang thấy trên màn hình; được đọc lại trong giao dịch. */
async function amgFlowRelockMachine(machineId, candidateRunIds) {
  amgFlowRequire("plan", "đồng bộ khóa máy");
  return amgFlowTx(async ctx => {
    const machine = await ctx.get(FS.machines, machineId);
    if (!machine) throw new Error("Không tìm thấy máy " + machineId);
    const ids = []; (candidateRunIds || []).concat(machine.activeRunId ? [machine.activeRunId] : []).forEach(id => { if (id && ids.indexOf(id) < 0) ids.push(id); });
    const live = [];
    for (const id of ids) { const r = await ctx.get(AMG_FLOW_COLS.runs, id); if (r && amgIsOpenRun(r) && r.machineId === machineId) live.push(r); }
    const keep = amgSortOpenRuns(live)[0] || null;
    const next = keep ? keep.id : null;
    if ((machine.activeRunId || null) === next) return { unchanged: true, activeRunId: next };
    ctx.set(FS.machines, machineId, { activeRunId: next }, true);
    amgFlowAudit(ctx, "machine_relock", `Đồng bộ khóa máy ${machineId}: ${machine.activeRunId || "trống"} → ${next || "trống"}`, machineId, { machineId, runId: next || "", fromStatus: machine.activeRunId || "", toStatus: next || "" });
    return { activeRunId: next };
  });
}

/* ---------- HOÀN THÀNH ĐƠN / MỞ LẠI ĐƠN (v52) ----------
   Một thao tác duy nhất: người có quyền bấm HOÀN THÀNH ĐƠN ở Kế hoạch/Điều hành → kiểm tra điều kiện → đơn chuyển status = "completed"
   NGAY, không có trạng thái trung gian "chờ xác nhận", không có hộp xác nhận lần hai.
   Chỉ MỘT tài liệu đơn được đổi (orders/{id}) bằng ghi có điều kiện (casDoc, so ETag) nên:
     - bấm nhiều lần / hai thiết bị cùng bấm: chỉ một lần thắng, lần còn lại nhận { duplicate: true } và KHÔNG ghi đè completedAt/completedBy;
     - dữ liệu đọc lại từ máy chủ ngay trước khi ghi, không tin màn hình.
   KHÔNG xóa đơn, lệnh, sản lượng, BOM, lịch sử. Kết thúc lệnh máy ≠ hoàn thành công đoạn ≠ hoàn thành đơn: không bao giờ tự gọi hàm này. */
function amgOrderCompletionRuns(allRuns, orderId) { return (allRuns || []).map(amgNormalizeRun).filter(r => r.orderId === orderId); }
async function amgFlowCompleteOrderCas({ orderId, reason, knownRunIds, source }) {
  amgFlowRequire("manager", "hoàn thành đơn hàng");
  const dbx = window.__db;
  if (!dbx || typeof dbx.casDoc !== "function") return amgFlowCompleteOrderTx({ orderId, reason, knownRunIds });
  const user = window.__AMG_USER;
  const why = String(reason || "").trim();
  return amgFlowSerial(async () => {
    const snapRuns = await dbx.collection(AMG_FLOW_COLS.runs).get();
    const allRuns = snapRuns.docs.map(d => Object.assign({ id: d.id }, d.data()));
    let outcome = null;
    const res = await dbx.casDoc(FS.orders, orderId, async cur => {
      outcome = null;
      if (!cur) throw new Error("Không tìm thấy đơn hàng");
      const order = Object.assign({ id: orderId }, cur);
      if (order.status === "completed") { outcome = { duplicate: true, order }; return null; }
      const mine = amgOrderCompletionRuns(allRuns, order.id);
      const live = mine.filter(r => amgRunIsLive(r));
      (order.openRunIds || []).concat(knownRunIds || []).forEach(id => { if (id && !mine.some(r => r.id === id)) { const r = allRuns.find(x => x.id === id); if (r && r.orderId === order.id && amgRunIsLive(amgNormalizeRun(r)) && !live.some(x => x.id === id)) live.push(amgNormalizeRun(r)); } });
      if (live.length) throw new Error(`Đơn còn lệnh sản xuất đang mở trên máy ${live.map(r => r.machineId).join(", ")}. Kết thúc lệnh trước khi hoàn thành đơn`);
      const rd = amgOrderReadiness(order);
      const legacy = !amgIsFlowOrder(order);
      if (!legacy && !rd.allStages) throw new Error("Chưa hoàn thành các công đoạn bắt buộc: " + rd.missing.map(amgStageLabel).join(", "));
      const short = !rd.qtyMet;
      if (short && why.length < 5) throw new Error(`Thành phẩm (${fmtNum(rd.finished)}) chưa đủ số lượng đặt (${fmtNum(rd.qty)}). Ghi lý do (ít nhất 5 ký tự) để hoàn thành thiếu số lượng`);
      const now = amgNowIso(), who = amgWho();
      const machinesUsed = []; mine.forEach(r => { if (r.machineId && machinesUsed.indexOf(r.machineId) < 0) machinesUsed.push(r.machineId); });
      const summary = { finished: rd.finished, qty: rd.qty, unit: amgOrderUnit(order), short, route: rd.route, machines: machinesUsed, runCount: mine.length };
      const history = (order.statusHistory || []).concat([{ at: now, by: who, action: "complete", mode: "manual", source: source || "plan", reason: why, short, finished: rd.finished, qty: rd.qty }]);
      const patch = amgFlowBump(order, { status: "completed", completedAt: now, completedBy: who, completionMode: "manual", completionSource: source || "plan", completionNote: why, completedShort: short, completionSummary: summary, openRunIds: [], statusHistory: history });
      const next = Object.assign({}, cur, patch);
      const chk = amgCheckWrite(user, FS.orders, "set", order.id, next);
      if (!chk.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + chk.reason);
      outcome = { order: next, short, rd, summary };
      return next;
    });
    if (outcome && outcome.duplicate) return { duplicate: true, order: outcome.order };
    if (!res.committed || !outcome) throw new Error("Không hoàn thành được đơn — hãy tải lại rồi thử lại");
    // Nhật ký (ghi sau khi đơn đã chuyển trạng thái; mất nhật ký không làm sai trạng thái đơn)
    const o = outcome.order, rd = outcome.rd;
    const pend = []; const ctx = { set: (c, i, d) => pend.push([c, i, d]) };
    amgFlowAudit(ctx, "order_complete", `Hoàn thành đơn ${o.customer || ""} / ${o.spec || ""} — thành phẩm ${fmtNum(rd.finished)}/${fmtNum(rd.qty)} ${amgOrderUnit(o)}${outcome.short ? " — THIẾU SỐ LƯỢNG: " + (o.completionNote || "") : ""}`, o.id, { mode: "manual", source: source || "plan" });
    const b = dbx.batch(); pend.forEach(([c, i, d]) => b.set(dbx.collection(c).doc(i), d)); await b.commit();
    return { order: o, retries: res.retries };
  });
}
// Lớp bọc: ưu tiên ghi có điều kiện (ETag). Nếu máy chủ/trình duyệt không cung cấp ETag (CORS không công khai header) thì tự lùi về
// đường giao dịch cũ MỘT lần và nhớ lại — nghiệp vụ vẫn chạy, chỉ yếu hơn về chống ghi đồng thời giữa các thiết bị (xem tài liệu).
async function amgCasOrFallback(cas, fallback) {
  if (window.__amgNoCas) return fallback();
  try { return await cas(); }
  catch (e) { if (e && e.code === "no-etag") { window.__amgNoCas = true; try { console.warn("[AMG] Không có ETag — dùng đường giao dịch dự phòng"); } catch (x) {} return fallback(); } throw e; }
}
function amgFlowCompleteOrder(p) { return amgCasOrFallback(() => amgFlowCompleteOrderCas(p), () => amgFlowCompleteOrderTx({ orderId: p.orderId, reason: p.reason, knownRunIds: p.knownRunIds })); }
function amgFlowReopenOrder(p) { return amgCasOrFallback(() => amgFlowReopenOrderCas(p), () => amgFlowReopenOrderTx({ orderId: p.orderId, reason: p.reason })); }
// Hoàn thành đơn MỘT BƯỚC dùng chung cho Kế hoạch sản xuất và Điều hành sản xuất (giao diện chỉ việc hiển thị kết quả):
//   blocked → còn lệnh mở / thiếu công đoạn (kèm lý do) · need_reason → thiếu số lượng, cần ghi lý do · done / duplicate → đã chuyển sang Đơn hàng hoàn thành.
async function amgCompleteOrderOneStep(order, runs, opts) {
  const cs = amgOrderCompletionState(order, runs);
  if (cs.blockers.length) return { status: "blocked", blockers: cs.blockers };
  if (cs.short) return { status: "need_reason", cs };
  const r = await amgFlowCompleteOrder({ orderId: order.id, knownRunIds: cs.open.map(x => x.id), source: (opts && opts.source) || "plan" });
  return { status: r.duplicate ? "duplicate" : "done", result: r };
}
async function amgFlowReopenOrderCas({ orderId, reason }) {
  amgFlowRequire("manager", "mở lại đơn hàng");
  const why = String(reason || "").trim();
  if (why.length < 5) throw new Error("Bắt buộc ghi lý do mở lại đơn (tối thiểu 5 ký tự)");
  const dbx = window.__db;
  if (!dbx || typeof dbx.casDoc !== "function") return amgFlowReopenOrderTx({ orderId, reason });
  const user = window.__AMG_USER;
  return amgFlowSerial(async () => {
    let outcome = null;
    const res = await dbx.casDoc(FS.orders, orderId, async cur => {
      if (!cur) throw new Error("Không tìm thấy đơn hàng");
      const order = Object.assign({ id: orderId }, cur);
      if (order.status !== "completed") throw new Error("Đơn này chưa ở trạng thái hoàn thành (có thể đã được người khác mở lại)");
      const now = amgNowIso();
      const route = amgOrderRoute(order);
      const last = route[route.length - 1];
      const sc = Object.assign({}, order.stageComplete || {});
      if (last) delete sc[last];
      // BOM, định mức, lệnh, sản lượng KHÔNG bị đụng tới: đơn quay lại các danh sách đang hoạt động cùng toàn bộ dữ liệu cũ
      const history = (order.statusHistory || []).concat([{ at: now, by: amgWho(), action: "reopen", reason: why, completedAt: order.completedAt || null, completedBy: order.completedBy || null, completionMode: order.completionMode || null, completionNote: order.completionNote || "" }]);
      const patch = amgFlowBump(order, { status: "reopened", lastCompletedAt: order.completedAt || null, lastCompletedBy: order.completedBy || null, lastCompletionSummary: order.completionSummary || null, completedAt: null, completedBy: null, completionMode: null, completionSource: null, completionNote: "", completedShort: false, completionSummary: null, stageComplete: sc, statusHistory: history });
      const next = Object.assign({}, cur, patch);
      const chk = amgCheckWrite(user, FS.orders, "set", order.id, next);
      if (!chk.ok) throw new Error("Bạn không có quyền thực hiện thao tác này: " + chk.reason);
      outcome = next;
      return next;
    });
    const o = outcome;
    const pend = []; const ctx = { set: (c, i, d) => pend.push([c, i, d]) };
    amgFlowAudit(ctx, "order_reopen", `Mở lại đơn ${o.customer || ""} / ${o.spec || ""}. Lý do: ${why}`, o.id, { reason: why });
    const b = dbx.batch(); pend.forEach(([c, i, d]) => b.set(dbx.collection(c).doc(i), d)); await b.commit();
    return { order: o, retries: res.retries };
  });
}

/* ---------- (Dự phòng) bản giao dịch nhiều tài liệu — chỉ dùng khi lớp dữ liệu KHÔNG có casDoc ----------
   Hoàn thành đơn chỉ đổi order.status (+ metadata) trong MỘT giao dịch trên đúng một tài liệu đơn. KHÔNG xóa đơn, lệnh, sản lượng, BOM.
   Các tab đang hoạt động lọc theo status; tab Đơn hàng hoàn thành đọc cùng collection orders → không có bản sao để trùng lặp. */
async function amgFlowCompleteOrderTx({ orderId, reason, knownRunIds }) {
  amgFlowRequire("manager", "xác nhận hoàn thành đơn");
  return amgFlowTx(async ctx => {
    const order = await ctx.get(FS.orders, orderId);
    if (!order) throw new Error("Không tìm thấy đơn hàng");
    if (order.status === "completed") return { duplicate: true, order };
    // Không hoàn thành khi còn lệnh mở: đọc lại từng lệnh trong giao dịch
    const ids = [];
    (order.openRunIds || []).concat(knownRunIds || []).forEach(id => { if (id && ids.indexOf(id) < 0) ids.push(id); });
    const live = [];
    for (const id of ids) { const r = await ctx.get(AMG_FLOW_COLS.runs, id); if (r && amgRunIsLive(r) && r.orderId === order.id) live.push(r); }
    if (live.length) throw new Error(`Đơn còn lệnh sản xuất đang mở trên máy ${live.map(r => r.machineId).join(", ")}. Kết thúc lệnh trước khi hoàn thành đơn`);
    const rd = amgOrderReadiness(order);
    const legacy = !amgIsFlowOrder(order);
    if (!legacy && !rd.allStages) throw new Error("Chưa hoàn thành các công đoạn bắt buộc: " + rd.missing.map(amgStageLabel).join(", "));
    const why = String(reason || "").trim();
    const short = !rd.qtyMet;
    if (short && why.length < 5) throw new Error(`Thành phẩm (${fmtNum(rd.finished)}) chưa đủ số lượng đặt (${fmtNum(rd.qty)}). Ghi lý do (ít nhất 5 ký tự) để xác nhận hoàn thành thiếu số lượng`);
    const now = amgNowIso(), who = amgWho();
    const summary = { finished: rd.finished, qty: rd.qty, unit: amgOrderUnit(order), short, route: rd.route };
    const history = (order.statusHistory || []).concat([{ at: now, by: who, action: "complete", mode: "manual", reason: why, short, finished: rd.finished, qty: rd.qty }]);
    ctx.set(FS.orders, order.id, amgFlowBump(order, { status: "completed", completedAt: now, completedBy: who, completionMode: "manual", completionNote: why, completedShort: short, completionSummary: summary, openRunIds: [], statusHistory: history }), true);
    amgFlowAudit(ctx, "order_complete", `Xác nhận hoàn thành đơn ${order.customer || ""} / ${order.spec || ""} — thành phẩm ${fmtNum(rd.finished)}/${fmtNum(rd.qty)} ${amgOrderUnit(order)}${short ? " — THIẾU SỐ LƯỢNG: " + why : ""}`, order.id, { mode: "manual" });
    return { order };
  });
}
async function amgFlowReopenOrderTx({ orderId, reason }) {
  amgFlowRequire("manager", "mở lại đơn hàng");
  const why = String(reason || "").trim();
  if (why.length < 5) throw new Error("Bắt buộc ghi lý do mở lại đơn (tối thiểu 5 ký tự)");
  return amgFlowTx(async ctx => {
    const order = await ctx.get(FS.orders, orderId);
    if (!order) throw new Error("Không tìm thấy đơn hàng");
    if (order.status !== "completed") throw new Error("Đơn này chưa ở trạng thái hoàn thành");
    const now = amgNowIso();
    const route = amgOrderRoute(order);
    const last = route[route.length - 1];
    const sc = Object.assign({}, order.stageComplete || {});
    if (last) delete sc[last];
    // BOM, định mức, lệnh, sản lượng KHÔNG bị đụng tới: đơn quay lại các danh sách đang hoạt động cùng toàn bộ dữ liệu cũ
    const history = (order.statusHistory || []).concat([{ at: now, by: amgWho(), action: "reopen", reason: why, completedAt: order.completedAt || null, completedBy: order.completedBy || null, completionMode: order.completionMode || null, completionNote: order.completionNote || "" }]);
    ctx.set(FS.orders, order.id, amgFlowBump(order, { status: "reopened", lastCompletedAt: order.completedAt || null, lastCompletedBy: order.completedBy || null, lastCompletionSummary: order.completionSummary || null, completedAt: null, completedBy: null, completionMode: null, completionNote: "", completedShort: false, completionSummary: null, stageComplete: sc, statusHistory: history }), true);
    amgFlowAudit(ctx, "order_reopen", `Mở lại đơn ${order.customer || ""} / ${order.spec || ""}. Lý do: ${why}`, order.id, { reason: why });
    return { order };
  });
}

/* ---------- Sửa / hủy lượt sản lượng của lệnh (được gọi từ Báo cáo & Chi tiết đơn) ---------- */
async function amgFlowCorrectEntry({ entryId, newQty, mode, reason }) {
  const u = window.__AMG_USER;
  if (!amgIsPower(u)) throw new Error("Chỉ Admin hoặc Quản đốc được sửa/xóa lượt sản lượng");
  return amgFlowTx(async ctx => {
    const entry = await ctx.get(AMG_FLOW_COLS.entries, entryId);
    if (!entry) throw new Error("Không tìm thấy lượt sản lượng " + entryId);
    if (entry.voided) return { duplicate: true };
    const order = await ctx.get(FS.orders, entry.orderId);
    const run = await ctx.get(AMG_FLOW_COLS.runs, entry.runId);
    if (!order) throw new Error("Không tìm thấy đơn hàng");
    if (order.status === "completed") throw new Error("Đơn đã hoàn thành — mở lại đơn trước khi sửa sản lượng");
    const oldQ = Number(entry.qty) || 0;
    const nq = mode === "void" ? 0 : amgParseQty(newQty);
    if (mode !== "void" && (!Number.isFinite(nq) || nq <= 0)) throw new Error("Sản lượng mới phải lớn hơn 0");
    const delta = amgR2(nq - oldQ);
    const st = (order.stages && order.stages[entry.stageKey]) || { done: 0 };
    const nd = Math.max(0, amgR2((st.done || 0) + delta));
    const updated = normalizeOrderStages(Object.assign({}, order, { stages: Object.assign({}, order.stages, { [entry.stageKey]: { done: nd, remain: computeStageRemain(order.quantity, nd) ?? 0 } }) }));
    ctx.set(FS.orders, order.id, amgFlowBump(order, { stages: updated.stages, finishedDone: updated.finishedDone, finishedShort: updated.finishedShort }), true);
    if (run) ctx.set(AMG_FLOW_COLS.runs, run.id, { producedQuantity: Math.max(0, amgR2((run.producedQuantity || 0) + delta)), version: (run.version || 0) + 1 }, true);
    const edits = (entry.edits || []).concat([{ at: amgNowIso(), by: amgWho(), from: oldQ, to: nq, mode: mode || "edit", reason: reason || "" }]);
    if (mode === "void") {
      ctx.set(AMG_FLOW_COLS.entries, entryId, { voided: true, voidedAt: amgNowIso(), voidedBy: amgWho(), voidReason: reason || "", edits }, true);
      ctx.del(FS.audit, entryId);
      amgFlowAudit(ctx, "production_entry_delete", `Hủy lượt sản lượng ${entryId}: ${fmtNum(oldQ)} tại "${amgStageLabel(entry.stageKey)}" máy ${entry.machineId}`, entry.orderId, {});
    } else {
      ctx.set(AMG_FLOW_COLS.entries, entryId, { qty: nq, edits }, true);
      ctx.set(FS.audit, entryId, { qty: nq, detail: `Nhập ${fmtNum(nq)} cho công đoạn "${amgStageLabel(entry.stageKey)}" — máy ${entry.machineId} (đã chỉnh sửa)` }, true);
      amgFlowAudit(ctx, "production_entry_edit", `Chỉnh lượt sản lượng ${entryId}: ${fmtNum(oldQ)} → ${fmtNum(nq)}`, entry.orderId, {});
    }
    return { stageDone: nd };
  });
}

/* ---------- Ghi trực tiếp vào đơn (Tổng quan & Nhập liệu cũ) nhưng AN TOÀN khi nhiều người cùng ghi ---------- */
// Thay thế cách ghi cũ (ghi đè cả danh sách đơn từ dữ liệu đang hiện trên màn hình) bằng một giao dịch trên đúng một đơn.
async function amgFlowAddStageQty({ orderId, stageKey, qty, wireFinishPatch }) {
  return amgFlowTx(async ctx => {
    const order = await ctx.get(FS.orders, orderId);
    if (!order) throw new Error("Không tìm thấy đơn hàng");
    if (order.status === "completed") throw new Error("Đơn đã hoàn thành — mở lại đơn trước khi ghi thêm sản lượng");
    const st = (order.stages && order.stages[stageKey]) || { done: 0, remain: 0 };
    const nd = amgR2((st.done || 0) + qty);
    let next = Object.assign({}, order, { stages: Object.assign({}, order.stages, { [stageKey]: { done: nd, remain: computeStageRemain(order.quantity, nd) ?? 0 } }) }, wireFinishPatch || {});
    next = normalizeOrderStages(next);
    const patch = { stages: next.stages, finishedDone: next.finishedDone, finishedShort: next.finishedShort };
    if (wireFinishPatch && wireFinishPatch.wireFinish) patch.wireFinish = wireFinishPatch.wireFinish;
    ctx.set(FS.orders, order.id, amgFlowBump(order, patch), true);
    return { order: next };
  });
}

/* ---------- Hook: theo dõi lệnh sản xuất và lượt sản lượng ----------
   - Mọi màn hình dùng CHUNG một danh sách lệnh đã chuẩn hóa (amgNormalizeRun) → trạng thái luôn thống nhất.
   - Lỗi đọc (ví dụ Security Rules chặn productionRuns) KHÔNG còn bị nuốt im lặng: trả về error để giao diện báo rõ,
     tránh tình trạng "đã phân máy nhưng mọi nơi vẫn hiện chưa phân". */
/* ---------- XÓA ĐƠN KỂ CẢ ĐANG SẢN XUẤT (v53, chỉ Admin) ----------
   Dùng khi đơn đã có lệnh máy / sản lượng (đường xóa thường bị chặn để bảo toàn dữ liệu). MỘT lượt ghi nguyên tử (cùng cơ chế amgFlowTx):
     1. Xóa đơn orders/{id}.
     2. Xóa MỌI lệnh productionRuns của đơn (đang chạy, tạm dừng, đã phân, đã kết thúc, đã hủy).
     3. Giải phóng khóa máy: machines/{id}.activeRunId của các lệnh bị xóa → chuyển sang lệnh mở kế tiếp của máy (đơn khác) hoặc để trống.
     4. Xóa các lượt sản lượng productionEntries của đơn và bản sao cùng id trong auditLog (để báo cáo/Tổng quan không còn cộng sản lượng của đơn đã xóa).
     5. Ghi nhật ký "order_force_delete" (ai, lúc nào, lý do, ảnh chụp tóm tắt đơn/lệnh/sản lượng) — dòng nhật ký này KHÔNG bao giờ bị xóa theo.
   KHÔNG đụng: phiếu kho, phiếu kiểm tra, phiếu NG, kế hoạch ngày... (bản ghi của phân hệ khác; bảng Kiểm tra dữ liệu sẽ nhắc tham chiếu mồ côi).
   Đơn đã hoàn thành (kho lưu trữ) vẫn không xóa được ở đây: phải mở lại đơn trước. */
async function amgFlowForceDeleteOrder({ orderId, reason, allRuns }) {
  amgFlowRequire("force_delete", "xóa đơn đang sản xuất (chỉ Admin)");
  const why = String(reason || "").trim();
  if (why.length < 3) throw new Error("Vui lòng ghi lý do xóa đơn");
  if (!orderId) throw new Error("Thiếu đơn cần xóa");
  const dbx = window.__db;
  return amgFlowTx(async ctx => {
    const order = await ctx.get(FS.orders, orderId);
    if (!order) return { missing: true, orderId };
    // v54: Admin được xóa cả đơn đã hoàn thành (hộp xác nhận mạnh + lý do + nhật ký ở giao diện)
    // Quét lại từ kho dữ liệu (không tin danh sách trên màn hình): mọi lệnh và lượt sản lượng của đơn
    const rcol = await dbx.collection(AMG_FLOW_COLS.runs).get();
    const runs = rcol.docs.map(d => amgNormalizeRun(Object.assign({ id: d.id }, d.data()))).filter(r => r.orderId === orderId);
    (order.openRunIds || []).forEach(id => { if (id && !runs.some(r => r.id === id)) runs.push({ id, orderId, machineId: "", productionStatus: "unknown" }); });
    const runIds = new Set(runs.map(r => r.id));
    const ecol = await dbx.collection(AMG_FLOW_COLS.entries).get();
    const entries = ecol.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(e => e.orderId === orderId || runIds.has(e.runId));
    const acol = await dbx.collection(FS.audit).get();
    const auditIds = new Set(); // bản sao sản lượng trong nhật ký (cùng id lượt ghi) + dòng sản lượng cũ chỉ có ở nhật ký
    acol.docs.forEach(d => { const a = d.data(); if (a && a.type === "production_entry" && a.targetId === orderId) auditIds.add(d.id); });
    entries.forEach(e => auditIds.add(e.id));
    // Máy bị khóa bởi các lệnh sắp xóa → trả về lệnh mở kế tiếp của máy (đơn khác) hoặc trống
    const machineIds = [...new Set(runs.map(r => r.machineId).filter(Boolean))];
    const released = [];
    for (const mid of machineIds) {
      const m = await ctx.get(FS.machines, mid);
      if (!m || !runIds.has(m.activeRunId)) continue;
      const cand = [];
      for (const r of (allRuns || [])) if (r && r.machineId === mid && r.orderId !== orderId && cand.indexOf(r.id) < 0) cand.push(r.id);
      const live = [];
      for (const id of cand) { const r = await ctx.get(AMG_FLOW_COLS.runs, id); if (r && amgIsOpenRun(r) && r.machineId === mid && r.orderId !== orderId) live.push(r); }
      const keep = amgSortOpenRuns(live)[0] || null;
      ctx.set(FS.machines, mid, { activeRunId: keep ? keep.id : null }, true);
      released.push(mid);
    }
    // v55: lưu lại lịch sử dừng máy của các lệnh bị xóa (đánh dấu "nguồn đã xóa") để vẫn truy xuất được
    for (const r of runs) {
      for (let i = 0; i < (r.pauses || []).length; i++) {
        await amgDtLedgerWrite(ctx, r, order, i, "removed", amgDtPauseView(r.pauses[i]), null, { note: "Đơn bị Admin xóa: " + why, fields: { cancelReason: "Đơn bị xóa: " + why, cancelledAt: amgNowIso(), cancelledBy: amgWho() } });
      }
    }
    runs.forEach(r => ctx.del(AMG_FLOW_COLS.runs, r.id));
    entries.forEach(e => ctx.del(AMG_FLOW_COLS.entries, e.id));
    auditIds.forEach(id => ctx.del(FS.audit, id));
    ctx.del(FS.orders, orderId);
    const prog = typeof orderProgress === "function" ? orderProgress(normalizeOrderStages(order)) : null;
    const liveRuns = runs.filter(amgRunIsLive).length;
    amgFlowAudit(ctx, "order_force_delete",
      `Admin xóa đơn ${order.customer || orderId} / ${order.spec || ""} — lý do: ${why}. Đã xóa: ${runs.length} lệnh máy (${liveRuns} đang mở), ${entries.length} lượt sản lượng${prog ? `, thành phẩm ${fmtNum(prog.completedQty)}/${fmtNum(order.quantity)} ${amgOrderUnit(order)}` : ""}${released.length ? `; giải phóng máy ${released.join(", ")}` : ""}.`,
      orderId, { reason: why, runCount: runs.length, liveRunCount: liveRuns, entryCount: entries.length, machineIds: released, customer: order.customer || "", spec: order.spec || "", quantity: Number(order.quantity) || 0, completedQty: prog ? prog.completedQty : 0 });
    return { deleted: true, orderId, runs: runs.length, liveRuns, entries: entries.length, machines: released };
  });
}

function useFlowData(enabled) {
  const [runs, setRuns] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const subs = [];
    const fail = col => e => setError(amgIsQuotaError(e) ? AMG_QUOTA_MSG : `Không đọc được "${col}": ${(e && (e.code || e.message)) || e}. Kế hoạch/Thẻ máy có thể hiển thị thiếu — kiểm tra Rules của Realtime Database.`);
    try { subs.push(amgSnapDedup(window.__db.collection(AMG_FLOW_COLS.runs), s => { setRuns(s.docs.map(d => amgNormalizeRun(Object.assign({ id: d.id }, d.data())))); setLoaded(true); setError(""); }, fail(AMG_FLOW_COLS.runs))); } catch (e) { fail(AMG_FLOW_COLS.runs)(e); }
    try { subs.push(amgSnapDedup((window.__isOfflineDb ? window.__db.collection(AMG_FLOW_COLS.entries) : window.__db.collection(AMG_FLOW_COLS.entries).where("enteredAt", ">=", amgWindowStart().toISOString())), s => setEntries(s.docs.map(d => Object.assign({ id: d.id }, d.data()))), fail(AMG_FLOW_COLS.entries))); } catch (e) { fail(AMG_FLOW_COLS.entries)(e); }
    return () => subs.forEach(u => { try { u && u(); } catch (e) {} });
  }, [enabled]);
  return { runs, entries, error, loaded };
}
