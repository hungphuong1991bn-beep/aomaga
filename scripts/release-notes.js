#!/usr/bin/env node
/* Tạo nội dung GitHub Release từ CHANGELOG.md.  Dùng: node scripts/release-notes.js v1.2.3 <owner/repo> > notes.md
   Mỗi phiên bản: số phiên bản, ngày phát hành, thay đổi, lỗi đã sửa, chức năng mới, link tải EXE/APK. */
'use strict';
const fs = require('fs'), path = require('path');
const tag = process.argv[2] || '', repo = process.argv[3] || '', unsigned = process.env.AMG_UNSIGNED_APK === '1';
const ver = tag.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(ver)) { console.error('Tag phải dạng vX.Y.Z'); process.exit(1); }
const cl = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const m = cl.match(new RegExp('^## \\[' + ver.replace(/\./g, '\\.') + '\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|$(?![\\s\\S]))', 'm'));
const head = cl.match(new RegExp('^## \\[' + ver.replace(/\./g, '\\.') + '\\][^\\n]*', 'm'));
const base = `https://github.com/${repo}/releases/download/${tag}`;
const out = [];
out.push(`# AOMAGA MES ${tag}`, '');
out.push(head ? head[0].replace(/^## /, '**Phiên bản:** ') : `**Phiên bản:** ${ver}`, '');
out.push('## Tải về', '', `- Windows 10/11 64-bit: [AOMAGA-MES-Setup-x64.exe](${base}/AOMAGA-MES-Setup-x64.exe)`);
out.push(unsigned ? `- Android (**bản thử nghiệm ký debug**, chưa phải bản phát hành chính thức): [AOMAGA-MES-Android-DEBUG.apk](${base}/AOMAGA-MES-Android-DEBUG.apk)` : `- Android: [AOMAGA-MES-Android.apk](${base}/AOMAGA-MES-Android.apk)`, '');
out.push('> Bộ cài Windows chưa ký số sẽ hiện cảnh báo SmartScreen ("Windows đã bảo vệ PC của bạn") → bấm **Thông tin thêm → Vẫn chạy**. Chỉ tải từ trang Releases chính thức của công ty.', '');
out.push(m ? m[1].trim() : '_Chưa có mô tả cho phiên bản này trong CHANGELOG.md._', '');
out.push('Phiên bản Web vẫn truy cập qua GitHub Pages như cũ. Cập nhật không làm mất dữ liệu: dữ liệu nằm trên Firebase dùng chung và bộ nhớ đệm riêng của từng thiết bị.');
process.stdout.write(out.join('\n') + '\n');
