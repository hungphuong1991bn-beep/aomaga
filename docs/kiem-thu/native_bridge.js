/* Kiểm thử cầu nối native (native/native-bridge.js) bằng jsdom + plugin Capacitor giả lập.
   Lưu ý: đây là kiểm thử logic; KHÔNG thay cho kiểm thử trên điện thoại Android thật. */
const path = require('path'), fs = require('fs');
const NM = process.env.NM || path.join(__dirname, '..', '..', 'node_modules');
const { JSDOM } = require(path.join(NM, 'jsdom'));
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'native', 'native-bridge.js'), 'utf8').replace('__AMG_VERSION__', '9.9.9');
let pass = 0, fail = 0;
const T = async (n, f) => { try { await f(); pass++; console.log('PASS ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assert'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot({ android = true, electron = false, shareImpl } = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { runScripts: 'outside-only', url: 'https://localhost/' });
  const w = dom.window, calls = { write: [], share: [], back: [], minimize: 0, splash: 0, nativeClick: 0, listeners: {} };
  if (electron) w.amgElectron = { platform: 'win32' };
  if (android) {
    w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      Filesystem: { writeFile: async o => { calls.write.push(o); return { uri: 'file:///cache/' + o.path }; } },
      Share: { share: shareImpl || (async o => { calls.share.push(o); return {}; }) },
      App: { addListener: (ev, fn) => { calls.listeners[ev] = fn; }, minimizeApp: () => { calls.minimize++; } },
      SplashScreen: { hide: () => { calls.splash++; } } } };
  }
  w.fetch = async url => ({ blob: async () => new w.Blob(['xin chào'], { type: 'text/plain' }) });
  const origClick = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function () { calls.nativeClick++; };
  w.eval(SRC);
  return { w, calls, origClick };
}

(async () => {
  await T('1. Nhận diện nền tảng: android / electron / web + số phiên bản', async () => {
    eq(boot().w.AMG_NATIVE, { platform: 'android', version: '9.9.9', saveBlob: boot().w.AMG_NATIVE.saveBlob });
    eq(boot({ android: false, electron: true }).w.AMG_NATIVE.platform, 'electron');
    const web = boot({ android: false }); eq(web.w.AMG_NATIVE.platform, 'web'); eq(web.w.AMG_NATIVE.saveBlob, null);
  });
  await T('2. Android: <a download href=blob:> → ghi vào cache + mở hộp thoại Chia sẻ (không gọi click gốc)', async () => {
    const { w, calls } = boot();
    const a = w.document.createElement('a'); a.href = 'blob:https://localhost/abc'; a.setAttribute('download', 'Bao cao/ca:1?.xlsx'); a.click(); await sleep(60);
    eq(calls.nativeClick, 0, 'click gốc không được chạy'); eq(calls.write.length, 1);
    eq(calls.write[0].directory, 'CACHE'); eq(calls.write[0].path, 'Bao cao_ca_1_.xlsx', 'tên tệp phải được làm sạch');
    eq(Buffer.from(calls.write[0].data, 'base64').toString('utf8'), 'xin chào', 'nội dung tệp phải nguyên vẹn');
    eq(calls.share.length, 1); eq(calls.share[0].url, 'file:///cache/Bao cao_ca_1_.xlsx');
  });
  await T('3. Link thường (không phải blob/download) vẫn chạy click gốc', async () => {
    const { w, calls } = boot();
    const a = w.document.createElement('a'); a.href = 'https://example.com/'; a.click();
    const b = w.document.createElement('a'); b.href = 'blob:https://localhost/x'; b.click(); // có blob nhưng không có thuộc tính download
    eq(calls.nativeClick, 2); eq(calls.write.length, 0);
  });
  await T('4. Người dùng đóng hộp thoại Chia sẻ → không báo lỗi; lỗi thật → báo lỗi', async () => {
    const c1 = boot({ shareImpl: async () => { throw new Error('Share canceled'); } });
    const a = c1.w.document.createElement('a'); a.href = 'blob:x'; a.setAttribute('download', 'a.xlsx'); a.click(); await sleep(60);
    eq(c1.w.document.body.textContent.includes('Không lưu được'), false);
    const c2 = boot({ shareImpl: async () => { throw new Error('disk full'); } });
    const b = c2.w.document.createElement('a'); b.href = 'blob:x'; b.setAttribute('download', 'b.xlsx'); b.click(); await sleep(60);
    ok(c2.w.document.body.textContent.includes('Không lưu được tệp: disk full'));
  });
  await T('5. Nút Quay lại: đóng hộp thoại trên cùng → rồi lùi lịch sử → rồi thu nhỏ (không thoát)', async () => {
    const { w, calls } = boot(); const back = calls.listeners.backButton; ok(back, 'chưa đăng ký backButton');
    let closed = [];
    ['m1', 'm2'].forEach(id => { const d = w.document.createElement('div'); d.className = 'mes-mobile-modal-backdrop'; d.id = id; d.addEventListener('click', () => closed.push(id)); w.document.body.appendChild(d); });
    back({ canGoBack: false }); eq(closed, ['m2'], 'chỉ đóng hộp thoại trên cùng');
    w.document.getElementById('m2').remove(); w.document.getElementById('m1').remove();
    let hb = 0; w.history.back = () => { hb++; };
    back({ canGoBack: true }); eq(hb, 1); eq(calls.minimize, 0);
    back({ canGoBack: false }); eq(calls.minimize, 1);
  });
  await T('6. Ẩn splash khi giao diện đã vẽ', async () => {
    const { w, calls } = boot(); await sleep(50); eq(calls.splash, 0, 'chưa vẽ thì chưa ẩn');
    w.document.getElementById('root').appendChild(w.document.createElement('div')); await sleep(1100); ok(calls.splash >= 1, 'phải ẩn splash');
  });
  await T('7. Bản Web/Electron: không ghi đè click, không đăng ký nút Quay lại', async () => {
    const { w, calls } = boot({ android: false, electron: true });
    const a = w.document.createElement('a'); a.href = 'blob:x'; a.setAttribute('download', 'a.xlsx'); a.click(); eq(calls.nativeClick, 1);
    eq(Object.keys(calls.listeners).length, 0);
  });
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})();
