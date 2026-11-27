'use strict';
/* AOMAGA MES — ứng dụng Windows (Electron).
   - Giao diện = chính source web (thư mục www/ do scripts/prepare-www.js sinh ra), nạp qua giao thức nội bộ app://aomaga/
     (không phụ thuộc đường dẫn máy phát triển; origin cố định nên localStorage — bộ nhớ đệm + hàng đợi ghi — được giữ qua các lần cập nhật).
   - Dữ liệu dùng chung Firebase Realtime Database như bản Web (logic nằm trong core/runtime.js, không đổi).
   - Mọi dữ liệu cục bộ (localStorage, cấu hình cửa sổ, nhật ký) nằm trong thư mục người dùng (app.getPath('userData')),
     KHÔNG nằm trong thư mục cài đặt → nâng cấp/gỡ cài đặt không làm mất dữ liệu.
   - Cập nhật: electron-updater tải ngầm từ GitHub Releases, chỉ cài khi người dùng đóng ứng dụng hoặc tự chọn "Cài ngay". */
const { app, BrowserWindow, Menu, dialog, shell, protocol, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'AOMAGA MES';
const APP_URL = 'app://aomaga/index.html';
const WWW = path.join(__dirname, '..', 'www');
const SMOKE = process.env.AMG_SMOKE === '1'; // chỉ dùng cho kiểm thử tự động

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

/* ---------- Nhật ký ---------- */
let logFile = null;
function log(level, msg) {
  try {
    if (!logFile) {
      const dir = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      logFile = path.join(dir, 'main.log');
      try { if (fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, path.join(dir, 'main.old.log')); } catch (e) { /* chưa có file */ }
    }
    fs.appendFileSync(logFile, `${new Date().toISOString()} [${level}] ${msg}\n`);
  } catch (e) { /* không để lỗi ghi nhật ký làm hỏng ứng dụng */ }
}
process.on('uncaughtException', e => log('error', 'uncaughtException: ' + (e && e.stack || e)));
process.on('unhandledRejection', e => log('error', 'unhandledRejection: ' + (e && e.stack || e)));

/* ---------- Một cửa sổ duy nhất ---------- */
if (!SMOKE && !app.requestSingleInstanceLock()) { app.quit(); }

let win = null, splash = null, forceClose = false, manualUpdateCheck = false;

/* ---------- Giữ kích thước/vị trí cửa sổ ---------- */
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); if (s && s.width > 300 && s.height > 300) return s; } catch (e) { /* mặc định */ }
  return { width: 1400, height: 880 };
}
let saveTimer = null;
function saveState() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const maximized = win.isMaximized();
      const b = maximized ? (loadState()) : win.getBounds();
      fs.writeFileSync(stateFile(), JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, maximized }));
    } catch (e) { log('warn', 'không lưu được window-state: ' + e.message); }
  }, 400);
}

/* ---------- Giao thức app:// (đọc từ www/, chống đi ra ngoài thư mục) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8' };
function registerAppProtocol() {
  protocol.handle('app', async req => {
    try {
      const u = new URL(req.url);
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(WWW, rel));
      if (file !== WWW && !file.startsWith(WWW + path.sep)) return new Response('Forbidden', { status: 403 });
      const data = await fs.promises.readFile(file);
      return new Response(data, { status: 200, headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' } });
    } catch (e) {
      log('warn', 'app:// không tìm thấy: ' + req.url);
      return new Response('Not found', { status: 404 });
    }
  });
}

/* ---------- Cảnh báo khi đóng lúc còn dữ liệu chưa gửi / đang mở hộp thoại nhập ---------- */
async function pendingInfo() {
  try {
    return await win.webContents.executeJavaScript(
      '({pending:(window.__rtdbStatus&&window.__rtdbStatus.pending)||0,modal:document.querySelectorAll(".mes-mobile-modal-backdrop").length})');
  } catch (e) { return { pending: 0, modal: 0 }; }
}
async function confirmRisk(parent, action) {
  const info = await pendingInfo();
  if (!info.pending && !info.modal) return true;
  const lines = [];
  if (info.pending) lines.push(`Còn ${info.pending} thay đổi chưa gửi lên máy chủ. Dữ liệu đã được lưu trên máy này và sẽ tự gửi khi mở lại ứng dụng có mạng.`);
  if (info.modal) lines.push('Đang mở hộp thoại nhập liệu — thông tin chưa bấm lưu/xác nhận sẽ không được giữ lại.');
  const r = await dialog.showMessageBox(parent, { type: 'warning', buttons: ['Quay lại làm việc', action], defaultId: 0, cancelId: 0, noLink: true, title: APP_NAME, message: 'Bạn có chắc muốn tiếp tục?', detail: lines.join('\n\n') });
  return r.response === 1;
}

/* ---------- Cập nhật phiên bản (an toàn: không ép cài giữa lúc đang làm việc) ---------- */
let autoUpdater = null;
function setupUpdater() {
  if (!app.isPackaged || SMOKE) return;
  if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) { log('info', 'Bỏ qua cập nhật: bản này không có app-update.yml'); return; }
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.logger = { info: m => log('upd', String(m)), warn: m => log('upd-warn', String(m)), error: m => log('upd-error', String(m)), debug: () => {} };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true; // cài khi người dùng tự đóng ứng dụng
    autoUpdater.allowDowngrade = false;
    autoUpdater.on('update-downloaded', async info => {
      log('info', 'Đã tải bản ' + info.version);
      if (!win || win.isDestroyed()) return;
      const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Cài khi tôi đóng ứng dụng', 'Khởi động lại và cài ngay'], defaultId: 0, cancelId: 0, noLink: true,
        title: APP_NAME, message: `Đã tải xong phiên bản ${info.version}.`, detail: 'Nên chọn "Cài khi tôi đóng ứng dụng" nếu bạn đang nhập liệu hoặc ghi sản lượng. Dữ liệu của bạn được giữ nguyên khi cập nhật.' });
      if (r.response === 1 && await confirmRisk(win, 'Vẫn khởi động lại và cài')) { forceClose = true; autoUpdater.quitAndInstall(false, true); }
    });
    autoUpdater.on('update-not-available', () => { if (manualUpdateCheck) { manualUpdateCheck = false; dialog.showMessageBox(win, { type: 'info', title: APP_NAME, message: 'Bạn đang dùng phiên bản mới nhất.', detail: 'Phiên bản hiện tại: ' + app.getVersion() }); } });
    autoUpdater.on('error', e => { log('error', 'updater: ' + (e && e.message)); if (manualUpdateCheck) { manualUpdateCheck = false; dialog.showMessageBox(win, { type: 'warning', title: APP_NAME, message: 'Không kiểm tra được cập nhật.', detail: 'Kiểm tra kết nối mạng rồi thử lại.' }); } });
    const check = () => autoUpdater.checkForUpdates().catch(e => log('warn', 'checkForUpdates: ' + e.message));
    setTimeout(check, 20000);
    setInterval(check, 4 * 60 * 60 * 1000);
  } catch (e) { log('error', 'Không khởi tạo được cập nhật: ' + e.message); autoUpdater = null; }
}

/* ---------- Menu ---------- */
function buildMenu() {
  const tpl = [
    { label: 'Tệp', submenu: [
      { label: 'Tải lại giao diện', accelerator: 'CmdOrCtrl+R', click: async () => { if (win && await confirmRisk(win, 'Vẫn tải lại')) win.webContents.reloadIgnoringCache(); } },
      { type: 'separator' }, { role: 'quit', label: 'Thoát' }] },
    { label: 'Xem', submenu: [
      { label: 'Toàn màn hình', role: 'togglefullscreen', accelerator: 'F11' },
      { label: 'Phóng to / khôi phục cửa sổ', click: () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); } },
      { label: 'Thu nhỏ cửa sổ', role: 'minimize' }, { type: 'separator' },
      { label: 'Phóng to chữ', role: 'zoomIn' }, { label: 'Thu nhỏ chữ', role: 'zoomOut' }, { label: 'Cỡ chữ mặc định', role: 'resetZoom' },
      ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Công cụ nhà phát triển' }])] },
    { label: 'Trợ giúp', submenu: [
      { label: 'Kiểm tra cập nhật', click: () => { if (autoUpdater) { manualUpdateCheck = true; autoUpdater.checkForUpdates().catch(() => {}); } else dialog.showMessageBox(win, { type: 'info', title: APP_NAME, message: 'Bản này chưa bật cập nhật tự động.' }); } },
      { label: 'Mở thư mục nhật ký', click: () => shell.openPath(path.join(app.getPath('userData'), 'logs')) },
      { type: 'separator' },
      { label: 'Thông tin phiên bản', click: () => dialog.showMessageBox(win, { type: 'info', title: APP_NAME, message: `${APP_NAME} ${app.getVersion()}`,
        detail: `CÔNG TY TNHH ĐỒNG KỸ THUẬT AOMAGA VIỆT NAM\n\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}\nDữ liệu cục bộ: ${app.getPath('userData')}` }) }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- Tải file (xuất Excel, sao lưu): hộp thoại Lưu có sẵn, mặc định vào thư mục Tài liệu ---------- */
function setupDownloads() {
  session.defaultSession.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
    item.once('done', async (ev, state) => {
      if (state !== 'completed') { if (state === 'interrupted') log('warn', 'tải file bị gián đoạn: ' + item.getFilename()); return; }
      const saved = item.getSavePath(); if (!saved || !win || win.isDestroyed()) return;
      const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Mở tệp', 'Mở thư mục', 'Đóng'], defaultId: 2, cancelId: 2, noLink: true, title: APP_NAME, message: 'Đã lưu tệp', detail: saved });
      if (r.response === 0) shell.openPath(saved); else if (r.response === 1) shell.showItemInFolder(saved);
    });
  });
}

/* ---------- Cửa sổ ---------- */
function createSplash() {
  splash = new BrowserWindow({ width: 460, height: 300, frame: false, resizable: false, movable: false, alwaysOnTop: true, show: false, skipTaskbar: true, title: APP_NAME,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  splash.once('ready-to-show', () => splash && splash.show());
  splash.loadFile(path.join(__dirname, 'splash.html'));
  setTimeout(closeSplash, 25000); // phòng khi tải chậm: không để splash che mãi
}
function closeSplash() { if (splash && !splash.isDestroyed()) splash.destroy(); splash = null; }

function createMainWindow() {
  const st = loadState();
  win = new BrowserWindow({ x: st.x, y: st.y, width: st.width, height: st.height, minWidth: 800, minHeight: 560, show: false, autoHideMenuBar: true, title: APP_NAME,
    backgroundColor: '#EAEFF5', icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, webviewTag: false } });
  if (st.maximized) win.maximize();

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1000, height: 800, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } }; // cửa sổ in báo cáo
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://aomaga/')) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  win.webContents.on('render-process-gone', (e, d) => {
    log('error', 'render-process-gone: ' + d.reason);
    if (d.reason !== 'clean-exit') dialog.showMessageBox(win, { type: 'error', title: APP_NAME, message: 'Giao diện gặp sự cố và sẽ được tải lại.', detail: 'Dữ liệu đã gửi lên máy chủ không bị ảnh hưởng.' }).then(() => win.reload());
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => { if (code !== -3) log('error', `did-fail-load ${code} ${desc} ${url}`); });
  win.webContents.on('did-finish-load', () => { if (!win.isVisible()) win.show(); closeSplash(); });
  win.on('resize', saveState); win.on('move', saveState);

  win.on('close', async e => {
    if (forceClose || SMOKE) { saveState(); return; }
    e.preventDefault();
    if (await confirmRisk(win, 'Vẫn đóng ứng dụng')) { forceClose = true; saveState(); win.close(); }
  });
  win.on('closed', () => { win = null; });
  win.loadURL(APP_URL);
}

/* ---------- Kiểm thử khởi động tự động (AMG_SMOKE=1) ---------- */
function runSmoke() {
  const errors = [];
  win.webContents.on('console-message', (e, level, message) => { if (level >= 3) errors.push(message.slice(0, 200)); });
  win.webContents.on('did-finish-load', () => setTimeout(async () => {
    try {
      const r = await win.webContents.executeJavaScript(`({
        title: document.title, origin: location.origin, native: window.AMG_NATIVE, hasElectronApi: !!window.amgElectron, hasNodeLeak: typeof require !== 'undefined' || typeof process !== 'undefined',
        react: typeof React !== 'undefined', recharts: !!(window.Recharts && Recharts.LineChart), xlsx: typeof XLSX !== 'undefined' && !!XLSX.writeFile,
        rootChildren: (document.getElementById('root')||{children:[]}).children.length, bodyTextLen: document.body.innerText.length,
        sw: ('serviceWorker' in navigator) ? 'api' : 'none', csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
        mesFns: ['amgCcSearch','amgMachineCardState','MACHINE_TYPES'].map(n => typeof window[n]),
        storage: (function(){ try { localStorage.setItem('amg_smoke','1'); var v = localStorage.getItem('amg_smoke'); localStorage.removeItem('amg_smoke'); return v === '1'; } catch (e) { return false; } })()
      })`);
      console.log('SMOKE_RESULT ' + JSON.stringify({ ok: true, r, errors, userData: app.getPath('userData'), version: app.getVersion() }));
    } catch (e) { console.log('SMOKE_RESULT ' + JSON.stringify({ ok: false, error: String(e), errors })); }
    app.exit(0);
  }, 6000));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());

app.whenReady().then(() => {
  if (SMOKE) app.setPath('userData', process.env.AMG_SMOKE_USERDATA || path.join(app.getPath('temp'), 'amg-smoke-userdata'));
  log('info', `Khởi động ${APP_NAME} ${app.getVersion()} (${process.platform} ${process.arch}) electron ${process.versions.electron}`);
  registerAppProtocol();
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(false)); // ứng dụng không cần camera/mic/vị trí...
  ipcMain.handle('amg:get-version', () => app.getVersion());
  setupDownloads();
  buildMenu();
  if (!SMOKE) createSplash();
  createMainWindow();
  if (SMOKE) runSmoke();
  setupUpdater();
});
