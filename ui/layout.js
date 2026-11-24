/* ===================== LAYOUT: SIDEBAR + TOPBAR (v49) =====================
   Sidebar: logo cố định phía trên · danh sách menu (CHỈ vùng này cuộn) · nút thu gọn cố định phía dưới.
   Menu được nhóm theo NAV_GROUPS; chỉ hiện những mục thật sự có trong NAV_ITEMS mà người dùng có quyền xem.
   Cuộn độc lập: .mes-sb-nav { overflow-y:auto; min-height:0; overscroll-behavior:contain } nằm trong khung flex cột;
   vùng nội dung (.mes-content-scroll) là một khối anh em riêng nên lăn chuột trên Sidebar không thể làm nội dung cuộn theo. */
const AMG_NAV_ORDER = ["dashboard", "orders", "completed", "machines", "ops", "downtime", "qc", "inspect", "trace", "certificates", "warehouse", "staff", "training", "reports", "reports2", "maintenance", "docs", "perms", "admin"];
function amgNavVisible(currentUser, role) {
  return NAV_ITEMS.filter(n => n.roles.includes(role) && (!n.mod || amgIsPower(currentUser) || amgCan(currentUser, "v", n.mod)));
}
// Danh sách nhóm đã lọc quyền, theo thứ tự cố định (dùng cho Sidebar và kiểm thử)
function amgNavGroups(currentUser, role) {
  const vis = amgNavVisible(currentUser, role);
  const rank = k => { const i = AMG_NAV_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return NAV_GROUPS.map(g => ({ key: g.key, label: g.label, items: vis.filter(n => n.group === g.key).sort((a, b) => rank(a.key) - rank(b.key)) })).filter(g => g.items.length > 0);
}
function amgNavMeta(tabKey) {
  const it = NAV_ITEMS.find(n => n.key === tabKey);
  const g = it && NAV_GROUPS.find(x => x.key === it.group);
  return { label: it ? it.label : "", group: g ? g.label : "" };
}

function Sidebar({
  active,
  onChange,
  role,
  currentUser,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile
}) {
  const h = React.createElement;
  const [tip, setTip] = useState(null);
  const groups = useMemo(() => amgNavGroups(currentUser, role), [currentUser, role]);
  const showTip = (e, label) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);
  return h("aside", {
    className: "mes-sidebar" + (collapsed ? " mes-sidebar--collapsed" : "") + (mobileOpen ? " mes-sidebar--open" : ""),
    "aria-label": "Điều hướng chính"
  },
  h("div", { className: "mes-sb-head" },
    h("div", { className: "mes-sb-logo" }, h("img", { src: LOGO_DATA_URI, alt: "AOMAGA", style: { width: "100%", height: "100%", objectFit: "contain" } })),
    h("div", { className: "mes-sb-brand" }, h("b", { className: "mes-display" }, "AOMAGA"), h("span", null, "VIỆT NAM · MES")),
    h("button", { onClick: onCloseMobile, className: "mes-sidebar-close mes-btn-ghost", "aria-label": "Đóng menu", style: { border: "none", background: "transparent", color: "rgba(255,255,255,.75)", cursor: "pointer", padding: 6, alignItems: "center" } }, h(X, { size: 20 }))),
  h("nav", { className: "mes-sb-nav", onScroll: hideTip },
    groups.map(g => h("div", { key: g.key, className: "mes-sb-group", role: "group", "aria-label": g.label },
      h("div", { className: "mes-sb-title" }, g.label),
      g.items.map(item => {
        const isActive = active === item.key;
        const Icon = item.icon;
        return h("button", {
          key: item.key,
          onClick: () => { hideTip(); onChange(item.key); },
          onMouseEnter: e => showTip(e, item.label),
          onMouseLeave: hideTip,
          onFocus: e => showTip(e, item.label),
          onBlur: hideTip,
          title: collapsed ? undefined : item.label,
          "aria-label": item.label,
          "aria-current": isActive ? "page" : undefined,
          className: "mes-nav-item" + (isActive ? " is-active" : "")
        }, h(Icon, { size: 18 }), h("span", null, item.label));
      })))),
  h("div", { className: "mes-sb-foot" },
    h("button", { onClick: onToggleCollapse, className: "mes-sb-collapse", title: collapsed ? "Mở rộng menu" : "Thu gọn menu", "aria-label": collapsed ? "Mở rộng menu" : "Thu gọn menu", "aria-expanded": !collapsed },
      collapsed ? h(ChevronRight, { size: 16 }) : h(React.Fragment, null, h(ChevronDown, { size: 16, style: { transform: "rotate(90deg)" } }), "Thu gọn"))),
  tip && collapsed && h("div", { className: "mes-sb-tip", style: { top: tip.top, left: tip.left }, role: "tooltip" }, tip.label));
}

// Danh sách cảnh báo tính từ dữ liệu thật; chỉ tính lại khi dữ liệu nguồn đổi (không tính lại mỗi lần vẽ lại cả ứng dụng)
function useAlerts(orders, machines, attendance, extra) {
  return useMemo(() => amgComputeAlerts({ orders, machines, attendance, extra }), [orders, machines, attendance, extra]);
}

function TopBar({
  currentUser,
  onLogout,
  pageTitle,
  groupLabel,
  onRefresh,
  onOpenMobileNav,
  theme,
  onToggleTheme,
  orders,
  machines,
  attendance,
  extra,
  onNavigate
}) {
  const h = React.createElement;
  const [bellOpen, setBellOpen] = useState(false);
  const roleKey = amgRoleOf(currentUser);
  const roleLabel = AMG_ROLES[roleKey] || "";
  const unit = amgIsPower(currentUser) ? "" : currentUser.team ? `Tổ ${currentUser.team}` : "";
  const shift = amgCurrentShift();
  const list = useAlerts(orders, machines, attendance, extra);
  const LV = { err: COLORS.red, warn: COLORS.amber, info: COLORS.blue };
  const pill = {
    fontSize: FZ(AMG_TYPE.xs), fontWeight: 600, padding: "4px 11px", borderRadius: 999,
    background: COLORS.bgPanel2, border: `1px solid ${COLORS.border}`, color: COLORS.textDim, whiteSpace: "nowrap"
  };
  return h("header", { className: "mes-topbar" },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 } },
      h("button", { onClick: onOpenMobileNav, className: "mes-btn mes-btn-ghost mes-hamburger-btn", "aria-label": "Mở menu", style: { padding: 8, flexShrink: 0 } }, h(Menu, { size: 19 })),
      h("div", { className: "mes-topbar-crumb" }, groupLabel ? h("small", null, groupLabel) : null, h("b", { className: "mes-display" }, pageTitle))),
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } },
      h("span", { className: "mes-topbar-shift", style: pill, title: `Ca hiện tại theo giờ máy (${shift.range})` }, shift.label),
      h("div", { style: { position: "relative" } },
        h("button", { onClick: () => setBellOpen(o => !o), className: "mes-iconbtn", title: "Thông báo", "aria-label": `Thông báo, ${list.length} mục`, "aria-expanded": bellOpen, style: { position: "relative" } },
          h(Bell, { size: 17 }),
          list.length > 0 && h("span", { style: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 999, background: COLORS.red, color: "#fff", fontSize: FZ(11), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", border: `2px solid ${COLORS.bgPanel}` } }, list.length)),
        bellOpen && h("div", { style: { position: "fixed", inset: 0, zIndex: 90 }, onClick: () => setBellOpen(false) }),
        bellOpen && h("div", { className: "mes-card", style: { position: "absolute", right: 0, top: 42, width: 360, maxWidth: "90vw", boxShadow: AMG_SHADOW.lg, zIndex: 100, overflow: "hidden" } },
          h("div", { style: { padding: "11px 14px", fontSize: FZ(AMG_TYPE.md), fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text } }, `Cảnh báo cần xử lý (${list.length})`),
          list.length === 0 && h("div", { style: { padding: 16, fontSize: FZ(AMG_TYPE.sm), color: COLORS.textDim } }, "Không có cảnh báo từ dữ liệu hiện có."),
          h("div", { style: { maxHeight: "60vh", overflowY: "auto", overscrollBehavior: "contain" } },
            list.map(a => h("button", { key: a.id, onClick: () => { setBellOpen(false); onNavigate && onNavigate(a.tab); }, className: "dx-alert" },
              h("span", { className: "dx-alert-dot", style: { background: LV[a.level] } }),
              h("span", { style: { minWidth: 0 } }, h("span", { className: "dx-alert-t", style: { display: "block" } }, a.title), a.detail ? h("span", { className: "dx-alert-d", style: { display: "block" } }, a.detail) : null)))))),
      h("button", { onClick: onToggleTheme, title: theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối", "aria-label": "Đổi giao diện sáng/tối", className: "mes-iconbtn" }, theme === "dark" ? h(SunIcon, { size: 16 }) : h(MoonIcon, { size: 16 })),
      h("button", { onClick: onRefresh, title: "Đồng bộ dữ liệu mới nhất", "aria-label": "Đồng bộ dữ liệu mới nhất", className: "mes-iconbtn" }, h(RefreshCw, { size: 15 })),
      h("div", { className: "mes-topbar-divider", style: { width: 1, height: 24, background: COLORS.border, margin: "0 4px" } }),
      h("div", { className: "mes-topbar-user", style: { textAlign: "right", lineHeight: 1.25 } },
        h("div", { style: { fontSize: FZ(AMG_TYPE.md), fontWeight: 600, color: COLORS.text } }, currentUser.fullName),
        h("div", { style: { fontSize: FZ(AMG_TYPE.xs), color: COLORS.textFaint } }, [roleLabel, unit].filter(Boolean).join(" · "))),
      h("div", { style: { width: 34, height: 34, borderRadius: 999, background: amgIsPower(currentUser) ? COLORS.copper : COLORS.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FZ(AMG_TYPE.md), fontWeight: 700, color: "#FFFFFF", flexShrink: 0 }, "aria-hidden": "true" }, currentUser.fullName?.slice(0, 1)?.toUpperCase()),
      h(IconButton, { icon: LogOut, onClick: onLogout, title: "Đăng xuất" })));
}
