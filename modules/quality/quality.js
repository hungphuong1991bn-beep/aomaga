/* ===================== QC / SCRAP PAGE ===================== */
function ScrapAddModal({
  onClose,
  onSave,
  currentUser,
  orders,
  editRecord
}) {
  const isEdit = !!editRecord;
  const defaultStage = currentUser?.team && TEAM_STAGE_OPTIONS[currentUser.team]?.[0] || STAGES[0].key;
  const [form, setForm] = useState(() => editRecord ? {
    date: (editRecord.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    stage: editRecord.stage || defaultStage,
    spec: editRecord.spec || "",
    customer: editRecord.customer || "",
    materialCode: editRecord.materialCode || "",
    qty: editRecord.qty != null ? String(editRecord.qty) : "",
    unit: editRecord.unit || "kg",
    reason: editRecord.reason || ""
  } : {
    date: new Date().toISOString().slice(0, 10),
    stage: defaultStage,
    spec: "",
    customer: "",
    materialCode: "",
    qty: "",
    unit: "kg",
    reason: ""
  });
  const [orderId, setOrderId] = useState("");
  const customers = useMemo(() => [...new Set(orders.map(o => o.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders]);
  const specs = useMemo(() => [...new Set(orders.map(o => o.spec !== null && o.spec !== undefined ? String(o.spec) : "").filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders]);
  const materialCodes = useMemo(() => [...new Set(orders.map(o => o.materialCode).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders]);
  function pickOrder(id) {
    setOrderId(id);
    const o = orders.find(x => x.id === id);
    if (o) setForm(f => ({
      ...f,
      customer: o.customer || "",
      spec: o.spec !== null && o.spec !== undefined ? String(o.spec) : "",
      materialCode: o.materialCode || ""
    }));
  }
  function submit() {
    if (!form.qty || parseFloat(form.qty) <= 0) return;
    if (isEdit) {
      onSave({
        ...editRecord,
        ...form,
        qty: parseFloat(form.qty)
      });
    } else {
      onSave({
        ...form,
        id: uid("PL"),
        qty: parseFloat(form.qty),
        recordedBy: currentUser.username
      });
    }
    onClose();
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: isEdit ? "Sửa ghi nhận phế liệu" : "Ghi nhận phế liệu",
    onClose: onClose,
    width: 460
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Lấy nhanh từ đơn hàng có sẵn (tuỳ chọn)",
    hint: "Chọn để tự điền khách hàng, quy cách & mã liệu, hoặc bỏ qua để tự nhập tay."
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: orderId,
    onChange: e => pickOrder(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— Tự nhập tay —"), orders.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.id,
    value: o.id
  }, o.customer, " · ", o.spec)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Ngày"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "date",
    value: form.date,
    onChange: e => setForm(f => ({
      ...f,
      date: e.target.value
    }))
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Công đoạn"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: form.stage,
    onChange: e => setForm(f => ({
      ...f,
      stage: e.target.value
    }))
  }, STAGES.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.key,
    value: s.key
  }, s.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Khách hàng / Đơn hàng"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    list: "mes-scrap-customers",
    value: form.customer,
    onChange: e => {
      setOrderId("");
      setForm(f => ({
        ...f,
        customer: e.target.value
      }));
    },
    placeholder: "Chọn hoặc nhập tên khách hàng"
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "mes-scrap-customers"
  }, customers.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  })))), /*#__PURE__*/React.createElement(Field, {
    label: "Quy cách"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    list: "mes-scrap-specs",
    value: form.spec,
    onChange: e => {
      setOrderId("");
      setForm(f => ({
        ...f,
        spec: e.target.value
      }));
    },
    placeholder: "Chọn hoặc nhập quy cách"
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "mes-scrap-specs"
  }, specs.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  })))), /*#__PURE__*/React.createElement(Field, {
    label: "Mã liệu (A/B/C)"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: form.materialCode,
    onChange: e => {
      setOrderId("");
      setForm(f => ({
        ...f,
        materialCode: e.target.value
      }));
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— Chọn mã liệu —"), ["A", "B", "C"].map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m)))), /*#__PURE__*/React.createElement(Field, {
    label: "Khối lượng phế liệu"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "number",
    min: "0",
    step: "0.1",
    value: form.qty,
    onChange: e => setForm(f => ({
      ...f,
      qty: e.target.value
    }))
  }), /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    style: {
      width: 70
    },
    value: form.unit,
    onChange: e => setForm(f => ({
      ...f,
      unit: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: "kg"
  }, "kg"), /*#__PURE__*/React.createElement("option", {
    value: "m"
  }, "m"), /*#__PURE__*/React.createElement("option", {
    value: "cuộn"
  }, "cuộn"))))), /*#__PURE__*/React.createElement(Field, {
    label: "Nguyên nhân"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 8
    }
  }, [{
    label: "Lỗi Con Người",
    match: "con người",
    color: COLORS.blue
  }, {
    label: "Lỗi do máy",
    match: "máy",
    color: COLORS.orange
  }].map(col => /*#__PURE__*/React.createElement("div", {
    key: col.label
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      fontWeight: 700,
      color: col.color,
      textTransform: "uppercase",
      letterSpacing: ".03em",
      marginBottom: 6
    }
  }, col.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, SCRAP_REASONS.filter(r => {
    const hasHuman = r.source.includes("con người");
    const hasMachine = r.source.includes("máy");
    if (!hasHuman && !hasMachine) return true; // nguyên nhân do vật liệu/quy trình -> hiện ở cả 2 cột
    return col.match === "con người" ? hasHuman : hasMachine;
  }).map(r => /*#__PURE__*/React.createElement("button", {
    key: r.name,
    type: "button",
    title: `${r.cause} (${r.source})`,
    onClick: () => setForm(f => ({
      ...f,
      reason: `${r.name} (${col.label}) — ${r.cause}`
    })),
    style: {
      fontSize: FZ(12),
      padding: "5px 10px",
      borderRadius: 999,
      cursor: "pointer",
      border: form.reason.startsWith(r.name) ? `1px solid ${COLORS.copper}` : `1px solid ${COLORS.borderLight}`,
      background: form.reason.startsWith(r.name) ? `${COLORS.copper}20` : COLORS.bgPanel2,
      color: form.reason.startsWith(r.name) ? COLORS.copperBright : COLORS.textDim,
      fontWeight: form.reason.startsWith(r.name) ? 700 : 500
    }
  }, r.name)))))), /*#__PURE__*/React.createElement("textarea", {
    className: "mes-input",
    rows: 2,
    value: form.reason,
    onChange: e => setForm(f => ({
      ...f,
      reason: e.target.value
    })),
    placeholder: "Chọn nhanh phía trên, hoặc gõ nguyên nhân khác tại đây..."
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: submit,
    style: {
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), isEdit ? " Lưu thay đổi" : " Lưu ghi nhận"));
}
function QCPage({
  scrap,
  isAdmin,
  currentUser,
  onAdd,
  onUpdate,
  onDelete,
  orders,
  auditLog
}) {
  const {
    askConfirm
  } = useDialog();
  const [showAdd, setShowAdd] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [exportPeriod, setExportPeriod] = useState("day");
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));
  function getExportRange() {
    const ref = new Date(exportDate + "T00:00:00");
    let start, end, label;
    if (exportPeriod === "day") {
      start = new Date(ref);
      end = new Date(ref);
      label = `Ngày ${fmtDate(exportDate)}`;
    } else if (exportPeriod === "week") {
      const day = ref.getDay() || 7; // Chủ nhật=0 -> coi là ngày 7 trong tuần
      start = new Date(ref);
      start.setDate(ref.getDate() - day + 1); // Thứ 2 đầu tuần
      end = new Date(start);
      end.setDate(start.getDate() + 6); // Chủ nhật cuối tuần
      label = `Tuần ${fmtDate(start.toISOString().slice(0, 10))} - ${fmtDate(end.toISOString().slice(0, 10))}`;
    } else {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      label = `Tháng ${ref.getMonth() + 1}/${ref.getFullYear()}`;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label
    };
  }
  function handleExportScrapRate() {
    const {
      start,
      end,
      label
    } = getExportRange();
    const inRange = d => {
      const t = new Date(d).getTime();
      return !isNaN(t) && t >= start.getTime() && t <= end.getTime();
    };
    const prodByStage = {};
    (auditLog || []).forEach(a => {
      if (a.type === "production_entry" && a.date && typeof a.qty === "number" && inRange(a.date)) {
        prodByStage[a.stageKey] = (prodByStage[a.stageKey] || 0) + a.qty;
      }
    });
    const scrapByStageRange = {};
    scrap.forEach(s => {
      if (s.date && inRange(s.date)) {
        scrapByStageRange[s.stage] = (scrapByStageRange[s.stage] || 0) + (s.qty || 0);
      }
    });
    const rows = STAGES.map(s => {
      const production = prodByStage[s.key] || 0;
      const scrapQty = scrapByStageRange[s.key] || 0;
      const pct = production + scrapQty > 0 ? scrapQty / (production + scrapQty) * 100 : 0;
      return {
        "Công đoạn": s.label,
        "Sản lượng (kg)": production,
        "Phế liệu (kg)": scrapQty,
        "Tỷ lệ phế liệu (%)": Number(pct.toFixed(2))
      };
    });
    const totalProd = rows.reduce((a, r) => a + r["Sản lượng (kg)"], 0);
    const totalScrap = rows.reduce((a, r) => a + r["Phế liệu (kg)"], 0);
    rows.push({
      "Công đoạn": "TỔNG CỘNG",
      "Sản lượng (kg)": totalProd,
      "Phế liệu (kg)": totalScrap,
      "Tỷ lệ phế liệu (%)": Number((totalProd + totalScrap > 0 ? totalScrap / (totalProd + totalScrap) * 100 : 0).toFixed(2))
    });
    if (!window.XLSX) {
      alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{
      wch: 20
    }, {
      wch: 16
    }, {
      wch: 16
    }, {
      wch: 18
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ty le phe lieu");
    XLSX.writeFile(wb, `ty_le_phe_lieu_${exportPeriod}_${exportDate}.xlsx`);
  }
  const byStage = useMemo(() => {
    const m = {};
    STAGES.forEach(s => m[s.key] = 0);
    scrap.forEach(s => {
      m[s.stage] = (m[s.stage] || 0) + (s.qty || 0);
    });
    return STAGES.map(s => ({
      name: s.short,
      value: m[s.key] || 0
    }));
  }, [scrap]);
  const byStageDetailed = useMemo(() => {
    const scrapByStage = {};
    scrap.forEach(s => {
      scrapByStage[s.stage] = (scrapByStage[s.stage] || 0) + (s.qty || 0);
    });
    // Kéo trung: sản lượng thực tế = tổng mọi lượt nhập tại Kéo trung (kể cả phôi
    // không gắn khách hàng cụ thể) — lấy từ audit log, không chỉ cộng theo đơn hàng,
    // vì phôi không gắn đơn sẽ không nằm trong stages.keo_trung.done của order nào cả.
    const keoTrungTotal = (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === "keo_trung" && typeof a.qty === "number").reduce((a, e) => a + e.qty, 0);
    return STAGES.map(s => {
      const production = s.key === "keo_trung" ? keoTrungTotal : (orders || []).reduce((a, o) => a + (o.stages?.[s.key]?.done || 0), 0);
      const scrapQty = scrapByStage[s.key] || 0;
      const pct = production + scrapQty > 0 ? scrapQty / (production + scrapQty) * 100 : null;
      return {
        key: s.key,
        label: s.label,
        production,
        scrapQty,
        pct
      };
    });
  }, [scrap, orders, auditLog]);
  const total = scrap.reduce((a, s) => a + (s.qty || 0), 0);
  // % phế liệu tương đương trên tổng sản lượng — tính theo thời gian thực từ dữ liệu hiện có
  const totalProductionAllStages = byStageDetailed.reduce((a, r) => a + r.production, 0);
  const totalScrapPct = totalProductionAllStages + total > 0 ? total / (totalProductionAllStages + total) * 100 : null;
  const scrapPctColor = totalScrapPct === null ? COLORS.textFaint : totalScrapPct > 5 ? COLORS.red : totalScrapPct > 2 ? COLORS.amber : COLORS.green;
  // Phế liệu theo Mã NVL (A/B/C...) tổng hợp theo ngày — bảng chéo Ngày × Mã liệu
  const byMaterialAndDate = useMemo(() => {
    const materials = [...new Set(scrap.map(s => s.materialCode || "Khác"))].sort((a, b) => a.localeCompare(b));
    const dateMap = {};
    scrap.forEach(s => {
      const mat = s.materialCode || "Khác";
      const d = s.date || "—";
      if (!dateMap[d]) dateMap[d] = { total: 0 };
      dateMap[d][mat] = (dateMap[d][mat] || 0) + (s.qty || 0);
      dateMap[d].total += s.qty || 0;
    });
    const rows = Object.entries(dateMap).map(([date, vals]) => ({
      date,
      ...vals
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
    const byMaterialTotals = {};
    materials.forEach(m => {
      byMaterialTotals[m] = scrap.filter(s => (s.materialCode || "Khác") === m).reduce((a, s) => a + (s.qty || 0), 0);
    });
    return {
      materials,
      rows,
      byMaterialTotals
    };
  }, [scrap]);
  const sorted = [...scrap].sort((a, b) => new Date(b.date) - new Date(a.date));
  const [scrapExportPeriod, setScrapExportPeriod] = useState("all");
  const [scrapExportDate, setScrapExportDate] = useState(() => new Date().toISOString().slice(0, 10));
  function scrapInSelectedRange(dateStr) {
    if (scrapExportPeriod === "all") return true;
    if (!dateStr) return false;
    if (scrapExportPeriod === "day") return dateStr.slice(0, 10) === scrapExportDate;
    if (scrapExportPeriod === "month") return dateStr.slice(0, 7) === scrapExportDate.slice(0, 7);
    return true;
  }
  const [scrapExportSource, setScrapExportSource] = useState("all");
  function scrapMatchesSource(reason) {
    if (scrapExportSource === "all") return true;
    const r = reason || "";
    if (scrapExportSource === "human") return r.includes("Lỗi Con Người") || r.includes("Con Người");
    if (scrapExportSource === "machine") return r.includes("Lỗi do máy") || r.includes("do máy");
    return true;
  }
  function handleExportByMaterial() {
    if (!window.XLSX) {
      alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại.");
      return;
    }
    const filteredRows = byMaterialAndDate.rows.filter(r => scrapInSelectedRange(r.date));
    const rows = filteredRows.map(r => {
      const row = {
        "Ngày": fmtDate(r.date)
      };
      byMaterialAndDate.materials.forEach(m => {
        row[`Mã ${m} (kg)`] = r[m] || 0;
      });
      row["Tổng ngày (kg)"] = r.total;
      return row;
    });
    const totalRow = {
      "Ngày": "Tổng cộng"
    };
    byMaterialAndDate.materials.forEach(m => {
      totalRow[`Mã ${m} (kg)`] = filteredRows.reduce((a, r) => a + (r[m] || 0), 0);
    });
    totalRow["Tổng ngày (kg)"] = filteredRows.reduce((a, r) => a + r.total, 0);
    rows.push(totalRow);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phe lieu theo ma NVL");
    const suffix = scrapExportPeriod === "day" ? scrapExportDate : scrapExportPeriod === "month" ? scrapExportDate.slice(0, 7) : "tat_ca";
    XLSX.writeFile(wb, `phe_lieu_theo_ma_nvl_${suffix}.xlsx`);
  }
  function handleExportScrapList() {
    if (!window.XLSX) {
      alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại.");
      return;
    }
    const rows = sorted.filter(s => scrapInSelectedRange(s.date) && scrapMatchesSource(s.reason)).map(s => {
      const stageInfo = STAGES.find(x => x.key === s.stage);
      return {
        "Ngày": fmtDate(s.date),
        "Công đoạn": stageInfo ? stageInfo.label : s.stage,
        "Khách hàng": s.customer || "",
        "Quy cách": s.spec || "",
        "Mã liệu": s.materialCode || "",
        "Khối lượng (kg)": s.qty || 0,
        "Nguyên nhân": s.reason || "",
        "Người ghi": s.recordedBy || ""
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{
      wch: 12
    }, {
      wch: 14
    }, {
      wch: 20
    }, {
      wch: 14
    }, {
      wch: 10
    }, {
      wch: 14
    }, {
      wch: 45
    }, {
      wch: 14
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sach phe lieu");
    const suffix = scrapExportPeriod === "day" ? scrapExportDate : scrapExportPeriod === "month" ? scrapExportDate.slice(0, 7) : "tat_ca";
    const sourceSuffix = scrapExportSource === "human" ? "_do_nguoi" : scrapExportSource === "machine" ? "_do_may" : "";
    XLSX.writeFile(wb, `danh_sach_phe_lieu_${suffix}${sourceSuffix}.xlsx`);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Kiểm soát chất lượng",
    title: "Phế liệu & chất lượng sản phẩm",
    icon: Recycle,
    iconColor: COLORS.red,
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setShowAdd(true)
    }, /*#__PURE__*/React.createElement(Plus, {
      size: 14
    }), " Ghi nhận phế liệu")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 18,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: Recycle,
    label: "Tổng phế liệu",
    value: `${fmtNum(total)} kg`,
    sub: /*#__PURE__*/React.createElement(React.Fragment, null, `${scrap.length} lượt ghi nhận`, " · ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: scrapPctColor,
        fontWeight: 800
      }
    }, totalScrapPct !== null ? totalScrapPct.toFixed(2) + "%" : "—"), " phế liệu tương đương"),
    accent: COLORS.red
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 16,
      flex: 2,
      minWidth: 320,
      height: 130,
      border: `1px solid ${COLORS.violet}55`,
      borderTop: `4px solid ${COLORS.violet}`,
      boxShadow: `0 2px 8px ${COLORS.violet}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: COLORS.textDim,
      fontWeight: 600,
      marginBottom: 6,
      textTransform: "uppercase"
    }
  }, "Phế liệu theo công đoạn"), /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 90
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: byStage
  }, /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "name",
    tick: {
      fill: COLORS.textFaint,
      fontSize: FZ(12)
    },
    axisLine: {
      stroke: COLORS.border
    },
    tickLine: false
  }), /*#__PURE__*/React.createElement(YAxis, {
    hide: true
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: COLORS.bgPanel2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      fontSize: FZ(12)
    }
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "value",
    fill: COLORS.red,
    radius: [4, 4, 0, 0]
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      marginBottom: 14,
      padding: 14,
      display: "flex",
      alignItems: "flex-end",
      gap: 10,
      flexWrap: "wrap",
      border: `1px solid ${COLORS.green}55`,
      borderTop: `4px solid ${COLORS.green}`
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Kỳ báo cáo"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: exportPeriod,
    onChange: e => setExportPeriod(e.target.value),
    style: {
      width: 130
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "day"
  }, "Theo ngày"), /*#__PURE__*/React.createElement("option", {
    value: "week"
  }, "Theo tuần"), /*#__PURE__*/React.createElement("option", {
    value: "month"
  }, "Theo tháng"))), /*#__PURE__*/React.createElement(Field, {
    label: exportPeriod === "month" ? "Chọn tháng (ngày bất kỳ trong tháng)" : exportPeriod === "week" ? "Chọn ngày trong tuần" : "Chọn ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: exportDate,
    onChange: e => setExportDate(e.target.value),
    style: {
      width: 170
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: handleExportScrapRate,
    style: {
      background: `linear-gradient(135deg, ${COLORS.green}, #0F7A38)`
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 14
  }), " Xuất Excel tỷ lệ phế liệu"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: COLORS.textFaint,
      marginBottom: 8
    }
  }, getExportRange().label)), /*#__PURE__*/React.createElement("div", {
    className: "mes-card mes-scroll-x",
    style: {
      marginBottom: 18,
      border: `1px solid ${COLORS.blue}55`,
      borderTop: `4px solid ${COLORS.blue}`,
      boxShadow: `0 2px 8px ${COLORS.blue}22`
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Công đoạn"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Sản lượng (kg)"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Phế liệu (kg)"), /*#__PURE__*/React.createElement("th", null, "Tỷ lệ phế liệu"))), /*#__PURE__*/React.createElement("tbody", null, (() => {
    const renderStageRow = (r, isSubtotal) => /*#__PURE__*/React.createElement("tr", {
      key: r.key,
      style: isSubtotal ? {
        background: COLORS.bgInset,
        borderTop: `1px solid ${COLORS.copper}55`,
        borderBottom: `1px solid ${COLORS.copper}55`
      } : undefined
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        fontWeight: isSubtotal ? 700 : 600,
        color: isSubtotal ? COLORS.copperBright : COLORS.text
      }
    }, r.label), /*#__PURE__*/React.createElement("td", {
      className: "mes-mono",
      style: {
        textAlign: "right",
        fontWeight: isSubtotal ? 700 : 400
      }
    }, fmtNum(r.production)), /*#__PURE__*/React.createElement("td", {
      className: "mes-mono",
      style: {
        textAlign: "right",
        fontWeight: isSubtotal ? 700 : 400,
        color: r.scrapQty > 0 ? COLORS.red : COLORS.textFaint
      }
    }, fmtNum(r.scrapQty)), /*#__PURE__*/React.createElement("td", {
      style: {
        width: 220
      }
    }, r.pct === null ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.textFaint
      }
    }, "—") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(ProgressBar, {
      pct: Math.min(100, r.pct),
      color: r.pct > 5 ? COLORS.red : r.pct > 2 ? COLORS.amber : COLORS.green
    }), /*#__PURE__*/React.createElement("span", {
      className: "mes-mono",
      style: {
        fontSize: FZ(13),
        fontWeight: 700,
        color: r.pct > 5 ? COLORS.red : r.pct > 2 ? COLORS.amber : COLORS.green,
        flexShrink: 0
      }
    }, r.pct.toFixed(2), "%"))));
    return byStageDetailed.flatMap(r => {
      const row = renderStageRow(r, false);
      if (r.key !== "keo_sieu_tinh") return [row];
      // Chèn dòng tổng hợp riêng cho 3 khâu Kéo trung + Kéo tinh + Kéo siêu tinh
      const keoStages = byStageDetailed.filter(x => ["keo_trung", "keo_tinh", "keo_sieu_tinh"].includes(x.key));
      const subProd = keoStages.reduce((a, x) => a + x.production, 0);
      const subScrap = keoStages.reduce((a, x) => a + x.scrapQty, 0);
      const subPct = subProd + subScrap > 0 ? subScrap / (subProd + subScrap) * 100 : null;
      const subtotalRow = renderStageRow({
        key: "subtotal-keo",
        label: "Tổng 3 khâu Kéo (Trung + Tinh + Siêu tinh)",
        production: subProd,
        scrapQty: subScrap,
        pct: subPct
      }, true);
      return [row, subtotalRow];
    });
  })()), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 700,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, "Tổng cộng"), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, fmtNum(byStageDetailed.reduce((a, r) => a + r.production, 0))), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      color: COLORS.red,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, fmtNum(byStageDetailed.reduce((a, r) => a + r.scrapQty, 0))), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      fontWeight: 800,
      color: COLORS.copperBright,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, (() => {
    const totalProd = byStageDetailed.reduce((a, r) => a + r.production, 0);
    const totalScrap = byStageDetailed.reduce((a, r) => a + r.scrapQty, 0);
    return totalProd + totalScrap > 0 ? `${(totalScrap / (totalProd + totalScrap) * 100).toFixed(2)}%` : "—";
  })()))))), byMaterialAndDate.materials.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mes-card mes-scroll-x",
    style: {
      marginBottom: 18,
      padding: 18,
      border: `1px solid ${COLORS.orange}55`,
      borderTop: `4px solid ${COLORS.orange}`,
      boxShadow: `0 2px 8px ${COLORS.orange}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: FZ(15),
      fontWeight: 700
    }
  }, "Phế liệu theo Mã NVL — tổng hợp theo ngày"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: scrapExportPeriod,
    onChange: e => setScrapExportPeriod(e.target.value),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 110
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tất cả"), /*#__PURE__*/React.createElement("option", {
    value: "day"
  }, "Theo ngày"), /*#__PURE__*/React.createElement("option", {
    value: "month"
  }, "Theo tháng")), scrapExportPeriod === "day" && /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: scrapExportDate,
    onChange: e => setScrapExportDate(e.target.value),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 140
    }
  }), scrapExportPeriod === "month" && /*#__PURE__*/React.createElement("input", {
    type: "month",
    className: "mes-input",
    value: scrapExportDate.slice(0, 7),
    onChange: e => setScrapExportDate(e.target.value + "-01"),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 130
    }
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: handleExportByMaterial,
    style: {
      fontSize: FZ(13),
      padding: "6px 10px"
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 13
  }), " Xuất Excel"), byMaterialAndDate.materials.map(m => /*#__PURE__*/React.createElement(Badge, {
    key: m,
    color: m === "Khác" ? COLORS.textFaint : COLORS.copper
  }, "Mã ", m, ": ", fmtNum(byMaterialAndDate.byMaterialTotals[m]), " kg")))), /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ngày"), byMaterialAndDate.materials.map(m => /*#__PURE__*/React.createElement("th", {
    key: m,
    style: {
      textAlign: "right"
    }
  }, "Mã ", m, " (kg)")), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Tổng ngày (kg)"))), /*#__PURE__*/React.createElement("tbody", null, byMaterialAndDate.rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.date
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      fontWeight: 600
    }
  }, fmtDate(r.date)), byMaterialAndDate.materials.map(m => /*#__PURE__*/React.createElement("td", {
    key: m,
    className: "mes-mono",
    style: {
      textAlign: "right",
      color: r[m] ? COLORS.red : COLORS.textFaint
    }
  }, r[m] ? fmtNum(r[m]) : "—")), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      color: COLORS.copperBright
    }
  }, fmtNum(r.total))))), /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 700,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, "Tổng cộng"), byMaterialAndDate.materials.map(m => /*#__PURE__*/React.createElement("td", {
    key: m,
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, fmtNum(byMaterialAndDate.byMaterialTotals[m]))), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 800,
      color: COLORS.copperBright,
      borderTop: `2px solid ${COLORS.border}`
    }
  }, fmtNum(total)))))), /*#__PURE__*/React.createElement("div", {
    className: "mes-card mes-scroll-x",
    style: {
      border: `1px solid #0D948855`,
      borderTop: `4px solid #0D9488`,
      boxShadow: `0 2px 8px #0D948822`
    }
  }, sorted.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 18px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: FZ(15),
      fontWeight: 700
    }
  }, "Danh sách ghi nhận phế liệu"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: scrapExportPeriod,
    onChange: e => setScrapExportPeriod(e.target.value),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 110
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tất cả"), /*#__PURE__*/React.createElement("option", {
    value: "day"
  }, "Theo ngày"), /*#__PURE__*/React.createElement("option", {
    value: "month"
  }, "Theo tháng")), scrapExportPeriod === "day" && /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: scrapExportDate,
    onChange: e => setScrapExportDate(e.target.value),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 140
    }
  }), scrapExportPeriod === "month" && /*#__PURE__*/React.createElement("input", {
    type: "month",
    className: "mes-input",
    value: scrapExportDate.slice(0, 7),
    onChange: e => setScrapExportDate(e.target.value + "-01"),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 130
    }
  }), /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: scrapExportSource,
    onChange: e => setScrapExportSource(e.target.value),
    style: {
      fontSize: FZ(13),
      padding: "6px 8px",
      width: 140
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tất cả loại lỗi"), /*#__PURE__*/React.createElement("option", {
    value: "human"
  }, "Do con người"), /*#__PURE__*/React.createElement("option", {
    value: "machine"
  }, "Do máy")), /*#__PURE__*/React.createElement(Button, {
    onClick: handleExportScrapList,
    style: {
      fontSize: FZ(13),
      padding: "6px 10px"
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 13
  }), " Xuất Excel"))), sorted.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: FlaskConical,
    title: "Chưa có dữ liệu phế liệu"
  }) : /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ngày"), /*#__PURE__*/React.createElement("th", null, "Công đoạn"), /*#__PURE__*/React.createElement("th", null, "Khách hàng"), /*#__PURE__*/React.createElement("th", null, "Quy cách"), /*#__PURE__*/React.createElement("th", null, "Mã liệu"), /*#__PURE__*/React.createElement("th", null, "Khối lượng"), /*#__PURE__*/React.createElement("th", null, "Nguyên nhân"), /*#__PURE__*/React.createElement("th", null, "Người ghi"), isAdmin && /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, sorted.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, fmtDate(s.date)), /*#__PURE__*/React.createElement("td", null, STAGE_MAP[s.stage]?.label || s.stage), /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 600
    }
  }, s.customer || "—"), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, s.spec || "—"), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, s.materialCode || "—"), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      color: COLORS.red
    }
  }, fmtNum(s.qty), " ", s.unit), /*#__PURE__*/React.createElement("td", {
    style: {
      color: COLORS.textDim,
      maxWidth: 220
    }
  }, s.reason || "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      color: COLORS.textFaint,
      fontSize: FZ(12)
    }
  }, s.recordedBy), isAdmin && /*#__PURE__*/React.createElement("td", {
    style: {
      display: "flex",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: Pencil,
    onClick: () => setEditingRecord(s),
    title: "Sửa"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: Trash2,
    danger: true,
    onClick: async () => {
      if (await askConfirm("Xóa ghi nhận phế liệu này?", {
        danger: true,
        confirmLabel: "Xóa"
      })) onDelete(s.id);
    },
    title: "Xóa"
  }))))))), showAdd && /*#__PURE__*/React.createElement(ScrapAddModal, {
    currentUser: currentUser,
    orders: orders,
    onClose: () => setShowAdd(false),
    onSave: onAdd
  }), editingRecord && /*#__PURE__*/React.createElement(ScrapAddModal, {
    currentUser: currentUser,
    orders: orders,
    editRecord: editingRecord,
    onClose: () => setEditingRecord(null),
    onSave: onUpdate
  }));
}

