#!/usr/bin/env node
/* Chuẩn bị thư mục www/ cho bản Windows (Electron) và Android (Capacitor).
   - KHÔNG sửa file gốc của bản Web/GitHub Pages: mọi chỉnh sửa chỉ nằm trong www/ (thư mục sinh ra, không commit).
   - Thư viện từ CDN (React, Recharts, xlsx...) được đóng gói sẵn trong www/vendor/ đúng phiên bản đang dùng → chạy được khi mạng yếu,
     không phụ thuộc CDN lúc khởi động và không bị thay đổi nội dung từ bên ngoài.
   - Bỏ Service Worker (bản native tự cập nhật qua bộ cài/APK; SW cache làm lệch phiên bản).
   - Thêm chính sách bảo mật nội dung (CSP) và cầu nối native (tải file/nút Quay lại). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const APP_DIRS = ['assets', 'core', 'data', 'domain', 'modules', 'ui'];
// Nguồn CDN → tệp trong node_modules (đúng phiên bản đã ghim trong package.json)
const VENDOR = [
  { cdn: 'https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js', from: 'react/umd/react.production.min.js', to: 'react.production.min.js', dep: 'react', ver: '18.2.0' },
  { cdn: 'https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js', from: 'react-dom/umd/react-dom.production.min.js', to: 'react-dom.production.min.js', dep: 'react-dom', ver: '18.2.0' },
  { cdn: 'https://cdn.jsdelivr.net/npm/prop-types@15.8.1/prop-types.min.js', from: 'prop-types/prop-types.min.js', to: 'prop-types.min.js', dep: 'prop-types', ver: '15.8.1' },
  { cdn: 'https://cdn.jsdelivr.net/npm/recharts@2.8.0/umd/Recharts.min.js', from: 'recharts/umd/Recharts.js', to: 'Recharts.js', dep: 'recharts', ver: '2.8.0' },
  { cdn: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', from: 'xlsx/dist/xlsx.full.min.js', to: 'xlsx.full.min.js', dep: 'xlsx', ver: '0.18.5' }
];
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.firebasedatabase.app https://*.firebaseio.com",
  "object-src 'none'", "base-uri 'self'", "frame-src 'none'"
].join('; ');

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
function fail(msg) { console.error('LỖI prepare-www: ' + msg); process.exit(1); }

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
APP_DIRS.forEach(d => copyDir(path.join(ROOT, d), path.join(OUT, d)));
fs.copyFileSync(path.join(ROOT, 'manifest.json'), path.join(OUT, 'manifest.json'));

// vendor
fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const v of VENDOR) {
  const src = path.join(ROOT, 'node_modules', v.from);
  if (!fs.existsSync(src)) fail('thiếu ' + v.from + ' — chạy "npm ci" trước.');
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', v.dep, 'package.json'), 'utf8')).version;
  if (real !== v.ver) fail(`${v.dep} đang là ${real}, index.html dùng ${v.ver}: phải trùng phiên bản.`);
  fs.copyFileSync(src, path.join(OUT, 'vendor', v.to));
  if (html.indexOf(v.cdn) < 0) fail('index.html không còn tham chiếu ' + v.cdn + ' — cập nhật danh sách VENDOR.');
  html = html.split(v.cdn).join('vendor/' + v.to);
}
// Service Worker: bỏ khối đăng ký (bản native không dùng)
const swStart = html.indexOf('<!-- Service Worker -->');
if (swStart < 0) fail('không tìm thấy khối Service Worker trong index.html');
const swEnd = html.indexOf('</script>', swStart);
html = html.slice(0, swStart) + '<!-- (bản native: không đăng ký Service Worker) -->' + html.slice(swEnd + '</script>'.length);
// CSP + cầu nối native ngay đầu <head>
const headAt = html.indexOf('<head>');
if (headAt < 0) fail('không tìm thấy <head>');
const inject = `\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">\n  <script src="native/native-bridge.js"></script>`;
html = html.slice(0, headAt + 6) + inject + html.slice(headAt + 6);
if (/<script[^>]+src="https?:/i.test(html)) fail('còn script tải từ internet trong www/index.html');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// cầu nối native (gắn số phiên bản)
fs.mkdirSync(path.join(OUT, 'native'), { recursive: true });
const bridge = fs.readFileSync(path.join(ROOT, 'native', 'native-bridge.js'), 'utf8').replace('__AMG_VERSION__', pkg.version);
fs.writeFileSync(path.join(OUT, 'native', 'native-bridge.js'), bridge);
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ name: 'AOMAGA MES', version: pkg.version, builtAt: new Date().toISOString() }, null, 2));

// kiểm tra: mọi script/link cục bộ trong index.html phải tồn tại
const refs = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:)/.test(u));
const missing = refs.map(u => u.split('?')[0]).filter(u => !fs.existsSync(path.join(OUT, u)));
if (missing.length) fail('www/index.html tham chiếu tệp không tồn tại: ' + missing.join(', '));
console.log(`www/ sẵn sàng (v${pkg.version}): ${refs.length} tệp tham chiếu, ${VENDOR.length} thư viện đóng gói sẵn.`);
