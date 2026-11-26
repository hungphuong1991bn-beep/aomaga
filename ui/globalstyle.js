/* ═══════════════════════════════════════════════════════════════
   UI KIT DÙNG CHUNG · v49 ERP/MES Premium
   Một nguồn CSS duy nhất: biến thiết kế (màu, chữ, khoảng cách, bo góc, bóng), khung ứng dụng, Sidebar, bảng, thẻ,
   nút, ô nhập, thẻ KPI, bố cục Dashboard, đáp ứng (Full HD / 2K / 4K / TV / tablet / điện thoại).
   Nguyên tắc bố cục (v49):
   • KHÔNG dùng CSS zoom để phóng cả ứng dụng. Cỡ chữ co giãn bằng biến --amg-fs theo độ phân giải.
   • Khung ứng dụng cao đúng bằng màn hình (100dvh), KHÔNG cuộn trang: Sidebar cuộn riêng, vùng nội dung cuộn riêng
     (hai vùng là anh em, nên lăn chuột trên Sidebar không bao giờ làm cuộn nội dung).
   • Vùng nội dung dùng 100% chiều rộng còn lại, không đặt max-width cố định; bảng co theo cột, không bị cắt.
═══════════════════════════════════════════════════════════════ */
function amgCssVars() {
  const C = COLORS;
  return `:root{
    --c-bg:${C.bg};--c-panel:${C.bgPanel};--c-panel2:${C.bgPanel2};--c-inset:${C.bgInset};
    --c-border:${C.border};--c-border2:${C.borderLight};
    --c-text:${C.text};--c-dim:${C.textDim};--c-faint:${C.textFaint};
    --c-brand:${amgBrand()};--c-brand-h:${amgBrandHover()};--c-copper:${C.copper};
    --c-green:${C.green};--c-amber:${C.amber};--c-red:${C.red};--c-blue:${C.blue};--c-violet:${C.violet};--c-orange:${C.orange};
    --c-navy:${C.navy};
    --font:${FONT_BODY};--font-mono:${FONT_MONO};
    --fs-xs:calc(12px*var(--amg-fs));--fs-sm:calc(13px*var(--amg-fs));--fs-md:calc(14px*var(--amg-fs));
    --fs-lg:calc(16px*var(--amg-fs));--fs-xl:calc(18px*var(--amg-fs));--fs-2xl:calc(22px*var(--amg-fs));--fs-3xl:calc(28px*var(--amg-fs));
    --r-sm:${AMG_RADIUS.sm}px;--r-md:${AMG_RADIUS.md}px;--r-lg:${AMG_RADIUS.lg}px;--r-xl:${AMG_RADIUS.xl}px;
    --sh-sm:${AMG_SHADOW.sm};--sh-md:${AMG_SHADOW.md};--sh-lg:${AMG_SHADOW.lg};
    --sb-w:calc(256px*var(--amg-fs));--sb-w-c:68px;
    --focus:0 0 0 3px ${C.blue}33;
  }`;
}

function GlobalStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    :root{--amg-fs:1;}
    @media (min-width:1700px){:root{--amg-fs:1.06;}}
    @media (min-width:2200px){:root{--amg-fs:1.25;}}
    @media (min-width:3000px){:root{--amg-fs:1.55;}}
    ${amgCssVars()}

    *,*::before,*::after{box-sizing:border-box;}
    html,body{height:100%;margin:0;background:var(--c-bg);color:var(--c-text);}
    body{font-family:var(--font);font-size:var(--fs-md);line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden;}
    #root{height:100%;min-height:0;overflow:auto;}
    .mes-root{font-family:var(--font);height:100%;}
    .mes-display{font-family:var(--font);letter-spacing:-.012em;}
    .mes-mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums;letter-spacing:-.01em;}
    .mes-num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}
    h1,h2,h3,h4{margin:0;}
    button,input,select,textarea{font-family:inherit;}
    :focus-visible{outline:2px solid var(--c-blue);outline-offset:2px;}
    ::selection{background:${COLORS.blue}33;}
    *{scrollbar-width:thin;scrollbar-color:var(--c-border2) transparent;}
    ::-webkit-scrollbar{width:10px;height:10px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:var(--c-border2);border-radius:8px;border:2px solid transparent;background-clip:content-box;}
    ::-webkit-scrollbar-thumb:hover{background:var(--c-faint);background-clip:content-box;}

    /* ═══════ KHUNG ỨNG DỤNG: cao bằng màn hình, hai vùng cuộn độc lập ═══════ */
    .mes-app-shell{display:flex;width:100%;height:100vh;height:100dvh;overflow:hidden;background:var(--c-bg);}
    .mes-main{flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;}
    .mes-content-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:auto;overscroll-behavior:contain;scroll-behavior:auto;}
    .mes-content-wrap{width:100%;max-width:none;margin:0;padding:clamp(14px,1.5vw,32px);min-width:0;}
    .mes-page{animation:mesPage .16s ease-out;min-width:0;}
    @keyframes mesPage{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
    .mes-fade-in{animation:mesPage .16s ease-out;}
    @keyframes mesFadeIn{from{opacity:0}to{opacity:1}}

    /* ═══════ SIDEBAR ═══════ */
    .mes-sidebar{width:var(--sb-w);flex:0 0 var(--sb-w);height:100%;min-height:0;display:flex;flex-direction:column;background:linear-gradient(190deg,${COLORS.sidebarBg},${COLORS.sidebarBg2});color:#fff;transition:width .18s ease,flex-basis .18s ease;box-shadow:1px 0 0 rgba(255,255,255,.04) inset,2px 0 16px rgba(7,26,49,.28);position:relative;z-index:60;}
    .mes-sidebar--collapsed{width:var(--sb-w-c);flex-basis:var(--sb-w-c);}
    .mes-sb-head{flex:0 0 auto;display:flex;align-items:center;gap:11px;padding:16px 14px;min-height:64px;border-bottom:1px solid rgba(255,255,255,.08);}
    .mes-sidebar--collapsed .mes-sb-head{justify-content:center;padding:16px 8px;}
    .mes-sb-logo{width:38px;height:38px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.2);overflow:hidden;}
    .mes-sb-brand{min-width:0;flex:1;}
    .mes-sb-brand b{display:block;font-size:var(--fs-lg);font-weight:800;letter-spacing:-.01em;line-height:1.15;}
    .mes-sb-brand span{display:block;font-size:var(--fs-xs);font-weight:700;letter-spacing:.1em;color:rgba(255,255,255,.7);}
    /* Chỉ vùng danh sách menu được cuộn. min-height:0 + overflow-y:auto + overscroll-behavior:contain */
    .mes-sb-nav{flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:8px 10px 14px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent;}
    .mes-sb-nav::-webkit-scrollbar{width:6px;}
    .mes-sb-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:6px;border:0;background-clip:border-box;}
    .mes-sb-nav::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.34);}
    .mes-sb-foot{flex:0 0 auto;padding:10px;border-top:1px solid rgba(255,255,255,.08);}
    .mes-sb-group{margin-top:14px;}
    .mes-sb-group:first-child{margin-top:4px;}
    .mes-sb-title{padding:0 12px 6px;font-size:var(--fs-xs);font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.46);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .mes-sidebar--collapsed .mes-sb-title{padding:0;height:1px;margin:10px 12px 8px;background:rgba(255,255,255,.12);font-size:0;overflow:hidden;}
    .mes-nav-item{position:relative;display:flex;align-items:center;gap:11px;width:100%;padding:9px 12px;margin:0 0 2px;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.78);cursor:pointer;text-align:left;font-size:var(--fs-md);font-weight:500;line-height:1.28;transition:background .12s ease,color .12s ease;}
    .mes-nav-item svg{flex-shrink:0;opacity:.9;}
    .mes-nav-item span{min-width:0;overflow-wrap:anywhere;}
    .mes-nav-item:hover{background:rgba(255,255,255,.08);color:#fff;}
    .mes-nav-item.is-active{background:rgba(255,255,255,.13);color:#fff;font-weight:700;}
    .mes-nav-item.is-active::before{content:"";position:absolute;left:-10px;top:7px;bottom:7px;width:4px;border-radius:0 4px 4px 0;background:#FF4D55;}
    .mes-nav-item.is-active svg{opacity:1;color:#fff;}
    .mes-nav-item:focus-visible{outline:2px solid #8AB4F8;outline-offset:-2px;}
    .mes-sidebar--collapsed .mes-nav-item{justify-content:center;padding:11px 0;}
    .mes-sidebar--collapsed .mes-nav-item span{display:none;}
    .mes-sidebar--collapsed .mes-sb-brand{display:none;}
    .mes-sb-collapse{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-size:var(--fs-sm);font-weight:600;transition:background .12s ease;}
    .mes-sb-collapse:hover{background:rgba(255,255,255,.14);}
    .mes-sb-tip{position:fixed;z-index:400;transform:translateY(-50%);padding:6px 10px;border-radius:7px;background:#0B1830;color:#fff;font-size:var(--fs-sm);font-weight:600;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none;border:1px solid rgba(255,255,255,.14);}

    /* ═══════ THANH TRÊN ═══════ */
    .mes-topbar{flex:0 0 auto;height:60px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 clamp(14px,1.5vw,28px);background:var(--c-panel);border-bottom:1px solid var(--c-border);z-index:50;}
    .mes-topbar-crumb{display:flex;flex-direction:column;min-width:0;line-height:1.2;}
    .mes-topbar-crumb small{font-size:var(--fs-xs);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--c-faint);}
    .mes-topbar-crumb b{font-size:var(--fs-lg);font-weight:700;color:var(--c-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

    /* ═══════ THẺ, NÚT, Ô NHẬP ═══════ */
    .mes-card{background:var(--c-panel);border:1px solid var(--c-border);border-radius:var(--r-lg);box-shadow:var(--sh-md);min-width:0;}
    .mes-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;min-height:36px;border-radius:var(--r-md);border:1px solid var(--c-border2);background:var(--c-panel);color:var(--c-text);font-size:var(--fs-md);font-weight:600;line-height:1.2;cursor:pointer;white-space:nowrap;transition:background .12s ease,border-color .12s ease,box-shadow .12s ease,color .12s ease;}
    .mes-btn:hover:not(:disabled){background:var(--c-panel2);border-color:var(--c-faint);}
    .mes-btn:active:not(:disabled){transform:translateY(.5px);}
    .mes-btn:disabled{opacity:.5;cursor:not-allowed;}
    .mes-btn--sm{padding:5px 10px;min-height:30px;font-size:var(--fs-sm);border-radius:var(--r-sm);}
    .mes-btn--primary{background:var(--c-brand);border-color:var(--c-brand);color:#fff;box-shadow:0 1px 2px rgba(15,31,56,.18);}
    .mes-btn--primary:hover:not(:disabled){background:var(--c-brand-h);border-color:var(--c-brand-h);}
    .mes-btn--danger{background:${COLORS.redDim};border-color:${COLORS.red}55;color:var(--c-red);}
    .mes-btn--danger:hover:not(:disabled){background:${COLORS.red}22;border-color:${COLORS.red};}
    .mes-btn-ghost,.mes-btn--ghost{background:transparent;border-color:transparent;color:var(--c-dim);box-shadow:none;}
    .mes-btn-ghost:hover:not(:disabled),.mes-btn--ghost:hover:not(:disabled){background:var(--c-panel2);border-color:transparent;color:var(--c-text);}
    .mes-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--r-sm);border:1px solid var(--c-border);background:var(--c-panel);color:var(--c-dim);cursor:pointer;flex-shrink:0;transition:background .12s ease,color .12s ease;}
    .mes-iconbtn:hover:not(:disabled){background:var(--c-panel2);color:var(--c-text);}
    .mes-iconbtn--danger{color:var(--c-red);}
    /* ---- Global Header (v52) ---- */
    .mes-collapse-btn{display:inline-flex;}
    .mes-clock{display:flex;align-items:center;gap:10px;flex-shrink:0;}
    .mes-clock-td{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15;}
    .mes-clock-time{font-size:var(--fs-lg);font-weight:700;color:var(--c-text);letter-spacing:.02em;font-variant-numeric:tabular-nums;}
    .mes-clock-date{font-size:var(--fs-xs);color:var(--c-faint);white-space:nowrap;}
    .mes-clock-shift{font-size:var(--fs-xs);font-weight:600;padding:3px 10px;border-radius:999px;background:var(--c-panel2);border:1px solid var(--c-border);color:var(--c-dim);white-space:nowrap;}
    .mes-sync{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid;border-radius:999px;font-size:var(--fs-xs);font-weight:600;white-space:nowrap;flex-shrink:0;}
    .mes-sync-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
    .mes-gsearch{position:relative;flex:1 1 auto;max-width:560px;min-width:0;margin:0 auto;}
    .mes-gsearch-box{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-panel2);position:relative;z-index:95;}
    .mes-gsearch-box.is-open{background:var(--c-panel);border-color:var(--c-copper);box-shadow:0 0 0 3px rgba(214,17,28,.12);}
    .mes-gsearch-input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--c-text);font:inherit;font-size:var(--fs-md);}
    .mes-gsearch-kbd{font-size:11px;padding:1px 6px;border:1px solid var(--c-border);border-radius:5px;color:var(--c-faint);background:var(--c-panel);font-family:inherit;white-space:nowrap;}
    .mes-gsearch-panel{position:absolute;left:0;right:0;top:42px;z-index:100;max-height:70vh;overflow-y:auto;overscroll-behavior:contain;padding:6px;}
    .mes-gsearch-gh{font-size:var(--fs-xs);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--c-faint);padding:8px 8px 4px;}
    .mes-gsearch-item{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;text-align:left;border:none;background:transparent;padding:7px 10px;border-radius:8px;cursor:pointer;color:var(--c-text);font:inherit;}
    .mes-gsearch-item.is-active{background:var(--c-panel2);}
    .mes-gsearch-t{font-weight:600;font-size:var(--fs-md);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .mes-gsearch-s{font-size:var(--fs-xs);color:var(--c-faint);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .mes-gsearch-empty{padding:16px;font-size:var(--fs-sm);color:var(--c-dim);}
    @media (max-width:560px){.mes-topbar-crumb{display:none !important;}.mes-clock{display:none !important;}}
    @media (max-width:1180px){.mes-clock-date{display:none;}.mes-sync-text{display:none;}.mes-sync{padding:4px 8px;}.mes-gsearch-kbd{display:none;}}
    .mes-input{width:100%;min-height:36px;background:var(--c-panel);border:1px solid var(--c-border2);border-radius:var(--r-md);color:var(--c-text);padding:7px 11px;font-size:var(--fs-md);outline:none;font-family:inherit;transition:border-color .12s ease,box-shadow .12s ease;}
    .mes-input:hover{border-color:var(--c-faint);}
    .mes-input:focus{border-color:var(--c-blue);box-shadow:var(--focus);}
    .mes-input:disabled{background:var(--c-panel2);color:var(--c-faint);cursor:not-allowed;}
    select.mes-input{padding-right:8px;}
    textarea.mes-input{min-height:72px;resize:vertical;}
    .mes-input::placeholder{color:var(--c-faint);}
    .mes-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;font-size:var(--fs-xs);font-weight:700;white-space:nowrap;line-height:1.5;}

    /* ═══════ BẢNG: co giãn theo cột, không khung cuộn nhỏ, tiêu đề dính ═══════ */
    .mes-table{width:100%;border-collapse:separate;border-spacing:0;font-size:var(--fs-md);}
    .mes-table th{text-align:left;padding:10px 12px;color:var(--c-dim);background:var(--c-inset);font-weight:700;font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--c-border2);vertical-align:bottom;position:sticky;top:0;z-index:2;line-height:1.3;}
    .mes-table th:first-child{border-top-left-radius:var(--r-md);}
    .mes-table th:last-child{border-top-right-radius:var(--r-md);}
    .mes-table td{padding:10px 12px;border-bottom:1px solid var(--c-border);vertical-align:middle;overflow-wrap:anywhere;line-height:1.4;}
    .mes-table tbody tr{transition:background .1s ease;}
    .mes-table tbody tr:hover{background:var(--c-panel2);}
    .mes-table tbody tr:last-child td{border-bottom:0;}
    .mes-table .num,.mes-table td.mes-mono{font-variant-numeric:tabular-nums;}
    /* Trên máy tính: không tạo khung cuộn ngang/dọc riêng (thanh tiêu đề dính theo vùng nội dung). Màn hẹp mới cuộn ngang. */
    .mes-scroll-x{overflow:visible;}
    @media (min-width:1101px){.mes-scroll-x{overflow:visible !important;max-height:none !important;}}
    .amg-clamp{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:1.3;}
    .amg-hdr{display:grid;align-items:center;gap:10px;padding:10px 14px;background:var(--c-inset);border-bottom:1px solid var(--c-border2);font-size:var(--fs-xs);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--c-dim);position:sticky;top:0;z-index:3;border-radius:var(--r-lg) var(--r-lg) 0 0;}
    .amg-row{display:grid;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--c-border);border-left:3px solid transparent;font-size:var(--fs-md);cursor:pointer;transition:background .12s ease;}
    .amg-row:hover{background:var(--c-panel2);}
    .amg-row--card{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:12px 14px;}
    .amg-row--sel{background:${COLORS.blue}12;}
    /* v54 — bảng Kế hoạch sản xuất: cột rõ ràng, chữ tự xuống dòng, không cắt/chồng chữ */
    .pl-hdr,.pl-row{display:grid;grid-template-columns:var(--pl-cols);column-gap:14px;}
    .pl-hdr{align-items:center;padding:11px 16px 11px 19px;background:var(--c-inset);border-bottom:1px solid var(--c-border2);font-size:var(--fs-xs);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--c-dim);position:sticky;top:0;z-index:3;border-radius:var(--r-lg) var(--r-lg) 0 0;}
    .pl-hdr>div{min-width:0;overflow-wrap:anywhere;line-height:1.25;}
    .pl-row{align-items:center;padding:14px 16px;border-bottom:1px solid var(--c-border);border-left:4px solid transparent;cursor:pointer;transition:background .12s ease;font-size:var(--fs-md);}
    .pl-row:nth-child(even){background:color-mix(in srgb,var(--c-inset) 38%,transparent);}
    .pl-row:hover{background:var(--c-panel2);}
    .pl-cell{min-width:0;overflow-wrap:anywhere;word-break:normal;line-height:1.4;}
    .pl-main{font-weight:800;font-size:var(--fs-md);color:var(--c-text);line-height:1.3;}
    .pl-spec{font-size:var(--fs-sm);font-weight:600;color:var(--c-dim);margin-top:2px;line-height:1.35;}
    .pl-sub{font-size:var(--fs-xs);font-weight:500;color:var(--c-faint);line-height:1.4;}
    .pl-num{font-variant-numeric:tabular-nums;}
    .pl-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
    .pl-tags:empty{display:none;}
    .pl-tag{display:inline-block;padding:1px 8px;border-radius:var(--r-sm);font-size:var(--fs-xs);font-weight:700;background:var(--c-inset);border:1px solid var(--c-border);color:var(--c-dim);white-space:nowrap;}
    .pl-act{display:flex;flex-direction:column;gap:6px;align-items:stretch;}
    .pl-act .mes-btn,.pl-act button{width:100%;justify-content:center;text-align:center;white-space:normal;line-height:1.25;}
    .pl-row--card{display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:14px 16px;}
    .pl-card-top{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;}
    .pl-card-st{display:flex;flex-direction:column;gap:6px;align-items:flex-end;text-align:right;}
    .pl-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 18px;}
    .pl-row--card .pl-act{flex-direction:row;flex-wrap:wrap;justify-content:flex-end;}
    .pl-row--card .pl-act button{width:auto;}
    .amg-kv-l{font-size:var(--fs-xs);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--c-faint);line-height:1.25;}
    .amg-kv-v{font-size:var(--fs-md);font-weight:600;color:var(--c-text);overflow-wrap:anywhere;}
    .amg-kpi{padding:12px 14px;text-align:left;min-width:0;border-radius:var(--r-lg);background:var(--c-panel);border:1px solid var(--c-border);border-left-width:4px;box-shadow:var(--sh-sm);transition:box-shadow .15s ease,border-color .15s ease,background .15s ease;font-family:inherit;color:inherit;}
    button.amg-kpi{cursor:pointer;}
    button.amg-kpi:hover{box-shadow:var(--sh-md);}
    .amg-kpi--on{box-shadow:0 0 0 2px var(--amg-kpi-c) inset;}
    .amg-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--c-border);background:var(--c-inset);border-radius:0 0 var(--r-lg) var(--r-lg);}
    .amg-pg{min-width:32px;height:32px;padding:0 9px;border-radius:var(--r-sm);border:1px solid var(--c-border2);background:var(--c-panel);color:var(--c-text);font-weight:600;font-size:var(--fs-sm);cursor:pointer;}
    .amg-pg:hover:not(:disabled){background:var(--c-panel2);}
    .amg-pg:disabled{opacity:.4;cursor:not-allowed;}
    .amg-pg--on{background:var(--c-brand);border-color:var(--c-brand);color:#fff;}
    .amg-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:999px;font-size:var(--fs-xs);font-weight:700;white-space:nowrap;line-height:1.5;}
    .amg-pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;}
    .amg-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
    .amg-toolbar .mes-input{width:auto;min-width:0;}
    .amg-mcard{transition:border-color .2s ease,box-shadow .2s ease;}
    .amg-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 14px;padding:10px 12px;border-radius:var(--r-md);background:var(--c-inset);border:1px solid var(--c-border);}
    .amg-metrics--compact{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;padding:8px 10px;}
    .amg-metric-l{font-size:var(--fs-xs);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--c-faint);line-height:1.25;}
    .amg-metric-l--tv{font-size:calc(14px*var(--amg-fs));color:#8EA3C2;}
    .amg-metric-v{font-size:var(--fs-md);font-weight:600;color:var(--c-text);overflow-wrap:anywhere;font-variant-numeric:tabular-nums;}
    .amg-metric-v--strong{font-weight:800;font-size:var(--fs-lg);}
    .amg-metric-v--tv{font-size:calc(22px*var(--amg-fs));color:#F1F6FF;}
    .amg-clockrow{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:2px 0;}
    .amg-clock{font-size:calc(30px*var(--amg-fs));font-weight:800;line-height:1;letter-spacing:.02em;font-variant-numeric:tabular-nums;}
    .amg-clock--tv{font-size:calc(58px*var(--amg-fs));}
    .amg-clock-l{font-size:var(--fs-xs);font-weight:700;color:var(--c-faint);text-transform:uppercase;letter-spacing:.05em;}
    .amg-clock-l--tv{font-size:calc(15px*var(--amg-fs));color:#8EA3C2;}
    .amg-unit{display:inline-block;padding:0 6px;margin-left:4px;border-radius:var(--r-sm);font-size:.82em;font-weight:700;background:var(--c-inset);border:1px solid var(--c-border);color:var(--c-dim);}
    .amg-print-only{display:none;}
    .mes-flow-line{color:var(--c-faint);font-size:var(--fs-sm);}
    .pulse-dot{animation:mesPulse 1.6s ease-in-out infinite;}
    @keyframes mesPulse{0%,100%{opacity:1}50%{opacity:.4}}

    /* ═══════ DASHBOARD ĐIỀU HÀNH ═══════ */
    .dx{display:flex;flex-direction:column;gap:clamp(12px,1.1vw,20px);min-width:0;}
    .dx-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;}
    .dx-h1{font-size:var(--fs-2xl);font-weight:800;letter-spacing:-.02em;line-height:1.15;color:var(--c-text);}
    .dx-sub{font-size:var(--fs-sm);color:var(--c-dim);margin-top:3px;}
    .dx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(clamp(150px,13vw,260px),1fr));gap:clamp(8px,.8vw,14px);}
    .dx-kpi{position:relative;display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:var(--r-lg);background:var(--c-panel);border:1px solid var(--c-border);box-shadow:var(--sh-sm);text-align:left;font-family:inherit;color:inherit;min-width:0;}
    button.dx-kpi{cursor:pointer;transition:box-shadow .15s ease,border-color .15s ease;}
    button.dx-kpi:hover{box-shadow:var(--sh-md);border-color:var(--c-border2);}
    .dx-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .dx-kpi-l{font-size:var(--fs-xs);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--c-dim);line-height:1.25;}
    .dx-kpi-ic{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .dx-kpi-v{font-size:var(--fs-3xl);font-weight:800;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums;}
    .dx-kpi-s{font-size:var(--fs-xs);color:var(--c-faint);line-height:1.35;}
    .dx-grid{display:grid;gap:clamp(12px,1.1vw,20px);min-width:0;}
    .dx-grid--2{grid-template-columns:repeat(2,minmax(0,1fr));}
    .dx-grid--3{grid-template-columns:repeat(3,minmax(0,1fr));}
    .dx-grid--21{grid-template-columns:minmax(0,2fr) minmax(0,1fr);}
    .dx-grid--12{grid-template-columns:minmax(0,1fr) minmax(0,2fr);}
    @media (max-width:1280px){.dx-grid--3{grid-template-columns:repeat(2,minmax(0,1fr));}.dx-grid--21,.dx-grid--12{grid-template-columns:minmax(0,1fr);}}
    @media (max-width:860px){.dx-grid--2,.dx-grid--3,.dx-grid--21,.dx-grid--12{grid-template-columns:minmax(0,1fr);}}
    .dx-card{display:flex;flex-direction:column;min-width:0;padding:0;}
    .dx-card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid var(--c-border);flex-wrap:wrap;}
    .dx-card-t{display:flex;align-items:center;gap:8px;font-size:var(--fs-lg);font-weight:700;color:var(--c-text);min-width:0;}
    .dx-card-n{font-size:var(--fs-xs);font-weight:600;color:var(--c-faint);}
    .dx-card-b{padding:14px 16px;min-width:0;}
    .dx-card-b--flush{padding:0;}
    .dx-empty{padding:22px 16px;text-align:center;color:var(--c-faint);font-size:var(--fs-sm);line-height:1.5;}
    .dx-bar{height:8px;border-radius:99px;background:var(--c-panel2);overflow:hidden;border:1px solid var(--c-border);}
    .dx-bar>i{display:block;height:100%;border-radius:99px;transition:width .3s ease;}
    .dx-run{display:grid;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid var(--c-border);grid-template-columns:minmax(150px,1.5fr) minmax(130px,1.3fr) minmax(110px,1fr) minmax(150px,1.3fr) minmax(110px,.9fr) minmax(120px,1fr);cursor:pointer;transition:background .12s ease;border-left:3px solid transparent;}
    .dx-run:hover{background:var(--c-panel2);}
    .dx-run-h{cursor:default;background:var(--c-inset);font-size:var(--fs-xs);font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--c-dim);padding-top:9px;padding-bottom:9px;}
    .dx-run-h:hover{background:var(--c-inset);}
    @media (max-width:1180px){.dx-run{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px;}.dx-run-h{display:none;}}
    .dx-run-c{min-width:0;font-size:var(--fs-sm);color:var(--c-dim);}
    .dx-run-c b,.dx-run-c strong{color:var(--c-text);font-weight:700;font-size:var(--fs-md);}
    .dx-run-c small{display:block;font-size:var(--fs-xs);color:var(--c-faint);}
    .dx-mach{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(190px,14vw,300px),1fr));gap:10px;padding:14px 16px;}
    .dx-mc{display:flex;flex-direction:column;gap:5px;padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--c-border);background:var(--c-panel);cursor:pointer;text-align:left;font-family:inherit;color:inherit;min-width:0;border-left-width:4px;transition:box-shadow .12s ease,border-color .12s ease;}
    .dx-mc:hover{box-shadow:var(--sh-md);}
    .dx-mc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
    .dx-mc-id{font-size:var(--fs-md);font-weight:800;}
    .dx-mc-l{font-size:var(--fs-xs);color:var(--c-faint);}
    .dx-mc-v{font-size:var(--fs-sm);color:var(--c-text);font-weight:600;overflow-wrap:anywhere;}
    .dx-alert{display:flex;gap:10px;align-items:flex-start;width:100%;padding:10px 16px;border:0;border-bottom:1px solid var(--c-border);background:transparent;text-align:left;cursor:pointer;color:var(--c-text);font-family:inherit;transition:background .12s ease;}
    .dx-alert:hover{background:var(--c-panel2);}
    .dx-alert-dot{width:9px;height:9px;border-radius:50%;margin-top:6px;flex-shrink:0;}
    .dx-alert-t{font-size:var(--fs-md);font-weight:700;line-height:1.35;}
    .dx-alert-d{font-size:var(--fs-sm);color:var(--c-dim);overflow-wrap:anywhere;}
    .dx-alert-go{margin-left:auto;flex-shrink:0;align-self:center;font-size:var(--fs-xs);font-weight:700;color:var(--c-blue);white-space:nowrap;}
    .dx-seg{display:inline-flex;border:1px solid var(--c-border2);border-radius:var(--r-md);overflow:hidden;background:var(--c-panel);}
    .dx-seg button{padding:7px 13px;font-size:var(--fs-sm);font-weight:600;border:0;cursor:pointer;background:transparent;color:var(--c-dim);font-family:inherit;}
    .dx-seg button:hover{background:var(--c-panel2);}
    .dx-seg button[aria-pressed="true"]{background:var(--c-navy);color:#fff;}
    .dx-list-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--c-border);font-size:var(--fs-sm);}
    .dx-list-row:last-child{border-bottom:0;}
    .dx-note{font-size:var(--fs-xs);color:var(--c-faint);line-height:1.45;}

    /* ═══════ IN ẤN ═══════ */
    @media print{
      html,body{height:auto !important;overflow:visible !important;background:#fff !important;color:#000 !important;}
      .mes-app-shell,.mes-main,.mes-content-scroll{display:block !important;height:auto !important;overflow:visible !important;}
      .mes-sidebar,.mes-topbar,.mes-no-print,.mes-sidebar-overlay{display:none !important;}
      .mes-card{box-shadow:none !important;}
      .amg-print-only{display:block !important;}
    }
    @media (prefers-reduced-motion: reduce){.pulse-dot{animation:none !important;} .mes-page,.mes-fade-in{animation:none !important;} *{transition:none !important;}}

    /* ═══════ RESPONSIVE / MOBILE (≤860px) ═══════ */
    .mes-hamburger-btn{display:none;}
    .mes-sidebar-close{display:none;}
    .mes-sidebar-overlay{display:none;}
    @media (max-width: 860px){
      .mes-topbar-shift{display:none !important;}
      .mes-login-shell{background:linear-gradient(160deg,#0A2A52,#1a3d6e) !important;align-items:flex-start !important;overflow-y:auto !important;height:auto !important;min-height:100vh !important;padding:28px 16px !important;}
      .mes-login-blur-bg,.mes-login-vignette{display:none !important;}
      .mes-login-hero{width:100% !important;max-width:440px !important;aspect-ratio:auto !important;background-image:none !important;box-shadow:none !important;margin:0 auto !important;position:static !important;}
      .mes-login-card{position:static !important;left:auto !important;top:auto !important;width:100% !important;height:auto !important;max-height:none !important;border-radius:18px !important;}
      /* Sidebar thành ngăn kéo trượt từ trái */
      .mes-sidebar,.mes-sidebar--collapsed{position:fixed;left:0;top:0;bottom:0;width:272px;max-width:84vw;flex-basis:auto;height:100dvh;z-index:300;transform:translateX(-100%);transition:transform .2s ease;box-shadow:2px 0 24px rgba(0,0,0,.5);}
      .mes-sidebar--open{transform:translateX(0);}
      .mes-sidebar--collapsed .mes-sb-brand{display:block;}
      .mes-sidebar--collapsed .mes-nav-item{justify-content:flex-start;padding:9px 12px;}
      .mes-sidebar--collapsed .mes-nav-item span{display:inline;}
      .mes-sidebar--collapsed .mes-sb-title{height:auto;margin:0;background:none;font-size:var(--fs-xs);padding:0 12px 6px;}
      .mes-sb-tip{display:none;}
      .mes-sidebar-close{display:flex !important;margin-left:auto;}
      .mes-sb-collapse{display:none !important;}
      .mes-sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(3,5,8,.6);z-index:290;animation:mesFadeIn .18s ease;}
      .mes-hamburger-btn{display:flex !important;}
      .mes-content-wrap{padding:12px !important;}
      .mes-topbar{padding:0 12px !important;}
      .mes-topbar-user,.mes-topbar-divider{display:none !important;}
      .mes-collapse-btn{display:none !important;}
      .mes-topbar-crumb small{display:none;}
      .mes-topbar-crumb{max-width:30vw;}
      .mes-topbar{gap:8px !important;}
      .mes-topbar-right{gap:6px !important;}
      .mes-clock-time{font-size:var(--fs-md);}
      .mes-topbar-right .mes-iconbtn[aria-label^="Đổi giao diện"]{display:none;}
      .mes-card{border-radius:12px;}
      .mes-table{font-size:var(--fs-sm);}
      .mes-table th,.mes-table td{padding:8px 8px;}
      .mes-scroll-x{overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;}
      .mes-content-scroll div[style*="display: flex"]:not(.mes-sb-nav){flex-wrap:wrap;}
      .mes-content-scroll div[style*="display: grid"]{grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr)) !important;}
      .mes-content-scroll *{min-width:0;}
      .mes-content-scroll button,.mes-content-scroll select,.mes-content-scroll input{max-width:100%;}
      .mes-mobile-modal-backdrop{padding:8px !important;align-items:flex-end !important;}
      .mes-mobile-modal-backdrop > div{max-height:94vh !important;border-radius:16px 16px 0 0 !important;}
    }
    @media (min-width: 861px){
      .mes-sidebar-close{display:none !important;}
    }
    /* Màn hình nhỏ cỡ tablet ngang: vẫn hiển thị đủ cột, bảng cho phép cuộn ngang an toàn thay vì cắt cột */
    @media (min-width:861px) and (max-width:1100px){
      .mes-scroll-x{overflow-x:auto;}
    }
  `);
}
