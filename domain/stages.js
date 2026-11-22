function specDiameterMatches(spec, diameter) {
  if (diameter === undefined || diameter === null || diameter === "") return true; // không nhập đường kính -> không lọc theo tiêu chí này
  const specStr = String(spec || "").trim().toUpperCase();
  const m = specStr.match(/([\d.]+)\s*(BC|TC)?$/);
  if (!m) return false;
  const specDia = parseFloat(m[1]);
  const inputDia = parseFloat(diameter);
  if (isNaN(specDia) || isNaN(inputDia)) return false;
  return Math.abs(specDia - inputDia) < 0.0005;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// "Còn lại" của mỗi công đoạn luôn = Số lượng đặt hàng - Đã làm (đúng công thức báo cáo gốc).
// Không lưu độc lập nữa để tránh lệch số khi chỉ sửa "Đã làm".
// Gom nhóm theo Ngày / Tuần (bắt đầu Thứ 2) / Tháng — dùng cho biểu đồ sản lượng theo nguyên liệu
function getBucketKey(dateStr, granularity) {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  if (granularity === "day") return dateStr;
  if (granularity === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}
function getBucketLabel(key, granularity) {
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return `Tháng ${m}/${y}`;
  }
  if (granularity === "week") return `Tuần ${fmtDate(key)}`;
  return fmtDate(key);
}
function computeStageRemain(quantity, done) {
  if (typeof quantity !== "number") return null;
  return Math.round((quantity - (done || 0)) * 100) / 100;
}

// Đảm bảo "remain" lưu trong dữ liệu luôn khớp với Số lượng đặt - Đã làm,
// để mọi nơi đọc trực tiếp order.stages[key].remain (Tổng quan, biểu đồ...)
// đều nhận giá trị đúng, không chỉ riêng màn hình chi tiết đơn hàng.
function normalizeOrderStages(order) {
  const stages = {};
  STAGES.forEach(s => {
    const done = order.stages?.[s.key]?.done || 0;
    const computed = computeStageRemain(order.quantity, done);
    stages[s.key] = {
      done,
      remain: computed !== null ? computed : order.stages?.[s.key]?.remain || 0
    };
  });
  const result = {
    ...order,
    stages
  };
  // KHÔNG tự đặt wireFinish — người dùng hoặc handleKeoTrungEntry đặt tường minh
  const applicable = getApplicableStages(result);
  const lastStageKey = applicable[applicable.length - 1];
  if (lastStageKey) {
    const lastDone = stages[lastStageKey]?.done || 0;
    result.finishedDone = lastDone;
    result.finishedShort = typeof order.quantity === "number" ? Math.round((order.quantity - lastDone) * 100) / 100 : order.finishedShort || 0;
  }
  return result;
}

// Quy trình công đoạn phụ thuộc loại dây, suy ra từ "quy cách" (spec):
//  1) Dây ủ mềm ghi nhận trực tiếp tại Kéo trung + có tên khách hàng
//     (wireFinish="mềm", đặt bởi handleKeoTrungEntry/handleQuickEntry)
//     -> [Kéo trung] — thành phẩm ngay tại đây, KHÔNG đi tiếp công đoạn nào khác.
//  2) Phôi Kéo trung không gắn khách hàng cụ thể -> nguyên liệu chung cho công đoạn sau,
//     không tự gắn vào BOM của đơn nào (xử lý ở handleKeoTrungEntry, không liên quan hàm này).
//  3) Quy cách dạng số đơn, không hậu tố BC/TC, không phải dây bện (vd "0.2")
//     -> Kéo tinh, Kéo siêu tinh, Ủ nhiệt — thành phẩm tại Ủ nhiệt.
//  4) Dây bện loại BC (vd "7/0.2BC") -> Kéo tinh, Kéo siêu tinh, Ủ nhiệt, Bện — thành phẩm tại Bện.
//  5) Dây bện loại TC (vd "7/0.2TC") -> Kéo tinh, Kéo siêu tinh, Mạ thiếc, Bện — thành phẩm tại Bện.
// Kéo trung là công đoạn NỘI BỘ cung cấp phôi — chỉ xuất hiện trong BOM của đơn hàng
// khi đơn đó được ghi nhận thành phẩm trực tiếp tại Kéo trung (mục 1).
function getApplicableStages(order) {
  // v46: đơn tạo ở tab Đơn hàng mới có quy trình do người tạo đơn chọn và xác nhận (order.routing).
  // Khi có, đây là NGUỒN DUY NHẤT của danh sách công đoạn (giữ đúng thứ tự đã xác nhận);
  // công đoạn cuối của quy trình vẫn là công đoạn tính "Đã sản xuất" (normalizeOrderStages/orderProgress).
  // Đơn cũ không có order.routing → giữ nguyên quy tắc suy luận theo quy cách bên dưới.
  if (Array.isArray(order.routing) && order.routing.length > 0) {
    const seen = new Set();
    const keys = order.routing.filter(k => typeof k === "string" && STAGE_MAP[k] && !seen.has(k) && seen.add(k));
    if (keys.length > 0) return keys;
  }
  // Mục 1: Dây ủ mềm ghi nhận trực tiếp tại Kéo trung (có tên khách hàng) → dừng tại đây.
  // wireFinish="mềm" chỉ được đặt tường minh bởi handleKeoTrungEntry (khi chọn khách hàng)
  // hoặc handleQuickEntry (khi chọn "Dây ủ mềm" ngay tại Kéo trung) — không tự suy luận từ spec.
  if (order.wireFinish === "mềm") return ["keo_trung"];

  const specStr = order.spec !== undefined && order.spec !== null ? String(order.spec).trim().toUpperCase() : "";
  const isStranded = specStr.includes("/");
  const isTC = /\dTC\b/.test(specStr) || /TC$/.test(specStr);

  // Mục 3/4/5: mọi đơn còn lại (quy cách số đơn, BC, hoặc TC) đều bắt đầu từ Kéo tinh,
  // luôn qua Kéo siêu tinh, rồi Ủ nhiệt (BC/số đơn) hoặc Mạ thiếc (TC), cộng Bện nếu là dây bện.
  const keys = ["keo_tinh", "keo_sieu_tinh"];
  keys.push(isTC ? "ma_thiec" : "u_nhiet");
  if (isStranded) keys.push("ben");
  // Giữ lại công đoạn nào đã có số liệu thực tế (phòng trường hợp dữ liệu cũ lệch quy tắc)
  STAGES.forEach(s => {
    const done = order.stages?.[s.key]?.done || 0;
    if (done > 0 && !keys.includes(s.key) && s.key !== "keo_trung") keys.push(s.key);
  });
  return STAGES.filter(s => keys.includes(s.key)).map(s => s.key);
}

// Tiến độ đơn hàng: lấy giá trị "đã hoàn thành" lớn nhất giữa các công đoạn và thành phẩm
function orderProgress(order) {
  const qty = typeof order.quantity === "number" ? order.quantity : null;
  // % Tiến độ = Thành phẩm / Số lượng đặt hàng
  // "Thành phẩm" (finishedDone) luôn được đồng bộ bằng sản lượng của công đoạn CUỐI CÙNG
  // trong quy trình của đơn (normalizeOrderStages): Kéo trung cho dây ủ mềm, Bện cho dây
  // bện, Ủ nhiệt/Mạ thiếc cho dây 1 sợi — chính xác hơn lấy max giữa các công đoạn.
  const completedQty = order.finishedDone || 0;
  const applicable = getApplicableStages(order);
  const lastStageKey = applicable[applicable.length - 1];
  const lastStageDone = order.stages?.[lastStageKey]?.done || 0;
  const anyStageStarted = STAGES.some(s => (order.stages?.[s.key]?.done || 0) > 0);
  const furthestStageIdx = applicable.length > 0 ? STAGES.findIndex(s => s.key === lastStageKey) : -1;
  const pct = qty && qty > 0 ? clamp(completedQty / qty * 100, 0, 999) : null;
  const remainingQty = qty !== null ? Math.round((qty - completedQty) * 100) / 100 : null;
  let statusLabel = "Đang sản xuất";
  let statusColor = COLORS.amber;
  if (qty && completedQty >= qty && qty > 0) {
    statusLabel = "Hoàn thành";
    statusColor = COLORS.green;
  } else if (!anyStageStarted && completedQty === 0) {
    statusLabel = "Chưa bắt đầu";
    statusColor = COLORS.textFaint;
  }
  return {
    completedQty,
    pct,
    remainingQty,
    statusLabel,
    statusColor,
    furthestStageIdx,
    lastStageKey,
    lastStageDone
  };
}

/* ===================== STORAGE LAYER ===================== */

