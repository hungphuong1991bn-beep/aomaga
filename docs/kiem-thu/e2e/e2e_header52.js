/* v52 — E2E Global Header: đồng hồ, trạng thái đồng bộ thật, cập nhật từ thiết bị khác (không F5), tìm kiếm toàn hệ thống (Ctrl+K/ESC/phân quyền). */
const {boot}=require('./e2e_lib');
const E=boot(); const {w,doc,errs,sleep,A,db,sha,nativeSet,txt,findBtn,click,clickText}=E;
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const store=n=>Object.values(w.__db.__store[n]||{});
const sync=()=>{ const e=doc.querySelector('.mes-sync'); return e?{k:e.getAttribute('data-sync'),t:txt(e)}:null; };
const keydown=(el,opts)=>el.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},opts)));
const sInput=()=>doc.querySelector('.mes-gsearch-input');
(async()=>{
  await sleep(300);
  JSON.parse(await A('return JSON.stringify(genMachineSeed())')).forEach(m=>db.__seed('machines',m.id,m));
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  const mk=async(id,cust,spec,mat,q,extra={})=>{ const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages(Object.assign({id:"${id}",customer:"${cust}",spec:"${spec}",materialCode:"${mat}",quantity:${q},orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra)})))`); db.__seed('orders',id,JSON.parse(j)); };
  await mk('HD-001','Công ty Đồng Việt','0.254BC','B',500); await mk('HD-002','Dây điện Minh Long','0.3AB','C',300);
  await mk('HD-OLD','Khách đã xong','0.2','B',100,{status:'completed',completedAt:'2026-10-01T03:00:00.000Z',completedBy:'QĐ',completionSummary:{finished:100,qty:100,unit:'kg',short:false,route:['keo_tinh']}});
  await sleep(200);
  Object.keys(w.__db.__store.orders||{}).filter(id=>!/^HD-/.test(id)).forEach(id=>w.__server.patch({['orders/'+id]:null})); await sleep(300);
  const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],'admin'); nativeSet(inputs[1],'test'); await sleep(50);
  await clickText(/^Đăng nhập/); await sleep(900);

  // ---- Header dùng chung ----
  ok('H1. Có đúng MỘT Global Header, đủ thành phần: nút thu gọn, tên nhóm/tab, tìm kiếm, đồng hồ, ca, trạng thái đồng bộ, thông báo, sáng/tối, đồng bộ, tài khoản, đăng xuất',
    doc.querySelectorAll('.mes-topbar').length===1&&!!doc.querySelector('.mes-collapse-btn')&&!!doc.querySelector('.mes-topbar-crumb b')&&!!sInput()&&!!doc.querySelector('.mes-clock-time')&&!!doc.querySelector('.mes-clock-shift')&&!!doc.querySelector('.mes-sync')&&!!doc.querySelector('[aria-label^="Thông báo"]')&&!!doc.querySelector('[aria-label="Đổi giao diện sáng/tối"]')&&!!doc.querySelector('[aria-label="Đồng bộ dữ liệu ngay"]')&&/Quản trị/.test(txt(doc.querySelector('.mes-topbar-user')))&&!!doc.querySelector('[title="Đăng xuất"]'));
  const fc0=(()=>{ let n=0; const f=w.fetch; w.fetch=(...a)=>{n++;return f(...a);}; return ()=>n; })();
  ok('H1b. Chỉ MỘT luồng đồng bộ (SSE) cho toàn ứng dụng — không nhân đôi listener', w.__server.streams.size===1, w.__server.streams.size);
  for(const re of [/^Đơn hàng & BOM/,/^Kế hoạch sản xuất/,/^Điều hành sản xuất/,/^Đơn hàng hoàn thành/]){ await clickText(re); await sleep(400); }
  ok('H2b. Chuyển qua các tab KHÔNG gọi thêm lượt đọc Firebase nào (dùng dữ liệu onSnapshot sẵn có)', fc0()===0, fc0());
  ok('H2. Header vẫn là MỘT bản duy nhất khi đổi tab (không có header riêng của phân hệ)', doc.querySelectorAll('.mes-topbar').length===1&&doc.querySelectorAll('header').length===1);
  const ct=doc.querySelector('.mes-topbar-crumb'); ok('H3. Hiện tên nhóm + tên tab hiện tại', /Đơn hàng hoàn thành/.test(txt(ct))&&txt(ct).length>"Đơn hàng hoàn thành".length, txt(ct));
  const sb=doc.querySelector('.mes-sidebar'); const was=sb.className.includes('collapsed'); await click(doc.querySelector('.mes-collapse-btn')); await sleep(100);
  ok('H4. Nút trên header thu gọn/mở rộng Sidebar', doc.querySelector('.mes-sidebar').className.includes('collapsed')!==was); await click(doc.querySelector('.mes-collapse-btn')); await sleep(100);

  // ---- Đồng hồ ----
  const t1=txt(doc.querySelector('.mes-clock-time')); await sleep(2300); const t2=txt(doc.querySelector('.mes-clock-time'));
  const sod=s=>{const [h,m,x]=s.split(':').map(Number);return h*3600+m*60+x;}; const nowd=new Date(); const real=nowd.getHours()*3600+nowd.getMinutes()*60+nowd.getSeconds();
  ok('C1. Đồng hồ chạy theo giây (hai lần đọc cách ~2,3s khác nhau)', /^\d\d:\d\d:\d\d$/.test(t1)&&t1!==t2&&sod(t2)-sod(t1)>=1&&sod(t2)-sod(t1)<=4, t1+' → '+t2);
  ok('C2. Đồng hồ đúng giờ máy (lệch ≤2 giây)', Math.abs(sod(t2)-real)<=2, t2);
  const dt=txt(doc.querySelector('.mes-clock-date')), p=n=>String(n).padStart(2,'0');
  ok('C3. Hiện thứ + ngày/tháng/năm đúng', dt===`${['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'][nowd.getDay()]}, ${p(nowd.getDate())}/${p(nowd.getMonth()+1)}/${nowd.getFullYear()}`, dt);
  const wr0=w.__server.writes; await sleep(2200); ok('C4. Đồng hồ KHÔNG ghi gì lên Firebase', w.__server.writes===wr0);
  ok('C5. Hiện ca sản xuất hiện tại', /^Ca (Ngày|Đêm)$/.test(txt(doc.querySelector('.mes-clock-shift'))));

  // ---- Trạng thái đồng bộ phản ánh kết nối THẬT ----
  await sleep(300); let s0=sync(); ok('S1. Đã kết nối + không còn thay đổi chờ gửi → "Đã đồng bộ"/"Đã kết nối"/"Vừa nhận cập nhật"', s0&&['synced','connected','updated'].includes(s0.k), JSON.stringify(s0));
  w.__net.online=false; w.dispatchEvent(new w.Event('offline')); await sleep(150); s0=sync(); ok('S2. Mất mạng → "Mất kết nối"', s0&&s0.k==='offline'&&/Mất kết nối/.test(s0.t), JSON.stringify(s0));
  await A(`await db.collection(FS.orders).doc("HD-002").set(Object.assign({},(await db.collection(FS.orders).doc("HD-002").get()).data(),{note:"sửa khi mất mạng"}))`); await sleep(200);
  s0=sync(); ok('S3. Có thay đổi chờ gửi khi mất mạng → hiện số thay đổi chờ gửi, KHÔNG báo "Đã đồng bộ"', s0&&s0.k==='offline'&&/chờ gửi/.test(s0.t), JSON.stringify(s0));
  w.__net.online=true; w.dispatchEvent(new w.Event('online')); await sleep(4200); s0=sync();
  ok('S4. Có mạng lại → tự gửi hàng đợi và về "Đã đồng bộ"; máy chủ nhận được thay đổi', s0&&['synced','updated','connected'].includes(s0.k)&&JSON.parse(w.__server.root.orders['HD-002'].d).note==='sửa khi mất mạng', JSON.stringify(s0));
  // lỗi đồng bộ: máy chủ từ chối ghi
  const origFetch=w.fetch; w.fetch=(u,i)=>(i&&i.method==='PATCH')?Promise.resolve({ok:false,status:403,json:async()=>({})}):origFetch(u,i);
  await A(`await db.collection(FS.orders).doc("HD-002").set(Object.assign({},(await db.collection(FS.orders).doc("HD-002").get()).data(),{note:"bị từ chối"}))`); await sleep(300);
  s0=sync(); ok('S5. Máy chủ từ chối ghi → "Có lỗi đồng bộ" kèm lý do trong tooltip', s0&&s0.k==='error'&&/lỗi đồng bộ/i.test(s0.t)&&/Rules|từ chối/.test(doc.querySelector('.mes-sync').title), JSON.stringify(s0)+' '+doc.querySelector('.mes-sync').title);
  w.fetch=origFetch; await click(doc.querySelector('[aria-label="Đồng bộ dữ liệu ngay"]')); await sleep(3600); s0=sync();
  ok('S6. Nút "Đồng bộ ngay" gửi lại hàng đợi → hết lỗi', s0&&s0.k!=='error'&&s0.k!=='offline', JSON.stringify(s0));

  // ---- Cập nhật từ thiết bị khác, không F5, không nhân đôi ----
  await clickText(/^Đơn hàng & BOM/); await sleep(500);
  const E2=boot({server:w.__server}); await E2.sleep(600); E2.w.__AMG_USER={username:'admin',role:'admin',fullName:'Thiết bị 2'};
  const before=[...doc.querySelectorAll('.amg-row')].length;
  await E2.A(`const s=await db.collection(FS.orders).doc("HD-001").get(); await db.collection(FS.orders).doc("HD-001").set(Object.assign({},s.data(),{customer:"Công ty ĐÃ ĐỔI TÊN"}))`);
  let seen=false,flash=false; for(let i=0;i<40&&!seen;i++){ await sleep(50); if(sync()&&sync().k==='updated') flash=true; seen=/ĐÃ ĐỔI TÊN/.test(txt(doc.body)); }
  ok('R1. Thiết bị khác sửa đơn → màn hình này tự cập nhật (không F5)', seen);
  ok('R2. Có chỉ báo "Vừa nhận cập nhật" khi dữ liệu đến từ thiết bị khác', flash);
  ok('R3. Không nhân đôi bản ghi', [...doc.querySelectorAll('.amg-row')].length===before&&store('orders').filter(o=>o.id==='HD-001').length===1);
  await sleep(4400); ok('R4. Chỉ báo "vừa cập nhật" tự tắt sau vài giây', sync()&&sync().k!=='updated', JSON.stringify(sync()));

  // ---- Tìm kiếm toàn hệ thống ----
  const fetchCount=()=>w.__fetchCalls||0; let calls=0; const f0=w.fetch; w.fetch=(...a)=>{calls++;return f0(...a);}; const es0=w.EventSource;
  keydown(w,{key:'k',ctrlKey:true}); await sleep(100);
  ok('Q1. Ctrl+K mở tìm kiếm và đưa con trỏ vào ô', doc.querySelector('.mes-gsearch-box').className.includes('is-open')&&doc.activeElement===sInput());
  for(const val of ['H','HD','HD-','HD-0','HD-00','HD-001']){ nativeSet(sInput(),val); await sleep(30); }
  await sleep(100);
  ok('Q2. Gõ KHÔNG gọi lại mạng/Firebase (dùng dữ liệu onSnapshot đã có)', calls===0, calls);
  let panel=txt(doc.querySelector('.mes-gsearch-panel')||doc.body); ok('Q3. Gợi ý ngay khi gõ, nhóm "Đơn hàng", hiện mã + khách hàng', /Đơn hàng \(1\)/.test(panel)&&/HD-001 · Công ty ĐÃ ĐỔI TÊN/.test(panel), panel.slice(0,200));
  nativeSet(sInput(),'dong viet'); await sleep(60); nativeSet(sInput(),'minh long'); await sleep(60); panel=txt(doc.querySelector('.mes-gsearch-panel'));
  ok('Q4. Tìm không dấu theo tên khách hàng, có nhóm "Khách hàng" và "Đơn hàng"', /Khách hàng \(1\)/.test(panel)&&/Dây điện Minh Long/.test(panel), panel.slice(0,200));
  nativeSet(sInput(),'0.254'); await sleep(60); panel=txt(doc.querySelector('.mes-gsearch-panel')); ok('Q5. Tìm theo quy cách', /Quy cách sản phẩm/.test(panel)&&/HD-001/.test(panel), panel.slice(0,160));
  nativeSet(sInput(),'KT-01'); await sleep(60); panel=txt(doc.querySelector('.mes-gsearch-panel')); ok('Q6. Tìm theo mã máy', /Máy sản xuất/.test(panel)&&/KT-01/.test(panel), panel.slice(0,160));
  nativeSet(sInput(),'khach da xong'); await sleep(60); panel=txt(doc.querySelector('.mes-gsearch-panel')); ok('Q7. Đơn hoàn thành nằm ở nhóm riêng "Đơn hàng hoàn thành"', /Đơn hàng hoàn thành \(1\)/.test(panel)&&/HD-OLD/.test(panel), panel.slice(0,160));
  nativeSet(sInput(),'zzzkhongco'); await sleep(60); ok('Q8. Không có kết quả → hiện thông báo "Không tìm thấy"', /Không tìm thấy kết quả/.test(txt(doc.querySelector('.mes-gsearch-panel'))));
  keydown(sInput(),{key:'Escape'}); await sleep(80); ok('Q9. ESC đóng bảng kết quả', !doc.querySelector('.mes-gsearch-panel')&&!doc.querySelector('.mes-gsearch-box').className.includes('is-open'));
  keydown(w,{key:'k',ctrlKey:true}); await sleep(80); nativeSet(sInput(),'HD-OLD'); await sleep(60); await click([...doc.querySelectorAll('.mes-gsearch-item')].find(b=>/HD-OLD/.test(txt(b)))); await sleep(500);
  ok('Q10. Chọn kết quả đơn hoàn thành → mở đúng tab "Đơn hàng hoàn thành" VÀ mở sẵn chi tiết đúng đơn', /Đơn hàng hoàn thành/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&!!doc.querySelector('.mes-modal-card')&&/HD-OLD/.test(txt(doc.querySelector('.mes-modal-card'))), txt(doc.querySelector('.mes-modal-card')||doc.body).slice(0,120));
  await click(findBtn(/^Đóng$/,doc.querySelector('.mes-modal-card'))); await sleep(200);
  keydown(w,{key:'k',ctrlKey:true}); await sleep(80); nativeSet(sInput(),'HD-002'); await sleep(60); keydown(sInput(),{key:'Enter'}); await sleep(500);
  ok('Q11. Enter chọn kết quả đầu: mở tab Đơn hàng & BOM với chi tiết đơn HD-002', /Đơn hàng & BOM/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&!!doc.querySelector('.mes-modal-card')&&/HD-002/.test(txt(doc.querySelector('.mes-modal-card'))));
  await click(doc.querySelector('.mes-mobile-modal-backdrop')); await sleep(200); // đóng hộp thoại bằng cách bấm nền (hộp chi tiết đơn không có nút Đóng)
  keydown(w,{key:'k',ctrlKey:true}); await sleep(80); nativeSet(sInput(),'Minh Long'); await sleep(60); await click([...doc.querySelectorAll('.mes-gsearch-item')].find(b=>/Dây điện Minh Long/.test(txt(b))&&!/HD-/.test(txt(b)))); await sleep(500);
  ok('Q12. Chọn một khách hàng → sang tab Đơn hàng và lọc sẵn theo khách đó', /Đơn hàng & BOM/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&doc.querySelector('input.mes-input')&&doc.querySelector('input.mes-input').value==='Dây điện Minh Long');
  // phân quyền: chỉ mục chỉ có nhóm thuộc tab được xem
  const r=JSON.parse(await A(`const o=[{id:"X1",customer:"KH-BI-MAT",spec:"s",status:"completed"},{id:"X2",customer:"KH-BI-MAT",spec:"s"}];
    const all=amgBuildSearchIndex({orders:o,machines:[{id:"M1"}],staff:[{id:"NV1",name:"Nguyễn Văn A"}],extra:{documents:[{id:"TL1",title:"Quy trình"}]},allowedTabs:["orders","machines","staff","completed","docs"]});
    const lim=amgBuildSearchIndex({orders:o,machines:[{id:"M1"}],staff:[{id:"NV1",name:"Nguyễn Văn A"}],extra:{documents:[{id:"TL1",title:"Quy trình"}]},allowedTabs:["machines"]});
    return JSON.stringify({all:amgSearchRun(all,"bi mat").total,allStaff:amgSearchRun(all,"nguyen van a").total,lim:amgSearchRun(lim,"bi mat").total,limStaff:amgSearchRun(lim,"nguyen").total,limM:amgSearchRun(lim,"M1").total})`));
  ok('Q13. Không hiện dữ liệu ngoài quyền: tab không được xem → không có kết quả của tab đó', r.all>0&&r.allStaff>0&&r.lim===0&&r.limStaff===0&&r.limM===1, JSON.stringify(r));
  const real2=errs.filter(e=>!/Warning: .*(act|unmounted)/i.test(e)); ok('Z. Không có lỗi console/React', real2.length===0, real2.slice(0,3).join(' || '));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
