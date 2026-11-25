/* ===================== ĐIỀU HÀNH SẢN XUẤT — TÍNH TOÁN TRUNG TÂM GIÁM SÁT (v52) =====================
   Thuần hàm: chỉ đọc dữ liệu THẬT đã có trong bộ nhớ (orders, machines, productionRuns, productionEntries, extra). Không có số mẫu:
   không có dữ liệu → mọi chỉ số bằng 0 / danh sách rỗng. Mọi sản lượng cộng THEO ĐƠN VỊ (kg và m không bao giờ cộng lẫn).
   Định nghĩa chỉ số (hiển thị lại trong tooltip giao diện):
   - Đơn đang sản xuất : đơn hoạt động đã xác nhận quy trình, đang có lệnh mở hoặc đã có sản lượng công đoạn nhưng chưa hoàn thành.
   - Sản lượng hôm nay : tổng các lượt ghi (productionEntries, không tính lượt đã hủy) có thời điểm ghi trong ngày hôm nay.
   - Kế hoạch / thực tế : tổng sản lượng kế hoạch và sản lượng đã chạy (cộng dồn) của các lệnh đang mở + lệnh kết thúc hôm nay.
   - Máy dừng          : máy có trạng thái hỏng/dừng (broken). Máy bảo trì: trạng thái maintenance. Máy chưa phân công: không giữ lệnh mở. */
const AMG_OPS_LOW_OUTPUT_MS = 2 * 3600000;   // chạy thực ≥ 2 giờ mà chưa ghi sản lượng → cảnh báo
const AMG_OPS_PAUSE_LONG_MS = 60 * 60000;    // tạm dừng ≥ 60 phút → cảnh báo
const AMG_OPS_STALE_RUN_MS = 24 * 3600000;   // lệnh còn mở quá 24 giờ → nhắc kết thúc/đóng lệnh
const AMG_OPS_STATE_ORDER = { running: 0, paused: 1, broken: 2, assigned: 3, maintenance: 4, idle: 5 };
function amgOpsDayStart(nowMs) { const d = new Date(nowMs); d.setHours(0, 0, 0, 0); return d.getTime(); }
// Tiến độ tổng của một đơn theo quy trình: công đoạn xong = 100%, công đoạn đang làm = % sản lượng của nó
function amgOpsProgress(order, runs) {
  const route = amgOrderRoute(order);
  if (!route.length) return null;
  let sum = 0;
  route.forEach(k => { if (amgStageComplete(order, k)) sum += 1; else { const i = amgStageInfo(order, runs, k); if (i && i.pct !== null && i.pct !== undefined) sum += Math.min(1, i.pct / 100); } });
  return Math.round(sum / route.length * 1000) / 10;
}
function amgComputeOpsLive({ orders, machines, runs, entries, extra, now }) {
  const nowMs = typeof now === "number" ? now : Date.now();
  const dayStart = amgOpsDayStart(nowMs), todayDate = new Date(nowMs);
  const allOrders = orders || [], allRuns = (runs || []).filter(r => r && amgRunHasRefs(r) && r.productionStatus !== "cancelled");
  const orderById = {}; allOrders.forEach(o => { orderById[o.id] = o; });
  const active = allOrders.filter(o => amgIsActiveOrder(o) && amgIsFlowOrder(o));
  const openRuns = allRuns.filter(amgIsOpenRun);
  const qtyAdd = (acc, unit, q) => { acc[unit] = Math.round(((acc[unit] || 0) + (Number(q) || 0)) * 100) / 100; return acc; };

  // ---- Thẻ máy ----
  const prodMachines = (machines || []).filter(m => amgMachineStage(m));
  const cards = prodMachines.map(m => {
    const state = amgMachineCardState(m, allRuns);
    const run = amgOpenRunOfMachine(allRuns, m.id);
    const order = run ? orderById[run.orderId] || null : null;
    const timing = run ? amgRunTiming(run, nowMs, order) : null;
    return { machine: m, id: m.id, name: m.name || m.typeLabel || "", stageKey: amgMachineStage(m), state, run, order, timing };
  }).sort((a, b) => (AMG_OPS_STATE_ORDER[a.state] ?? 9) - (AMG_OPS_STATE_ORDER[b.state] ?? 9) || amgNaturalCmp(a.id, b.id));
  const count = s => cards.filter(c => c.state === s).length;

  // ---- Đơn đang sản xuất ----
  const orderRows = active.map(o => {
    const my = amgRunsOfOrder(allRuns, o.id), my_open = my.filter(amgIsOpenRun);
    const life = amgOrderLifecycle(o, allRuns, todayDate), plan = amgPlanBucket(o, allRuns);
    const cs = amgOrderCompletionState(o, allRuns);
    const inProd = my_open.length > 0 || STAGES.some(s => amgStageDone(o, s.key) > 0);
    return { order: o, life, plan, progress: amgOpsProgress(o, allRuns), openRuns: my_open, machines: my_open.map(r => r.machineId), inProd, ready: cs.canConfirm, short: cs.short };
  }).filter(r => r.inProd).sort((a, b) => (amgPriorityMeta(a.order.priority).rank - amgPriorityMeta(b.order.priority).rank) || String(a.order.deliveryDate || "9999").localeCompare(String(b.order.deliveryDate || "9999")));

  // ---- Sản lượng ----
  const outputToday = {}; (entries || []).forEach(e => { if (e.voided) return; const t = amgMs(e.enteredAt); if (!Number.isNaN(t) && t >= dayStart) qtyAdd(outputToday, e.unit || amgOrderUnit(orderById[e.orderId]), e.qty); });
  const plannedU = {}, actualU = {};
  allRuns.filter(r => amgIsOpenRun(r) || (r.productionStatus === "completed" && amgMs(r.endedAt) >= dayStart)).forEach(r => { const u = r.unit || amgOrderUnit(orderById[r.orderId]); qtyAdd(plannedU, u, r.plannedQuantity); qtyAdd(actualU, u, r.producedQuantity); });
  const rateU = {}; Object.keys(plannedU).forEach(u => { rateU[u] = plannedU[u] > 0 ? Math.round((actualU[u] || 0) / plannedU[u] * 1000) / 10 : null; });

  // ---- Cảnh báo điều hành ----
  const alerts = [], push = a => alerts.push(a);
  cards.filter(c => c.state === "broken").forEach(c => push({ id: "down-" + c.id, level: "err", kind: "machine_down", title: `Máy ${c.id} dừng / sự cố`, detail: c.run ? `Đang giữ lệnh ${c.run.id} (đơn ${c.run.orderId}) — cần xử lý hoặc chuyển lệnh` : "Không có lệnh đang giữ", machineId: c.id, orderId: c.run ? c.run.orderId : "" }));
  orderRows.forEach(r => {
    const o = r.order, d = r.life.days;
    if (r.life.overdue) push({ id: "late-" + o.id, level: "err", kind: "order_overdue", title: `Đơn ${o.id} quá hạn giao ${Math.abs(d)} ngày`, detail: `${o.customer || ""} · ${o.spec || ""} · tiến độ ${r.progress === null ? "—" : r.progress + "%"}`, orderId: o.id });
    else if (r.life.days !== null && d <= AMG_EXEC_RISK_WINDOW_DAYS && o.orderDate && r.progress !== null) {
      const a = new Date(String(o.orderDate).slice(0, 10) + "T00:00:00").getTime(), b = new Date(String(o.deliveryDate).slice(0, 10) + "T00:00:00").getTime();
      if (b > a) { const expected = Math.max(0, Math.min(100, (nowMs - a) / (b - a) * 100)); if (expected - r.progress >= AMG_EXEC_RISK_GAP) push({ id: "risk-" + o.id, level: "warn", kind: "order_risk", title: `Đơn ${o.id} có nguy cơ chậm tiến độ`, detail: `Tiến độ ${r.progress}% so với ${Math.round(expected)}% theo thời gian; còn ${d} ngày đến hạn`, orderId: o.id }); }
    }
  });
  openRuns.forEach(r => {
    const t = amgRunTiming(r, nowMs, orderById[r.orderId]);
    if (r.productionStatus === "running" && t.netMs >= AMG_OPS_LOW_OUTPUT_MS && t.produced <= 0) push({ id: "low-" + r.id, level: "warn", kind: "low_output", title: `Lệnh ${r.id} (${r.machineId}) chưa ghi sản lượng`, detail: `Đã chạy thực ${amgHm(t.netMs)} nhưng sản lượng = 0 so với kế hoạch ${fmtNum(t.planned)} ${t.unit}`, machineId: r.machineId, orderId: r.orderId, runId: r.id });
    if (r.productionStatus === "paused" && t.openPause) { const last = (r.pauses || []).filter(p => !p.resumedAt).map(p => amgMs(p.at)).filter(x => !Number.isNaN(x)).pop(); if (last && nowMs - last >= AMG_OPS_PAUSE_LONG_MS) push({ id: "pause-" + r.id, level: "warn", kind: "paused_long", title: `Lệnh ${r.id} (${r.machineId}) tạm dừng ${amgHm(nowMs - last)}`, detail: "Tạm dừng kéo dài — kiểm tra lý do dừng", machineId: r.machineId, orderId: r.orderId, runId: r.id }); }
    const since = amgMs(r.startedAt || r.assignedAt);
    if (!Number.isNaN(since) && nowMs - since >= AMG_OPS_STALE_RUN_MS) push({ id: "open-" + r.id, level: "warn", kind: "run_open_long", title: `Lệnh ${r.id} (${r.machineId}) chưa kết thúc`, detail: `Mở từ ${amgFmtDateTime(r.startedAt || r.assignedAt)} (${amgHm(nowMs - since)}) — kết thúc lệnh nếu đã xong`, machineId: r.machineId, orderId: r.orderId, runId: r.id });
  });
  const ncr = ((extra && extra.ncr) || []).filter(n => n.status === "mo" || n.status === "dang_xu_ly" || n.status === "cho_xn");
  if (ncr.length) push({ id: "ncr-open", level: "warn", kind: "quality", title: `${ncr.length} phiếu NG chưa đóng`, detail: ncr.slice(0, 3).map(n => n.id + (n.orderId ? " (" + n.orderId + ")" : "")).join(", ") + (ncr.length > 3 ? "…" : ""), tab: "inspect" });
  const ngToday = ((extra && extra.inspections) || []).filter(i => i.result === "ng" && String(i.date || "").slice(0, 10) === amgTodayKey(todayDate));
  if (ngToday.length) push({ id: "ng-today", level: "err", kind: "quality", title: `${ngToday.length} phiếu kiểm tra NG hôm nay`, detail: ngToday.slice(0, 3).map(i => `${i.id}${i.orderId ? " (" + i.orderId + ")" : ""}`).join(", "), tab: "inspect" });
  const moves = (extra && extra.stockMoves) || [], lots = (extra && extra.lots) || [];
  orderRows.filter(r => r.openRuns.length && (r.order.bom || []).length).forEach(r => { // chỉ khi ĐÃ có dữ liệu xuất kho cho đơn
    const o = r.order, mv = moves.filter(m => m.type === "xuat" && m.orderId === o.id); if (!mv.length) return;
    const issued = {}; mv.forEach(m => { const l = lots.find(x => x.id === m.lotId) || {}; const k = amgSearchNorm(l.material || ""); issued[k] = (issued[k] || 0) + (Number(m.qty) || 0); });
    const qty = Number(o.quantity) || 0; const short = (o.bom || []).filter(l => l.material && (Number(l.norm) || 0) * qty > (issued[amgSearchNorm(l.material)] || 0) + 1e-9).map(l => l.material);
    if (short.length) push({ id: "mat-" + o.id, level: "warn", kind: "material", title: `Đơn ${o.id} có thể thiếu vật tư`, detail: `Đã xuất kho chưa đủ định mức: ${short.slice(0, 3).join(", ")}${short.length > 3 ? "…" : ""}`, orderId: o.id, tab: "warehouse" });
  });
  const LV = { err: 0, warn: 1, info: 2 }; alerts.sort((a, b) => LV[a.level] - LV[b.level]);

  return {
    now: nowMs, cards, orderRows, alerts, outputToday, planned: plannedU, actual: actualU, rate: rateU,
    kpi: {
      ordersInProduction: orderRows.length, openRuns: openRuns.length, runsRunning: openRuns.filter(r => r.productionStatus === "running").length,
      runsPaused: openRuns.filter(r => r.productionStatus === "paused").length, runsAssigned: openRuns.filter(r => r.productionStatus === "assigned").length,
      machines: cards.length, machinesRunning: count("running"), machinesPaused: count("paused"), machinesAssigned: count("assigned"), machinesStopped: count("broken"), machinesMaintenance: count("maintenance"), machinesIdle: count("idle"),
      dueSoon: orderRows.filter(r => r.life.dueSoon).length, overdue: orderRows.filter(r => r.life.overdue).length, ready: orderRows.filter(r => r.ready).length
    }
  };
}
