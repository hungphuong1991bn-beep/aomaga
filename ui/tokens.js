/* ===================== DESIGN TOKENS (v49 · ERP/MES Premium) =====================
   Nguồn duy nhất cho màu, chữ, khoảng cách, bo góc, đổ bóng của toàn ứng dụng.
   - Giữ nguyên tên khóa của COLORS để toàn bộ mã cũ vẫn chạy (kể cả chỗ ghép "màu + mã alpha" như COLORS.copper + "22",
     vì vậy mọi giá trị màu trong COLORS phải là mã hex 6 ký tự).
   - Đổi giao diện sáng/tối bằng cách ghi đè giá trị của COLORS rồi vẽ lại ứng dụng (amgApplyTheme).
   - Nhận diện: xanh navy là nền điều hướng, đỏ AOMAGA dành cho điểm nhấn chính và cảnh báo.
   - Cỡ chữ KHÔNG dùng CSS zoom: mọi cỡ chữ đi qua FZ(px) = calc(px * var(--amg-fs)); biến --amg-fs đổi theo độ phân giải
     màn hình (Full HD = 1, 2K, 4K/TV nhà máy lớn hơn) trong ui/globalstyle.js. */
const AMG_PALETTES = {
  light: {
    bg: "#F0F3F8", bgPanel: "#FFFFFF", bgPanel2: "#F3F5F9", bgInset: "#F7F9FC",
    border: "#E2E8F0", borderLight: "#CBD5E1",
    text: "#0F1F38", textDim: "#475569", textFaint: "#6B7A90",
    copper: "#D6111C", copperBright: "#E0262F", copperDark: "#A80D16",
    amber: "#B45309", orange: "#C2410C", green: "#15803D", greenDim: "#DCFCE7",
    red: "#B91C1C", redDim: "#FDECEC", blue: "#2563EB", violet: "#7C3AED",
    navy: "#0B2A4A",
    sidebarBg: "#0B2A4A", sidebarBg2: "#071A31", sidebarActiveText: "#0B2A4A"
  },
  dark: {
    bg: "#0A1424", bgPanel: "#111F36", bgPanel2: "#17294A", bgInset: "#0E1A2E",
    border: "#27395A", borderLight: "#35496E",
    text: "#E7EEF9", textDim: "#B0BED3", textFaint: "#8494AF",
    copper: "#F0505A", copperBright: "#FF6A72", copperDark: "#D6111C",
    amber: "#F2B04C", orange: "#FB923C", green: "#4FD08A", greenDim: "#10321F",
    red: "#FF7078", redDim: "#3E1519", blue: "#78AEF2", violet: "#B197FC",
    navy: "#0B2A4A",
    sidebarBg: "#071426", sidebarBg2: "#040B16", sidebarActiveText: "#0B2A4A"
  }
};
const COLORS = Object.assign({}, AMG_PALETTES.light);
let AMG_THEME = "light";
function amgSavedTheme() {
  try { const t = localStorage.getItem("amg_theme"); return t === "dark" ? "dark" : "light"; } catch (e) { return "light"; }
}
function amgSaveTheme(t) {
  try { localStorage.setItem("amg_theme", t); } catch (e) {}
}
// Ghi đè COLORS tại chỗ (các thành phần đọc COLORS lúc vẽ nên chỉ cần vẽ lại)
function amgApplyTheme(name) {
  const t = name === "dark" ? "dark" : "light";
  if (t === AMG_THEME) return t;
  AMG_THEME = t;
  Object.assign(COLORS, AMG_PALETTES[t]);
  try {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t;
    document.body.style.background = COLORS.bg;
    document.body.style.color = COLORS.text;
  } catch (e) {}
  return t;
}

/* ---------- Typography ---------- */
// Inter: dễ đọc tiếng Việt, có số tabular. Mã đơn/mã máy/số lượng dùng .mes-mono (IBM Plex Mono) hoặc .mes-num (Inter tabular).
const FONT_DISPLAY = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_BODY = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', Consolas, monospace";

// Thang cỡ chữ (px ở Full HD). Dùng qua FZ(): FZ(14) hoặc AMG_TYPE.md
const AMG_TYPE = { xs: 12, sm: 13, md: 14, lg: 16, xl: 18, x2: 22, x3: 28 };
const AMG_WEIGHT = { regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800 };
const AMG_LEADING = { tight: 1.2, snug: 1.35, normal: 1.5 };
const AMG_TRACKING = { tight: "-.015em", normal: "0", label: ".05em" };
// Cỡ chữ co giãn theo độ phân giải (không dùng zoom). Tối thiểu 12px ở mọi màn hình.
function FZ(px) { return "calc(" + px + "px * var(--amg-fs, 1))"; }

/* ---------- Khoảng cách, bo góc, đổ bóng ---------- */
const AMG_SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 };
const AMG_RADIUS = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };
const AMG_SHADOW = {
  sm: "0 1px 2px rgba(15,31,56,.05)",
  md: "0 1px 2px rgba(15,31,56,.04), 0 2px 8px rgba(15,31,56,.06)",
  lg: "0 8px 28px rgba(15,31,56,.16)"
};

/* ---------- Màu ngữ nghĩa ---------- */
// Trạng thái: dùng thống nhất ở mọi tab (đang chạy, chờ, tạm dừng, bảo trì, hỏng, hoàn thành...)
function amgTone(name) {
  const m = { ok: COLORS.green, run: COLORS.green, warn: COLORS.amber, wait: COLORS.amber, err: COLORS.red, bad: COLORS.red, info: COLORS.blue, done: COLORS.violet, maint: COLORS.violet, idle: COLORS.textFaint, none: COLORS.textFaint };
  return m[name] || COLORS.textFaint;
}
// Màu nút chính (chữ trắng đạt tương phản ở cả hai giao diện)
function amgBrand() { return AMG_THEME === "dark" ? "#D6111C" : "#C8101A"; }
function amgBrandHover() { return AMG_THEME === "dark" ? "#E5252F" : "#A80D16"; }
