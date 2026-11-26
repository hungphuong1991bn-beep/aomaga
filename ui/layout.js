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

const AMG_WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
// Đồng hồ thời gian thực: bộ đếm riêng của giao diện (1 giây/lần), KHÔNG ghi gì lên Firebase; chỉ component này vẽ lại mỗi giây.
function HeaderClock() {
  const h = React.createElement;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const p = n => String(n).padStart(2, "0");
  const shift = amgCurrentShift(now);
  return h("div", { className: "mes-clock", title: `Ca hiện tại theo giờ máy (${shift.range})` },
    h("div", { className: "mes-clock-td" },
      h("div", { className: "mes-clock-time mes-mono", "data-testid": "clock" }, `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`),
      h("div", { className: "mes-clock-date" }, `${AMG_WEEKDAYS[now.getDay()]}, ${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`)),
    h("span", { className: "mes-topbar-shift mes-clock-shift" }, shift.label));
}
// Trạng thái đồng bộ lấy từ lớp dữ liệu thật (SSE + hàng đợi ghi), không phải từ việc giao diện vừa vẽ xong.
function SyncBadge() {
  const h = React.createElement;
  const [st, setSt] = useState(() => Object.assign({}, window.__rtdbStatus || {}));
  const [, tick] = useState(0);
  useEffect(() => {
    if (!window.__rtdbSubscribe) return;
    setSt(Object.assign({}, window.__rtdbStatus));
    return window.__rtdbSubscribe(x => setSt(Object.assign({}, x)));
  }, []);
  useEffect(() => { if (!st.lastRemote) return; const id = setTimeout(() => tick(n => n + 1), 4100); return () => clearTimeout(id); }, [st.lastRemote]);
  const v = amgSyncView(st, Date.now());
  const col = { ok: COLORS.green, info: COLORS.blue, warn: COLORS.amber, err: COLORS.red }[v.tone];
  return h("span", { className: "mes-sync mes-sync--" + v.key, title: v.title, role: "status", "aria-live": "polite", "data-sync": v.key, style: { color: col, borderColor: col + "55", background: col + "14" } },
    h("span", { className: "mes-sync-dot" + (v.key === "syncing" || v.key === "connecting" || v.key === "updated" ? " pulse-dot" : ""), style: { background: col } }),
    h("span", { className: "mes-sync-text" }, v.label));
}
// Tìm kiếm toàn hệ thống: Ctrl/⌘+K mở, ESC đóng, ↑↓ chọn, Enter mở đúng tab + đúng bản ghi.
function GlobalSearch({ index, onPick }) {
  const h = React.createElement;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [act, setAct] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => {
    const f = e => { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current && inputRef.current.focus(), 0); } };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  const res = useMemo(() => (q.trim() ? amgSearchRun(index, q, 6) : null), [index, q]);
  const flat = useMemo(() => (res ? res.groups.reduce((a, g) => a.concat(g.items), []) : []), [res]);
  useEffect(() => { setAct(0); }, [q]);
  const close = () => { setOpen(false); if (inputRef.current) inputRef.current.blur(); };
  const pick = it => { if (!it) return; close(); setQ(""); onPick(it); };
  const onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setAct(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAct(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(flat[act]); }
  };
  let n = -1;
  return h("div", { className: "mes-gsearch", role: "search" },
    open && h("div", { style: { position: "fixed", inset: 0, zIndex: 90 }, onClick: close }),
    h("div", { className: "mes-gsearch-box" + (open ? " is-open" : "") },
      h(Search, { size: 15, style: { color: COLORS.textFaint, flexShrink: 0 } }),
      h("input", { ref: inputRef, className: "mes-gsearch-input", value: q, placeholder: "Tìm đơn, khách hàng, máy, nhân sự…", "aria-label": "Tìm kiếm toàn hệ thống (Ctrl+K)", autoComplete: "off", onFocus: () => setOpen(true), onChange: e => { setQ(e.target.value); setOpen(true); }, onKeyDown: onKey }),
      h("kbd", { className: "mes-gsearch-kbd" }, "Ctrl K")),
    open && q.trim() && h("div", { className: "mes-card mes-gsearch-panel", style: { boxShadow: AMG_SHADOW.lg } },
      res && res.total === 0 && h("div", { className: "mes-gsearch-empty" }, `Không tìm thấy kết quả cho “${q.trim()}”. Thử tên khách hàng, mã máy hoặc tên nhân viên.`),
      res && res.groups.map(g => h("div", { key: g.key, className: "mes-gsearch-group" },
        h("div", { className: "mes-gsearch-gh" }, `${g.label} (${g.count})`),
        g.items.map(it => { n++; const idx = n; return h("button", { key: g.key + it.id, className: "mes-gsearch-item" + (idx === act ? " is-active" : ""), onMouseEnter: () => setAct(idx), onClick: () => pick(it) },
          h("span", { className: "mes-gsearch-t" }, it.title), it.sub ? h("span", { className: "mes-gsearch-s" }, it.sub) : null); })))));
}

function TopBar({
  currentUser,
  onLogout,
  pageTitle,
  groupLabel,
  onRefresh,
  onOpenMobileNav,
  onToggleSidebar,
  collapsed,
  theme,
  onToggleTheme,
  orders,
  machines,
  attendance,
  extra,
  onNavigate,
  onNavigateFocus,
  searchOrders,
  searchRuns,
  searchStaff
}) {
  const h = React.createElement;
  const [bellOpen, setBellOpen] = useState(false);
  const roleKey = amgRoleOf(currentUser);
  const roleLabel = AMG_ROLES[roleKey] || "";
  const unit = amgIsPower(currentUser) ? "" : currentUser.team ? `Tổ ${currentUser.team}` : "";
  const list = useAlerts(orders, machines, attendance, extra);
  const LV = { err: COLORS.red, warn: COLORS.amber, info: COLORS.blue };
  // Chỉ mục tìm kiếm dựng từ dữ liệu ĐÃ có trong bộ nhớ; chỉ gồm các tab người dùng được xem
  const allowedTabs = useMemo(() => amgNavVisible(currentUser, currentUser.role).map(n => n.key), [currentUser]);
  const index = useMemo(() => amgBuildSearchIndex({ orders: searchOrders || orders, runs: searchRuns, machines, staff: searchStaff, extra, allowedTabs }), [searchOrders, orders, searchRuns, machines, searchStaff, extra, allowedTabs]);
  const go = it => { const f = Object.assign({ id: it.id }, it.focus); if (onNavigateFocus) onNavigateFocus(it.tab, f); else if (onNavigate) onNavigate(it.tab); };
  const sync = () => { try { if (window.__rtdbResync) window.__rtdbResync(); } catch (e) {} if (onRefresh) onRefresh(); };
  return h("header", { className: "mes-topbar" },
    h("div", { className: "mes-topbar-left", style: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 } },
      h("button", { onClick: onOpenMobileNav, className: "mes-btn mes-btn-ghost mes-hamburger-btn", "aria-label": "Mở menu", style: { padding: 8, flexShrink: 0 } }, h(Menu, { size: 19 })),
      h("button", { onClick: onToggleSidebar, className: "mes-iconbtn mes-collapse-btn", title: collapsed ? "Mở rộng menu" : "Thu gọn menu", "aria-label": collapsed ? "Mở rộng menu" : "Thu gọn menu", "aria-expanded": !collapsed }, h(Menu, { size: 17 })),
      h("div", { className: "mes-topbar-crumb" }, groupLabel ? h("small", null, groupLabel) : null, h("b", { className: "mes-display" }, pageTitle))),
    h(GlobalSearch, { index, onPick: go }),
    h("div", { className: "mes-topbar-right", style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } },
      h(HeaderClock, null),
      h(SyncBadge, null),
      h("div", { style: { position: "relative" } },
        h("button", { onClick: () => setBellOpen(o => !o), className: "mes-iconbtn", title: "Thông báo", "aria-label": `Thông báo, ${list.length} mục`, "aria-expanded": bellOpen, style: { position: "relative" } },
          h(Bell, { size: 17 }),
          list.length > 0 && h("span", { style: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 999, background: COLORS.red, color: "#fff", fontSize: FZ(11), fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" } }, list.length > 99 ? "99+" : list.length)),
        bellOpen && h("div", { style: { position: "fixed", inset: 0, zIndex: 90 }, onClick: () => setBellOpen(false) }),
        bellOpen && h("div", { className: "mes-card", style: { position: "absolute", right: 0, top: 42, width: 360, maxWidth: "90vw", boxShadow: AMG_SHADOW.lg, zIndex: 100, overflow: "hidden" } },
          h("div", { style: { padding: "11px 14px", fontSize: FZ(AMG_TYPE.md), fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text } }, `Cảnh báo cần xử lý (${list.length})`),
          list.length === 0 && h("div", { style: { padding: 16, fontSize: FZ(AMG_TYPE.sm), color: COLORS.textDim } }, "Không có cảnh báo từ dữ liệu hiện có."),
          h("div", { style: { maxHeight: "60vh", overflowY: "auto", overscrollBehavior: "contain" } },
            list.map(a => h("button", { key: a.id, onClick: () => { setBellOpen(false); onNavigate && onNavigate(a.tab); }, className: "dx-alert" },
              h("span", { className: "dx-alert-dot", style: { background: LV[a.level] } }),
              h("span", { style: { minWidth: 0 } }, h("span", { className: "dx-alert-t", style: { display: "block" } }, a.title), a.detail ? h("span", { className: "dx-alert-d", style: { display: "block" } }, a.detail) : null)))))),
      h("button", { onClick: onToggleTheme, title: theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối", "aria-label": "Đổi giao diện sáng/tối", className: "mes-iconbtn" }, theme === "dark" ? h(SunIcon, { size: 16 }) : h(MoonIcon, { size: 16 })),
      h("button", { onClick: sync, title: "Đồng bộ ngay: nối lại luồng dữ liệu và gửi các thay đổi đang chờ", "aria-label": "Đồng bộ dữ liệu ngay", className: "mes-iconbtn" }, h(RefreshCw, { size: 15 })),
      h("div", { className: "mes-topbar-divider", style: { width: 1, height: 24, background: COLORS.border, margin: "0 4px" } }),
      h("div", { className: "mes-topbar-user", style: { textAlign: "right", lineHeight: 1.25 } },
        h("div", { style: { fontSize: FZ(AMG_TYPE.md), fontWeight: 600, color: COLORS.text } }, currentUser.fullName),
        h("div", { style: { fontSize: FZ(AMG_TYPE.xs), color: COLORS.textFaint } }, [roleLabel, unit].filter(Boolean).join(" · "))),
      h("div", { style: { width: 34, height: 34, borderRadius: 999, background: amgIsPower(currentUser) ? COLORS.copper : COLORS.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FZ(AMG_TYPE.md), fontWeight: 700, color: "#FFFFFF", flexShrink: 0 } }, (currentUser.fullName || "?").trim().charAt(0).toUpperCase()),
      h(IconButton, { icon: LogOut, onClick: onLogout, title: "Đăng xuất" })));
}
