/* Thẻ sao lưu trong trang Quản trị (v45) */
function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true); setMsg("");
    try {
      const m = await amgDownloadBackup();
      const total = Object.values(m.counts).reduce((a, b) => a + b, 0);
      setMsg(`Đã xuất ${total} bản ghi (${Object.entries(m.counts).map(([k, v]) => k + ": " + v).join(", ")}).`);
    } catch (e) {
      setMsg("Không xuất được: " + (e && e.message ? e.message : e));
    } finally { setBusy(false); }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: { padding: 16, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }
  }, /*#__PURE__*/React.createElement("div", { style: { fontSize: FZ(13), color: COLORS.textDim, maxWidth: 560 } },
    /*#__PURE__*/React.createElement("b", { style: { color: COLORS.text } }, "Sao lưu dữ liệu. "),
    "Tải về một tệp JSON chứa toàn bộ đơn hàng, máy móc, nhân sự, phế liệu, chấm công, nhật ký, chứng nhận và tài khoản (không kèm mật khẩu). Nên làm trước mỗi lần nâng cấp.",
    msg ? /*#__PURE__*/React.createElement("div", { style: { marginTop: 6, color: COLORS.green } }, msg) : null),
  /*#__PURE__*/React.createElement(Button, { onClick: run, disabled: busy }, /*#__PURE__*/React.createElement(Download, { size: 14 }), busy ? " Đang xuất..." : " Tải tệp sao lưu"));
}
