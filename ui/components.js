/* ---------- Button ---------- */
function Button({
  variant,
  size,
  disabled,
  onClick,
  children,
  style,
  type = "button",
  ...rest
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: size === "sm" ? "6px 10px" : "9px 16px",
    fontSize: size === "sm" ? 12.5 : 13.5,
    fontWeight: 600,
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgPanel2,
    color: COLORS.text,
    opacity: disabled ? 0.55 : 1,
    whiteSpace: "nowrap"
  };
  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.copper}, ${COLORS.copperBright})`,
      border: "1px solid transparent",
      color: "#1a1006"
    },
    danger: {
      background: COLORS.redDim,
      border: `1px solid ${COLORS.red}55`,
      color: COLORS.red
    },
    ghost: {
      background: "transparent",
      border: "1px solid transparent",
      color: COLORS.textDim
    }
  };
  const cls = "mes-btn" + (variant === "ghost" ? " mes-btn-ghost" : "");
  return /*#__PURE__*/React.createElement("button", {
    type,
    className: cls,
    disabled,
    onClick: disabled ? undefined : onClick,
    style: { ...base, ...(variants[variant] || {}), ...style },
    ...rest
  }, children);
}

/* ---------- IconButton ---------- */
function IconButton({ icon: Icon, onClick, title, danger, style, disabled }) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    title,
    disabled,
    onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      borderRadius: 7,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.bgPanel2,
      color: danger ? COLORS.red : COLORS.textDim,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      flexShrink: 0,
      ...style
    }
  }, Icon && /*#__PURE__*/React.createElement(Icon, { size: 14 }));
}

/* ---------- Modal ---------- */
function Modal({ title, onClose, width = 520, children }) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-mobile-modal-backdrop",
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(3,5,8,.6)",
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
    style: {
      width: "100%",
      maxWidth: width,
      maxHeight: "88vh",
      overflowY: "auto",
      padding: 24,
      position: "relative"
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
    style: { fontSize: 17, fontWeight: 700, color: COLORS.text }
  }, title), onClose && /*#__PURE__*/React.createElement(IconButton, {
    icon: X,
    onClick: onClose,
    title: "Đóng"
  })), children));
}

/* ---------- Badge ---------- */
function Badge({ color = COLORS.textDim, children }) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 9px",
      borderRadius: 999,
      fontSize: 11.5,
      fontWeight: 700,
      background: color + "22",
      color,
      border: `1px solid ${color}55`,
      whiteSpace: "nowrap"
    }
  }, children);
}

/* ---------- Field ---------- */
function Field({ label, children }) {
  return /*#__PURE__*/React.createElement("label", {
    style: { display: "block", marginBottom: 14 }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginBottom: 6 }
  }, label), children);
}

/* ---------- ProgressBar ---------- */
function ProgressBar({ pct, color }) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const barColor = color || (p >= 100 ? COLORS.green : p >= 60 ? COLORS.copper : COLORS.amber);
  return /*#__PURE__*/React.createElement("div", {
    style: { width: "100%", height: 6, background: COLORS.bgInset, borderRadius: 4, overflow: "hidden" }
  }, /*#__PURE__*/React.createElement("div", {
    style: { width: p + "%", height: "100%", background: barColor, borderRadius: 4, transition: "width .3s ease" }
  }));
}

/* ---------- SectionHeading ---------- */
function SectionHeading({ eyebrow, title, subtitle, action, icon: Icon, iconColor }) {
  const _iconColor = iconColor || COLORS.copper;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: 22,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, Icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      flexShrink: 0,
      borderRadius: 14,
      background: `${_iconColor}17`,
      border: `2px solid ${_iconColor}66`,
      boxShadow: `0 2px 8px ${_iconColor}22`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    size: 26,
    color: _iconColor
  })), /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      letterSpacing: ".05em",
      textTransform: "uppercase",
      color: COLORS.copper,
      marginBottom: 5
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: { fontSize: 40, fontWeight: 800, color: COLORS.text, letterSpacing: "-.02em", lineHeight: 1.1 }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 14, color: COLORS.textDim, marginTop: 6 }
  }, subtitle))), action && /*#__PURE__*/React.createElement("div", null, action));
}

/* ---------- EmptyState ---------- */
function EmptyState({ icon: Icon, title, hint, action }) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 20px",
      textAlign: "center",
      color: COLORS.textDim
    }
  }, Icon && /*#__PURE__*/React.createElement(Icon, { size: 30, style: { marginBottom: 12, opacity: .6 } }),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: hint || action ? 6 : 0 }
    }, title),
    hint && /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 12.5, maxWidth: 340, marginBottom: action ? 14 : 0 }
    }, hint),
    action);
}

