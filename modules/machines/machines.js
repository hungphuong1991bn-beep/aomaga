/* ===================== MACHINES PAGE ===================== */
function fmtDuration(ms) {
  if (!ms || ms < 0) return "0 phút";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}
function MachineStatusModal({
  machine,
  isAdmin,
  canDelete,
  onClose,
  onSave,
  onDelete
}) {
  const {
    askConfirm
  } = useDialog();
  const [status, setStatus] = useState(machine.status);
  const [note, setNote] = useState(machine.note || "");
  const [showLog, setShowLog] = useState(false);
  const downtimeLog = useMemo(() => [...(machine.downtimeLog || [])].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)), [machine.downtimeLog]);
  const stats = useMemo(() => {
    const now = Date.now();
    let totalDowntimeMs = 0;
    let byStatus = {};
    downtimeLog.forEach(ev => {
      const start = new Date(ev.startTime).getTime();
      const end = ev.endTime ? new Date(ev.endTime).getTime() : now;
      const dur = Math.max(0, end - start);
      totalDowntimeMs += dur;
      byStatus[ev.status] = (byStatus[ev.status] || 0) + dur;
    });
    return {
      totalDowntimeMs,
      byStatus,
      count: downtimeLog.length
    };
  }, [downtimeLog]);
  function handleExportMachineExcel() {
    if (!window.XLSX) {
      alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại.");
      return;
    }
    const now = Date.now();
    const rows = downtimeLog.map(ev => ({
      "Trạng thái": ev.statusLabel || MACHINE_STATUS[ev.status]?.label || ev.status,
      "Bắt đầu": fmtDateTime(ev.startTime),
      "Kết thúc": ev.endTime ? fmtDateTime(ev.endTime) : "Đang diễn ra",
      "Thời lượng": fmtDuration((ev.endTime ? new Date(ev.endTime).getTime() : now) - new Date(ev.startTime).getTime()),
      "Nguyên nhân": ev.reason || "",
      "Người ghi": ev.recordedBy || ""
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{
      wch: 14
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
    XLSX.utils.book_append_sheet(wb, ws, "Lich su dung may");
    XLSX.writeFile(wb, `lich_su_dung_may_${machine.id}.xlsx`);
  }
  async function handleDelete() {
    if (await askConfirm(`Xóa máy ${machine.id} (${machine.typeLabel})? Hành động không thể hoàn tác.`, {
      danger: true,
      confirmLabel: "Xóa máy"
    })) {
      await onDelete(machine.id);
      onClose();
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Máy ${machine.id} · ${machine.typeLabel}`,
    onClose: onClose,
    width: 630
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      zoom: 1.5
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Trạng thái hoạt động"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, Object.entries(MACHINE_STATUS).filter(([k]) => k !== "unknown").map(([k, v]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    disabled: !isAdmin,
    onClick: () => setStatus(k),
    className: "mes-btn",
    style: {
      borderColor: status === k ? v.color : COLORS.border,
      background: status === k ? `${v.color}20` : COLORS.bgPanel2,
      color: status === k ? v.color : COLORS.textDim
    }
  }, v.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Ghi chú / sự cố"
  }, /*#__PURE__*/React.createElement("textarea", {
    disabled: !isAdmin,
    className: "mes-input",
    rows: 3,
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "Mô tả tình trạng máy, linh kiện cần thay..."
  })), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 12,
      marginBottom: 14,
      border: `1.5px solid ${COLORS.red}55`,
      borderTop: `3px solid ${COLORS.red}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("b", null, "Tổng thời gian dừng máy: "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.red,
      fontWeight: 700
    }
  }, fmtDuration(stats.totalDowntimeMs)), " · ", stats.count, " lượt"), /*#__PURE__*/React.createElement("button", {
    onClick: handleExportMachineExcel,
    className: "mes-btn",
    style: {
      fontSize: 11.5,
      padding: "5px 8px"
    }
  }, /*#__PURE__*/React.createElement(Download, {
    size: 12
  }), " Xuất Excel")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowLog(o => !o),
    style: {
      background: "none",
      border: "none",
      color: COLORS.blue,
      fontSize: 11.5,
      cursor: "pointer",
      padding: 0,
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, showLog ? /*#__PURE__*/React.createElement(ChevronUp, {
    size: 12
  }) : /*#__PURE__*/React.createElement(ChevronDown, {
    size: 12
  }), showLog ? "Ẩn lịch sử" : "Xem lịch sử chi tiết"), showLog && /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 200,
      overflowY: "auto",
      marginTop: 8
    }
  }, downtimeLog.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.textFaint,
      fontStyle: "italic",
      padding: "8px 0"
    }
  }, "Chưa có lượt đổi trạng thái nào được ghi nhận kể từ khi bật tính năng này. Lần tới khi bạn đổi trạng thái máy (ví dụ chuyển từ Đang chạy sang trạng thái khác), lượt đó sẽ tự động hiện ở đây.") : downtimeLog.map(ev => /*#__PURE__*/React.createElement("div", {
    key: ev.id,
    style: {
      padding: "6px 0",
      borderTop: `1px solid ${COLORS.border}`,
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: MACHINE_STATUS[ev.status]?.color
    }
  }, ev.statusLabel || MACHINE_STATUS[ev.status]?.label), /*#__PURE__*/React.createElement("span", {
    className: "mes-mono",
    style: {
      color: COLORS.textFaint
    }
  }, fmtDuration((ev.endTime ? new Date(ev.endTime).getTime() : Date.now()) - new Date(ev.startTime).getTime()))), /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.textFaint
    }
  }, fmtDateTime(ev.startTime), " → ", ev.endTime ? fmtDateTime(ev.endTime) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.red,
      fontWeight: 700
    }
  }, "Đang diễn ra")), ev.reason && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.textDim,
      marginTop: 2
    }
  }, ev.reason))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: COLORS.textFaint,
      marginBottom: 14
    }
  }, "Cập nhật lần cuối: ", fmtDateTime(machine.updatedAt), " bởi ", machine.updatedBy), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, canDelete && /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: handleDelete
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 14
  }), " Xóa máy"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => {
      onSave(machine.id, status, note);
      onClose();
    },
    style: {
      flex: 1,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), " Lưu trạng thái"))));
}
