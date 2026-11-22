/* ---------- DialogProvider / useDialog (askConfirm / showAlert) ---------- */
const DialogContext = /*#__PURE__*/createContext(null);
function useDialog() {
  return useContext(DialogContext);
}
function DialogProvider({ children }) {
  const [state, setState] = useState(null); // { type:'confirm'|'alert', message, opts, resolve }

  const askConfirm = useCallback((message, opts = {}) => new Promise(resolve => {
    setState({ type: "confirm", message, opts, resolve });
  }), []);

  const showAlert = useCallback((message, opts = {}) => new Promise(resolve => {
    setState({ type: "alert", message, opts, resolve });
  }), []);

  const close = result => {
    setState(s => {
      if (s && s.resolve) s.resolve(result);
      return null;
    });
  };

  return /*#__PURE__*/React.createElement(DialogContext.Provider, {
    value: { askConfirm, showAlert }
  }, children, state && /*#__PURE__*/React.createElement(Modal, {
    title: state.opts.title || (state.type === "confirm" ? "Xác nhận" : "Thông báo"),
    onClose: () => close(state.type === "confirm" ? false : undefined),
    width: 420
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 13.5, color: COLORS.text, lineHeight: 1.6, marginBottom: 20, whiteSpace: "pre-wrap" }
  }, state.message), /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", gap: 10, justifyContent: "flex-end" }
  }, state.type === "confirm" && /*#__PURE__*/React.createElement(Button, {
    onClick: () => close(false)
  }, state.opts.cancelLabel || "Hủy"), /*#__PURE__*/React.createElement(Button, {
    variant: state.opts.danger ? "danger" : "primary",
    onClick: () => close(state.type === "confirm" ? true : undefined)
  }, state.type === "confirm" ? (state.opts.confirmLabel || "Xác nhận") : (state.opts.okLabel || "Đã hiểu")))));
}

function App() {
  return /*#__PURE__*/React.createElement(DialogProvider, null, /*#__PURE__*/React.createElement(AppInner, null));
}

