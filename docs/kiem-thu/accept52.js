/* v52 — Kiểm thử HOÀN THÀNH ĐƠN MỘT BƯỚC + đồng bộ đa thiết bị (hai cửa sổ cùng nối vào một máy chủ RTDB giả lập).
   Chạy: NM=<node_modules> APP_DIR=../.. node accept52.js */
const {load}=require('./harness'); const rt=require('./fakertdb');
const server=rt.makeServer();
const D=(name)=>{ const t=load({server}); const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
  const J=async c=>JSON.parse(await A('return JSON.stringify(await (async()=>{'+c+'})())'));
  const get=async(col,id)=>J(`const s=await db.collection("${col}").doc("${id}").get();return (typeof s.exists==="function"?s.exists():s.exists)?s.data():null`);
  const list=async col=>J(`const s=await db.collection("${col}").get();return s.docs.map(d=>Object.assign({id:d.id},d.data()))`);
  const as=(role,n)=>R(`window.__AMG_USER={username:"${role}",role:"${role}",fullName:"${n||role}"}`);
  return {name,t,w:t.w,R,A,J,get,list,as}; };
let pass=0,fail=0;const out=[];
async function T(n,f){try{await f();pass++;out.push('PASS '+n);}catch(e){fail++;out.push('FAIL '+n+' :: '+(e&&e.message||e));}}
const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a));};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert');};
async function rej(p,sub){try{await p;}catch(e){if(sub&&!String(e.message).includes(sub))throw new Error('wrong error: '+e.message);return e;}throw new Error('expected rejection');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000,msg='timeout'){const t0=Date.now();for(;;){try{if(await fn())return;}catch(e){}if(Date.now()-t0>ms)throw new Error(msg);await sleep(20);}}
(async()=>{
  const a=D('A'),b=D('B'); a.as('admin','Quản trị'); b.as('admin','Quản đốc B');
  await until(async()=>a.R('window.__rtdbStatus.state')==='online'&&b.R('window.__rtdbStatus.state')==='online',2000,'không kết nối');
  await a.A(`const bt=db.batch();genMachineSeed().forEach(m=>bt.set(db.collection(FS.machines).doc(m.id),m));await bt.commit();`);
  const mk=(d,id,route,extra={})=>d.A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});
    const o=normalizeOrderStages(Object.assign({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:100,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:${JSON.stringify(route)},routingConfirmed:true},${JSON.stringify(extra)}));
    await db.collection(FS.orders).doc(o.id).set(o);`);
  // đưa đơn tới trạng thái "đủ công đoạn, không còn lệnh mở": phân → ghi SL → kết thúc lệnh + hoàn thành công đoạn
  const ready=async(d,id,mach,qty,done)=>{ await mk(d,id,['keo_tinh'],{quantity:qty});
    await d.A(`await amgFlowAssign({runId:"R-${id}",orderId:"${id}",machineId:"${mach}",stageKey:"keo_tinh",plannedQuantity:${qty},shift:"Ca Ngày",operator:"NV A",startNow:true});
      await amgFlowRecordOutput({clientKey:"k-${id}",runId:"R-${id}",orderId:"${id}",machineId:"${mach}",stageKey:"keo_tinh",qty:${done}});
      return await amgFlowFinishRun({runId:"R-${id}",completeStage:true,shortReason:"giao theo số đã làm"})`); };
  await until(async()=>(await b.list('machines')).length>100,3000,'B chưa thấy máy');

  await T('0. Cả hai thiết bị dùng ghi có điều kiện (casDoc) của lớp dữ liệu',async()=>{ eq(a.R('typeof window.__db.casDoc'),'function'); eq(b.R('typeof window.__db.casDoc'),'function'); });

  await T('1. Kết thúc lệnh cuối KHÔNG tự hoàn thành đơn, KHÔNG có trạng thái trung gian "chờ xác nhận"',async()=>{
    await mk(a,'V52-1',['keo_tinh'],{quantity:100});
    await a.A(`await amgFlowAssign({runId:"R-1",orderId:"V52-1",machineId:"KTI-01",stageKey:"keo_tinh",plannedQuantity:100,shift:"Ca Ngày",operator:"NV A",startNow:true});await amgFlowRecordOutput({clientKey:"k1",runId:"R-1",orderId:"V52-1",machineId:"KTI-01",stageKey:"keo_tinh",qty:100});`);
    const f=await a.A(`return await amgFlowFinishRun({runId:"R-1",completeStage:true})`);
    ok(f.readyToComplete&&!f.orderCompleted); const o=await a.get('orders','V52-1'); ok(o.status!=='completed'&&o.status!=='awaiting'&&o.status!=='pending_completion','status='+o.status);
    eq(a.R('amgBucketMeta("stage_done").label.toLowerCase().includes("chờ xác nhận")'),false,'nhãn bucket còn chữ chờ xác nhận');
  });
  await T('2. Một lần bấm HOÀN THÀNH ĐƠN (đủ SL, không cần lý do): completed ngay + completedAt/By + tóm tắt máy + lịch sử + nhật ký',async()=>{
    const r=await a.A(`return await amgFlowCompleteOrder({orderId:"V52-1",source:"plan"})`); ok(!r.duplicate);
    const o=await a.get('orders','V52-1'); eq(o.status,'completed'); eq(o.completedBy,'Quản trị'); ok(o.completedAt); eq(o.completedShort,false); eq(o.completionSource,'plan');
    eq(o.completionSummary.machines,['KTI-01']); eq(o.completionSummary.runCount,1); eq(o.openRunIds,[]); eq(o.statusHistory.length,1);
    eq((await a.list('auditLog')).filter(x=>x.type==='order_complete'&&x.targetId==='V52-1').length,1);
    ok((await a.list('productionRuns')).some(x=>x.id==='R-1')&&(await a.list('productionEntries')).length>=1,'không được xóa lệnh/sản lượng');
  });
  await T('3. Đơn rời danh sách hoạt động và sang Đơn hàng hoàn thành NGAY trên thiết bị khác (không F5)',async()=>{
    await until(async()=>(await b.get('orders','V52-1')).status==='completed',2000,'B không thấy đơn completed');
    const os=await b.list('orders'); eq(b.R(`${JSON.stringify(os)}.filter(amgIsActiveOrder).some(o=>o.id==="V52-1")`),false);
    eq(b.R(`${JSON.stringify(os)}.filter(o=>o.status==="completed").some(o=>o.id==="V52-1")`),true);
  });
  await T('4. F5: thiết bị mới tải lại từ máy chủ vẫn thấy đơn completed, không quay lại danh sách hoạt động',async()=>{
    const c=D('C'); c.as('admin','QT'); await until(async()=>c.R('window.__rtdbStatus.state')==='online'&&(await c.list('orders')).length>0,3000,'C chưa tải');
    const o=await c.get('orders','V52-1'); eq(o.status,'completed'); eq(c.R(`amgIsActiveOrder(${JSON.stringify(o)})`),false);
  });
  await T('5. Bấm nhiều lần trên một máy: chỉ MỘT lần hoàn thành, completedAt không bị ghi đè, không nhân đôi lịch sử/nhật ký',async()=>{
    await ready(a,'V52-5','KTI-02',100,100); const rs=await Promise.all([1,2,3].map(()=>a.A(`return await amgFlowCompleteOrder({orderId:"V52-5"})`)));
    eq(rs.filter(x=>!x.duplicate).length,1,'số lần thắng'); const o=await a.get('orders','V52-5'); eq(o.statusHistory.length,1);
    eq((await a.list('auditLog')).filter(x=>x.type==='order_complete'&&x.targetId==='V52-5').length,1);
  });
  await T('6. HAI THIẾT BỊ cùng bấm cùng lúc: đúng một bên thắng, bên kia nhận duplicate, không đơn trùng, không ghi đè',async()=>{
    await ready(a,'V52-6','KTI-03',100,100); await until(async()=>(await b.get('orders','V52-6')).stageComplete,2000,'B chưa thấy');
    const before=server.conflicts;
    const rs=await Promise.allSettled([a.A(`return await amgFlowCompleteOrder({orderId:"V52-6"})`),b.A(`return await amgFlowCompleteOrder({orderId:"V52-6"})`)]);
    ok(rs.every(x=>x.status==='fulfilled'),'có bên lỗi: '+JSON.stringify(rs.map(x=>x.reason&&x.reason.message))); eq(rs.filter(x=>!x.value.duplicate).length,1,'số bên thắng');
    const o=await a.get('orders','V52-6'); eq(o.statusHistory.length,1); eq((server.getPath('/orders/V52-6')?1:0),1);
    eq((await a.list('orders')).filter(x=>x.id==='V52-6').length,1);
    await until(async()=>(await b.get('orders','V52-6')).completedBy===o.completedBy,2000,'hai bên lệch người hoàn thành');
  });
  await T('7. So phiên bản (ETag): bản ghi bị đổi xen giữa lúc đọc và ghi → máy chủ trả 412, tự đọc lại, KHÔNG ghi đè dữ liệu của người khác',async()=>{
    await mk(a,'V52-7',['keo_tinh'],{quantity:10}); await sleep(50); const before=server.conflicts; const orig=a.w.fetch; let hit=0;
    a.w.fetch=(url,init)=>{ if(init&&init.method==='PUT'&&!hit++){ const cur=JSON.parse(server.getPath('/orders/V52-7').d); server.patch({'orders/V52-7':{d:JSON.stringify(Object.assign({},cur,{noteKhac:'người khác ghi xen'})),t:1}}); } return orig(url,init); };
    const r=await a.A(`return await window.__db.casDoc("orders","V52-7",async cur=>Object.assign({},cur,{noteMinh:"ghi sau cùng"}))`); a.w.fetch=orig;
    ok(r.committed&&r.retries===1,'phải thử lại đúng 1 lần: '+JSON.stringify(r)); eq(server.conflicts,before+1);
    const o=JSON.parse(server.getPath('/orders/V52-7').d); eq(o.noteKhac,'người khác ghi xen'); eq(o.noteMinh,'ghi sau cùng');
  });
  await T('8. Hoàn thành thiếu số lượng: bắt buộc lý do ≥5 ký tự; có lý do thì hoàn thành và đánh dấu completedShort',async()=>{
    await ready(a,'V52-8','KTI-04',100,60); await rej(a.A(`await amgFlowCompleteOrder({orderId:"V52-8"})`),'chưa đủ số lượng'); await rej(a.A(`await amgFlowCompleteOrder({orderId:"V52-8",reason:"abc"})`),'chưa đủ');
    eq((await a.get('orders','V52-8')).status!=='completed',true);
    await a.A(`await amgFlowCompleteOrder({orderId:"V52-8",reason:"Khách đồng ý nhận 60"})`); const o=await a.get('orders','V52-8'); eq(o.status,'completed'); eq(o.completedShort,true); eq(o.completionNote,'Khách đồng ý nhận 60');
  });
  await T('9. Còn lệnh máy mở → không hoàn thành; đơn chưa đủ công đoạn → không hoàn thành',async()=>{
    await mk(a,'V52-9',['keo_tinh'],{quantity:50}); await a.A(`await amgFlowAssign({runId:"R-9",orderId:"V52-9",machineId:"KTI-05",stageKey:"keo_tinh",plannedQuantity:50,shift:"Ca Ngày",operator:"NV",startNow:true})`);
    await rej(a.A(`await amgFlowCompleteOrder({orderId:"V52-9",reason:"abcdefg"})`),'lệnh'); await a.A(`await amgFlowFinishRun({runId:"R-9"})`);
    await rej(a.A(`await amgFlowCompleteOrder({orderId:"V52-9",reason:"abcdefg"})`),'công đoạn bắt buộc'); eq((await a.get('orders','V52-9')).status!=='completed',true);
  });
  await T('10. Phân quyền ở tầng nghiệp vụ: nhân viên/QC/kho KHÔNG hoàn thành được; quản đốc và admin được',async()=>{
    await ready(a,'V52-10','KTI-06',100,100); for(const role of ['employee','qc','warehouse','kho']){ a.as(role,'X'); await rej(a.A(`await amgFlowCompleteOrder({orderId:"V52-10"})`),'không có quyền'); }
    eq((await a.get('orders','V52-10')).status!=='completed',true); a.as('manager','QĐ'); await a.A(`await amgFlowCompleteOrder({orderId:"V52-10"})`); eq((await a.get('orders','V52-10')).status,'completed'); a.as('admin','Quản trị');
  });
  await T('11. Mở lại đơn: bắt buộc lý do, giữ nguyên lịch sử; hai thiết bị cùng mở lại → chỉ một bên thành công',async()=>{
    await rej(a.A(`await amgFlowReopenOrder({orderId:"V52-1",reason:"ab"})`),'lý do');
    await until(async()=>(await b.get('orders','V52-1')).status==='completed',2000,'B chưa đồng bộ');
    const rs=await Promise.allSettled([a.A(`return await amgFlowReopenOrder({orderId:"V52-1",reason:"Khách đặt thêm hàng"})`),b.A(`return await amgFlowReopenOrder({orderId:"V52-1",reason:"Khách đặt thêm hàng"})`)]);
    eq(rs.filter(x=>x.status==='fulfilled').length,1,'số bên mở lại thành công'); const o=await a.get('orders','V52-1'); eq(o.status,'reopened'); eq(o.statusHistory.map(h=>h.action),['complete','reopen']);
    ok((await a.list('productionRuns')).some(r=>r.orderId==='V52-1'),'lệnh phải còn nguyên'); eq(a.R(`amgIsActiveOrder(${JSON.stringify(o)})`),true);
  });
  await T('12. Mất mạng: hoàn thành báo lỗi rõ ràng, KHÔNG đổi trạng thái đơn, KHÔNG tạo trạng thái treo; có mạng lại thì làm được',async()=>{
    await ready(a,'V52-12','KTI-07',100,100); a.w.__net.online=false;
    const e=await rej(a.A(`await amgFlowCompleteOrder({orderId:"V52-12"})`),'mạng'); a.w.__net.online=true;
    eq((server.getPath('/orders/V52-12')&&JSON.parse(server.getPath('/orders/V52-12').d).status)!=='completed',true);
    await a.A(`await amgFlowCompleteOrder({orderId:"V52-12"})`); eq((await a.get('orders','V52-12')).status,'completed');
  });
  await T('13. Dữ liệu cũ (v51): đơn đã completed kiểu cũ (không có completionSource/machines) vẫn đọc đúng và không bị ghi đè khi bấm lại',async()=>{
    server.patch({'orders/OLD-51':{d:JSON.stringify({id:'OLD-51',customer:'KH cũ',spec:'0.2',quantity:10,status:'completed',completedAt:'2026-09-01T03:00:00.000Z',completedBy:'QĐ cũ',completionMode:'manual',completionSummary:{finished:10,qty:10,unit:'kg',short:false,route:['keo_tinh']},stageComplete:{keo_tinh:{at:'x'}},stages:{}}),t:1}});
    await until(async()=>(await a.get('orders','OLD-51'))&&1,2000); const r=await a.A(`return await amgFlowCompleteOrder({orderId:"OLD-51"})`); ok(r.duplicate);
    const o=await a.get('orders','OLD-51'); eq(o.completedBy,'QĐ cũ'); eq(o.completedAt,'2026-09-01T03:00:00.000Z'); eq(a.R(`amgIsActiveOrder(${JSON.stringify(o)})`),false);
  });
  await T('14. Điều hành: không có dữ liệu → mọi chỉ số bằng 0, danh sách rỗng (không số mẫu)',async()=>{
    const r=await a.J(`const L=amgComputeOpsLive({orders:[],machines:[],runs:[],entries:[],extra:{},now:Date.now()});return {k:L.kpi,cards:L.cards.length,rows:L.orderRows.length,al:L.alerts.length,out:L.outputToday,pl:L.planned}`);
    eq(r.cards,0); eq(r.rows,0); eq(r.al,0); eq(r.out,{}); eq(r.pl,{}); ok(Object.values(r.k).every(v=>v===0),'KPI khác 0: '+JSON.stringify(r.k)); });
  await T('15. Điều hành: sản lượng cộng THEO ĐƠN VỊ (kg không cộng lẫn m), lượt đã hủy không tính, lượt hôm qua không tính vào "hôm nay"',async()=>{
    const r=await a.J(`const now=new Date("2026-11-25T10:00:00").getTime();
      const L=amgComputeOpsLive({orders:[],machines:[],runs:[],now,entries:[{qty:10,unit:"kg",enteredAt:"2026-11-25T08:00:00"},{qty:5,unit:"m",enteredAt:"2026-11-25T09:00:00"},{qty:7,unit:"kg",enteredAt:"2026-11-25T09:30:00",voided:true},{qty:99,unit:"kg",enteredAt:"2026-11-24T23:59:00"}]});return L.outputToday`);
    eq(r,{kg:10,m:5}); });
  await T('16. Điều hành: các luật cảnh báo (chưa ghi SL sau ≥2h, tạm dừng ≥60 phút, lệnh mở >24h, máy hỏng, đơn quá hạn, NG chưa đóng)',async()=>{
    const r=await a.J(`const now=new Date("2026-11-25T12:00:00").getTime(), iso=ms=>new Date(ms).toISOString();
      const mkO=(id,extra)=>Object.assign(normalizeOrderStages({id,customer:"K",spec:"s",quantity:100,orderDate:"2026-11-01",deliveryDate:"2026-12-30",stages:(()=>{const o={};STAGES.forEach(s=>o[s.key]={done:0,remain:0});return o})(),routing:["keo_tinh"],routingConfirmed:true}),extra||{});
      const orders=[mkO("A1"),mkO("A2",{deliveryDate:"2026-11-20"})];
      const run=(id,m,st,extra)=>Object.assign({id,orderId:"A1",machineId:m,stageKey:"keo_tinh",productionStatus:st,plannedQuantity:100,producedQuantity:0,unit:"kg",assignedAt:iso(now-3*3600000),startedAt:iso(now-3*3600000),pauses:[]},extra||{});
      const runs=[run("R-low","KTI-01","running"),run("R-pause","KTI-02","paused",{pauses:[{at:iso(now-90*60000),reason:"x"}]}),run("R-old","KTI-03","running",{startedAt:iso(now-30*3600000),assignedAt:iso(now-30*3600000),producedQuantity:5})];
      const machines=[{id:"KTI-01",typeKey:"keo_tinh",status:"running"},{id:"KTI-02",typeKey:"keo_tinh",status:"running"},{id:"KTI-03",typeKey:"keo_tinh",status:"running"},{id:"KTI-04",typeKey:"keo_tinh",status:"broken"}];
      const L=amgComputeOpsLive({orders,machines,runs,entries:[],now,extra:{ncr:[{id:"NCR-1",status:"mo"}],inspections:[{id:"KT-1",result:"ng",date:"2026-11-25"}]}});
      return L.alerts.map(x=>x.kind).sort()`);
    ['low_output','machine_down','paused_long','quality','run_open_long'].forEach(k=>ok(r.includes(k),'thiếu cảnh báo '+k+' trong '+JSON.stringify(r))); });
  await T('17. Tìm kiếm: chỉ mục chịu dữ liệu thật (quy cách là SỐ, thiếu trường, null) và bỏ dấu tiếng Việt',async()=>{
    const r=await a.J(`const idx=amgBuildSearchIndex({orders:[{id:"S1",customer:null,spec:0.254,materialCode:5,quantity:1},{id:"S2",spec:undefined}],machines:[{id:"M1"}],staff:[{id:"N1",name:"Nguyễn Thị Hồng"}],extra:{documents:[{id:"D1"}]},allowedTabs:null});
      return {n:amgSearchRun(idx,"0.254").total,v:amgSearchRun(idx,"nguyen thi hong").total,none:amgSearchRun(idx,"").total}`);
    ok(r.n>=1&&r.v===1&&r.none===0,JSON.stringify(r)); });
  await T('18. Phân quyền ở tầng dữ liệu: nhân viên gọi THẲNG casDoc (bỏ qua giao diện) vẫn bị từ chối; bản ghi không đổi; có nhật ký từ chối',async()=>{
    a.as('employee','NV thử'); const before=JSON.stringify(server.getPath('/users/admin')); const denyBefore=(await a.list('auditLog')).filter(x=>x.type==='permission_denied').length;
    await rej(a.A(`await window.__db.casDoc("users","admin",async cur=>Object.assign({},cur,{role:"employee"}))`),'không có quyền');
    eq(JSON.stringify(server.getPath('/users/admin')),before,'bản ghi bị đổi');
    await until(async()=>(await a.list('auditLog')).filter(x=>x.type==='permission_denied').length>denyBefore,2000,'thiếu nhật ký từ chối');
    const viaSet=await a.J(`return amgCheckWrite(window.__AMG_USER,"orders","set","V52-7",{note:"x"}).ok`);
    const viaCas=await a.A(`try{await window.__db.casDoc("orders","V52-7",async cur=>Object.assign({},cur,{note:"nv ghi"}));return true;}catch(e){return false;}`);
    eq(viaCas,viaSet,'casDoc phải cho kết quả quyền giống set()'); a.as('admin','Quản trị'); });
  await T('19. Máy chủ KHÔNG công khai ETag (CORS): hoàn thành/mở lại đơn vẫn chạy bằng đường giao dịch dự phòng, không treo, không hỏng dữ liệu',async()=>{
    server.hideEtag=true; await a.R('window.__amgNoCas=false');
    await ready(a,'V52-19','KTI-08',100,100); const r=await a.A(`return await amgFlowCompleteOrder({orderId:"V52-19"})`); ok(!r.duplicate,'phải hoàn thành');
    const o=await a.get('orders','V52-19'); eq(o.status,'completed'); eq(o.statusHistory.length,1); eq(await a.R('window.__amgNoCas'),true,'phải nhớ trạng thái không có ETag');
    await a.A(`await amgFlowReopenOrder({orderId:"V52-19",reason:"mở lại thử"})`); eq((await a.get('orders','V52-19')).status,'reopened'); server.hideEtag=false; await a.R('window.__amgNoCas=false'); });
  console.log(out.join('\n')); console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})();
