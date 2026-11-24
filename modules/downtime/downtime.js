/* ===================== THEO DÕI THỜI GIAN DỪNG MÁY ===================== */
function DowntimeAddForm({
  machines,
  onAdd
}) {
  const [machineId, setMachineId] = useState(machines[0]?.id || "");
  const [status, setStatus] = useState("broken");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  async function submit() {
    if (!machineId) {
      setMsg("Vui lòng chọn máy.");
      return;
    }
    if (!startDate || !startTime) {
      setMsg("Vui lòng nhập đầy đủ ngày và giờ bắt đầu.");
      return;
    }
    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    let endISO = null;
    if (endDate && endTime) {
      endISO = new Date(`${endDate}T${endTime}:00`).toISOString();
      if (new Date(endISO) < new Date(startISO)) {
        setMsg("Thời điểm kết thúc phải sau thời điểm bắt đầu.");
        return;
      }
    }
    await onAdd({
      machineId,
      status,
      startTime: startISO,
      endTime: endISO,
      reason
    });
    setMsg("Đã ghi nhận thành công.");
    setReason("");
    setEndDate("");
    setEndTime("");
    setTimeout(() => setMsg(""), 2500);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 18,
      marginBottom: 18,
      border: `1px solid ${COLORS.red}55`,
      borderTop: `4px solid ${COLORS.red}`,
      boxShadow: `0 2px 8px ${COLORS.red}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: FZ(15),
      fontWeight: 700,
      marginBottom: 14
    }
  }, "Ghi nhận thời gian dừng máy"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Máy"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: machineId,
    onChange: e => setMachineId(e.target.value)
  }, machines.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.id, " · ", m.typeLabel)))), /*#__PURE__*/React.createElement(Field, {
    label: "Loại dừng máy"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: status,
    onChange: e => setStatus(e.target.value)
  }, Object.entries(MACHINE_STATUS).filter(([k]) => k !== "running" && k !== "unknown").map(([k, v]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, v.label))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 10,
      background: `${COLORS.red}0d`,
      border: `1px solid ${COLORS.red}40`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      fontWeight: 800,
      color: COLORS.red,
      letterSpacing: ".04em",
      marginBottom: 10
    }
  }, "⏱ BẮT ĐẦU"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: startDate,
    onChange: e => setStartDate(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Giờ"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "mes-input",
    value: startTime,
    onChange: e => setStartTime(e.target.value)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 10,
      background: `${COLORS.green}0d`,
      border: `1px solid ${COLORS.green}40`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      fontWeight: 800,
      color: COLORS.green,
      letterSpacing: ".04em",
      marginBottom: 10
    }
  }, "✓ KẾT THÚC ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: COLORS.textFaint,
      letterSpacing: 0,
      textTransform: "none"
    }
  }, "(để trống nếu vẫn đang dừng)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: endDate,
    onChange: e => setEndDate(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Giờ"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "mes-input",
    value: endTime,
    onChange: e => setEndTime(e.target.value)
  }))))), /*#__PURE__*/React.createElement(Field, {
    label: "Nguyên nhân"
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "mes-input",
    rows: 2,
    value: reason,
    onChange: e => setReason(e.target.value),
    placeholder: "Mô tả sự cố, linh kiện cần thay, lý do tạm nghỉ..."
  })), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13),
      color: msg.includes("thành công") ? COLORS.green : COLORS.red,
      marginBottom: 10
    }
  }, msg), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: submit
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), " Ghi nhận"));
}
function DowntimeTrackingPage({
  machines,
  isAdmin,
  currentUser,
  onAdd,
  onUpdate,
  onDelete
}) {
  const {
    askConfirm
  } = useDialog();
  const [filterMachine, setFilterMachine] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [editing, setEditing] = useState(null); // { machineId, record }
  const allRecords = useMemo(() => {
    const rows = [];
    machines.forEach(m => {
      (m.downtimeLog || []).forEach(ev => {
        rows.push({
          ...ev,
          machineId: m.id,
          machineLabel: `${m.id} · ${m.typeLabel}`
        });
      });
    });
    return rows.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }, [machines]);
  const filtered = allRecords.filter(r => {
    if (filterMachine !== "all" && r.machineId !== filterMachine) return false;
    if (filterFrom && r.startTime.slice(0, 10) < filterFrom) return false;
    if (filterTo && r.startTime.slice(0, 10) > filterTo) return false;
    return true;
  });
  function handleExport() {
    if (!window.XLSX) {
      alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại.");
      return;
    }
    const now = Date.now();
    const rows = filtered.map(r => ({
      "Máy": r.machineLabel,
      "Loại dừng máy": r.statusLabel || MACHINE_STATUS[r.status]?.label || r.status,
      "Bắt đầu": fmtDateTime(r.startTime),
      "Kết thúc": r.endTime ? fmtDateTime(r.endTime) : "Đang diễn ra",
      "Thời lượng": fmtDuration((r.endTime ? new Date(r.endTime).getTime() : now) - new Date(r.startTime).getTime()),
      "Nguyên nhân": r.reason || "",
      "Người ghi": r.recordedBy || ""
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{
      wch: 18
    }, {
      wch: 16
    }, {
      wch: 18
    }, {
      wch: 18
    }, {
      wch: 16
    }, {
      wch: 40
    }, {
      wch: 16
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Thoi gian dung may");
    const suffix = filterMachine !== "all" ? filterMachine : "tat_ca_may";
    XLSX.writeFile(wb, `theo_doi_dung_may_${suffix}.xlsx`);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: `${allRecords.length} lượt ghi nhận`,
    title: "Theo dõi thời gian dừng máy",
    icon: History,
    iconColor: COLORS.red
  }), isAdmin && /*#__PURE__*/React.createElement(DowntimeAddForm, {
    machines: machines,
    onAdd: onAdd
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 14,
      marginBottom: 14,
      display: "flex",
      alignItems: "flex-end",
      gap: 10,
      flexWrap: "wrap",
      border: `1px solid ${COLORS.blue}55`,
      borderTop: `4px solid ${COLORS.blue}`
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Lọc theo máy"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: filterMachine,
    onChange: e => setFilterMachine(e.target.value),
    style: {
      width: 180
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tất cả máy"), machines.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.id, " · ", m.typeLabel)))), /*#__PURE__*/React.createElement(Field, {
    label: "Từ ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: filterFrom,
    onChange: e => setFilterFrom(e.target.value),
    style: {
      width: 150
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Đến ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: filterTo,
    onChange: e => setFilterTo(e.target.value),
    style: {
      width: 150
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: handleExport,
    style: {
      background: `linear-gradient(135deg, ${COLORS.green}, #0F7A38)`
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 14
  }), " Xuất Excel (", filtered.length, " bản ghi)")), /*#__PURE__*/React.createElement("div", {
    className: "mes-card mes-scroll-x",
    style: {
      border: `1px solid ${COLORS.violet}55`,
      borderTop: `4px solid ${COLORS.violet}`
    }
  }, filtered.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: History,
    title: "Chưa có bản ghi nào phù hợp"
  }) : /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Máy"), /*#__PURE__*/React.createElement("th", null, "Loại"), /*#__PURE__*/React.createElement("th", null, "Bắt đầu"), /*#__PURE__*/React.createElement("th", null, "Kết thúc"), /*#__PURE__*/React.createElement("th", null, "Thời lượng"), /*#__PURE__*/React.createElement("th", null, "Nguyên nhân"), /*#__PURE__*/React.createElement("th", null, "Người ghi"), isAdmin && /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.machineId + "_" + r.id
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 700
    }
  }, r.machineLabel), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    color: MACHINE_STATUS[r.status]?.color
  }, r.statusLabel || MACHINE_STATUS[r.status]?.label)), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, fmtDateTime(r.startTime)), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, r.endTime ? fmtDateTime(r.endTime) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.red,
      fontWeight: 700
    }
  }, "Đang diễn ra")), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, fmtDuration((r.endTime ? new Date(r.endTime).getTime() : Date.now()) - new Date(r.startTime).getTime())), /*#__PURE__*/React.createElement("td", null, r.reason || "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      color: COLORS.textFaint
    }
  }, r.recordedBy || "—"), isAdmin && /*#__PURE__*/React.createElement("td", {
    style: {
      display: "flex",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: Pencil,
    onClick: () => setEditing({
      machineId: r.machineId,
      record: r
    }),
    title: "Sửa"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: Trash2,
    danger: true,
    onClick: async () => {
      if (await askConfirm(`Xóa bản ghi dừng máy ${r.machineLabel}?`, {
        danger: true,
        confirmLabel: "Xóa"
      })) onDelete(r.machineId, r.id);
    },
    title: "Xóa"
  }))))))), editing && /*#__PURE__*/React.createElement(DowntimeEditModal, {
    machineId: editing.machineId,
    record: editing.record,
    onClose: () => setEditing(null),
    onSave: (machineId, recordId, patch) => onUpdate(machineId, recordId, patch)
  }));
}
function DowntimeEditModal({
  machineId,
  record,
  onClose,
  onSave
}) {
  const [status, setStatus] = useState(record.status);
  const [startDate, setStartDate] = useState(record.startTime.slice(0, 10));
  const [startTime, setStartTime] = useState(record.startTime.slice(11, 16));
  const [endDate, setEndDate] = useState(record.endTime ? record.endTime.slice(0, 10) : "");
  const [endTime, setEndTime] = useState(record.endTime ? record.endTime.slice(11, 16) : "");
  const [reason, setReason] = useState(record.reason || "");
  function submit() {
    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = endDate && endTime ? new Date(`${endDate}T${endTime}:00`).toISOString() : null;
    onSave(machineId, record.id, {
      status,
      statusLabel: MACHINE_STATUS[status]?.label,
      startTime: startISO,
      endTime: endISO,
      reason
    });
    onClose();
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Sửa bản ghi dừng máy",
    onClose: onClose,
    width: 440
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Loại dừng máy"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: status,
    onChange: e => setStatus(e.target.value)
  }, Object.entries(MACHINE_STATUS).filter(([k]) => k !== "running" && k !== "unknown").map(([k, v]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, v.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Bắt đầu — Ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: startDate,
    onChange: e => setStartDate(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Bắt đầu — Giờ"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "mes-input",
    value: startTime,
    onChange: e => setStartTime(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Kết thúc — Ngày"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "mes-input",
    value: endDate,
    onChange: e => setEndDate(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Kết thúc — Giờ"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "mes-input",
    value: endTime,
    onChange: e => setEndTime(e.target.value)
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Nguyên nhân"
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "mes-input",
    rows: 2,
    value: reason,
    onChange: e => setReason(e.target.value)
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: submit,
    style: {
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), " Lưu thay đổi"));
}
function MachineGroup({
  type,
  machines,
  isAdmin,
  onSelect,
  onAddMachine
}) {
  const [open, setOpen] = useState(false);
  const counts = {
    running: 0,
    idle: 0,
    maintenance: 0,
    broken: 0,
    unknown: 0
  };
  machines.forEach(m => counts[m.status] = (counts[m.status] || 0) + 1);
  const groupColor = type.color || COLORS.copper;
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      marginBottom: 12,
      overflow: "hidden",
      border: `1px solid ${groupColor}55`,
      borderTop: `4px solid ${groupColor}`,
      boxShadow: `0 2px 8px ${groupColor}1a`
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: COLORS.text
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, open ? /*#__PURE__*/React.createElement(ChevronDown, {
    size: 16,
    color: COLORS.textFaint
  }) : /*#__PURE__*/React.createElement(ChevronRight, {
    size: 16,
    color: COLORS.textFaint
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 8,
      background: `${groupColor}1f`,
      border: `1px solid ${groupColor}66`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Wrench, {
    size: 14,
    color: groupColor
  })), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontWeight: 700,
      fontSize: FZ(14)
    }
  }, type.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: FZ(12),
      color: COLORS.textFaint
    }
  }, "(", machines.length, " máy)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, counts.running > 0 && /*#__PURE__*/React.createElement(Badge, {
    color: MACHINE_STATUS.running.color
  }, counts.running, " chạy"), counts.idle > 0 && /*#__PURE__*/React.createElement(Badge, {
    color: MACHINE_STATUS.idle.color
  }, counts.idle, " nghỉ"), counts.maintenance > 0 && /*#__PURE__*/React.createElement(Badge, {
    color: MACHINE_STATUS.maintenance.color
  }, counts.maintenance, " bảo trì"), counts.broken > 0 && /*#__PURE__*/React.createElement(Badge, {
    color: MACHINE_STATUS.broken.color
  }, counts.broken, " hỏng"), counts.unknown > 0 && /*#__PURE__*/React.createElement(Badge, {
    color: MACHINE_STATUS.unknown.color
  }, counts.unknown, " chưa xác định"))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 16px 16px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
      gap: 8
    }
  }, machines.map(m => {
    const st = MACHINE_STATUS[m.status];
    return /*#__PURE__*/React.createElement("button", {
      key: m.id,
      onClick: () => onSelect(m),
      title: `${m.id} — ${st.label}`,
      style: {
        border: `1px solid ${st.color}50`,
        background: `${st.color}14`,
        borderRadius: 8,
        padding: "8px 4px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(CircleDot, {
      size: 13,
      color: st.color
    }), /*#__PURE__*/React.createElement("span", {
      className: "mes-mono",
      style: {
        fontSize: FZ(12),
        color: COLORS.text
      }
    }, m.id));
  }), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onAddMachine(type.key);
    },
    title: `Thêm máy ${type.label}`,
    style: {
      border: `1px dashed ${COLORS.border}`,
      background: "transparent",
      borderRadius: 8,
      padding: "8px 4px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      color: COLORS.textFaint,
      minHeight: 56
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: FZ(12)
    }
  }, "Thêm máy"))));
}
function MachinesPage({
  machines,
  isAdmin,
  canEdit,
  onUpdateMachine,
  onAddMachine,
  onDeleteMachine,
  onRestoreSeed
}) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const total = machines.length;
  const counts = {
    running: 0,
    idle: 0,
    maintenance: 0,
    broken: 0
  };
  machines.forEach(m => counts[m.status]++);
  const filteredMachines = filter === "all" ? machines : machines.filter(m => m.status === filter);
  const grouped = MACHINE_TYPES.map(type => ({
    type,
    machines: filteredMachines.filter(m => m.typeKey === type.key)
  })).filter(g => g.machines.length > 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: `${total} máy móc thiết bị`,
    title: "Giám sát hệ thống máy móc thiết bị hoạt động",
    icon: Cog,
    iconColor: COLORS.blue
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginBottom: 18,
      flexWrap: "wrap"
    }
  }, Object.entries(MACHINE_STATUS).map(([k, v]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setFilter(f => f === k ? "all" : k),
    className: "mes-card",
    style: {
      padding: "12px 16px",
      flex: 1,
      minWidth: 130,
      cursor: "pointer",
      border: filter === k ? `1px solid ${v.color}` : `1px solid ${v.color}40`,
      borderTop: `4px solid ${v.color}`,
      boxShadow: filter === k ? `0 2px 8px ${v.color}33` : "none",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: COLORS.textDim,
      fontWeight: 600,
      marginBottom: 6
    }
  }, v.label), /*#__PURE__*/React.createElement("div", {
    className: "mes-mono mes-display",
    style: {
      fontSize: FZ(22),
      fontWeight: 700,
      color: v.color
    }
  }, counts[k])))), grouped.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    title: "Chưa có dữ liệu máy móc thiết bị",
    hint: "Danh sách máy móc trống — có thể do dữ liệu chưa được nạp đầy đủ.",
    action: isAdmin && /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: onRestoreSeed
    }, /*#__PURE__*/React.createElement(RefreshCw, {
      size: 14
    }), " Khôi phục 160 máy mẫu")
  }) : grouped.map(g => /*#__PURE__*/React.createElement(MachineGroup, {
    key: g.type.key,
    type: g.type,
    machines: g.machines,
    isAdmin: canEdit,
    onSelect: setSelected,
    onAddMachine: onAddMachine
  })), selected && /*#__PURE__*/React.createElement(MachineStatusModal, {
    machine: selected,
    isAdmin: canEdit,
    canDelete: isAdmin,
    onClose: () => setSelected(null),
    onSave: (id, status, note) => onUpdateMachine(id, status, note),
    onDelete: onDeleteMachine
  }));
}

