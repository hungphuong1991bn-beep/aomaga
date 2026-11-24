/* ===================== DOMAIN CONSTANTS ===================== */
// Thứ tự công đoạn sản xuất dây/cáp đồng, đúng theo báo cáo sản lượng gốc
/* Ảnh thực tế máy móc từng công đoạn sản xuất (do người dùng cung cấp) */
const STAGES = [{
  key: "keo_trung",
  label: "Kéo trung",
  short: "KT",
  icon: "drawing",
  emoji: "🧵",
  photo: STAGE_PHOTO_KEO_TRUNG,
  color: "#C2652F"
}, {
  key: "keo_tinh",
  label: "Kéo tinh",
  short: "KTI",
  icon: "drawing",
  emoji: "🧵",
  photo: STAGE_PHOTO_KEO_TINH,
  color: "#2563EB"
}, {
  key: "keo_sieu_tinh",
  label: "Kéo siêu tinh",
  short: "KST",
  icon: "drawing",
  emoji: "🧵",
  photo: STAGE_PHOTO_KEO_TINH,
  color: "#0D9488"
}, {
  key: "u_nhiet",
  label: "Ủ nhiệt",
  short: "ỦN",
  icon: "heat",
  emoji: "🔥",
  photo: STAGE_PHOTO_U_NHIET,
  color: "#EA580C"
}, {
  key: "ma_thiec",
  label: "Mạ thiếc",
  short: "MT",
  icon: "plate",
  emoji: "⚗️",
  photo: STAGE_PHOTO_MA_THIEC,
  color: "#7C3AED"
}, {
  key: "ben",
  label: "Bện",
  short: "BN",
  icon: "twist",
  emoji: "🪢",
  photo: STAGE_PHOTO_BEN,
  color: "#DB2777"
}];
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));
// Icon SVG riêng cho từng loại công đoạn (thay thế emoji 🧵🔥⚗️🪢)
const StageIconDrawing = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 7
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M7.5 9.3c1.2-1.7 7.8-1.7 9 0M7.5 12c1.2-1.7 7.8-1.7 9 0M7.5 14.7c1.2-1.7 7.8-1.7 9 0"
  })]);
const StageIconHeat = _svg(() => [/*#__PURE__*/React.createElement("path", {
  key: 1,
  d: "M12 2.5c-1 4-6 6.3-6 11a6 6 0 0 0 12 0c0-2.2-1-3.3-2-4.3c0 2-1 3-2 3c1-3.3-1-5.3-2-9.7Z"
})]);
const StageIconPlate = _svg(() => [/*#__PURE__*/React.createElement("path", {
  key: 1,
  d: "M12 3s6 7.2 6 11.2a6 6 0 0 1-12 0C6 10.2 12 3 12 3Z"
})]);
const StageIconTwist = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M5.5 4c3 3 3 5 0 8s-3 5 0 8"
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M18.5 4c-3 3-3 5 0 8s3 5 0 8"
  })]);
const STAGE_ICON_MAP = {
  drawing: StageIconDrawing,
  heat: StageIconHeat,
  plate: StageIconPlate,
  twist: StageIconTwist
};

// Danh mục máy móc thiết bị theo từng công đoạn (do người dùng cung cấp)
const MACHINE_TYPES = [{
  key: "keo_trung",
  label: "Máy kéo trung",
  prefix: "KT",
  count: 4,
  stage: "keo_trung",
  color: "#C2652F"
}, {
  key: "keo_tinh",
  label: "Máy kéo tinh",
  prefix: "KTI",
  count: 64,
  stage: "keo_tinh",
  color: "#2563EB"
}, {
  key: "keo_sieu_tinh",
  label: "Máy kéo siêu tinh",
  prefix: "KST",
  count: 19,
  stage: "keo_sieu_tinh",
  color: "#0D9488"
}, {
  key: "ma_thiec",
  label: "Máy mạ thiếc",
  prefix: "MT",
  count: 5,
  stage: "ma_thiec",
  color: "#7C3AED"
}, {
  key: "u_nhiet",
  label: "Máy ủ nhiệt",
  prefix: "UN",
  count: 4,
  stage: "u_nhiet",
  color: "#EA580C"
}, {
  key: "ben_500",
  label: "Máy bện 500",
  prefix: "B500",
  count: 10,
  stage: "ben",
  color: "#DB2777"
}, {
  key: "ben_630",
  label: "Máy bện 630",
  prefix: "B630",
  count: 2,
  stage: "ben",
  color: "#0EA5E9"
}, {
  key: "ben_400",
  label: "Máy bện 400",
  prefix: "B400",
  count: 33,
  stage: "ben",
  color: "#16A34A"
}, {
  key: "ben_300",
  label: "Máy bện 300",
  prefix: "B300",
  count: 15,
  stage: "ben",
  color: "#CA8A04"
}, {
  key: "sang_lo",
  label: "Máy sang lô",
  prefix: "SL",
  count: 4,
  stage: null,
  color: "#64748B"
}];
const MACHINE_STATUS = {
  running: {
    label: "Đang chạy",
    color: COLORS.green
  },
  idle: {
    label: "Tạm nghỉ",
    color: COLORS.amber
  },
  maintenance: {
    label: "Bảo trì",
    color: COLORS.blue
  },
  broken: {
    label: "Hỏng/Dừng",
    color: COLORS.red
  },
  unknown: {
    label: "Chưa xác định",
    color: COLORS.textFaint
  }
};
const TEAMS = ["KÉO", "Ủ NHIỆT", "MẠ THIẾC", "BỆN", "BỌC", "SANG LÔ", "QC", "KHO", "QĐỐC", "CƠ ĐIỆN"];

// Tổ sản xuất -> công đoạn mặc định khi nhân viên báo sản lượng
const TEAM_STAGE_OPTIONS = {
  "KÉO": ["keo_tinh", "keo_sieu_tinh"],
  "Ủ NHIỆT": ["u_nhiet"],
  "MẠ THIẾC": ["ma_thiec"],
  "BỆN": ["ben"]
};
// Dùng cho trang Báo cáo & Biểu đồ: tổ KÉO quản lý cả 3 khâu kéo (trung/tinh/siêu tinh)
const TEAM_REPORT_STAGES = {
  "KÉO": ["keo_trung", "keo_tinh", "keo_sieu_tinh"],
  "Ủ NHIỆT": ["u_nhiet"],
  "MẠ THIẾC": ["ma_thiec"],
  "BỆN": ["ben"]
};
// Danh sách lỗi chung của xưởng — theo bảng phân loại lỗi chuẩn (chọn nhanh thay vì gõ tay)
const SCRAP_REASONS = [{
  name: "Đen dây",
  cause: "Lỗi máy hết nước, mất điện / Đồng dính dầu, mồ hôi, dị vật",
  source: "Lỗi máy · Lỗi con người"
}, {
  name: "Đứt dây",
  cause: "Lỗi nguyên vật liệu / Cài đặt sai điều kiện (tốc độ cao, nhiệt,...)",
  source: "Lỗi vật liệu · Lỗi con người"
}, {
  name: "Lỗi nguyên liệu",
  cause: "Lỗi vật liệu nhà cung cấp (Đông Phương, KCT) - Đứt, rối, đen,...",
  source: "Lỗi nguyên vật liệu"
}, {
  name: "Oxy hóa",
  cause: "Đồng bị oxy hóa do bảo quản",
  source: "Lỗi con người · Lỗi máy"
}, {
  name: "Rối dây",
  cause: "Do máy hoặc do thao tác người",
  source: "Lỗi máy · Lỗi con người"
}, {
  name: "Sót lô",
  cause: "Dây đồng sát bobbin cần cắt bỏ",
  source: "Lỗi do quy trình"
}, {
  name: "Thay đổi model",
  cause: "Thay model, phế đồng model cũ trong máy / Vệ sinh, bảo dưỡng máy",
  source: "Lỗi do quy trình"
}, {
  name: "QC kiểm tra",
  cause: "Phế QC lấy mẫu kiểm tra",
  source: "Lỗi quy trình"
}, {
  name: "Lỗi khác",
  cause: "Các loại lỗi còn lại",
  source: "Lỗi con người"
}];
const ATTENDANCE_STATUSES = [{
  key: "caNgay",
  label: "Ca Ngày",
  color: "#2563EB",
  icon: SunIcon
}, {
  key: "caDem",
  label: "Ca Đêm",
  color: "#7C3AED",
  icon: MoonIcon
}, {
  key: "nghiPhep",
  label: "Nghỉ phép",
  color: "#15803D",
  icon: CheckCircle2
}, {
  key: "daoCa",
  label: "Đảo Ca",
  color: "#B45309",
  icon: RefreshCw
}, {
  key: "nghiKhongPhep",
  label: "Nghỉ không phép",
  color: "#DC2626",
  icon: X
}, {
  key: "diLamMuon",
  label: "Đi làm muộn",
  color: "#C2410C",
  icon: ClockIcon
}, {
  key: "veSom",
  label: "Về sớm",
  color: "#BE185D",
  icon: RunFastIcon
}];
const NAV_ITEMS = [{
  key: "dashboard",
  group: "dieuhanh",
  label: "Tổng quan & Nhập liệu",
  icon: LayoutDashboard,
  roles: ["admin", "manager", "employee"]
}, {
  key: "orders",
  group: "kinhdoanh",
  label: "Đơn hàng & BOM",
  icon: ClipboardList,
  roles: ["admin", "manager", "employee"]
}, {
  key: "machines",
  group: "sanxuat",
  label: "Kế hoạch sản xuất",
  icon: Cog,
  roles: ["admin", "manager", "employee"]
}, {
  key: "completed",
  group: "kinhdoanh",
  label: "Đơn hàng hoàn thành",
  icon: CheckCircle2,
  roles: ["admin", "manager", "employee"]
}, {
  key: "downtime",
  group: "sanxuat",
  label: "Theo dõi thời gian dừng máy",
  icon: History,
  roles: ["admin", "manager", "employee"]
}, {
  key: "qc",
  group: "chatluong",
  label: "Chất lượng & Phế liệu",
  icon: FlaskConical,
  roles: ["admin", "manager", "employee"]
}, {
  key: "staff",
  group: "nhansu",
  label: "Nhân sự",
  icon: Users,
  roles: ["admin", "manager", "employee"]
}, {
  key: "certificates",
  group: "chatluong",
  label: "Chứng nhận ISO - UL",
  icon: AwardIcon,
  roles: ["admin", "manager", "employee"]
}, {
  key: "reports",
  group: "baocao",
  label: "Báo cáo & Biểu đồ",
  icon: BarChart3,
  roles: ["admin", "manager", "employee"]
}, {
  key: "ops",
  group: "sanxuat",
  label: "Điều hành sản xuất",
  icon: CalendarIcon,
  roles: ["admin", "manager", "employee"],
  mod: "dieuhanh"
}, {
  key: "warehouse",
  group: "kho",
  label: "Kho & nguyên liệu",
  icon: Package,
  roles: ["admin", "manager", "employee"],
  mod: "kho"
}, {
  key: "inspect",
  group: "chatluong",
  label: "Kiểm tra QA/QC & NG",
  icon: CheckSquare,
  roles: ["admin", "manager", "employee"],
  mod: "qc"
}, {
  key: "maintenance",
  group: "baocao",
  label: "Bảo trì & sửa chữa",
  icon: Wrench,
  roles: ["admin", "manager", "employee"],
  mod: "dung"
}, {
  key: "training",
  group: "nhansu",
  label: "Đào tạo & tăng ca",
  icon: Users,
  roles: ["admin", "manager", "employee"],
  mod: "nhansu"
}, {
  key: "docs",
  group: "baocao",
  label: "Hồ sơ & tài liệu",
  icon: FileTextIcon,
  roles: ["admin", "manager", "employee"],
  mod: "tailieu"
}, {
  key: "reports2",
  group: "baocao",
  label: "Báo cáo nâng cao",
  icon: BarChart3,
  roles: ["admin", "manager", "employee"],
  mod: "baocao"
}, {
  key: "trace",
  group: "chatluong",
  label: "Truy xuất & toàn vẹn",
  icon: Search,
  roles: ["admin", "manager", "employee"],
  mod: "qc"
}, {
  key: "perms",
  group: "hethong",
  label: "Phân quyền & giám sát",
  icon: ShieldCheck,
  roles: ["admin"]
}, {
  key: "admin",
  group: "hethong",
  label: "Quản trị hệ thống",
  icon: ShieldCheck,
  roles: ["admin"]
}];
// Nhóm điều hướng (v49). Chỉ liệt kê mục THỰC SỰ có trong NAV_ITEMS; nhóm không còn mục nào (hoặc người dùng không có quyền) sẽ tự ẩn.
const NAV_GROUPS = [
  { key: "dieuhanh", label: "Điều hành" },
  { key: "kinhdoanh", label: "Kinh doanh & Đơn hàng" },
  { key: "sanxuat", label: "Sản xuất" },
  { key: "chatluong", label: "Chất lượng" },
  { key: "kho", label: "Kho & Vật tư" },
  { key: "nhansu", label: "Nhân sự" },
  { key: "baocao", label: "Quản lý & Báo cáo" },
  { key: "hethong", label: "Hệ thống" }
];
