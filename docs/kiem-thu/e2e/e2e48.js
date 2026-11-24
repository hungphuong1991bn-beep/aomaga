/* v48 — E2E giao diện toàn luồng (đơn → routing → phân lệnh → chạy → ghi SL → tạm dừng → kết thúc → hoàn thành công đoạn → hoàn thành đơn → lưu trữ → thiết bị khác → mở lại).
   Công đoạn dùng đúng 6 công đoạn hiện có. DP001: Kéo trung→Kéo tinh→Kéo siêu tinh→Ủ nhiệt | DP002: Kéo tinh→Kéo siêu tinh | DP003: Kéo trung→Kéo tinh */
const {boot}=require('./e2e_lib');
const E=boot(); const {w,doc,errs,sleep,A,db,sha,nativeSet,txt,findBtn,click,clickText,modal}=E;
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const rows=()=>[...doc.querySelectorAll('.amg-row')]; const rowOf=id=>rows().find(r=>txt(r).includes('KH-'+id));
const cardOf=id=>[...doc.querySelectorAll('.amg-mcard')].find(c=>new RegExp('^'+id).test(txt(c)));
const store=n=>Object.values(db.__store[n]||{}); const ordr=id=>(db.__store.orders||{})[id];
const go=async re=>{await clickText(re);await sleep(500);};
const stageMachine=async st=>JSON.parse(await A(`return JSON.stringify(amgMachinesForStage(${JSON.stringify(store('machines'))},"${st}").map(m=>m.id))`));
const enabledOpts=sel=>[...sel.options].filter(o=>o.value&&!o.disabled).map(o=>o.value);
async function wizardOpen(stageLabel){ await go(/Kế hoạch & phân công|Kế hoạch sản xuất/); await clickText(/Phân lệnh \(Công đoạn/); await sleep(300); await clickText(new RegExp('^'+stageLabel+'$'),modal()); await sleep(200); }
async function wizardRun(stageLabel,machine,orderId,op,qty){
  await wizardOpen(stageLabel); await clickText(new RegExp('^'+machine+'$'),modal()); await sleep(200);
  const sel=modal().querySelector('select.mes-input'); nativeSet(sel,orderId); await sleep(200);
  const ins=[...modal().querySelectorAll('input.mes-input')];
  if(qty!==undefined){ const pq=ins.find(i=>i.inputMode==='decimal'); nativeSet(pq,String(qty)); }
  nativeSet(ins.find(i=>/Chọn hoặc nhập/.test(i.placeholder)),op); await sleep(150);
  const b=findBtn(/^Xác nhận phân lệnh$/,modal()); if(!b||b.disabled) throw new Error('confirm disabled: '+txt(modal()).slice(-220)); await click(b); await sleep(700);
}
async function output(machine,q){ await clickText(/^Ghi sản lượng$/,cardOf(machine)); await sleep(300); const m=modal(); const inp=[...m.querySelectorAll('input.mes-input')].find(i=>i.inputMode==='decimal'||i.type==='number'); nativeSet(inp,String(q)); await sleep(150); await click(findBtn(/^(Ghi|Lưu|Xác nhận)/,m)); await sleep(700); }
(async()=>{
  await sleep(300);
  JSON.parse(await A('return JSON.stringify(genMachineSeed())')).forEach(m=>db.__seed('machines',m.id,m));
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  const mk=async(id,route,q,bom)=>{const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});const o=normalizeOrderStages({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:${q},orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:${JSON.stringify(route)},routingConfirmed:true${bom?',bom:[{id:"B1",material:"Đồng cathode",norm:1.02,unit:"kg",note:"hao hụt 2%"}]':''}});return JSON.stringify(o);`);db.__seed('orders',id,JSON.parse(j));};
  await mk('DP001',['keo_trung','keo_tinh','keo_sieu_tinh','u_nhiet'],1000,true); await mk('DP002',['keo_tinh','keo_sieu_tinh'],500); await mk('DP003',['keo_trung','keo_tinh'],300);
  db.__seed('orders','DP-OLD',{id:'DP-OLD',customer:'KH-DPOLD',spec:'0.2',quantity:100,stages:{},orderDate:'2026-10-01'});
  await sleep(200);
  const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],'admin'); nativeSet(inputs[1],'test'); await sleep(50);
  await clickText(/^Đăng nhập/); await sleep(800);

  // 1-2. Mỗi công đoạn chỉ hiện đúng đơn có trong routing đã xác nhận
  const KT=(await stageMachine('keo_trung'))[0], KTI=(await stageMachine('keo_tinh'))[0], KST=(await stageMachine('keo_sieu_tinh'))[0], UN=(await stageMachine('u_nhiet'))[0];
  await wizardOpen('Kéo trung'); await clickText(new RegExp('^'+KT+'$'),modal()); await sleep(200);
  let sel=modal().querySelector('select.mes-input'); let eo=enabledOpts(sel).sort();
  ok('1. Kéo trung chỉ hiện DP001, DP003', JSON.stringify(eo)==='["DP001","DP003"]', JSON.stringify(eo));
  ok('1b. DP-OLD (chưa xác nhận quy trình) không xuất hiện ở bất kỳ danh sách phân lệnh', !/DP-OLD/.test(txt(modal())));
  await clickText(/^Hủy$/,modal()); await sleep(200);
  await wizardOpen('Kéo tinh'); await clickText(new RegExp('^'+KTI+'$'),modal()); await sleep(200); sel=modal().querySelector('select.mes-input'); eo=enabledOpts(sel).sort();
  ok('1c. Kéo tinh đủ điều kiện: chỉ DP002; DP001/DP003 hiện mờ "chờ công đoạn trước"', JSON.stringify(eo)==='["DP002"]'&&/DP001[^|]*chờ/.test(txt(modal()))&&/DP003[^|]*chờ/.test(txt(modal())), JSON.stringify(eo));
  await clickText(/^Hủy$/,modal()); await sleep(200);
  await wizardOpen('Kéo siêu tinh'); await clickText(new RegExp('^'+KST+'$'),modal()); await sleep(200); sel=modal().querySelector('select.mes-input');
  ok('1d. Kéo siêu tinh không có đơn đủ điều kiện (DP001/DP002 chưa có SL công đoạn trước)', enabledOpts(sel).length===0, JSON.stringify(enabledOpts(sel)));
  await clickText(/^Hủy$/,modal()); await sleep(200);
  const MT=(await stageMachine('ma_thiec'))[0]; await wizardOpen('Mạ thiếc'); await clickText(new RegExp('^'+MT+'$'),modal()); await sleep(200); ok('1e. Mạ thiếc: không đơn nào có công đoạn này trong routing → danh sách trống', enabledOpts(modal().querySelector('select.mes-input')).length===0 && !/DP00[123]/.test([...modal().querySelector('select.mes-input').options].map(o=>o.text).join('|'))); await clickText(/^Hủy$/,modal()); await sleep(200);
  ok('1f. Đơn chưa xác nhận quy trình nằm khung riêng ở Kế hoạch', /1 đơn chưa xác nhận quy trình/.test(txt(doc.body)));

  // 3-8. Phân DP001 vào máy kéo trung, xác nhận chạy, ghi 100 kg, tạm dừng/tiếp tục, kết thúc
  await wizardRun('Kéo trung',KT,'DP001','Nguyễn A',600);
  ok('2. Hộp xác nhận bắt đầu chạy máy hiện ra', !!findBtn(/Xác nhận bắt đầu chạy máy/,modal()));
  await click(findBtn(/Xác nhận bắt đầu chạy máy/,modal())); await sleep(700);
  await go(/Giám sát máy móc/);
  ok('3. Máy hiển thị đúng DP001 + ĐANG CHẠY', cardOf(KT)&&/DP001/.test(txt(cardOf(KT)))&&/ĐANG CHẠY/.test(txt(cardOf(KT))), cardOf(KT)&&txt(cardOf(KT)).slice(0,200));
  ok('3b. Thẻ máy có đồng hồ + đơn vị kg + năng suất', /\d:\d\d:\d\d/.test(txt(cardOf(KT)))&&/kg/.test(txt(cardOf(KT)))&&/Năng suất/.test(txt(cardOf(KT))), txt(cardOf(KT)).slice(0,300));
  await output(KT,100);
  const r1=store('productionRuns')[0]; ok('4. Ghi 100 kg → lệnh & đơn cập nhật', r1.producedQuantity===100&&ordr('DP001').stages.keo_trung.done===100, r1.producedQuantity);
  const en=store('productionEntries')[0]; ok('4b. Lượt ghi lưu người, máy, công đoạn, SL, đơn vị, thời gian', en&&en.enteredBy==='Quản trị'&&en.machineId===KT&&en.stageKey==='keo_trung'&&en.qty===100&&en.unit==='kg'&&!!en.enteredAt, JSON.stringify(en));
  await clickText(/^Tạm dừng$/,cardOf(KT)); await sleep(300); let m=modal(); const reason=[...m.querySelectorAll('input.mes-input,select')][0]; nativeSet(reason,reason.tagName==='SELECT'?reason.options[1].value:'Chờ vật tư'); await sleep(100);
  await click([...m.querySelectorAll('button')].find(x=>/Tạm dừng|Xác nhận/.test(txt(x))&&!/Hủy/.test(txt(x)))); await sleep(700);
  ok('5. Tạm dừng ghi mốc thời gian', /TẠM DỪNG/.test(txt(cardOf(KT)))&&store('productionRuns')[0].pauses.length===1);
  await clickText(/^Tiếp tục$/,cardOf(KT)); await sleep(600);
  ok('5b. Tiếp tục: lần tạm dừng được đóng', /ĐANG CHẠY/.test(txt(cardOf(KT)))&&!!store('productionRuns')[0].pauses[0].resumedAt);
  await clickText(/^Chi tiết lệnh$/,cardOf(KT)); await sleep(300);
  ok('5c. Chi tiết lệnh: đủ bắt đầu/tổng chạy/tạm dừng/thực tế/kết thúc/SL/còn lại/năng suất + lịch sử ghi', ['Bắt đầu','Tổng thời gian chạy','Tạm dừng','Sản xuất thực tế','Kết thúc','Kế hoạch','Đã chạy','Còn lại','Năng suất TB','LỊCH SỬ GHI SẢN LƯỢNG'].every(k=>txt(modal()).includes(k)), txt(modal()).slice(0,260));
  await click(findBtn(/^Đóng$/,modal())); await sleep(200);
  await output(KT,500); // đủ 600
  await clickText(/^Kết thúc lệnh$/,cardOf(KT)); await sleep(300); m=modal();
  ok('6. Hộp kết thúc lệnh giải thích khác biệt (A/B)', /Hoàn thành công đoạn/.test(txt(m)));
  await click(findBtn(/^Xác nhận|^Kết thúc/,m)); await sleep(800);
  ok('7. Kết thúc lệnh: máy trống, đơn CHƯA hoàn thành, công đoạn CHƯA hoàn thành', (db.__store.machines[KT].activeRunId||null)===null&&ordr('DP001').status!=='completed'&&!(ordr('DP001').stageComplete||{}).keo_trung);
  await go(/Kế hoạch & phân công|Kế hoạch sản xuất/);

  // 9-10. Nốt Kéo trung rồi hoàn thành công đoạn → sang Kéo tinh
  await wizardRun('Kéo trung',KT,'DP001','Nguyễn A'); await click(findBtn(/Xác nhận bắt đầu chạy máy/,modal())); await sleep(600);
  await go(/Giám sát máy móc/); await output(KT,400);
  await clickText(/^Kết thúc lệnh$/,cardOf(KT)); await sleep(300); m=modal();
  const cb=[...m.querySelectorAll('input[type=checkbox]')][0]; if(cb&&!cb.checked) await click(cb); await sleep(100);
  await click(findBtn(/^Xác nhận|^Kết thúc/,m)); await sleep(900);
  ok('8. Hoàn thành công đoạn Kéo trung → stageComplete', !!(ordr('DP001').stageComplete||{}).keo_trung);
  await go(/Kế hoạch & phân công|Kế hoạch sản xuất/); await clickText(/Phân lệnh \(Công đoạn/); await sleep(300); await clickText(/^Kéo tinh$/,modal()); await clickText(new RegExp('^'+KTI+'$'),modal()); await sleep(200);
  eo=enabledOpts(modal().querySelector('select.mes-input')).sort(); ok('9. DP001 chuyển sang công đoạn kế (Kéo tinh), cùng DP002', eo.includes('DP001')&&eo.includes('DP002'), JSON.stringify(eo));
  await clickText(/^Hủy$/,modal()); await sleep(200);
  const k=await A(`await amgFlowAssign({runId:"x1",orderId:"DP001",machineId:"${KTI}",stageKey:"keo_tinh",plannedQuantity:1000,operator:"B",shift:"Ca Ngày",startNow:true});await amgFlowRecordOutput({clientKey:"c1",runId:"x1",orderId:"DP001",machineId:"${KTI}",stageKey:"keo_tinh",qty:1000});await amgFlowFinishRun({runId:"x1",completeStage:true});
    await amgFlowAssign({runId:"x2",orderId:"DP001",machineId:"${KST}",stageKey:"keo_sieu_tinh",plannedQuantity:1000,operator:"B",shift:"Ca Ngày",startNow:true});await amgFlowRecordOutput({clientKey:"c2",runId:"x2",orderId:"DP001",machineId:"${KST}",stageKey:"keo_sieu_tinh",qty:1000});await amgFlowFinishRun({runId:"x2",completeStage:true});return 1`); await sleep(500);

  // 11-12. Công đoạn cuối (Ủ nhiệt) qua giao diện → hộp HOÀN THÀNH ĐƠN
  await wizardRun('Ủ nhiệt',UN,'DP001','Lê C',1000); await click(findBtn(/Xác nhận bắt đầu chạy máy/,modal())); await sleep(600);
  await go(/Giám sát máy móc/); await output(UN,1000);
  await clickText(/^Kết thúc lệnh$/,cardOf(UN)); await sleep(300); m=modal(); const cb2=[...m.querySelectorAll('input[type=checkbox]')][0]; if(cb2&&!cb2.checked) await click(cb2); await sleep(100);
  await click(findBtn(/^Xác nhận|^Kết thúc/,m)); await sleep(1200);
  ok('10. Xong công đoạn cuối: hiện hộp HOÀN THÀNH ĐƠN, đơn CHƯA completed', !!modal()&&/HOÀN THÀNH ĐƠN DP001/.test(txt(modal()))&&ordr('DP001').status!=='completed', modal()&&txt(modal()).slice(0,150));
  await click(findBtn(/^HOÀN THÀNH ĐƠN$/,modal())); await sleep(900);
  const d=ordr('DP001'); ok('11. order.status=completed + completedAt/By/Mode + lịch sử', d.status==='completed'&&!!d.completedAt&&d.completedBy==='Quản trị'&&d.completionMode==='manual'&&d.statusHistory.slice(-1)[0].action==='complete', JSON.stringify([d.status,d.completedBy,d.completionMode]));
  ok('11b. Không xóa gì: 5 lệnh, BOM còn', store('productionRuns').filter(r=>r.orderId==='DP001').length===5&&d.bom.length===1, store('productionRuns').length);

  // 13-15. Biến khỏi Đơn hàng/BOM/Kế hoạch/Máy; xuất hiện ở Hoàn thành
  await go(/Đơn hàng & BOM/); ok('12. DP001 biến khỏi tab Đơn hàng & BOM', !rowOf('DP001')&&!!rowOf('DP002'), rows().map(r=>txt(r).slice(0,20)).join('|'));
  await go(/Kế hoạch & phân công|Kế hoạch sản xuất/); ok('13. DP001 không còn ở Kế hoạch/danh sách chờ', !rowOf('DP001'));
  await clickText(/Phân lệnh \(Công đoạn/); await sleep(300); await clickText(/^Ủ nhiệt$/,modal()); await clickText(new RegExp('^'+UN+'$'),modal()); await sleep(150);
  ok('13b. DP001 không còn trong danh sách phân lệnh Ủ nhiệt', !enabledOpts(modal().querySelector('select.mes-input')).includes('DP001')); await clickText(/^Hủy$/,modal()); await sleep(200);
  await go(/Giám sát máy móc/); ok('13c. Không máy nào còn hiển thị DP001', ![...doc.querySelectorAll('.amg-mcard')].some(c=>/DP001/.test(txt(c))));
  await go(/Đơn hàng hoàn thành/); ok('14. DP001 xuất hiện ở tab Đơn hàng hoàn thành đủ thông tin', rows().length===0&&/DP001/.test(txt(doc.body))&&/Hoàn thành đủ SL/.test(txt(doc.body))&&/Quản trị/.test(txt(doc.body))&&/Kéo trung → Kéo tinh → Kéo siêu tinh → Ủ nhiệt/.test(txt(doc.body)));
  const tr=[...doc.querySelectorAll('tbody tr')].find(r=>/DP001/.test(txt(r))); await click(tr); await sleep(400); m=modal();
  ok('15. Chi tiết: công đoạn + máy', /Kéo trung/.test(txt(m))&&/Ủ nhiệt/.test(txt(m)));
  await clickText(/^Lịch sử máy$/,m); await sleep(150); ok('15b. Lịch sử máy có đủ lệnh', store('productionRuns').filter(r=>r.orderId==='DP001').every(r=>txt(modal()).includes(r.machineId)));
  await clickText(/^Lịch sử sản lượng$/,modal()); await sleep(150); ok('15c. Lịch sử sản lượng có lượt 100 kg', /100 kg/.test(txt(modal())), txt(modal()).slice(-300));
  await clickText(/^BOM & định mức$/,modal()); await sleep(150); ok('15d. BOM chỉ đọc: Đồng cathode 1,02 kg, không nút sửa/xóa', /Đồng cathode/.test(txt(modal()))&&/Chỉ đọc/.test(txt(modal()))&&!findBtn(/^(Sửa|Xóa|Thêm)/,modal()));
  ok('15e. Có nút Xuất Excel và In báo cáo', !!findBtn(/Xuất Excel đơn/,modal())&&!!findBtn(/In báo cáo/,modal()));
  await click(findBtn(/^Đóng$/,modal())); await sleep(200);
  // bộ lọc công đoạn
  const stSel=[...doc.querySelectorAll('select.mes-input')].find(s=>[...s.options].some(o=>/Mọi công đoạn/.test(o.text)));
  nativeSet(stSel,'ma_thiec'); await sleep(200); ok('16. Lọc công đoạn Mạ thiếc → không có đơn', !/DP001/.test(txt(doc.querySelector('table')||doc.body))||/Không có đơn/.test(txt(doc.body))); nativeSet(stSel,'u_nhiet'); await sleep(200); ok('16b. Lọc Ủ nhiệt → thấy DP001', /DP001/.test(txt(doc.body)));

  // 17. Thiết bị khác (cửa sổ thứ hai dùng chung CSDL) + tải lại
  const E2=require('./e2e_lib').boot({sharedDb:db}); await E2.sleep(500);
  ok('17. Thiết bị khác đọc cùng dữ liệu: DP001 completed', JSON.parse(await E2.A('const s=await db.collection("orders").doc("DP001").get();return JSON.stringify(s.data())')).status==='completed');
  ok('17b. Dữ liệu 5 lệnh + lượt ghi còn nguyên', store('productionEntries').length>=5);

  // 18. Mở lại đơn
  await go(/Đơn hàng hoàn thành/);
  await clickText(/^Mở lại$/,[...doc.querySelectorAll('tbody tr')].find(r=>/DP001/.test(txt(r)))); await sleep(300); m=modal();
  ok('18. Mở lại bắt buộc lý do (nút khóa khi chưa nhập)', findBtn(/^Mở lại đơn$/,m).disabled);
  nativeSet(m.querySelector('input.mes-input'),'Khách đặt thêm 100kg'); await sleep(150); await click(findBtn(/^Mở lại đơn$/,m)); await sleep(900);
  const d2=ordr('DP001'); ok('18b. Đơn quay lại hoạt động (reopened), dữ liệu + BOM còn', d2.status==='reopened'&&d2.bom.length===1&&d2.stages.keo_trung.done===1000&&d2.statusHistory.map(h=>h.action).join()==='complete,reopen', JSON.stringify([d2.status,d2.statusHistory.map(h=>h.action)]));
  await go(/Đơn hàng & BOM/); ok('18c. DP001 (cùng BOM) quay lại tab Đơn hàng & BOM', !!rowOf('DP001'));
  await go(/Đơn hàng hoàn thành/); ok('18d. DP001 rời tab hoàn thành sau khi mở lại', ![...doc.querySelectorAll('tbody tr')].some(r=>/DP001/.test(txt(r))&&/Hoàn thành/.test(txt(r))));

  const real=errs.filter(e=>!/Warning: .*(act|unmounted)/i.test(e));
  ok('19. Không có lỗi console/React', real.length===0, real.slice(0,3).join(' || '));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
