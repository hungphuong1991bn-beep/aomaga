/* AOMAGA MES — cầu nối native (chỉ nạp trong bản Windows/Android qua scripts/prepare-www.js; bản Web KHÔNG dùng file này).
   Không đổi nghiệp vụ, không đụng tới lớp dữ liệu. Chỉ bổ sung những thứ WebView/Electron thiếu:
   1) window.AMG_NATIVE: nền tảng + số phiên bản.
   2) Android: tải/xuất file. WebView không hỗ trợ <a download> với blob: (xuất Excel, sao lưu JSON sẽ âm thầm không làm gì)
      → ghi vào thư mục cache của app rồi mở hộp thoại Chia sẻ/Lưu của Android.
   3) Android: nút Quay lại — đóng hộp thoại đang mở; nếu không còn thì thu nhỏ ứng dụng (không thoát, không mất dữ liệu đang nhập).
   4) Android: ẩn màn hình khởi động ngay khi giao diện đã vẽ. */
(function () {
  'use strict';
  var VERSION = '__AMG_VERSION__';
  var cap = window.Capacitor;
  var isAndroid = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() && cap.getPlatform && cap.getPlatform() === 'android');
  var isElectron = !!window.amgElectron;
  window.AMG_NATIVE = { platform: isAndroid ? 'android' : isElectron ? 'electron' : 'web', version: VERSION };

  function plugin(name) { return cap && cap.Plugins ? cap.Plugins[name] : null; }
  function toast(msg) {
    try {
      var el = document.createElement('div');
      el.textContent = msg;
      el.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);max-width:90vw;z-index:100000;background:#1f2937;color:#fff;padding:9px 14px;border-radius:8px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);text-align:center';
      (document.body || document.documentElement).appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
    } catch (e) { /* bỏ qua */ }
  }
  function safeName(n) {
    var s = String(n || 'aomaga-mes').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
    return s || 'aomaga-mes';
  }
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { reject(r.error || new Error('Không đọc được tệp')); };
      r.onload = function () { var s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
      r.readAsDataURL(blob);
    });
  }
  // Ghi blob vào cache của app rồi mở hộp thoại Chia sẻ/Lưu. Trả Promise<boolean> (true = đã mở hộp thoại).
  function saveBlobAndroid(blob, filename) {
    var FS = plugin('Filesystem'), SH = plugin('Share');
    if (!FS || !SH) { toast('Không thể lưu tệp: thiếu thành phần Tệp/Chia sẻ của ứng dụng.'); return Promise.resolve(false); }
    var name = safeName(filename);
    return blobToBase64(blob).then(function (data) {
      return FS.writeFile({ path: name, data: data, directory: 'CACHE' });
    }).then(function (res) {
      return SH.share({ title: name, dialogTitle: 'Lưu hoặc gửi tệp ' + name, url: res.uri });
    }).then(function () { return true; }).catch(function (e) {
      // Người dùng đóng hộp thoại chia sẻ cũng ném lỗi → không báo lỗi trong trường hợp đó
      var m = String((e && e.message) || e || '');
      if (!/cancel|dismiss/i.test(m)) toast('Không lưu được tệp: ' + m);
      return false;
    });
  }
  function handleBlobUrl(url, filename) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return saveBlobAndroid(b, filename); })
      .catch(function (e) { toast('Không tải được tệp: ' + ((e && e.message) || e)); return false; });
  }
  window.AMG_NATIVE.saveBlob = isAndroid ? saveBlobAndroid : null;

  if (isAndroid) {
    // <a download href="blob:..."> (SheetJS XLSX.writeFile, core/backup.js...) — cả a.click() lẫn người dùng bấm thật
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download') && /^blob:/i.test(this.href)) { handleBlobUrl(this.href, this.getAttribute('download')); return; }
      return origClick.apply(this, arguments);
    };
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
      if (a && /^blob:/i.test(a.href)) { e.preventDefault(); handleBlobUrl(a.href, a.getAttribute('download')); }
    }, true);

    // Nút Quay lại
    var App = plugin('App');
    if (App && App.addListener) {
      App.addListener('backButton', function (ev) {
        var modals = document.querySelectorAll('.mes-mobile-modal-backdrop');
        if (modals.length) { // đóng hộp thoại trên cùng, đúng như bấm ra ngoài hộp thoại
          var top = modals[modals.length - 1];
          top.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return;
        }
        if (ev && ev.canGoBack) { window.history.back(); return; }
        if (App.minimizeApp) App.minimizeApp(); // không thoát hẳn: giữ nguyên dữ liệu đang nhập
      });
    }
    // Ẩn splash khi giao diện đã vẽ
    var SS = plugin('SplashScreen');
    if (SS && SS.hide) {
      var t0 = Date.now(), iv = setInterval(function () {
        var root = document.getElementById('root');
        if ((root && root.children.length && Date.now() - t0 > 600) || Date.now() - t0 > 10000) { clearInterval(iv); try { SS.hide(); } catch (e) { /* bỏ qua */ } }
      }, 250);
    }
  }
})();
