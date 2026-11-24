const {load}=require('./harness');
const t=load({fake:!!process.env.FAKE});
const R=code=>t.run(code);
let pass=0,fail=0;const results=[];
async function T(name,fn){ try{ await fn(); pass++; results.push('PASS '+name);}catch(e){ fail++; results.push('FAIL '+name+' :: '+(e&&e.message||e)); } }
const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a)); };
const ok=(c,m)=>{ if(!c) throw new Error(m||'assert'); };
async function rejects(p,sub){ try{ await p; }catch(e){ if(sub&&!String(e.message).includes(sub)) throw new Error('wrong error: '+e.message); return e; } throw new Error('expected rejection'); }
globalThis.W=t.w;
// helper run async code in context
const A=async code=>await t.run('(async()=>{'+code+'})()');
(async()=>{
 // user admin
 R('window.__AMG_USER={username:"admin",role:"admin",fullName:"Quản trị"}');
 // seed machines + orders offline
 await A(`
  const b=db.batch();
  genMachineSeed().forEach(m=>b.set(db.collection(FS.machines).doc(m.id),m));
  b.commit();
  window.__seedOrders = SEED_ORDERS.length;
  SEED_ORDERS.forEach(o=>db.collection(FS.orders).doc(o.id).set(o));
 `);
 const get=async(col,id)=>JSON.parse(await A(`const s=await db.collection("${col}").doc("${id}").get(); return JSON.stringify((typeof s.exists==="function"?s.exists():s.exists)?s.data():null)`));
 const mkOrder=async(id,route,extra={})=>{ await A(`
   const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});
   const o=normalizeOrderStages(Object.assign({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:1000,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:${JSON.stringify(route)},routingConfirmed:true},${JSON.stringify(extra)}));
   await db.collection(FS.orders).doc(o.id).set(o);`); };

 await T('1. Đơn chỉ có Kéo trung',async()=>{
   await mkOrder('ORD-T1',['keo_trung'],{wireFinish:'mềm'});
   const r=JSON.parse(await A('return JSON.stringify(getApplicableStages(await (async()=>{const s=await db.collection(FS.orders).doc("ORD-T1").get();return s.data()})()))'));
   eq(r,['keo_trung']);
 });
 await T('2. Đơn Kéo trung + Kéo tinh giữ thứ tự',async()=>{
   await mkOrder('ORD-T2',['keo_trung','keo_tinh']);
   const o=await get('orders','ORD-T2'); eq(R(`getApplicableStages(${JSON.stringify(o)})`),['keo_trung','keo_tinh']);
   eq(R(`normalizeOrderStages(${JSON.stringify(o)}).finishedShort`),1000);
 });
 await T('3. Đơn Kéo tinh + Ủ nhiệt (không ép Kéo siêu tinh)',async()=>{
   await mkOrder('ORD-T3',['keo_tinh','u_nhiet']);
   const o=await get('orders','ORD-T3'); eq(R(`getApplicableStages(${JSON.stringify(o)})`),['keo_tinh','u_nhiet']);
 });
 await T('Đơn cũ vẫn suy công đoạn theo quy cách',async()=>{
   const o=await get('orders','ORD001'); ok(!o.routing); eq(R(`getApplicableStages(${JSON.stringify(o)})`).slice(0,2),['keo_tinh','keo_sieu_tinh']);
 });
 const KT01=R('genMachineSeed().find(m=>m.typeKey==="keo_trung").id'); // KT-01
 await T('4. Phân đơn vào KT-01',async()=>{
   const r=JSON.parse(await A(`const x=await amgFlowAssign({runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",plannedQuantity:600,shift:"Ca Ngày",operator:"Nguyễn A",startNow:true}); return JSON.stringify(x)`));
   eq(r.run.productionStatus,'running');
   const m=await get('machines',KT01); eq(m.activeRunId,'RUN-A');
 });
 await T('5. Thẻ máy KT-01 lấy đúng đơn/khách từ dữ liệu gốc',async()=>{
   const runs=[await get('productionRuns','RUN-A')], o=await get('orders','ORD-T2'), m=await get('machines',KT01);
   eq(R(`amgMachineCardState(${JSON.stringify(m)},${JSON.stringify(runs)})`),'running');
   const oi=R(`(()=>{const x=amgRunOrderInfo(${JSON.stringify(runs[0])},[${JSON.stringify(o)}]);return {c:x.customer,s:x.spec,f:x.found}})()`);
   eq(oi,{c:'KH-ORD-T2',s:'0.254BC',f:true});
   ok(!('customer' in runs[0]),'run không được chứa bản sao customer');
 });
 await T('Khóa: máy không nhận lệnh thứ hai khi đang giữ lệnh',async()=>{
   await rejects(A(`await amgFlowAssign({runId:"RUN-B",orderId:"ORD-T1",machineId:"${KT01}",stageKey:"keo_trung",plannedQuantity:100,shift:"Ca Ngày",operator:"B"})`),'vừa được phân lệnh');
 });
 await T('Sai công đoạn: Kéo trung không được vào máy kéo tinh',async()=>{
   const kti=R('genMachineSeed().find(m=>m.typeKey==="keo_tinh").id');
   await rejects(A(`await amgFlowAssign({runId:"RUN-C",orderId:"ORD-T2",machineId:"${kti}",stageKey:"keo_trung",plannedQuantity:100,shift:"Ca Ngày",operator:"B"})`),'không thuộc công đoạn');
 });
 await T('6. Nhập sản lượng KT-01 → đơn cập nhật',async()=>{
   const r=JSON.parse(await A(`return JSON.stringify(await amgFlowRecordOutput({clientKey:"k1",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",qty:400}))`));
   eq(r.stageDone,400);
   const o=await get('orders','ORD-T2'); eq(o.stages.keo_trung.done,400); eq(o.stages.keo_trung.remain,600);
   eq(o.finishedDone,0,'thành phẩm theo công đoạn cuối (Kéo tinh) nên vẫn 0');
   const run=await get('productionRuns','RUN-A'); eq(run.producedQuantity,400);
   const au=await get('auditLog',r.entry.id); eq(au.type,'production_entry'); eq(au.targetId,'ORD-T2');
 });
 await T('Chống ghi trùng: bấm lưu nhiều lần cùng khóa',async()=>{
   const rs=await Promise.all([1,2,3].map(()=>A(`return JSON.stringify(await amgFlowRecordOutput({clientKey:"k1",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",qty:400}))`)));
   ok(rs.every(x=>JSON.parse(x).duplicate),'tất cả phải là duplicate');
   eq((await get('orders','ORD-T2')).stages.keo_trung.done,400);
 });
 await T('9. Hai người ghi đồng thời (khóa khác nhau) không mất/trùng',async()=>{
   await Promise.all(['a','b','c'].map(k=>A(`return await amgFlowRecordOutput({clientKey:"c-${k}",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",qty:10})`)));
   eq((await get('orders','ORD-T2')).stages.keo_trung.done,430);
   eq((await get('productionRuns','RUN-A')).producedQuantity,430);
 });
 await T('Kiểm soát số liệu: âm, 0, chữ, sai máy/đơn/công đoạn, vượt 150%',async()=>{
   const base=`runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung"`;
   for(const q of ['-5','0','abc','1e3','1.234']) await rejects(A(`await amgFlowRecordOutput({clientKey:"bad-${q.replace(/\W/g,'')}",${base},qty:"${q}"})`),'');
   await rejects(A(`await amgFlowRecordOutput({clientKey:"w1",runId:"RUN-A",orderId:"ORD-T1",machineId:"${KT01}",stageKey:"keo_trung",qty:1})`),'Sai đơn');
   await rejects(A(`await amgFlowRecordOutput({clientKey:"w2",runId:"RUN-A",orderId:"ORD-T2",machineId:"KT-02",stageKey:"keo_trung",qty:1})`),'Sai máy');
   await rejects(A(`await amgFlowRecordOutput({clientKey:"w3",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_tinh",qty:1})`),'Sai công đoạn');
   await rejects(A(`await amgFlowRecordOutput({clientKey:"w4",${base},qty:2000})`),'vượt');
   eq((await get('orders','ORD-T2')).stages.keo_trung.done,430,'không được ghi gì khi lỗi');
 });
 await T('Vượt 105% cần xác nhận',async()=>{
   await A(`await amgFlowRecordOutput({clientKey:"ov1",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",qty:570})`); // 1000
   const e=await rejects(A(`await amgFlowRecordOutput({clientKey:"ov2",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",qty:60})`),'vượt');
   eq(e.message.includes('vượt'),true);
   await A(`await amgFlowRecordOutput({clientKey:"ov2",runId:"RUN-A",orderId:"ORD-T2",machineId:"${KT01}",stageKey:"keo_trung",qty:60,confirmWarnings:true})`);
   eq((await get('orders','ORD-T2')).stages.keo_trung.done,1060);
 });
 await T('7. Kết thúc KT-01, hoàn thành công đoạn, giải phóng máy',async()=>{
   const r=JSON.parse(await A(`return JSON.stringify(await amgFlowFinishRun({runId:"RUN-A",completeStage:true}))`));
   ok(r.stageCompleted); ok(!r.orderCompleted);
   eq((await get('machines',KT01)).activeRunId,null);
   const run=await get('productionRuns','RUN-A'); eq(run.productionStatus,'completed'); ok(run.endedAt); eq(run.snapshot.customer,'KH-ORD-T2');
   eq(R(`amgPlanBucket(${JSON.stringify(await get('orders','ORD-T2'))},[]).bucket`),'waiting_next');
 });
 await T('8. Phân tiếp KTI-01 cho công đoạn Kéo tinh',async()=>{
   const r=JSON.parse(await A(`return JSON.stringify(await amgFlowAssign({runId:"RUN-D",orderId:"ORD-T2",machineId:"KTI-01",stageKey:"keo_tinh",plannedQuantity:1000,shift:"Ca Đêm",operator:"C",startNow:true}))`));
   eq(r.run.machineId,'KTI-01');
   // máy KT-01 đã rảnh: nhận đơn khác
   await A(`await amgFlowAssign({runId:"RUN-E",orderId:"ORD-T1",machineId:"${KT01}",stageKey:"keo_trung",plannedQuantity:500,shift:"Ca Ngày",operator:"D",startNow:true})`);
   eq((await get('machines',KT01)).activeRunId,'RUN-E');
 });
 await T('Công đoạn sau bị chặn khi công đoạn trước chưa có sản lượng',async()=>{
   await mkOrder('ORD-T4',['keo_tinh','u_nhiet']);
   await rejects(A(`await amgFlowAssign({runId:"RUN-F",orderId:"ORD-T4",machineId:"UN-01",stageKey:"u_nhiet",plannedQuantity:100,shift:"Ca Ngày",operator:"E"})`),'chưa có sản lượng');
 });
 await T('Sản lượng công đoạn sau không vượt công đoạn trước',async()=>{
   await A(`await amgFlowRecordOutput({clientKey:"p1",runId:"RUN-D",orderId:"ORD-T2",machineId:"KTI-01",stageKey:"keo_tinh",qty:900})`);
   await rejects(A(`await amgFlowRecordOutput({clientKey:"p2",runId:"RUN-D",orderId:"ORD-T2",machineId:"KTI-01",stageKey:"keo_tinh",qty:300})`),'không thể vượt');
   // 1060 của Kéo trung ≥ 1200? => 900+300=1200 > 1060*1.01 nên bị chặn đúng
 });
 await T('10. Máy hỏng/bảo trì không nhận đơn mới',async()=>{
   await A(`await db.collection(FS.machines).doc("KT-03").update({status:"broken"}); await db.collection(FS.machines).doc("KT-04").update({status:"maintenance"})`);
   await rejects(A(`await amgFlowAssign({runId:"RUN-G",orderId:"ORD-T3",machineId:"KT-03",stageKey:"keo_tinh",plannedQuantity:1,shift:"Ca Ngày",operator:"x"})`),'');
   await mkOrder('ORD-T5',['keo_trung']);
   await rejects(A(`await amgFlowAssign({runId:"RUN-G",orderId:"ORD-T5",machineId:"KT-03",stageKey:"keo_trung",plannedQuantity:1,shift:"Ca Ngày",operator:"x"})`),'HỎNG');
   await rejects(A(`await amgFlowAssign({runId:"RUN-H",orderId:"ORD-T5",machineId:"KT-04",stageKey:"keo_trung",plannedQuantity:1,shift:"Ca Ngày",operator:"x"})`),'BẢO TRÌ');
   const m3=await get('machines','KT-03'); eq(R(`amgCardStatusMeta(amgMachineCardState(${JSON.stringify(m3)},[])).label`),'HỎNG');
 });
 await T('Nhóm máy theo công đoạn đúng danh mục',async()=>{
   const ms=JSON.parse(await A('const l=[];for(const m of genMachineSeed())l.push(m);return JSON.stringify(l)'));
   const n=(st)=>R(`amgMachinesForStage(${JSON.stringify(ms)},"${st}").length`);
   eq([n('keo_trung'),n('keo_tinh'),n('keo_sieu_tinh'),n('u_nhiet'),n('ma_thiec'),n('ben')],[4,64,19,4,5,60]);
   eq(R(`amgStageMachineTypes("ben").map(t=>t.prefix)`),['B500','B630','B400','B300']);
 });
 await T('11. Hoàn thành mọi công đoạn → đơn chuyển sang hoàn thành',async()=>{
   await mkOrder('ORD-T6',['keo_trung','keo_tinh'],{quantity:200});
   await A(`await amgFlowAssign({runId:"R6a",orderId:"ORD-T6",machineId:"KT-02",stageKey:"keo_trung",plannedQuantity:200,shift:"Ca Ngày",operator:"x",startNow:true});
            await amgFlowRecordOutput({clientKey:"s1",runId:"R6a",orderId:"ORD-T6",machineId:"KT-02",stageKey:"keo_trung",qty:200});
            await amgFlowFinishRun({runId:"R6a",completeStage:true});
            await amgFlowAssign({runId:"R6b",orderId:"ORD-T6",machineId:"KTI-02",stageKey:"keo_tinh",plannedQuantity:200,shift:"Ca Ngày",operator:"y",startNow:true});
            await amgFlowRecordOutput({clientKey:"s2",runId:"R6b",orderId:"ORD-T6",machineId:"KTI-02",stageKey:"keo_tinh",qty:200});`);
   let o=await get('orders','ORD-T6'); ok(o.status!=='completed','chưa hoàn thành khi chưa đóng công đoạn cuối');
   eq(o.finishedDone,200);
   const r=JSON.parse(await A(`return JSON.stringify(await amgFlowFinishRun({runId:"R6b",completeStage:true}))`));
   ok(!r.orderCompleted,'kết thúc lệnh + hoàn thành công đoạn cuối KHÔNG tự hoàn thành đơn'); ok(r.readyToComplete,'phải báo đủ điều kiện chờ xác nhận');
   o=await get('orders','ORD-T6'); ok(o.status!=='completed'); eq(o.openRunIds,[]);
   await A(`await amgFlowCompleteOrder({orderId:"ORD-T6",reason:""})`);
   o=await get('orders','ORD-T6'); eq(o.status,'completed'); ok(o.completedAt); eq(o.completedBy,'Quản trị'); eq(o.completionMode,'manual'); eq(o.statusHistory[0].action,'complete');
   ok(o.bom===undefined||Array.isArray(o.bom)); ok(!!o.stages.keo_tinh&&o.stages.keo_tinh.done===200,'sản lượng giữ nguyên');
   // vẫn nằm trong collection orders
   const all=JSON.parse(await A('const ids=[];await new Promise(res=>{const u=db.collection(FS.orders).onSnapshot(s=>{s.docs.forEach(d=>ids.push(d.id));res();});});return JSON.stringify(ids)'));
   ok(all.includes('ORD-T6'));
 });
 await T('12. Đơn chưa xong không bị chuyển nhầm (một công đoạn xong ≠ đơn xong)',async()=>{
   const o=await get('orders','ORD-T2'); ok(o.status!=='completed'); ok(o.stageComplete.keo_trung);
   const l=R(`amgOrderLifecycle(${JSON.stringify(o)},[])`); ok(l.key!=='completed');
   // đơn cũ đủ SL không tự chuyển
   const legacy=R(`SEED_ORDERS.filter(o=>amgLegacyDoneCandidate(o)).length`); ok(legacy>=0);
   const og=await get('orders','ORD001'); ok(og.status!=='completed');
 });
 await T('Hoàn thành thiếu số lượng bắt buộc lý do (công đoạn)',async()=>{
   await mkOrder('ORD-T7',['keo_trung'],{quantity:1000,wireFinish:'mềm'});
   await A(`await amgFlowAssign({runId:"R7",orderId:"ORD-T7",machineId:"KT-02",stageKey:"keo_trung",plannedQuantity:1000,shift:"Ca Ngày",operator:"x",startNow:true});
            await amgFlowRecordOutput({clientKey:"z1",runId:"R7",orderId:"ORD-T7",machineId:"KT-02",stageKey:"keo_trung",qty:500});`);
   await rejects(A(`await amgFlowFinishRun({runId:"R7",completeStage:true})`),'chưa đủ số lượng');
   const r=JSON.parse(await A(`return JSON.stringify(await amgFlowFinishRun({runId:"R7",completeStage:true,shortReason:"Khách đồng ý giao 500"}))`));
   ok(r.stageCompleted); ok(!r.orderCompleted,'thiếu SL không tự hoàn thành đơn');
   const rd=R(`amgOrderReadiness(${JSON.stringify(await get('orders','ORD-T7'))})`); ok(rd.allStages&&!rd.qtyMet);
   await rejects(A(`await amgFlowCompleteOrder({orderId:"ORD-T7",reason:""})`),'chưa đủ số lượng');
   await A(`await amgFlowCompleteOrder({orderId:"ORD-T7",reason:"Giao thiếu theo thỏa thuận"})`);
   const o=await get('orders','ORD-T7'); eq(o.status,'completed'); eq(o.completedShort,true);
 });
 await T('Mở lại đơn: bắt buộc lý do + nhật ký + giữ dữ liệu',async()=>{
   await rejects(A(`await amgFlowReopenOrder({orderId:"ORD-T7",reason:"x"})`),'lý do');
   await A(`await amgFlowReopenOrder({orderId:"ORD-T7",reason:"Khách đặt thêm 500kg"})`);
   const o=await get('orders','ORD-T7'); eq(o.status,'reopened'); eq(o.stages.keo_trung.done,500); eq(o.statusHistory.length,2); eq(o.statusHistory[1].reason,'Khách đặt thêm 500kg'); eq(o.statusHistory[1].action,'reopen');
   ok(!o.stageComplete.keo_trung,'công đoạn cuối được mở lại');
   const logs=JSON.parse(await A('const a=[];await new Promise(res=>{db.collection(FS.audit).onSnapshot(s=>{s.docs.forEach(d=>a.push(d.data()));res()})});return JSON.stringify(a.filter(x=>x.type==="order_reopen"))'));
   eq(logs.length,1);
 });
 await T('Phân quyền flow: Nhân viên phân máy/chạy/ghi SL được, KHÔNG xác nhận/mở lại đơn; Quản đốc được',async()=>{
   await mkOrder('ORD-P',['keo_trung'],{wireFinish:'mềm'});
   R('window.__AMG_USER={username:"nv1",role:"employee",fullName:"NV"}');
   await A(`await amgFlowAssign({runId:"RP0",orderId:"ORD-P",machineId:"KT-02",stageKey:"keo_trung",plannedQuantity:100,shift:"Ca Ngày",operator:"x",startNow:true})`);
   await A(`await amgFlowRecordOutput({clientKey:"nvk",runId:"RP0",orderId:"ORD-P",machineId:"KT-02",stageKey:"keo_trung",qty:100})`);
   await A(`await amgFlowFinishRun({runId:"RP0",completeStage:false})`);
   await rejects(A(`await amgFlowReopenOrder({orderId:"ORD-T6",reason:"abcdefgh"})`),'không có quyền');
   await rejects(A(`await amgFlowCompleteOrder({orderId:"ORD-P",reason:"abcdefgh"})`),'không có quyền');
   R('window.__AMG_USER={username:"qd1",role:"manager",fullName:"QĐ"}');
   await A(`await amgFlowReopenOrder({orderId:"ORD-T6",reason:"Kiểm tra mở lại"})`);
   R('window.__AMG_USER={username:"admin",role:"admin",fullName:"Quản trị"}');
 });
 await T('Hủy lệnh: chỉ khi chưa có sản lượng; giải phóng máy',async()=>{
   await A(`await amgFlowAssign({runId:"RX",orderId:"ORD-T5",machineId:"KT-02",stageKey:"keo_trung",plannedQuantity:50,shift:"Ca Ngày",operator:"x"})`);
   await A(`await amgFlowCancelRun("RX","phân nhầm máy")`);
   eq((await get('machines','KT-02')).activeRunId,null); eq((await get('productionRuns','RX')).productionStatus,'cancelled');
 });
 await T('Sửa/hủy lượt sản lượng của lệnh đồng bộ đơn + lệnh',async()=>{
   await mkOrder('ORD-T8',['keo_trung'],{wireFinish:'mềm'});
   const r=JSON.parse(await A(`await amgFlowAssign({runId:"R8",orderId:"ORD-T8",machineId:"KT-02",stageKey:"keo_trung",plannedQuantity:500,shift:"Ca Ngày",operator:"x",startNow:true});
     return JSON.stringify(await amgFlowRecordOutput({clientKey:"e1",runId:"R8",orderId:"ORD-T8",machineId:"KT-02",stageKey:"keo_trung",qty:100}))`));
   await A(`await amgFlowCorrectEntry({entryId:"${r.entry.id}",newQty:80,mode:"edit"})`);
   eq((await get('orders','ORD-T8')).stages.keo_trung.done,80); eq((await get('productionRuns','R8')).producedQuantity,80);
   await A(`await amgFlowCorrectEntry({entryId:"${r.entry.id}",mode:"void"})`);
   eq((await get('orders','ORD-T8')).stages.keo_trung.done,0); eq(await get('auditLog',r.entry.id),null);
   eq((await get('productionEntries',r.entry.id)).voided,true);
 });
 await T('Ghi trực tiếp vào đơn (nhập liệu cũ) không ghi đè sản lượng luồng mới',async()=>{
   const before=(await get('orders','ORD-T8')).stages.keo_trung.done;
   await A(`await amgFlowAddStageQty({orderId:"ORD-T8",stageKey:"keo_trung",qty:25})`);
   eq((await get('orders','ORD-T8')).stages.keo_trung.done,before+25);
 });
 if(!process.env.FAKE) require('fs').writeFileSync('/tmp/db.json',t.w.localStorage.getItem('amg_mes_offline_db_v1')||'{}');
 console.log(results.join('\n'));
 console.log(`\n${pass} pass, ${fail} fail`);
 process.exit(fail?1:0);
})();
