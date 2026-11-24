/* ===================== TỔNG QUAN ĐIỀU HÀNH (v49) =====================
   Hàm thuần túy cho Dashboard điều hành: CHỈ tính từ dữ liệu thật truyền vào (đơn, máy, lệnh, lượt sản lượng,
   phế liệu, phiếu kiểm/NG, chấm công). Không dữ liệu mẫu, không số tự tạo: thiếu dữ liệu → trả null/0 kèm cờ để
   giao diện hiện "Chưa có dữ liệu" rõ ràng.
   Nguyên tắc nghiệp vụ giữ nguyên:
   • kg và m KHÔNG bao giờ cộng lẫn: mọi tổng sản lượng là { kg, m }.
   • Phạm vi theo quyền: Admin/Quản đốc thấy toàn nhà máy; Nhân viên thuộc tổ sản xuất chỉ thấy công đoạn của tổ
     (TEAM_REPORT_STAGES), đúng như các trang Báo cáo/Tổng quan cũ. Mỗi phân hệ kiểm tra amgCan(user,"v",mod). */

const AMG_EXEC_PERIODS = { day: "Ngày", week: "Tuần", month: "Tháng" };
const AMG_EXEC_RISK_WINDOW_DAYS = 14;   // chỉ đánh giá "nguy cơ trễ hạn" cho đơn giao trong vòng 14 ngày
const AMG_EXEC_RISK_GAP = 15;           // chậm hơn tiến độ tuyến tính từ 15 điểm % trở lên = có nguy cơ

function amgExecScope(user) {
  const power = amgIsPower(user);
  const stages = power ? null : (TEAM_REPORT_STAGES[user && user.team] || null);
  const can = m => power || amgCan(user, "v", m);
  return {
    power, stages, team: !power && user ? user.team || "" : "",
    can: { orders: can("don"), plan: can("dieuhanh"), machines: can("may"), quality: can("qc"), hr: can("nhansu"), warehouse: can("kho"), maint: can("dung") }
  };
}

const amgUnitOf = (e, orderById) => {
  if (e && (e.unit === "m" || e.unit === "kg")) return e.unit;
  const o = e && orderById[e.targetId || e.orderId];
  return o ? amgOrderUnit(o) : "kg";
};
const amgAddU = (acc, unit, q) => { acc[unit] = Math.round(((acc[unit] || 0) + (Number(q) || 0)) * 100) / 100; return acc; };
// { kg: 1234, m: 0 } → "1.234 kg" ; { kg: 10, m: 5 } → "10 kg · 5 m" ; rỗng → "0 kg"
function amgFmtUnits(t) {
  const parts = ["kg", "m"].filter(u => t && t[u] > 0).map(u => `${fmtNum(t[u])} ${u}`);
  return parts.length ? parts.join(" · ") : "0 kg";
}
function amgShiftOfEntry(e) {
  const s = String(e.shift || "").toLowerCase();
  if (s === "ngay" || s === "dem") return s;
  const n = String(e.note || "").toLowerCase();
  if (n.indexOf("ca ngày") > -1) return "ngay";
  if (n.indexOf("ca đêm") > -1) return "dem";
  return "khac";
}
function amgDayShift(d, n) { return amgTodayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }

function amgComputeExecutive(data, user, opts) {
  const o2 = opts || {};
  const now = o2.now || new Date();
  const nowMs = now.getTime();
  const period = AMG_EXEC_PERIODS[o2.period] ? o2.period : "month";
  const range = amgPeriodRange(period, now);
  const todayKey = amgTodayKey(now);
  const sc = amgExecScope(user);
  const inScope = k => !sc.stages || sc.stages.indexOf(k) > -1;

  const orders = data.orders || [], machines0 = data.machines || [], staff0 = data.staff || [];
  const runs = (data.runs || []).filter(amgRunHasRefs), audit = data.auditLog || [], scrap0 = data.scrap || [];
  const extra = data.extra || {};
  const orderById = {}; orders.forEach(o => { orderById[o.id] = o; });
  const machineById = {}; machines0.forEach(m => { machineById[m.id] = m; });

  /* ---------- Đơn hàng ---------- */
  const inScopeOrder = o => amgOrderRoute(o).some(inScope);
  const activeAll = orders.filter(amgIsActiveOrder);
  const active = activeAll.filter(inScopeOrder);
  const rows = active.map(o => {
    const n = normalizeOrderStages(o);
    const prog = orderProgress(n);
    const life = amgOrderLifecycle(o, runs, now);
    const flow = amgIsFlowOrder(o);
    const bucket = flow ? amgPlanBucket(o, runs).bucket : "unconfirmed";
    // Nguy cơ trễ: chưa quá hạn, hạn giao ≤ 14 ngày, tiến độ thành phẩm chậm hơn đường tuyến tính (ngày nhận → ngày giao) từ 15 điểm %
    let risk = false, expected = null;
    if (!life.overdue && life.days !== null && life.days <= AMG_EXEC_RISK_WINDOW_DAYS && prog.pct !== null) {
      const start = o.orderDate ? new Date(String(o.orderDate).slice(0, 10) + "T00:00:00").getTime() : NaN;
      const due = new Date(String(o.deliveryDate).slice(0, 10) + "T00:00:00").getTime();
      const t0 = new Date(now.toDateString()).getTime();
      if (!Number.isNaN(start) && due > start) {
        expected = Math.max(0, Math.min(100, (t0 - start) / (due - start) * 100));
        risk = prog.pct < expected - AMG_EXEC_RISK_GAP;
      } else {
        risk = life.days <= AMG_DUE_SOON_DAYS && prog.pct < 80; // không có ngày nhận: dùng ngưỡng cố định
      }
    }
    return { o, n, prog, life, flow, bucket, risk, expected };
  });
  const cnt = { active: rows.length, unassigned: 0, unconfirmed: 0, producing: 0, soon: 0, overdue: 0, risk: 0, waiting: 0, fresh: 0 };
  rows.forEach(r => {
    if (r.bucket === "unassigned" || r.bucket === "waiting_next") cnt.unassigned++;
    if (r.bucket === "unconfirmed") cnt.unconfirmed++;
    if (r.life.key === "producing") cnt.producing++;
    if (r.life.dueSoon) cnt.soon++;
    if (r.life.overdue) cnt.overdue++;
    if (r.risk) cnt.risk++;
  });
  const completedAll = orders.filter(o => o.status === "completed" && inScopeOrder(o));
  const completedPeriod = completedAll.filter(o => amgInRange(String(o.completedAt || ""), range)).length;
  const lateOrders = rows.filter(r => r.life.overdue).sort((a, b) => a.life.days - b.life.days);
  const soonOrders = rows.filter(r => r.life.dueSoon).sort((a, b) => a.life.days - b.life.days);
  const riskOrders = rows.filter(r => r.risk).sort((a, b) => (a.life.days - b.life.days));
  const unassignedOrders = rows.filter(r => r.bucket === "unassigned" || r.bucket === "waiting_next");

  /* ---------- Máy ---------- */
  const mScoped = machines0.filter(m => !sc.stages || inScope(amgMachineStage(m)));
  const ms = { running: 0, assigned: 0, paused: 0, idle: 0, maintenance: 0, broken: 0, unknown: 0, total: mScoped.length };
  const mCards = mScoped.map(m => {
    const st = amgMachineCardState(m, runs);
    const unknown = st === "idle" && m.status === "unknown";
    ms[unknown ? "unknown" : st]++;
    return { m, st, unknown, run: amgOpenRunOfMachine(runs, m.id) };
  });
  // Theo công đoạn (sơ đồ giám sát): đếm trạng thái từng nhóm
  const byStage = [];
  STAGES.filter(s => inScope(s.key)).forEach(s => {
    const list = mCards.filter(c => amgMachineStage(c.m) === s.key);
    if (!list.length) return;
    const t = { key: s.key, label: s.label, color: s.color, total: list.length, running: 0, assigned: 0, paused: 0, idle: 0, maintenance: 0, broken: 0, unknown: 0 };
    list.forEach(c => { t[c.unknown ? "unknown" : c.st]++; });
    byStage.push(t);
  });

  /* ---------- Lệnh đang chạy (theo từng máy) ---------- */
  const stageRank = {}; STAGES.forEach((s, i) => { stageRank[s.key] = i; });
  const runRows = runs.filter(r => amgIsOpenRun(r) && inScope(r.stageKey)).map(r => {
    const o = orderById[r.orderId] || null, m = machineById[r.machineId] || null;
    const t = amgRunTiming(r, nowMs, o);
    const info = o ? amgStageInfo(o, runs, r.stageKey) : null;
    const days = o ? amgDaysToDue(o, now) : null;
    return { run: r, order: o, machine: m, timing: t, info, days, unit: t.unit,
      qty: o ? amgStageQty(o) : null, overdue: !!o && days !== null && days < 0, dueSoon: !!o && days !== null && days >= 0 && days <= AMG_DUE_SOON_DAYS };
  }).sort((a, b) => ((AMG_RUN_RANK[a.run.productionStatus] ?? 9) - (AMG_RUN_RANK[b.run.productionStatus] ?? 9)) || ((stageRank[a.run.stageKey] ?? 9) - (stageRank[b.run.stageKey] ?? 9)) || amgNaturalCmp(a.run.machineId, b.run.machineId));

  /* ---------- Sản lượng ---------- */
  const entries = audit.filter(a => a.type === "production_entry" && typeof a.qty === "number" && typeof a.date === "string" && inScope(a.stageKey));
  const lastStageOf = o => { const r = amgOrderRoute(o); return r[r.length - 1]; };
  const isFinished = e => { const o = orderById[e.targetId]; return !!o && lastStageOf(o) === e.stageKey; };
  const fin = entries.filter(isFinished);
  const sumIn = (list, from, to, shift) => { const t = { kg: 0, m: 0 }; let n = 0; list.forEach(e => { if (e.date >= from && e.date <= to && (!shift || amgShiftOfEntry(e) === shift)) { amgAddU(t, amgUnitOf(e, orderById), e.qty); n++; } }); t.n = n; return t; };
  const wk = amgPeriodRange("week", now), mo = amgPeriodRange("month", now);
  const out = {
    actual: sumIn(fin, range.from, range.to),            // thành phẩm trong kỳ đang chọn
    allStages: sumIn(entries, range.from, range.to),     // mọi công đoạn (kể cả bán thành phẩm)
    shiftDay: sumIn(fin, todayKey, todayKey, "ngay"), shiftNight: sumIn(fin, todayKey, todayKey, "dem"), shiftOther: sumIn(fin, todayKey, todayKey, "khac"),
    today: sumIn(fin, todayKey, todayKey), week: sumIn(fin, wk.from, wk.to), month: sumIn(fin, mo.from, mo.to)
  };
  // Kế hoạch & thực hiện của các đơn đang mở (tách theo đơn vị)
  const planU = { kg: 0, m: 0 }, doneU = { kg: 0, m: 0 };
  rows.forEach(r => { const u = amgOrderUnit(r.o); amgAddU(planU, u, r.o.quantity); amgAddU(doneU, u, Math.min(r.prog.completedQty || 0, r.o.quantity || 0)); });
  const pctU = {}; ["kg", "m"].forEach(u => { if (planU[u] > 0) pctU[u] = Math.round(doneU[u] / planU[u] * 1000) / 10; });
  // Công đoạn: kế hoạch (số lượng đặt) so với thực tế (đã làm) trên các đơn đang mở; sản lượng ghi nhận trong kỳ
  const stageRows = STAGES.filter(s => inScope(s.key)).map(s => {
    const byUnit = {};
    let lateOrdersN = 0;
    rows.forEach(r => {
      if (r.flow ? amgOrderRoute(r.o).indexOf(s.key) < 0 : getApplicableStages(r.o).indexOf(s.key) < 0) return;
      const u = amgOrderUnit(r.o); const b = byUnit[u] = byUnit[u] || { plan: 0, done: 0 };
      b.plan += Number(r.o.quantity) || 0; b.done += amgStageDone(r.o, s.key);
      if ((r.life.overdue || r.life.dueSoon || r.risk) && !amgStageComplete(r.o, s.key)) lateOrdersN++;
    });
    const periodOut = sumIn(entries.filter(e => e.stageKey === s.key), range.from, range.to);
    const units = Object.keys(byUnit).filter(u => byUnit[u].plan > 0);
    units.forEach(u => { byUnit[u].plan = Math.round(byUnit[u].plan * 100) / 100; byUnit[u].done = Math.round(byUnit[u].done * 100) / 100; byUnit[u].pct = Math.round(byUnit[u].done / byUnit[u].plan * 1000) / 10; });
    return { key: s.key, label: s.label, color: s.color, byUnit, units, periodOut, lateOrders: lateOrdersN };
  }).filter(r => r.units.length > 0 || r.periodOut.n > 0);
  const slowStages = stageRows.filter(r => r.lateOrders > 0).sort((a, b) => b.lateOrders - a.lateOrders);
  // 14 ngày gần nhất (thành phẩm) — dùng cho biểu đồ cột
  const days14 = [];
  for (let i = 13; i >= 0; i--) {
    const k = amgDayShift(now, -i);
    const t = sumIn(fin, k, k);
    days14.push({ key: k, label: k.slice(8) + "/" + k.slice(5, 7), kg: t.kg, m: t.m });
  }

  /* ---------- Chất lượng ---------- */
  const insp = (extra.inspections || []).filter(i => amgInRange(i.date, range));
  const inspPass = insp.filter(i => i.result === "dat").length, inspFail = insp.filter(i => i.result === "ng").length;
  const ncr = extra.ncr || [];
  const ncrOpen = ncr.filter(n => n.status && n.status !== "dong");
  const ncrOverdue = ncrOpen.filter(n => n.dueDate && n.dueDate < todayKey);
  const lotsWaiting = (extra.lots || []).filter(l => l.status === "cho_iqc");
  const lotsQuar = (extra.lots || []).filter(l => l.status === "cach_ly");
  const scrapIn = scrap0.filter(s => inScope(s.stage) && amgInRange(s.date, range));
  const scrapU = { kg: 0, m: 0 };
  scrapIn.forEach(s => amgAddU(scrapU, s.unit === "m" ? "m" : "kg", s.qty));
  // Tỷ lệ phế: phế liệu kg ÷ sản lượng ghi nhận kg (mọi công đoạn trong phạm vi) trong cùng kỳ
  const scrapRate = out.allStages.kg > 0 ? Math.round(scrapU.kg / out.allStages.kg * 10000) / 100 : null;
  const reasons = {}; scrapIn.forEach(s => { const k = String(s.reason || "Chưa ghi lý do").trim() || "Chưa ghi lý do"; reasons[k] = (reasons[k] || 0) + (Number(s.qty) || 0); });
  const topDefects = Object.keys(reasons).map(k => ({ name: k, qty: Math.round(reasons[k] * 100) / 100 })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const scrapByStage = {}; scrapIn.forEach(s => { scrapByStage[s.stage] = (scrapByStage[s.stage] || 0) + (Number(s.qty) || 0); });
  const worstStageKey = Object.keys(scrapByStage).sort((a, b) => scrapByStage[b] - scrapByStage[a])[0] || null;
  const scrapDays = [];
  for (let i = 13; i >= 0; i--) {
    const k = amgDayShift(now, -i);
    const q = scrap0.filter(s => s.date === k && inScope(s.stage)).reduce((a, s) => a + (Number(s.qty) || 0), 0);
    const ng = (extra.inspections || []).filter(x => x.date === k && x.result === "ng").length;
    scrapDays.push({ key: k, label: k.slice(8) + "/" + k.slice(5, 7), qty: Math.round(q * 100) / 100, ng });
  }
  const quality = {
    hasInspection: (extra.inspections || []).length > 0,
    checks: insp.length, pass: inspPass, fail: inspFail,
    passRate: insp.length ? Math.round(inspPass / insp.length * 1000) / 10 : null,
    failRate: insp.length ? Math.round(inspFail / insp.length * 1000) / 10 : null,
    ncrOpen, ncrOverdue, lotsWaiting, lotsQuar,
    scrap: scrapU, scrapRate, scrapCount: scrapIn.length, topDefects,
    worstStage: worstStageKey ? { key: worstStageKey, label: amgStageLabel(worstStageKey), qty: Math.round(scrapByStage[worstStageKey] * 100) / 100 } : null,
    trend: scrapDays, trendHas: scrapDays.some(d => d.qty > 0 || d.ng > 0)
  };

  /* ---------- Nhân sự ---------- */
  const team = sc.team || null;
  const staff = staff0.filter(s => !team || s.team === team);
  const day = (data.attendance || {})[todayKey] || {};
  const recorded = Object.keys(day).length > 0;
  let present = 0, absent = 0, caNgay = 0, caDem = 0;
  const deptMap = {};
  staff.forEach(s => {
    const st = day[s.id] || {};
    const here = !!(st.caNgay || st.caDem || st.daoCa);
    const away = !!(st.nghiPhep || st.nghiKhongPhep);
    if (here) present++; else if (away) absent++;
    if (st.caNgay) caNgay++;
    if (st.caDem) caDem++;
    const d = deptMap[s.team || "Chưa phân tổ"] = deptMap[s.team || "Chưa phân tổ"] || { team: s.team || "Chưa phân tổ", total: 0, present: 0 };
    d.total++; if (here) d.present++;
  });
  const operators = {};
  runs.filter(r => amgIsOpenRun(r) && r.productionStatus !== "assigned" && inScope(r.stageKey)).forEach(r => { const n = String(r.operator || "").trim(); if (n) operators[n] = (operators[n] || 0) + 1; });
  const hr = {
    total: staff.length, recorded, present, absent, caNgay, caDem,
    notRecorded: recorded ? Math.max(0, staff.length - present - absent) : staff.length,
    depts: Object.keys(deptMap).map(k => deptMap[k]).sort((a, b) => b.total - a.total),
    operators: Object.keys(operators).length
  };

  /* ---------- Cảnh báo (thật, có mức ưu tiên + nơi xử lý) ---------- */
  const base = amgComputeAlerts({ orders: activeAll.filter(inScopeOrder), machines: mScoped, attendance: sc.can.hr ? data.attendance : {}, now, extra: sc.can.quality || sc.can.warehouse || sc.can.maint ? extra : {} });
  const alerts = base.filter(a => {
    const map = { machines: "machines", orders: "orders", staff: "hr", inspect: "quality", warehouse: "warehouse", maintenance: "maint", docs: null };
    const need = map[a.tab];
    return !need || sc.can[need];
  });
  if (cnt.unassigned) alerts.push({ id: "o-unassigned", level: "warn", title: `${cnt.unassigned} đơn chưa phân lệnh vào máy`, detail: unassignedOrders.slice(0, 4).map(r => r.o.id).join(", "), tab: "machines" });
  if (cnt.unconfirmed) alerts.push({ id: "o-unconfirmed", level: "info", title: `${cnt.unconfirmed} đơn chưa xác nhận quy trình`, detail: "Chưa thể phân lệnh", tab: "orders" });
  if (cnt.risk) alerts.push({ id: "o-risk", level: "warn", title: `${cnt.risk} đơn chậm tiến độ, có nguy cơ trễ hạn`, detail: riskOrders.slice(0, 4).map(r => r.o.id).join(", "), tab: "orders" });
  const pausedRuns = runRows.filter(r => r.run.productionStatus === "paused");
  if (pausedRuns.length) alerts.push({ id: "r-paused", level: "warn", title: `${pausedRuns.length} lệnh đang tạm dừng`, detail: pausedRuns.slice(0, 4).map(r => r.run.machineId).join(", "), tab: "machines" });
  const rank = { err: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => rank[a.level] - rank[b.level]);

  return { range, period, scope: sc, todayKey,
    orders: { counts: cnt, completedAll: completedAll.length, completedPeriod, rows, late: lateOrders, soon: soonOrders, risk: riskOrders, unassigned: unassignedOrders },
    machines: { counts: ms, cards: mCards, byStage }, runs: runRows,
    output: out, plan: { plan: planU, done: doneU, pct: pctU }, stageRows, slowStages, days14,
    quality, hr, alerts };
}
