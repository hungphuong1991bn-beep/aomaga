/* ===================== TÀI KHOẢN & VAI TRÒ (v46) =====================
   3 vai trò: Admin ("admin") · Quản đốc ("manager") · Nhân viên ("employee").
   Chỉ Admin được lập tài khoản / đổi vai trò / gỡ tài khoản (cổng ghi chặn ở tầng dữ liệu: amgCheckWrite).
   Mật khẩu KHÔNG còn lưu dạng chữ trong dữ liệu:
   - Chạy với Firebase: tạo tài khoản thật trong Firebase Authentication (qua ứng dụng phụ để Admin không bị đăng xuất),
     hồ sơ phân quyền lưu ở users/{uid}. Đăng nhập chỉ được chấp nhận khi có hồ sơ (gỡ hồ sơ = gỡ quyền truy cập).
   - Chạy offline/cục bộ: lưu băm SHA-256 (pwHash) trong hồ sơ. */

const AMG_AUTH_DOMAIN = "@xuongdong.com";
// 10 tài khoản tổ cũ từng dùng để đăng nhập ở máy xưởng (admin giữ nguyên)
const AMG_LEGACY_TEAM_ACCOUNTS = ["to.keo", "to.unhiet", "to.mathiec", "to.ben", "to.boc", "to.sanglo", "to.qc", "to.kho", "to.qdoc", "to.codien"];
const AMG_ROLE_VALUES = ["admin", "manager", "employee"];

function amgRoleValueLabel(role) {
  return AMG_ROLE_LABEL_BY_VALUE[role] || AMG_ROLE_LABEL_BY_VALUE.employee;
}
function amgAccountRequireRoot() {
  if (!amgIsRoot(window.__AMG_USER)) throw new Error("Chỉ Admin được lập tài khoản và phân quyền.");
}
function amgValidateAccount(p, isNew) {
  const username = String(p.username || "").trim().toLowerCase();
  if (isNew) {
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("Tên đăng nhập 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.");
    if (String(p.password || "").length < 6) throw new Error("Mật khẩu tối thiểu 6 ký tự.");
  }
  if (AMG_ROLE_VALUES.indexOf(p.role) < 0) throw new Error("Vai trò không hợp lệ.");
  return username;
}
async function amgCreateAccount(p, existingUsers) {
  amgAccountRequireRoot();
  const username = amgValidateAccount(p, true);
  if ((existingUsers || []).some(u => String(u.username || "").toLowerCase() === username)) throw new Error("Tên đăng nhập đã tồn tại.");
  const profile = { username, fullName: String(p.fullName || "").trim() || username, role: p.role, team: p.role === "employee" ? (p.team || "") : "", createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: (window.__AMG_USER && window.__AMG_USER.username) || "" };
  let id;
  if (window.__isOfflineDb || !window.__auth) {
    id = "USR-" + amgNewKey("U");
    profile.pwHash = await sha256Hex("amg:" + username + ":" + p.password);
  } else {
    // Ứng dụng Firebase phụ: tạo người dùng mà không làm Admin bị đăng xuất khỏi phiên hiện tại
    let sec = (firebase.apps || []).find(a => a.name === "amg-secondary");
    if (!sec) sec = firebase.initializeApp(firebase.app().options, "amg-secondary");
    try {
      const cred = await sec.auth().createUserWithEmailAndPassword(username + AMG_AUTH_DOMAIN, p.password);
      id = cred.user.uid;
    } catch (e) {
      const code = e && e.code;
      if (code === "auth/email-already-in-use") throw new Error("Tên đăng nhập này đã có trong Firebase Authentication (ví dụ tài khoản tổ cũ). Hãy chọn tên khác, hoặc xóa người dùng đó trong Firebase Console.");
      if (code === "auth/weak-password") throw new Error("Mật khẩu quá yếu (tối thiểu 6 ký tự).");
      throw new Error("Không tạo được tài khoản đăng nhập: " + (e.message || code));
    } finally { try { await sec.auth().signOut(); } catch (e) {} }
  }
  profile.uid = id;
  await db.collection(FS.users).doc(id).set(profile);
  return { id, username };
}
// Sửa họ tên / vai trò / tổ / khóa. Không đổi tên đăng nhập, không đổi mật khẩu người khác khi chạy Firebase.
async function amgUpdateAccount(p, existingUsers) {
  amgAccountRequireRoot();
  amgValidateAccount(p, false);
  const me = window.__AMG_USER;
  const ex = (existingUsers || []).find(u => u.username === p.username);
  if (!ex) throw new Error("Không tìm thấy tài khoản.");
  const admins = (existingUsers || []).filter(u => u.role === "admin" && !u.disabled);
  if (ex.role === "admin" && p.role !== "admin" && admins.length <= 1) throw new Error("Phải còn ít nhất một Admin đang hoạt động.");
  if (ex.username === me.username && p.role !== ex.role) throw new Error("Không tự đổi vai trò của chính mình (tránh mất quyền quản trị).");
  if (ex.username === me.username && p.disabled) throw new Error("Không tự khóa tài khoản đang đăng nhập.");
  if (ex.role === "admin" && p.disabled && admins.length <= 1) throw new Error("Phải còn ít nhất một Admin đang hoạt động.");
  const patch = { fullName: String(p.fullName || "").trim() || ex.username, role: p.role, team: p.role === "employee" ? (p.team || "") : "", disabled: !!p.disabled, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (p.password) {
    if (!(window.__isOfflineDb || !window.__auth)) throw new Error("Đổi mật khẩu người khác cần làm trong Firebase Console (hoặc tạo tài khoản mới). Ứng dụng không giữ mật khẩu.");
    if (String(p.password).length < 6) throw new Error("Mật khẩu tối thiểu 6 ký tự.");
    patch.pwHash = await sha256Hex("amg:" + ex.username + ":" + p.password);
  }
  await db.collection(FS.users).doc(ex.uid || ex.id).set(patch, { merge: true });
}
async function amgDeleteAccount(username, existingUsers) {
  amgAccountRequireRoot();
  const me = window.__AMG_USER;
  const ex = (existingUsers || []).find(u => u.username === username);
  if (!ex) return;
  if (ex.username === me.username) throw new Error("Không thể xóa tài khoản đang đăng nhập.");
  if (ex.role === "admin" && (existingUsers || []).filter(u => u.role === "admin").length <= 1) throw new Error("Phải còn ít nhất một Admin.");
  await db.collection(FS.users).doc(ex.uid || ex.id).delete();
}
function amgLegacyAccountsIn(users) {
  return (users || []).filter(u => u.role !== "admin" && AMG_LEGACY_TEAM_ACCOUNTS.indexOf(String(u.username || "").toLowerCase()) > -1);
}
// Gỡ tài khoản tổ cũ: xóa hồ sơ phân quyền → các tài khoản này không còn vào được hệ thống.
async function amgRemoveLegacyAccounts(users) {
  amgAccountRequireRoot();
  const targets = amgLegacyAccountsIn(users);
  for (const u of targets) {
    const ids = [...new Set([u.uid, u.id, u.username].filter(Boolean))];
    for (const id of ids) { try { await db.collection(FS.users).doc(id).delete(); } catch (e) {} }
  }
  return targets.map(u => u.username);
}

function LegacyAccountsPanel({ users, onRemoved }) {
  const { askConfirm, showAlert } = useDialog();
  const [busy, setBusy] = useState(false);
  const legacy = amgLegacyAccountsIn(users);
  if (legacy.length === 0) return rkh("div", { className: "mes-card", style: { padding: 14, marginBottom: 18, fontSize: 13, color: COLORS.green, fontWeight: 600 } }, "✓ Không còn tài khoản tổ cũ dùng chung ở máy xưởng. Mỗi người dùng đăng nhập bằng tài khoản riêng.");
  async function run() {
    if (busy) return;
    if (!(await askConfirm(`Gỡ ${legacy.length} tài khoản tổ cũ (${legacy.map(u => u.username).join(", ")})?\n\nHệ thống sẽ tự tải bản sao lưu dữ liệu trước. Sau khi gỡ, các tài khoản này không đăng nhập được nữa. Tài khoản Admin không bị ảnh hưởng. Hãy lập tài khoản Quản đốc/Nhân viên riêng trước khi gỡ.`, { danger: true, confirmLabel: "Sao lưu rồi gỡ" }))) return;
    setBusy(true);
    try {
      if (typeof amgDownloadBackup === "function") await amgDownloadBackup();
      const done = await amgRemoveLegacyAccounts(users);
      onRemoved && onRemoved(done);
      await showAlert(`Đã gỡ ${done.length} tài khoản tổ cũ.`, { title: "Hoàn tất" });
    } catch (e) { await showAlert(e.message || String(e), { title: "Không gỡ được" }); }
    setBusy(false);
  }
  return rkh("div", { className: "mes-card", style: { padding: 14, marginBottom: 18, border: `1.5px solid ${COLORS.amber}`, borderLeft: `6px solid ${COLORS.amber}` } },
    rkh("div", { style: { fontWeight: 800, marginBottom: 6 } }, `Tài khoản tổ cũ đăng nhập chung ở máy xưởng (${legacy.length})`),
    rkh("div", { style: { fontSize: 12.5, color: COLORS.textDim, marginBottom: 10 } }, "Các tài khoản dùng chung theo tổ không cho biết ai đã thao tác. Hệ phân quyền mới dùng tài khoản riêng với 3 vai trò (Admin, Quản đốc, Nhân viên)."),
    rkh("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 } }, legacy.map(u => rkh(Badge, { key: u.username, color: COLORS.amber }, `${u.username} · ${u.fullName || ""}`))),
    rkh(Button, { variant: "danger", disabled: busy, onClick: run }, busy ? "Đang xử lý..." : "Sao lưu rồi gỡ các tài khoản tổ cũ"));
}
