/* ===================== TỔNG QUAN – TRUNG TÂM ĐIỀU HÀNH SẢN XUẤT (v57) =====================
   Hàm THUẦN: chỉ ĐỌC dữ liệu thật truyền vào (đơn, máy, lệnh sản xuất, nhật ký sản lượng, chấm công, phiếu chất lượng),
   KHÔNG ghi gì lên Firebase, KHÔNG tự tạo số liệu. Thiếu dữ liệu → trả null / mảng rỗng để giao diện hiện "Chưa có dữ liệu".
   Tái sử dụng đúng các hàm nghiệp vụ đang chạy (amgComputeExecutive, amgPlanBucket, amgOrderLifecycle, amgMachineCardState,
   amgCcAlerts…) để mọi con số ở Tổng quan KHỚP với các tab nghiệp vụ.
   Quy ước giữ nguyên: kg và m KHÔNG bao giờ cộng lẫn; số máy lấy từ danh sách máy thật (không cố định 163);
   đơn được gọi bằng Khách hàng · Quy cách (v54 đã bỏ mã đơn khỏi giao diện). */

const AMG_OV_PERIODS = { day: "Ngày", week: "Tuần", month: "Tháng", custom: "Khoảng ngày" };
const AMG_OV_MAX_SPAN_DAYS = 92;           // khoảng ngày tự chọn tối đa ~3 tháng (tránh biểu đồ quá dày)
const AMG_OV_WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const AMG_OV_ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Thời gian ---------- */
// Mọi kiểu thời gian đang có trong dữ liệu (ISO, số ms, Timestamp {toMillis}/{seconds}) → ms; không đọc được → NaN
function amgOvMs(v) {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v === "string" && AMG_OV_ISO_DAY.test(v)) return new Date(v + "T12:00:00").getTime();
  return new Date(v).getTime();
}
// Ngày (YYYY-MM-DD theo giờ máy) của một mốc thời gian; không đọc được → ""
function amgOvDay(v) {
  if (typeof v === "string" && AMG_OV_ISO_DAY.test(v)) return v;
  const ms = amgOvMs(v);
  return Number.isNaN(ms) ? "" : amgTodayKey(new Date(ms));
}
function amgOvAddDays(key, n) {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return amgTodayKey(d);
}
function amgOvDaysBetween(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
function amgOvDayList(from, to) {
  const out = [];
  for (let k = from, i = 0; k <= to && i < 400; i++, k = amgOvAddDays(k, 1)) out.push(k);
  return out;
}
const amgOvShort = k => k.slice(8) + "/" + k.slice(5, 7);

// Khoảng thời gian của bộ lọc: ngày / tuần / tháng / khoảng ngày tự chọn
function amgOvRange(period, from, to, now) {
  const n = now || new Date();
  if (period === "custom" && AMG_OV_ISO_DAY.test(from || "") && AMG_OV_ISO_DAY.test(to || "")) {
    let a = from, b = to, clamped = false;
    if (a > b) { const t = a; a = b; b = t; }
    if (amgOvDaysBetween(a, b) + 1 > AMG_OV_MAX_SPAN_DAYS) { a = amgOvAddDays(b, -(AMG_OV_MAX_SPAN_DAYS - 1)); clamped = true; }
    return { key: "custom", from: a, to: b, days: amgOvDaysBetween(a, b) + 1, clamped };
  }
  const p = period === "day" || period === "week" || period === "month" ? period : "month";
  const r = amgPeriodRange(p, n);
  return { key: p, from: r.from, to: r.to, days: amgOvDaysBetween(r.from, r.to) + 1, clamped: false };
}
function amgOvGreeting(now) {
  const h = (now || new Date()).getHours();
  return h >= 5 && h < 11 ? "Chào buổi sáng" : h >= 11 && h < 13 ? "Chào buổi trưa" : h >= 13 && h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

/* ---------- Máy: nhóm + trạng thái ---------- */
// Nhóm máy theo MACHINE_TYPES hiện có (10 nhóm). Máy có typeKey lạ gom vào "Máy khác" — không bỏ sót, không tự tạo máy.
function amgOvGroups(machines) {
  const list = machines || [];
  const known = {};
  MACHINE_TYPES.forEach(t => { known[t.key] = true; });
  const groups = MACHINE_TYPES.map(t => ({ key: t.key, label: t.label, short: t.label.replace(/^Máy\s+/, ""), color: t.color, stage: t.stage, machines: list.filter(m => m.typeKey === t.key).sort((a, b) => amgNaturalCmp(a.id, b.id)) }));
  const other = list.filter(m => !known[m.typeKey]).sort((a, b) => amgNaturalCmp(a.id, b.id));
  if (other.length) groups.push({ key: "khac", label: "Máy khác", short: "Khác", color: "#64748B", stage: null, machines: other });
  return groups;
}
// Gộp trạng thái thẻ máy thành 3 nhóm cho Tổng quan:
//   chạy = running · chờ = assigned (đã phân lệnh, chưa chạy) + idle (chưa có lệnh, kể cả chưa xác nhận trạng thái) · dừng = paused + maintenance + broken
function amgOvBucketOf(st) { return st === "running" ? "running" : (st === "paused" || st === "maintenance" || st === "broken") ? "stopped" : "waiting"; }
function amgOvZeroCounts() { return { total: 0, running: 0, waiting: 0, stopped: 0, assigned: 0, idle: 0, unknown: 0, paused: 0, maintenance: 0, broken: 0 }; }
function amgOvAddCount(c, card) {
  c.total++; c[amgOvBucketOf(card.st)]++;
  if (card.unknown) c.unknown++; else if (card.st !== "running") c[card.st]++; // "running" đã đếm ở nhóm trên (trùng tên khóa)
}

/* ---------- Đơn: một dòng cho bảng "Đơn hàng cần chú ý" ---------- */
function amgOvOrderItem(r, runs, now) {
  const o = r.o, unit = amgOrderUnit(o), qty = Number(o.quantity);
  const pb = r.flow ? amgPlanBucket(o, runs) : null;
  const openR = amgRunsOfOrder(runs, o.id).filter(amgIsOpenRun);
  const done = Number(r.prog.completedQty) || 0;
  const bucket = pb ? pb.bucket : "unconfirmed";
  const unassigned = bucket === "unassigned" || bucket === "waiting_next" || bucket === "unconfirmed";
  const producing = r.life.key === "producing";
  let statusKey = "waiting", statusLabel = "Chờ sản xuất", tone = "blue";
  if (r.life.overdue) { statusKey = "overdue"; statusLabel = "Trễ hạn"; tone = "red"; }
  else if (r.risk) { statusKey = "risk"; statusLabel = "Nguy cơ chậm"; tone = "violet"; }
  else if (r.life.dueSoon) { statusKey = "soon"; statusLabel = "Sắp đến hạn"; tone = "amber"; }
  else if (bucket === "paused") { statusKey = "paused"; statusLabel = "Tạm dừng"; tone = "amber"; }
  else if (producing) { statusKey = "producing"; statusLabel = "Đang sản xuất"; tone = "green"; }
  else if (bucket === "unconfirmed") { statusKey = "unconfirmed"; statusLabel = "Chưa xác nhận quy trình"; tone = "textFaint"; }
  else if (unassigned) { statusKey = "unassigned"; statusLabel = "Chưa bố trí máy"; tone = "amber"; }
  return {
    id: o.id, customer: o.customer || "", spec: o.spec || "", label: amgOrderLabel(o), unit,
    qty: Number.isFinite(qty) && qty > 0 ? qty : null, done, remain: Number.isFinite(qty) ? Math.max(0, Math.round((qty - done) * 100) / 100) : null,
    pct: r.prog.pct, stageKey: pb && pb.stageKey ? pb.stageKey : null, stageLabel: pb && pb.stageKey ? amgStageLabel(pb.stageKey) : "",
    machines: [...new Set(openR.map(x => x.machineId))].sort(amgNaturalCmp), deliveryDate: o.deliveryDate ? String(o.deliveryDate).slice(0, 10) : "",
    days: r.life.days, overdue: !!r.life.overdue, dueSoon: !!r.life.dueSoon, risk: !!r.risk, producing, unassigned,
    statusKey, statusLabel, tone
  };
}

/* ---------- Hoạt động gần đây: chỉ sự kiện CÓ THẬT (có mốc thời gian trong dữ liệu) ---------- */
function amgOvActivity(data, can, power, limit) {
  const ev = [], orders = data.orders || [], runs = (data.runs || []).filter(amgRunHasRefs), machines = data.machines || [], audit = data.auditLog || [];
  const orderById = {}; orders.forEach(o => { orderById[o.id] = o; });
  const add = (id, at, kind, tone, title, detail, user, target) => { const ms = amgOvMs(at); if (!Number.isNaN(ms)) ev.push({ id, at: ms, kind, tone, title, detail: detail || "", user: user || "", target: target || null }); };
  if (can.orders) orders.forEach(o => {
    const lab = amgOrderLabel(o);
    add("oc:" + o.id, o.createdAt, "order_new", "blue", "Đơn hàng mới", lab, o.createdBy, { tab: "orders", focus: { orderId: o.id } });
    if (o.status === "completed") add("od:" + o.id, o.completedAt, "order_done", "green", "Hoàn thành đơn hàng", lab, o.completedBy, { tab: "completed", focus: { orderId: o.id } });
    (o.statusHistory || []).forEach((h, i) => { if (h && h.action === "reopen") add("or:" + o.id + ":" + i, h.at, "order_reopen", "amber", "Mở lại đơn hàng", lab + (h.reason ? " · " + h.reason : ""), h.by, { tab: o.status === "completed" ? "completed" : "orders", focus: { orderId: o.id } }); });
  });
  if (can.plan || can.machines) runs.forEach(r => {
    const o = orderById[r.orderId], lab = o ? amgOrderLabel(o) : "", st = amgStageLabel(r.stageKey), tgt = { tab: "machines", focus: { screen: "monitor", machineId: r.machineId } };
    add("ra:" + r.id, r.assignedAt, "plan", "blue", "Thay đổi kế hoạch: phân lệnh " + r.machineId, [st, lab].filter(Boolean).join(" · "), r.assignedBy, tgt);
    add("rs:" + r.id, r.startedAt, "run_start", "green", "Bắt đầu sản xuất · " + r.machineId, [st, lab].filter(Boolean).join(" · "), r.operator, tgt);
    (r.pauses || []).forEach((p, i) => {
      if (!p || p.cancelled) return;
      add("rp:" + r.id + ":" + i, p.at, "run_pause", "amber", "Tạm dừng máy " + r.machineId, [p.reason, lab].filter(Boolean).join(" · "), p.by, tgt);
      if (p.resumedAt && !p.closedByFinish) add("rr:" + r.id + ":" + i, p.resumedAt, "run_resume", "green", "Tiếp tục chạy máy " + r.machineId, lab, p.resumedBy, tgt);
    });
    if (r.productionStatus === "completed") add("re:" + r.id, r.endedAt, "run_end", "blue", "Kết thúc sản xuất · " + r.machineId, [st, lab, "đã làm " + fmtNum(Number(r.producedQuantity) || 0) + " " + (r.unit || (o ? amgOrderUnit(o) : "kg"))].filter(Boolean).join(" · "), r.endedBy, tgt);
    if (r.productionStatus === "cancelled") add("rx:" + r.id, r.endedAt, "run_cancel", "red", "Hủy lệnh sản xuất · " + r.machineId, [st, lab, r.closeNote].filter(Boolean).join(" · "), r.endedBy, tgt);
  });
  if (can.machines) machines.forEach(m => {
    if (!m.updatedAt || !m.updatedBy || m.updatedBy === "system") return; // dòng gieo mặc định của hệ thống không phải sự kiện thật
    const lab = (MACHINE_STATUS[m.status] || {}).label || m.status || "";
    add("ms:" + m.id + ":" + String(m.updatedAt), m.updatedAt, "machine_status", m.status === "broken" ? "red" : "amber", "Máy " + m.id + " → " + lab, m.note || "", m.updatedBy, { tab: "machines", focus: { screen: "monitor", machineId: m.id } });
  });
  audit.forEach(a => {
    if (!a || !a.type) return;
    if (a.type === "production_entry") {
      if (!(can.orders || can.plan)) return;
      add("au:" + (a.id || a.ts), a.ts, "output", "green", "Ghi sản lượng " + fmtNum(Number(a.qty) || 0) + " " + (a.unit || (orderById[a.targetId] ? amgOrderUnit(orderById[a.targetId]) : "kg")), [amgStageLabel(a.stageKey), a.machineId, a.customer, a.spec].filter(Boolean).join(" · "), a.user, a.machineId ? { tab: "machines", focus: { screen: "monitor", machineId: a.machineId } } : (a.targetId && orderById[a.targetId] ? { tab: orderById[a.targetId].status === "completed" ? "completed" : "orders", focus: { orderId: a.targetId } } : null));
    } else if (a.type === "scrap_add") {
      if (!can.quality) return;
      add("au:" + (a.id || a.ts), a.ts, "scrap", "red", "Ghi nhận phế liệu", a.detail || "", a.user, { tab: "qc", focus: null });
    } else if (power && a.detail) {
      // hoạt động quản lý (xóa/mở lại đơn, phân quyền…) chỉ Admin/Quản đốc thấy
      add("au:" + (a.id || a.ts), a.ts, "manage", "violet", "Hoạt động quản lý", a.detail, a.user, null);
    }
  });
  const seen = {}, out = [];
  ev.sort((x, y) => y.at - x.at).forEach(e => { if (seen[e.id]) return; seen[e.id] = 1; out.push(e); });
  return out.slice(0, limit || 60);
}

/* ---------- Cảnh báo & việc cần xử lý ---------- */
const AMG_OV_PRIORITY = { err: "Cao", warn: "Trung bình", info: "Thấp" };
function amgOvAlerts({ ex, data, runs, machines, orders, stageRows, nowMs, syncState }) {
  const out = [], can = ex.scope.can, today = amgTodayKey(new Date(nowMs));
  const add = (id, level, title, detail, at, target, kind) => out.push({ id, level, priority: AMG_OV_PRIORITY[level], title, detail: detail || "", at: at === undefined ? null : at, target: target || null, kind: kind || "" });
  const orderById = {}; orders.forEach(o => { orderById[o.id] = o; });
  /* (1) Cảnh báo máy / đơn của chính màn hình Giám sát máy móc (cùng bộ luật, có đối tượng cụ thể) */
  if ((can.machines || can.plan || can.orders) && typeof amgCcAlerts === "function") {
    amgCcAlerts(machines, runs, orders, nowMs).forEach(a => {
      const isOrder = a.type === "overdue" || a.type === "unassigned" || a.type === "waiting" || a.type === "short";
      if (isOrder && !(can.orders || can.plan)) return;
      if (!isOrder && !can.machines) return;
      let target = null, at = null, kind = a.type;
      if (a.type === "broken") { target = { tab: "machines", focus: { screen: "monitor", machineId: a.machineId } }; const m = machines.find(x => x.id === a.machineId); at = m && m.updatedAt && m.updatedBy !== "system" ? m.updatedAt : null; }
      else if (a.type === "paused") {
        target = { tab: "machines", focus: { screen: "monitor", machineId: a.machineId } };
        const run = (runs || []).find(r => r.machineId === a.machineId && r.productionStatus === "paused"), ps = run ? (run.pauses || []).filter(p => !p.cancelled && !p.resumedAt).slice(-1)[0] : null;
        at = ps ? ps.at : null; kind = "abnormal_stop";
      }
      else if (a.type === "idle") { target = { tab: "machines", focus: { screen: "monitor" }, groupKey: a.groupKey }; kind = "machine_unassigned"; }
      else if (a.type === "overdue") { target = { tab: "orders", focus: { orderId: a.orderId } }; const o = orderById[a.orderId]; at = o && o.deliveryDate ? String(o.deliveryDate).slice(0, 10) : null; }
      else if (a.type === "unassigned" || a.type === "waiting") target = { tab: "machines", focus: { orderDetail: a.orderId } };
      else if (a.type === "short") target = { tab: "orders", focus: { orderId: a.orderId } };
      add("cc:" + a.id, a.sev, a.title, a.detail, at, target, kind);
    });
  }
  /* (2) Công đoạn chậm tiến độ (từ bảng tiến độ công đoạn) */
  if (can.orders || can.plan) stageRows.forEach(s => {
    if (s.status !== "late" && s.status !== "warn") return;
    add("stage:" + s.key, s.status === "late" ? "err" : "warn", `Công đoạn ${s.label} chậm tiến độ`,
      [s.overdue ? `${s.overdue} đơn trễ hạn` : "", s.atRisk ? `${s.atRisk} đơn sắp đến hạn/có nguy cơ chậm` : ""].filter(Boolean).join(" · ") + " (công đoạn chưa xong)", null, { tab: "orders", focus: { stage: s.key } }, "slow_stage");
  });
  /* (3) Thiếu dữ liệu sản xuất: lệnh đang chạy từ ngày trước mà chưa ghi sản lượng; đơn đang mở thiếu ngày giao/số lượng */
  if (can.orders || can.plan) {
    const stale = runs.filter(r => amgIsOpenRun(r) && r.productionStatus === "running" && (Number(r.producedQuantity) || 0) <= 0 && amgOvDay(r.startedAt) && amgOvDay(r.startedAt) < today);
    if (stale.length) add("data:norun-output", "warn", `${stale.length} lệnh đang chạy từ ngày trước nhưng chưa ghi sản lượng`, stale.slice(0, 5).map(r => r.machineId).join(", ") + (stale.length > 5 ? "…" : ""), null, { tab: "machines", focus: { screen: "monitor", machineId: stale[0].machineId } }, "missing_data");
    const noDue = ex.orders.rows.filter(r => !r.o.deliveryDate), noQty = ex.orders.rows.filter(r => !(Number(r.o.quantity) > 0));
    if (noDue.length) add("data:no-due", "info", `${noDue.length} đơn đang mở chưa có ngày giao hàng`, noDue.slice(0, 4).map(r => amgOrderLabel(r.o)).join(", ") + (noDue.length > 4 ? "…" : ""), null, { tab: "orders", focus: { orderId: noDue[0].o.id } }, "missing_data");
    if (noQty.length) add("data:no-qty", "info", `${noQty.length} đơn đang mở chưa có số lượng đặt`, noQty.slice(0, 4).map(r => amgOrderLabel(r.o)).join(", ") + (noQty.length > 4 ? "…" : ""), null, { tab: "orders", focus: { orderId: noQty[0].o.id } }, "missing_data");
  }
  /* (4) Lỗi đồng bộ (trạng thái kết nối thật của lớp dữ liệu) */
  if (syncState) {
    const v = amgSyncView(syncState, nowMs);
    if (v.tone === "err" || v.tone === "warn") add("sync:" + v.key, v.tone === "err" ? "err" : "warn", v.label, v.title, syncState.lastSync || null, null, "sync");
  }
  /* (5) Cảnh báo nghiệp vụ khác đã có (đã lọc theo quyền): không lặp lại những mục (1) đã có đối tượng cụ thể */
  const dup = { "m-broken": 1, "o-late": 1, "o-unassigned": 1, "r-paused": 1 };
  (ex.alerts || []).forEach(a => { if (dup[a.id]) return; add("ex:" + a.id, a.level, a.title, a.detail, null, { tab: a.tab, focus: null }, "other"); });
  const rank = { err: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/* ---------- Hàm chính ---------- */
// data: { orders, machines, staff, scrap, attendance, auditLog, runs, extra }; user: tài khoản đăng nhập
// opts: { now, period: day|week|month|custom, from, to, syncState }
function amgOvCompute(data, user, opts) {
  const o2 = opts || {};
  const now = o2.now || new Date(), nowMs = now.getTime(), todayKey = amgTodayKey(now);
  const range = amgOvRange(o2.period, o2.from, o2.to, now);
  const ex = amgComputeExecutive(data, user, { period: "month", now });
  const sc = ex.scope, can = sc.can, power = sc.power;
  const orders = data.orders || [], machines = data.machines || [];
  const runs = (data.runs || []).filter(amgRunHasRefs), audit = data.auditLog || [];
  const orderById = {}; orders.forEach(o => { orderById[o.id] = o; });
  const rows = ex.orders.rows;                                   // đơn ĐANG MỞ (chưa hoàn thành)
  const completed = orders.filter(o => o.status === "completed");
  const items = rows.map(r => amgOvOrderItem(r, runs, now));

  /* ---- KPI đơn hàng ---- */
  const total = orders.length, hasOrders = total > 0;
  const producing = items.filter(i => i.producing).length, waitingN = items.length - producing;
  const overdue = items.filter(i => i.overdue).length;
  const hasCreated = orders.some(o => amgOvDay(o.createdAt)), createdToday = orders.filter(o => amgOvDay(o.createdAt) === todayKey).length;
  const doneToday = completed.filter(o => amgOvDay(o.completedAt) === todayKey).length;
  const pctOf = (n, d) => (d > 0 ? Math.round(n / d * 1000) / 10 : null);

  /* ---- Máy ---- */
  const cards = ex.machines.cards;                                // [{m, st, unknown, run}]
  const mCount = amgOvZeroCounts(); cards.forEach(c => amgOvAddCount(mCount, c));
  const cardOf = {}; cards.forEach(c => { cardOf[c.m.id] = c; });
  const groups = amgOvGroups(cards.map(c => c.m)).map(g => {   // đủ 10 nhóm (nhóm chưa có máy vẫn hiện, "Máy khác" chỉ hiện khi có máy lạ)
    const c = amgOvZeroCounts(), list = g.machines.map(m => {
      const cd = cardOf[m.id]; amgOvAddCount(c, cd);
      const r = cd.run, o = r ? orderById[r.orderId] : null, planned = r ? Number(r.plannedQuantity) || 0 : 0, produced = r ? Number(r.producedQuantity) || 0 : 0;
      return { id: m.id, state: cd.st, unknown: cd.unknown, bucket: amgOvBucketOf(cd.st), note: m.note || "", runId: r ? r.id : "", orderId: r ? r.orderId : "", order: o ? amgOrderLabel(o) : "", stageLabel: r ? amgStageLabel(r.stageKey) : "", operator: r ? r.operator || "" : "", pct: r && planned > 0 ? Math.round(Math.min(999, produced / planned * 100)) : null };
    });
    const flags = [];
    if (c.broken) flags.push(`${c.broken} máy hỏng/dừng`);
    if (c.paused) flags.push(`${c.paused} tạm dừng`);
    if (c.maintenance) flags.push(`${c.maintenance} bảo trì`);
    return Object.assign({ key: g.key, label: g.label, short: g.short, color: g.color, stage: g.stage, list, flags, rate: c.total ? Math.round(c.running / c.total * 1000) / 10 : null }, c);
  });

  /* ---- Tiến độ theo công đoạn (6 công đoạn thật; không đổi quy trình) ---- */
  const exStage = {}; ex.stageRows.forEach(s => { exStage[s.key] = s; });
  const stageRows = STAGES.map(s => {
    const inRoute = rows.filter(r => amgOrderRoute(r.o).indexOf(s.key) > -1);
    const open = inRoute.filter(r => !amgStageComplete(r.o, s.key));
    const ovd = open.filter(r => r.life.overdue).length, soon = open.filter(r => !r.life.overdue && (r.life.dueSoon || r.risk)).length;
    const mc = amgOvZeroCounts(); cards.filter(c => amgMachineStage(c.m) === s.key).forEach(c => amgOvAddCount(mc, c));
    const es = exStage[s.key], units = es ? es.units : [], byUnit = es ? es.byUnit : {};
    const main = units.indexOf("kg") > -1 ? "kg" : units[0] || null;
    const pct = main ? byUnit[main].pct : null;
    const status = !units.length ? "none" : ovd > 0 ? "late" : soon > 0 ? "warn" : "ok";
    return { key: s.key, label: s.label, color: s.color, orders: inRoute.length, machines: mc, units, byUnit, mainUnit: main, pct, overdue: ovd, atRisk: soon, status, periodOut: es ? es.periodOut : { kg: 0, m: 0, n: 0 } };
  });

  /* ---- Sản lượng theo kỳ (nhật ký production_entry) ---- */
  const lastStageOf = o => { const r = amgOrderRoute(o); return r[r.length - 1]; };
  const entries = audit.filter(a => a && a.type === "production_entry" && typeof a.qty === "number" && typeof a.date === "string" && (!sc.stages || sc.stages.indexOf(a.stageKey) > -1));
  const unitOf = e => amgUnitOf(e, orderById);
  const fin = entries.filter(e => { const o = orderById[e.targetId]; return !!o && lastStageOf(o) === e.stageKey; });
  const inR = list => list.filter(e => e.date >= range.from && e.date <= range.to);
  const finR = inR(fin), allR = inR(entries);
  const sumUnits = list => { const t = { kg: 0, m: 0, n: 0 }; list.forEach(e => { amgAddU(t, unitOf(e), e.qty); t.n++; }); return t; };
  let buckets = [];
  if (range.key === "day") {
    buckets = [["ngay", "Ca ngày"], ["dem", "Ca đêm"], ["khac", "Chưa rõ ca"]].map(([k, l]) => ({ key: k, label: l, sub: "", kg: 0, m: 0, n: 0 }));
    finR.forEach(e => { const b = buckets.find(x => x.key === amgShiftOfEntry(e)); amgAddU(b, unitOf(e), e.qty); b.n++; });
    buckets = buckets.filter(b => b.n > 0 || b.key !== "khac");
  } else {
    const days = amgOvDayList(range.from, range.to), weekly = days.length > 31;
    const byKey = {};
    days.forEach(k => {
      const bk = weekly ? getBucketKey(k, "week") : k;
      if (!byKey[bk]) { byKey[bk] = { key: bk, label: weekly ? amgOvShort(bk) : (range.key === "week" ? AMG_OV_WD[new Date(k + "T12:00:00").getDay()] : k.slice(8)), sub: weekly ? "Tuần" : amgOvShort(k), kg: 0, m: 0, n: 0 }; buckets.push(byKey[bk]); }
    });
    finR.forEach(e => { const bk = weekly ? getBucketKey(e.date, "week") : e.date, b = byKey[bk]; if (b) { amgAddU(b, unitOf(e), e.qty); b.n++; } });
  }
  const output = { range, total: sumUnits(finR), allStages: sumUnits(allR), buckets, hasData: finR.length > 0, bucketLabel: range.key === "day" ? "ca" : (range.days > 31 ? "tuần" : "ngày") };
  const stageOutput = STAGES.map(s => ({ key: s.key, label: s.label, color: s.color, out: sumUnits(allR.filter(e => e.stageKey === s.key)) }));

  /* ---- Kế hoạch SX: lệnh sản xuất (kế hoạch) so với thực hiện ---- */
  const planRuns = runs.filter(r => r.productionStatus !== "cancelled" && (amgIsOpenRun(r) || (r.productionStatus === "completed" && amgOvDay(r.endedAt) >= range.from && amgOvDay(r.endedAt) <= range.to)));
  const runPlan = { kg: 0, m: 0 }, runDone = { kg: 0, m: 0 };
  planRuns.forEach(r => { const o = orderById[r.orderId], u = r.unit === "m" || r.unit === "kg" ? r.unit : (o ? amgOrderUnit(o) : "kg"), p = Number(r.plannedQuantity) || 0; if (p <= 0) return; amgAddU(runPlan, u, p); amgAddU(runDone, u, Math.min(Number(r.producedQuantity) || 0, p)); });
  const runPct = {}; ["kg", "m"].forEach(u => { if (runPlan[u] > 0) runPct[u] = Math.round(runDone[u] / runPlan[u] * 1000) / 10; });

  /* ---- Biểu đồ phụ: tiến độ đơn, tình trạng máy ---- */
  const prog = [["Chưa bắt đầu", i => !(i.done > 0), "textFaint"], ["Dưới 50%", i => i.done > 0 && (i.pct === null || i.pct < 50), "amber"], ["50% – dưới 100%", i => i.pct !== null && i.pct >= 50 && i.pct < 100, "blue"], ["Đủ số lượng, chờ hoàn thành đơn", i => i.pct !== null && i.pct >= 100, "green"]].map(([label, f, tone]) => ({ label, tone, n: items.filter(f).length }));
  const orderProgress = { buckets: prog, open: items.length, completed: completed.length, total, completionRate: pctOf(completed.length, total) };
  const machineStatus = [["running", "Đang chạy", "green"], ["assigned", "Đã phân lệnh, chờ chạy", "blue"], ["idle", "Rảnh (chưa có lệnh)", "textFaint"], ["unknown", "Chưa xác nhận trạng thái", "textFaint"], ["paused", "Tạm dừng", "amber"], ["maintenance", "Bảo trì", "violet"], ["broken", "Hỏng / dừng", "red"]].map(([k, l, t]) => ({ key: k, label: l, tone: t, n: mCount[k] || 0 }));

  /* ---- KPI (mỗi thẻ có đích điều hướng + nguồn dữ liệu) ---- */
  const dash = null;
  const planPctText = obj => ["kg", "m"].filter(u => obj[u] !== undefined).map(u => `${obj[u]}% ${u}`).join(" · ");
  const mainPct = obj => (obj.kg !== undefined ? obj.kg : obj.m !== undefined ? obj.m : null);
  const kpis = [];
  if (can.orders) kpis.push(
    { key: "orders_total", label: "Tổng đơn hàng", value: hasOrders ? total : dash, tone: "blue", icon: "ClipboardList", sub: hasOrders ? (hasCreated ? `${createdToday} đơn mới hôm nay` : `${items.length} đang mở · ${completed.length} hoàn thành`) : "Chưa có đơn hàng nào", delta: hasCreated && createdToday > 0 ? "+" + createdToday : null, target: { tab: "orders", focus: null }, source: "orders — mọi đơn (đang mở + đã hoàn thành)" },
    { key: "orders_producing", label: "Đơn đang sản xuất", value: hasOrders ? producing : dash, tone: "green", icon: "Factory", sub: hasOrders ? (pctOf(producing, total) !== null ? `${pctOf(producing, total)}% tổng đơn` : "") : "", target: { tab: "orders", focus: { status: "producing" } }, source: "orders + productionRuns — đơn mở đã có sản lượng hoặc lệnh đang chạy/tạm dừng (amgOrderLifecycle)" },
    { key: "orders_waiting", label: "Đơn chờ sản xuất", value: hasOrders ? waitingN : dash, tone: "amber", icon: "Hourglass", sub: hasOrders ? (pctOf(waitingN, total) !== null ? `${pctOf(waitingN, total)}% tổng đơn` : "") : "", target: { tab: "machines", focus: null }, source: "orders + productionRuns — đơn mở chưa có sản lượng/lệnh chạy" },
    { key: "orders_done", label: "Đơn hàng hoàn thành", value: hasOrders ? completed.length : dash, tone: "green", icon: "CheckCircle2", sub: hasOrders ? (hasCreated || completed.some(o => o.completedAt) ? `+${doneToday} hôm nay` : (pctOf(completed.length, total) !== null ? `${pctOf(completed.length, total)}% tổng đơn` : "")) : "", delta: doneToday > 0 ? "+" + doneToday : null, target: { tab: "completed", focus: null }, source: "orders — status = completed (completedAt cho số hôm nay)" },
    { key: "orders_overdue", label: "Đơn hàng trễ hạn", value: hasOrders ? overdue : dash, tone: overdue ? "red" : "green", icon: "AlertCircle", sub: hasOrders ? (overdue ? `${pctOf(overdue, total)}% tổng đơn` : "Không có đơn trễ") : "", target: { tab: "orders", focus: { status: "overdue" } }, source: "orders.deliveryDate < hôm nay, đơn chưa hoàn thành" });
  if (can.machines) kpis.push(
    { key: "machines_total", label: "Tổng số máy móc", value: mCount.total || dash, unit: mCount.total ? "máy" : "", tone: "blue", icon: "Cog", sub: mCount.total ? `${groups.filter(g => g.total > 0).length} nhóm máy` : "Chưa có dữ liệu máy", target: { tab: "machines", focus: { screen: "monitor" }, groupKey: "all" }, source: "machines — toàn bộ danh sách máy thật (không thêm/xóa/đổi mã)" },
    { key: "machines_running", label: "Máy đang chạy", value: mCount.total ? mCount.running : dash, unit: mCount.total ? "máy" : "", tone: "green", icon: "Play", sub: mCount.total ? `${pctOf(mCount.running, mCount.total)}% tổng máy` : "", target: { tab: "machines", focus: { screen: "monitor", status: "running" }, groupKey: "all" }, source: "machines + productionRuns — máy có lệnh đang chạy (amgMachineCardState = running)" },
    { key: "machines_stopped", label: "Máy dừng / chờ", value: mCount.total ? mCount.waiting + mCount.stopped : dash, unit: mCount.total ? "máy" : "", tone: mCount.stopped ? "amber" : "blue", icon: "Pause", sub: mCount.total ? `${mCount.stopped} dừng · ${mCount.waiting} chờ · ${pctOf(mCount.waiting + mCount.stopped, mCount.total)}%` : "", target: { tab: "machines", focus: { screen: "monitor", status: mCount.stopped ? "paused" : "idle" }, groupKey: "all" }, source: "machines + productionRuns — dừng = tạm dừng + bảo trì + hỏng; chờ = đã phân lệnh chưa chạy + rảnh/chưa xác nhận" });
  if (can.orders || can.plan) {
    const pk = ex.plan.pct, hasPk = Object.keys(pk).length > 0, hasRp = Object.keys(runPct).length > 0;
    kpis.push(
      { key: "progress", label: "Tiến độ sản xuất", value: hasPk ? planPctText(pk) : dash, tone: "violet", icon: "TrendingUp", pct: hasPk ? mainPct(pk) : null, sub: hasPk ? `Đã làm ${amgFmtUnits(ex.plan.done)} / ${amgFmtUnits(ex.plan.plan)}` : "Chưa có đơn đang mở", target: { tab: "orders", focus: null }, source: "orders — Σ thành phẩm ÷ Σ số lượng đặt của đơn đang mở (kg và m tách riêng)" },
      { key: "plan_rate", label: "Hoàn thành kế hoạch", value: hasRp ? planPctText(runPct) : dash, tone: "blue", icon: "CheckCircle2", pct: hasRp ? mainPct(runPct) : null, sub: hasRp ? `Lệnh SX: ${amgFmtUnits(runDone)} / ${amgFmtUnits(runPlan)}` : "Chưa có lệnh sản xuất trong kỳ", target: { tab: "machines", focus: null }, source: "productionRuns — Σ sản lượng thực hiện ÷ Σ kế hoạch của lệnh đang mở + lệnh kết thúc trong kỳ lọc" });
  }

  const hidden = [[can.orders, "Đơn hàng"], [can.plan, "Kế hoạch / Điều hành"], [can.machines, "Máy móc"], [can.quality, "Chất lượng"]].filter(x => !x[0]).map(x => x[1]);
  return {
    now, nowMs, todayKey, range, scope: sc, can, power, hidden, kpis,
    counts: { orders: total, open: items.length, producing, waiting: waitingN, completed: completed.length, overdue, machines: mCount },
    stageRows, groups, orderItems: items,
    attention: {
      counts: { overdue: items.filter(i => i.overdue).length, soon: items.filter(i => i.dueSoon && !i.overdue).length, producing: items.filter(i => i.producing).length, unassigned: items.filter(i => i.unassigned).length, risk: items.filter(i => i.risk).length },
      customers: [...new Set(items.map(i => i.customer || "Chưa rõ"))].sort((a, b) => a.localeCompare(b, "vi"))
    },
    charts: { output, stageOutput, planVsActual: stageRows.map(s => ({ key: s.key, label: s.label, color: s.color, byUnit: s.byUnit, units: s.units })), orderProgress, machineStatus },
    alerts: amgOvAlerts({ ex, data, runs, machines, orders, stageRows, nowMs, syncState: o2.syncState }),
    activity: amgOvActivity(data, can, power, 60)
  };
}
