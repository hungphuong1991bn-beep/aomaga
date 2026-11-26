/* ===================== UTILITIES ===================== */
// Lưu ý: đây là hệ thống demo nội bộ — tài khoản/mật khẩu lưu dạng văn bản thường
// trong bộ nhớ dùng chung, KHÔNG dùng cơ chế mã hoá. Không phù hợp triển khai thật
// cho dữ liệu nhạy cảm mà chưa có lớp bảo mật/server riêng.

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("vi-VN", {
    maximumFractionDigits: 1
  });
}
function _toJsDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === "function") return val.toDate(); // Firestore Timestamp
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000); // Timestamp dạng {seconds,nanoseconds}
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = _toJsDate(iso);
  if (!d) return typeof iso === "string" ? iso : "—";
  return d.toLocaleDateString("vi-VN");
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = _toJsDate(iso);
  if (!d) return typeof iso === "string" ? iso : "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
function fmtTime(ts) {
  const d = _toJsDate(ts);
  if (!d) return null;
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}
// So khớp đường kính dây (vd "0.53") với quy cách đơn hàng (vd "0.53BC", "7/0.53BC", "0.53")
// — dùng để phân biệt các đơn cùng khách hàng/mã liệu nhưng khác đường kính.

/* ---------- v54: BỎ MÃ ĐƠN ----------
   Giao diện không còn hiện mã đơn (id nội bộ tự sinh). Đơn được gọi bằng "Khách hàng · Quy cách".
   Id vẫn dùng bên trong để liên kết lệnh máy / sản lượng. Hàm tra tên theo id cho các chỗ chỉ có orderId (lệnh, phiếu...). */
var AMG_ORDER_INDEX = {};
function amgIndexOrders(list) {
  var m = {};
  (list || []).forEach(function (o) { if (o && o.id) m[o.id] = o; });
  AMG_ORDER_INDEX = m;
}
function amgOrderLabel(o) {
  var ord = o && typeof o === "object" ? o : AMG_ORDER_INDEX[o];
  if (!ord) return o ? "Đơn đã xóa" : "—";
  var parts = [ord.customer, ord.spec].map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean);
  return parts.length ? parts.join(" · ") : "Đơn chưa đặt tên";
}
function amgOrderLabelById(id) { return id ? amgOrderLabel(AMG_ORDER_INDEX[id] || id) : "—"; }
