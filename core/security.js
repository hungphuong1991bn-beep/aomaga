/* ===================== BẢO MẬT & CẤU HÌNH (v45) ===================== */
// legacyLogin: cho phép đăng nhập dự phòng bằng băm SHA-256 khi Firebase Auth không phản hồi
// hoặc tài khoản chưa có trong Auth. Tắt (false) sau khi cả 11 tài khoản đã có trong Firebase Auth.
const AMG_CONFIG = {
  version: "47",
  legacyLogin: true,
  // Ca làm việc (giờ tạm, cần xác nhận với xưởng). Ứng dụng hiện chỉ có Ca Ngày / Ca Đêm.
  shifts: { ngay: { from: "06:00", to: "18:00" } }
};
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
