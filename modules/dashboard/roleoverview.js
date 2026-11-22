/* Tổng quan điều hành theo vai trò (v45). Số liệu lấy từ domain/kpi.js, chỉ dùng dữ liệu thật. */
function RoleOverview({ currentUser, orders, machines, staff, scrap, attendance, auditLog, onNavigate }) {
  const h = React.createElement;
  const isAdmin = amgIsPower(currentUser);
  const [view, setView] = useState(amgDefaultView(currentUser));
  const [period, setPeriod] = useState("month");
  const kpi = useMemo(() => amgComputeKpis(view, { orders, machines, staff, scrap, attendance, auditLog }, currentUser, period),
    [view, period, orders, machines, staff, scrap, attendance, auditLog, currentUser]);
  const alerts = useMemo(() => amgComputeAlerts({ orders, machines, attendance }), [orders, machines, attendance]);
  const ICON = { orders: ClipboardList, cog: Cog, users: Users, recycle: Recycle, factory: Factory, alert: AlertCircle };
  const TONE = { ok: COLORS.green, warn: COLORS.amber, err: COLORS.copper, info: COLORS.blue, none: COLORS.textFaint };
  const seg = (items, cur, set, label) => h("div", { role: "group", "aria-label": label, style: { display: "inline-flex", border: `1px solid ${COLORS.borderLight}`, borderRadius: 8, overflow: "hidden", background: COLORS.bgPanel } },
    Object.entries(items).map(([k, v]) => h("button", { key: k, onClick: () => set(k), "aria-pressed": cur === k, style: { padding: "6px 12px", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", background: cur === k ? COLORS.navy : "transparent", color: cur === k ? "#fff" : COLORS.textDim } }, v)));
  const maxBar = Math.max(1, ...kpi.flow.map(f => Math.max(f.plan, f.done)));
  const [a, b] = [kpi.range.from, kpi.range.to].map(x => x.split("-").reverse().join("/"));
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" } },
      h("div", null,
        h("div", { className: "mes-display", style: { fontSize: 17, fontWeight: 700, color: COLORS.text } }, `Điều hành · ${AMG_VIEWS[view]}`),
        h("div", { style: { fontSize: 12, color: COLORS.textFaint } }, period === "day" ? `Ngày ${a}` : `Kỳ ${a} – ${b}`)),
      h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
        isAdmin && seg(AMG_VIEWS, view, setView, "Xem như vai trò"),
        seg(AMG_PERIODS, period, setPeriod, "Kỳ báo cáo"))),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 } },
      kpi.tiles.map(t => h(StatCard, { key: t.key, icon: ICON[t.icon] || ClipboardList, label: t.label, value: t.value, sub: t.sub, accent: TONE[t.tone] }))),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 } },
      h("div", { className: "mes-card", style: { padding: 16 } },
        h("div", { style: { fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 2 } }, "Kế hoạch và thực hiện theo công đoạn"),
        h("div", { style: { fontSize: 11.5, color: COLORS.textFaint, marginBottom: 10 } }, "Số lượng đặt so với đã làm, trên các đơn chưa hoàn thành"),
        kpi.flow.length === 0 && h("div", { style: { fontSize: 12.5, color: COLORS.textDim } }, "Chưa có đơn hàng đang mở cho phạm vi này."),
        kpi.flow.map(f => h("div", { key: f.key, style: { marginBottom: 9 } },
          h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.textDim, marginBottom: 3 } },
            h("span", null, f.label), h("span", { className: "mes-mono" }, `${fmtNum(Math.round(f.done))} / ${fmtNum(Math.round(f.plan))}`)),
          h("div", { style: { position: "relative", height: 8, borderRadius: 4, background: COLORS.bgPanel2 } },
            h("div", { style: { position: "absolute", inset: 0, width: `${f.plan / maxBar * 100}%`, borderRadius: 4, background: COLORS.borderLight } }),
            h("div", { style: { position: "absolute", inset: 0, width: `${Math.min(f.done, maxBar) / maxBar * 100}%`, borderRadius: 4, background: COLORS.copper } }))))),
      h("div", { className: "mes-card", style: { padding: 16 } },
        h("div", { style: { fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10 } }, `Cần xử lý (${alerts.length})`),
        alerts.length === 0 && h("div", { style: { fontSize: 12.5, color: COLORS.textDim } }, "Không có cảnh báo từ dữ liệu hiện có."),
        alerts.map(al => h("button", { key: al.id, onClick: () => onNavigate && onNavigate(al.tab), style: { display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "8px 0", background: "transparent", border: "none", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", color: COLORS.text } },
          h("span", { style: { width: 8, height: 8, borderRadius: 999, background: TONE[al.level], marginTop: 5, flexShrink: 0 } }),
          h("span", { style: { fontSize: 12.5, lineHeight: 1.4 } }, h("b", null, al.title), al.detail ? h("span", { style: { display: "block", color: COLORS.textDim, fontSize: 11.5 } }, al.detail) : null))))));
}
