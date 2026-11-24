/* Tổng quan điều hành (v49). Mọi số liệu từ domain/executive.js (dữ liệu thật, theo quyền). Thiếu dữ liệu → hiện "Chưa có dữ liệu". */
function useNow(ms) {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setN(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}
function DxCard({ title, icon: Icon, note, action, flush, children }) {
  const h = React.createElement;
  return h("section", { className: "mes-card dx-card" },
    h("div", { className: "dx-card-h" },
      h("div", { className: "dx-card-t" }, Icon ? h(Icon, { size: 16 }) : null, title),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, note ? h("span", { className: "dx-card-n" }, note) : null, action || null)),
    h("div", { className: "dx-card-b" + (flush ? " dx-card-b--flush" : "") }, children));
}
const dxEmpty = txt => React.createElement("div", { className: "dx-empty" }, txt);
function dxBar(pct, color) {
  return React.createElement("div", { className: "dx-bar", role: "progressbar", "aria-valuenow": Math.round(pct || 0), "aria-valuemin": 0, "aria-valuemax": 100 },
    React.createElement("i", { style: { width: Math.max(0, Math.min(100, pct || 0)) + "%", background: color } }));
}
const DX_RUN_ST = { running: ["Đang chạy", "green"], paused: ["Tạm dừng", "amber"], assigned: ["Chờ chạy", "blue"] };
const DX_MC_ST = { running: ["Đang chạy", "green"], assigned: ["Chờ chạy", "blue"], paused: ["Tạm dừng", "amber"], idle: ["Rảnh", "textFaint"], maintenance: ["Bảo trì", "violet"], broken: ["Hỏng", "red"], unknown: ["Chưa rõ", "textFaint"] };

function RoleOverview({ currentUser, orders, machines, staff, scrap, attendance, auditLog, runs, extra, onNavigate }) {
  const h = React.createElement;
  const isAdmin = amgIsPower(currentUser);
  const [view, setView] = useState(amgDefaultView(currentUser));
  const [period, setPeriod] = useState("month");
  const now = useNow(30000);
  // Admin "xem như vai trò": giữ nguyên người dùng thật nhưng thu hẹp theo vai trò được chọn
  const teams = Object.keys(TEAM_REPORT_STAGES);
  const [viewTeam, setViewTeam] = useState(teams[0]);
  // Admin chọn "Tổ trưởng/Nhân viên" → tính đúng như một nhân viên của tổ đã chọn (chỉ thay đổi cách xem, không đổi quyền thật)
  const viewUser = useMemo(() => {
    if (!isAdmin || view === "gd" || view === "qd") return currentUser;
    return Object.assign({}, currentUser, { role: "employee", team: viewTeam });
  }, [isAdmin, view, viewTeam, currentUser]);
  const ex = useMemo(() => amgComputeExecutive({ orders, machines, staff, scrap, attendance, auditLog, runs, extra }, viewUser, { period, now }),
    [orders, machines, staff, scrap, attendance, auditLog, runs, extra, viewUser, period, Math.floor(now.getTime() / 30000)]);
  const sc = ex.scope, can = sc.can, go = t => () => onNavigate && onNavigate(t);
  const C = COLORS;
  const col = n => C[n] || C.textFaint;
  const seg = (items, cur, set, label) => h("div", { className: "dx-seg", role: "group", "aria-label": label },
    Object.entries(items).map(([k, v]) => h("button", { key: k, onClick: () => set(k), "aria-pressed": cur === k }, v)));
  const [a, b] = [ex.range.from, ex.range.to].map(x => x.split("-").reverse().join("/"));
  const oc = ex.orders.counts, mc = ex.machines.counts, q = ex.quality;
  const kpis = [];
  if (can.orders) kpis.push(
    ["Đơn đang mở", oc.active, ClipboardList, C.blue, `${ex.orders.completedPeriod} đơn hoàn thành trong kỳ`, "orders"],
    ["Chưa phân máy", oc.unassigned, AlertCircle, oc.unassigned ? C.amber : C.green, oc.unconfirmed ? `${oc.unconfirmed} đơn chưa xác nhận quy trình` : "Đã phân lệnh đủ", "machines"],
    ["Đang sản xuất", oc.producing, Factory, C.green, "Có lệnh đang chạy", "machines"],
    ["Sắp đến hạn", oc.soon, ClockIcon, oc.soon ? C.amber : C.green, `Trong ${AMG_DUE_SOON_DAYS} ngày tới`, "orders"],
    ["Trễ hạn", oc.overdue, AlertCircle, oc.overdue ? C.red : C.green, oc.risk ? `${oc.risk} đơn có nguy cơ trễ` : "Không có đơn trễ", "orders"]);
  if (can.machines) kpis.push(
    ["Máy đang chạy", `${mc.running}/${mc.total}`, Cog, C.green, `${mc.paused} tạm dừng · ${mc.idle + mc.assigned + mc.unknown} chờ/rảnh`, "machines"],
    ["Bảo trì / hỏng", `${mc.maintenance} / ${mc.broken}`, Wrench, mc.broken ? C.red : (mc.maintenance ? C.violet : C.green), "Máy không sẵn sàng", "machines"]);
  if (can.orders || can.plan) {
    const pk = ex.plan.pct;
    const pt = ["kg", "m"].filter(u => pk[u] !== undefined).map(u => `${pk[u]}% ${u}`).join(" · ");
    kpis.push(
      ["Sản lượng kỳ này", amgFmtUnits(ex.output.actual), Factory, C.copper, `Thành phẩm · ${a}${period === "day" ? "" : " – " + b}`, "reports"],
      ["Hoàn thành kế hoạch", pt || "—", CheckCircle2, C.blue, pt ? `Đã làm ${amgFmtUnits(ex.plan.done)} / ${amgFmtUnits(ex.plan.plan)}` : "Chưa có đơn đang mở", "orders"]);
  }
  if (can.quality) kpis.push(
    ["Chất lượng", q.passRate === null ? "Chưa có" : q.passRate + "%", ShieldCheck, q.failRate ? C.amber : C.green, q.checks ? `${q.pass} đạt · ${q.fail} NG / ${q.checks} lượt kiểm` : "Chưa có phiếu kiểm trong kỳ", "inspect"],
    ["Tỷ lệ phế", q.scrapRate === null ? "Chưa có" : q.scrapRate + "%", Recycle, q.scrapRate > 5 ? C.red : C.green, `Phế liệu ${amgFmtUnits(q.scrap)}`, "qc"]);
  if (can.hr) kpis.push(["Nhân sự có mặt", ex.hr.recorded ? `${ex.hr.present}/${ex.hr.total}` : "Chưa chấm", Users, C.blue, ex.hr.recorded ? `${ex.hr.absent} vắng · ${ex.hr.notRecorded} chưa ghi nhận` : "Hôm nay chưa chấm công", "staff"]);

  const maxDay = Math.max(1, ...ex.days14.map(d => Math.max(d.kg, d.m)));
  const hasDays = ex.days14.some(d => d.kg > 0 || d.m > 0);
  const GRID = "1.1fr 1.3fr .9fr 1fr 1.1fr 1.2fr .8fr";
  const runHead = ["Máy / Công đoạn", "Đơn · Khách hàng", "Sản phẩm", "Kế hoạch / Đã làm", "Tiến độ", "Thời gian · Tốc độ", "Hạn giao"];

  return h("div", { style: { display: "flex", flexDirection: "column", gap: "clamp(12px,1.1vw,20px)" } },
    h("div", { className: "dx-head" },
      h("div", null,
        h("div", { className: "dx-h1 mes-display" }, `Điều hành${isAdmin ? " · " + AMG_VIEWS[view] : ""}`),
        h("div", { className: "dx-sub" }, (period === "day" ? `Ngày ${a}` : `Kỳ ${a} – ${b}`) + (sc.stages ? " · Phạm vi tổ " + sc.team : " · Toàn nhà máy") + " · cập nhật " + now.toTimeString().slice(0, 5))),
      h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
        isAdmin && seg(AMG_VIEWS, view, setView, "Xem như vai trò"),
        isAdmin && (view === "tt" || view === "nv") && h("select", { className: "mes-input", value: viewTeam, onChange: e => setViewTeam(e.target.value), "aria-label": "Tổ", style: { width: "auto" } }, teams.map(t => h("option", { key: t, value: t }, "Tổ " + t))),
        seg(AMG_EXEC_PERIODS, period, setPeriod, "Kỳ báo cáo"))),
    kpis.length ? h("div", { className: "dx-kpis" }, kpis.map(k => h(StatCard, { key: k[0], label: k[0], value: k[1], icon: k[2], accent: k[3], sub: k[4], onClick: go(k[5]) }))) : dxEmpty("Tài khoản chưa được cấp quyền xem phân hệ nào có số liệu tổng quan."),

    (can.orders || can.machines) && h(DxCard, { title: "Lệnh đang chạy theo máy", icon: Factory, note: `${ex.runs.length} lệnh`, flush: true,
      action: h("button", { className: "mes-btn", onClick: go("machines"), style: { padding: "5px 10px" } }, "Mở sơ đồ máy") },
      ex.runs.length === 0 ? dxEmpty("Hiện không có lệnh sản xuất nào đang mở.") : h("div", { role: "table" },
        h("div", { className: "dx-run dx-run-h", style: { gridTemplateColumns: GRID }, role: "row" }, runHead.map(t => h("div", { key: t, role: "columnheader" }, t))),
        ex.runs.map(r => {
          const st = DX_RUN_ST[r.run.productionStatus] || ["—", "textFaint"];
          const t = r.timing, o = r.order;
          const dueTxt = r.days === null ? "—" : r.days < 0 ? `Trễ ${-r.days} ngày` : r.days === 0 ? "Hôm nay" : `Còn ${r.days} ngày`;
          const dueCol = r.overdue ? C.red : r.dueSoon ? C.amber : C.textDim;
          return h("div", { key: r.run.id, className: "dx-run", style: { gridTemplateColumns: GRID }, role: "row" },
            h("div", { className: "dx-run-c" }, h("b", { className: "mes-mono" }, r.run.machineId), h("small", null, amgStageLabel(r.run.stageKey)), h("small", { style: { color: col(st[1]), fontWeight: 700 } }, st[0])),
            h("div", { className: "dx-run-c" }, h("b", { className: "mes-mono" }, r.run.orderId), h("small", null, o ? o.customer || "—" : "Không thấy đơn")),
            h("div", { className: "dx-run-c" }, o ? (o.spec || o.product || "—") : "—", h("small", null, r.run.operator ? "Thợ: " + r.run.operator : "Chưa ghi thợ vận hành"), h("small", null, r.run.shift ? "Ca " + (r.run.shift === "dem" ? "đêm" : r.run.shift === "ngay" ? "ngày" : r.run.shift) : "")),
            h("div", { className: "dx-run-c" }, h("b", null, `${fmtNum(t.produced)} / ${fmtNum(t.planned)} ${r.unit}`), h("small", null, `Còn lại ${fmtNum(t.remain)} ${r.unit}`)),
            h("div", { className: "dx-run-c" }, h("b", null, t.pct === null ? "—" : Math.round(t.pct) + "%"), dxBar(t.pct, col(st[1]))),
            h("div", { className: "dx-run-c" }, t.startedAt ? h("span", null, `Chạy ${fmtDuration(t.netMs)}`) : "Chưa bắt đầu", h("small", null, t.ratePerHour ? `${fmtNum(t.ratePerHour)} ${r.unit}/giờ` : "Chưa đủ dữ liệu tốc độ"), t.pauseCount ? h("small", null, `Dừng ${t.pauseCount} lần · ${fmtDuration(t.pausedMs)}`) : null),
            h("div", { className: "dx-run-c" }, h("b", { style: { color: dueCol } }, dueTxt), h("small", null, o && o.deliveryDate ? String(o.deliveryDate).slice(0, 10).split("-").reverse().join("/") : "")));
        }))),

    h("div", { className: "dx-grid dx-grid--21" },
      can.machines && h(DxCard, { title: "Trạng thái máy theo công đoạn", icon: Cog, note: `${mc.total} máy`, flush: true },
        ex.machines.byStage.length === 0 ? dxEmpty("Chưa có máy trong phạm vi.") : ex.machines.byStage.map(s => h("div", { key: s.key, style: { padding: "10px 16px", borderBottom: `1px solid ${C.border}` } },
          h("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: FZ(AMG_TYPE.md), fontWeight: 700 } }, h("span", null, s.label), h("span", { className: "mes-mono", style: { color: C.textFaint } }, s.total + " máy")),
          h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, ["running", "assigned", "paused", "idle", "maintenance", "broken", "unknown"].filter(k => s[k] > 0).map(k => h("span", { key: k, className: "mes-badge", style: { background: col(DX_MC_ST[k][1]) + "1F", color: col(DX_MC_ST[k][1]), border: `1px solid ${col(DX_MC_ST[k][1])}44`, padding: "2px 9px", borderRadius: 999, fontSize: FZ(AMG_TYPE.xs), fontWeight: 700 } }, `${DX_MC_ST[k][0]} ${s[k]}`)))))),
      h(DxCard, { title: "Cảnh báo cần xử lý", icon: AlertCircle, note: `${ex.alerts.length}`, flush: true },
        ex.alerts.length === 0 ? dxEmpty("Không có cảnh báo từ dữ liệu hiện có.") : h("div", { style: { maxHeight: "min(52vh,520px)", overflowY: "auto", overscrollBehavior: "contain" } },
          ex.alerts.map(al => h("button", { key: al.id, className: "dx-alert", onClick: go(al.tab) },
            h("span", { className: "dx-alert-dot", style: { background: al.level === "err" ? C.red : al.level === "warn" ? C.amber : C.blue } }),
            h("span", { style: { minWidth: 0 } }, h("span", { className: "dx-alert-t", style: { display: "block" } }, al.title), al.detail ? h("span", { className: "dx-alert-d", style: { display: "block" } }, al.detail) : null),
            h("span", { className: "dx-alert-go" }, "Xem →")))))),

    (can.orders || can.plan) && h("div", { className: "dx-grid dx-grid--2" },
      h(DxCard, { title: "Kế hoạch và thực hiện theo công đoạn", icon: BarChart3, note: "Đơn đang mở" },
        ex.stageRows.length === 0 ? dxEmpty("Chưa có đơn đang mở trong phạm vi.") : ex.stageRows.map(s => h("div", { key: s.key, style: { marginBottom: 12 } },
          h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: FZ(AMG_TYPE.sm), marginBottom: 4 } },
            h("b", { style: { color: C.text } }, s.label),
            h("span", { className: "mes-mono", style: { color: C.textDim } }, s.units.map(u => `${fmtNum(s.byUnit[u].done)}/${fmtNum(s.byUnit[u].plan)} ${u}`).join(" · "))),
          s.units.length ? s.units.map(u => h("div", { key: u, style: { marginBottom: 3 } }, dxBar(s.byUnit[u].pct, s.color))) : h("div", { className: "dx-note" }, "Chưa có kế hoạch"),
          h("div", { className: "dx-note" }, `Ghi nhận trong kỳ: ${amgFmtUnits(s.periodOut)}` + (s.lateOrders ? ` · ${s.lateOrders} đơn sắp/đã trễ chưa xong` : ""))))),
      h(DxCard, { title: "Sản lượng thành phẩm 14 ngày", icon: BarChart3, note: `Hôm nay ${amgFmtUnits(ex.output.today)}` },
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 12 } },
          [["Ca ngày", ex.output.shiftDay], ["Ca đêm", ex.output.shiftNight], ["Tuần này", ex.output.week], ["Tháng này", ex.output.month], ["Chưa rõ ca (hôm nay)", ex.output.shiftOther], ["Mọi công đoạn (kỳ)", ex.output.allStages]].map(([l, v]) => h("div", { key: l }, h("div", { className: "dx-note" }, l), h("div", { className: "mes-num", style: { fontWeight: 700, fontSize: FZ(AMG_TYPE.md) } }, amgFmtUnits(v))))),
        !hasDays ? dxEmpty("Chưa có sản lượng thành phẩm trong 14 ngày gần nhất.") : h("div", { style: { display: "flex", alignItems: "flex-end", gap: 4, height: 120 }, role: "img", "aria-label": "Biểu đồ cột sản lượng 14 ngày" },
          ex.days14.map(d => { const v = d.kg || d.m; return h("div", { key: d.key, title: `${d.label}: ${amgFmtUnits(d)}`, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 } },
            h("div", { style: { width: "100%", height: Math.max(v > 0 ? 3 : 0, v / maxDay * 100) + "%", background: d.key === ex.todayKey ? C.copper : C.blue, borderRadius: "3px 3px 0 0", opacity: d.key === ex.todayKey ? 1 : .75 } }),
            h("span", { className: "dx-note", style: { marginTop: 3, fontSize: FZ(10) } }, d.label.slice(0, 2))); })),
        hasDays && h("div", { className: "dx-note", style: { marginTop: 6 } }, "Cột theo ngày; kg và m không cộng lẫn (cột lấy đơn vị có số lớn hơn trong ngày)."))),

    h("div", { className: "dx-grid dx-grid--3" },
      can.orders && h(DxCard, { title: "Đơn trễ & nguy cơ trễ", icon: ClockIcon, note: `${oc.overdue + oc.risk}`, flush: true },
        (ex.orders.late.length + ex.orders.risk.length) === 0 ? dxEmpty("Không có đơn trễ hạn hay nguy cơ trễ.") : h("div", { style: { padding: "4px 16px" } },
          [...ex.orders.late.map(r => [r, "Trễ " + (-r.life.days) + " ngày", C.red]), ...ex.orders.risk.filter(r => !r.life.overdue).map(r => [r, "Còn " + r.life.days + " ngày · " + Math.round(r.prog.pct) + "% (kỳ vọng " + Math.round(r.expected === null ? 0 : r.expected) + "%)", C.amber])].slice(0, 8).map(([r, tx, cl]) => h("div", { key: r.o.id, className: "dx-list-row" },
            h("span", { style: { minWidth: 0 } }, h("b", { className: "mes-mono" }, r.o.id), h("span", { className: "dx-note", style: { display: "block" } }, r.o.customer || "")),
            h("span", { style: { color: cl, fontWeight: 700, fontSize: FZ(AMG_TYPE.sm), textAlign: "right" } }, tx))))),
      can.quality && h(DxCard, { title: "Chất lượng", icon: ShieldCheck, note: ex.range.from.slice(5).split("-").reverse().join("/") + " →", flush: false },
        h("div", { className: "dx-list-row" }, h("span", null, "Phiếu NCR đang mở"), h("b", { style: { color: q.ncrOpen.length ? C.amber : C.green } }, q.ncrOpen.length + (q.ncrOverdue.length ? ` (${q.ncrOverdue.length} quá hạn)` : ""))),
        h("div", { className: "dx-list-row" }, h("span", null, "Lô chờ IQC / cách ly"), h("b", null, `${q.lotsWaiting.length} / ${q.lotsQuar.length}`)),
        h("div", { className: "dx-list-row" }, h("span", null, "Công đoạn phế nhiều nhất"), h("b", null, q.worstStage ? `${q.worstStage.label} (${fmtNum(q.worstStage.qty)})` : "Chưa có")),
        q.topDefects.length ? h("div", { style: { marginTop: 8 } }, h("div", { className: "dx-note", style: { marginBottom: 4 } }, "Lý do phế nhiều nhất"), q.topDefects.map(d => h("div", { key: d.name, className: "dx-list-row" }, h("span", null, d.name), h("span", { className: "mes-mono" }, fmtNum(d.qty))))) : h("div", { className: "dx-note", style: { marginTop: 8 } }, "Chưa có phế liệu ghi nhận trong kỳ.")),
      can.hr && h(DxCard, { title: "Nhân sự hôm nay", icon: Users, note: ex.hr.recorded ? "Đã chấm công" : "Chưa chấm công" },
        ex.hr.total === 0 ? dxEmpty("Chưa có nhân sự trong phạm vi.") : h("div", null,
          h("div", { className: "dx-list-row" }, h("span", null, "Có mặt / tổng"), h("b", null, ex.hr.recorded ? `${ex.hr.present} / ${ex.hr.total}` : "Chưa chấm")),
          h("div", { className: "dx-list-row" }, h("span", null, "Ca ngày · Ca đêm"), h("b", null, ex.hr.recorded ? `${ex.hr.caNgay} · ${ex.hr.caDem}` : "—")),
          h("div", { className: "dx-list-row" }, h("span", null, "Vắng (phép/không phép)"), h("b", null, ex.hr.recorded ? ex.hr.absent : "—")),
          h("div", { className: "dx-list-row" }, h("span", null, "Thợ đang vận hành máy"), h("b", null, ex.hr.operators)),
          ex.hr.depts.slice(0, 6).map(d => h("div", { key: d.team, style: { marginTop: 8 } }, h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: FZ(AMG_TYPE.sm) } }, h("span", null, d.team), h("span", { className: "mes-mono" }, `${d.present}/${d.total}`)), dxBar(d.total ? d.present / d.total * 100 : 0, C.blue)))))));
}
