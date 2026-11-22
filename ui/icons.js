/* ===================== BỘ ICON SVG (thay thế emoji) =====================
   Bộ icon line-style đồng nhất (viewBox 24x24, stroke=currentColor) theo
   phong cách tối giản/chuyên nghiệp. Giữ nguyên API cũ ({size,color,style,...})
   nên không cần sửa bất kỳ chỗ gọi <Icon/> nào khác trong file. */
const _svg = draw => ({
  size = 16,
  color,
  style,
  strokeWidth = 1.9,
  ...p
}) => /*#__PURE__*/React.createElement("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color || "currentColor",
  strokeWidth,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: {
    flexShrink: 0,
    display: "inline-block",
    verticalAlign: "middle",
    ...style
  },
  ...p
}, draw());
const Factory = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M3 21V11l5 3.3V11l5 3.3V11l5 3.3V21H3Z"
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 2,
    y1: 21,
    x2: 19,
    y2: 21
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 16,
    y1: 4,
    x2: 16,
    y2: 8.5
  })]),
  LayoutDashboard = _svg(() => [/*#__PURE__*/React.createElement("rect", {
    key: 1,
    x: 3,
    y: 3,
    width: 7,
    height: 9,
    rx: 1.4
  }), /*#__PURE__*/React.createElement("rect", {
    key: 2,
    x: 14,
    y: 3,
    width: 7,
    height: 5,
    rx: 1.4
  }), /*#__PURE__*/React.createElement("rect", {
    key: 3,
    x: 14,
    y: 12,
    width: 7,
    height: 9,
    rx: 1.4
  }), /*#__PURE__*/React.createElement("rect", {
    key: 4,
    x: 3,
    y: 16,
    width: 7,
    height: 5,
    rx: 1.4
  })]),
  ClipboardList = _svg(() => [/*#__PURE__*/React.createElement("rect", {
    key: 1,
    x: 5,
    y: 4,
    width: 14,
    height: 17,
    rx: 2
  }), /*#__PURE__*/React.createElement("rect", {
    key: 2,
    x: 9,
    y: 2,
    width: 6,
    height: 4,
    rx: 1
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 8,
    y1: 10.5,
    x2: 16,
    y2: 10.5
  }), /*#__PURE__*/React.createElement("line", {
    key: 4,
    x1: 8,
    y1: 14,
    x2: 16,
    y2: 14
  }), /*#__PURE__*/React.createElement("line", {
    key: 5,
    x1: 8,
    y1: 17.5,
    x2: 13,
    y2: 17.5
  })]),
  Cog = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 3
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
  })]),
  Users = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 8.2,
    cy: 8.5,
    r: 3
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M2.2 21v-1a6 6 0 0 1 12 0v1"
  }), /*#__PURE__*/React.createElement("circle", {
    key: 3,
    cx: 17,
    cy: 8,
    r: 2.3
  }), /*#__PURE__*/React.createElement("path", {
    key: 4,
    d: "M14.3 21v-1a5 5 0 0 1 7.5-4.3"
  })]),
  BarChart3 = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 4,
    y1: 20,
    x2: 20,
    y2: 20
  }), /*#__PURE__*/React.createElement("rect", {
    key: 2,
    x: 6,
    y: 12,
    width: 3,
    height: 8
  }), /*#__PURE__*/React.createElement("rect", {
    key: 3,
    x: 11,
    y: 7,
    width: 3,
    height: 13
  }), /*#__PURE__*/React.createElement("rect", {
    key: 4,
    x: 16,
    y: 4,
    width: 3,
    height: 16
  })]),
  ShieldCheck = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "8.5,12 11,14.5 15.5,9.5"
  })]),
  LogOut = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "15,17 20,12 15,7"
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 20,
    y1: 12,
    x2: 9,
    y2: 12
  })]),
  Plus = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 12,
    y1: 4,
    x2: 12,
    y2: 20
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 4,
    y1: 12,
    x2: 20,
    y2: 12
  })]),
  Pencil = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 14,
    y1: 7,
    x2: 17.5,
    y2: 10.5
  })]),
  Trash2 = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 4,
    y1: 7,
    x2: 20,
    y2: 7
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M6 7V4h12v3"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M6 7l1 13h10l1-13"
  }), /*#__PURE__*/React.createElement("line", {
    key: 4,
    x1: 10,
    y1: 11,
    x2: 10,
    y2: 17
  }), /*#__PURE__*/React.createElement("line", {
    key: 5,
    x1: 14,
    y1: 11,
    x2: 14,
    y2: 17
  })]),
  Search = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 10.5,
    cy: 10.5,
    r: 6.5
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 20,
    y1: 20,
    x2: 15.4,
    y2: 15.4
  })]),
  ChevronDown = _svg(() => [/*#__PURE__*/React.createElement("polyline", {
    key: 1,
    points: "5,8.5 12,15.5 19,8.5"
  })]),
  ChevronRight = _svg(() => [/*#__PURE__*/React.createElement("polyline", {
    key: 1,
    points: "9,5 16,12 9,19"
  })]),
  AlertTriangle = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M12 3 2 20h20L12 3Z"
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 12,
    y1: 10,
    x2: 12,
    y2: 15
  }), /*#__PURE__*/React.createElement("circle", {
    key: 3,
    cx: 12,
    cy: 17.7,
    r: 0.9,
    fill: "currentColor",
    stroke: "none"
  })]),
  CheckCircle2 = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 9
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "8,12.5 11,15.5 16,9"
  })]),
  History = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M3 12a9 9 0 1 0 3-6.7"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "3,4 3,9 8,9"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 3,
    points: "12,8 12,12.5 15.5,14.5"
  })]),
  Lock = _svg(() => [/*#__PURE__*/React.createElement("rect", {
    key: 1,
    x: 5,
    y: 11,
    width: 14,
    height: 9,
    rx: 2
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M8 11V7a4 4 0 0 1 8 0v4"
  })]),
  UserIcon = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 8,
    r: 4
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M4 21v-1a8 8 0 0 1 16 0v1"
  })]),
  X = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 6,
    y1: 6,
    x2: 18,
    y2: 18
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 18,
    y1: 6,
    x2: 6,
    y2: 18
  })]),
  Menu = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 4,
    y1: 6,
    x2: 20,
    y2: 6
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 4,
    y1: 12,
    x2: 20,
    y2: 12
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 4,
    y1: 18,
    x2: 20,
    y2: 18
  })]),
  Save = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M5 4h11l3 3v13H5V4Z"
  }), /*#__PURE__*/React.createElement("rect", {
    key: 2,
    x: 8,
    y: 4,
    width: 7,
    height: 5
  }), /*#__PURE__*/React.createElement("rect", {
    key: 3,
    x: 8,
    y: 14,
    width: 8,
    height: 6
  })]),
  TrendingUp = _svg(() => [/*#__PURE__*/React.createElement("polyline", {
    key: 1,
    points: "3,17 9,11 13,15 21,6"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "15,6 21,6 21,12"
  })]),
  PackageSearch = _svg(() => [/*#__PURE__*/React.createElement("rect", {
    key: 1,
    x: 3,
    y: 7,
    width: 12,
    height: 12,
    rx: 1.4
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M6 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  }), /*#__PURE__*/React.createElement("circle", {
    key: 3,
    cx: 18,
    cy: 17,
    r: 3
  }), /*#__PURE__*/React.createElement("line", {
    key: 4,
    x1: 20.2,
    y1: 19.2,
    x2: 22,
    y2: 21
  })]),
  Wrench = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z"
  })]),
  Gauge = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 13,
    r: 8
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 12,
    y1: 13,
    x2: 16,
    y2: 9
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 7,
    y1: 6,
    x2: 8.3,
    y2: 7.3
  }), /*#__PURE__*/React.createElement("line", {
    key: 4,
    x1: 12,
    y1: 4,
    x2: 12,
    y2: 5.5
  }), /*#__PURE__*/React.createElement("line", {
    key: 5,
    x1: 17,
    y1: 6,
    x2: 15.7,
    y2: 7.3
  })]),
  Recycle = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M4 12a8 8 0 0 1 8-8h4"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "14,1 16,4 13,6"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M20 12a8 8 0 0 1-8 8h-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 4,
    points: "10,23 8,20 11,18"
  })]),
  CalendarDays = _svg(() => [/*#__PURE__*/React.createElement("rect", {
    key: 1,
    x: 3,
    y: 5,
    width: 18,
    height: 16,
    rx: 2
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 3,
    y1: 10,
    x2: 21,
    y2: 10
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 8,
    y1: 3,
    x2: 8,
    y2: 7
  }), /*#__PURE__*/React.createElement("line", {
    key: 4,
    x1: 16,
    y1: 3,
    x2: 16,
    y2: 7
  }), /*#__PURE__*/React.createElement("line", {
    key: 5,
    x1: 7,
    y1: 14,
    x2: 7.01,
    y2: 14
  }), /*#__PURE__*/React.createElement("line", {
    key: 6,
    x1: 12,
    y1: 14,
    x2: 12.01,
    y2: 14
  }), /*#__PURE__*/React.createElement("line", {
    key: 7,
    x1: 17,
    y1: 14,
    x2: 17.01,
    y2: 14
  })]),
  RefreshCw = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M4 12a8 8 0 0 1 14.6-4.6"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "19,3 19,8 14,8"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M20 12a8 8 0 0 1-14.6 4.6"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 4,
    points: "5,21 5,16 10,16"
  })]),
  Eye = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
  }), /*#__PURE__*/React.createElement("circle", {
    key: 2,
    cx: 12,
    cy: 12,
    r: 3
  })]),
  EyeOff = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M3 3l18 18"
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M10.6 5.2A10.7 10.7 0 0 1 12 5c6 0 10 7 10 7a17.9 17.9 0 0 1-3.2 4.1M6.5 6.6A18 18 0 0 0 2 12s4 7 10 7a10.4 10.4 0 0 0 4.6-1"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M9.5 9.7a3 3 0 0 0 4.2 4.2"
  })]),
  ArrowRight = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 4,
    y1: 12,
    x2: 20,
    y2: 12
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "14,6 20,12 14,18"
  })]),
  Filter = _svg(() => [/*#__PURE__*/React.createElement("polygon", {
    key: 1,
    points: "4,4 20,4 14,12.5 14,19 10,21 10,12.5"
  })]),
  AlertOctagon = _svg(() => [/*#__PURE__*/React.createElement("polygon", {
    key: 1,
    points: "7.5,2 16.5,2 22,7.5 22,16.5 16.5,22 7.5,22 2,16.5 2,7.5"
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 12,
    y1: 8,
    x2: 12,
    y2: 13
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 12,
    y1: 16.5,
    x2: 12,
    y2: 16.51
  })]),
  CircleDot = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 9
  }), /*#__PURE__*/React.createElement("circle", {
    key: 2,
    cx: 12,
    cy: 12,
    r: 2.6,
    fill: "currentColor",
    stroke: "none"
  })]),
  ClipboardCheck = _svg(() => [/*#__PURE__*/React.createElement("rect", {
    key: 1,
    x: 5,
    y: 4,
    width: 14,
    height: 17,
    rx: 2
  }), /*#__PURE__*/React.createElement("rect", {
    key: 2,
    x: 9,
    y: 2,
    width: 6,
    height: 4,
    rx: 1
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 3,
    points: "9,13 11,15 15,10.5"
  })]),
  Hammer = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M15 12l-8.5 8.5a1.5 1.5 0 0 1-2-2L13 10"
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M12 9l3-3 5 5-3 3Z"
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 17,
    y1: 4,
    x2: 20,
    y2: 7
  })]),
  FlaskConical = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 9,
    y1: 3,
    x2: 15,
    y2: 3
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M10 3v6l-6 10a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-6-10V3"
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 7.5,
    y1: 14,
    x2: 16.5,
    y2: 14
  })]),
  Sparkles = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z"
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"
  })]),
  Boxes = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M3 8l5-3 5 3v6l-5 3-5-3Z"
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M13 8.3l4.5-2.6 3.5 2v5.6l-3.5 2"
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 8,
    y1: 5,
    x2: 8,
    y2: 11
  })]),
  ChevronUp = _svg(() => [/*#__PURE__*/React.createElement("polyline", {
    key: 1,
    points: "5,15.5 12,8.5 19,15.5"
  })]),
  Loader2 = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M12 3a9 9 0 1 0 9 9"
  })]),
  Info = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 9
  }), /*#__PURE__*/React.createElement("line", {
    key: 2,
    x1: 12,
    y1: 11,
    x2: 12,
    y2: 16
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 12,
    y1: 7.5,
    x2: 12,
    y2: 7.51
  })]),
  Upload = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 12,
    y1: 4,
    x2: 12,
    y2: 16
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "7,9 12,4 17,9"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
  })]),
  Download = _svg(() => [/*#__PURE__*/React.createElement("line", {
    key: 1,
    x1: 12,
    y1: 4,
    x2: 12,
    y2: 16
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "7,11 12,16 17,11"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
  })]),
  FileSpreadsheet = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "15,2 15,7 20,7"
  }), /*#__PURE__*/React.createElement("line", {
    key: 3,
    x1: 8,
    y1: 13,
    x2: 16,
    y2: 13
  }), /*#__PURE__*/React.createElement("line", {
    key: 4,
    x1: 8,
    y1: 17,
    x2: 16,
    y2: 17
  }), /*#__PURE__*/React.createElement("line", {
    key: 5,
    x1: 11,
    y1: 13,
    x2: 11,
    y2: 21
  })]),
  SunIcon = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 4.5
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M12 2.5v2.5M12 19v2.5M4.4 4.4l1.8 1.8M17.8 17.8l1.8 1.8M2.5 12h2.5M19 12h2.5M4.4 19.6l1.8-1.8M17.8 6.2l1.8-1.8"
  })]),
  MoonIcon = _svg(() => [/*#__PURE__*/React.createElement("path", {
    key: 1,
    d: "M20 14.2A8.5 8.5 0 1 1 9.8 4a6.8 6.8 0 0 0 10.2 10.2Z"
  })]),
  ClockIcon = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 12,
    r: 9
  }), /*#__PURE__*/React.createElement("polyline", {
    key: 2,
    points: "12,7 12,12 16,14.5"
  })]),
  RunFastIcon = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 14.3,
    cy: 4.2,
    r: 1.7,
    fill: "currentColor",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M11 8.2l2.4 2 3 .6M13.4 10.2l-1.6 3.4 3 3.2-1 4M11.8 13.6l-3.4 1-2 3.6"
  }), /*#__PURE__*/React.createElement("path", {
    key: 3,
    d: "M18.5 8.5l2 1M2 15.5l3-1M19 19l3 .8"
  })]),
  AwardIcon = _svg(() => [/*#__PURE__*/React.createElement("circle", {
    key: 1,
    cx: 12,
    cy: 8,
    r: 6
  }), /*#__PURE__*/React.createElement("path", {
    key: 2,
    d: "M8.2 13.2 6.5 21l5.5-3 5.5 3-1.7-7.8"
  })]);
