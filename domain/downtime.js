/* ===================== NGHIỆP VỤ THEO DÕI THỜI GIAN DỪNG MÁY (v55) =====================
   NGUỒN DỮ LIỆU DUY NHẤT (Single Source of Truth):
     • Kế hoạch sản xuất → productionRuns[].pauses[]  (mỗi lần "Tạm dừng" của lệnh máy = một sự kiện dừng máy)
     • Thẻ máy          → machines[].downtimeLog[]    (dữ liệu cũ: đổi trạng thái máy hỏng / bảo trì)
   Tab Theo dõi KHÔNG lưu bản sao. Mọi sự kiện được DỰNG LẠI từ hai nguồn trên mỗi lần dữ liệu thay đổi (realtime),
   nên không thể trùng lặp, không thể lệch, không có vòng lặp đồng bộ.
   Collection downtimeEvents chỉ là SỔ LỊCH SỬ (ai tạo, ai sửa, trước/sau, hủy/xóa) — không phải nguồn số liệu.
   File này thuần tính toán (không React, không Firebase) để kiểm thử được độc lập. */

const AMG_DT_COLS = { events: "downtimeEvents", settings: "downtimeSettings" };
const AMG_DT_SETTINGS_ID = "thresholds";

// Ngưỡng mặc định (Admin/Quản đốc chỉnh được theo từng máy). Đây là giá trị cài đặt, không phải số liệu sản xuất.
const AMG_DT_DEFAULTS = { maxEventMin: 60, maxEventsPerDay: 3, minAvailabilityPct: 80, surgePct: 50, surgeMinMin: 30, repeatCount: 3 };

/* ---------- Phân loại nguyên nhân (chỉ đọc chữ nhân viên đã ghi; KHÔNG sửa nguyên nhân gốc) ---------- */
const AMG_DT_CLASSES = {
  breakdown: { label: "Sự cố", short: "Sự cố" },
  planned: { label: "Có kế hoạch", short: "Kế hoạch" },
  other: { label: "Dừng chờ / khác", short: "Chờ/khác" }
};
// Thứ tự kiểm tra quan trọng: cụm cụ thể trước, "khác" sau cùng
const AMG_DT_CATS = [
  { key: "power", label: "Mất điện", cls: "breakdown", re: /mat dien|cup dien|sut ap|dien luoi|nguon dien|mat nguon|nhay dien/ },
  { key: "equipment", label: "Sự cố thiết bị", cls: "breakdown", re: /hong|su co|\bket\b|motor|dong co|bac dan|truc trac|loi may|loi thiet bi|ro ri|cam bien|bien tan|khong chay|het nuoc|mat nuoc|ngat may|may dung/ },
  { key: "changeover", label: "Chuyển đổi quy cách", cls: "planned", re: /chuyen (doi )?(quy cach|ma|size|don|san pham|lenh)|doi (quy cach|ma|size|khuon|don|san pham|lenh)|set ?up|thay (quy cach|size|ma|khuon|puli|cuon)|cai dat lai/ },
  { key: "mold", label: "Chờ khuôn", cls: "other", re: /khuon|\bdies?\b/ },
  { key: "material", label: "Chờ nguyên liệu", cls: "other", re: /(cho|het|thieu|chua co|chua ve)( \S+){0,2} (nguyen lieu|nguyen vat lieu|nvl|vat tu|dong|day|nhua|hat|phoi|cuon|thiec|bao bi)|nguyen lieu/ },
  { key: "order", label: "Chờ lệnh sản xuất", cls: "other", re: /(cho|chua co|het|doi) (lenh|ke hoach|don hang|don|kh)\b|khong co (lenh|ke hoach|don)/ },
  { key: "manpower", label: "Thiếu nhân lực", cls: "other", re: /thieu (nhan|nguoi|cong nhan|lao dong|nhan luc)|\bvang\b|nghi (viec|om|phep)|khong co nguoi|chua co nguoi|cho nguoi/ },
  { key: "maintenance", label: "Bảo trì, sửa chữa", cls: "planned", re: /bao tri|bao duong|sua chua|ve sinh|thay (dau|dao|linh kien|phu tung|bang tai|curoa)|tra dau|kiem tra may|can chinh|hieu chuan/ },
  { key: "other", label: "Nguyên nhân khác", cls: "other", re: null }
];
const AMG_DT_CAT_BY_KEY = {};
AMG_DT_CATS.forEach(c => { AMG_DT_CAT_BY_KEY[c.key] = c; });

function amgDtNorm(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
}
// statusHint: dùng cho dữ liệu Thẻ máy khi nguyên nhân để trống (broken → sự cố, maintenance → bảo trì)
function amgDtClassify(reason, statusHint) {
  const t = amgDtNorm(reason);
  if (t) {
    for (const c of AMG_DT_CATS) if (c.re && c.re.test(t)) return { key: c.key, label: c.label, cls: c.cls, by: "reason" };
  }
  if (statusHint === "broken") return { key: "equipment", label: "Sự cố thiết bị", cls: "breakdown", by: "status" };
  if (statusHint === "maintenance") return { key: "maintenance", label: "Bảo trì, sửa chữa", cls: "planned", by: "status" };
  return { key: "other", label: "Nguyên nhân khác", cls: "other", by: t ? "reason" : "none" };
}

/* ---------- Ca ---------- */
function amgDtShift(raw, startMs) {
  const s = amgDtNorm(raw);
  if (s === "ngay" || s.indexOf("ca ngay") > -1) return { key: "ngay", label: "Ca Ngày", derived: false };
  if (s === "dem" || s.indexOf("ca dem") > -1) return { key: "dem", label: "Ca Đêm", derived: false };
  if (Number.isFinite(startMs) && typeof amgCurrentShift === "function") {
    const k = amgCurrentShift(new Date(startMs)).key;
    return k === "caDem" ? { key: "dem", label: "Ca Đêm", derived: true } : { key: "ngay", label: "Ca Ngày", derived: true };
  }
  return { key: "khac", label: "Chưa rõ ca", derived: false };
}

const amgDtDateKey = ms => (Number.isFinite(ms) ? amgTodayKey(new Date(ms)) : "");
const amgDtDayStart = key => new Date(key + "T00:00:00").getTime();
const amgDtDayEnd = key => amgDtDayStart(key) + 86400000;
const amgDtMin = ms => Math.round((ms || 0) / 60000 * 10) / 10;

/* ---------- Mã sự kiện duy nhất (xác định theo lệnh + số thứ tự lần dừng → không bao giờ trùng) ---------- */
function amgDtEventId(runId, idx) { return "DM-" + String(runId || "").replace(/^RUN-/, "") + "-" + (idx + 1); }
function amgDtMachineEventId(evId) { return "DM-M-" + String(evId || ""); }

/* ---------- Dựng danh sách sự kiện ---------- */
// runs: productionRuns · machines: machines (có downtimeLog) · orders: đơn · ledger: downtimeEvents (sổ lịch sử)
function amgDtBuildEvents(src) {
  const runs = (src && src.runs) || [], machines = (src && src.machines) || [], orders = (src && src.orders) || [], ledger = (src && src.ledger) || [];
  const nowMs = (src && src.nowMs) || Date.now();
  const ordById = {}; orders.forEach(o => { ordById[o.id] = o; });
  const ledById = {}; ledger.forEach(l => { ledById[l.id] = l; });
  const machById = {}; machines.forEach(m => { machById[m.id] = m; });
  const mLabel = id => { const m = machById[id]; return m ? `${m.id} · ${m.typeLabel || ""}`.replace(/ · $/, "") : id; };
  const out = [], seen = {};

  runs.forEach(run => {
    (run.pauses || []).forEach((p, idx) => {
      const startMs = amgMs(p.at);
      if (Number.isNaN(startMs)) return; // bản ghi hỏng thiếu thời điểm → không dựng, không đoán
      const id = amgDtEventId(run.id, idx);
      if (seen[id]) return;
      seen[id] = true;
      const rMs = amgMs(p.resumedAt);
      const closed = !Number.isNaN(rMs);
      const live = run.productionStatus === "paused";
      let state = p.cancelled ? "cancelled" : closed ? "closed" : live ? "open" : "unclosed";
      const durMs = closed ? Math.max(0, rMs - startMs) : state === "open" ? Math.max(0, nowMs - startMs) : null;
      const o = ordById[run.orderId] || null, sn = run.snapshot || {};
      const customer = o ? o.customer || "" : sn.customer || "", spec = o ? o.spec || "" : sn.spec || "";
      const sh = amgDtShift(run.shift, startMs), cat = amgDtClassify(p.reason);
      const led = ledById[id] || null;
      out.push({
        id, source: "plan", state, runId: run.id, pauseIndex: idx, orderId: run.orderId || "", machineId: run.machineId || "", machineLabel: mLabel(run.machineId),
        stageKey: run.stageKey || "", shiftKey: sh.key, shiftLabel: sh.label, shiftDerived: sh.derived, operator: run.operator || "",
        date: amgDtDateKey(startMs), startMs, endMs: closed ? rMs : null, durMs, effMs: state === "cancelled" ? 0 : durMs || 0,
        reason: p.reason || "", cat, recordedBy: p.by || "", confirmedBy: p.resumedBy || (p.closedByFinish ? run.endedBy || "" : ""), closedByFinish: !!p.closedByFinish,
        cancelReason: p.cancelReason || "", cancelledBy: p.cancelledBy || "", cancelledAt: p.cancelledAt || "",
        orderLabel: o ? amgOrderLabel(o) : (customer || spec) ? [customer, spec].filter(Boolean).join(" · ") : (run.orderId ? "Đơn đã xóa" : "—"),
        customer, spec, materialCode: o ? o.materialCode || "" : sn.materialCode || "", unit: run.unit || "",
        countable: state !== "cancelled", excludedWhy: state === "cancelled" ? "Đã hủy" : "", ledger: led,
        edited: !!(led && (led.revisions || []).some(r => r.action === "edit"))
      });
    });
  });

  // Sự kiện từ Thẻ máy (nguồn cũ). Phần trùng thời gian với tạm dừng lệnh của cùng máy bị trừ để không tính hai lần.
  const planByMachine = {};
  out.forEach(e => { if (e.source === "plan" && e.state !== "cancelled") (planByMachine[e.machineId] = planByMachine[e.machineId] || []).push(e); });
  machines.forEach(m => {
    (m.downtimeLog || []).forEach(ev => {
      const startMs = amgMs(ev.startTime);
      if (Number.isNaN(startMs)) return;
      const id = amgDtMachineEventId(ev.id);
      if (seen[id]) return;
      seen[id] = true;
      const eMs = amgMs(ev.endTime), closed = !Number.isNaN(eMs);
      const durMs = Math.max(0, (closed ? eMs : nowMs) - startMs), endEff = closed ? eMs : nowMs;
      let overlap = 0;
      (planByMachine[m.id] || []).forEach(pe => {
        const pe2 = pe.endMs != null ? pe.endMs : pe.state === "open" ? nowMs : pe.startMs;
        overlap += Math.max(0, Math.min(endEff, pe2) - Math.max(startMs, pe.startMs));
      });
      const countableStatus = ev.status === "broken" || ev.status === "maintenance";
      const sh = amgDtShift("", startMs), cat = amgDtClassify(ev.reason, ev.status);
      const eff = countableStatus ? Math.max(0, durMs - overlap) : 0;
      let why = "";
      if (!countableStatus) why = "Trạng thái máy \"" + (ev.statusLabel || ev.status) + "\" — không tính là dừng máy";
      else if (overlap > 0 && eff === 0) why = "Trùng thời gian với tạm dừng lệnh của Kế hoạch (đã tính ở đó)";
      out.push({
        id, source: "machine", state: closed ? "closed" : "open", runId: "", pauseIndex: -1, orderId: "", machineId: m.id, machineLabel: mLabel(m.id), stageKey: "",
        shiftKey: sh.key, shiftLabel: sh.label, shiftDerived: true, operator: "", date: amgDtDateKey(startMs), startMs, endMs: closed ? eMs : null, durMs,
        effMs: eff, overlapMs: overlap, reason: ev.reason || "", cat, recordedBy: ev.recordedBy || "", confirmedBy: "", closedByFinish: false, cancelReason: "", cancelledBy: "", cancelledAt: "",
        orderLabel: "—", customer: "", spec: "", materialCode: "", unit: "", statusKey: ev.status, statusLabel: ev.statusLabel || ev.status, machineLogId: ev.id,
        countable: countableStatus && eff > 0, excludedWhy: why, ledger: null, edited: false
      });
    });
  });

  // Sự kiện có trong sổ lịch sử nhưng không còn ở nguồn (lệnh/đơn bị xóa) → giữ để truy xuất, không tính KPI
  ledger.forEach(l => {
    if (seen[l.id] || l.source !== "productionRuns") return;
    const startMs = amgMs(l.startAt);
    if (Number.isNaN(startMs)) return;
    const endMs = amgMs(l.endAt), closed = !Number.isNaN(endMs);
    const sh = amgDtShift(l.shift, startMs);
    out.push({
      id: l.id, source: "ledger", state: "removed", runId: l.runId || "", pauseIndex: l.pauseIndex == null ? -1 : l.pauseIndex, orderId: l.orderId || "", machineId: l.machineId || "", machineLabel: mLabel(l.machineId),
      stageKey: l.stageKey || "", shiftKey: sh.key, shiftLabel: sh.label, shiftDerived: sh.derived, operator: l.operator || "", date: amgDtDateKey(startMs), startMs, endMs: closed ? endMs : null,
      durMs: closed ? Math.max(0, endMs - startMs) : null, effMs: 0, reason: l.reason || "", cat: amgDtClassify(l.reason), recordedBy: l.createdBy || "", confirmedBy: l.confirmedBy || "", closedByFinish: false,
      cancelReason: l.cancelReason || "", cancelledBy: l.cancelledBy || "", cancelledAt: l.cancelledAt || "", orderLabel: l.orderLabel || "Đơn đã xóa", customer: l.customer || "", spec: l.spec || "", materialCode: "", unit: "",
      countable: false, excludedWhy: l.status === "cancelled" ? "Bản ghi nguồn đã bị xóa / hủy" : "Không còn ở nguồn", ledger: l, edited: (l.revisions || []).some(r => r.action === "edit")
    });
  });
  return out.sort((a, b) => b.startMs - a.startMs);
}

/* ---------- Bộ lọc ---------- */
// f: { from, to ("YYYY-MM-DD"), machineId, shift, cat, orderId, cls, source, q, showInactive }
function amgDtFilter(events, f) {
  const q = amgDtNorm(f && f.q);
  return (events || []).filter(e => {
    if (!f) return true;
    if (!f.showInactive && !e.countable && e.state !== "cancelled" && e.state !== "removed" && e.source === "machine") return false; // dòng Thẻ máy không tính: ẩn mặc định
    if (!f.showInactive && (e.state === "cancelled" || e.state === "removed")) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.machineId && f.machineId !== "all" && e.machineId !== f.machineId) return false;
    if (f.shift && f.shift !== "all" && e.shiftKey !== f.shift) return false;
    if (f.cat && f.cat !== "all" && e.cat.key !== f.cat) return false;
    if (f.cls && f.cls !== "all" && e.cat.cls !== f.cls) return false;
    if (f.orderId && f.orderId !== "all" && e.orderId !== f.orderId) return false;
    if (f.source && f.source !== "all" && e.source !== f.source) return false;
    if (q && amgDtNorm([e.machineId, e.machineLabel, e.reason, e.orderLabel, e.id, e.recordedBy, e.cat.label].join(" ")).indexOf(q) < 0) return false;
    return true;
  });
}

/* ---------- Cửa sổ thời gian của bộ lọc ---------- */
function amgDtWindow(f, events, runs, nowMs) {
  let a = f && f.from ? amgDtDayStart(f.from) : NaN, b = f && f.to ? amgDtDayEnd(f.to) : NaN;
  if (Number.isNaN(a)) {
    const xs = [];
    (runs || []).forEach(r => { const s = amgMs(r.startedAt); if (!Number.isNaN(s)) xs.push(s); });
    (events || []).forEach(e => xs.push(e.startMs));
    a = xs.length ? Math.min.apply(null, xs) : nowMs;
  }
  if (Number.isNaN(b)) b = nowMs;
  return { a, b: Math.min(b, Math.max(b, a)) };
}

/* ---------- Availability từ lệnh máy: thời gian chạy theo kế hoạch − thời gian tạm dừng (đã cắt theo cửa sổ) ---------- */
function amgDtAvailability(runs, win, nowMs, machineId) {
  const per = {};
  (runs || []).forEach(r => {
    if (machineId && r.machineId !== machineId) return;
    const s = amgMs(r.startedAt);
    if (Number.isNaN(s)) return; // chưa chạy → không có thời gian kế hoạch
    const eRaw = amgMs(r.endedAt), e = Number.isNaN(eRaw) ? nowMs : eRaw;
    const a = Math.max(s, win.a), b = Math.min(e, win.b);
    if (b <= a) return;
    let paused = 0;
    (r.pauses || []).forEach(p => {
      if (p.cancelled) return;
      const ps = amgMs(p.at);
      if (Number.isNaN(ps)) return;
      const pr = amgMs(p.resumedAt), pe = Number.isNaN(pr) ? e : pr;
      paused += Math.max(0, Math.min(pe, b) - Math.max(ps, a));
    });
    paused = Math.min(paused, b - a);
    const m = per[r.machineId] || (per[r.machineId] = { machineId: r.machineId, schedMs: 0, pausedMs: 0, runMs: 0, runs: 0 });
    m.schedMs += b - a; m.pausedMs += paused; m.runMs += b - a - paused; m.runs++;
  });
  Object.keys(per).forEach(k => { const m = per[k]; m.availPct = m.schedMs > 0 ? Math.round(m.runMs / m.schedMs * 1000) / 10 : null; });
  return per;
}

/* ---------- Ngưỡng theo máy ---------- */
function amgDtThreshold(settings, machineId) {
  const s = settings || {};
  return Object.assign({}, AMG_DT_DEFAULTS, s.defaults || {}, (s.machines && s.machines[machineId]) || {});
}

/* ---------- MTTR / MTBF / OEE: chỉ tính khi ĐỦ dữ liệu đầu vào, ngược lại trả lý do thiếu ---------- */
function amgDtReliability(events, avail) {
  const bd = (events || []).filter(e => e.countable && e.cat.cls === "breakdown");
  const closed = bd.filter(e => e.state === "closed" && e.durMs != null);
  const runMs = Object.keys(avail || {}).reduce((s, k) => s + avail[k].runMs, 0);
  const sched = Object.keys(avail || {}).reduce((s, k) => s + avail[k].schedMs, 0);
  const r = { breakdowns: bd.length, closedBreakdowns: closed.length, mttrMs: null, mtbfMs: null, mttrWhy: "", mtbfWhy: "", availPct: null, availWhy: "", oee: null, oeeWhy: "" };
  if (!closed.length) r.mttrWhy = bd.length ? "Các sự cố trong kỳ chưa đóng — chưa có thời gian sửa chữa" : "Không có sự cố thiết bị / mất điện nào trong kỳ";
  else r.mttrMs = closed.reduce((s, e) => s + e.durMs, 0) / closed.length;
  if (!bd.length) r.mtbfWhy = "Không có sự cố trong kỳ — không tính được thời gian giữa hai lần hỏng";
  else if (runMs <= 0) r.mtbfWhy = "Chưa có thời gian vận hành từ lệnh máy trong kỳ";
  else r.mtbfMs = runMs / bd.length;
  if (sched > 0) r.availPct = Math.round(runMs / sched * 1000) / 10; else r.availWhy = "Chưa có lệnh máy đã chạy trong kỳ (thiếu thời gian sản xuất kế hoạch)";
  r.oeeWhy = "OEE = Availability × Performance × Quality. Hệ thống chưa lưu tốc độ chuẩn (công suất thiết kế) của từng máy/quy cách nên chưa tính được Performance — không tự suy diễn.";
  return r;
}

/* ---------- KPI + dữ liệu biểu đồ ---------- */
function amgDtAnalyze(events, runs, f, nowMs) {
  const win = amgDtWindow(f, events, runs, nowMs);
  const ev = (events || []).filter(e => e.countable);
  const sum = a => a.reduce((s, e) => s + (e.effMs || 0), 0);
  const withDur = ev.filter(e => e.durMs != null);
  const total = sum(ev);
  const byMachine = {}, byCause = {}, byShift = { ngay: { name: "Ca Ngày", ms: 0, n: 0 }, dem: { name: "Ca Đêm", ms: 0, n: 0 }, khac: { name: "Chưa rõ ca", ms: 0, n: 0 } }, byClass = {};
  ev.forEach(e => {
    const m = byMachine[e.machineId] || (byMachine[e.machineId] = { id: e.machineId, name: e.machineLabel, ms: 0, n: 0 });
    m.ms += e.effMs; m.n++;
    const c = byCause[e.cat.key] || (byCause[e.cat.key] = { key: e.cat.key, name: e.cat.label, cls: e.cat.cls, ms: 0, n: 0 });
    c.ms += e.effMs; c.n++;
    (byShift[e.shiftKey] || byShift.khac).ms += e.effMs; (byShift[e.shiftKey] || byShift.khac).n++;
    const k = byClass[e.cat.cls] || (byClass[e.cat.cls] = { key: e.cat.cls, name: AMG_DT_CLASSES[e.cat.cls].label, ms: 0, n: 0 });
    k.ms += e.effMs; k.n++;
  });
  const machines = Object.values(byMachine).sort((x, y) => y.ms - x.ms);
  const causes = Object.values(byCause).sort((x, y) => y.ms - x.ms);
  // Xu hướng: theo ngày; nếu khoảng > 62 ngày thì gộp theo tháng
  const days = {};
  ev.forEach(e => { const k = e.date; (days[k] = days[k] || { key: k, ms: 0, n: 0 }); days[k].ms += e.effMs; days[k].n++; });
  const dayKeys = Object.keys(days).sort();
  let trend, trendBy = "day";
  const span = dayKeys.length ? (amgDtDayStart(dayKeys[dayKeys.length - 1]) - amgDtDayStart(dayKeys[0])) / 86400000 : 0;
  if (span > 62) {
    trendBy = "month";
    const mo = {};
    dayKeys.forEach(k => { const mk = k.slice(0, 7); (mo[mk] = mo[mk] || { key: mk, ms: 0, n: 0 }); mo[mk].ms += days[k].ms; mo[mk].n += days[k].n; });
    trend = Object.keys(mo).sort().map(k => mo[k]);
  } else trend = dayKeys.map(k => days[k]);
  const avail = amgDtAvailability(runs, win, nowMs);
  const rel = amgDtReliability(ev, avail);
  const sched = Object.keys(avail).reduce((s, k) => s + avail[k].schedMs, 0);
  return {
    win, total, count: ev.length, openCount: ev.filter(e => e.state === "open").length, unclosed: ev.filter(e => e.state === "unclosed").length,
    machinesAffected: machines.length, avgMs: withDur.length ? sum(withDur) / withDur.length : null,
    topMachine: machines[0] || null, top5: machines.slice(0, 5), machines, causes, topCause: causes[0] || null,
    shifts: [byShift.ngay, byShift.dem].concat(byShift.khac.n ? [byShift.khac] : []), classes: Object.values(byClass), trend, trendBy,
    avail, rel, runRatePct: sched > 0 ? rel.availPct : null, schedMs: sched
  };
}

/* ---------- Cảnh báo ---------- */
// all: toàn bộ sự kiện (không lọc, để so với kỳ trước) · f: bộ lọc hiện tại · settings: doc ngưỡng
function amgDtAlerts(all, runs, f, settings, nowMs) {
  const out = [], win = amgDtWindow(f, all, runs, nowMs);
  const inWin = (all || []).filter(e => e.countable && e.startMs >= win.a && e.startMs < win.b && (!f || !f.machineId || f.machineId === "all" || e.machineId === f.machineId));
  const push = (level, kind, machineId, title, detail, ids) => out.push({ id: kind + ":" + machineId + ":" + out.length, level, kind, machineId, title, detail, eventIds: ids || [] });
  const th = id => amgDtThreshold(settings, id);
  inWin.forEach(e => {
    if (e.durMs == null) return;
    const t = th(e.machineId);
    if (t.maxEventMin > 0 && e.durMs > t.maxEventMin * 60000) push("err", "over", e.machineId, `Máy ${e.machineId} dừng vượt ngưỡng`, `${e.id}: ${amgHm(e.durMs)} (ngưỡng ${t.maxEventMin} phút) · ${e.reason || "chưa ghi nguyên nhân"}`, [e.id]);
  });
  const perDay = {};
  inWin.forEach(e => { const k = e.machineId + "|" + e.date; (perDay[k] = perDay[k] || []).push(e); });
  Object.keys(perDay).forEach(k => {
    const list = perDay[k], mid = list[0].machineId, t = th(mid);
    if (t.maxEventsPerDay > 0 && list.length >= t.maxEventsPerDay) push("warn", "multi", mid, `Máy ${mid} dừng ${list.length} lần trong ngày ${list[0].date.split("-").reverse().join("/")}`, `Ngưỡng ${t.maxEventsPerDay} lần/ngày`, list.map(e => e.id));
  });
  const rep = {};
  inWin.forEach(e => { if (e.cat.key === "other") return; const k = e.machineId + "|" + e.cat.key; (rep[k] = rep[k] || []).push(e); });
  Object.keys(rep).forEach(k => {
    const list = rep[k], mid = list[0].machineId, t = th(mid);
    if (t.repeatCount > 0 && list.length >= t.repeatCount) push("warn", "repeat", mid, `Máy ${mid} lặp lại nguyên nhân "${list[0].cat.label}"`, `${list.length} lần trong kỳ đang xem`, list.map(e => e.id));
  });
  // Tăng bất thường: so với kỳ liền trước có cùng độ dài (kỳ đang xem phải xác định được độ dài)
  const len = win.b - win.a;
  if (len > 0 && f && f.from) { // chỉ so sánh khi người dùng chọn một kỳ cụ thể (nếu xem "tất cả" thì không có kỳ trước để so)
    const prevA = win.a - len, cur = {}, prev = {};
    (all || []).filter(e => e.countable).forEach(e => {
      if (e.startMs >= win.a && e.startMs < win.b) cur[e.machineId] = (cur[e.machineId] || 0) + e.effMs;
      else if (e.startMs >= prevA && e.startMs < win.a) prev[e.machineId] = (prev[e.machineId] || 0) + e.effMs;
    });
    Object.keys(cur).forEach(mid => {
      if (f && f.machineId && f.machineId !== "all" && f.machineId !== mid) return;
      const t = th(mid), c = cur[mid], p = prev[mid] || 0;
      if (c - p < t.surgeMinMin * 60000) return;
      if (p === 0) push("warn", "surge", mid, `Máy ${mid} phát sinh thời gian dừng mới`, `${amgHm(c)} trong kỳ này, kỳ trước không có`, []);
      else if (c >= p * (1 + t.surgePct / 100)) push("warn", "surge", mid, `Máy ${mid} thời gian dừng tăng bất thường`, `${amgHm(c)} so với ${amgHm(p)} kỳ trước (+${Math.round((c / p - 1) * 100)}%)`, []);
    });
  }
  // Hiệu suất thấp: Availability theo máy < ngưỡng (chỉ khi có thời gian kế hoạch)
  const avail = amgDtAvailability(runs, win, nowMs), lowPerf = {};
  Object.keys(avail).forEach(mid => {
    if (f && f.machineId && f.machineId !== "all" && f.machineId !== mid) return;
    const a = avail[mid], t = th(mid);
    if (a.availPct !== null && t.minAvailabilityPct > 0 && a.availPct < t.minAvailabilityPct) {
      lowPerf[mid] = a.availPct;
      push("err", "lowperf", mid, `Máy ${mid} hiệu suất thấp`, `Availability ${a.availPct}% (ngưỡng tối thiểu ${t.minAvailabilityPct}%)`, []);
    }
  });
  const rank = { err: 0, warn: 1, info: 2 };
  out.sort((a, b) => rank[a.level] - rank[b.level]);
  return { list: out, lowPerf };
}

/* ---------- Nội dung sổ lịch sử (dùng ở tầng ghi) ---------- */
function amgDtSnapshotFromRun(run, order, idx) {
  const p = (run.pauses || [])[idx] || {};
  const sn = run.snapshot || {};
  const customer = order ? order.customer || "" : sn.customer || "", spec = order ? order.spec || "" : sn.spec || "";
  return {
    id: amgDtEventId(run.id, idx), source: "productionRuns", runId: run.id, pauseIndex: idx, orderId: run.orderId || "", machineId: run.machineId || "", stageKey: run.stageKey || "",
    shift: run.shift || "", operator: run.operator || "", customer, spec, orderLabel: [customer, spec].filter(Boolean).join(" · "),
    startAt: p.at || "", endAt: p.resumedAt || null, reason: p.reason || ""
  };
}

/* ---------- Bảng theo máy: phân biệt dừng sự cố / có kế hoạch / chờ-khác, Availability, MTTR, MTBF ---------- */
function amgDtMachineTable(an, events, lowPerf) {
  const ids = {};
  an.machines.forEach(m => { ids[m.id] = m.name; });
  Object.keys(an.avail).forEach(k => { if (!ids[k]) ids[k] = k; });
  return Object.keys(ids).map(id => {
    const ev = (events || []).filter(e => e.countable && e.machineId === id);
    const by = c => ev.filter(e => e.cat.cls === c).reduce((s, e) => s + (e.effMs || 0), 0);
    const av = an.avail[id] ? { [id]: an.avail[id] } : {};
    const rel = amgDtReliability(ev, av);
    return {
      id, name: ids[id], n: ev.length, totalMs: ev.reduce((s, e) => s + (e.effMs || 0), 0), breakdownMs: by("breakdown"), plannedMs: by("planned"), otherMs: by("other"),
      schedMs: an.avail[id] ? an.avail[id].schedMs : 0, runMs: an.avail[id] ? an.avail[id].runMs : 0, availPct: an.avail[id] ? an.avail[id].availPct : null,
      breakdowns: rel.breakdowns, mttrMs: rel.mttrMs, mtbfMs: rel.mtbfMs, low: !!(lowPerf && lowPerf[id] !== undefined)
    };
  }).sort((a, b) => b.totalMs - a.totalMs);
}

/* ---------- Bảng báo cáo (dùng chung cho Excel và PDF) ---------- */
const AMG_DT_REPORTS = [
  { key: "day", label: "Tổng hợp dừng máy theo ngày", sheet: "Theo ngay" },
  { key: "machine", label: "Báo cáo theo từng máy", sheet: "Theo may" },
  { key: "shift", label: "Báo cáo theo ca", sheet: "Theo ca" },
  { key: "cause", label: "Phân tích nguyên nhân", sheet: "Nguyen nhan" },
  { key: "top", label: "Top máy dừng nhiều nhất", sheet: "Top may" },
  { key: "rel", label: "MTTR · MTBF · OEE", sheet: "MTTR MTBF OEE" },
  { key: "detail", label: "Chi tiết sự kiện dừng máy", sheet: "Chi tiet" }
];
function amgDtReportTable(kind, an, events) {
  const m = ms => (ms == null ? "" : amgDtMin(ms));
  const pct = (a, b) => (b > 0 ? Math.round(a / b * 1000) / 10 : "");
  if (kind === "day") {
    const byDay = {};
    events.filter(e => e.countable).forEach(e => {
      const d = byDay[e.date] || (byDay[e.date] = { date: e.date, n: 0, ms: 0, machines: {}, br: 0 });
      d.n++; d.ms += e.effMs; d.machines[e.machineId] = 1; if (e.cat.cls === "breakdown") d.br += e.effMs;
    });
    return { head: ["Ngày", "Số lần dừng", "Số máy dừng", "Tổng dừng (phút)", "Trong đó sự cố (phút)"], rows: Object.keys(byDay).sort().map(k => [k.split("-").reverse().join("/"), byDay[k].n, Object.keys(byDay[k].machines).length, m(byDay[k].ms), m(byDay[k].br)]) };
  }
  if (kind === "machine") {
    const t = amgDtMachineTable(an, events, {});
    return { head: ["Máy", "Số lần dừng", "Tổng dừng (phút)", "Sự cố (phút)", "Có kế hoạch (phút)", "Chờ/khác (phút)", "Tỷ trọng"], rows: t.map(r => [r.name, r.n, m(r.totalMs), m(r.breakdownMs), m(r.plannedMs), m(r.otherMs), pct(r.totalMs, an.total) === "" ? "" : pct(r.totalMs, an.total) + "%"]) };
  }
  if (kind === "shift") return { head: ["Ca", "Số lần dừng", "Tổng dừng (phút)", "Trung bình/lần (phút)"], rows: an.shifts.map(s => [s.name, s.n, m(s.ms), s.n ? m(s.ms / s.n) : ""]) };
  if (kind === "cause") return { head: ["Nhóm nguyên nhân", "Loại dừng", "Số lần", "Tổng dừng (phút)", "Tỷ trọng"], rows: an.causes.map(c => [c.name, AMG_DT_CLASSES[c.cls].label, c.n, m(c.ms), pct(c.ms, an.total) === "" ? "" : pct(c.ms, an.total) + "%"]) };
  if (kind === "top") return { head: ["Hạng", "Máy", "Số lần dừng", "Tổng dừng (phút)"], rows: an.top5.map((x, i) => [i + 1, x.name, x.n, m(x.ms)]) };
  if (kind === "rel") {
    const t = amgDtMachineTable(an, events, {});
    return { head: ["Máy", "TG sản xuất kế hoạch (phút)", "TG vận hành (phút)", "Availability (%)", "Số sự cố", "MTTR (phút)", "MTBF (phút)"],
      rows: t.map(r => [r.name, m(r.schedMs), m(r.runMs), r.availPct === null ? "Chưa đủ dữ liệu" : r.availPct, r.breakdowns, r.mttrMs === null ? "Chưa đủ dữ liệu" : m(r.mttrMs), r.mtbfMs === null ? "Chưa đủ dữ liệu" : m(r.mtbfMs)]),
      note: "OEE: " + an.rel.oeeWhy };
  }
  return { head: ["Mã sự kiện", "Ngày", "Ca", "Máy", "Đơn hàng", "Bắt đầu", "Kết thúc", "Tổng dừng (phút)", "Nguyên nhân (gốc)", "Nhóm nguyên nhân", "Loại dừng", "Người ghi nhận", "Người xác nhận", "Trạng thái", "Nguồn"],
    rows: events.map(e => [e.id, e.date.split("-").reverse().join("/"), e.shiftLabel + (e.shiftDerived ? "*" : ""), e.machineId, e.orderLabel, amgFmtDateTime(new Date(e.startMs).toISOString()), e.endMs ? amgFmtDateTime(new Date(e.endMs).toISOString()) : "", m(e.durMs), e.reason, e.cat.label, AMG_DT_CLASSES[e.cat.cls].label, e.recordedBy, e.confirmedBy, amgDtStateLabel(e), e.source === "plan" ? "Kế hoạch sản xuất" : e.source === "machine" ? "Thẻ máy" : "Sổ lịch sử"]) };
}
function amgDtStateLabel(e) {
  return e.state === "open" ? "Đang dừng" : e.state === "closed" ? (e.closedByFinish ? "Đã đóng khi kết thúc lệnh" : "Đã xử lý") : e.state === "unclosed" ? "Chưa đóng (thiếu dữ liệu)" : e.state === "cancelled" ? "Đã hủy" : "Nguồn đã xóa";
}
