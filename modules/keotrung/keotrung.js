/* ===================== KÉO TRUNG PAGE ===================== */
function KeoTrungPage({
  orders,
  auditLog,
  currentUser,
  onSubmit,
  onEditEntry,
  onDeleteEntry
}) {
  const {
    askConfirm
  } = useDialog();
  const VALID_GRADES = ["A", "B", "C"];
  const [materialCode, setMaterialCode] = useState("A");
  const [wireType, setWireType] = useState("");
  const [diameter, setDiameter] = useState("");
  const [customer, setCustomer] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("Ca ngày");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  const [showEntries, setShowEntries] = useState(false);
  const [editing, setEditing] = useState(null);
  function handleSubmit() {
    const n = parseFloat(qty);
    if (!n || n <= 0) {
      setMsg("Số lượng phải lớn hơn 0.");
      return;
    }
    if (!wireType) {
      setMsg("Vui lòng chọn Dây cứng hoặc Dây ủ mềm.");
      return;
    }
    if (customer && !diameter) {
      setMsg("Đã nhập khách hàng — vui lòng nhập Đường kính dây (mm) để gán đúng đơn hàng (tránh nhầm giữa các đơn cùng khách/mã liệu khác quy cách).");
      return;
    }
    onSubmit({
      stageKey: "keo_trung",
      qty: n,
      note,
      wireType,
      materialCode,
      diameter,
      customer,
      date
    });
    setQty("");
    setDiameter("");
    setCustomer("");
    setMsg("Đã ghi nhận thành công.");
    setTimeout(() => setMsg(""), 3000);
  }

  // Tổng hợp sản lượng theo mã liệu + loại dây
  const entries = useMemo(() => (auditLog || []).filter(a => a.type === "production_entry" && a.stageKey === "keo_trung" && a.date && typeof a.qty === "number").sort((a, b) => new Date(b.date) - new Date(a.date)), [auditLog]);
  const summary = useMemo(() => {
    const m = {};
    VALID_GRADES.forEach(g => {
      m[g + " - Dây ủ mềm"] = 0;
      m[g + " - Dây cứng"] = 0;
    });
    entries.forEach(e => {
      const mat = e.materialCode || "";
      const combo = `${mat} - ${e.wireType || ""}`;
      if (m[combo] !== undefined) m[combo] += e.qty;
    });
    return Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => ({
      label: k,
      qty: v
    }));
  }, [entries]);
  const totalKg = entries.reduce((a, e) => a + (e.qty || 0), 0);

  // Đơn hàng đang cần nguyên liệu từ Kéo trung + mã liệu tương ứng
  const ordersByMat = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      const mat = o.materialCode || "";
      if (!VALID_GRADES.includes(mat)) return;
      const qty = o.quantity || 0;
      const applicable = getApplicableStages(o);
      const isSoftWire = applicable.length === 1 && applicable[0] === "keo_trung";
      let remainingNeed;
      if (isSoftWire) {
        // Dây ủ mềm: còn cần = số lượng - Kéo trung đã làm trực tiếp
        remainingNeed = Math.max(0, qty - (o.stages?.keo_trung?.done || 0));
      } else {
        // Đơn thường (BC/TC/bện): còn cần Kéo trung = qty - keo_trung.done (NVL đã kéo cho đơn này)
        // Nếu chưa có keo_trung.done, dùng downstream làm sàn (phần Kéo tinh đã làm
        // chắc chắn đã được Kéo trung cung cấp rồi, tránh tính lại)
        const keoTrungDone = o.stages?.keo_trung?.done || 0;
        const downstreamDone = Math.max(o.stages?.keo_tinh?.done || 0, o.stages?.keo_sieu_tinh?.done || 0);
        // Lấy max(keo_trung.done, downstream) để tránh trường hợp downstream > keo_trung
        const alreadySupplied = Math.max(keoTrungDone, downstreamDone);
        remainingNeed = Math.max(0, qty - alreadySupplied);
      }
      if (remainingNeed > 0) {
        if (!m[mat]) m[mat] = [];
        m[mat].push({
          ...o,
          _remainingNeed: remainingNeed,
          _isSoftWire: isSoftWire
        });
      }
    });
    return m;
  }, [orders]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Công đoạn cung cấp nguyên vật liệu",
    title: "Nhập sản lượng Kéo trung",
    icon: Hammer,
    iconColor: COLORS.copper,
    action: /*#__PURE__*/React.createElement(Badge, {
      color: COLORS.green
    }, /*#__PURE__*/React.createElement("span", {
      className: "pulse-dot"
    }, "●"), " Tổng hợp: ", fmtNum(totalKg), " kg")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.8fr)",
      gap: 18,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 18,
      border: `1px solid ${COLORS.copper}55`,
      borderTop: `4px solid ${COLORS.copper}`,
      boxShadow: `0 2px 8px ${COLORS.copper}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Hammer, {
    size: 16,
    color: COLORS.copper
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: `linear-gradient(135deg, ${COLORS.copperBright}, ${COLORS.copper})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Hammer, {
    size: 18,
    color: "#1A0F08"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mes-mono",
    style: {
      fontSize: FZ(12),
      color: COLORS.copper,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      marginBottom: 2
    }
  }, "Công đoạn Kéo trung"), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: FZ(20),
      fontWeight: 700,
      letterSpacing: "-0.02em"
    }
  }, "Ghi nhận sản lượng")))), /*#__PURE__*/React.createElement(Field, {
    label: "Ngày sản xuất"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Mã nguyên liệu (A / B / C)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, VALID_GRADES.map(g => /*#__PURE__*/React.createElement("button", {
    key: g,
    type: "button",
    onClick: () => setMaterialCode(g),
    className: "mes-btn",
    style: {
      flex: 1,
      justifyContent: "center",
      fontSize: FZ(15),
      fontWeight: 700,
      borderColor: materialCode === g ? COLORS.copper : COLORS.border,
      background: materialCode === g ? `${COLORS.copper}22` : COLORS.bgPanel2,
      color: materialCode === g ? COLORS.copperBright : COLORS.textDim
    }
  }, g)))), /*#__PURE__*/React.createElement(Field, {
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
  }, t)))), wireType && /*#__PURE__*/React.createElement(Field, {
    label: wireType === "Dây ủ mềm" ? "Khách hàng (Dây ủ mềm — thành phẩm tại đây)" : "Khách hàng (Dây cứng — theo dõi đơn hàng)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(UserIcon, {
    size: 14,
    style: {
      position: "absolute",
      left: 10,
      top: 11,
      color: COLORS.textFaint
    }
  }), /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    style: {
      paddingLeft: 30
    },
    list: "mes-kt-customers",
    value: customer,
    onChange: e => setCustomer(e.target.value),
    placeholder: "Nhập tên khách hàng..."
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "mes-kt-customers"
  }, [...new Set(orders.map(o => o.customer).filter(Boolean))].sort().map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      color: wireType === "Dây ủ mềm" ? COLORS.amber : COLORS.blue,
      marginTop: 4
    }
  }, wireType === "Dây ủ mềm" ? "Dây ủ mềm kéo trung xong là thành phẩm — sản lượng tính luôn vào thành phẩm của khách hàng này." : customer ? "✓ Dây cứng + Khách hàng = Thành phẩm Kéo trung cho đơn hàng này — sản lượng cập nhật vào tiến độ đơn." : "Để trống = Phôi nội bộ cho Kéo tinh/Ủ nhiệt. Điền tên khách hàng = Thành phẩm Kéo trung của đơn đó.")), /*#__PURE__*/React.createElement(Field, {
    label: "Đường kính dây (mm)"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "number",
    min: "0",
    step: "0.001",
    value: diameter,
    onChange: e => setDiameter(e.target.value),
    placeholder: "ví dụ: 0.254"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Số lượng (kg)"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    type: "number",
    min: "0",
    step: "0.1",
    value: qty,
    onChange: e => setQty(e.target.value),
    placeholder: "ví dụ: 500"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Ca sản xuất"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: note,
    onChange: e => setNote(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "Ca ngày"
  }, "Ca ngày"), /*#__PURE__*/React.createElement("option", {
    value: "Ca đêm"
  }, "Ca đêm")))), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13),
      color: msg.includes("thành công") ? COLORS.green : COLORS.red,
      marginBottom: 10
    }
  }, msg), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: handleSubmit,
    style: {
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Save, {
    size: 14
  }), " Ghi nhận sản lượng Kéo trung")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 16,
      border: `1px solid ${COLORS.green}55`,
      borderTop: `4px solid ${COLORS.green}`,
      boxShadow: `0 2px 8px ${COLORS.green}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(12),
      fontWeight: 700,
      color: COLORS.textDim,
      textTransform: "uppercase",
      letterSpacing: ".03em",
      marginBottom: 10
    }
  }, "Sản lượng đã kéo hôm nay & tổng hợp"), summary.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: Gauge,
    title: "Chưa có dữ liệu",
    hint: "Ghi nhận sản lượng bên trái để thấy tổng hợp."
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, summary.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      background: COLORS.bgInset,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: FZ(13),
      fontWeight: 600
    }
  }, s.label), /*#__PURE__*/React.createElement("span", {
    className: "mes-mono",
    style: {
      fontWeight: 700,
      color: COLORS.copperBright
    }
  }, fmtNum(s.qty), " kg"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderTop: `1px solid ${COLORS.border}`,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, "Tổng cộng"), /*#__PURE__*/React.createElement("span", {
    className: "mes-mono",
    style: {
      fontWeight: 800,
      color: COLORS.copperBright
    }
  }, fmtNum(totalKg), " kg")))), VALID_GRADES.map(g => {
    const needList = ordersByMat[g] || [];
    if (!needList.length) return null;
    const totalNeed = needList.reduce((a, o) => a + (o._remainingNeed || 0), 0);
    return /*#__PURE__*/React.createElement("div", {
      key: g,
      className: "mes-card",
      style: {
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: FZ(12),
        fontWeight: 700,
        color: COLORS.amber
      }
    }, "Mã ", g, " — ", needList.length, " đơn hàng đang cần nguyên liệu từ Kéo trung"), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: FZ(12),
        color: COLORS.textFaint,
        marginBottom: 1
      }
    }, "Tổng cần kéo"), /*#__PURE__*/React.createElement("div", {
      className: "mes-mono",
      style: {
        fontSize: FZ(15),
        fontWeight: 800,
        color: COLORS.copperBright
      }
    }, fmtNum(totalNeed), " kg"))), needList.slice(0, 5).map(o => /*#__PURE__*/React.createElement("div", {
      key: o.id,
      style: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: FZ(13),
        padding: "5px 0",
        borderBottom: `1px solid ${COLORS.border}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, o.customer, " · ", o.spec), /*#__PURE__*/React.createElement("span", {
      className: "mes-mono",
      style: {
        color: COLORS.amber,
        fontWeight: 700
      }
    }, "Còn ", fmtNum(o._remainingNeed), " kg"))), needList.length > 4 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: FZ(12),
        color: COLORS.textFaint,
        marginTop: 4
      }
    }, "+ ", needList.length - 4, " đơn khác..."), needList.length > 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: FZ(13),
        padding: "7px 0 0",
        borderTop: `2px solid ${COLORS.border}`,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: COLORS.textDim
      }
    }, "Tổng cộng Mã ", g), /*#__PURE__*/React.createElement("span", {
      className: "mes-mono",
      style: {
        fontWeight: 800,
        color: COLORS.copperBright
      }
    }, fmtNum(totalNeed), " kg")));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 18,
      border: `1px solid ${COLORS.copper}40`,
      borderTop: `4px solid ${COLORS.copper}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowEntries(o => !o),
    className: "mes-btn",
    style: {
      width: "100%",
      justifyContent: "space-between",
      borderColor: COLORS.border,
      background: "transparent",
      padding: "8px 12px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(History, {
    size: 15,
    color: COLORS.blue
  }), " Lịch sử nhập Kéo trung (", entries.length, " lượt)"), showEntries ? /*#__PURE__*/React.createElement(ChevronUp, {
    size: 15
  }) : /*#__PURE__*/React.createElement(ChevronDown, {
    size: 15
  })), showEntries && /*#__PURE__*/React.createElement("div", {
    className: "mes-scroll-x",
    style: {
      maxHeight: 360,
      overflowY: "auto",
      marginTop: 12
    }
  }, entries.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: History,
    title: "Chưa có lượt nhập"
  }) : /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ngày"), /*#__PURE__*/React.createElement("th", null, "Mã liệu"), /*#__PURE__*/React.createElement("th", null, "ĐK dây (mm)"), /*#__PURE__*/React.createElement("th", null, "Loại dây / Khách hàng"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right"
    }
  }, "Số lượng"), /*#__PURE__*/React.createElement("th", null, "Ca"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, entries.map(e => /*#__PURE__*/React.createElement("tr", {
    key: e.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, fmtDate(e.date)), /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 700
    }
  }, e.materialCode || "—"), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono"
  }, e.diameter || "—"), /*#__PURE__*/React.createElement("td", null, e.wireType || "—", e.wireType === "Dây ủ mềm" && e.customer && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.amber,
      marginLeft: 6,
      fontSize: FZ(12)
    }
  }, "(", e.customer, ")")), /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      textAlign: "right",
      fontWeight: 700,
      color: COLORS.copperBright
    }
  }, fmtNum(e.qty), " kg"), /*#__PURE__*/React.createElement("td", {
    style: {
      color: COLORS.textFaint
    }
  }, e.note || "—", fmtTime(e.ts) && /*#__PURE__*/React.createElement("div", {
    className: "mes-mono",
    style: {
      fontSize: FZ(12),
      color: COLORS.textFaint
    }
  }, fmtTime(e.ts))), /*#__PURE__*/React.createElement("td", {
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
      if (await askConfirm(`Xóa lượt nhập ${fmtNum(e.qty)} kg — Mã ${e.materialCode} ${e.wireType}?`, {
        danger: true,
        confirmLabel: "Xóa"
      })) onDeleteEntry(e.id);
    },
    title: "Xóa"
  })))))))), editing && /*#__PURE__*/React.createElement(ProductionEntryEditModal, {
    entry: editing,
    onClose: () => setEditing(null),
    onSave: onEditEntry
  }));
}

