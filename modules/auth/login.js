/* ===================== LOGIN SCREEN ===================== */
function LoginScreen({
  users,
  onLogin,
  storageError
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function handleSubmit() {
    setErr("");
    setBusy(true);
    const uname = username.trim().toLowerCase();
    const denied = "Tài khoản chưa được cấp quyền, đã bị khóa hoặc đã bị gỡ. Liên hệ Admin.";
    try {
      let profile = null;
      let authFailed = false;
      if (auth && !window.__isOfflineDb) {
        try {
          const emailAddr = uname.includes("@") ? uname : uname + "@xuongdong.com";
          const cred = await auth.signInWithEmailAndPassword(emailAddr, password);
          const snap = await db.collection("users").doc(cred.user.uid).get();
          // v46: có đăng nhập Firebase nhưng KHÔNG có hồ sơ phân quyền → từ chối (trước đây tự cấp quyền Nhân viên)
          if (!snap.exists() || snap.data().disabled) {
            try { await auth.signOut(); } catch (e2) {}
            setErr(denied);
            setBusy(false);
            return;
          }
          profile = { uid: cred.user.uid, username: snap.data().username || uname, ...snap.data() };
        } catch (e) {
          authFailed = true;
        }
      }
      if (!profile) {
        // Chạy cục bộ (không Firebase): so băm SHA-256 với hồ sơ tài khoản do Admin lập
        const h = await sha256Hex("amg:" + uname + ":" + password);
        if (!auth || window.__isOfflineDb) {
          const u = (users || []).find(x => String(x.username || "").toLowerCase() === uname && x.pwHash === h);
          if (u) {
            if (u.disabled) { setErr(denied); setBusy(false); return; }
            const { pwHash, ...p } = u;
            profile = p;
          }
        }
        // Dự phòng: chỉ tài khoản Admin khởi tạo (DEFAULT_USERS)
        if (!profile && AMG_CONFIG.legacyLogin) {
          const found = DEFAULT_USERS.find(u => u.username.toLowerCase() === uname && u.pwHash === h);
          if (found) { const { pwHash, ...p } = found; profile = p; }
        }
      }
      if (profile) onLogin(profile); else setErr("Sai tài khoản hoặc mật khẩu.");
    } finally {
      setBusy(false);
    }
  }
  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }
  function quickFill(u) {
    // v45: chỉ điền tên đăng nhập, không điền sẵn mật khẩu
    setUsername(u);
    setPassword("");
  }
  // v46: bỏ đăng nhập nhanh theo tổ (tài khoản dùng chung đã loại bỏ)
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-root mes-login-shell",
    style: {
      height: "100vh",
      width: "100vw",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0A2A52",
      overflow: "hidden",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(GlobalStyle, null),
  /* Lớp nền mờ lấp đầy toàn màn hình bằng chính ảnh (tránh dải trống khi tỉ lệ màn hình khác ảnh gốc) — chỉ hiện trên máy tính */
  /*#__PURE__*/React.createElement("div", {
    className: "mes-login-blur-bg",
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `url(${LOGIN_FULL_BG_DATA_URI})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "blur(60px) brightness(.92) saturate(1.15)",
      transform: "scale(1.25)"
    }
  }),
  /* Viền chuyển tiếp mềm giữa ảnh nét và nền mờ, tránh cảm giác "cắt dán" — chỉ hiện trên máy tính */
  /*#__PURE__*/React.createElement("div", {
    className: "mes-login-vignette",
    style: {
      position: "absolute",
      inset: 0,
      boxShadow: "inset 0 0 140px 40px rgba(10,30,60,.25)",
      pointerEvents: "none"
    }
  }),
  /* Khối ảnh chính giữ NGUYÊN tỷ lệ gốc 1672:941 trên máy tính — trên điện thoại chuyển thành khung trơn */
  /*#__PURE__*/React.createElement("div", {
    className: "mes-login-hero",
    style: {
      position: "relative",
      width: "min(100vw, calc(100vh * 1672 / 941))",
      aspectRatio: "1672 / 941",
      margin: "auto",
      backgroundImage: `url(${LOGIN_FULL_BG_DATA_URI})`,
      backgroundSize: "100% 100%",
      backgroundRepeat: "no-repeat",
      boxShadow: "0 0 90px 20px rgba(5,15,35,.35)"
    }
  },
  /* Khung đăng nhập thật, đặt đúng vị trí % của khung trong ảnh maket trên máy tính — full-width trên điện thoại */
  /*#__PURE__*/React.createElement("div", {
    className: "mes-fade-in mes-login-card",
    style: {
      position: "absolute",
      left: "60.4%",
      top: "23%",
      width: "27.6%",
      height: "63.1%",
      overflowY: "auto",
      background: "#FFFFFF",
      borderRadius: "1.6%",
      padding: "1.5% 1.7%",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: LOGO_DATA_URI,
    alt: "Logo",
    style: {
      width: "16%",
      aspectRatio: "1 / 1",
      borderRadius: 10,
      objectFit: "contain",
      background: "#fff",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mes-display",
    style: {
      fontSize: "clamp(13px, 1.1vw, 17px)",
      fontWeight: 800,
      lineHeight: 1.15
    }
  }, COMPANY_NAME), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "clamp(9px, .78vw, 12px)",
      color: COLORS.textDim
    }
  }, "Xưởng Đồng · MES — Hệ thống quản lý sản xuất"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "clamp(8px, .68vw, 10.5px)",
      color: COLORS.textFaint,
      marginBottom: 10
    }
  }, COMPANY_FULL_NAME), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.border,
      margin: "1.2% 0"
    }
  }), storageError && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.redDim,
      border: `1px solid #F5B5B1`,
      borderRadius: 8,
      padding: "10px 12px",
      fontSize: 12.5,
      color: "#B42318",
      marginBottom: 14,
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(AlertTriangle, {
    size: 15,
    style: {
      flexShrink: 0,
      marginTop: 1
    }
  }), "Không thể kết nối bộ nhớ lưu trữ. Dữ liệu có thể không được lưu lại giữa các lần tải lại trang."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Field, {
    label: "Tài khoản"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(UserIcon, {
    size: 15,
    style: {
      position: "absolute",
      left: 10,
      top: 10,
      color: COLORS.textFaint
    }
  }), /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    style: {
      paddingLeft: 32,
      paddingRight: username ? 32 : 11
    },
    value: username,
    onChange: e => setUsername(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder: "ví dụ: admin",
    autoFocus: true
  }), username && /*#__PURE__*/React.createElement(CheckCircle2, {
    size: 15,
    color: COLORS.green,
    style: {
      position: "absolute",
      right: 10,
      top: 10
    }
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Mật khẩu"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Lock, {
    size: 15,
    style: {
      position: "absolute",
      left: 10,
      top: 10,
      color: COLORS.textFaint
    }
  }), /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    style: {
      paddingLeft: 32,
      paddingRight: 32
    },
    type: showPw ? "text" : "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder: "••••••••"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowPw(s => !s),
    style: {
      position: "absolute",
      right: 8,
      top: 7,
      background: "none",
      border: "none",
      color: COLORS.textFaint,
      cursor: "pointer"
    }
  }, showPw ? /*#__PURE__*/React.createElement(EyeOff, {
    size: 15
  }) : /*#__PURE__*/React.createElement(Eye, {
    size: 15
  })))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.red,
      fontSize: 12.5,
      marginBottom: 12
    }
  }, err), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    type: "button",
    onClick: handleSubmit,
    disabled: busy,
    style: {
      width: "100%",
      justifyContent: "center",
      padding: "3% 0",
      fontSize: "clamp(12px, 1vw, 15px)",
      borderRadius: 12,
      background: `linear-gradient(90deg, #F1291E, #C81118)`,
      boxShadow: "0 8px 20px rgba(200,17,24,.4)"
    }
  }, busy ? /*#__PURE__*/React.createElement(Loader2, {
    size: 16,
    className: "pulse-dot"
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ChevronRight, {
    size: 15
  }), /*#__PURE__*/React.createElement(ChevronRight, {
    size: 15,
    style: {
      marginLeft: -10
    }
  })), " Đăng nhập")), /*#__PURE__*/React.createElement("div", { style: { marginTop: "3%", fontSize: "clamp(8px, .7vw, 11px)", color: COLORS.textFaint, textAlign: "center" } }, "Mỗi người đăng nhập bằng tài khoản riêng do Admin cấp."))));
}

