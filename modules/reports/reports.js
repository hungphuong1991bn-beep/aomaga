/* ===================== REPORTS PAGE ===================== */
const PIE_COLORS = [COLORS.copper, COLORS.green, COLORS.blue, COLORS.amber, COLORS.violet, COLORS.red];
function ChartCard({
  title,
  eyebrow,
  children,
  height = 260,
  accent = COLORS.blue
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 18,
      border: `1.5px solid ${accent}55`,
      borderTop: `4px solid ${accent}`,
      boxShadow: `0 2px 8px ${accent}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "mes-mono",
    style: {
      fontSize: 10.5,
      color: COLORS.copper,
      letterSpacing: ".07em",
      textTransform: "uppercase",
      marginBottom: 3
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, title)), /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: height
  }, children));
}

// Gộp số liệu nền từ đơn hàng (theo Ngày xuống đơn) với số liệu nhập trực tiếp qua
// Tổng quan (theo ngày nhập thực tế) cho một công đoạn cụ thể, theo từng mã liệu.
// Không đếm trùng: phần "nền" lấy hiện tại trừ đi phần đã được ghi nhận qua Tổng quan.
function aggregateStageByMaterial(orders, auditLog, stageKey, granularity, allowedMaterials) {
  const matchesAllowed = mat => !allowedMaterials || allowedMaterials.includes(mat);
  const relevantOrders = orders.filter(o => matchesAllowed(o.materialCode || "Khác"));
  const liveEntries = (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === stageKey && a.date && typeof a.qty === "number" && matchesAllowed(a.materialCode || "Khác"));
  const buckets = {};
  const materials = new Set();
  function addToBucket(key, label, mat, qty) {
    if (!qty) return;
    materials.add(mat);
    if (!buckets[key]) buckets[key] = {
      key,
      label,
      total: 0
    };
    buckets[key][mat] = (buckets[key][mat] || 0) + qty;
    buckets[key].total += qty;
  }
  relevantOrders.forEach(o => {
    const currentDone = o.stages?.[stageKey]?.done || 0;
    const loggedForOrder = liveEntries.filter(a => a.targetId === o.id).reduce((s, a) => s + (a.qty || 0), 0);
    const baseline = Math.round((currentDone - loggedForOrder) * 100) / 100;
    if (baseline > 0) {
      const mat = o.materialCode || "Khác";
      if (o.orderDate) {
        const key = getBucketKey(o.orderDate, granularity);
        addToBucket(key, getBucketLabel(key, granularity), mat, baseline);
      } else {
        addToBucket("unknown", "Không rõ ngày", mat, baseline);
      }
    }
  });
  liveEntries.forEach(e => {
    const key = getBucketKey(e.date, granularity);
    addToBucket(key, getBucketLabel(key, granularity), e.materialCode || "Khác", e.qty);
  });
  const sortedKeys = Object.keys(buckets).filter(k => k !== "unknown").sort();
  if (buckets["unknown"]) sortedKeys.push("unknown");
  const materialList = [...materials].sort();
  return {
    data: sortedKeys.map(k => buckets[k]),
    materials: materialList,
    totalKg: sortedKeys.reduce((a, k) => a + buckets[k].total, 0),
    entryCount: liveEntries.length
  };
}

// Gộp sản lượng theo loại dây (Dây cứng / Dây ủ mềm) - đây là phân loại do người
// dùng tự chọn khi nhập sản lượng tại công đoạn Kéo trung. Số liệu nền có sẵn từ
// đơn hàng (chưa từng được phân loại khi nhập) sẽ rơi vào nhóm "Chưa phân loại".
function aggregateStageByWireType(orders, auditLog, stageKey, granularity) {
  const liveEntries = (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === stageKey && a.date && typeof a.qty === "number");
  const buckets = {};
  const types = new Set();
  function addToBucket(key, label, type, qty) {
    if (!qty) return;
    types.add(type);
    if (!buckets[key]) buckets[key] = {
      key,
      label,
      total: 0
    };
    buckets[key][type] = (buckets[key][type] || 0) + qty;
    buckets[key].total += qty;
  }
  orders.forEach(o => {
    const currentDone = o.stages?.[stageKey]?.done || 0;
    const loggedForOrder = liveEntries.filter(a => a.targetId === o.id).reduce((s, a) => s + (a.qty || 0), 0);
    const baseline = Math.round((currentDone - loggedForOrder) * 100) / 100;
    if (baseline > 0) {
      if (o.orderDate) {
        const key = getBucketKey(o.orderDate, granularity);
        addToBucket(key, getBucketLabel(key, granularity), "Chưa phân loại", baseline);
      } else {
        addToBucket("unknown", "Không rõ ngày", "Chưa phân loại", baseline);
      }
    }
  });
  liveEntries.forEach(e => {
    const key = getBucketKey(e.date, granularity);
    addToBucket(key, getBucketLabel(key, granularity), e.wireType || "Chưa phân loại", e.qty);
  });
  const sortedKeys = Object.keys(buckets).filter(k => k !== "unknown").sort();
  if (buckets["unknown"]) sortedKeys.push("unknown");
  const typeOrder = ["Dây cứng", "Dây ủ mềm", "Chưa phân loại"];
  const typeList = [...types].sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));
  return {
    data: sortedKeys.map(k => buckets[k]),
    materials: typeList,
    totalKg: sortedKeys.reduce((a, k) => a + buckets[k].total, 0),
    entryCount: liveEntries.length
  };
}

// Kết hợp 2 chiều: Mã liệu (A/B/C) × Loại dây (Dây cứng/Dây ủ mềm) thành các cột
// riêng, ví dụ "A - Dây mềm", "A - Dây cứng"... Chỉ tính các lượt nhập MỚI qua
// Tổng quan có đủ cả 2 thông tin (mã liệu hợp lệ + loại dây đã chọn); số liệu nền
// cũ từ đơn hàng không có loại dây nên không thể xếp vào bảng kết hợp này.
function aggregateStageByMaterialAndWireType(orders, auditLog, stageKey, granularity, allowedMaterials) {
  const orderById = {};
  orders.forEach(o => {
    orderById[o.id] = o;
  });
  // Tất cả lượt nhập có phân loại loại dây cho công đoạn này (chưa lọc theo mã liệu) —
  // dùng để tính đúng phần "đã ghi nhận" của mỗi đơn, tránh đếm trùng với số liệu nền.
  const allWireEntries = (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === stageKey && a.date && typeof a.qty === "number" && a.wireType);
  // Mã liệu hiển thị LUÔN lấy theo đơn hàng HIỆN TẠI (không dùng mã liệu lưu cũ trong nhật
  // ký từ lúc nhập — vì đơn có thể đã được sửa mã liệu sau đó), để tránh sót dữ liệu.
  function resolveMat(e) {
    return orderById[e.targetId]?.materialCode || e.materialCode || "";
  }
  const liveEntries = allWireEntries.filter(a => allowedMaterials.includes(resolveMat(a)));
  const buckets = {};
  const combos = new Set();
  function addToBucket(key, label, combo, qty) {
    if (!qty) return;
    combos.add(combo);
    if (!buckets[key]) buckets[key] = {
      key,
      label,
      total: 0
    };
    buckets[key][combo] = (buckets[key][combo] || 0) + qty;
    buckets[key].total += qty;
  }
  // 1) Số liệu nền: đơn hàng đã được đánh dấu "Dây cứng"/"Dây ủ mềm" (vd qua ô tick khi
  // chỉnh sửa đơn) nhưng KHÔNG đi qua nhật ký nhập liệu ở Tổng quan — vẫn cần tính vào
  // báo cáo này, trừ phần đã được ghi nhận qua Tổng quan (allWireEntries, không lọc mã
  // liệu) để tránh đếm trùng.
  const wireTypeFull = {
    "cứng": "Dây cứng",
    "mềm": "Dây ủ mềm"
  };
  orders.forEach(o => {
    if (stageKey !== "keo_trung" || !o.wireFinish) return;
    const mat = o.materialCode || "";
    if (!allowedMaterials.includes(mat)) return;
    const currentDone = o.stages?.[stageKey]?.done || 0;
    const loggedForOrder = allWireEntries.filter(a => a.targetId === o.id).reduce((s, a) => s + (a.qty || 0), 0);
    const baseline = Math.round((currentDone - loggedForOrder) * 100) / 100;
    if (baseline > 0) {
      const combo = `${mat} - ${wireTypeFull[o.wireFinish] || o.wireFinish}`;
      if (o.orderDate) {
        const key = getBucketKey(o.orderDate, granularity);
        addToBucket(key, getBucketLabel(key, granularity), combo, baseline);
      } else {
        addToBucket("unknown", "Không rõ ngày", combo, baseline);
      }
    }
  });
  // 2) Số liệu nhập trực tiếp qua Tổng quan (theo đúng ngày nhập thực tế)
  liveEntries.forEach(e => {
    const mat = resolveMat(e);
    const combo = `${mat} - ${e.wireType}`;
    const key = getBucketKey(e.date, granularity);
    addToBucket(key, getBucketLabel(key, granularity), combo, e.qty);
  });
  const sortedKeys = Object.keys(buckets).filter(k => k !== "unknown").sort();
  if (buckets["unknown"]) sortedKeys.push("unknown");
  const comboOrder = [];
  allowedMaterials.forEach(mat => {
    comboOrder.push(`${mat} - Dây ủ mềm`);
    comboOrder.push(`${mat} - Dây cứng`);
  });
  const comboList = comboOrder.filter(c => combos.has(c));
  return {
    data: sortedKeys.map(k => buckets[k]),
    materials: comboList,
    totalKg: sortedKeys.reduce((a, k) => a + buckets[k].total, 0),
    entryCount: liveEntries.length
  };
}

// Gộp số liệu PHẾ LIỆU (lấy từ bảng "Ghi nhận phế liệu") theo mã nguyên liệu A/B/C
// và theo thời gian (ngày/tuần/tháng), cho một công đoạn cụ thể.
function aggregateScrapByMaterial(scrap, stageKey, granularity, allowedMaterials) {
  const relevant = (scrap || []).filter(s => s.stage === stageKey && s.date && typeof s.qty === "number" && allowedMaterials.includes(s.materialCode || ""));
  const buckets = {};
  const materials = new Set();
  function addToBucket(key, label, mat, qty) {
    if (!qty) return;
    materials.add(mat);
    if (!buckets[key]) buckets[key] = {
      key,
      label,
      total: 0
    };
    buckets[key][mat] = (buckets[key][mat] || 0) + qty;
    buckets[key].total += qty;
  }
  relevant.forEach(s => {
    const key = getBucketKey(s.date, granularity);
    addToBucket(key, getBucketLabel(key, granularity), s.materialCode, s.qty);
  });
  const sortedKeys = Object.keys(buckets).sort();
  const materialList = allowedMaterials.filter(m => materials.has(m));
  return {
    data: sortedKeys.map(k => buckets[k]),
    materials: materialList,
    totalKg: sortedKeys.reduce((a, k) => a + buckets[k].total, 0),
    entryCount: relevant.length
  };
}
function ProductionEntryEditModal({
  entry,
  onClose,
  onSave
}) {
  const [qty, setQty] = useState(entry.qty);
  const [materialCode, setMaterialCode] = useState(entry.materialCode || "");
  const [wireType, setWireType] = useState(entry.wireType || "");
  const [date, setDate] = useState(entry.date || "");
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Chỉnh sửa lượt nhập — ${entry.customer} / ${entry.spec}`,
    onClose: onClose,
    width: 420
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Ngày"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Số lượng (kg)"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "number",
    min: "0",
    step: "0.1",
    value: qty,
    onChange: e => setQty(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Mã liệu"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    value: materialCode,
    onChange: e => setMaterialCode(e.target.value),
    placeholder: "A / B / C..."
  })), entry.stageKey === "keo_trung" && /*#__PURE__*/React.createElement(Field, {
    label: "Loại dây"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, ["Dây cứng", "Dây ủ mềm"].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    onClick: () => setWireType(t),
    className: "mes-btn",
    style: {
      flex: 1,
      justifyContent: "center",
      borderColor: wireType === t ? COLORS.copper : COLORS.border,
      background: wireType === t ? `${COLORS.copper}22` : COLORS.bgPanel2,
      color: wireType === t ? COLORS.copperBright : COLORS.textDim
    }
  }, t)))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => {
      onSave(entry.id, parseFloat(qty) || 0, materialCode, wireType, date);
      onClose();
    },
    style: {
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), " Lưu thay đổi"));
}
function ProductionEntriesManager({
  auditLog,
  stageKey,
  onEdit,
  onDelete
}) {
  const {
    askConfirm
  } = useDialog();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const entries = useMemo(() => (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === stageKey).sort((a, b) => new Date(b.date) - new Date(a.date)), [auditLog, stageKey]);
  if (entries.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    className: "mes-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      justifyContent: "space-between",
      borderColor: COLORS.copper,
      background: `${COLORS.copper}14`,
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 14,
    color: COLORS.copper
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.copperBright
    }
  }, "Sửa / xóa các lượt nhập sản lượng đã ghi (", entries.length, ")")), open ? /*#__PURE__*/React.createElement(ChevronUp, {
    size: 15,
    color: COLORS.copper
  }) : /*#__PURE__*/React.createElement(ChevronDown, {
    size: 15,
    color: COLORS.copper
  })), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x",
    style: {
      maxHeight: 320,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ngày"), /*#__PURE__*/React.createElement("th", null, "Khách hàng / Quy cách"), /*#__PURE__*/React.createElement("th", null, "Mã liệu"), /*#__PURE__*/React.createElement("th", null, "Loại dây"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Số lượng"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, entries.map(e => /*#__PURE__*/React.createElement("tr", {
    key: e.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, fmtDate(e.date)), /*#__PURE__*/React.createElement("td", null, e.customer, " / ", e.spec), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, e.materialCode || "—"), /*#__PURE__*/React.createElement("td", null, e.wireType || "—"), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right"
    }
  }, fmtNum(e.qty)), /*#__PURE__*/React.createElement("td", {
    style: {
      display: "flex",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: Pencil,
    onClick: () => setEditing(e),
    title: "Sửa"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: Trash2,
    danger: true,
    onClick: async () => {
      if (await askConfirm(`Xóa lượt nhập ${fmtNum(e.qty)}kg — ${e.customer}/${e.spec}?`, {
        danger: true,
        confirmLabel: "Xóa"
      })) onDelete(e.id);
    },
    title: "Xóa"
  })))))))), editing && /*#__PURE__*/React.createElement(ProductionEntryEditModal, {
    entry: editing,
    onClose: () => setEditing(null),
    onSave: onEdit
  }));
}
function KeoTrungSummaryTable({
  title,
  agg,
  colPrefix = "Mã "
}) {
  if (agg.data.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.text,
      marginBottom: 8
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x"
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Thời gian"), agg.materials.map(mat => /*#__PURE__*/React.createElement("th", {
    key: mat,
    style: {
      textAlign: "right"
    }
  }, colPrefix, mat)), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right",
      color: COLORS.copperBright
    }
  }, "Tổng cộng (kg)"))), /*#__PURE__*/React.createElement("tbody", null, agg.data.map(row => /*#__PURE__*/React.createElement("tr", {
    key: row.key
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 600
    }
  }, row.label), agg.materials.map(mat => /*#__PURE__*/React.createElement("td", {
    key: mat,
    className: "mes-mono",
    style: {
      textAlign: "right",
      color: row[mat] ? COLORS.text : COLORS.textFaint
    }
  }, fmtNum(row[mat] || 0))), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      color: COLORS.copperBright
    }
  }, fmtNum(row.total))))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 700,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, "Tổng cộng"), agg.materials.map(mat => /*#__PURE__*/React.createElement("td", {
    key: mat,
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, fmtNum(agg.data.reduce((a, r) => a + (r[mat] || 0), 0)))), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 800,
      color: COLORS.copperBright,
      fontSize: 16,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, fmtNum(agg.totalKg)))))));
}
function ReportsPage({
  orders,
  machines,
  scrap,
  timeseries,
  auditLog,
  currentUser,
  isAdmin,
  onEditProductionEntry,
  onDeleteProductionEntry
}) {
  // Admin xem tất cả công đoạn; tài khoản theo tổ chỉ xem đúng công đoạn của tổ mình
  const visibleStageKeys = isAdmin ? null : TEAM_REPORT_STAGES[currentUser?.team] || null;
  const visibleStages = visibleStageKeys ? STAGES.filter(s => visibleStageKeys.includes(s.key)) : STAGES;
  const isStageVisible = key => !visibleStageKeys || visibleStageKeys.includes(key);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [keoTrungGranularity, setKeoTrungGranularity] = useState("day");
  const liveStageData = useMemo(() => {
    const keoTrungTotal = (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === "keo_trung" && typeof a.qty === "number").reduce((a, e) => a + e.qty, 0);
    return visibleStages.map(s => ({
      name: s.short,
      fullName: s.label,
      value: s.key === "keo_trung" ? keoTrungTotal : orders.reduce((a, o) => a + (o.stages?.[s.key]?.done || 0), 0)
    }));
  }, [orders, auditLog, visibleStages]);
  const historicalData = useMemo(() => timeseries.map((t, i) => ({
    ky: "Kỳ " + (i + 1),
    "Kéo trung": t.keo_trung,
    "Kéo tinh": t.keo_tinh,
    "Kéo siêu tinh": t.keo_sieu_tinh,
    "Ủ nhiệt": t.u_nhiet,
    "Mạ thiếc": t.ma_thiec,
    "Bện": t.ben
  })), [timeseries]);
  const statusDist = useMemo(() => {
    const m = {
      "Đang sản xuất": 0,
      "Hoàn thành": 0,
      "Chưa bắt đầu": 0
    };
    orders.forEach(o => {
      m[orderProgress(o).statusLabel] = (m[orderProgress(o).statusLabel] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({
      name,
      value
    })).filter(d => d.value > 0);
  }, [orders]);
  const MACHINE_TYPE_STAGE = useMemo(() => Object.fromEntries(MACHINE_TYPES.map(t => [t.key, t.stage])), []);
  const machineDist = useMemo(() => {
    const m = {
      running: 0,
      idle: 0,
      maintenance: 0,
      broken: 0,
      unknown: 0
    };
    machines.filter(mm => {
      const st = MACHINE_TYPE_STAGE[mm.typeKey];
      return !st || isStageVisible(st);
    }).forEach(mm => m[mm.status]++);
    return Object.entries(m).map(([k, v]) => ({
      name: MACHINE_STATUS[k].label,
      value: v,
      color: MACHINE_STATUS[k].color
    })).filter(d => d.value > 0);
  }, [machines, visibleStageKeys]);
  const scrapByDate = useMemo(() => {
    const m = {};
    scrap.filter(s => isStageVisible(s.stage)).forEach(s => {
      m[s.date] = (m[s.date] || 0) + (s.qty || 0);
    });
    return Object.entries(m).sort(([a], [b]) => new Date(a) - new Date(b)).map(([date, qty]) => ({
      date: fmtDate(date),
      qty
    }));
  }, [scrap, visibleStageKeys]);
  const customers = useMemo(() => [...new Set(orders.map(o => o.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders]);
  const byCustomerData = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      const key = o.customer || "Khác";
      if (!m[key]) m[key] = {
        customer: key,
        "Đã làm": 0,
        "Còn lại": 0,
        soDon: 0
      };
      const prog = orderProgress(o);
      m[key]["Đã làm"] += prog.completedQty;
      m[key]["Còn lại"] += prog.remainingQty !== null ? Math.max(0, prog.remainingQty) : 0;
      m[key].soDon += 1;
    });
    return Object.values(m).sort((a, b) => b["Đã làm"] + b["Còn lại"] - (a["Đã làm"] + a["Còn lại"]));
  }, [orders]);
  const orderDetailData = useMemo(() => {
    const filtered = customerFilter === "all" ? orders : orders.filter(o => o.customer === customerFilter);
    return filtered.map(o => {
      const prog = orderProgress(o);
      return {
        name: `${o.customer} · ${o.spec}`,
        pct: prog.pct === null ? 0 : Math.round(Math.min(100, prog.pct) * 10) / 10,
        statusLabel: prog.statusLabel,
        color: prog.statusColor,
        remainingQty: prog.remainingQty
      };
    }).sort((a, b) => a.pct - b.pct);
  }, [orders, customerFilter]);
  const VALID_MATERIAL_GRADES = ["A", "B", "C"];
  const keoTrungDay = useMemo(() => aggregateStageByMaterial(orders, auditLog, "keo_trung", "day", VALID_MATERIAL_GRADES), [orders, auditLog]);
  const keoTrungWeek = useMemo(() => aggregateStageByMaterial(orders, auditLog, "keo_trung", "week", VALID_MATERIAL_GRADES), [orders, auditLog]);
  const keoTrungMonth = useMemo(() => aggregateStageByMaterial(orders, auditLog, "keo_trung", "month", VALID_MATERIAL_GRADES), [orders, auditLog]);
  const keoTrungByMaterial = keoTrungGranularity === "day" ? keoTrungDay : keoTrungGranularity === "week" ? keoTrungWeek : keoTrungMonth;
  const keoTrungWireDay = useMemo(() => aggregateStageByMaterialAndWireType(orders, auditLog, "keo_trung", "day", VALID_MATERIAL_GRADES), [orders, auditLog]);
  const keoTrungWireWeek = useMemo(() => aggregateStageByMaterialAndWireType(orders, auditLog, "keo_trung", "week", VALID_MATERIAL_GRADES), [orders, auditLog]);
  const keoTrungWireMonth = useMemo(() => aggregateStageByMaterialAndWireType(orders, auditLog, "keo_trung", "month", VALID_MATERIAL_GRADES), [orders, auditLog]);
  const keoTrungScrapDay = useMemo(() => aggregateScrapByMaterial(scrap, "keo_trung", "day", VALID_MATERIAL_GRADES), [scrap]);
  const keoTrungScrapWeek = useMemo(() => aggregateScrapByMaterial(scrap, "keo_trung", "week", VALID_MATERIAL_GRADES), [scrap]);
  const keoTrungScrapMonth = useMemo(() => aggregateScrapByMaterial(scrap, "keo_trung", "month", VALID_MATERIAL_GRADES), [scrap]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Real-time",
    title: "Báo cáo & biểu đồ so sánh theo thời gian",
    icon: BarChart3,
    iconColor: COLORS.green,
    action: /*#__PURE__*/React.createElement(Badge, {
      color: COLORS.green
    }, /*#__PURE__*/React.createElement("span", {
      className: "pulse-dot"
    }, "●"), " Tự động cập nhật")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
      gap: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Sản lượng hiện tại theo công đoạn",
    eyebrow: "Tổng hợp từ đơn hàng đang mở",
    accent: COLORS.copper
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: liveStageData
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: COLORS.border,
    vertical: false
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "name",
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    },
    labelFormatter: (l, p) => p?.[0]?.payload?.fullName || l
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "value",
    fill: COLORS.copper,
    radius: [5, 5, 0, 0]
  }))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Phân bố trạng thái đơn hàng",
    eyebrow: `${orders.length} đơn hàng`,
    accent: COLORS.violet
  }, /*#__PURE__*/React.createElement(PieChart, null, /*#__PURE__*/React.createElement(Pie, {
    data: statusDist,
    dataKey: "value",
    nameKey: "name",
    cx: "50%",
    cy: "50%",
    outerRadius: 85,
    innerRadius: 48,
    paddingAngle: 2
  }, statusDist.map((d, i) => /*#__PURE__*/React.createElement(Cell, {
    key: i,
    fill: PIE_COLORS[i % PIE_COLORS.length]
  }))), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Legend, {
    wrapperStyle: {
      fontSize: 12,
      color: COLORS.textDim
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Sản lượng theo từng khách hàng",
    eyebrow: `${customers.length} khách hàng`,
    accent: COLORS.blue,
    height: Math.max(260, byCustomerData.length * 34)
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: byCustomerData,
    layout: "vertical",
    margin: {
      left: 10
    }
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: COLORS.border,
    horizontal: false
  }), /*#__PURE__*/React.createElement(XAxis, {
    type: "number",
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    type: "category",
    dataKey: "customer",
    width: 150,
    tick: {
      fill: COLORS.text,
      fontSize: 12
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Legend, {
    wrapperStyle: {
      fontSize: 11.5
    }
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "Đã làm",
    stackId: "a",
    fill: COLORS.green,
    radius: [0, 0, 0, 0]
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "Còn lại",
    stackId: "a",
    fill: COLORS.amber,
    radius: [0, 4, 4, 0]
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Tiến độ chi tiết theo từng đơn hàng",
    eyebrow: `${orderDetailData.length} đơn hàng${customerFilter !== "all" ? " · " + customerFilter : ""}`,
    accent: COLORS.green,
    height: Math.max(220, orderDetailData.length * 30)
  }, orderDetailData.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    title: "Không có đơn hàng"
  }) : /*#__PURE__*/React.createElement(BarChart, {
    data: orderDetailData,
    layout: "vertical",
    margin: {
      left: 10
    }
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: COLORS.border,
    horizontal: false
  }), /*#__PURE__*/React.createElement(XAxis, {
    type: "number",
    domain: [0, 100],
    unit: "%",
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    type: "category",
    dataKey: "name",
    width: 220,
    tick: {
      fill: COLORS.text,
      fontSize: 11.5
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    },
    formatter: (value, name, props) => [`${value}% — ${props.payload.statusLabel}`, "Tiến độ"]
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "pct",
    radius: [0, 4, 4, 0]
  }, orderDetailData.map((d, i) => /*#__PURE__*/React.createElement(Cell, {
    key: i,
    fill: d.color
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    style: {
      width: 260
    },
    value: customerFilter,
    onChange: e => setCustomerFilter(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tất cả khách hàng"), customers.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))))), isStageVisible("keo_trung") && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 18,
      border: `1.5px solid ${COLORS.copper}55`,
      borderTop: `4px solid ${COLORS.copper}`,
      boxShadow: `0 2px 8px ${COLORS.copper}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
      flexWrap: "wrap",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mes-mono",
    style: {
      fontSize: 10.5,
      color: COLORS.copper,
      letterSpacing: ".07em",
      textTransform: "uppercase",
      marginBottom: 3
    }
  }, "Máy kéo trung · ", fmtNum(keoTrungByMaterial.totalKg), " kg đã chạy qua (", keoTrungByMaterial.entryCount, " lượt ghi nhận)"), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: 14.5,
      fontWeight: 700
    }
  }, "Sản lượng Kéo trung theo mã nguyên liệu (A/B/C...)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, [["day", "Theo ngày"], ["week", "Theo tuần"], ["month", "Theo tháng"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setKeoTrungGranularity(k),
    className: "mes-btn",
    style: {
      fontSize: 12,
      padding: "6px 12px",
      borderColor: keoTrungGranularity === k ? COLORS.copper : COLORS.border,
      background: keoTrungGranularity === k ? `${COLORS.copper}22` : COLORS.bgPanel2,
      color: keoTrungGranularity === k ? COLORS.copperBright : COLORS.textDim
    }
  }, l)), /*#__PURE__*/React.createElement("button", {
    onClick: () => exportKeoTrungReport({
      keoTrungWireDay,
      keoTrungWireWeek,
      keoTrungWireMonth,
      keoTrungScrapDay,
      keoTrungScrapWeek,
      keoTrungScrapMonth
    }),
    className: "mes-btn",
    style: {
      fontSize: 12,
      padding: "6px 12px",
      borderColor: COLORS.green,
      background: `${COLORS.green}1c`,
      color: COLORS.green
    }
  }, /*#__PURE__*/React.createElement(FileSpreadsheet, {
    size: 13
  }), " Xuất Excel"))), keoTrungByMaterial.data.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: Gauge,
    title: "Chưa có dữ liệu sản lượng Kéo trung theo thời gian",
    hint: `Biểu đồ này lấy từ lượt nhập sản lượng thực tế ở trang Tổng quan (công đoạn "Kéo trung"). Hãy nhập sản lượng để dữ liệu hiện ở đây — theo ngày/tuần/tháng và tách theo mã liệu A/B/C...`
  }) : /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 300
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: keoTrungByMaterial.data
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: COLORS.border,
    vertical: false
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "label",
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: false,
    tickLine: false,
    unit: "kg"
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Legend, {
    wrapperStyle: {
      fontSize: 11.5
    }
  }), keoTrungByMaterial.materials.map((mat, i) => /*#__PURE__*/React.createElement(Bar, {
    key: mat,
    dataKey: mat,
    name: `Mã liệu ${mat}`,
    stackId: "mat",
    fill: PIE_COLORS[i % PIE_COLORS.length],
    radius: i === keoTrungByMaterial.materials.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
  })))), /*#__PURE__*/React.createElement(ProductionEntriesManager, {
    auditLog: auditLog,
    stageKey: "keo_trung",
    onEdit: onEditProductionEntry,
    onDelete: onDeleteProductionEntry
  }), keoTrungWireDay.data.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      borderTop: `1px solid ${COLORS.border}`,
      paddingTop: 4
    }
  }, /*#__PURE__*/React.createElement(KeoTrungSummaryTable, {
    title: "Bảng số liệu theo ngày",
    agg: keoTrungWireDay,
    colPrefix: "Mã "
  }), /*#__PURE__*/React.createElement(KeoTrungSummaryTable, {
    title: "Bảng số liệu theo tuần",
    agg: keoTrungWireWeek,
    colPrefix: "Mã "
  }), /*#__PURE__*/React.createElement(KeoTrungSummaryTable, {
    title: "Bảng số liệu theo tháng",
    agg: keoTrungWireMonth,
    colPrefix: "Mã "
  })), keoTrungScrapDay.data.length > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      borderTop: `1px solid ${COLORS.border}`,
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.red,
      textTransform: "uppercase",
      letterSpacing: ".03em",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Recycle, {
    size: 13,
    style: {
      marginRight: 4,
      verticalAlign: -2
    }
  }), "Phế liệu Kéo trung theo mã nguyên liệu (A/B/C) — ", fmtNum(keoTrungScrapDay.totalKg), " kg"), /*#__PURE__*/React.createElement(KeoTrungSummaryTable, {
    title: "Bảng số liệu theo ngày",
    agg: keoTrungScrapDay,
    colPrefix: "Mã "
  }), /*#__PURE__*/React.createElement(KeoTrungSummaryTable, {
    title: "Bảng số liệu theo tuần",
    agg: keoTrungScrapWeek,
    colPrefix: "Mã "
  }), /*#__PURE__*/React.createElement(KeoTrungSummaryTable, {
    title: "Bảng số liệu theo tháng",
    agg: keoTrungScrapMonth,
    colPrefix: "Mã "
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      borderTop: `1px solid ${COLORS.border}`,
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.red,
      textTransform: "uppercase",
      letterSpacing: ".03em",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Recycle, {
    size: 13,
    style: {
      marginRight: 4,
      verticalAlign: -2
    }
  }), "Phế liệu Kéo trung theo mã nguyên liệu (A/B/C)"), /*#__PURE__*/React.createElement(EmptyState, {
    icon: Recycle,
    title: "Chưa có dữ liệu phế liệu Kéo trung mang mã A/B/C",
    hint: `Vào "Chất lượng & Phế liệu → Ghi nhận phế liệu", chọn công đoạn Kéo trung và điền Mã liệu A/B/C để số liệu hiện ở đây.`
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Lịch sử sản lượng theo công đoạn (báo cáo tháng 6/2026)",
    eyebrow: `${timeseries.length} kỳ ghi nhận`,
    accent: COLORS.orange,
    height: 300
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: historicalData
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: COLORS.border,
    vertical: false
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "ky",
    tick: {
      fill: COLORS.textFaint,
      fontSize: 10.5
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false,
    interval: 2
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Legend, {
    wrapperStyle: {
      fontSize: 11.5
    }
  }), isStageVisible("keo_tinh") && /*#__PURE__*/React.createElement(Line, {
    type: "monotone",
    dataKey: "Kéo tinh",
    stroke: COLORS.copper,
    dot: false,
    strokeWidth: 2
  }), isStageVisible("u_nhiet") && /*#__PURE__*/React.createElement(Line, {
    type: "monotone",
    dataKey: "Ủ nhiệt",
    stroke: COLORS.blue,
    dot: false,
    strokeWidth: 2
  }), isStageVisible("ben") && /*#__PURE__*/React.createElement(Line, {
    type: "monotone",
    dataKey: "Bện",
    stroke: COLORS.green,
    dot: false,
    strokeWidth: 2
  }), isStageVisible("keo_trung") && /*#__PURE__*/React.createElement(Line, {
    type: "monotone",
    dataKey: "Kéo trung",
    stroke: COLORS.amber,
    dot: false,
    strokeWidth: 2
  }), isStageVisible("ma_thiec") && /*#__PURE__*/React.createElement(Line, {
    type: "monotone",
    dataKey: "Mạ thiếc",
    stroke: COLORS.violet,
    dot: false,
    strokeWidth: 2
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Xu hướng phế liệu theo ngày",
    eyebrow: `${scrap.length} lượt ghi nhận`,
    accent: COLORS.red
  }, scrapByDate.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: TrendingUp,
    title: "Chưa có đủ dữ liệu"
  }) : /*#__PURE__*/React.createElement(AreaChart, {
    data: scrapByDate
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: COLORS.border,
    vertical: false
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "date",
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fill: COLORS.textFaint,
      fontSize: 11
    },
    axisLine: false,
    tickLine: false
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Area, {
    type: "monotone",
    dataKey: "qty",
    stroke: COLORS.red,
    fill: `${COLORS.red}33`,
    strokeWidth: 2
  }))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Tình trạng máy móc thiết bị",
    eyebrow: `${machines.length} máy`,
    accent: "#0D9488"
  }, /*#__PURE__*/React.createElement(PieChart, null, /*#__PURE__*/React.createElement(Pie, {
    data: machineDist,
    dataKey: "value",
    nameKey: "name",
    cx: "50%",
    cy: "50%",
    outerRadius: 85,
    innerRadius: 48,
    paddingAngle: 2
  }, machineDist.map((d, i) => /*#__PURE__*/React.createElement(Cell, {
    key: i,
    fill: d.color
  }))), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Legend, {
    wrapperStyle: {
      fontSize: 12,
      color: COLORS.textDim
    }
  })))), (() => {
    const keoTrungTotalForStageData = (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === "keo_trung" && typeof a.qty === "number").reduce((a, e) => a + e.qty, 0);
    const stageData = visibleStages.map(s => {
      const production = s.key === "keo_trung" ? keoTrungTotalForStageData : orders.reduce((a, o) => a + (o.stages?.[s.key]?.done || 0), 0);
      const scrapForStage = scrap.filter(sc => sc.stage === s.key);
      const scrapQty = scrapForStage.reduce((a, sc) => a + (sc.qty || 0), 0);
      const pctScrap = production + scrapQty > 0 ? (scrapQty / (production + scrapQty) * 100).toFixed(2) : null;
      const scrapColor = pctScrap === null ? COLORS.textFaint : parseFloat(pctScrap) > 5 ? COLORS.red : parseFloat(pctScrap) > 2 ? COLORS.amber : COLORS.green;
      const scrapDailyMap = {};
      scrapForStage.forEach(sc => {
        scrapDailyMap[sc.date] = (scrapDailyMap[sc.date] || 0) + (sc.qty || 0);
      });
      const scrapDailyArr = Object.entries(scrapDailyMap).sort(([a], [b]) => new Date(a) - new Date(b)).map(([date, qty]) => ({
        date: fmtDate(date),
        qty
      }));
      const byCustomerMap = {};
      orders.forEach(o => {
        const done = o.stages?.[s.key]?.done || 0;
        if (done > 0) byCustomerMap[o.customer] = (byCustomerMap[o.customer] || 0) + done;
      });
      const byCustomer = Object.entries(byCustomerMap).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => b.value - a.value).slice(0, 10);
      return {
        stage: s,
        production,
        scrapQty,
        pctScrap,
        scrapColor,
        scrapDailyArr,
        byCustomer
      };
    }).filter(d => d.production > 0 || d.scrapQty > 0);
    if (stageData.length === 0) return null;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHeading, {
      eyebrow: "Chi tiết từng công đoạn",
      title: "Sản lượng & phế liệu theo từng công đoạn",
      icon: BarChart3,
      iconColor: COLORS.orange
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, stageData.map(({
      stage: s,
      production,
      scrapQty,
      pctScrap,
      scrapColor,
      scrapDailyArr,
      byCustomer
    }) => /*#__PURE__*/React.createElement("div", {
      key: s.key,
      className: "mes-card",
      style: {
        padding: 18,
        border: `1.5px solid ${s.color}55`,
        borderTop: `4px solid ${s.color}`,
        boxShadow: `0 2px 8px ${s.color}22`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "mes-mono",
      style: {
        fontSize: 11,
        color: COLORS.copper,
        letterSpacing: ".07em",
        textTransform: "uppercase",
        marginBottom: 3
      }
    }, "Công đoạn"), /*#__PURE__*/React.createElement("div", {
      className: "mes-display",
      style: {
        fontSize: 18,
        fontWeight: 700
      }
    }, s.label)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: COLORS.textFaint
      }
    }, "Sản lượng"), /*#__PURE__*/React.createElement("div", {
      className: "mes-mono",
      style: {
        fontWeight: 700,
        fontSize: 18,
        color: COLORS.green
      }
    }, fmtNum(production), " kg")), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: COLORS.textFaint
      }
    }, "Phế liệu"), /*#__PURE__*/React.createElement("div", {
      className: "mes-mono",
      style: {
        fontWeight: 700,
        fontSize: 18,
        color: COLORS.red
      }
    }, fmtNum(scrapQty), " kg")), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: COLORS.textFaint
      }
    }, "Tỷ lệ phế"), /*#__PURE__*/React.createElement("div", {
      className: "mes-mono",
      style: {
        fontWeight: 700,
        fontSize: 18,
        color: scrapColor
      }
    }, pctScrap !== null ? pctScrap + "%" : "—")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: COLORS.textDim,
        fontWeight: 600,
        marginBottom: 8
      }
    }, "Sản lượng theo khách hàng"), byCustomer.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
      icon: BarChart3,
      title: "Chưa có dữ liệu"
    }) : /*#__PURE__*/React.createElement(ResponsiveContainer, {
      width: "100%",
      height: Math.max(140, byCustomer.length * 30)
    }, /*#__PURE__*/React.createElement(BarChart, {
      data: byCustomer,
      layout: "vertical"
    }, /*#__PURE__*/React.createElement(CartesianGrid, {
      strokeDasharray: "3 3",
      stroke: COLORS.border,
      horizontal: false
    }), /*#__PURE__*/React.createElement(XAxis, {
      type: "number",
      tick: {
        fill: COLORS.textFaint,
        fontSize: 10
      },
      axisLine: {
        stroke: COLORS.border
      },
      tickLine: false
    }), /*#__PURE__*/React.createElement(YAxis, {
      type: "category",
      dataKey: "name",
      width: 90,
      tick: {
        fill: COLORS.text,
        fontSize: 11
      },
      axisLine: false,
      tickLine: false
    }), /*#__PURE__*/React.createElement(Tooltip, {
      contentStyle: {
        background: COLORS.bgPanel2,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        fontSize: 12
      }
    }), /*#__PURE__*/React.createElement(Bar, {
      dataKey: "value",
      fill: COLORS.copper,
      radius: [0, 4, 4, 0],
      name: "Sản lượng (kg)"
    })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: COLORS.textDim,
        fontWeight: 600,
        marginBottom: 8
      }
    }, "Xu hướng phế liệu theo ngày"), scrapDailyArr.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
      icon: Recycle,
      title: "Chưa có phế liệu",
      hint: `Vào Chất lượng & Phế liệu → Ghi nhận tại ${s.label}.`
    }) : /*#__PURE__*/React.createElement(ResponsiveContainer, {
      width: "100%",
      height: Math.max(140, byCustomer.length * 30)
    }, /*#__PURE__*/React.createElement(AreaChart, {
      data: scrapDailyArr
    }, /*#__PURE__*/React.createElement(CartesianGrid, {
      strokeDasharray: "3 3",
      stroke: COLORS.border,
      vertical: false
    }), /*#__PURE__*/React.createElement(XAxis, {
      dataKey: "date",
      tick: {
        fill: COLORS.textFaint,
        fontSize: 10
      },
      axisLine: {
        stroke: COLORS.border
      },
      tickLine: false
    }), /*#__PURE__*/React.createElement(YAxis, {
      tick: {
        fill: COLORS.textFaint,
        fontSize: 10
      },
      axisLine: false,
      tickLine: false
    }), /*#__PURE__*/React.createElement(Tooltip, {
      contentStyle: {
        background: COLORS.bgPanel2,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        fontSize: 12
      }
    }), /*#__PURE__*/React.createElement(Area, {
      type: "monotone",
      dataKey: "qty",
      stroke: COLORS.red,
      fill: `${COLORS.red}33`,
      strokeWidth: 2,
      name: "Phế liệu (kg)"
    })))))))));
  })());
}

