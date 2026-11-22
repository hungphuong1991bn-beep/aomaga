/* ═══════════════════════════════════════════════════════
   ★  MOUNT ỨNG DỤNG VÀO #root  ★
   (Trước đây thiếu đoạn này ⇒ App không bao giờ được render,
   và màn splash "Khởi động ứng dụng..." bị treo vĩnh viễn.)
═══════════════════════════════════════════════════════ */
(function mountApp() {
  function hideSplash() {
    var sp = document.getElementById('splash');
    if (!sp) return;
    sp.style.opacity = '0';
    setTimeout(function () { sp.remove(); }, 350);
  }
  function showFatalError(err) {
    console.error('Lỗi khởi động ứng dụng:', err);
    var st = document.getElementById('sp-status');
    if (st) st.textContent = '❌ Lỗi khởi động: ' + (err && err.message ? err.message : err);
    var bar = document.querySelector('.sp-fill');
    if (bar) bar.style.background = '#E5484D';
  }
  try {
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      throw new Error('Chưa tải được React/ReactDOM (kiểm tra kết nối mạng lần đầu)');
    }
    var container = document.getElementById('root');
    if (!container) throw new Error('Không tìm thấy phần tử #root trong index.html');
    var root = ReactDOM.createRoot(container);
    root.render(/*#__PURE__*/React.createElement(AppErrorBoundary, null, /*#__PURE__*/React.createElement(App)));
    hideSplash();
  } catch (err) {
    showFatalError(err);
  }
})();
