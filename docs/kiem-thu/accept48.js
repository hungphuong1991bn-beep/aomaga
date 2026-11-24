/* v48 — Kiểm thử luồng: routing → phân lệnh → thời gian/sản lượng → hoàn thành công đoạn → hoàn thành đơn → lưu trữ.
   Đơn thử: DP001 Kéo trung→Kéo tinh→Kéo siêu tinh→Ủ nhiệt | DP002 Kéo tinh→Kéo siêu tinh | DP003 Kéo trung→Kéo tinh
   (dùng đúng 6 công đoạn và số máy hiện có; không thêm công đoạn/máy). */
const {load}=require('./harness');
const t=load({fake:!!process.env.FAKE});
const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
let pass=0,fail=0;const out=[];
async function T(n,f){try{await f();pass++;out.push('PASS '+n);}catch(e){fail++;out.push('FAIL '+n+' :: '+(e&&e.message||e));}}
const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a));};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert');};
async function rej(p,sub){try{await p;}catch(e){if(sub&&!String(e.message).includes(sub))throw new Error('wrong error: '+e.message);return e;}throw new Error('expected rejection');}
const J=async c=>JSON.parse(await A('return JSON.stringify(await (async()=>{'+c+'})())'));
const get=async(col,id)=>J(`const s=await db.collection("${col}").doc("${id}").get();return (typeof s.exists==="function"?s.exists():s.exists)?s.data():null`);
const list=async col=>J(`const a=[];await new Promise(r=>{db.collection("${col}").onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()})});return a`);
const as=(role,name)=>R(`window.__AMG_USER={username:"${role}",role:"${role}",fullName:"${name||role}"}`);
const mk=async(id,route,extra={})=>A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});
  const o=normalizeOrderStages(Object.assign({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:1000,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:${JSON.stringify(route)},routingConfirmed:true},${JSON.stringify(extra)}));
  await db.collection(FS.orders).doc(o.id).set(o);`);
const asg=(run,order,mach,stage,qty,extra='')=>A(`return await amgFlowAssign({runId:"${run}",orderId:"${order}",machineId:"${mach}",stageKey:"${stage}",plannedQuantity:${qty},shift:"Ca Ngày",operator:"Nguyễn A",startNow:true${extra}})`);
const out1=(run,order,mach,stage,qty,key)=>A(`return await amgFlowRecordOutput({clientKey:"${key}",runId:"${run}",orderId:"${order}",machineId:"${mach}",stageKey:"${stage}",qty:${qty}})`);
const ids=(arr)=>arr.map(o=>o.id).sort();
(async()=>{
  as('admin','Quản trị');
  await A(`const b=db.batch();genMachineSeed().forEach(m=>b.set(db.collection(FS.machines).doc(m.id),m));await b.commit();`);
  const ORD=['keo_trung','keo_tinh','keo_sieu_tinh','u_nhiet'];
  await mk('DP001',ORD,{quantity:1000}); await mk('DP002',['keo_tinh','keo_sieu_tinh'],{quantity:500}); await mk('DP003',['keo_trung','keo_tinh'],{quantity:300});
  await A(`await db.collection(FS.orders).doc("DP-OLD").set({id:"DP-OLD",customer:"KH-OLD",spec:"0.2",quantity:100,stages:{},orderDate:"2026-10-01"})`); // đơn cũ chưa xác nhận quy trình
  const forStage=async st=>{ const os=await list('orders'),rs=await list('productionRuns'); return J(`const x=amgOrdersForStage(${JSON.stringify(os)},${JSON.stringify(rs)},"${st}");return {e:x.eligible.map(o=>o.id).sort(),w:x.waiting.map(w=>w.order.id).sort()}`); };

  await T('1. Mỗi công đoạn chỉ hiện đúng đơn có công đoạn đó trong routing đã xác nhận',async()=>{
    const kt=await forStage('keo_trung'); eq(kt.e,['DP001','DP003']); eq(kt.w,[]);
    const kti=await forStage('keo_tinh'); eq(kti.e,['DP002'],'DP002 bắt đầu ở Kéo tinh'); eq(kti.w,['DP001','DP003'],'DP001/DP003 chờ Kéo trung có sản lượng');
    const kst=await forStage('keo_sieu_tinh'); eq(kst.w.concat(kst.e).sort(),['DP001','DP002']);
    const un=await forStage('u_nhiet'); eq(un.w.concat(un.e),['DP001']);
    const ma=await forStage('ma_thiec'); eq(ma.w.concat(ma.e),[],'không công đoạn nào trong routing → trống');
  });
  await T('2. Đơn chưa xác nhận quy trình: xử lý riêng, KHÔNG suy diễn, KHÔNG phân lệnh được',async()=>{
    const os=await list('orders');
    eq(J_(R(`amgUnconfirmedOrders(${JSON.stringify(os)}).map(o=>o.id)`)),['DP-OLD']);
    for(const st of ['keo_tinh','keo_sieu_tinh','u_nhiet','keo_trung']) ok(!(await forStage(st)).e.concat((await forStage(st)).w).includes('DP-OLD'),'DP-OLD lọt vào '+st);
    await rej(asg('RX','DP-OLD','KTI-01','keo_tinh',50),'chưa xác nhận quy trình');
    eq((await list('productionRuns')).length,0,'không tạo lệnh');
  });
  function J_(x){return JSON.parse(JSON.stringify(x));}
  await T('3. Công đoạn không có trong routing bị từ chối (DP002 không có Kéo trung)',async()=>{
    await rej(asg('RY','DP002','KT-01','keo_trung',50),'không nằm trong quy trình');
  });
  await T('4. Phân DP001 vào KT-01, chạy, lệnh có unit kg + openRunIds',async()=>{
    const r=await asg('R-DP1-KT','DP001','KT-01','keo_trung',1000);
    eq(r.run.productionStatus,'running'); eq(r.run.unit,'kg');
    eq((await get('machines','KT-01')).activeRunId,'R-DP1-KT'); eq((await get('orders','DP001')).openRunIds,['R-DP1-KT']);
    const kt=await forStage('keo_trung'); ok(kt.e.includes('DP001'),'còn đủ điều kiện để chia lệnh nhiều máy (đủ SL còn thiếu)');
  });
  await T('5. Ghi 100 kg; ghi nhiều lần trong ca; không ghi trùng khi bấm nhiều lần; mỗi lượt có người/máy/công đoạn/SL/đơn vị/thời gian',async()=>{
    const rs=await Promise.all([1,2,3,4].map(()=>out1('R-DP1-KT','DP001','KT-01','keo_trung',100,'k100')));
    eq(rs.filter(x=>!x.duplicate).length,1,'chỉ 1 lượt thật'); 
    await out1('R-DP1-KT','DP001','KT-01','keo_trung',50.5,'k2'); await out1('R-DP1-KT','DP001','KT-01','keo_trung',25,'k3');
    const en=(await list('productionEntries')).filter(e=>e.runId==='R-DP1-KT'); eq(en.length,3);
    for(const e of en){ ok(e.enteredAt&&e.enteredBy==='Quản trị'&&e.machineId==='KT-01'&&e.stageKey==='keo_trung'&&e.unit==='kg'&&typeof e.qty==='number','thiếu trường: '+JSON.stringify(e)); }
    eq((await get('orders','DP001')).stages.keo_trung.done,175.5); eq((await get('productionRuns','R-DP1-KT')).producedQuantity,175.5);
  });
  await T('6. Thời gian từ timestamp + lịch sử tạm dừng (không lưu đồng hồ)',async()=>{
    const base=Date.parse('2026-11-22T08:00:00Z'), iso=ms=>new Date(base+ms).toISOString();
    const run={productionStatus:'running',startedAt:iso(0),plannedQuantity:1000,producedQuantity:300,pauses:[{at:iso(3600e3),resumedAt:iso(3600e3+1800e3)}]};
    const tm=R(`amgRunTiming(${JSON.stringify(run)},${base+4*3600e3})`);
    eq(tm.elapsedMs,4*3600e3); eq(tm.pausedMs,1800e3); eq(tm.netMs,3.5*3600e3); eq(tm.ratePerHour,85.71); eq(tm.remain,700);
    const paused=Object.assign({},run,{productionStatus:'paused',pauses:[{at:iso(3600e3),resumedAt:null}]});
    const tp=R(`amgRunTiming(${JSON.stringify(paused)},${base+3*3600e3})`); eq(tp.pausedMs,2*3600e3); eq(tp.netMs,3600e3); ok(tp.openPause);
    eq(R(`amgRunTiming({productionStatus:"assigned",plannedQuantity:5,producedQuantity:0},${base}).elapsedMs`),0);
    eq(R(`amgClock(3725000)`),'1:02:05'); eq(R(`amgHm(3725000)`),'1 giờ 02 phút');
    eq(R(`amgRunTiming({startedAt:"${iso(0)}",plannedQuantity:10,producedQuantity:5,pauses:[]},${base+30e3}).ratePerHour`),null,'< 1 phút không tính năng suất');
  });
  await T('7. Tạm dừng / tiếp tục: ghi mốc thời gian; kết thúc khi đang tạm dừng đóng lần tạm dừng',async()=>{
    await A(`await amgFlowPause("R-DP1-KT","Đứt dây")`);
    ok((await get('productionRuns','R-DP1-KT')).pauses[0].resumedAt===null);
    await rej(out1('R-DP1-KT','DP001','KT-01','keo_trung',1,'kp'),'tạm dừng');
    await A(`await amgFlowResume("R-DP1-KT")`);
    const r=await get('productionRuns','R-DP1-KT'); ok(r.pauses[0].resumedAt&&r.pauses[0].reason==='Đứt dây'&&r.pauses[0].by==='Quản trị');
  });
  await T('8. Hoàn thành công đoạn đòi lý do khi thiếu; kết thúc lệnh KHÔNG tự hoàn thành công đoạn',async()=>{
    const f1=await A(`return await amgFlowFinishRun({runId:"R-DP1-KT",completeStage:false})`);
    ok(!f1.stageCompleted&&!f1.orderCompleted);
    const o=await get('orders','DP001'); ok(!o.stageComplete||!o.stageComplete.keo_trung,'chưa hoàn thành công đoạn'); eq(o.openRunIds,[]);
    const r=await get('productionRuns','R-DP1-KT'); eq(r.productionStatus,'completed'); ok(r.endedAt&&r.finalTiming&&typeof r.finalTiming.netMs==='number'); eq(r.producedQuantity,175.5);
    eq((await get('machines','KT-01')).activeRunId,null,'máy giải phóng'); eq((await get('orders','DP001')).status,undefined);
  });
  await T('9. Không phân lại công đoạn đã hoàn thành; hoàn thành công đoạn → chuyển công đoạn kế',async()=>{
    // lệnh mới để hoàn thành công đoạn Kéo trung của DP001
    await asg('R-DP1-KT2','DP001','KT-01','keo_trung',824.5); await out1('R-DP1-KT2','DP001','KT-01','keo_trung',824.5,'k4');
    await A(`await amgFlowFinishRun({runId:"R-DP1-KT2",completeStage:true})`);
    const o=await get('orders','DP001'); ok(o.stageComplete.keo_trung); eq(o.stages.keo_trung.done,1000);
    await rej(asg('R-X','DP001','KT-02','keo_trung',10),'đã hoàn thành');
    ok(!(await forStage('keo_trung')).e.includes('DP001'),'DP001 biến mất khỏi Kéo trung');
    ok((await forStage('keo_tinh')).e.includes('DP001'),'DP001 xuất hiện ở Kéo tinh');
    ok(!(await forStage('keo_sieu_tinh')).e.includes('DP001'),'chưa tới Kéo siêu tinh');
    eq(R(`amgPlanBucket(${JSON.stringify(o)},[]).bucket`),'waiting_next');
    ok(o.status!=='completed','chưa chuyển sang hoàn thành quá sớm');
  });
  await T('10. Không hoàn thành công đoạn khi còn lệnh mở khác cùng công đoạn',async()=>{
    await asg('S1','DP001','KTI-01','keo_tinh',500); await asg('S2','DP001','KTI-02','keo_tinh',500);
    await out1('S1','DP001','KTI-01','keo_tinh',900,'s1'); 
    await rej(A(`await amgFlowFinishRun({runId:"S1",completeStage:true})`),'còn lệnh đang mở');
    await A(`await amgFlowFinishRun({runId:"S2",completeStage:false})`);
    await A(`await amgFlowFinishRun({runId:"S1",completeStage:true,shortReason:"Khách đồng ý giao 900"})`);
    ok((await get('orders','DP001')).stageComplete.keo_tinh.short);
  });
  await T('11. Hoàn thành lần lượt công đoạn còn lại; công đoạn cuối KHÔNG tự hoàn thành đơn, báo chờ xác nhận',async()=>{
    for(const [st,m,n] of [['keo_sieu_tinh','KST-01',1],['u_nhiet','UN-01',2]]){
      await asg('T'+n,'DP001',m,st,900); await out1('T'+n,'DP001',m,st,900,'t'+n);
      const f=await A(`return await amgFlowFinishRun({runId:"T${n}",completeStage:true,shortReason:"giao theo số đã làm"})`);
      if(st==='u_nhiet'){ ok(f.readyToComplete&&!f.orderCompleted); } else ok(!f.readyToComplete);
    }
    const o=await get('orders','DP001'); ok(o.status!=='completed');
    const rs=await list('productionRuns'); const cs=R(`amgOrderCompletionState(${JSON.stringify(o)},${JSON.stringify(rs)})`);
    ok(cs.canConfirm&&cs.awaiting&&cs.short,'đủ điều kiện, thiếu số lượng (900/1000)');
  });
  await T('12. Không hoàn thành khi còn lệnh mở; thiếu SL cần lý do + quyền quản lý',async()=>{
    await mk('DP-BLK',['keo_tinh'],{quantity:100}); await asg('B1','DP-BLK','KTI-03','keo_tinh',100); await out1('B1','DP-BLK','KTI-03','keo_tinh',100,'b1');
    await rej(A(`await amgFlowCompleteOrder({orderId:"DP-BLK",reason:""})`),'lệnh');
    await A(`await amgFlowFinishRun({runId:"B1",completeStage:true})`); eq((await get('orders','DP-BLK')).status,undefined);
    as('employee','NV'); await rej(A(`await amgFlowCompleteOrder({orderId:"DP001",reason:"abcdefgh"})`),'không có quyền');
    as('manager','QĐ'); await rej(A(`await amgFlowCompleteOrder({orderId:"DP001",reason:""})`),'chưa đủ số lượng'); await rej(A(`await amgFlowCompleteOrder({orderId:"DP001",reason:"abc"})`),'chưa đủ');
  });
  await T('13. Xác nhận HOÀN THÀNH ĐƠN: status=completed + completedAt/By/Mode + lịch sử; không xóa dữ liệu; không nhân đôi',async()=>{
    const before={runs:(await list('productionRuns')).length,ent:(await list('productionEntries')).length,orders:(await list('orders')).length};
    await A(`await amgFlowCompleteOrder({orderId:"DP001",reason:"Giao thiếu 100kg theo thỏa thuận"})`);
    const o=await get('orders','DP001'); eq(o.status,'completed'); eq(o.completedBy,'QĐ'); eq(o.completionMode,'manual'); ok(o.completedAt&&o.completedShort);
    eq(o.completionNote,'Giao thiếu 100kg theo thỏa thuận'); eq(o.completionSummary.finished,900); eq(o.statusHistory.slice(-1)[0].action,'complete');
    const again=await A(`return await amgFlowCompleteOrder({orderId:"DP001",reason:"x"})`); ok(again.duplicate);
    eq({runs:(await list('productionRuns')).length,ent:(await list('productionEntries')).length,orders:(await list('orders')).length},before,'không xóa/nhân bản');
    eq((await list('orders')).filter(x=>x.id==='DP001').length,1);
  });
  await T('14. Đơn completed biến khỏi mọi danh sách đang hoạt động; còn nguyên dữ liệu lịch sử',async()=>{
    const os=await list('orders'),rs=await list('productionRuns'); const o=os.find(x=>x.id==='DP001');
    eq(R(`${JSON.stringify(os)}.filter(amgIsActiveOrder).some(o=>o.id==="DP001")`),false);
    for(const st of ['keo_trung','keo_tinh','keo_sieu_tinh','u_nhiet']) ok(!(await forStage(st)).e.concat((await forStage(st)).w).includes('DP001'),'DP001 còn ở '+st);
    ok(rs.filter(r=>r.orderId==='DP001').length===6,'lệnh còn đủ'); ok(rs.filter(r=>r.orderId==='DP001').every(r=>!R(`amgIsOpenRun(${JSON.stringify(r)})`)));
    await rej(asg('R-Z','DP001','KT-01','keo_trung',1),'hoàn thành'); await rej(out1('R-DP1-KT','DP001','KT-01','keo_trung',1,'late'),'hoàn thành');
    const iss=R(`amgRunIssues(${JSON.stringify(rs)},${JSON.stringify(os)},${JSON.stringify(await list('machines'))}).filter(i=>i.kind==="run_on_completed_order")`); eq(iss.length,0);
  });
  await T('15. Mở lại đơn (quản lý, bắt buộc lý do): đơn quay lại hoạt động, dữ liệu + lịch sử nguyên vẹn',async()=>{
    await rej(A(`await amgFlowReopenOrder({orderId:"DP001",reason:"ab"})`),'lý do');
    const pre=await get('orders','DP001');
    await A(`await amgFlowReopenOrder({orderId:"DP001",reason:"Khách đặt thêm 100kg"})`);
    const o=await get('orders','DP001'); eq(o.status,'reopened'); eq(o.stages,pre.stages); ok(!o.stageComplete.u_nhiet,'công đoạn cuối mở lại'); ok(o.stageComplete.keo_trung);
    eq(o.statusHistory.map(h=>h.action),['complete','reopen']); eq(o.statusHistory[1].completedBy,'QĐ'); eq(o.lastCompletionSummary.finished,900);
    ok(R(`amgIsActiveOrder(${JSON.stringify(o)})`)); ok((await forStage('u_nhiet')).e.includes('DP001'),'phân lệnh lại được Ủ nhiệt');
  });
  await T('16. Đơn vị: đơn mét → lệnh/lượt ghi lưu "m"; không cộng lẫn kg và m',async()=>{
    await mk('DP-M',['keo_tinh'],{quantity:2000,unit:'m'});
    const r=await asg('RM','DP-M','KTI-04','keo_tinh',2000); eq(r.run.unit,'m');
    const e=await out1('RM','DP-M','KTI-04','keo_tinh',500,'m1'); eq(e.entry.unit,'m');
    await A(`await db.collection("productionRuns").doc("RM").set({unit:"kg"},{merge:true})`);
    await rej(out1('RM','DP-M','KTI-04','keo_tinh',10,'m2'),'không cộng lẫn kg và mét');
    eq(R(`amgOrderUnit({})`),'kg'); eq(R(`amgSumTimings([{productionStatus:"running",startedAt:new Date(Date.now()-120000).toISOString(),producedQuantity:5,unit:"kg",pauses:[]},{productionStatus:"running",startedAt:new Date(Date.now()-120000).toISOString(),producedQuantity:7,unit:"m",pauses:[]}]).byUnit`),{kg:5,m:7});
  });
  await T('17. Hai người cùng lúc: phân lệnh với hoàn thành đơn không để lại lệnh mở trên đơn completed',async()=>{
    await mk('DP-RACE',['keo_tinh'],{quantity:100,unit:'kg'}); await asg('RC1','DP-RACE','KTI-05','keo_tinh',100); await out1('RC1','DP-RACE','KTI-05','keo_tinh',100,'rc');
    await A(`await amgFlowFinishRun({runId:"RC1",completeStage:true})`);
    const rs=await Promise.allSettled([A(`return await amgFlowCompleteOrder({orderId:"DP-RACE"})`),asg('RC2','DP-RACE','KTI-06','keo_tinh',10)]);
    const o=await get('orders','DP-RACE'); const rc2=await get('productionRuns','RC2');
    ok(!(o.status==='completed'&&rc2&&['assigned','running','paused'].includes(rc2.productionStatus)),'đơn completed còn lệnh mở: '+JSON.stringify(rs.map(x=>x.status)));
  });
  await T('18. Nhân viên (employee) phân lệnh/chạy/ghi SL/kết thúc được nhưng không hoàn thành đơn',async()=>{
    as('employee','NV'); await mk('DP-E',['keo_trung'],{quantity:50}); 
    await asg('RE','DP-E','KT-03','keo_trung',50); await out1('RE','DP-E','KT-03','keo_trung',50,'e1');
    const f=await A(`return await amgFlowFinishRun({runId:"RE",completeStage:true})`); ok(f.readyToComplete&&!f.orderCompleted);
    await rej(A(`await amgFlowCompleteOrder({orderId:"DP-E"})`),'không có quyền');
    as('admin','Quản trị');
  });
  console.log(out.join('\n'));console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0);
})();
