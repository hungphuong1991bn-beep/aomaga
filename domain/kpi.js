/* ===================== CHỈ SỐ ĐIỀU HÀNH THEO VAI TRÒ (v45) =====================
   Hàm thuần túy: chỉ tính từ dữ liệu thật truyền vào, không dữ liệu mẫu, không số tự tạo.
   view: "gd" (Giám đốc) | "qd" (Quản đốc) | "tt" (Tổ trưởng) | "nv" (Nhân viên) */
const AMG_VIEWS = { gd: "Giám đốc", qd: "Quản đốc", tt: "Tổ trưởng", nv: "Nhân viên" };
const AMG_PERIODS = { day: "Ngày", week: "Tuần", month: "Tháng", year: "Năm" };

function amgPeriodRange(period, now) {
  const n = now || new Date();
  const k = d => amgTodayKey(d);
  if (period === "day") return { from: k(n), to: k(n) };
  if (period === "week") {
    const off = (n.getDay() + 6) % 7; // Thứ 2 là đầu tuần
    const a = new Date(n.getFullYear(), n.getMonth(), n.getDate() - off);
    const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
    return { from: k(a), to: k(b) };
  }
  if (period === "year") return { from: `${n.getFullYear()}-01-01`, to: `${n.getFullYear()}-12-31` };
  const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  return { from: `${n.getFullYear()}-${m}-01`, to: `${n.getFullYear()}-${m}-${String(last).padStart(2, "0")}` };
}
function amgInRange(dateStr, r) {
  if (typeof dateStr !== "string" || dateStr.length < 10) return false;
  const d = dateStr.slice(0, 10);
  return d >= r.from && d <= r.to;
}
// Vai trò mặc định của tài khoản khi chưa chọn "xem như"
function amgDefaultView(user) {
  const r = amgRoleOf(user);
  if (r === "gd" || r === "qt") return "gd";
  if (r === "qd" || r === "qc" || r === "kho" || r === "cd") return "qd";
  if (r === "nv") return "nv";
  return "tt";
}
function amgAttendanceToday(attendance, staff, now, team) {
  const day = (attendance || {})[amgTodayKey(now)] || {};
  const members = (staff || []).filter(s => !team || s.team === team);
  let present = 0, absent = 0;
  members.forEach(m => {
    const st = day[m.id] || {};
    if (st.caNgay || st.caDem || st.daoCa) present++;
    else if (st.nghiPhep || st.nghiKhongPhep) absent++;
  });
  return { total: members.length, present, absent, recorded: Object.keys(day).length > 0 };
}
function amgComputeKpis(view, data, user, period, now) {
  const n = now || new Date();
  const range = amgPeriodRange(period, n);
  const orders = data.orders || [], machines0 = data.machines || [], staff = data.staff || [];
  const scrap0 = data.scrap || [], audit = data.auditLog || [];
  const teamScoped = view === "tt" || view === "nv";
  const stageKeys = teamScoped ? (TEAM_REPORT_STAGES[user && user.team] || null) : null;
  const inScope = k => !stageKeys || stageKeys.includes(k);
  const team = teamScoped && user ? user.team : null;
  const norm = orders.map(normalizeOrderStages);
  const prog = norm.map(o => orderProgress(o));
  // Đơn thuộc phạm vi (có công đoạn của tổ)
  const scoped = norm.filter(o => getApplicableStages(o).some(inScope));
  const isDone = o => orderProgress(o).statusLabel === "Hoàn thành";
  const done = scoped.filter(isDone).length;
  const running = scoped.filter(o => orderProgress(o).statusLabel === "Đang sản xuất").length;
  const notStarted = scoped.filter(o => orderProgress(o).statusLabel === "Chưa bắt đầu").length;
  const today = new Date(n.toDateString()).getTime();
  let late = 0, soon = 0, withDate = 0;
  scoped.forEach(o => {
    if (!o.deliveryDate) return;
    const t = new Date(o.deliveryDate + "T00:00:00").getTime();
    if (Number.isNaN(t)) return;
    withDate++;
    if (isDone(o)) return;
    const d = Math.round((t - today) / 86400000);
    if (d < 0) late++; else if (d <= 7) soon++;
  });
  const machines = machines0.filter(m => inScope(m.stage));
  const ms = { running: 0, idle: 0, maintenance: 0, broken: 0, unknown: 0 };
  machines.forEach(m => { ms[m.status] = (ms[m.status] || 0) + 1; });
  const produced = audit.filter(a => a.type === "production_entry" && amgInRange(a.date, range) && inScope(a.stageKey) && (view !== "nv" || a.user === (user && user.fullName)));
  const outQty = produced.reduce((s, a) => s + (typeof a.qty === "number" ? a.qty : 0), 0);
  const scrap = scrap0.filter(s => amgInRange(s.date, range) && inScope(s.stage));
  const scrapQty = scrap.reduce((s, a) => s + (typeof a.qty === "number" ? a.qty : 0), 0);
  const att = amgAttendanceToday(data.attendance, staff, n, team);
  // Kế hoạch (số lượng đặt) và thực hiện theo công đoạn, trên các đơn chưa hoàn thành
  const flow = STAGES.filter(s => inScope(s.key)).map(s => {
    let plan = 0, got = 0;
    norm.forEach(o => {
      if (isDone(o) || !getApplicableStages(o).includes(s.key)) return;
      plan += typeof o.quantity === "number" ? o.quantity : 0;
      got += (o.stages && o.stages[s.key] && o.stages[s.key].done) || 0;
    });
    return { key: s.key, label: s.label, plan, done: got };
  }).filter(f => f.plan > 0 || f.done > 0);
  const remainOpen = flow.reduce((s, f) => s + Math.max(0, f.plan - f.done), 0);
  const fmt = v => (typeof fmtNum === "function" ? fmtNum(Math.round(v * 10) / 10) : String(v));
  const T = (key, label, value, sub, tone, icon) => ({ key, label, value, sub, tone: tone || "none", icon });
  const dueTile = withDate === 0
    ? T("due", "Sắp đến hạn", "—", "Đơn chưa có ngày giao", "none", "alert")
    : T("due", "Sắp đến hạn / quá hạn", `${soon} / ${late}`, "Trong 7 ngày / đã quá hạn", late ? "err" : soon ? "warn" : "ok", "alert");
  const machineTile = T("machines", "Máy chạy / dừng / hỏng", `${ms.running} / ${ms.idle + ms.maintenance} / ${ms.broken}`,
    ms.unknown ? `${ms.unknown} máy chưa xác định trạng thái` : `Tổng ${machines.length} máy`, ms.broken ? "err" : ms.unknown ? "warn" : "ok", "cog");
  const attTile = T("att", "Nhân sự có mặt hôm nay", att.recorded ? `${att.present} / ${att.total}` : "—",
    att.recorded ? `Vắng ${att.absent}` : "Chưa chấm công hôm nay", att.recorded && att.absent ? "warn" : "none", "users");
  const outTile = T("out", `Sản lượng ${AMG_PERIODS[period].toLowerCase()} này`, fmt(outQty), `${produced.length} lượt nhập`, "info", "factory");
  const scrapTile = T("scrap", `Phế liệu ${AMG_PERIODS[period].toLowerCase()} này`, `${fmt(scrapQty)} kg`,
    outQty > 0 ? `${(scrapQty / outQty * 100).toFixed(2)}% so với sản lượng nhập` : `${scrap.length} lượt ghi nhận`, "warn", "recycle");
  let tiles;
  if (view === "gd") tiles = [
    T("total", "Tổng đơn hàng", scoped.length, `${notStarted} chưa bắt đầu`, "none", "orders"),
    T("run", "Đang sản xuất", running, "", "info", "orders"),
    T("done", "Hoàn thành", done, "", "ok", "orders"),
    dueTile, outTile, machineTile, attTile, scrapTile,
    T("quality", "Chất lượng đạt / NG", "—", "Chưa có dữ liệu kiểm tra (QA/QC chưa kích hoạt)", "none", "alert")];
  else if (view === "qd") tiles = [
    T("run", "Đơn đang sản xuất", running, `${notStarted} chưa bắt đầu · ${done} hoàn thành`, "info", "orders"),
    dueTile, outTile, machineTile, attTile, scrapTile];
  else tiles = [
    T("run", view === "nv" ? "Đơn đang làm của tổ" : "Đơn đang sản xuất", running, `${notStarted} chưa bắt đầu`, "info", "orders"),
    T("remain", "Còn lại cần làm", fmt(remainOpen), "Trên các đơn chưa hoàn thành", "warn", "orders"),
    outTile, machineTile, attTile, scrapTile];
  return { range, tiles, flow, counts: { running, done, notStarted, late, soon, withDate }, machines: ms, att, outQty, scrapQty };
}
