/* ---------- ErrorBoundary: chặn crash cục bộ, không để trắng cả app ---------- */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Lỗi khi hiển thị giao diện:", error, info);
  }
  render() {
    if (this.state.error) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14,
          padding: 24, textAlign: "center", background: "#EAEFF5", color: "#1A2130"
        }
      },
        /*#__PURE__*/React.createElement(AlertTriangle, { size: 40, color: COLORS.copperBright }),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 17, fontWeight: 700 } }, "Đã xảy ra lỗi hiển thị"),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 13, color: "#5B6472", maxWidth: 480 } },
          String((this.state.error && this.state.error.message) || this.state.error)),
        /*#__PURE__*/React.createElement("button", {
          onClick: () => window.location.reload(),
          style: {
            marginTop: 8, padding: "10px 20px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg,#C96A20,#E07B39)", color: "#1a1006",
            fontWeight: 700, cursor: "pointer", fontSize: 13.5
          }
        }, "Tải lại trang")
      );
    }
    return this.props.children;
  }
}

