#!/usr/bin/env node
/* Cổng kiểm tra trước khi build/phát hành: cấu hình bộ cài, Android, workflow, bí mật bị lộ, và bản Web (GitHub Pages) không bị ảnh hưởng.
   Chạy: npm run verify  (CI chạy tự động; thất bại → không build/phát hành). */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));
let YAML; try { YAML = require('yaml'); } catch (e) { console.error('Thiếu thư viện "yaml" — chạy npm ci'); process.exit(2); }
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); } };

const pkg = JSON.parse(rd('package.json'));
const eb = YAML.parse(rd('electron-builder.yml'));
const cap = JSON.parse(rd('capacitor.config.json'));

/* --- Phiên bản & định danh --- */
ok('V1. package.json có phiên bản semver', /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version);
ok('V2. Tên ứng dụng AOMAGA MES (Windows + Android)', pkg.productName === 'AOMAGA MES' && eb.productName === 'AOMAGA MES' && cap.appName === 'AOMAGA MES');
ok('V3. Mã gói Android ổn định vn.aomaga.mes (Capacitor + Gradle + electron-builder)', cap.appId === 'vn.aomaga.mes' && eb.appId === 'vn.aomaga.mes' && /applicationId "vn\.aomaga\.mes"/.test(rd('android/app/build.gradle')));

/* --- Windows --- */
ok('W1. NSIS x64, tên bộ cài đúng AOMAGA-MES-Setup-x64.exe', eb.win.target[0].target === 'nsis' && eb.win.target[0].arch[0] === 'x64' && eb.nsis.artifactName === 'AOMAGA-MES-Setup-x64.exe');
ok('W2. Cho chọn thư mục cài, tạo shortcut Desktop + Start Menu', eb.nsis.oneClick === false && eb.nsis.allowToChangeInstallationDirectory === true && eb.nsis.createStartMenuShortcut === true && /always|true/.test(String(eb.nsis.createDesktopShortcut)));
ok('W3. Gỡ cài đặt KHÔNG xoá dữ liệu người dùng', eb.nsis.deleteAppDataOnUninstall === false);
const icoSizes = (() => { try { const b = fs.readFileSync(path.join(ROOT, 'build/icon.ico')); const n = b.readUInt16LE(4); const out = []; for (let i = 0; i < n; i++) out.push(b[6 + i * 16] || 256); return out; } catch (e) { return []; } })();
ok('W4. Có icon .ico chứa ảnh 256px (+ các cỡ nhỏ)', icoSizes.includes(256) && icoSizes.includes(16) && icoSizes.includes(32), icoSizes.join(','));
ok('W5. Cập nhật tự động từ GitHub Releases', eb.publish && eb.publish.provider === 'github' && pkg.dependencies['electron-updater']);
const main = rd('electron/main.js');
ok('W6. Electron bảo mật: contextIsolation + sandbox + không nodeIntegration', /contextIsolation: true/.test(main) && /sandbox: true/.test(main) && /nodeIntegration: false/.test(main) && !/nodeIntegration: true/.test(main));
ok('W7. Không ép cài cập nhật khi đang làm việc (chỉ cài khi đóng app hoặc người dùng chọn + có cảnh báo)', /autoInstallOnAppQuit = true/.test(main) && /confirmRisk\(win, 'Vẫn khởi động lại và cài'\)/.test(main));
ok('W8. Đóng cửa sổ có cảnh báo khi còn dữ liệu chưa gửi', /pendingInfo/.test(main) && /__rtdbStatus/.test(main));
ok('W9. Dữ liệu cục bộ nằm ở userData, không ở thư mục cài', !/app\.getAppPath\(\).*writeFile|process\.resourcesPath.*writeFile/.test(main));

/* --- Android --- */
const man = rd('android/app/src/main/AndroidManifest.xml'), gradle = rd('android/app/build.gradle');
const perms = [...man.matchAll(/uses-permission android:name="([^"]+)"/g)].map(m => m[1]);
ok('A1. Quyền Android tối thiểu (chỉ INTERNET)', perms.length === 1 && perms[0] === 'android.permission.INTERNET', perms.join(','));
ok('A2. allowBackup=false, chặn cleartext, không debuggable trong manifest', /allowBackup="false"/.test(man) && /usesCleartextTraffic="false"/.test(man) && !/debuggable/.test(man));
ok('A3. Khoá ký chỉ lấy từ biến môi trường, không có mật khẩu trong gradle', /System\.getenv\("AMG_KEYSTORE_FILE"\)/.test(gradle) && !/(storePassword|keyPassword)\s+["'][^"']+["']/.test(gradle));
ok('A4. Có icon + splash Android', exists('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png') && exists('android/app/src/main/res/drawable/splash.png'));
ok('A5. Plugin Android: app/filesystem/share/splash', ['app', 'filesystem', 'share', 'splash-screen'].every(n => pkg.devDependencies['@capacitor/' + n]));
ok('A6. webDir là www/ (sinh bởi prepare-www)', cap.webDir === 'www');

/* --- Bí mật không được nằm trong repo --- */
const skip = /(^|\/)(node_modules|dist|www|\.git|\.gradle|build)(\/|$)|package-lock\.json$|\.png$|\.ico$|\.zip$|images\.js$/;
const files = []; (function walk(d) { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = path.posix.join(d, e.name); if (skip.test(rel)) continue; e.isDirectory() ? walk(rel) : files.push(rel); } })('.');
const bad = [];
for (const f of files) {
  if (/\.(jks|keystore|p12|pfx|pem)$/i.test(f) || /(service-?account|google-services)\.json$/i.test(f)) { bad.push('tệp nhạy cảm: ' + f); continue; }
  let t; try { t = rd(f); } catch (e) { continue; } if (t.length > 3e6) continue;
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) bad.push('khoá riêng trong ' + f);
  if (/"private_key"\s*:/.test(t)) bad.push('private_key trong ' + f);
  if (/AIza[0-9A-Za-z_-]{35}/.test(t)) bad.push('khoá API dạng AIza trong ' + f);
  if (/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(t)) bad.push('token GitHub trong ' + f);
}
ok('S1. Không có keystore/khoá riêng/service account/token trong source', bad.length === 0, bad.join('; '));
ok('S2. .gitignore chặn keystore, apk, dist, www', ['*.jks', '*.keystore', '*.apk', 'dist/', 'www/'].every(x => rd('.gitignore').split('\n').includes(x)));

/* --- Bản Web / GitHub Pages không bị ảnh hưởng --- */
const idx = rd('index.html');
ok('P1. index.html gốc vẫn dùng CDN + Service Worker, KHÔNG chứa mã native', /cdn\.jsdelivr\.net\/npm\/react@18\.2\.0/.test(idx) && /serviceWorker\.register\('sw\.js'\)/.test(idx) && !/native-bridge|Content-Security-Policy/.test(idx));
ok('P2. manifest.json + sw.js còn nguyên; có .nojekyll', exists('manifest.json') && exists('sw.js') && exists('.nojekyll'));
ok('P3. Mọi thư viện CDN trong index.html đã khai báo trong prepare-www', ['react@18.2.0', 'react-dom@18.2.0', 'prop-types@15.8.1', 'recharts@2.8.0', 'xlsx@0.18.5'].every(v => idx.includes(v) && rd('scripts/prepare-www.js').includes(v)));

/* --- Workflow --- */
const wf = {}; for (const f of fs.readdirSync(path.join(ROOT, '.github/workflows'))) wf[f] = YAML.parse(rd('.github/workflows/' + f));
const rel = wf['release.yml'], ci = wf['ci.yml'];
ok('G1. release.yml chạy khi tag v* và có nút chạy tay', rel && rel.on.push.tags.includes('v*') && 'workflow_dispatch' in rel.on);
const jobs = rel ? Object.values(rel.jobs) : [];
ok('G2. Build EXE trên windows-latest, APK trên ubuntu-latest', jobs.some(j => j['runs-on'] === 'windows-latest') && jobs.some(j => j['runs-on'] === 'ubuntu-latest'));
ok('G3. Release chỉ chạy sau khi kiểm thử + build xong', rel && rel.jobs.release && [].concat(rel.jobs.release.needs).length >= 2);
ok('G4. ci.yml chạy kiểm thử trên push/pull_request', ci && 'push' in ci.on && 'pull_request' in ci.on);
const wfText = Object.keys(wf).map(f => rd('.github/workflows/' + f)).join('\n');
ok('G5. Workflow không in bí mật ra log (không echo secrets)', !/echo\s+.*\$\{\{\s*secrets\./.test(wfText));
ok('G6. Quyền mặc định chỉ đọc; contents: write chỉ ở job release', rel && rel.permissions.contents === 'read' && rel.jobs.release.permissions.contents === 'write' && Object.entries(rel.jobs).every(([k, j]) => k === 'release' || !j.permissions));
const npmRuns = [...wfText.matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]);
ok('G7. Mọi "npm run" trong workflow tồn tại trong package.json', npmRuns.every(s => pkg.scripts[s]), npmRuns.filter(s => !pkg.scripts[s]).join(','));

/* --- Cú pháp --- */
const jsFiles = ['electron/main.js', 'electron/preload.js', 'native/native-bridge.js', ...fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js')).map(f => 'scripts/' + f)];
let synErr = ''; jsFiles.forEach(f => { try { cp.execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); } catch (e) { synErr += f + ' '; } });
ok('X1. Cú pháp JS của electron/native/scripts', !synErr, synErr);

console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
