/* ===================== LUỒNG ĐƠN HÀNG ↔ KẾ HOẠCH ↔ THẺ MÁY ↔ ĐƠN HOÀN THÀNH (v46) =====================
   Hàm thuần túy, không ghi dữ liệu. Một nguồn dữ liệu duy nhất:
     orders            : đơn hàng + sản lượng từng công đoạn (order.stages[key].done) — KHÔNG nhân bản
     machines          : danh mục máy (giữ nguyên mã máy)
     productionRuns    : lệnh sản xuất = liên kết đơn ↔ máy ↔ công đoạn (chỉ lưu mã tham chiếu, không chép lại thông tin đơn)
     productionEntries : từng lượt ghi sản lượng (khóa chống ghi trùng)
   Tên khách hàng, quy cách, mã liệu... luôn được đọc lại từ orders tại thời điểm hiển thị. */

const AMG_RUN_OPEN = ["assigned", "running", "paused"];
const AMG_PRIORITY_KEYS = ["urgent", "high", "normal", "low"];
const AMG_DUE_SOON_DAYS = 3;       // "Sắp giao": còn từ 0 đến 3 ngày
const AMG_STAGE_SHORT_TOL = 0.995; // dưới 99,5% số lượng đặt → hoàn thành công đoạn phải ghi lý do
const AMG_OVER_HARD = 1.5;         // chặn nhập nếu công đoạn vượt 150% số lượng đặt
const AMG_OVER_WARN = 1.05;        // cảnh báo (cần xác nhận) nếu vượt 105%
const AMG_PREV_TOL = 1.01;         // sản lượng công đoạn sau không vượt công đoạn trước quá 1% (chỉ đơn có quy trình đã xác nhận)

/* ---------- Chuẩn hóa lệnh (tương thích ngược với bản ghi cũ / thiếu trường) ----------
   Mọi màn hình đọc lệnh qua CÙNG hàm này (useFlowData gọi một lần) nên Kế hoạch, Thẻ máy, Đơn hàng, Hoàn thành luôn thống nhất.
   - productionStatus thiếu → suy từ status / startTime·startedAt / endTime·endedAt (không đoán máy, không đoán đơn).
   - Lệnh thiếu orderId, machineId hoặc stageKey là lệnh KHÔNG HỢP LỆ: không hiện ở máy nào, không tính vào đơn nào,
     chỉ được liệt kê trong bảng "Kiểm tra dữ liệu lệnh" để người có quyền xử lý. Tuyệt đối không tự gán vào máy bất kỳ. */
const AMG_RUN_STATUS_ALIASES = { assigned: "assigned", planned: "assigned", pending: "assigned", running: "running", started: "running", active: "running", in_progress: "running", paused: "paused", pause: "paused", stopped: "paused", completed: "completed", complete: "completed", done: "completed", finished: "completed", ended: "completed", cancelled: "cancelled", canceled: "cancelled" };
function amgNormalizeRun(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const r = Object.assign({}, raw);
  const clean = v => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
  r.orderId = clean(r.orderId); r.machineId = clean(r.machineId); r.stageKey = clean(r.stageKey);
  if (!r.startedAt && r.startTime) r.startedAt = r.startTime;
  if (!r.endedAt && r.endTime) r.endedAt = r.endTime;
  let st = AMG_RUN_STATUS_ALIASES[String(r.productionStatus || r.status || "").toLowerCase()];
  r._statusInferred = false;
  if (!st) {
    st = r.endedAt ? "completed" : r.startedAt ? "running" : "assigned";
    r._statusInferred = true;
  }
  r.productionStatus = st;
  return r;
}
// Lệnh có đủ ba khóa liên kết?
function amgRunHasRefs(run) {
  return !!run && !!String(run.orderId || "").trim() && !!String(run.machineId || "").trim() && !!String(run.stageKey || "").trim();
}

/* ---------- Metadata hiển thị (đọc COLORS lúc gọi để theo giao diện sáng/tối) ---------- */
function amgPriorityMeta(key) {
  const m = {
    urgent: { label: "Khẩn cấp", color: COLORS.red, rank: 0 },
    high: { label: "Cao", color: COLORS.orange, rank: 1 },
    normal: { label: "Bình thường", color: COLORS.blue, rank: 2 },
    low: { label: "Thấp", color: COLORS.textFaint, rank: 3 }
  };
  return m[key] || m.normal;
}
function amgRunStatusMeta(key) {
  const m = {
    assigned: { label: "Đã phân máy", color: COLORS.blue },
    running: { label: "Đang chạy", color: COLORS.green },
    paused: { label: "Tạm dừng", color: COLORS.amber },
    completed: { label: "Đã kết thúc", color: COLORS.textDim },
    cancelled: { label: "Đã hủy", color: COLORS.textFaint }
  };
  return m[key] || { label: key || "—", color: COLORS.textFaint };
}
function amgOrderStatusMeta(key) {
  const m = {
    new: { label: "Đơn mới", color: COLORS.blue },
    waiting: { label: "Chờ sản xuất", color: COLORS.amber },
    producing: { label: "Đang sản xuất", color: COLORS.green },
    completed: { label: "Hoàn thành", color: COLORS.violet }
  };
  return m[key] || m.new;
}
// Trạng thái thẻ máy: PHÂN BIỆT máy trống / đã phân chưa chạy / đang chạy / tạm dừng / hỏng / bảo trì
function amgCardStatusMeta(key) {
  const m = {
    running: { label: "ĐANG CHẠY", color: COLORS.green },
    assigned: { label: "ĐÃ PHÂN MÁY", color: COLORS.blue },
    paused: { label: "TẠM DỪNG", color: COLORS.amber },
    idle: { label: "MÁY TRỐNG", color: COLORS.textFaint },
    broken: { label: "HỎNG", color: COLORS.red },
    maintenance: { label: "BẢO TRÌ", color: COLORS.violet }
  };
  return m[key] || m.idle;
}
function amgBucketMeta(key) {
  const m = {
    unassigned: { label: "Chưa phân máy", color: COLORS.red },
    assigned: { label: "Đã phân máy", color: COLORS.blue },
    running: { label: "Đang chạy", color: COLORS.green },
    paused: { label: "Tạm dừng", color: COLORS.amber },
    stage_done: { label: "Hoàn thành công đoạn", color: COLORS.violet },
    waiting_next: { label: "Chờ công đoạn tiếp theo", color: COLORS.orange }
  };
  return m[key] || m.unassigned;
}
function amgStageColor(stageKey) {
  return (STAGE_MAP[stageKey] && STAGE_MAP[stageKey].color) || COLORS.textDim;
}
function amgStageLabel(stageKey) {
  return (STAGE_MAP[stageKey] && STAGE_MAP[stageKey].label) || stageKey || "—";
}

/* ---------- Máy ↔ công đoạn (theo MACHINE_TYPES hiện có, không tạo mapping mới) ---------- */
function amgStageMachineTypes(stageKey) {
  return MACHINE_TYPES.filter(t => t.stage === stageKey);
}
function amgMachineStage(m) {
  if (!m) return null;
  if (m.stage) return m.stage;
  const t = MACHINE_TYPES.find(x => x.key === m.typeKey);
  return t ? t.stage : null;
}
function amgNaturalCmp(a, b) {
  return String(a).localeCompare(String(b), "vi", { numeric: true });
}
function amgMachinesForStage(machines, stageKey) {
  const order = {};
  MACHINE_TYPES.forEach((t, i) => { order[t.key] = i; });
  return (machines || []).filter(m => amgMachineStage(m) === stageKey)
    .sort((a, b) => ((order[a.typeKey] ?? 99) - (order[b.typeKey] ?? 99)) || amgNaturalCmp(a.id, b.id));
}
// Tên hiển thị gọn của mã máy (mã gốc "KT-01" giữ nguyên trong dữ liệu; hiển thị đúng như danh mục)
function amgMachineLabel(m) {
  return m ? m.id : "—";
}

/* ---------- Lệnh sản xuất ---------- */
// Lệnh "mở" = hợp lệ (đủ order/machine/stage) và đang assigned|running|paused
function amgIsOpenRun(run) {
  return !!run && amgRunHasRefs(run) && AMG_RUN_OPEN.indexOf(run.productionStatus) > -1;
}
const AMG_RUN_RANK = { running: 0, paused: 1, assigned: 2 };
function amgSortOpenRuns(list) {
  return [...list].sort((a, b) => ((AMG_RUN_RANK[a.productionStatus] ?? 9) - (AMG_RUN_RANK[b.productionStatus] ?? 9)) || String(b.assignedAt || "").localeCompare(String(a.assignedAt || "")) || String(a.id).localeCompare(String(b.id)));
}
// Mọi lệnh mở của một máy (bình thường chỉ có ≤ 1; nhiều hơn = xung đột dữ liệu, được báo ở bảng kiểm tra)
function amgOpenRunsOfMachine(runs, machineId) {
  return amgSortOpenRuns((runs || []).filter(r => r.machineId === machineId && amgIsOpenRun(r)));
}
// Lệnh hiển thị trên thẻ máy: ưu tiên đang chạy > tạm dừng > đã phân, rồi mới nhất
function amgOpenRunOfMachine(runs, machineId) {
  return amgOpenRunsOfMachine(runs, machineId)[0] || null;
}
function amgRunsOfOrder(runs, orderId) {
  return (runs || []).filter(r => r.orderId === orderId && amgRunHasRefs(r));
}
function amgSortRunsDesc(list) {
  return [...list].sort((a, b) => String(b.assignedAt || "").localeCompare(String(a.assignedAt || "")));
}

/* ---------- Khả năng nhận lệnh của máy ---------- */
// Trả về { ok, reason, warn } — chỉ chặn máy hỏng/bảo trì, máy không đúng công đoạn, máy đã có lệnh mở.
function amgMachineAssignable(machine, stageKey, runs) {
  if (!machine) return { ok: false, reason: "Không tìm thấy máy" };
  if (amgMachineStage(machine) !== stageKey) return { ok: false, reason: `Máy ${machine.id} không thuộc công đoạn ${amgStageLabel(stageKey)}` };
  if (machine.status === "broken") return { ok: false, reason: `Máy ${machine.id} đang HỎNG/DỪNG — không nhận lệnh mới` };
  if (machine.status === "maintenance") return { ok: false, reason: `Máy ${machine.id} đang BẢO TRÌ — không nhận lệnh mới` };
  const open = amgOpenRunOfMachine(runs, machine.id);
  if (open) return { ok: false, reason: `Máy ${machine.id} đang giữ lệnh ${open.id} (${amgRunStatusMeta(open.productionStatus).label}). Kết thúc lệnh này trước khi phân lệnh mới`, run: open };
  return { ok: true, warn: machine.status === "unknown" ? "Máy chưa được xác nhận trạng thái" : "" };
}
// Trạng thái thẻ máy
function amgMachineCardState(machine, runs) {
  if (machine.status === "broken") return "broken";
  if (machine.status === "maintenance") return "maintenance";
  const open = amgOpenRunOfMachine(runs, machine.id);
  if (!open) return "idle";
  if (open.productionStatus === "running") return "running";
  if (open.productionStatus === "paused") return "paused";
  return "assigned"; // đã phân nhưng chưa bắt đầu chạy
}

/* ---------- Công đoạn của đơn ---------- */
function amgIsFlowOrder(order) {
  return !!(order && order.routingConfirmed && Array.isArray(order.routing) && order.routing.length > 0);
}
function amgOrderRoute(order) {
  return getApplicableStages(order || {});
}
function amgStageDone(order, stageKey) {
  return Number(order && order.stages && order.stages[stageKey] && order.stages[stageKey].done) || 0;
}
function amgStageQty(order) {
  return typeof (order && order.quantity) === "number" && order.quantity > 0 ? order.quantity : null;
}
// Công đoạn đã hoàn thành?
//  - Đơn có quy trình đã xác nhận: chỉ khi được xác nhận tường minh khi kết thúc lệnh (order.stageComplete[key]).
//  - Đơn cũ: coi là hoàn thành khi "Đã làm" ≥ số lượng đặt (không đổi dữ liệu cũ).
function amgStageComplete(order, stageKey) {
  if (order && order.stageComplete && order.stageComplete[stageKey]) return true;
  if (amgIsFlowOrder(order)) return false;
  const q = amgStageQty(order);
  return q !== null && amgStageDone(order, stageKey) >= q;
}
function amgCurrentStage(order) {
  const route = amgOrderRoute(order);
  return route.find(k => !amgStageComplete(order, k)) || null;
}
function amgNextStage(order, stageKey) {
  const route = amgOrderRoute(order);
  const i = route.indexOf(stageKey);
  return i > -1 && i < route.length - 1 ? route[i + 1] : null;
}
function amgPrevStage(order, stageKey) {
  const route = amgOrderRoute(order);
  const i = route.indexOf(stageKey);
  return i > 0 ? route[i - 1] : null;
}
// Có được phân máy cho công đoạn này chưa? Công đoạn đầu luôn được; công đoạn sau cần công đoạn trước đã có sản lượng hoặc đã hoàn thành.
function amgStageAssignable(order, stageKey) {
  if (!order) return { ok: false, reason: "Không tìm thấy đơn hàng" };
  if (order.status === "completed") return { ok: false, reason: "Đơn đã hoàn thành. Hãy mở lại đơn nếu cần sản xuất thêm" };
  const route = amgOrderRoute(order);
  if (route.indexOf(stageKey) < 0) return { ok: false, reason: `Công đoạn ${amgStageLabel(stageKey)} không nằm trong quy trình của đơn` };
  if (amgStageComplete(order, stageKey)) return { ok: false, reason: `Công đoạn ${amgStageLabel(stageKey)} đã hoàn thành` };
  const prev = amgPrevStage(order, stageKey);
  if (prev && !amgStageComplete(order, prev) && amgStageDone(order, prev) <= 0) {
    return { ok: false, reason: `Công đoạn trước (${amgStageLabel(prev)}) chưa có sản lượng` };
  }
  return { ok: true };
}
// Thông tin một công đoạn của một đơn
function amgStageInfo(order, runs, stageKey) {
  const qty = amgStageQty(order);
  const done = amgStageDone(order, stageKey);
  const rs = amgRunsOfOrder(runs, order.id).filter(r => r.stageKey === stageKey);
  const open = rs.filter(amgIsOpenRun);
  const complete = amgStageComplete(order, stageKey);
  let state = "unassigned";
  if (complete) state = "complete";
  else if (open.some(r => r.productionStatus === "running")) state = "running";
  else if (open.some(r => r.productionStatus === "paused")) state = "paused";
  else if (open.length) state = "assigned";
  return {
    stageKey, done, qty,
    remain: qty === null ? null : Math.round((qty - done) * 100) / 100,
    pct: qty ? Math.max(0, Math.min(999, done / qty * 100)) : null,
    complete, state, openRuns: open, runs: rs,
    plannedOpen: open.reduce((s, r) => s + (Number(r.plannedQuantity) || 0), 0)
  };
}
// Công đoạn "đang làm việc" của đơn = công đoạn chưa hoàn thành ĐẦU TIÊN có lệnh mở; nếu không có lệnh mở nào thì là
// công đoạn chưa hoàn thành đầu tiên. (Trước đây chỉ xét công đoạn chưa hoàn thành đầu tiên → lệnh đã phân ở công đoạn sau
// bị bỏ qua và đơn vẫn hiện CHƯA PHÂN MÁY dù máy đang chạy.)
function amgWorkingStage(order, runs) {
  const route = amgOrderRoute(order);
  const open = amgRunsOfOrder(runs, order.id).filter(amgIsOpenRun);
  const withRun = route.find(k => !amgStageComplete(order, k) && open.some(r => r.stageKey === k));
  return withRun || route.find(k => !amgStageComplete(order, k)) || null;
}
// Phân loại đơn trên màn hình Kế hoạch — dùng đúng các nhóm trạng thái của nghiệp vụ:
//   unassigned  CHƯA PHÂN MÁY        : công đoạn đang làm chưa có lệnh hợp lệ
//   assigned    ĐÃ PHÂN MÁY         : có lệnh hợp lệ, chưa bắt đầu
//   running     ĐANG CHẠY            : có lệnh đã bắt đầu, chưa kết thúc
//   paused      TẠM DỪNG             : lệnh đang tạm dừng (và không còn lệnh nào đang chạy)
//   waiting_next CHỜ CÔNG ĐOẠN TIẾP THEO : công đoạn trước đã hoàn thành, công đoạn này chưa phân máy
//   stage_done  HOÀN THÀNH CÔNG ĐOẠN : mọi công đoạn của quy trình đã hoàn thành
function amgPlanBucket(order, runs) {
  const route = amgOrderRoute(order);
  const cur = amgWorkingStage(order, runs);
  if (!cur) return { bucket: "stage_done", stageKey: route[route.length - 1] || null, route, openRuns: [] };
  const info = amgStageInfo(order, runs, cur);
  const idx = route.indexOf(cur);
  const openRuns = amgSortOpenRuns(amgRunsOfOrder(runs, order.id).filter(amgIsOpenRun));
  let bucket = "unassigned";
  if (info.state === "running") bucket = "running";
  else if (info.state === "paused") bucket = "paused";
  else if (info.state === "assigned") bucket = "assigned";
  else if (idx > 0 && amgStageComplete(order, route[idx - 1])) bucket = "waiting_next";
  return { bucket, stageKey: cur, route, info, openRuns };
}

/* ---------- Trạng thái đơn ---------- */
function amgDaysToDue(order, today) {
  if (!order || !order.deliveryDate) return null;
  const t = new Date(String(order.deliveryDate).slice(0, 10) + "T00:00:00").getTime();
  if (Number.isNaN(t)) return null;
  const base = new Date((today || new Date()).toDateString()).getTime();
  return Math.round((t - base) / 86400000);
}
function amgOrderLifecycle(order, runs, today) {
  const completed = order.status === "completed";
  const days = amgDaysToDue(order, today);
  const anyDone = STAGES.some(s => amgStageDone(order, s.key) > 0);
  const hasRun = amgRunsOfOrder(runs, order.id).some(r => r.productionStatus !== "cancelled");
  const openRun = amgRunsOfOrder(runs, order.id).some(amgIsOpenRun);
  let key = "new";
  if (completed) key = "completed";
  else if (anyDone || amgRunsOfOrder(runs, order.id).some(r => r.productionStatus === "running" || r.productionStatus === "paused")) key = "producing";
  else if (order.routingConfirmed || openRun || hasRun) key = "waiting";
  return {
    key, days,
    overdue: !completed && days !== null && days < 0,
    dueSoon: !completed && days !== null && days >= 0 && days <= AMG_DUE_SOON_DAYS
  };
}
// Đủ điều kiện hoàn thành đơn?
function amgOrderReadiness(order) {
  const route = amgOrderRoute(order);
  const missing = route.filter(k => !amgStageComplete(order, k));
  const qty = amgStageQty(order);
  const last = route[route.length - 1];
  const finished = last ? amgStageDone(order, last) : 0;
  const qtyMet = qty !== null && finished >= qty;
  return { route, missing, allStages: missing.length === 0 && route.length > 0, qty, finished, qtyMet, ready: missing.length === 0 && route.length > 0 && qtyMet };
}
// Đơn cũ (chưa có quy trình xác nhận) đã đủ số lượng theo orderProgress nhưng chưa được xác nhận hoàn thành
function amgLegacyDoneCandidate(order) {
  if (!order || order.status === "completed") return false;
  if (amgIsFlowOrder(order)) return false;
  return orderProgress(normalizeOrderStages(order)).statusLabel === "Hoàn thành";
}

/* ---------- Kiểm tra số liệu nhập (dùng ở giao diện và lặp lại trong giao dịch) ---------- */
function amgParseQty(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}
// order, run, machine: bản mới nhất. Trả { errors:[], warnings:[] }
function amgValidateOutput({ order, run, machine, qty, orderId, machineId, stageKey }) {
  const errors = [], warnings = [];
  if (!run) { errors.push("Không tìm thấy lệnh sản xuất"); return { errors, warnings }; }
  if (!amgRunHasRefs(run)) { errors.push("Lệnh thiếu thông tin đơn/máy/công đoạn — không ghi sản lượng được"); return { errors, warnings }; }
  if (!order) { errors.push("Không tìm thấy đơn hàng của lệnh này"); return { errors, warnings }; }
  if (orderId && run.orderId !== orderId) errors.push("Sai đơn: lệnh này thuộc đơn " + run.orderId);
  if (machineId && run.machineId !== machineId) errors.push("Sai máy: lệnh này chạy trên máy " + run.machineId);
  if (stageKey && run.stageKey !== stageKey) errors.push("Sai công đoạn: lệnh này thuộc công đoạn " + amgStageLabel(run.stageKey));
  if (order.status === "completed") errors.push("Đơn đã hoàn thành — mở lại đơn nếu cần ghi thêm sản lượng");
  if (run.productionStatus !== "running") errors.push(run.productionStatus === "paused" ? "Lệnh đang tạm dừng — hãy tiếp tục chạy trước khi ghi sản lượng" : run.productionStatus === "assigned" ? "Lệnh chưa bắt đầu — bấm Bắt đầu chạy trước" : "Lệnh đã kết thúc, không ghi thêm được");
  if (machine && (machine.status === "broken" || machine.status === "maintenance")) errors.push(`Máy ${machine.id} đang ${machine.status === "broken" ? "hỏng" : "bảo trì"} — tạm dừng lệnh trước khi xử lý`);
  if (!Number.isFinite(qty) || qty <= 0) errors.push("Sản lượng phải là số lớn hơn 0 (tối đa 2 chữ số thập phân)");
  else if (qty > 1e7) errors.push("Sản lượng quá lớn, vui lòng kiểm tra lại");
  if (errors.length) return { errors, warnings };
  const total = amgStageQty(order);
  const done = amgStageDone(order, run.stageKey);
  const after = Math.round((done + qty) * 100) / 100;
  if (total !== null) {
    if (after > total * AMG_OVER_HARD) errors.push(`Sản lượng công đoạn sẽ là ${fmtNum(after)}, vượt ${Math.round(AMG_OVER_HARD * 100)}% số lượng đặt (${fmtNum(total)}). Kiểm tra lại số nhập`);
    else if (after > total * AMG_OVER_WARN) warnings.push(`Sản lượng công đoạn sẽ là ${fmtNum(after)}, vượt số lượng đặt (${fmtNum(total)})`);
  }
  if (amgIsFlowOrder(order)) {
    const prev = amgPrevStage(order, run.stageKey);
    if (prev) {
      const prevDone = amgStageDone(order, prev);
      if (after > prevDone * AMG_PREV_TOL + 1e-9) errors.push(`Sản lượng ${amgStageLabel(run.stageKey)} (${fmtNum(after)}) không thể vượt công đoạn trước ${amgStageLabel(prev)} (${fmtNum(prevDone)})`);
    }
  }
  return { errors, warnings };
}

/* ---------- Thời gian ---------- */
function amgDurationText(fromIso, toIso) {
  const a = new Date(fromIso).getTime(), b = toIso ? new Date(toIso).getTime() : Date.now();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return "—";
  const mins = Math.round((b - a) / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}
function amgOrderProductionSpan(order, runs) {
  if (!order) return { from: null, to: null };
  const rs = amgRunsOfOrder(runs, order.id).filter(r => r.startedAt).map(r => r.startedAt).sort();
  const from = order.productionStartedAt || rs[0] || order.orderDate || null;
  return { from, to: order.completedAt || null };
}
function amgNewKey(prefix) {
  const rnd = (window.crypto && crypto.getRandomValues) ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(36).slice(2, 14);
  return prefix + "-" + Date.now().toString(36).toUpperCase() + "-" + rnd.toUpperCase();
}

/* ---------- Kiểm tra dữ liệu lệnh (chỉ ĐỌC; không tự sửa) ----------
   Trả danh sách vấn đề { id, kind, severity: "error"|"warn"|"info", runId, machineId, orderId, text, fix }.
   fix = gợi ý thao tác an toàn (do người có quyền bấm; mọi thao tác đều qua giao dịch + nhật ký). */
function amgRunIssues(rawRuns, orders, machines) {
  const out = [];
  const runs = rawRuns || [];
  const orderById = {}; (orders || []).forEach(o => { orderById[o.id] = o; });
  const machineById = {}; (machines || []).forEach(m => { machineById[m.id] = m; });
  const push = (kind, severity, r, text, fix) => out.push({ id: kind + ":" + (r && r.id) + ":" + out.length, kind, severity, runId: r && r.id, machineId: r && r.machineId, orderId: r && r.orderId, text, fix: fix || null });
  runs.forEach(r => {
    if (!amgRunHasRefs(r)) {
      const miss = ["orderId", "machineId", "stageKey"].filter(k => !String(r[k] || "").trim()).join(", ");
      push("missing_ref", "error", r, `Lệnh ${r.id} thiếu ${miss} — không hiển thị ở máy/đơn nào, không tự gán. Cần xác minh rồi hủy hoặc bổ sung.`, "cancel");
      return;
    }
    if (r._statusInferred) push("status_missing", "info", r, `Lệnh ${r.id} (máy ${r.machineId}) thiếu productionStatus — hệ thống đang suy ra "${amgRunStatusMeta(r.productionStatus).label}" từ thời gian bắt đầu/kết thúc.`);
    if (!amgIsOpenRun(r)) return;
    const o = orderById[r.orderId], m = machineById[r.machineId];
    if (!o) push("orphan_order", "error", r, `Lệnh ${r.id} đang mở trên máy ${r.machineId} nhưng đơn ${r.orderId} không còn tồn tại.`, "close");
    else if (amgOrderRoute(o).indexOf(r.stageKey) < 0) push("stage_not_in_route", "warn", r, `Lệnh ${r.id} (máy ${r.machineId}) thuộc công đoạn ${amgStageLabel(r.stageKey)} nhưng quy trình đơn ${r.orderId} không có công đoạn này.`);
    if (!m) push("unknown_machine", "error", r, `Lệnh ${r.id} gắn với mã máy "${r.machineId}" không có trong danh mục máy.`, "cancel");
    else if (amgMachineStage(m) && amgMachineStage(m) !== r.stageKey) push("machine_stage_mismatch", "warn", r, `Máy ${m.id} thuộc công đoạn ${amgStageLabel(amgMachineStage(m))} nhưng lệnh ${r.id} là công đoạn ${amgStageLabel(r.stageKey)}.`);
  });
  const open = runs.filter(amgIsOpenRun);
  const byMachine = {}; open.forEach(r => { (byMachine[r.machineId] = byMachine[r.machineId] || []).push(r); });
  Object.keys(byMachine).forEach(mid => {
    const list = amgSortOpenRuns(byMachine[mid]);
    if (list.length > 1) {
      const keyOf = r => r.orderId + "|" + r.stageKey;
      const dup = list.some((r, i) => list.findIndex(x => keyOf(x) === keyOf(r)) !== i);
      push(dup ? "duplicate_run" : "machine_conflict", "error", list[0], `${dup ? "Lệnh trùng" : "Máy có nhiều lệnh mở"}: máy ${mid} đang giữ ${list.length} lệnh (${list.map(r => r.id + " · " + r.orderId + " · " + amgRunStatusMeta(r.productionStatus).label).join("; ")}). Chỉ giữ một lệnh, các lệnh còn lại cần kết thúc/hủy.`, "keep-one");
      if (list.filter(r => r.productionStatus === "running").length > 1) push("two_running", "error", list[0], `Máy ${mid} có hơn một lệnh ĐANG CHẠY cùng lúc.`);
    }
    const m = machineById[mid], keep = list[0];
    if (m && keep && m.activeRunId !== keep.id) push("lock_missing", "warn", keep, `Khóa máy ${mid} chưa trỏ đúng lệnh đang mở ${keep.id} (đang là ${m.activeRunId || "trống"}). Đồng bộ lại khóa để chặn phân trùng.`, "relock");
  });
  (machines || []).forEach(m => {
    if (!m.activeRunId) return;
    const cur = runs.find(r => r.id === m.activeRunId);
    if (!amgIsOpenRun(cur)) push("lock_stale", "warn", { id: m.activeRunId, machineId: m.id }, `Máy ${m.id} đang bị khóa bởi lệnh ${m.activeRunId} ${cur ? "đã " + amgRunStatusMeta(cur.productionStatus).label.toLowerCase() : "không tồn tại"} — máy sẽ không nhận lệnh mới. Giải phóng khóa.`, "relock");
  });
  return out;
}
