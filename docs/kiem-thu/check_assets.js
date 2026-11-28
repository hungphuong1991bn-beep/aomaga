/* v52 — Nhất quán PWA: mọi <script src> trong index.html phải tồn tại trên đĩa VÀ nằm trong danh sách APP của sw.js;
   mọi tệp trong APP phải tồn tại; tên cache phải là bản v52; manifest hợp lệ; mọi tệp .js phải qua kiểm tra cú pháp. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const APP=path.resolve(process.env.APP_DIR||'../..'); let fail=0,pass=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x?' :: '+x:''));} };
const html=fs.readFileSync(path.join(APP,'index.html'),'utf8'), sw=fs.readFileSync(path.join(APP,'sw.js'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m=>m[1].split('?')[0]).filter(s=>!/^https?:/.test(s));
const appList=[...sw.slice(sw.indexOf('const APP')).matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]).filter(Boolean);
ok('A1. Mọi script nội bộ trong index.html tồn tại trên đĩa', scripts.every(s=>fs.existsSync(path.join(APP,s))), scripts.filter(s=>!fs.existsSync(path.join(APP,s))).join(','));
ok('A2. Mọi script nội bộ nằm trong danh sách APP của sw.js (chạy offline/PWA đủ tệp)', scripts.every(s=>appList.includes(s)), scripts.filter(s=>!appList.includes(s)).join(','));
ok('A3. Mọi tệp trong APP của sw.js tồn tại', appList.every(f=>fs.existsSync(path.join(APP,f))), appList.filter(f=>!fs.existsSync(path.join(APP,f))).join(','));
ok('A4. Tên cache Service Worker là bản v57/v58/v59', /const V = 'mes-v5[789]-/.test(sw));
ok('A5. Mọi script dùng cùng tham số phiên bản ?v=59.0 (không lẫn bản cũ)', [...html.matchAll(/<script[^>]*\ssrc="(?!https?:)([^"]+)"/g)].every(m=>/\?v=59\.0$/.test(m[1])));
let m; try{ m=JSON.parse(fs.readFileSync(path.join(APP,'manifest.json'),'utf8')); }catch(e){}
ok('A6. manifest.json hợp lệ (PWA)', !!m&&!!m.name&&Array.isArray(m.icons)&&m.icons.length>0);
const bad=[]; (function walk(d){ fs.readdirSync(d).forEach(f=>{ const p=path.join(d,f); if(f==='docs'||f==='node_modules') return; if(fs.statSync(p).isDirectory()) return walk(p); if(p.endsWith('.js')){ try{ new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}); }catch(e){ bad.push(path.relative(APP,p)+': '+e.message); } } }); })(APP);
ok('A7. Mọi tệp .js hợp lệ cú pháp', bad.length===0, bad.join(' | '));
const order=scripts; const idx=f=>order.indexOf(f);
ok('A8. Thứ tự nạp: search/opslive sau executive/flow; opsboard sau plan', idx('domain/search.js')>idx('domain/executive.js')&&idx('domain/opslive.js')>idx('domain/search.js')&&idx('modules/ops/opsboard.js')>-1);
console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
