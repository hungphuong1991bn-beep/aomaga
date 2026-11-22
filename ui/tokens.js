/* ===================== DESIGN TOKENS (v45) =====================
   Giữ nguyên tên khóa của COLORS để toàn bộ mã cũ vẫn chạy (kể cả chỗ ghép "màu + mã alpha").
   Đổi giao diện sáng/tối bằng cách ghi đè giá trị của COLORS rồi vẽ lại ứng dụng (amgApplyTheme).
   Nhận diện: xanh navy là nền điều hướng, đỏ AOMAGA dành cho điểm nhấn và cảnh báo. */
const AMG_PALETTES = {
  light: {
    bg: "#EAEFF5", bgPanel: "#FFFFFF", bgPanel2: "#F1F4F8", bgInset: "#F7F9FB",
    border: "#E2E8F0", borderLight: "#CBD5E1",
    text: "#10233D", textDim: "#52617A", textFaint: "#8794A8",
    copper: "#D6111C", copperBright: "#F0362E", copperDark: "#A80D16",
    amber: "#B45309", orange: "#EA580C", green: "#15803D", greenDim: "#DCFCE7",
    red: "#9F1239", redDim: "#FCE4EC", blue: "#2563EB", violet: "#7C3AED",
    navy: "#0B2A4A",
    sidebarBg: "#0B2A4A", sidebarBg2: "#071A31", sidebarActiveText: "#0B2A4A"
  },
  dark: {
    bg: "#0A1424", bgPanel: "#111F36", bgPanel2: "#17294A", bgInset: "#0E1A2E",
    border: "#27395A", borderLight: "#35496E",
    text: "#E7EEF9", textDim: "#A6B5CC", textFaint: "#7C8CA8",
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
const FONT_DISPLAY = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', Consolas, monospace";
