/* ===================== PHÂN QUYỀN & GIÁM SÁT (v45) — chỉ quản trị ===================== */
const AMG_MODULE_LABEL = { tong: "Tổng quan", don: "Đơn hàng & BOM", dieuhanh: "Điều hành SX", may: "Máy móc", kho: "Kho & nguyên liệu", qc: "QA/QC", nhansu: "Nhân sự", dung: "Dừng máy & bảo trì", baocao: "Báo cáo", tailieu: "Tài liệu", quantri: "Quản trị" };
const AMG_ACTION_LABEL = { v: "Xem", t: "Thêm", s: "Sửa", x: "Xóa", c: "Xác nhận", p: "Phê duyệt" };

function PermissionsPage({ users, auditLog }) {
  const roleKeys = Object.keys(AMG_ROLES);
  const rows = (users || []).map(u => ({ id: u.username || u.id, username: u.username || u.id, fullName: u.fullName || "", team: u.team || "", role: u.role, roleV2: amgRoleOf(u) }));
  const denied = (auditLog || []).filter(a => a.type === "permission_denied");
  const cell = { padding: "6px 8px", fontSize: 12, textAlign: "center", borderBottom: `1px solid ${COLORS.border}` };
  return rkh(PageFrame, {
    eyebrow: "Quản trị", title: "Phân quyền & giám sát", subtitle: "Ma trận quyền 3 vai trò × 11 phân hệ; quyền được kiểm tra ở tầng ghi dữ liệu", icon: ShieldCheck,
    guide: ["Chữ cái trong ô là các quyền được cấp (xem chú giải bên dưới).", "3 vai trò: Admin (toàn quyền, lập tài khoản & phân quyền) · Quản đốc (toàn quyền sử dụng, trừ tài khoản & phân quyền) · Nhân viên (xem tất cả; điều khiển Kế hoạch sản xuất và nhập số liệu). Đổi vai trò ở Quản trị hệ thống → Tài khoản.", "Mọi thao tác bị từ chối được ghi vào nhật ký với loại “permission_denied”."]
  },
    rkh("div", { className: "mes-card", style: { padding: 14, marginBottom: 16 } },
      rkh("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Ma trận quyền"),
      rkh("div", { className: "mes-scroll-x", style: { maxHeight: "none", overflowY: "visible" } }, rkh("table", { className: "mes-table" },
        rkh("thead", null, rkh("tr", null, rkh("th", null, "Phân hệ"), roleKeys.map(r => rkh("th", { key: r, style: { textAlign: "center" } }, AMG_ROLES[r])))),
        rkh("tbody", null, AMG_MODULES.map((m, i) => rkh("tr", { key: m }, rkh("td", { style: { fontWeight: 600 } }, AMG_MODULE_LABEL[m]),
          roleKeys.map(r => rkh("td", { key: r, style: cell, title: AMG_MATRIX[r][i].split("").map(a => AMG_ACTION_LABEL[a]).join(", ") || "Không có quyền" }, AMG_MATRIX[r][i].toUpperCase() || "—"))))))),
      rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint, marginTop: 8 } }, "Ký hiệu: V=Xem · T=Thêm · S=Sửa · X=Xóa · C=Xác nhận · P=Phê duyệt. Di chuột vào ô để xem diễn giải.")),
    rkh(RecordList, { title: "Tài khoản & chức vụ áp dụng", rows, searchKeys: ["username", "fullName", "team"], exportName: "tai-khoan-chuc-vu", emptyTitle: "Không có tài khoản",
      columns: [{ key: "username", label: "Tài khoản" }, { key: "fullName", label: "Họ tên" }, { key: "team", label: "Tổ" }, { key: "role", label: "Giá trị role" }, { key: "roleV2", label: "Chức vụ áp dụng", render: r => AMG_ROLES[r.roleV2], export: r => AMG_ROLES[r.roleV2] }] }),
    rkh(RecordList, { title: "Thao tác bị từ chối quyền", rows: denied.slice(0, 200), searchKeys: ["user", "detail"], exportName: "tu-choi-quyen", emptyTitle: "Chưa có thao tác nào bị từ chối",
      columns: [{ key: "ts", label: "Thời gian", render: r => amgFmtDateTime(r.ts && r.ts.toDate ? r.ts.toDate().toISOString() : r.ts), export: r => String(r.ts) }, { key: "user", label: "Người dùng" }, { key: "detail", label: "Chi tiết" }] }));
}
