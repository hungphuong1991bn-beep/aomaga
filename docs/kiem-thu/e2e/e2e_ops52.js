/* v52 — E2E Điều hành sản xuất: KPI khớp dữ liệu thật, thẻ máy + đồng hồ chạy, màu trạng thái, bảng đơn, cảnh báo, thời gian thực,
   thao tác nhanh (Phân máy mở đúng đơn), HOÀN THÀNH ĐƠN một bước ngay tại Điều hành, chế độ TV. */
const {boot}=require('./e2e_lib');
const E=boot(); const {w,doc,errs,sleep,A,db,sha,nativeSet,txt,findBtn,click,clickText}=E;
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const store=n=>Object.values(w.__db.__store[n]||{});
const ordr=id=>(w.__db.__store.orders||{})[id];
const tileVal=label=>{ const t=[...doc.querySelectorAll('.amg-kpi')].find(e=>txt(e).toUpperCase().startsWith(label.toUpperCase())); return t?txt(t).slice(label.length):null; };
const card=id=>doc.querySelector(`[data-machine="${id}"]`);
(async()=>{
  await sleep(300);
  const ms=JSON.parse(await A('return JSON.stringify(genMachineSeed())'));
  ms.forEach(m=>{ if(m.id==='KTI-04') m.status='broken'; if(m.id==='KTI-05') m.status='maintenance'; db.__seed('machines',m.id,m); });
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  db.__seed('users','nv1',{username:'nv1',fullName:'Nhân viên 1',role:'employee',team:'Kéo tinh',pwHash:sha('amg:nv1:test')});
  const mk=async(id,cust,spec,q,extra={})=>{ const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages(Object.assign({id:"${id}",customer:"${cust}",spec:"${spec}",materialCode:"B",quantity:${q},orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra)})))`); db.__seed('orders',id,JSON.parse(j)); };
  await mk('OP-1','Công ty Alpha','0.254BC',1000); await mk('OP-2','Công ty Beta','0.3AB',500); await mk('OP-3','Công ty Gamma','0.5',200,{deliveryDate:'2026-11-01'}); await mk('OP-4','Công ty Delta','0.4',100); await mk('OP-5','Công ty Epsilon','0.6',100);
  await sleep(200); Object.keys(w.__db.__store.orders||{}).filter(id=>!/^OP-/.test(id)).forEach(id=>w.__server.patch({['orders/'+id]:null})); await sleep(300);
  const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],'admin'); nativeSet(inputs[1],'test'); await sleep(50); await clickText(/^Đăng nhập/); await sleep(900);
  // dựng dữ liệu bằng đúng các hàm nghiệp vụ
  const asg=(r,o,m,q,op)=>A(`await amgFlowAssign({runId:"${r}",orderId:"${o}",machineId:"${m}",stageKey:"keo_tinh",plannedQuantity:${q},shift:"Ca Ngày",operator:"${op}",startNow:${r!=='R3'}})`);
  await asg('R1','OP-1','KTI-01',1000,'Nguyễn Văn A'); await A(`await amgFlowRecordOutput({clientKey:"o1",runId:"R1",orderId:"OP-1",machineId:"KTI-01",stageKey:"keo_tinh",qty:400})`);
  await asg('R2','OP-2','KTI-02',500,'Trần Thị B'); await A(`await amgFlowPause("R2","Chờ nguyên liệu")`);
  await asg('R3','OP-3','KTI-03',200,'Lê C');
  await asg('R4','OP-4','KTI-06',100,'Phạm D'); await A(`await amgFlowRecordOutput({clientKey:"o4",runId:"R4",orderId:"OP-4",machineId:"KTI-06",stageKey:"keo_tinh",qty:100}); await amgFlowFinishRun({runId:"R4",completeStage:true})`);
  await sleep(300);
  await clickText(/^Điều hành sản xuất/); await sleep(700);
  const runs=store('productionRuns'), open=runs.filter(r=>['running','paused','assigned'].includes(r.productionStatus)), today=new Date().toISOString().slice(0,10);
  ok('P1. Mở được tab Điều hành sản xuất với tab "Giám sát sản xuất"', /Giám sát nhà máy/.test(txt(doc.body))&&/Giám sát sản xuất/.test(txt(doc.body)));
  ok('P2. KPI "Lệnh máy đang mở" khớp dữ liệu Firebase', tileVal('Lệnh máy đang mở').startsWith(String(open.length)), tileVal('Lệnh máy đang mở')+' vs '+open.length);
  ok('P3. KPI máy: đang chạy / tạm dừng / sự cố / bảo trì khớp dữ liệu', tileVal('Máy hoạt động').startsWith('1')&&tileVal('Máy tạm dừng').startsWith('1')&&tileVal('Máy dừng / sự cố').startsWith('1')&&tileVal('Máy bảo trì').startsWith('1'), [tileVal('Máy hoạt động'),tileVal('Máy tạm dừng'),tileVal('Máy dừng / sự cố'),tileVal('Máy bảo trì')].join('|'));
  const outToday=store('productionEntries').filter(e=>!e.voided&&String(e.enteredAt).slice(0,10)===today||!e.voided).reduce((s,e)=>s+Number(e.qty),0);
  ok('P4. "Sản lượng trong ngày" = tổng lượt ghi thật (500 kg), "SL thực tế" = cộng dồn lệnh', /500 kg/.test(tileVal('Sản lượng trong ngày'))&&/500 kg/.test(tileVal('SL thực tế')), tileVal('Sản lượng trong ngày')+' | '+tileVal('SL thực tế')+' | tổng entries '+outToday);
  ok('P5. SL kế hoạch = tổng kế hoạch các lệnh mở (1000+500+200+100)', /1\.?800 kg|1,800 kg/.test(tileVal('SL kế hoạch').replace(/\s/g,' '))||/1800/.test(tileVal('SL kế hoạch').replace(/[.,\s]/g,'')), tileVal('SL kế hoạch'));
  ok('P6. Đơn quá hạn = 1 (OP-3), có đơn đang sản xuất', tileVal('Đơn quá hạn').startsWith('1')&&parseInt(tileVal('Đơn đang sản xuất'))>=4, tileVal('Đơn quá hạn')+' | '+tileVal('Đơn đang sản xuất'));
  // thẻ máy
  const c1=card('KTI-01'); const t1=txt(c1);
  ok('M1. Thẻ máy KTI-01 hiện đơn, khách, quy cách, người vận hành, kế hoạch, thực tế, trạng thái', /Công ty Alpha/.test(t1)&&!/OP-1/.test(t1)&&/Công ty Alpha/.test(t1)&&/0\.254BC/.test(t1)&&/Nguyễn Văn A/.test(t1)&&/ĐANG CHẠY/.test(t1)&&/1\.?000/.test(t1)&&/400/.test(t1), t1.slice(0,260));
  const clk=()=>{ const e=card('KTI-01').querySelector('.amg-clock'); return e?txt(e):''; }; const k1=clk(); await sleep(2300); const k2=clk();
  ok('M2. Đồng hồ chạy thực tế trên thẻ máy chạy liên tục', /\d+:\d\d/.test(k1)&&k1!==k2, k1+' → '+k2);
  const wr0=w.__server.writes; await sleep(2200); ok('M3. Đồng hồ không ghi Firebase', w.__server.writes===wr0);
  ok('M4. Trạng thái theo từng máy: chạy / tạm dừng / hỏng / bảo trì / trống',
    card('KTI-01').getAttribute('data-state')==='running'&&card('KTI-02').getAttribute('data-state')==='paused'&&card('KTI-04').getAttribute('data-state')==='broken'&&card('KTI-05').getAttribute('data-state')==='maintenance'&&card('KTI-07').getAttribute('data-state')==='idle'&&/TẠM DỪNG/.test(txt(card('KTI-02')))&&/HỎNG/.test(txt(card('KTI-04')))&&/BẢO TRÌ/.test(txt(card('KTI-05')))&&/MÁY TRỐNG/.test(txt(card('KTI-07'))));
  ok('M5. Mỗi máy một thẻ riêng (không trùng)', [...doc.querySelectorAll('[data-machine]')].length===new Set([...doc.querySelectorAll('[data-machine]')].map(e=>e.getAttribute('data-machine'))).size);
  // bảng đơn + cảnh báo
  const rows=[...doc.querySelectorAll('tr[data-order]')].map(r=>r.getAttribute('data-order'));
  ok('T1. Bảng đơn đang sản xuất có OP-1..OP-4, KHÔNG có OP-5 (chưa sản xuất)', ['OP-1','OP-2','OP-3','OP-4'].every(x=>rows.includes(x))&&!rows.includes('OP-5'), rows.join(','));
  const al=txt(doc.body);
  ok('A1. Cảnh báo: máy dừng/sự cố KTI-04', !!doc.querySelector('[data-alert="machine_down"]')&&/Máy KTI-04 dừng/.test(al));
  ok('A2. Cảnh báo: đơn quá hạn (Công ty Gamma), không hiện mã đơn', /Đơn Công ty Gamma · 0\.5 quá hạn giao/.test(al)&&!/OP-3/.test(al));
  // thời gian thực từ thiết bị khác
  const E2=boot({server:w.__server}); await E2.sleep(700); E2.w.__AMG_USER={username:'admin',role:'admin',fullName:'Thiết bị 2'};
  await E2.A(`await amgFlowRecordOutput({clientKey:"o1b",runId:"R1",orderId:"OP-1",machineId:"KTI-01",stageKey:"keo_tinh",qty:100})`);
  let seen=false; for(let i=0;i<60&&!seen;i++){ await sleep(50); seen=/600 kg/.test(tileVal('Sản lượng trong ngày')||'')&&/500/.test(txt(card('KTI-01'))); }
  ok('R1. Thiết bị khác ghi thêm 100 kg → KPI + thẻ máy tự cập nhật (không F5)', seen, tileVal('Sản lượng trong ngày'));
  // thao tác nhanh
  const row1=doc.querySelector('tr[data-order="OP-1"]');
  ok('Q0. Quản trị thấy nút thao tác nhanh: Phân máy / Chi tiết (OP-1), Ghi sản lượng / Lịch sử máy (thẻ KTI-01)', !!findBtn(/^Phân máy$/,row1)&&!!findBtn(/^Chi tiết$/,row1)&&!!findBtn(/^Ghi sản lượng$/,card('KTI-01'))&&!!findBtn(/^Lịch sử máy$/,card('KTI-01')));
  await click(findBtn(/^Phân máy$/,row1)); await sleep(700);
  ok('Q1. "Phân máy" mở ĐÚNG phân hệ Kế hoạch và tự chọn đơn Công ty Alpha (không bắt tìm lại)', /Kế hoạch sản xuất/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&!!doc.querySelector('.mes-modal-card')&&/Công ty Alpha/.test(txt(doc.querySelector('.mes-modal-card'))), txt(doc.querySelector('.mes-modal-card')||doc.body).slice(0,200));
  const prow=[...doc.querySelectorAll('.amg-row')].find(r=>r.getAttribute('data-order')==='OP-1'); const pt=prow?txt(prow):'';
  ok('K1. Danh sách Kế hoạch hiện đủ: máy được phân công, người vận hành, ca, SL đặt, đã hoàn thành/còn lại, ngày giao, ưu tiên, trạng thái', /KTI-01/.test(pt)&&/Nguyễn Văn A/.test(pt)&&/Ca Ngày/.test(pt)&&/Xong 500/.test(pt)&&/Còn 500/.test(pt)&&/\d\d\/\d\d\/2026/.test(pt), pt.slice(0,300));
  await click(doc.querySelector('.mes-mobile-modal-backdrop')); await sleep(200);
  await clickText(/^Điều hành sản xuất/); await sleep(600);
  await click(findBtn(/^Ghi sản lượng$/,card('KTI-01'))); await sleep(700);
  ok('Q2. "Ghi sản lượng" mở đúng lệnh R1 của máy KTI-01', !!doc.querySelector('.mes-modal-card')&&/KTI-01|R1|OP-1/.test(txt(doc.querySelector('.mes-modal-card'))), txt(doc.querySelector('.mes-modal-card')||doc.body).slice(0,160));
  await click(doc.querySelector('.mes-mobile-modal-backdrop')); await sleep(200); await clickText(/^Điều hành sản xuất/); await sleep(600);
  await click(findBtn(/^Chi tiết$/,doc.querySelector('tr[data-order="OP-2"]'))); await sleep(600);
  ok('Q3. "Chi tiết" mở đúng chi tiết đơn OP-2 ở tab Đơn hàng', /Đơn hàng & BOM/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&/OP-2|Công ty Beta/.test(txt(doc.querySelector('.mes-modal-card')||doc.body)));
  await click(doc.querySelector('.mes-mobile-modal-backdrop')); await sleep(200); await clickText(/^Điều hành sản xuất/); await sleep(600);
  // hoàn thành đơn một bước tại Điều hành
  const r4=doc.querySelector('tr[data-order="OP-4"]'); ok('C1. Đơn OP-4 đủ công đoạn có nút HOÀN THÀNH ĐƠN; đơn chưa xong (OP-1) thì KHÔNG có', !!findBtn(/^HOÀN THÀNH ĐƠN$/,r4)&&!findBtn(/^HOÀN THÀNH ĐƠN$/,doc.querySelector('tr[data-order="OP-1"]')));
  await click(findBtn(/^HOÀN THÀNH ĐƠN$/,r4)); await sleep(1200);
  ok('C2. MỘT lần bấm: OP-4 completed ngay (người + giờ hoàn thành), không hộp xác nhận lần hai', ordr('OP-4').status==='completed'&&!!ordr('OP-4').completedAt&&ordr('OP-4').completedBy==='Quản trị'&&ordr('OP-4').completionSource==='dieuhanh'&&!doc.querySelector('.mes-modal-card'), ordr('OP-4').status);
  ok('C3. OP-4 biến mất khỏi bảng đơn đang sản xuất; lệnh/sản lượng vẫn còn', !doc.querySelector('tr[data-order="OP-4"]')&&store('productionRuns').some(r=>r.id==='R4')&&store('productionEntries').some(e=>e.orderId==='OP-4'));
  await click(findBtn(/Mở chi tiết đơn đã hoàn thành/)); await sleep(700);
  ok('C4. Nút "Mở chi tiết đơn đã hoàn thành" mở tab Đơn hàng hoàn thành với đúng đơn Công ty Delta', /Đơn hàng hoàn thành/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&/Công ty Delta/.test(txt(doc.querySelector('.mes-modal-card')||doc.body)));
  await click(doc.querySelector('.mes-mobile-modal-backdrop')||findBtn(/^Đóng$/)); await sleep(200); await clickText(/^Điều hành sản xuất/); await sleep(600);
  // chế độ TV
  await click(findBtn(/^Chế độ TV$/)); await sleep(500);
  ok('V1. Chế độ TV: không có nút thao tác, không hiện máy trống, có máy đang chạy', !findBtn(/^Phân máy$/)&&!findBtn(/^HOÀN THÀNH ĐƠN$/)&&!card('KTI-07')&&!!card('KTI-01')&&!!findBtn(/^Thoát chế độ TV/));
  doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'})); await sleep(300);
  ok('V2. Esc thoát chế độ TV', !!findBtn(/^Chế độ TV$/));
  const real=errs.filter(e=>!/Warning: .*(act|unmounted)/i.test(e)); ok('Z. Không có lỗi console/React', real.length===0, real.slice(0,3).join(' || '));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
