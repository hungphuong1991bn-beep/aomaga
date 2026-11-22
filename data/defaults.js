/* ===================== FIREBASE RTDB URL (đồng bộ đa thiết bị qua REST, tuỳ chọn) ===================== */
// Lưu ý: đây là cơ chế đồng bộ REST đơn giản (Realtime Database), tách biệt với
// lớp Firestore (db) dùng cho toàn bộ CRUD của app — chỉ dùng để AdminPage lưu lại
// URL RTDB người dùng nhập vào Cài đặt đồng bộ.
const FIREBASE_URL_KEY = "mes_firebase_rtdb_url";
function getFirebaseUrl() {
  try {
    return localStorage.getItem(FIREBASE_URL_KEY) || "";
  } catch (e) {
    return "";
  }
}
function setFirebaseUrl(url) {
  try {
    if (url) localStorage.setItem(FIREBASE_URL_KEY, url);
    else localStorage.removeItem(FIREBASE_URL_KEY);
  } catch (e) {
    console.warn("Không thể lưu Firebase URL:", e.message);
  }
}

function genMachineSeed() {
  const list = [];
  MACHINE_TYPES.forEach(type => {
    for (let i = 1; i <= type.count; i++) {
      const idx = list.length;
      // v45: không suy đoán trạng thái máy — chờ người vận hành xác nhận thực tế
      const status = "unknown";
      list.push({
        id: `${type.prefix}-${String(i).padStart(2, "0")}`,
        typeKey: type.key,
        typeLabel: type.label,
        stage: type.stage,
        status,
        note: "",
        updatedAt: new Date().toISOString(),
        updatedBy: "system"
      });
    }
  });
  return list;
}
const DEFAULT_USERS = [{
  username: "admin",
  pwHash: "f44a18d10db7435ba1eadd50db518f6c2ed07d96495509f2194fa6710de879e9",
  role: "admin",
  fullName: "Quản trị viên",
  team: ""
}]; // v46: chỉ giữ tài khoản Admin khởi tạo. Các tài khoản tổ dùng chung đã bị loại bỏ; tài khoản mới do Admin lập (Quản trị hệ thống).

