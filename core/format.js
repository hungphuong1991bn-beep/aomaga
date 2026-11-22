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
