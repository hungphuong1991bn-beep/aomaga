/* ===================== STAFF PAGE ===================== */
function stripAccents(str) {
  return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normHeader(h) {
  return stripAccents(h).toLowerCase().replace(/[^a-z0-9]/g, "");
}
function aggToSheetRows(agg, colPrefix) {
  const rows = agg.data.map(r => {
    const row = {
      "Thời gian": r.label
    };
    agg.materials.forEach(m => {
      row[`${colPrefix}${m}`] = r[m] || 0;
    });
    row["Tổng cộng (kg)"] = r.total;
    return row;
  });
  const totalRow = {
    "Thời gian": "Tổng cộng"
  };
  agg.materials.forEach(m => {
    totalRow[`${colPrefix}${m}`] = agg.data.reduce((a, r) => a + (r[m] || 0), 0);
  });
  totalRow["Tổng cộng (kg)"] = agg.totalKg;
  rows.push(totalRow);
  return rows;
}
function exportKeoTrungReport({
  keoTrungWireDay,
  keoTrungWireWeek,
  keoTrungWireMonth,
  keoTrungScrapDay,
  keoTrungScrapWeek,
  keoTrungScrapMonth
}) {
  const wb = XLSX.utils.book_new();
  const addSheet = (name, agg, prefix) => {
    if (!agg.data.length) return;
    const ws = XLSX.utils.json_to_sheet(aggToSheetRows(agg, prefix));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  addSheet("SL theo ngay", keoTrungWireDay, "Ma ");
  addSheet("SL theo tuan", keoTrungWireWeek, "Ma ");
  addSheet("SL theo thang", keoTrungWireMonth, "Ma ");
  addSheet("Phe lieu theo ngay", keoTrungScrapDay, "Ma ");
  addSheet("Phe lieu theo tuan", keoTrungScrapWeek, "Ma ");
  addSheet("Phe lieu theo thang", keoTrungScrapMonth, "Ma ");
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["Chưa có dữ liệu để xuất"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Trống");
  }
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bao_cao_keo_trung_${today}.xlsx`);
}
function downloadStaffTemplate() {
  const wsData = [["Mã NV", "Họ và tên", "Tổ sản xuất", "Tình trạng"], ["D-AMG001", "Nguyễn Văn A", "KÉO", "Đang làm"], ["D-AMG002", "Trần Thị B", "Ủ NHIỆT", "Đang làm"]];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{
    wch: 14
  }, {
    wch: 22
  }, {
    wch: 14
  }, {
    wch: 12
  }];
  const wsTeams = XLSX.utils.aoa_to_sheet([["Danh sách tổ hợp lệ"], ...TEAMS.map(t => [t])]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Nhân viên");
  XLSX.utils.book_append_sheet(wb, wsTeams, "Danh sách tổ");
  XLSX.writeFile(wb, "mau_danh_sach_nhan_vien.xlsx");
}
function StaffImportModal({
  onClose,
  onImport,
  existingStaff
}) {
  const [parsed, setParsed] = useState(null);
  const [mode, setMode] = useState("merge");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setParsed(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {
        type: "array"
      });
      const sheetName = wb.SheetNames.find(n => normHeader(n).includes("nhanvien")) || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
      });
      if (raw.length === 0) {
        setError("File không có dữ liệu hoặc sai định dạng.");
        setBusy(false);
        return;
      }
      const sampleKeys = Object.keys(raw[0]);
      const keyMap = {};
      sampleKeys.forEach(k => {
        const n = normHeader(k);
        if (!keyMap.code && /^ma/.test(n)) keyMap.code = k;else if (!keyMap.name && /(hoten|hovaten|^ten)/.test(n)) keyMap.name = k;else if (!keyMap.team && /^to/.test(n)) keyMap.team = k;else if (!keyMap.shift && /^ca/.test(n)) keyMap.shift = k;else if (!keyMap.status && /trang/.test(n)) keyMap.status = k;
      });
      if (!keyMap.name) {
        setError('Không tìm thấy cột "Họ và tên" trong file. Vui lòng dùng đúng file mẫu (bấm "Tải file mẫu" bên dưới).');
        setBusy(false);
        return;
      }
      const rows = raw.map(r => {
        const name = String(r[keyMap.name] || "").trim();
        const teamRaw = stripAccents(String(r[keyMap.team] || "").trim()).toUpperCase();
        const team = TEAMS.find(t => stripAccents(t).toUpperCase() === teamRaw) || TEAMS.find(t => teamRaw && stripAccents(t).toUpperCase().includes(teamRaw)) || TEAMS[0];
        const shiftRaw = stripAccents(String(r[keyMap.shift] || "")).toLowerCase();
        const shift = shiftRaw.includes("dem") ? "Ca đêm" : "Ca ngày";
        const statusRaw = stripAccents(String(r[keyMap.status] || "")).toLowerCase();
        let status = "Đang làm";
        if (statusRaw.includes("phep")) status = "Nghỉ phép";else if (statusRaw.includes("nghi") || statusRaw.includes("thoi")) status = "Đã nghỉ";
        const code = String(r[keyMap.code] || "").trim() || uid("NV");
        return {
          code,
          name,
          team,
          shift,
          status
        };
      }).filter(r => r.name);
      if (rows.length === 0) {
        setError("Không đọc được dòng nhân viên hợp lệ nào (cần có Họ và tên).");
        setBusy(false);
        return;
      }
      setParsed({
        rows,
        fileName: file.name,
        missingCols: ["code", "team", "shift", "status"].filter(k => !keyMap[k])
      });
    } catch (err) {
      setError("Không đọc được file. Hãy chắc chắn đây là file Excel (.xlsx/.xls) hợp lệ.");
    } finally {
      setBusy(false);
    }
  }
  const updateCount = parsed ? parsed.rows.filter(r => existingStaff.some(s => s.code === r.code)).length : 0;
  const newCount = parsed ? parsed.rows.length - updateCount : 0;
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Tải lên danh sách nhân viên từ file Excel",
    onClose: onClose,
    width: 620
  }, !parsed ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1.5px dashed ${COLORS.border}`,
      borderRadius: 10,
      padding: "28px 18px",
      textAlign: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(FileSpreadsheet, {
    size: 28,
    color: COLORS.copper,
    style: {
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13),
      color: COLORS.textDim,
      marginBottom: 12
    }
  }, "Chọn file Excel (.xlsx) danh sách nhân viên tháng này"), /*#__PURE__*/React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    style: {
      display: "none"
    },
    onChange: handleFile
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => fileInputRef.current?.click(),
    disabled: busy
  }, busy ? /*#__PURE__*/React.createElement(Loader2, {
    size: 14,
    className: "pulse-dot"
  }) : /*#__PURE__*/React.createElement(Upload, {
    size: 14
  }), " Chọn file")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.red,
      fontSize: FZ(13),
      marginBottom: 12
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: COLORS.textFaint,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", null, "File cần có cột: ", /*#__PURE__*/React.createElement("b", null, "Mã NV, Họ và tên, Tổ sản xuất, Tình trạng"), " (không phân biệt thứ tự cột)."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: downloadStaffTemplate,
    className: "mes-btn mes-btn-ghost",
    style: {
      fontSize: FZ(12),
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 13
  }), " Tải file mẫu"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: COLORS.blue
  }, parsed.rows.length, " dòng đọc được"), /*#__PURE__*/React.createElement(Badge, {
    color: COLORS.green
  }, newCount, " nhân viên mới"), /*#__PURE__*/React.createElement(Badge, {
    color: COLORS.amber
  }, updateCount, " sẽ cập nhật (trùng mã NV)")), parsed.missingCols.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: COLORS.amber,
      marginBottom: 10
    }
  }, "Lưu ý: không tìm thấy cột ", parsed.missingCols.join(", "), " trong file — các dòng thiếu sẽ dùng giá trị mặc định."), /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x",
    style: {
      maxHeight: 280,
      overflowY: "auto",
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Mã NV"), /*#__PURE__*/React.createElement("th", null, "Họ và tên"), /*#__PURE__*/React.createElement("th", null, "Tổ"), /*#__PURE__*/React.createElement("th", null, "Tình trạng"))), /*#__PURE__*/React.createElement("tbody", null, parsed.rows.slice(0, 100).map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, r.code), /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 600
    }
  }, r.name), /*#__PURE__*/React.createElement("td", null, r.team), /*#__PURE__*/React.createElement("td", null, r.status)))))), /*#__PURE__*/React.createElement(Field, {
    label: "Chế độ nhập dữ liệu"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMode("merge"),
    className: "mes-btn",
    style: {
      flex: 1,
      justifyContent: "center",
      borderColor: mode === "merge" ? COLORS.copper : COLORS.border,
      background: mode === "merge" ? `${COLORS.copper}22` : COLORS.bgPanel2,
      color: mode === "merge" ? COLORS.copperBright : COLORS.textDim
    }
  }, "Cập nhật / Thêm mới (giữ danh sách cũ)"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMode("replace"),
    className: "mes-btn",
    style: {
      flex: 1,
      justifyContent: "center",
      borderColor: mode === "replace" ? COLORS.red : COLORS.border,
      background: mode === "replace" ? `${COLORS.red}22` : COLORS.bgPanel2,
      color: mode === "replace" ? COLORS.red : COLORS.textDim
    }
  }, "Thay thế toàn bộ danh sách"))), mode === "replace" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: COLORS.red,
      marginBottom: 10
    }
  }, "Toàn bộ ", existingStaff.length, " nhân viên hiện tại sẽ bị xóa và thay bằng ", parsed.rows.length, " dòng trong file."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setParsed(null)
  }, "Chọn file khác"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => {
      onImport(parsed.rows, mode);
      onClose();
    }
  }, /*#__PURE__*/React.createElement(Upload, {
    size: 14
  }), " Xác nhận nhập ", parsed.rows.length, " dòng"))));
}
function StaffFormModal({
  initial,
  onClose,
  onSave
}) {
  const [form, setForm] = useState(initial);
  const isEdit = !!initial.id;
  return /*#__PURE__*/React.createElement(Modal, {
    title: isEdit ? `Chỉnh sửa nhân viên — ${initial.name}` : "Thêm nhân viên mới",
    onClose: onClose,
    width: 480
  }, isEdit && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.bgInset,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 14,
      fontSize: FZ(13),
      color: COLORS.textDim
    }
  }, "Đang chỉnh sửa: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: COLORS.copperBright
    }
  }, initial.code, " — ", initial.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Mã nhân viên"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    value: form.code,
    onChange: e => setForm(f => ({
      ...f,
      code: e.target.value
    })),
    placeholder: "D-AMG001"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Họ và tên"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    value: form.name,
    onChange: e => setForm(f => ({
      ...f,
      name: e.target.value
    })),
    placeholder: "Nguyễn Văn A"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Tổ sản xuất"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: form.team,
    onChange: e => setForm(f => ({
      ...f,
      team: e.target.value
    }))
  }, TEAMS.map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }, "Tổ ", t)))), /*#__PURE__*/React.createElement(Field, {
    label: "Tình trạng"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: form.status,
    onChange: e => setForm(f => ({
      ...f,
      status: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: "Đang làm"
  }, "Đang làm"), /*#__PURE__*/React.createElement("option", {
    value: "Nghỉ phép"
  }, "Nghỉ phép"), /*#__PURE__*/React.createElement("option", {
    value: "Đã nghỉ"
  }, "Đã nghỉ")))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => {
      if (!form.name.trim()) return;
      onSave({
        ...form,
        id: form.id || uid("NV")
      });
      onClose();
    },
    style: {
      width: "100%",
      justifyContent: "center",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), " ", isEdit ? "Lưu thay đổi" : "Thêm nhân viên"));
}

/* ===================== ATTENDANCE PAGE ===================== */
function AttendanceCheckbox({
  checked,
  onChange,
  status
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onChange(!checked),
    title: status.label,
    style: {
      width: 26,
      height: 26,
      borderRadius: 7,
      border: checked ? `1px solid ${status.color}` : `1px solid ${status.color}55`,
      background: checked ? status.color : `${status.color}0d`,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all .12s ease",
      flexShrink: 0,
      padding: 0,
      boxShadow: checked ? `0 1px 3px ${status.color}55` : "none"
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 8.5L6.2 11.5L13 4.5",
    stroke: "#fff",
    strokeWidth: 2.3,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
function AttendanceSection({
  staff,
  attendance,
  onUpdate
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [filterTeam, setFilterTeam] = useState("all");
  const dayKey = date;
  const dayData = attendance[dayKey] || {};
  function getStatus(staffId) {
    return dayData[staffId] || {};
  }

  // ===== Export helpers =====
  function getDaysInRange(start, end) {
    const days = [];
    const cur = new Date(start);
    while (cur <= new Date(end)) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }
  function getWeekRange(d) {
    const dt = new Date(d + "T00:00:00");
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(dt);
    mon.setDate(dt.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
  }
  function getMonthRange(d) {
    const [y, m] = d.split("-");
    return [`${y}-${m}-01`, new Date(y, Number(m), 0).toISOString().slice(0, 10)];
  }
  function buildSheet(days, label) {
    const STATUS_LABELS = ATTENDANCE_STATUSES.map(s => s.label);
    const activeTeams = TEAMS.filter(t => staff.some(s => s.team === t));
    const aoa = [];

    // === PHẦN 1: Tiêu đề ===
    aoa.push([`BÁO CÁO ĐIỂM DANH — ${label.toUpperCase()}`]);
    aoa.push([]);

    // === PHẦN 2: Bảng tổng theo tổ ===
    const sumHeader = ["Tổ", "Sĩ số", ...STATUS_LABELS];
    aoa.push(sumHeader);
    let grandTotal = {
      count: 0
    };
    STATUS_LABELS.forEach(l => grandTotal[l] = 0);
    activeTeams.forEach(team => {
      const members = staff.filter(s => s.team === team);
      const teamRow = [`Tổ ${team}`, members.length];
      ATTENDANCE_STATUSES.forEach(a => {
        let cnt = 0;
        days.forEach(d => {
          cnt += members.filter(m => ((attendance[d] || {})[m.id] || {})[a.key]).length;
        });
        teamRow.push(cnt || "—");
        grandTotal[a.label] = (grandTotal[a.label] || 0) + (cnt || 0);
      });
      grandTotal.count += members.length;
      aoa.push(teamRow);
    });
    const totalRow = ["Tổng cộng", grandTotal.count, ...ATTENDANCE_STATUSES.map(a => grandTotal[a.label] || "—")];
    aoa.push(totalRow);
    aoa.push([]);
    aoa.push([]);

    // === PHẦN 3: Chi tiết từng tổ ===
    const detailHeader = ["Mã NV", "Họ và tên", ...days.flatMap(d => STATUS_LABELS.map(l => days.length > 1 ? `${l} (${d})` : l))];
    aoa.push(detailHeader);
    activeTeams.forEach(team => {
      const members = staff.filter(s => s.team === team);
      // Team separator row
      aoa.push([`Tổ ${team.toUpperCase()} (${members.length} người)`, ...Array(detailHeader.length - 1).fill("")]);
      members.forEach(m => {
        const row = [m.code, m.name];
        days.forEach(d => {
          const st = (attendance[d] || {})[m.id] || {};
          ATTENDANCE_STATUSES.forEach(a => row.push(st[a.key] ? "✓" : ""));
        });
        aoa.push(row);
      });
      // Team sub-total
      const sub = [`Tổng Tổ ${team}`, ""];
      days.forEach(d => {
        ATTENDANCE_STATUSES.forEach(a => {
          sub.push(members.filter(m => ((attendance[d] || {})[m.id] || {})[a.key]).length || "");
        });
      });
      aoa.push(sub);
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Column widths
    ws["!cols"] = [{
      wch: 13
    }, {
      wch: 22
    }, ...days.flatMap(() => ATTENDANCE_STATUSES.map(() => ({
      wch: 11
    })))];
    return ws;
  }
  function exportExcel(mode) {
    let days, label, fileName;
    if (mode === "day") {
      days = [date];
      label = `Điểm danh ngày ${date}`;
      fileName = `diemdanh_${date}.xlsx`;
    } else if (mode === "week") {
      const [start, end] = getWeekRange(date);
      days = getDaysInRange(start, end);
      label = `Điểm danh tuần ${start} → ${end}`;
      fileName = `diemdanh_tuan_${start}.xlsx`;
    } else {
      const [start, end] = getMonthRange(date);
      days = getDaysInRange(start, end);
      label = `Điểm danh tháng ${date.slice(0, 7)}`;
      fileName = `diemdanh_thang_${date.slice(0, 7)}.xlsx`;
    }
    const wb = XLSX.utils.book_new();
    // Sheet 1: Full layout
    XLSX.utils.book_append_sheet(wb, buildSheet(days, label), label.slice(0, 31));
    XLSX.writeFile(wb, fileName);
  }
  function toggleStatus(staffId, key, val) {
    const current = getStatus(staffId);
    const updated = {
      ...current
    };
    if (key === "caNgay" && val) {
      delete updated.caDem;
    }
    if (key === "caDem" && val) {
      delete updated.caNgay;
    }
    if (val) updated[key] = true;else delete updated[key];
    const newDayData = {
      ...dayData,
      [staffId]: Object.keys(updated).length ? updated : undefined
    };
    if (!newDayData[staffId]) delete newDayData[staffId];
    onUpdate(dayKey, newDayData);
  }
  function setAllShift(shiftKey, teamFilter) {
    const targetStaff = teamFilter === "all" ? staff : staff.filter(s => s.team === teamFilter);
    const newDayData = {
      ...dayData
    };
    targetStaff.forEach(s => {
      const current = newDayData[s.id] || {};
      const updated = {
        ...current
      };
      if (shiftKey === "caNgay") delete updated.caDem;
      if (shiftKey === "caDem") delete updated.caNgay;
      updated[shiftKey] = true;
      newDayData[s.id] = updated;
    });
    onUpdate(dayKey, newDayData);
  }
  const activeTeams = TEAMS.filter(t => staff.some(s => s.team === t));
  const displayTeams = filterTeam === "all" ? activeTeams : [filterTeam];
  const allFilteredStaff = filterTeam === "all" ? staff : staff.filter(s => s.team === filterTeam);
  const summary = useMemo(() => {
    const m = {};
    ATTENDANCE_STATUSES.forEach(s => m[s.key] = 0);
    allFilteredStaff.forEach(s => {
      const st = getStatus(s.id);
      ATTENDANCE_STATUSES.forEach(a => {
        if (st[a.key]) m[a.key]++;
      });
    });
    return m;
  }, [dayData, allFilteredStaff]);
  const COL_HEADER_STYLE = {
    position: "sticky",
    top: 0,
    background: COLORS.bgPanel2,
    zIndex: 10,
    textAlign: "center",
    fontSize: FZ(12),
    whiteSpace: "nowrap",
    borderBottom: `2px solid ${COLORS.border}`
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    style: {
      width: 170
    }
  }), /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    style: {
      width: 170
    },
    value: filterTeam,
    onChange: e => setFilterTeam(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tất cả tổ"), activeTeams.map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }, "Tổ ", t))), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setAllShift("caNgay", filterTeam),
    style: {
      fontSize: FZ(12)
    }
  }, "Ca Ngày"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setAllShift("caDem", filterTeam),
    style: {
      fontSize: FZ(12)
    }
  }, "Ca Đêm"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => exportExcel("day"),
    style: {
      fontSize: FZ(12),
      padding: "7px 12px",
      borderRadius: 8,
      border: `1px solid ${COLORS.green}`,
      background: `${COLORS.green}18`,
      color: COLORS.green,
      cursor: "pointer",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(FileSpreadsheet, {
    size: 13
  }), " Xuất ngày"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => exportExcel("week"),
    style: {
      fontSize: FZ(12),
      padding: "7px 12px",
      borderRadius: 8,
      border: `1px solid ${COLORS.blue}`,
      background: `${COLORS.blue}18`,
      color: COLORS.blue,
      cursor: "pointer",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(FileSpreadsheet, {
    size: 13
  }), " Xuất tuần"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => exportExcel("month"),
    style: {
      fontSize: FZ(12),
      padding: "7px 12px",
      borderRadius: 8,
      border: `1px solid ${COLORS.copper}`,
      background: `${COLORS.copper}18`,
      color: COLORS.copperBright,
      cursor: "pointer",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(FileSpreadsheet, {
    size: 13
  }), " Xuất tháng"))), /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      minWidth: 680,
      borderCollapse: "collapse",
      width: "100%",
      background: COLORS.bgPanel2,
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid ${COLORS.border}`
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: COLORS.bgInset
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "left",
      padding: "8px 14px",
      fontSize: FZ(12),
      fontWeight: 700,
      color: COLORS.textDim,
      textTransform: "uppercase",
      borderBottom: `1px solid ${COLORS.border}`,
      whiteSpace: "nowrap"
    }
  }, "Tổ"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "center",
      padding: "8px 6px",
      fontSize: FZ(12),
      fontWeight: 700,
      color: COLORS.textDim,
      borderBottom: `1px solid ${COLORS.border}`
    }
  }, "Sĩ số"), ATTENDANCE_STATUSES.map(s => /*#__PURE__*/React.createElement("th", {
    key: s.key,
    style: {
      textAlign: "center",
      padding: "6px 4px",
      fontSize: FZ(12),
      color: s.color,
      fontWeight: 700,
      borderBottom: `1px solid ${COLORS.border}`,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(s.icon, {
    size: 13,
    color: s.color,
    style: {
      verticalAlign: "middle",
      marginRight: 3
    }
  }), s.label)))), /*#__PURE__*/React.createElement("tbody", null, displayTeams.map(team => {
    const members = staff.filter(s => s.team === team);
    const ts = {};
    ATTENDANCE_STATUSES.forEach(a => {
      ts[a.key] = members.filter(m => (dayData[m.id] || {})[a.key]).length;
    });
    return /*#__PURE__*/React.createElement("tr", {
      key: `sum-${team}`,
      style: {
        borderBottom: `1px solid ${COLORS.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "7px 14px",
        fontWeight: 700,
        fontSize: FZ(13)
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Users, {
      size: 12,
      color: COLORS.blue
    }), " Tổ ", team)), /*#__PURE__*/React.createElement("td", {
      style: {
        textAlign: "center",
        fontWeight: 700,
        color: COLORS.text
      }
    }, members.length), ATTENDANCE_STATUSES.map(a => /*#__PURE__*/React.createElement("td", {
      key: a.key,
      style: {
        textAlign: "center"
      }
    }, ts[a.key] > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: FZ(13),
        fontWeight: 700,
        color: a.color
      }
    }, ts[a.key]) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.border,
        fontSize: FZ(12)
      }
    }, "—"))));
  }), displayTeams.length > 1 && (() => {
    const total = {};
    ATTENDANCE_STATUSES.forEach(a => {
      total[a.key] = allFilteredStaff.filter(m => (dayData[m.id] || {})[a.key]).length;
    });
    return /*#__PURE__*/React.createElement("tr", {
      style: {
        background: COLORS.bgInset,
        borderTop: `2px solid ${COLORS.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 14px",
        fontWeight: 800,
        fontSize: FZ(13),
        color: COLORS.copperBright
      }
    }, "Tổng cộng"), /*#__PURE__*/React.createElement("td", {
      style: {
        textAlign: "center",
        fontWeight: 800,
        color: COLORS.copperBright
      }
    }, allFilteredStaff.length), ATTENDANCE_STATUSES.map(a => /*#__PURE__*/React.createElement("td", {
      key: a.key,
      style: {
        textAlign: "center"
      }
    }, total[a.key] > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: FZ(13),
        fontWeight: 800,
        color: a.color
      }
    }, total[a.key]) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.border,
        fontSize: FZ(12)
      }
    }, "—"))));
  })()))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x",
    style: {
      overflowY: "auto",
      maxHeight: "calc(100vh - 380px)",
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table",
    style: {
      minWidth: 780,
      borderCollapse: "collapse",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: COLORS.bgPanel2
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "left",
      minWidth: 110,
      padding: "10px 14px",
      fontSize: FZ(12),
      fontWeight: 700,
      color: COLORS.textDim,
      textTransform: "uppercase",
      borderBottom: `2px solid ${COLORS.copper}`,
      whiteSpace: "nowrap"
    }
  }, "Mã NV"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "left",
      minWidth: 170,
      padding: "10px 8px",
      fontSize: FZ(12),
      fontWeight: 700,
      color: COLORS.textDim,
      textTransform: "uppercase",
      borderBottom: `2px solid ${COLORS.copper}`,
      whiteSpace: "nowrap"
    }
  }, "Họ và tên"), ATTENDANCE_STATUSES.map(s => /*#__PURE__*/React.createElement("th", {
    key: s.key,
    style: {
      textAlign: "center",
      minWidth: 78,
      padding: "6px 4px",
      borderBottom: `2px solid ${COLORS.copper}`,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 26,
      margin: "0 auto",
      borderRadius: 999,
      background: `${s.color}1f`,
      border: `1px solid ${s.color}77`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(s.icon, {
    size: 14,
    color: s.color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: s.color,
      fontSize: FZ(12),
      fontWeight: 700,
      marginTop: 2
    }
  }, s.label))), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "center",
      minWidth: 80,
      padding: "10px 8px",
      fontSize: FZ(12),
      fontWeight: 700,
      color: COLORS.textDim,
      textTransform: "uppercase",
      borderBottom: `2px solid ${COLORS.copper}`
    }
  }, "Xóa"))), /*#__PURE__*/React.createElement("tbody", null, displayTeams.map(team => {
    const members = staff.filter(s => s.team === team);
    if (!members.length) return null;
    const teamSummary = {};
    ATTENDANCE_STATUSES.forEach(a => {
      teamSummary[a.key] = members.filter(m => getStatus(m.id)[a.key]).length;
    });
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("tr", {
      key: `team-${team}`
    }, /*#__PURE__*/React.createElement("td", {
      colSpan: 2 + ATTENDANCE_STATUSES.length + 1,
      style: {
        background: COLORS.bgInset,
        padding: "8px 14px",
        borderTop: `2px solid ${COLORS.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Users, {
      size: 13,
      color: COLORS.blue
    }), /*#__PURE__*/React.createElement("span", {
      className: "mes-display",
      style: {
        fontSize: FZ(13),
        fontWeight: 700
      }
    }, "Tổ ", team), /*#__PURE__*/React.createElement(Badge, {
      color: COLORS.blue
    }, members.length, " người")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setAllShift("caNgay", team),
      style: {
        fontSize: FZ(12),
        padding: "3px 10px",
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bgPanel2,
        color: COLORS.textDim,
        cursor: "pointer"
      }
    }, "Ca Ngày"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setAllShift("caDem", team),
      style: {
        fontSize: FZ(12),
        padding: "3px 10px",
        borderRadius: 6,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.bgPanel2,
        color: COLORS.textDim,
        cursor: "pointer"
      }
    }, "Ca Đêm"))))), members.map(m => {
      const st = getStatus(m.id);
      return /*#__PURE__*/React.createElement("tr", {
        key: m.id
      }, /*#__PURE__*/React.createElement("td", {
        className: "mes-mono",
        style: {
          paddingLeft: 14
        }
      }, m.code), /*#__PURE__*/React.createElement("td", {
        style: {
          fontWeight: 600
        }
      }, m.name), ATTENDANCE_STATUSES.map(a => /*#__PURE__*/React.createElement("td", {
        key: a.key,
        style: {
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement(AttendanceCheckbox, {
        checked: !!st[a.key],
        onChange: v => toggleStatus(m.id, a.key, v),
        status: a
      }))), /*#__PURE__*/React.createElement("td", {
        style: {
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        title: "Xóa điểm danh hôm nay",
        onClick: () => {
          const nd = {
            ...dayData
          };
          delete nd[m.id];
          onUpdate(dayKey, nd);
        },
        style: {
          fontSize: FZ(12),
          padding: "3px 8px",
          borderRadius: 5,
          border: `1px solid ${COLORS.border}`,
          background: "none",
          color: COLORS.textFaint,
          cursor: "pointer"
        }
      }, "Xóa")));
    }), /*#__PURE__*/React.createElement("tr", {
      key: `sub-${team}`,
      style: {
        background: `${COLORS.bgInset}88`
      }
    }, /*#__PURE__*/React.createElement("td", {
      colSpan: 2,
      style: {
        paddingLeft: 14,
        fontSize: FZ(12),
        color: COLORS.textFaint,
        fontStyle: "italic"
      }
    }, "Tổng Tổ ", team), ATTENDANCE_STATUSES.map(a => /*#__PURE__*/React.createElement("td", {
      key: a.key,
      style: {
        textAlign: "center"
      }
    }, teamSummary[a.key] > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: FZ(12),
        fontWeight: 700,
        color: a.color
      }
    }, teamSummary[a.key]) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.border,
        fontSize: FZ(12)
      }
    }, "—"))), /*#__PURE__*/React.createElement("td", null)));
  }))))));
}
function StaffPage({
  staff,
  isAdmin,
  canEdit,
  onAdd,
  onUpdate,
  onDelete,
  onRestoreSeed,
  onImport,
  attendance,
  onAttendanceUpdate
}) {
  const {
    askConfirm
  } = useDialog();
  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState(() => { const f = amgTakeFocus("staff"); return f && f.q ? f.q : ""; });
  const [activeTab, setActiveTab] = useState("list");
  const grouped = TEAMS.map(team => ({
    team,
    members: staff.filter(s => s.team === team && (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())))
  })).filter(g => g.members.length > 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: `${staff.length} nhân viên`,
    title: "Nhân sự & Điểm danh",
    icon: Users,
    iconColor: COLORS.violet,
    action: canEdit && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, isAdmin && /*#__PURE__*/React.createElement(Button, {
      onClick: () => setShowImport(true)
    }, /*#__PURE__*/React.createElement(Upload, {
      size: 14
    }), " Tải lên từ Excel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setModal({
        code: "",
        name: "",
        team: TEAMS[0],
        shift: "Ca ngày",
        status: "Đang làm"
      })
    }, /*#__PURE__*/React.createElement(Plus, {
      size: 14
    }), " Thêm nhân viên"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2,
      marginBottom: 18,
      borderBottom: `1px solid ${COLORS.border}`,
      paddingBottom: 0
    }
  }, [{
    key: "list",
    label: "Danh sách nhân viên"
  }, {
    key: "attendance",
    label: "Điểm danh theo ngày"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.key,
    type: "button",
    onClick: () => setActiveTab(t.key),
    style: {
      padding: "8px 18px",
      fontSize: FZ(14),
      fontWeight: 600,
      border: "none",
      borderBottom: activeTab === t.key ? `2.5px solid ${COLORS.copper}` : "2.5px solid transparent",
      background: "transparent",
      color: activeTab === t.key ? COLORS.copperBright : COLORS.textDim,
      cursor: "pointer",
      marginBottom: -1
    }
  }, t.label))), activeTab === "attendance" && /*#__PURE__*/React.createElement(AttendanceSection, {
    staff: staff,
    attendance: attendance || {},
    onUpdate: onAttendanceUpdate
  }), activeTab === "list" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 16,
      maxWidth: 320
    }
  }, /*#__PURE__*/React.createElement(Search, {
    size: 14,
    style: {
      position: "absolute",
      left: 10,
      top: 9,
      color: COLORS.textFaint
    }
  }), /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    style: {
      paddingLeft: 30
    },
    placeholder: "Tìm theo tên hoặc mã NV...",
    value: search,
    onChange: e => setSearch(e.target.value)
  })), grouped.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    title: staff.length === 0 ? "Chưa có dữ liệu nhân sự" : "Không tìm thấy nhân viên phù hợp",
    hint: staff.length === 0 ? "Danh sách nhân viên trống — có thể do dữ liệu chưa được nạp đầy đủ." : undefined,
    action: isAdmin && staff.length === 0 && /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: onRestoreSeed
    }, /*#__PURE__*/React.createElement(RefreshCw, {
      size: 14
    }), " Khôi phục danh sách nhân viên mẫu (53 người)")
  }) : grouped.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.team,
    className: "mes-card",
    style: {
      marginBottom: 14,
      border: `1px solid ${COLORS.blue}40`,
      borderTop: `4px solid ${COLORS.blue}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px",
      borderBottom: `1px solid ${COLORS.border}`,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Users, {
    size: 15,
    color: COLORS.blue
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontWeight: 700,
      fontSize: FZ(14)
    }
  }, "Tổ ", g.team), /*#__PURE__*/React.createElement(Badge, {
    color: COLORS.blue
  }, g.members.length, " người")), /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x"
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Mã NV"), /*#__PURE__*/React.createElement("th", null, "Họ và tên"), /*#__PURE__*/React.createElement("th", null, "Tình trạng"), canEdit && /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, g.members.map(m => /*#__PURE__*/React.createElement("tr", {
    key: m.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, m.code), /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 600
    }
  }, m.name), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    color: m.status === "Đang làm" ? COLORS.green : m.status === "Nghỉ phép" ? COLORS.amber : COLORS.textFaint
  }, m.status)), canEdit && /*#__PURE__*/React.createElement("td", {
    style: {
      display: "flex",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: Pencil,
    onClick: () => setModal(m),
    title: "Sửa"
  }), isAdmin && /*#__PURE__*/React.createElement(IconButton, {
    icon: Trash2,
    danger: true,
    onClick: async () => {
      if (await askConfirm(`Xóa nhân viên ${m.name}?`, {
        danger: true,
        confirmLabel: "Xóa"
      })) onDelete(m.id);
    },
    title: "Xóa"
  })))))))))), modal && /*#__PURE__*/React.createElement(StaffFormModal, {
    initial: modal,
    onClose: () => setModal(null),
    onSave: d => {
      modal.id ? onUpdate(d) : onAdd(d);
      setModal(null);
    }
  }), showImport && /*#__PURE__*/React.createElement(StaffImportModal, {
    existingStaff: staff,
    onClose: () => setShowImport(false),
    onImport: onImport
  }));
}

