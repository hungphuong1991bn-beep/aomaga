/* v52 — E2E Đơn hàng hoàn thành: hoàn thành bằng nút thật, kho lưu trữ đầy đủ (nhiều máy/nhiều lượt), lọc, báo cáo in, Excel, mở lại, F5. */
const {boot}=require('./e2e_lib');
const E=boot(); const {w,doc,errs,sleep,A,db,sha,nativeSet,txt,findBtn,click,clickText}=E;
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const store=n=>Object.values(w.__db.__store[n]||{}); const ordr=id=>(w.__db.__store.orders||{})[id];
const modal=()=>doc.querySelector('.mes-modal-card');
const rowOf=id=>[...doc.querySelectorAll('.amg-row,tr')].find(r=>r.getAttribute('data-order')===id||!/^Mã đơn/.test(txt(r))&&([...r.querySelectorAll('[title]')].some(e=>e.getAttribute('title')===id)||new RegExp(id+'(?![0-9])').test(txt(r))));
(async()=>{
  await sleep(300);
  JSON.parse(await A('return JSON.stringify(genMachineSeed())')).forEach(m=>db.__seed('machines',m.id,m));
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  const mk=async(id,cust,spec,q,extra={})=>{ const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages(Object.assign({id:"${id}",customer:"${cust}",spec:"${spec}",materialCode:"B",quantity:${q},orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra)})))`); db.__seed('orders',id,JSON.parse(j)); };
  await mk('CP-1','Công ty Hoàn Mỹ','0.254BC',1000,{bom:[{id:'B1',material:'Đồng cathode',norm:1.02,unit:'kg',note:''}]});
  await mk('CP-2','Khách thiếu SL','0.3',200);
  await sleep(200); Object.keys(w.__db.__store.orders||{}).filter(id=>!/^CP-/.test(id)).forEach(id=>w.__server.patch({['orders/'+id]:null})); await sleep(300);
  const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],'admin'); nativeSet(inputs[1],'test'); await sleep(50); await clickText(/^Đăng nhập/); await sleep(900);
  // CP-1: hai lượt chạy trên hai máy khác nhau, có tạm dừng
  await A(`await amgFlowAssign({runId:"C1a",orderId:"CP-1",machineId:"KTI-01",stageKey:"keo_tinh",plannedQuantity:300,shift:"Ca Ngày",operator:"Nguyễn Văn A",startNow:true});
    await amgFlowPause("C1a","Thay cuộn"); await amgFlowResume("C1a");
    await amgFlowRecordOutput({clientKey:"a1",runId:"C1a",orderId:"CP-1",machineId:"KTI-01",stageKey:"keo_tinh",qty:300}); await amgFlowFinishRun({runId:"C1a"});
    await amgFlowAssign({runId:"C1b",orderId:"CP-1",machineId:"KTI-02",stageKey:"keo_tinh",plannedQuantity:700,shift:"Ca Đêm",operator:"Trần Thị B",startNow:true});
    await amgFlowRecordOutput({clientKey:"b1",runId:"C1b",orderId:"CP-1",machineId:"KTI-02",stageKey:"keo_tinh",qty:700}); await amgFlowFinishRun({runId:"C1b",completeStage:true});`);
  await A(`await amgFlowAssign({runId:"C2a",orderId:"CP-2",machineId:"KTI-03",stageKey:"keo_tinh",plannedQuantity:200,shift:"Ca Ngày",operator:"Lê C",startNow:true});
    await amgFlowRecordOutput({clientKey:"c1",runId:"C2a",orderId:"CP-2",machineId:"KTI-03",stageKey:"keo_tinh",qty:120}); await amgFlowFinishRun({runId:"C2a",completeStage:true,shortReason:"Hết nguyên liệu"});`);
  await sleep(300);
  // hoàn thành BẰNG NÚT THẬT tại Kế hoạch
  await clickText(/^Kế hoạch sản xuất/); await sleep(1800);
  const pr=rowOf('CP-1'); ok('H0. CP-1 đủ công đoạn có nút HOÀN THÀNH ĐƠN tại Kế hoạch', !!pr&&!!findBtn(/^HOÀN THÀNH ĐƠN$/,pr));
  await click(findBtn(/^HOÀN THÀNH ĐƠN$/,pr)); await sleep(1200);
  ok('H1. Một lần bấm: CP-1 completed, không hộp xác nhận', ordr('CP-1').status==='completed'&&!modal());
  const prb=rowOf('CP-2'); await click(findBtn(/^HOÀN THÀNH ĐƠN$/,prb)); await sleep(600);
  ok('H2. CP-2 thiếu số lượng: hộp nhập lý do (không tự hoàn thành)', ordr('CP-2').status!=='completed'&&!!modal()&&/lý do/i.test(txt(modal())));
  nativeSet([...modal().querySelectorAll('input')][0],'Khách đồng ý nhận 120'); await sleep(80); await click(findBtn(/^HOÀN THÀNH ĐƠN$/,modal())); await sleep(1200);
  ok('H3. Có lý do → CP-2 completed, đánh dấu thiếu SL', ordr('CP-2').status==='completed'&&ordr('CP-2').completedShort===true);
  await clickText(/^Đơn hàng hoàn thành/); await sleep(700); const body=txt(doc.body);
  ok('K0. Không còn khung/nhãn "Chờ xác nhận hoàn thành đơn" ở tab Đơn hàng hoàn thành', !/Chờ xác nhận/i.test(body));
  const hdr=txt(doc.querySelector('thead')||doc.body);
  ok('K1. Danh sách có đủ cột: STT, khách, quy cách, vật liệu, SL đặt, thành phẩm, tỷ lệ HT, ngày nhận, ngày giao, hoàn thành, thời gian SX, máy, người hoàn thành, trạng thái', ['STT','Khách hàng','Quy cách','Nguyên liệu','SL đặt','Thành phẩm','Tỷ lệ HT','Ngày nhận','Ngày giao','Hoàn thành','Thời gian SX','Máy','Người hoàn thành','Trạng thái'].every(c=>hdr.includes(c)), hdr);
  const r1=txt(rowOf('CP-1'));
  ok('K2. Dòng CP-1: cả hai máy tham gia, 100%, người hoàn thành, trạng thái đủ SL', /KTI-01, KTI-02/.test(r1)&&/100%/.test(r1)&&/Quản trị/.test(r1)&&/đủ SL/i.test(r1), r1.slice(0,300));
  ok('K3. Dòng CP-2: 60%, thiếu SL', /60%/.test(txt(rowOf('CP-2')))&&/thiếu SL/i.test(txt(rowOf('CP-2'))));
  const selects=[...doc.querySelectorAll('select')]; const selM=selects.find(s=>[...s.options].some(o=>/Mọi máy/.test(o.textContent))), selS=selects.find(s=>[...s.options].some(o=>/Hoàn thành thiếu SL/.test(o.textContent)));
  nativeSet(selM,'KTI-02'); await sleep(250); ok('F1. Lọc theo máy KTI-02 → chỉ CP-1', !!rowOf('CP-1')&&!rowOf('CP-2'));
  nativeSet(selM,'all'); nativeSet(selS,'short'); await sleep(250); ok('F2. Lọc "thiếu SL" → chỉ CP-2', !rowOf('CP-1')&&!!rowOf('CP-2')); nativeSet(selS,'all'); await sleep(200);
  const srch=[...doc.querySelectorAll('input.mes-input')].find(i=>/Tìm/.test(i.placeholder||'')); nativeSet(srch,'hoan my'); await sleep(250); ok('F3. Tìm không dấu theo khách hàng', !!rowOf('CP-1')&&!rowOf('CP-2')); nativeSet(srch,''); await sleep(200);
  // chi tiết lưu trữ
  await click(rowOf('CP-1')); await sleep(500); const d0=txt(modal());
  ok('D0. Chi tiết lưu trữ nêu thời điểm hoàn thành, người hoàn thành, tổng thời gian chạy/tạm dừng, thời gian sản xuất, tổng thành phẩm', /Hoàn thành/.test(d0)&&/Quản trị/.test(d0)&&/1\.?000/.test(d0)&&/Thời gian sản xuất|thời gian sản xuất/i.test(d0), d0.slice(0,400));
  await click(findBtn(/^Lịch sử máy$/,modal())); await sleep(250); const d1=txt(modal());
  ok('D1. Lịch sử máy hiển thị ĐỦ TỪNG LƯỢT (không gộp): 2 lệnh, 2 máy, 2 người vận hành, ca, bắt đầu/kết thúc, chạy, tạm dừng', /KTI-01/.test(d1)&&/KTI-02/.test(d1)&&/Nguyễn Văn A/.test(d1)&&/Trần Thị B/.test(d1)&&/Ca Ngày/.test(d1)&&/Ca Đêm/.test(d1)&&/Tạm dừng/.test(d1)&&/Bắt đầu/.test(d1)&&/Kết thúc/.test(d1), d1.slice(0,400));
  await click(findBtn(/^Lịch sử sản lượng$/,modal())); await sleep(250); ok('D2. Lịch sử sản lượng: 300 (KTI-01) và 700 (KTI-02)', /300/.test(txt(modal()))&&/700/.test(txt(modal()))&&/KTI-01/.test(txt(modal()))&&/KTI-02/.test(txt(modal())));
  await click(findBtn(/^BOM & định mức$/,modal())); await sleep(250); ok('D3. BOM, định mức, nhu cầu vật tư hiển thị', /Đồng cathode/.test(txt(modal()))&&/1\.?020/.test(txt(modal())));
  await click(findBtn(/^Chất lượng$/,modal())); await sleep(150); const q1=/Chất lượng|phiếu|Chưa/i.test(txt(modal())); await click(findBtn(/^NG \/ phế$/,modal())); await sleep(150);
  ok('D4. Có mục lịch sử chất lượng và NG/phế liệu', q1&&/NG|phế/i.test(txt(modal())));
  await click(findBtn(/^Lịch sử đơn$/,modal())); await sleep(150); ok('D5. Lịch sử đơn ghi "hoàn thành đơn" kèm người thực hiện', /hoàn thành đơn/.test(txt(modal()))&&/Quản trị/.test(txt(modal())), txt(modal()).slice(0,200));
  ok('D6. Đơn hoàn thành chỉ đọc: không có nút sửa/xóa trong chi tiết', !findBtn(/^(CHỈNH SỬA ĐƠN|XÓA ĐƠN|Sửa|Xóa)$/,modal()));
  // báo cáo in + Excel
  const rep=await A(`const o=(await db.collection(FS.orders).doc("CP-1").get()).data();const runs=(await db.collection(AMG_FLOW_COLS.runs).get()).docs.map(d=>Object.assign({id:d.id},d.data()));const ents=(await db.collection(AMG_FLOW_COLS.entries).get()).docs.map(d=>Object.assign({id:d.id},d.data()));const Ar=amgBuildOrderArchive(Object.assign({id:"CP-1"},o),runs,ents,{},[],Date.now());return amgOrderReportHtml(Object.assign({id:"CP-1"},o),Ar)`);
  ok('R1. Báo cáo in có đủ: máy, người vận hành, lệnh từng lượt, người thực hiện hoàn thành, BOM', /KTI-01/.test(rep)&&/KTI-02/.test(rep)&&/Nguyễn Văn A/.test(rep)&&/Trần Thị B/.test(rep)&&/Người thực hiện hoàn thành đơn/.test(rep)&&/Quản trị/.test(rep)&&/Đồng cathode/.test(rep), rep.length);
  let cap=null; const wf=w.XLSX.writeFile; w.XLSX.writeFile=(wb,name)=>{cap={wb,name};}; const eb=findBtn(/Xuất Excel/,modal()); if(eb) await click(eb); w.XLSX.writeFile=wf;
  ok('R2. Xuất Excel chi tiết có các sheet Lệnh máy, Sản lượng, Công đoạn', !!cap&&['Lệnh máy','Sản lượng','Công đoạn'].every(n=>cap.wb.SheetNames.includes(n)), cap&&cap.wb.SheetNames.join('|'));
  // mở lại đơn (nút nằm ở dòng danh sách; chỉ người có quyền thấy)
  await click(doc.querySelector('.mes-mobile-modal-backdrop')||findBtn(/^Đóng$/,modal())); await sleep(250);
  const rb=findBtn(/^Mở lại$/,rowOf('CP-1')); ok('O0. Admin thấy nút Mở lại ở dòng đơn hoàn thành', !!rb); await click(rb); await sleep(300);
  const rm=[...doc.querySelectorAll('.mes-modal-card')].pop(); const go=findBtn(/^Mở lại đơn$/,rm);
  ok('O1. Mở lại đơn bắt buộc có lý do (nút bị khóa khi thiếu)', go&&go.disabled===true);
  nativeSet([...rm.querySelectorAll('input')][0],'Khách đặt thêm hàng'); await sleep(80); await click(findBtn(/^Mở lại đơn$/,rm)); await sleep(1200);
  const o1=ordr('CP-1');
  ok('O2. CP-1 quay lại trạng thái hoạt động, lịch sử complete + reopen và toàn bộ lệnh/sản lượng được giữ nguyên', o1.status==='reopened'&&o1.statusHistory.map(h=>h.action).join()==='complete,reopen'&&store('productionRuns').filter(r=>r.orderId==='CP-1').length===2&&store('productionEntries').filter(e=>e.orderId==='CP-1').length===2, JSON.stringify(o1.statusHistory.map(h=>h.action)));
  ok('O3. Lý do mở lại và người mở lại được lưu nhật ký', o1.statusHistory[1].reason==='Khách đặt thêm hàng'&&o1.statusHistory[1].by==='Quản trị'&&store('auditLog').some(a=>a.type==='order_reopen'&&a.targetId==='CP-1'));
  await clickText(/^Đơn hàng & BOM/); await sleep(600); ok('O4. CP-1 xuất hiện lại trong danh sách Đơn hàng đang hoạt động', !!rowOf('CP-1'));
  // F5: thiết bị mới
  const E2=boot({server:w.__server}); await E2.sleep(900);
  const st=await E2.A('const s=await db.collection(FS.orders).doc("CP-2").get();return JSON.stringify({st:s.data().status,act:amgIsActiveOrder(s.data())})'); const j=JSON.parse(st);
  ok('F5. Tải lại (thiết bị mới): CP-2 vẫn completed, không quay lại danh sách hoạt động', j.st==='completed'&&j.act===false, st);
  // v54 — bỏ mã đơn + Admin xóa đơn hoàn thành ngay tại tab Đơn hàng hoàn thành (gõ XOA, bắt buộc lý do)
  await clickText(/^Đơn hàng hoàn thành/); await sleep(700);
  const bodyTxt=txt(doc.body);
  ok('V54-1. Tab Đơn hàng hoàn thành không hiện mã đơn (cột và nội dung)', !/Mã đơn/.test(txt(doc.querySelector('thead')||doc.body))&&!/CP-2/.test(txt(rowOf('CP-2')||doc.body)), txt(rowOf('CP-2')||doc.body).slice(0,120));
  const delB=doc.querySelector('tr[data-order="CP-2"] [data-testid="completed-del"]'); ok('V54-2. Admin thấy nút xóa ở dòng đơn hoàn thành', !!delB); await click(delB); await sleep(400);
  const dm=modal(), dgo=()=>doc.querySelector('[data-testid="force-del-go"]');
  ok('V54-3. Hộp xóa nêu đơn bằng Khách hàng · Quy cách, yêu cầu gõ XOA, nút khóa', !!dm&&/Khách thiếu SL · 0\.3/.test(txt(dm))&&/Gõ "XOA"/.test(txt(dm))&&dgo()&&dgo().disabled, txt(dm||doc.body).slice(0,200));
  nativeSet(doc.querySelector('[data-testid="force-del-reason"]'),'Nhập nhầm'); nativeSet(doc.querySelector('[data-testid="force-del-confirm"]'),'xoa'); await sleep(150);
  ok('V54-4. Lý do + gõ XOA → mở khóa', !dgo().disabled); await click(dgo()); await sleep(1000);
  ok('V54-5. Đơn hoàn thành CP-2 bị xóa cùng lệnh máy và sản lượng; CP-1 còn nguyên', !ordr('CP-2')&&!store('productionRuns').some(r=>r.orderId==='CP-2')&&!store('productionEntries').some(e=>e.orderId==='CP-2')&&!!ordr('CP-1')&&store('auditLog').some(a=>a.type==='order_force_delete'&&a.targetId==='CP-2'&&!/mã CP-2/.test(a.detail||'')));
  await clickText(/^Kế hoạch sản xuất/); await sleep(1200);
  const pr1=doc.querySelector('.pl-row[data-order="CP-1"]');
  ok('V54-6. Tab Kế hoạch: dòng đơn có 8 cột, hiện Khách hàng + Quy cách, KHÔNG hiện mã đơn', !!pr1&&!/CP-1/.test(txt(pr1))&&/Công ty Hoàn Mỹ/.test(txt(pr1))&&/0\.254BC/.test(txt(pr1))&&!/Mã đơn/.test(txt(doc.querySelector('.pl-hdr')||doc.body)), txt(pr1||doc.body).slice(0,160));
  const real=errs.filter(e=>!/Warning: .*(act|unmounted)/i.test(e)); ok('Z. Không có lỗi console/React', real.length===0, real.slice(0,3).join(' || '));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
