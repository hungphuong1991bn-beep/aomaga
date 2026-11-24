/* ---------- Button (v49: kiểu dáng nằm ở CSS .mes-btn*, một chỗ duy nhất) ---------- */
function Button({
  variant,
  size,
  disabled,
  onClick,
  children,
  style,
  type = "button",
  className,
  ...rest
}) {
  const cls = ["mes-btn", variant === "primary" ? "mes-btn--primary" : variant === "danger" ? "mes-btn--danger" : variant === "ghost" ? "mes-btn--ghost mes-btn-ghost" : "", size === "sm" ? "mes-btn--sm" : "", className || ""].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", {
    type,
    className: cls,
    disabled,
    onClick: disabled ? undefined : onClick,
    style,
    ...rest
  }, children);
}

/* ---------- IconButton ---------- */
function IconButton({ icon: Icon, onClick, title, danger, style, disabled }) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    title,
    "aria-label": title,
    disabled,
    onClick,
    className: "mes-iconbtn" + (danger ? " mes-iconbtn--danger" : ""),
    style
  }, Icon && /*#__PURE__*/React.createElement(Icon, { size: 15 }));
}

/* ---------- Modal ---------- */
function Modal({ title, onClose, width = 520, children }) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-mobile-modal-backdrop",
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(8,16,30,.55)",
      backdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: 16
    },
    onClick: e => { if (e.target === e.currentTarget && onClose) onClose(); }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-card mes-fade-in mes-modal-card",
    role: "dialog",
    "aria-modal": "true",
    style: {
      width: "100%",
      maxWidth: width,
      maxHeight: "90vh",
      overflowY: "auto",
      overscrollBehavior: "contain",
      padding: 24,
      position: "relative",
      boxShadow: AMG_SHADOW.lg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 18,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: { fontSize: FZ(AMG_TYPE.xl), fontWeight: 700, color: COLORS.text, lineHeight: 1.3 }
  }, title), onClose && /*#__PURE__*/React.createElement(IconButton, {
    icon: X,
    onClick: onClose,
    title: "Đóng"
  })), children));
}

/* ---------- Badge ---------- */
function Badge({ color = COLORS.textDim, children }) {
  return /*#__PURE__*/React.createElement("span", {
    className: "mes-badge",
    style: {
      background: color + "1F",
      color,
      border: `1px solid ${color}40`
    }
  }, children);
}

/* ---------- Field ---------- */
function Field({ label, children }) {
  return /*#__PURE__*/React.createElement("label", {
    style: { display: "block", marginBottom: 14 }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: FZ(AMG_TYPE.sm), fontWeight: 600, color: COLORS.textDim, marginBottom: 6 }
  }, label), children);
}

/* ---------- ProgressBar ---------- */
function ProgressBar({ pct, color }) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const barColor = color || (p >= 100 ? COLORS.green : p >= 60 ? COLORS.blue : COLORS.amber);
  return /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": Math.round(p),
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    style: { width: "100%", height: 8, background: COLORS.bgPanel2, border: `1px solid ${COLORS.border}`, borderRadius: 99, overflow: "hidden" }
  }, /*#__PURE__*/React.createElement("div", {
    style: { width: p + "%", height: "100%", background: barColor, borderRadius: 99, transition: "width .3s ease" }
  }));
}

/* ---------- SectionHeading (tiêu đề trang chuẩn: gọn, không chiếm diện tích) ---------- */
function SectionHeading({ eyebrow, title, subtitle, action, icon: Icon, iconColor }) {
  const _iconColor = iconColor || COLORS.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0
    }
  }, Icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      flexShrink: 0,
      borderRadius: 11,
      background: `${_iconColor}14`,
      border: `1px solid ${_iconColor}33`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    size: 21,
    color: _iconColor
  })), /*#__PURE__*/React.createElement("div", { style: { minWidth: 0 } }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(AMG_TYPE.xs),
      fontWeight: 700,
      letterSpacing: ".06em",
      textTransform: "uppercase",
      color: COLORS.textFaint,
      marginBottom: 2
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: { fontSize: FZ(AMG_TYPE.x2), fontWeight: 800, color: COLORS.text, letterSpacing: "-.02em", lineHeight: 1.15 }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: FZ(AMG_TYPE.sm), color: COLORS.textDim, marginTop: 3 }
  }, subtitle))), action && /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, action));
}

/* ---------- EmptyState ---------- */
function EmptyState({ icon: Icon, title, hint, action }) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      textAlign: "center",
      color: COLORS.textDim
    }
  }, Icon && /*#__PURE__*/React.createElement(Icon, { size: 28, style: { marginBottom: 10, opacity: .55 } }),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: FZ(AMG_TYPE.md), fontWeight: 700, color: COLORS.text, marginBottom: hint || action ? 6 : 0 }
    }, title),
    hint && /*#__PURE__*/React.createElement("div", {
      style: { fontSize: FZ(AMG_TYPE.sm), maxWidth: 380, marginBottom: action ? 14 : 0 }
    }, hint),
    action);
}

/* ---------- Card có tiêu đề (dùng chung cho Dashboard và các tab) ---------- */
function PanelCard({ title, icon: Icon, iconColor, note, action, children, flush, style, className }) {
  return /*#__PURE__*/React.createElement("section", { className: "mes-card dx-card " + (className || ""), style }, (title || action) && /*#__PURE__*/React.createElement("div", { className: "dx-card-h" },
    /*#__PURE__*/React.createElement("div", { className: "dx-card-t" }, Icon && /*#__PURE__*/React.createElement(Icon, { size: 17, color: iconColor || COLORS.blue, style: { flexShrink: 0 } }), /*#__PURE__*/React.createElement("span", null, title), note && /*#__PURE__*/React.createElement("span", { className: "dx-card-n" }, note)),
    action), /*#__PURE__*/React.createElement("div", { className: "dx-card-b" + (flush ? " dx-card-b--flush" : "") }, children));
}
