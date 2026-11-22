/* ═══════════════════════════════════════════════════════════════
   ★  UI KIT DÙNG CHUNG (bị thiếu trong bản build gốc)  ★
   Các component dưới đây được gọi ở khắp file (Button, Modal, Badge,
   Field, IconButton, ProgressBar, SectionHeading, EmptyState,
   GlobalStyle, DialogProvider/useDialog) nhưng chưa từng được định
   nghĩa ⇒ ứng dụng crash ngay khi render (ReferenceError). Khôi phục
   lại đầy đủ, đồng bộ theo COLORS / FONT_* / className "mes-*" đã
   dùng sẵn trong phần còn lại của file.
═══════════════════════════════════════════════════════════════ */

/* ---------- GlobalStyle: font + class "mes-*" dùng khắp app ---------- */
function GlobalStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    @media (min-width: 861px) { .mes-app-shell{zoom:1.3;} }
    .mes-modal-card{zoom:1;}
    @media (min-width: 861px) { .mes-modal-card{zoom:0.77;} }
    html,body{background:${COLORS.bg};color:${COLORS.text};}
    .mes-root{font-family:${FONT_BODY};}
    .mes-display{font-family:${FONT_DISPLAY};}
    .mes-mono{font-family:${FONT_MONO};}
    .mes-card{background:${COLORS.bgPanel};border:1.5px solid ${COLORS.borderLight};border-radius:14px;box-shadow:0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);}
    .mes-fade-in{animation:mesFadeIn .25s ease;}
    @keyframes mesFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    .mes-input{width:100%;background:${COLORS.bgInset};border:1.5px solid ${COLORS.borderLight};border-radius:8px;color:${COLORS.text};padding:9px 11px;font-size:13.5px;outline:none;font-family:inherit;}
    .mes-input:focus{border-color:${COLORS.copper};}
    .mes-btn{transition:filter .15s ease,opacity .15s ease;}
    .mes-btn:hover{filter:brightness(1.08);}
    .mes-btn-ghost{background:transparent;color:${COLORS.textDim};border:1px solid transparent;border-radius:8px;cursor:pointer;}
    .mes-btn-ghost:hover{background:${COLORS.bgPanel2};}
    .mes-table{width:100%;border-collapse:collapse;font-size:13px;}
    .mes-table th{text-align:left;padding:12px 10px;color:${COLORS.copperBright};background:${COLORS.bgInset};font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.045em;border-bottom:2px solid ${COLORS.copper}55;}
    .mes-table th:first-child{border-top-left-radius:8px;}
    .mes-table th:last-child{border-top-right-radius:8px;}
    .mes-table td{padding:10px;border-bottom:1px solid ${COLORS.border};}
    .mes-scroll-x{overflow-x:auto;max-height:min(360px,50vh);overflow-y:auto;}
    .mes-table thead th{position:sticky;top:0;z-index:2;}
    .mes-flow-line{color:${COLORS.textFaint};font-size:12.5px;}
    ::-webkit-scrollbar{width:9px;height:9px;}
    ::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:6px;}
    @media print{.mes-sidebar,.mes-topbar,.mes-no-print,.mes-sidebar-overlay{display:none !important;} .mes-app-shell{zoom:1 !important;} body{background:#fff !important;color:#000 !important;} .mes-card{box-shadow:none !important;}}
    .pulse-dot{animation:mesPulse 1.4s ease-in-out infinite;}
    @keyframes mesPulse{0%,100%{opacity:1}50%{opacity:.35}}


    /* ═══════════════ v47: bảng thích ứng / thẻ thống kê / phân trang ═══════════════ */
    .amg-clamp{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:1.3;}
    .amg-hdr{display:grid;align-items:center;gap:8px;padding:10px 12px;background:${COLORS.bgInset};border-bottom:2px solid ${COLORS.border};font-size:11.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${COLORS.copperBright};}
    .amg-row{display:grid;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid ${COLORS.border};border-left:4px solid transparent;font-size:12.5px;cursor:pointer;transition:background .15s ease,border-color .2s ease;}
    .amg-row:hover{background:${COLORS.bgPanel2};}
    .amg-row--card{display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px;}
    .amg-row--sel{background:${COLORS.copper}12;}
    .amg-kv-l{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${COLORS.textFaint};line-height:1.2;}
    .amg-kv-v{font-size:12.5px;font-weight:600;color:${COLORS.text};overflow-wrap:anywhere;}
    .amg-kpi{padding:10px 12px;text-align:left;min-width:0;border-radius:12px;background:${COLORS.bgPanel};border:1.5px solid ${COLORS.border};border-left-width:5px;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:background .2s ease,border-color .2s ease,box-shadow .2s ease,transform .12s ease;font-family:inherit;color:inherit;}
    button.amg-kpi{cursor:pointer;}
    button.amg-kpi:hover{box-shadow:0 3px 10px rgba(15,23,42,.10);}
    button.amg-kpi:active{transform:scale(.985);}
    .amg-kpi--on{box-shadow:0 0 0 2px var(--amg-kpi-c) inset;}
    .amg-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid ${COLORS.border};background:${COLORS.bgInset};border-radius:0 0 12px 12px;}
    .amg-pg{min-width:30px;height:30px;padding:0 8px;border-radius:8px;border:1px solid ${COLORS.border};background:${COLORS.bgPanel};color:${COLORS.text};font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;}
    .amg-pg:disabled{opacity:.4;cursor:not-allowed;}
    .amg-pg--on{background:${COLORS.copper};border-color:${COLORS.copper};color:#fff;}
    .amg-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:800;white-space:nowrap;}
    .amg-pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;}
    .amg-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
    .amg-toolbar .mes-input{width:auto;min-width:0;}
    .amg-mcard{transition:border-color .25s ease,box-shadow .25s ease,background .25s ease;}
    @media (prefers-reduced-motion: reduce){.pulse-dot{animation:none !important;} .amg-kpi,.amg-row,.amg-mcard{transition:none !important;}}

    /* ═══════════════ RESPONSIVE / MOBILE (≤860px) ═══════════════ */
    .mes-hamburger-btn{display:none;}
    .mes-sidebar-close{display:none;}
    .mes-sidebar-overlay{display:none;}

    @media (max-width: 860px){
      .mes-topbar-shift{display:none !important;}
      /* Màn hình đăng nhập: bỏ ảnh nền tỷ lệ ngang (chỉ hợp máy tính), chuyển thành khung gọn dễ thao tác */
      .mes-login-shell{
        background: linear-gradient(160deg, #0A2A52, #1a3d6e) !important;
        align-items: flex-start !important;
        overflow-y: auto !important;
        height: auto !important;
        min-height: 100vh !important;
        padding: 28px 16px !important;
      }
      .mes-login-blur-bg, .mes-login-vignette{ display:none !important; }
      .mes-login-hero{
        width: 100% !important;
        max-width: 440px !important;
        aspect-ratio: auto !important;
        background-image: none !important;
        box-shadow: none !important;
        margin: 0 auto !important;
        position: static !important;
      }
      .mes-login-card{
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        border-radius: 18px !important;
      }
      /* Sidebar trở thành ngăn kéo (drawer) trượt từ trái, ẩn theo mặc định */
      .mes-sidebar{
        position:fixed !important;
        left:0; top:0;
        width:260px !important;
        max-width:82vw;
        height:100vh;
        z-index:300;
        transform:translateX(-100%);
        transition:transform .22s ease;
        box-shadow:2px 0 24px rgba(0,0,0,.5);
      }
      .mes-sidebar--open{ transform:translateX(0); }
      .mes-sidebar span, .mes-sidebar .mes-display{ white-space:nowrap !important; overflow:visible !important; }
      .mes-sidebar-close{ display:block !important; }
      .mes-sidebar-collapse-btn{ display:none !important; }

      .mes-sidebar-overlay{
        display:block;
        position:fixed; inset:0;
        background:rgba(3,5,8,.6);
        z-index:290;
        animation:mesFadeIn .18s ease;
      }

      .mes-hamburger-btn{ display:flex !important; }

      .mes-content-wrap{ padding:12px !important; }
      .mes-topbar{ padding:0 12px !important; }
      .mes-topbar-user{ display:none; }
      .mes-topbar-divider{ display:none; }

      .mes-card{ border-radius:12px; }
      .mes-table{ font-size:12px; }
      .mes-table th, .mes-table td{ padding:8px 7px; }

      /* Modal: gần full màn hình trên di động thay vì kích thước cố định desktop */
      .mes-mobile-modal-backdrop{ padding:8px !important; align-items:flex-end !important; }
      .mes-mobile-modal-backdrop > div{ max-height:94vh !important; border-radius:16px 16px 0 0 !important; }
    }
    @media (min-width: 861px){
      .mes-sidebar-close{ display:none !important; }
    }
  `);
}

