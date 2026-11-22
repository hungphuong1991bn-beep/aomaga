/* ===================== BIỂU MẪU TÀI KHOẢN (v46) — 3 vai trò ===================== */
const AMG_ROLE_HELP = {
  admin: "Toàn quyền điều khiển hệ thống, lập tài khoản và phân quyền.",
  manager: "Toàn quyền sử dụng tất cả chức năng, trừ phân quyền và lập tài khoản.",
  employee: "Xem tất cả các tab; điều khiển Kế hoạch sản xuất (phân đơn vào máy, chạy lệnh) và nhập số liệu sản xuất."
};
function UserFormModal({ initial, onClose, onSave, isNew }) {
  const [form, setForm] = useState(Object.assign({ role: "employee", team: "", disabled: false }, initial, { password: "" }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const localMode = !!(window.__isOfflineDb || !window.__auth);
  const set = (k, v) => setForm(f => Object.assign({}, f, { [k]: v }));
  async function submit() {
    if (busy) return;
    setErr("");
    if (!String(form.username || "").trim()) { setErr("Vui lòng nhập tên đăng nhập."); return; }
    if (isNew && String(form.password || "").length < 6) { setErr("Mật khẩu tối thiểu 6 ký tự."); return; }
    setBusy(true);
    try {
      const payload = { username: String(form.username).trim().toLowerCase(), fullName: String(form.fullName || "").trim(), role: form.role, team: form.role === "employee" ? (form.team || "") : "", disabled: !!form.disabled };
      if (form.password) payload.password = form.password;
      await onSave(payload, isNew);
      onClose();
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  }
  const field = (label, child, hint) => rkh("div", { style: { marginBottom: 12 } }, rkh("div", { style: { fontSize: 12, fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, label), child, hint && rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint, marginTop: 4 } }, hint));
  return rkh(Modal, { title: isNew ? "Tạo tài khoản mới" : `Chỉnh sửa tài khoản: ${initial.username}`, onClose, width: 480 },
    field("Tên đăng nhập", rkh("input", { className: "mes-input", style: { width: "100%" }, disabled: !isNew, value: form.username, onChange: e => set("username", e.target.value.replace(/\s+/g, ".")), placeholder: "ví dụ: nguyen.van.a (chữ không dấu, không khoảng trắng)" })),
    field("Họ và tên hiển thị", rkh("input", { className: "mes-input", style: { width: "100%" }, value: form.fullName || "", onChange: e => set("fullName", e.target.value) })),
    field("Vai trò", rkh("select", { className: "mes-input", style: { width: "100%" }, value: form.role, onChange: e => set("role", e.target.value) }, AMG_ROLE_VALUES.map(r => rkh("option", { key: r, value: r }, amgRoleValueLabel(r)))), AMG_ROLE_HELP[form.role]),
    form.role === "employee" && field("Tổ (không bắt buộc)", rkh("select", { className: "mes-input", style: { width: "100%" }, value: form.team || "", onChange: e => set("team", e.target.value) }, rkh("option", { value: "" }, "— Không chọn —"), TEAMS.map(t => rkh("option", { key: t, value: t }, t)))),
    (isNew || localMode) && field(isNew ? "Mật khẩu (tối thiểu 6 ký tự)" : "Đặt lại mật khẩu (để trống nếu không đổi)", rkh("input", { className: "mes-input", style: { width: "100%" }, type: "password", autoComplete: "new-password", value: form.password, onChange: e => set("password", e.target.value) }), isNew && !localMode ? "Mật khẩu được gửi thẳng tới Firebase Authentication, ứng dụng không lưu lại." : ""),
    !isNew && !localMode && rkh("div", { style: { fontSize: 12, color: COLORS.textFaint, marginBottom: 12 } }, "Đổi mật khẩu người khác: thực hiện trong Firebase Console (ứng dụng không giữ mật khẩu)."),
    !isNew && rkh("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" } }, rkh("input", { type: "checkbox", checked: !!form.disabled, onChange: e => set("disabled", e.target.checked), style: { width: 17, height: 17 } }), "Khóa tài khoản (không cho đăng nhập)"),
    err && rkh("div", { style: { color: COLORS.red, fontSize: 12.5, marginBottom: 10, whiteSpace: "pre-wrap" } }, err),
    rkh(Button, { variant: "primary", disabled: busy, onClick: submit, style: { width: "100%", justifyContent: "center" } }, rkh(Save, { size: 14 }), busy ? " Đang lưu..." : " Lưu tài khoản"));
}
