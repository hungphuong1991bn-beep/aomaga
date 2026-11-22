/* ===================== PHÂN QUYỀN (v45) =====================
   Hai lớp, cùng một nguồn sự thật:
   1) amgCheckWrite  : quy tắc GHI DỮ LIỆU hiện hành (tương đương hành vi v44) — được cổng ghi (guard.js) áp dụng ở tầng dữ liệu.
   2) amgCan         : ma trận 8 chức vụ × 11 phân hệ × 6 hành động cho các phân hệ mới (Giai đoạn 4 trở đi).
   v46: 3 vai trò (Admin / Quản đốc / Nhân viên) suy trực tiếp từ trường role của tài khoản. */
const AMG_ROLES = {
  qt: "Admin",
  qd: "Quản đốc",
  nv: "Nhân viên"
};
// v=xem t=thêm s=sửa x=xóa c=xác nhận p=phê duyệt
const AMG_MODULES = ["tong", "don", "dieuhanh", "may", "kho", "qc", "nhansu", "dung", "baocao", "tailieu", "quantri"];
/* v46 — 3 vai trò:
   Admin    : toàn quyền, kể cả lập tài khoản và phân quyền (phân hệ "quantri").
   Quản đốc : toàn quyền sử dụng mọi phân hệ, TRỪ phân quyền và lập tài khoản.
   Nhân viên: XEM tất cả các tab; ĐIỀU KHIỂN Kế hoạch sản xuất (phân đơn vào máy, bắt đầu/tạm dừng/kết thúc lệnh)
              và NHẬP số liệu sản xuất. Không tạo/sửa/xóa đơn, không sửa nhân sự, không vào quản trị. */
const AMG_MATRIX = {
  qt: ["vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp"],
  qd: ["vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", "vtsxcp", ""],
  nv: ["vt", "v", "vtsc", "vts", "v", "v", "v", "v", "v", "v", ""]
};
// Giá trị role lưu trong tài khoản: "admin" | "manager" (Quản đốc) | "employee" (Nhân viên). Mọi giá trị cũ/lạ → Nhân viên (quyền thấp nhất).
const AMG_ROLE_LABEL_BY_VALUE = { admin: "Admin", manager: "Quản đốc", employee: "Nhân viên" };
function amgRoleOf(user) {
  if (!user) return null;
  if (user.role === "admin") return "qt";
  if (user.role === "manager") return "qd";
  return "nv";
}
// Admin hoặc Quản đốc: toàn quyền sử dụng (trừ tài khoản/phân quyền)
function amgIsPower(user) {
  return !!user && (user.role === "admin" || user.role === "manager");
}
// Chỉ Admin: lập tài khoản, phân quyền
function amgIsRoot(user) {
  return !!user && user.role === "admin";
}
// Quyền theo ma trận. action: v|t|s|x|c|p
function amgCan(user, action, moduleKey) {
  const r = amgRoleOf(user);
  const i = AMG_MODULES.indexOf(moduleKey);
  if (!r || i < 0) return false;
  return AMG_MATRIX[r][i].indexOf(action) > -1;
}
/* Quy tắc ghi dữ liệu hiện hành.
   op: "set" | "update" | "delete" | "add" ; trả về { ok, reason }.
   Giữ đúng hành vi v44: quản trị toàn quyền; nhân viên nhập số liệu như cũ,
   nhưng KHÔNG được xóa dữ liệu gốc, không sửa tài khoản, không sửa thư mục chứng nhận. */
function amgCheckWrite(user, col, op, docId, data) {
  if (!user) {
    // Chỉ cho phép khi chạy offline (gieo dữ liệu lần đầu trước khi đăng nhập)
    return window.__isOfflineDb ? { ok: true } : { ok: false, reason: "Chưa đăng nhập" };
  }
  // Tài khoản & phân quyền: chỉ Admin. Quản đốc dùng mọi dữ liệu khác như Admin.
  if (col === "users") return amgIsRoot(user) ? { ok: true } : { ok: false, reason: "Chỉ Admin được lập/sửa/xóa tài khoản và phân quyền" };
  if (amgIsPower(user)) return { ok: true };
  // Bộ dữ liệu mới: theo ma trận chức vụ × phân hệ
  const meta = typeof AMG_COLLECTIONS !== "undefined" ? AMG_COLLECTIONS[col] : null;
  if (meta) {
    const need = op === "delete" ? ["x"] : op === "add" ? ["t"] : op === "update" ? ["s"] : ["t", "s"];
    if (!need.some(a => amgCan(user, a, meta.mod))) return { ok: false, reason: `Chức vụ ${AMG_ROLES[amgRoleOf(user)]} không có quyền ${op === "delete" ? "xóa" : "ghi"} ${meta.label.toLowerCase()}` };
    // Bước phê duyệt: chỉ người có quyền "phê duyệt" mới chuyển sang trạng thái chốt
    const st = data && data.status;
    const approveNeeds = { ncr: ["dong", "qc"], documents: ["da_duyet", "tailieu"], lots: ["dat", "qc"], overtime: ["da_duyet", "nhansu"] };
    const an = approveNeeds[col];
    if (an && st === an[0] && !amgCan(user, "p", an[1])) return { ok: false, reason: "Bước này cần quyền phê duyệt" };
    return { ok: true };
  }
  switch (col) {
    case "users":
      return { ok: false, reason: "Chỉ quản trị viên được thay đổi tài khoản" };
    case "auditLog":
      return op === "set" || op === "add" ? { ok: true } : { ok: false, reason: "Chỉ quản trị viên được sửa/xóa lượt nhập" };
    case "certificates":
      if (docId === "_folders_meta" || op === "delete") return { ok: false, reason: "Chỉ quản trị viên được quản lý thư mục / xóa chứng nhận" };
      return { ok: true };
    case "orders":
    case "machines":
    case "staff":
    case "scrap":
      return op === "delete" ? { ok: false, reason: "Chỉ quản trị viên được xóa" } : { ok: true };
    default:
      return { ok: true };
  }
}
