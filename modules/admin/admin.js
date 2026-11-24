function AdminPage({
  users,
  auditLog,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onResetSeedData
}) {
  const {
    askConfirm,
    showAlert
  } = useDialog();
  const [modal, setModal] = useState(null);
  const [auditFilter, setAuditFilter] = useState("all");
  const adminCount = users.filter(u => u.role === "admin").length;
  const filteredAudit = auditFilter === "all" ? auditLog : auditLog.filter(a => a.type === auditFilter);
  async function handleDelete(u) {
    if (u.username === currentUser.username) {
      showAlert("Bạn không thể xóa tài khoản đang đăng nhập.");
      return;
    }
    if (u.role === "admin" && adminCount <= 1) {
      showAlert("Phải có ít nhất một quản trị viên.");
      return;
    }
    if (await askConfirm(`Xóa tài khoản ${u.username}?`, {
      danger: true,
      confirmLabel: "Xóa"
    })) { try { await onDeleteUser(u.username); } catch (e) { showAlert(e.message || String(e)); } }
  }
  return /*#__PURE__*/React.createElement("div", null, (() => {
    const [fbUrl, setFbUrl] = React.useState(() => getFirebaseUrl());
    const [fbStatus, setFbStatus] = React.useState("");
    const [fbTesting, setFbTesting] = React.useState(false);
    async function testAndSave() {
      if (!fbUrl.trim()) {
        setFirebaseUrl("");
        setFbStatus("✓ Đã tắt đồng bộ Firebase.");
        return;
      }
      setFbTesting(true);
      setFbStatus("Đang kiểm tra kết nối...");
      try {
        const r = await fetch(`${fbUrl.replace(/\/$/, "")}/mes_ping.json`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ts: Date.now()
          })
        });
        if (r.ok) {
          setFirebaseUrl(fbUrl.trim());
          setFbStatus("✅ Kết nối thành công! Đồng bộ đã được bật — tất cả máy dùng chung link này sẽ chia sẻ dữ liệu.");
        } else {
          setFbStatus(`❌ Lỗi ${r.status} — kiểm tra lại URL hoặc quy tắc bảo mật Firebase.`);
        }
      } catch (e) {
        setFbStatus("❌ Không kết nối được. Kiểm tra URL Firebase và kết nối mạng.");
      }
      setFbTesting(false);
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "mes-card",
      style: {
        padding: 20,
        marginBottom: 20,
        border: `1px solid ${COLORS.orange}55`,
        borderTop: `4px solid ${COLORS.orange}`,
        boxShadow: `0 2px 8px ${COLORS.orange}22`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.copperBright})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(RefreshCw, {
      size: 18,
      color: "#fff"
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "mes-mono",
      style: {
        fontSize: FZ(12),
        color: "#C2410C",
        letterSpacing: ".07em",
        textTransform: "uppercase"
      }
    }, "Đồng bộ đa thiết bị"), /*#__PURE__*/React.createElement("div", {
      className: "mes-display",
      style: {
        fontSize: FZ(16),
        fontWeight: 700
      }
    }, "Kết nối Firebase — chia sẻ dữ liệu thật sự")), getFirebaseUrl() && /*#__PURE__*/React.createElement(Badge, {
      color: COLORS.green
    }, "● Đang đồng bộ")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: COLORS.bgInset,
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 14,
        fontSize: FZ(13),
        lineHeight: 1.7
      }
    }, /*#__PURE__*/React.createElement("b", null, "Hướng dẫn thiết lập Firebase (miễn phí, 5 phút):"), /*#__PURE__*/React.createElement("br", null), "1. Vào ", /*#__PURE__*/React.createElement("b", null, "console.firebase.google.com"), " → đăng nhập Google → ", /*#__PURE__*/React.createElement("b", null, "Tạo dự án"), /*#__PURE__*/React.createElement("br", null), "2. Chọn ", /*#__PURE__*/React.createElement("b", null, "Realtime Database"), " → ", /*#__PURE__*/React.createElement("b", null, "Tạo cơ sở dữ liệu"), " → chọn ", /*#__PURE__*/React.createElement("b", null, "Test mode"), /*#__PURE__*/React.createElement("br", null), "3. Copy URL dạng ", /*#__PURE__*/React.createElement("code", {
      style: {
        color: COLORS.copperBright
      }
    }, "https://ten-du-an-default-rtdb.firebaseio.com"), /*#__PURE__*/React.createElement("br", null), "4. Dán vào ô bên dưới → bấm ", /*#__PURE__*/React.createElement("b", null, "Lưu & kiểm tra")), /*#__PURE__*/React.createElement(Field, {
      label: "Firebase Realtime Database URL"
    }, /*#__PURE__*/React.createElement("input", {
      className: "mes-input",
      value: fbUrl,
      onChange: e => setFbUrl(e.target.value),
      placeholder: "https://your-project-default-rtdb.firebaseio.com"
    })), fbStatus && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: FZ(13),
        padding: "8px 12px",
        borderRadius: 8,
        marginBottom: 10,
        background: fbStatus.includes("✅") ? `${COLORS.green}18` : fbStatus.includes("❌") ? `${COLORS.red}18` : COLORS.bgInset,
        color: fbStatus.includes("✅") ? COLORS.green : fbStatus.includes("❌") ? COLORS.red : COLORS.textDim
      }
    }, fbStatus), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: testAndSave,
      disabled: fbTesting,
      style: {
        flex: 1,
        justifyContent: "center"
      }
    }, fbTesting ? /*#__PURE__*/React.createElement(Loader2, {
      size: 14
    }) : /*#__PURE__*/React.createElement(CheckCircle2, {
      size: 14
    }), fbTesting ? "Đang kiểm tra..." : "Lưu & kiểm tra kết nối"), getFirebaseUrl() && /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        setFbUrl("");
        setFirebaseUrl("");
        setFbStatus("Đã tắt đồng bộ.");
      },
      style: {
        color: COLORS.red
      }
    }, /*#__PURE__*/React.createElement(X, {
      size: 14
    }), " Tắt đồng bộ")));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 20,
      marginBottom: 20,
      border: `1px solid ${COLORS.green}55`,
      borderTop: `4px solid ${COLORS.green}`,
      boxShadow: `0 2px 8px ${COLORS.green}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: `linear-gradient(135deg, ${COLORS.green}, #1E7E34)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(ArrowRight, {
    size: 18,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mes-mono",
    style: {
      fontSize: FZ(12),
      color: COLORS.green,
      letterSpacing: ".07em",
      textTransform: "uppercase"
    }
  }, "Phân quyền truy cập"), /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: FZ(16),
      fontWeight: 700
    }
  }, "Chia sẻ đường dẫn cho nhân viên"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13),
      fontWeight: 700,
      color: COLORS.text,
      marginBottom: 12
    }
  }, "Hướng dẫn chia sẻ ứng dụng cho nhân viên"), [{
    step: "1",
    title: "Bấm nút Share (Chia sẻ)",
    desc: 'Tìm nút "Share" hoặc biểu tượng chia sẻ ở góc trên bên phải của khung ứng dụng này trong Claude.ai.',
    color: COLORS.blue
  }, {
    step: "2",
    title: 'Bật "Public access"',
    desc: 'Trong hộp thoại chia sẻ, bật tuỳ chọn "Public" hoặc "Anyone with link can view" để tạo link công khai.',
    color: COLORS.green
  }, {
    step: "3",
    title: "Copy link và gửi cho nhân viên",
    desc: "Copy đường dẫn vừa tạo, gửi qua Zalo/Messenger cho từng tổ. Nhân viên mở link → đăng nhập bằng tài khoản tổ bên dưới.",
    color: COLORS.copper
  }].map(item => /*#__PURE__*/React.createElement("div", {
    key: item.step,
    style: {
      display: "flex",
      gap: 12,
      marginBottom: 12,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: `${item.color}25`,
      border: `1px solid ${item.color}60`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontWeight: 800,
      color: item.color,
      fontSize: FZ(13)
    }
  }, item.step), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: FZ(13),
      marginBottom: 2
    }
  }, item.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13),
      color: COLORS.textDim,
      lineHeight: 1.5
    }
  }, item.desc)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `${COLORS.amber}15`,
      border: `1px solid ${COLORS.amber}40`,
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: FZ(13),
      color: COLORS.amber,
      marginTop: 8
    }
  }, "⚠️ Khi dùng link công khai, tất cả nhân viên trên các máy khác nhau đều truy cập cùng 1 cơ sở dữ liệu — đơn hàng, sản lượng, điểm danh đều được đồng bộ theo thời gian thực.")), /*#__PURE__*/React.createElement(LegacyAccountsPanel, { users: users, onRemoved: () => {} })), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Quản trị hệ thống",
    title: "Quản lý tài khoản & phân quyền",
    icon: ShieldCheck,
    iconColor: COLORS.violet,
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setModal({
        data: {
          username: "",
          fullName: "",
          role: "employee",
          team: ""
        },
        isNew: true
      })
    }, /*#__PURE__*/React.createElement(Plus, {
      size: 14
    }), " Tạo tài khoản")
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-card mes-scroll-x",
    style: {
      marginBottom: 24,
      border: `1px solid ${COLORS.violet}55`,
      borderTop: `4px solid ${COLORS.violet}`,
      boxShadow: `0 2px 8px ${COLORS.violet}22`
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Tài khoản đăng nhập"), /*#__PURE__*/React.createElement("th", null, "Họ và tên"), /*#__PURE__*/React.createElement("th", null, "Vai trò"), /*#__PURE__*/React.createElement("th", null, "Tổ"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, users.map(u => /*#__PURE__*/React.createElement("tr", {
    key: u.username
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mes-mono",
    style: {
      fontWeight: 700,
      color: COLORS.copperBright
    }
  }, u.username), u.username === currentUser.username && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.textFaint,
      fontSize: FZ(12)
    }
  }, "(bạn)"), u.username.includes(" ") && /*#__PURE__*/React.createElement("span", {
    title: "Tên đăng nhập có khoảng trắng — cần gõ chính xác khi đăng nhập",
    style: {
      color: COLORS.amber,
      fontSize: FZ(12)
    }
  }, "⚠️"))), /*#__PURE__*/React.createElement("td", null, u.fullName), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    color: u.role === "admin" ? COLORS.copper : u.role === "manager" ? COLORS.violet : COLORS.blue
  }, amgRoleValueLabel(u.role)), u.disabled && /*#__PURE__*/React.createElement(Badge, { color: COLORS.red }, "Đã khóa")), /*#__PURE__*/React.createElement("td", null, u.team || "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      display: "flex",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: Pencil,
    onClick: () => setModal({
      data: u,
      isNew: false
    }),
    title: "Sửa"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: Trash2,
    danger: true,
    onClick: () => handleDelete(u),
    title: "Xóa"
  }))))))), /*#__PURE__*/React.createElement(BackupCard, null), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Dữ liệu hệ thống",
    title: "Nhập dữ liệu mẫu vào mục trống",
    icon: RefreshCw,
    iconColor: COLORS.red
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      padding: 16,
      marginBottom: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap",
      border: `1px solid ${COLORS.red}55`,
      borderTop: `4px solid ${COLORS.red}`,
      boxShadow: `0 2px 8px ${COLORS.red}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13),
      color: COLORS.textDim,
      maxWidth: 520
    }
  }, "Chỉ dùng khi một mục (đơn hàng / máy móc / nhân sự / phế liệu) hoàn toàn trống, để nạp bộ dữ liệu gốc (37 đơn hàng, 160 máy, 53 nhân viên từ báo cáo tháng 6/2026). ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: COLORS.amber
    }
  }, "Lưu ý: mục nào đã có dữ liệu sẽ được giữ nguyên, không bị xóa hay ghi đè"), " (không ảnh hưởng tài khoản đăng nhập)."), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: async () => {
      if (await askConfirm("Nhập dữ liệu mẫu vào các mục đang trống? Mục nào đã có dữ liệu sẽ được giữ nguyên.", {
        danger: false,
        confirmLabel: "Nhập dữ liệu"
      })) onResetSeedData();
    }
  }, /*#__PURE__*/React.createElement(RefreshCw, {
    size: 14
  }), " Nhập dữ liệu mẫu vào mục trống")), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: `${auditLog.length} bản ghi`,
    title: "Nhật ký theo dõi chỉnh sửa",
    icon: History,
    iconColor: COLORS.blue,
    action: /*#__PURE__*/React.createElement("select", {
      className: "mes-input",
      style: {
        width: 220
      },
      value: auditFilter,
      onChange: e => setAuditFilter(e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: "all"
    }, "Tất cả hoạt động"), /*#__PURE__*/React.createElement("option", {
      value: "order_add"
    }, "Thêm đơn hàng"), /*#__PURE__*/React.createElement("option", {
      value: "order_update"
    }, "Sửa đơn hàng"), /*#__PURE__*/React.createElement("option", {
      value: "order_delete"
    }, "Xóa đơn hàng"), /*#__PURE__*/React.createElement("option", {
      value: "production_entry"
    }, "Nhập sản lượng"), /*#__PURE__*/React.createElement("option", {
      value: "machine_update"
    }, "Cập nhật máy móc"), /*#__PURE__*/React.createElement("option", {
      value: "scrap_add"
    }, "Ghi nhận phế liệu"), /*#__PURE__*/React.createElement("option", {
      value: "staff_update"
    }, "Nhân sự"), /*#__PURE__*/React.createElement("option", {
      value: "user_update"
    }, "Tài khoản"))
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-card",
    style: {
      maxHeight: 420,
      overflowY: "auto",
      border: `1px solid ${COLORS.blue}55`,
      borderTop: `4px solid ${COLORS.blue}`,
      boxShadow: `0 2px 8px ${COLORS.blue}22`
    }
  }, filteredAudit.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: History,
    title: "Chưa có hoạt động nào"
  }) : /*#__PURE__*/React.createElement("table", {
    className: "mes-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Thời gian"), /*#__PURE__*/React.createElement("th", null, "Người thực hiện"), /*#__PURE__*/React.createElement("th", null, "Nội dung"))), /*#__PURE__*/React.createElement("tbody", null, filteredAudit.map(a => /*#__PURE__*/React.createElement("tr", {
    key: a.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "mes-mono",
    style: {
      whiteSpace: "nowrap",
      color: COLORS.textFaint,
      fontSize: FZ(12)
    }
  }, fmtDateTime(a.ts)), /*#__PURE__*/React.createElement("td", {
    style: {
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, a.user), /*#__PURE__*/React.createElement("td", {
    style: {
      color: COLORS.textDim
    }
  }, a.detail)))))), modal && /*#__PURE__*/React.createElement(UserFormModal, {
    initial: modal.data,
    isNew: modal.isNew,
    onClose: () => setModal(null),
    onSave: (payload, isNew) => isNew ? onAddUser(payload) : onUpdateUser(payload)
  }));
}

