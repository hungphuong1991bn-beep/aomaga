/* ===================== LAYOUT: SIDEBAR + TOPBAR ===================== */
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
  const SB_BG = COLORS.sidebarBg;
  const SB_BG2 = COLORS.sidebarBg2;
  const SB_BORDER = "rgba(255,255,255,0.16)";
  const SB_TEXT = "#FFFFFF";
  const SB_TEXT_DIM = "rgba(255,255,255,0.72)";
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-sidebar" + (mobileOpen ? " mes-sidebar--open" : ""),
    style: {
      width: collapsed ? 64 : 232,
      flexShrink: 0,
      background: `linear-gradient(190deg, ${SB_BG}, ${SB_BG2})`,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      transition: "width .18s ease",
      boxShadow: "2px 0 18px rgba(7,26,49,.35)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: collapsed ? "18px 10px" : "20px 16px",
      minHeight: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 2px 6px rgba(0,0,0,.18)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: LOGO_DATA_URI,
    alt: "Logo",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain"
    }
  })), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "hidden",
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: 15,
      fontWeight: 800,
      letterSpacing: "-.01em",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: SB_TEXT,
      lineHeight: 1.15
    }
  }, "AOMAGA"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: ".08em",
      color: "rgba(255,255,255,0.85)",
      whiteSpace: "nowrap"
    }
  }, "VIỆT NAM")), /*#__PURE__*/React.createElement("button", {
    onClick: onCloseMobile,
    className: "mes-sidebar-close",
    "aria-label": "Đóng menu",
    style: {
      border: "none",
      background: "transparent",
      color: SB_TEXT_DIM,
      cursor: "pointer",
      padding: 4,
      display: "none"
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 20
  }))), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: "10px 10px",
      overflowY: "auto"
    }
  }, NAV_ITEMS.filter(n => n.roles.includes(role) && (!n.mod || amgIsPower(currentUser) || amgCan(currentUser, "v", n.mod))).map(item => {
    const isActive = active === item.key;
    const Icon = item.icon;
    return /*#__PURE__*/React.createElement("button", {
      key: item.key,
      onClick: () => onChange(item.key),
      title: item.label,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        padding: "10px 12px",
        marginBottom: 4,
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        background: isActive ? "#FFFFFF" : "transparent",
        color: isActive ? COLORS.sidebarActiveText : SB_TEXT_DIM,
        fontSize: 13,
        fontWeight: isActive ? 700 : 500,
        boxShadow: isActive ? "0 3px 10px rgba(0,0,0,.18)" : "none",
        transition: "background .12s ease, color .12s ease"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      size: 16,
      style: {
        flexShrink: 0
      }
    }), !collapsed && /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: "nowrap",
        overflow: "hidden"
      }
    }, item.label));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleCollapse,
    className: "mes-sidebar-collapse-btn",
    style: {
      margin: 10,
      justifyContent: "center",
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 10px",
      borderRadius: 8,
      border: `1px solid ${SB_BORDER}`,
      background: "rgba(255,255,255,0.1)",
      color: SB_TEXT,
      cursor: "pointer",
      fontSize: 12.5
    }
  }, collapsed ? /*#__PURE__*/React.createElement(ChevronRight, {
    size: 15
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ChevronDown, {
    size: 15,
    style: {
      transform: "rotate(90deg)"
    }
  }), " Thu gọn")));
}
function TopBar({
  currentUser,
  onLogout,
  pageTitle,
  onRefresh,
  onOpenMobileNav,
  theme,
  onToggleTheme,
  alerts,
  onNavigate
}) {
  const h = React.createElement;
  const [bellOpen, setBellOpen] = useState(false);
  const roleKey = amgRoleOf(currentUser);
  const roleLabel = AMG_ROLES[roleKey] || "";
  const unit = amgIsPower(currentUser) ? "" : currentUser.team ? `Tổ ${currentUser.team}` : "";
  const shift = amgCurrentShift();
  const list = alerts || [];
  const LV = { err: COLORS.copper, warn: COLORS.amber, info: COLORS.blue };
  const pill = {
    fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
    background: COLORS.bgPanel2, border: `1px solid ${COLORS.border}`, color: COLORS.textDim, whiteSpace: "nowrap"
  };
  return h("div", {
    className: "mes-topbar",
    style: {
      height: 60, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 22px", position: "sticky", top: 0,
      background: COLORS.bgPanel, zIndex: 50, gap: 10
    }
  },
  h("div", { style: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 } },
    h("button", { onClick: onOpenMobileNav, className: "mes-btn mes-btn-ghost mes-hamburger-btn", "aria-label": "Mở menu", style: { padding: 8, flexShrink: 0 } }, h(Menu, { size: 18 })),
    h("div", { className: "mes-display", style: { fontSize: 15, fontWeight: 600, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pageTitle)),
  h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 } },
    h("span", { className: "mes-topbar-shift", style: pill, title: `Ca hiện tại theo giờ máy (${shift.range})` }, shift.label),
    h("div", { style: { position: "relative" } },
      h("button", { onClick: () => setBellOpen(o => !o), className: "mes-btn mes-btn-ghost", title: "Thông báo", "aria-label": `Thông báo, ${list.length} mục`, style: { padding: 8, position: "relative" } },
        h(Bell, { size: 16 }),
        list.length > 0 && h("span", { style: { position: "absolute", top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 999, background: COLORS.copper, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" } }, list.length)),
      bellOpen && h("div", { style: { position: "fixed", inset: 0, zIndex: 90 }, onClick: () => setBellOpen(false) }),
      bellOpen && h("div", { style: { position: "absolute", right: 0, top: 42, width: 320, maxWidth: "88vw", background: COLORS.bgPanel, border: `1.5px solid ${COLORS.borderLight}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,.25)", zIndex: 100, overflow: "hidden" } },
        h("div", { style: { padding: "10px 14px", fontSize: 12.5, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text } }, "Cảnh báo cần xử lý"),
        list.length === 0 && h("div", { style: { padding: 16, fontSize: 12.5, color: COLORS.textDim } }, "Không có cảnh báo từ dữ liệu hiện có."),
        list.map(a => h("button", { key: a.id, onClick: () => { setBellOpen(false); onNavigate && onNavigate(a.tab); }, style: { display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", color: COLORS.text } },
          h("span", { style: { width: 8, height: 8, borderRadius: 999, background: LV[a.level], marginTop: 5, flexShrink: 0 } }),
          h("span", { style: { fontSize: 12.5, lineHeight: 1.4 } }, h("b", null, a.title), a.detail ? h("span", { style: { display: "block", color: COLORS.textDim, fontSize: 11.5 } }, a.detail) : null))))),
    h("button", { onClick: onToggleTheme, title: theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối", "aria-label": "Đổi giao diện sáng/tối", className: "mes-btn mes-btn-ghost", style: { padding: 8 } }, theme === "dark" ? h(SunIcon, { size: 16 }) : h(MoonIcon, { size: 16 })),
    h("button", { onClick: onRefresh, title: "Đồng bộ dữ liệu mới nhất", className: "mes-btn mes-btn-ghost", style: { padding: 8 } }, h(RefreshCw, { size: 15 })),
    h("div", { className: "mes-topbar-divider", style: { width: 1, height: 22, background: COLORS.border } }),
    h("div", { className: "mes-topbar-user", style: { textAlign: "right" } },
      h("div", { style: { fontSize: 12.5, fontWeight: 600, color: COLORS.text } }, currentUser.fullName),
      h("div", { style: { fontSize: 10.5, color: COLORS.textFaint } }, [roleLabel, unit].filter(Boolean).join(" · "))),
    h("div", { style: { width: 32, height: 32, borderRadius: 999, background: amgIsPower(currentUser) ? COLORS.copper : COLORS.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#FFFFFF", flexShrink: 0 } }, currentUser.fullName?.slice(0, 1)?.toUpperCase()),
    h(IconButton, { icon: LogOut, onClick: onLogout, title: "Đăng xuất" })));
}
