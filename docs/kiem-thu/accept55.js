/* v55 — Nghiệm thu tab THEO DÕI THỜI GIAN DỪNG MÁY (đồng bộ từ Kế hoạch sản xuất).
   Chạy: NM=<node_modules> APP_DIR=../.. node accept55.js */
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
  const mk=(d,id,extra={})=>d.A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});
    const o=normalizeOrderStages(Object.assign({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:100,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra)}));
    await db.collection(FS.orders).doc(o.id).set(o);`);
  const ev=async d=>{ const [runs,machines,orders,ledger]=await Promise.all(['productionRuns','machines','orders','downtimeEvents'].map(c=>d.list(c)));
    d.w.__X={runs,machines,orders,ledger}; return d.J(`const X=window.__X;return amgDtBuildEvents({runs:X.runs,machines:X.machines,orders:X.orders,ledger:X.ledger,nowMs:Date.now()})`); };
  await until(async()=>(await b.list('machines')).length>100,3000,'B chưa thấy máy');

  await mk(a,'DM-1'); 
  await a.A(`await amgFlowAssign({runId:"RUN-T1",orderId:"DM-1",machineId:"KTI-01",stageKey:"keo_tinh",plannedQuantity:100,shift:"Ca Đêm",operator:"NV A",startNow:true});`);

  await a.A(`await db.collection("productionRuns").doc("RUN-T1").set({startedAt:new Date(Date.now()-3*3600000).toISOString()},{merge:true})`);
  await T('1. Tạm dừng ở Kế hoạch → sổ lịch sử có mã sự kiện duy nhất + người tạo, cùng giao dịch',async()=>{
    await a.A(`await amgFlowPause("RUN-T1","Hỏng motor kéo")`);
    const l=await a.get('downtimeEvents','DM-T1-1'); ok(l,'thiếu sổ'); eq(l.status,'active'); eq(l.createdBy,'Quản trị'); eq(l.runId,'RUN-T1'); eq(l.revisions[0].action,'create'); eq(l.reason,'Hỏng motor kéo');
  });
  await T('2. Tab Theo dõi tự có sự kiện (không nhập lại): đủ máy/đơn/ca/nguyên nhân/phân loại, đang mở',async()=>{
    const e=await ev(a); eq(e.length,1); const x=e[0];
    eq(x.id,'DM-T1-1'); eq(x.state,'open'); eq(x.machineId,'KTI-01'); eq(x.shiftKey,'dem'); eq(x.orderLabel,'KH-DM-1 · 0.254BC'); eq(x.cat.key,'equipment'); eq(x.cat.cls,'breakdown'); eq(x.reason,'Hỏng motor kéo'); eq(x.recordedBy,'Quản trị'); eq(x.source,'plan');
  });
  await T('3. Bấm Tạm dừng lại / dựng lại nhiều lần KHÔNG tạo bản ghi trùng',async()=>{
    await a.A(`await amgFlowPause("RUN-T1","Hỏng motor kéo")`);
    eq((await ev(a)).length,1); eq((await a.list('downtimeEvents')).length,1);
  });
  await T('4. Đồng bộ realtime sang thiết bị khác (B thấy sự kiện + sổ lịch sử ngay)',async()=>{
    await until(async()=>(await ev(b)).length===1&&(await b.list('downtimeEvents')).length===1,2500,'B không thấy');
  });
  await T('5. Tiếp tục chạy → sự kiện đóng, có người xác nhận, thời lượng, sổ ghi bản resume',async()=>{
    await sleep(30); await a.A(`await amgFlowResume("RUN-T1")`);
    const x=(await ev(a))[0]; eq(x.state,'closed'); eq(x.confirmedBy,'Quản trị'); ok(x.durMs>=0&&x.endMs); const l=await a.get('downtimeEvents','DM-T1-1'); eq(l.revisions.map(r=>r.action),['create','resume']); eq(l.revisions.length,2);
  });
  await T('6. Sửa nguyên nhân + thời gian tại Kế hoạch → tab theo dõi đổi theo, lưu trước/sau, phân loại lại, KHÔNG sửa chữ gốc ngoài ý người sửa',async()=>{
    const before=await a.get('productionRuns','RUN-T1'); const s=Date.parse(before.pauses[0].at);
    const oldDur=(await ev(a))[0].durMs;
    await a.A(`await amgFlowEditPause("RUN-T1",0,{reason:"Chờ nguyên liệu dây đồng",startAt:new Date(${s}-1200000).toISOString()},"ghi nhầm nguyên nhân")`);
    const x=(await ev(a))[0]; eq(x.reason,'Chờ nguyên liệu dây đồng'); eq(x.cat.key,'material'); eq(x.durMs,oldDur+1200000); ok(x.edited);
    const l=await a.get('downtimeEvents','DM-T1-1'); const r=l.revisions[l.revisions.length-1]; eq(r.action,'edit'); eq(r.before.reason,'Hỏng motor kéo'); eq(r.after.reason,'Chờ nguyên liệu dây đồng'); eq(r.by,'Quản trị'); ok(l.updatedAt);
  });
  await T('7. Sửa sai bị chặn: thiếu lý do, kết thúc trước bắt đầu, trước giờ chạy lệnh',async()=>{
    const p=(await a.get('productionRuns','RUN-T1')).pauses[0];
    await rej(a.A(`await amgFlowEditPause("RUN-T1",0,{reason:"abc xyz"},"")`),'lý do');
    await rej(a.A(`await amgFlowEditPause("RUN-T1",0,{endAt:"${new Date(Date.parse(p.at)-1000).toISOString()}"},"thử")`),'sau thời điểm bắt đầu');
    await rej(a.A(`await amgFlowEditPause("RUN-T1",0,{startAt:"2020-01-01T00:00:00.000Z"},"thử")`),'trước lúc lệnh');
  });
  await T('8. Hai lần dừng liên tiếp: lần 2 đang mở không được hủy; không chồng thời gian',async()=>{
    await a.A(`await amgFlowPause("RUN-T1","Mất điện toàn xưởng")`);
    eq((await ev(a)).length,2); await rej(a.A(`await amgFlowCancelPause("RUN-T1",1,"nhầm")`),'đang mở');
    await a.A(`await amgFlowResume("RUN-T1")`);
  });
  await T('9. Hủy lần dừng (soft) → bị loại khỏi KPI & thời gian dừng lệnh, vẫn truy xuất được kèm lý do',async()=>{
    const tBefore=await a.J(`const r=(await db.collection("productionRuns").doc("RUN-T1").get()).data();return amgRunTiming(r,Date.now()).pauseCount`); eq(tBefore,2);
    await a.A(`await amgFlowCancelPause("RUN-T1",1,"bấm nhầm")`);
    const all=await ev(a); const c=all.find(e=>e.id==='DM-T1-2'); eq(c.state,'cancelled'); eq(c.countable,false); eq(c.cancelReason,'bấm nhầm');
    eq(await a.J(`const r=(await db.collection("productionRuns").doc("RUN-T1").get()).data();return amgRunTiming(r,Date.now()).pauseCount`),1);
    const l=await a.get('downtimeEvents','DM-T1-2'); eq(l.status,'cancelled'); eq(l.cancelReason,'bấm nhầm');
    a.w.__X.all=all; eq(a.R(`amgDtFilter(window.__X.all,{}).length`),1,'ẩn mặc định'); eq(a.R(`amgDtFilter(window.__X.all,{showInactive:true}).length`),2);
  });
  await T('10. Kết thúc lệnh khi đang dừng → sự kiện tự đóng, ghi sổ "close"',async()=>{
    await a.A(`await amgFlowPause("RUN-T1","Thiếu nhân lực ca đêm")`);
    await a.A(`await amgFlowFinishRun({runId:"RUN-T1",completeStage:false})`);
    const x=(await ev(a)).find(e=>e.id==='DM-T1-3'); eq(x.state,'closed'); ok(x.closedByFinish); eq(x.cat.key,'manpower');
    eq((await a.get('downtimeEvents','DM-T1-3')).revisions.map(r=>r.action),['create','close']);
  });
  await T('11. Xóa đơn (Admin) → lệnh mất nhưng lịch sử dừng máy còn, đánh dấu "nguồn đã xóa", không tính KPI',async()=>{
    await a.A(`await amgFlowForceDeleteOrder({orderId:"DM-1",reason:"đơn nhập sai",allRuns:[]})`);
    eq((await a.list('productionRuns')).length,0);
    const all=await ev(a); eq(all.length,3); ok(all.every(e=>e.state==='removed'&&!e.countable),'phải removed'); ok(all[0].orderLabel.includes('KH-DM-1'),'giữ nhãn đơn: '+all[0].orderLabel);
    const l=await a.get('downtimeEvents','DM-T1-1'); eq(l.status,'cancelled'); eq(l.revisions[l.revisions.length-1].action,'removed');
  });

  /* ---- Phân loại ---- */
  await T('12. Phân loại nguyên nhân (có/không dấu), không đổi chữ gốc; không có chữ → "Nguyên nhân khác"',async()=>{
    const c=s=>a.R(`amgDtClassify(${JSON.stringify(s)}).key`);
    eq([c('Hỏng motor'),c('mat dien'),c('Chờ khuôn'),c('Chờ nguyên liệu'),c('Chờ lệnh sản xuất'),c('Chuyển đổi quy cách'),c('Bảo trì định kỳ'),c('Thiếu nhân lực'),c('Ăn cơm'),c('')],
       ['equipment','power','mold','material','order','changeover','maintenance','manpower','other','other']);
    eq(a.R(`amgDtClassify("Bảo trì","broken").by`),'reason'); eq(a.R(`amgDtClassify("","broken").key`),'equipment'); eq(a.R(`amgDtClassify("Hỏng motor").cls`),'breakdown'); eq(a.R(`amgDtClassify("Chuyển đổi quy cách").cls`),'planned');
  });

  /* ---- Tính toán KPI / OEE trên dữ liệu tổng hợp (thuần hàm) ---- */
  const H=3600000, t0=Date.parse('2026-11-10T00:00:00'); const iso=ms=>new Date(ms).toISOString();
  const runs=[
    {id:'RUN-A',orderId:'O1',machineId:'KT-01',stageKey:'keo_tinh',shift:'Ca Ngày',productionStatus:'completed',startedAt:iso(t0),endedAt:iso(t0+10*H),pauses:[
      {at:iso(t0+1*H),resumedAt:iso(t0+1.5*H),reason:'Hỏng motor',by:'NV1',resumedBy:'NV2'},
      {at:iso(t0+3*H),resumedAt:iso(t0+3.25*H),reason:'Hỏng motor',by:'NV1'},
      {at:iso(t0+5*H),resumedAt:iso(t0+5.5*H),reason:'Hỏng motor',by:'NV1'},
      {at:iso(t0+7*H),resumedAt:iso(t0+7.5*H),reason:'Chuyển đổi quy cách',by:'NV1'},
      {at:iso(t0+8*H),resumedAt:iso(t0+8.5*H),reason:'Sai nhưng đã hủy',by:'NV1',cancelled:true}]},
    {id:'RUN-B',orderId:'O1',machineId:'KT-02',stageKey:'keo_tinh',shift:'Ca Đêm',productionStatus:'completed',startedAt:iso(t0+12*H),endedAt:iso(t0+20*H),pauses:[{at:iso(t0+13*H),resumedAt:iso(t0+14*H),reason:'Chờ nguyên liệu',by:'NV3'}]}];
  const machines=[{id:'KT-01',typeLabel:'Kéo',downtimeLog:[{id:'X1',status:'broken',startTime:iso(t0+1.25*H),endTime:iso(t0+1.5*H),reason:'',recordedBy:'Admin'},{id:'X2',status:'idle',startTime:iso(t0+2*H),endTime:iso(t0+2.5*H),reason:'',recordedBy:'Admin'}]},{id:'KT-02',typeLabel:'Kéo'},{id:'KT-03',typeLabel:'Kéo'}];
  a.w.__S={runs,machines,orders:[{id:'O1',customer:'KH',spec:'0.2'}],ledger:[],now:t0+30*H};
  const ex=c=>a.J(c);
  await T('13. Dựng sự kiện từ 2 nguồn; Thẻ máy trùng thời gian bị trừ, trạng thái "Tạm nghỉ" không tính; lần dừng hủy loại',async()=>{
    const e=await ex(`const S=window.__S;return amgDtBuildEvents({runs:S.runs,machines:S.machines,orders:S.orders,ledger:S.ledger,nowMs:S.now}).map(x=>({id:x.id,c:x.countable,eff:x.effMs,s:x.state,src:x.source}))`);
    eq(e.filter(x=>x.src==='plan').length,6); const m1=e.find(x=>x.id==='DM-M-X1'); eq(m1.c,false,'X1 nằm trọn trong tạm dừng lệnh'); eq(m1.eff,0); eq(e.find(x=>x.id==='DM-M-X2').c,false); eq(e.find(x=>x.id==='DM-A-5').c,false,'đã hủy'); eq(e.find(x=>x.id==='DM-A-4').c,true);
  });
  await T('14. KPI: tổng/số lần/số máy/TB/máy cao nhất — đúng số học',async()=>{
    const r=await ex(`const S=window.__S;const all=amgDtBuildEvents({runs:S.runs,machines:S.machines,orders:S.orders,ledger:[],nowMs:S.now});const rows=amgDtFilter(all,{});const an=amgDtAnalyze(rows,S.runs,{},S.now);
      return {total:an.total,count:an.count,mach:an.machinesAffected,avg:an.avgMs,top:an.topMachine.id,rate:an.runRatePct,sched:an.schedMs,shifts:an.shifts.map(s=>[s.name,s.n,s.ms]),cls:an.classes.map(c=>[c.key,c.n]).sort(),mttr:an.rel.mttrMs,mtbf:an.rel.mtbfMs,oee:an.rel.oee}`);
    // KT-01: 30+15+30(sự cố) +30(chuyển đổi)=105 phút ; KT-02: 60 phút
    eq(r.total,165*60000); eq(r.count,5); eq(r.mach,2); eq(r.avg,33*60000); eq(r.top,'KT-01');
    eq(r.sched,18*H); eq(r.rate,Math.round((18*H-165*60000)/(18*H)*1000)/10);
    eq(r.shifts[0].slice(1),[4,105*60000]); eq(r.shifts[1].slice(1),[1,60*60000]);
    eq(r.mttr,25*60000,'MTTR = (30+15+30)/3'); eq(r.mtbf,(18*H-165*60000)/3,'MTBF = TG vận hành / số sự cố'); eq(r.oee,null,'OEE không suy diễn');
  });
  await T('15. Thiếu dữ liệu → "chưa đủ dữ liệu", không tự suy diễn (không có lệnh chạy / không có sự cố)',async()=>{
    const r=await ex(`const S=window.__S;const H=3600000;const rel1=amgDtReliability([],{});const ev=amgDtBuildEvents({runs:[{id:'RUN-Z',machineId:'KT-09',stageKey:'x',orderId:'',productionStatus:'paused',pauses:[{at:new Date(${t0}).toISOString(),reason:'Mất điện'}]}],machines:[],orders:[],ledger:[],nowMs:${t0}+H});const an=amgDtAnalyze(ev,[{id:'RUN-Z',machineId:'KT-09'}],{},${t0}+H);
      return {rel1,an:{rate:an.runRatePct,mtbf:an.rel.mtbfMs,mttr:an.rel.mttrMs,why:an.rel.mtbfWhy,open:an.openCount,total:an.total}}`);
    eq(r.rel1.mttrMs,null); eq(r.rel1.mtbfMs,null); ok(r.rel1.mtbfWhy&&r.rel1.mttrWhy&&r.rel1.oeeWhy); eq(r.an.rate,null); eq(r.an.mtbf,null); eq(r.an.open,1); eq(r.an.total,H,'lần dừng đang mở tính đến hiện tại');
  });
  await T('16. Bộ lọc theo ca/nguyên nhân/máy/ngày/tìm kiếm; trend & top5 theo bộ lọc',async()=>{
    const r=await ex(`const S=window.__S;const all=amgDtBuildEvents({runs:S.runs,machines:S.machines,orders:S.orders,ledger:[],nowMs:S.now});const n=f=>amgDtFilter(all,f).length;
      return [n({shift:'dem'}),n({cat:'equipment'}),n({machineId:'KT-02'}),n({from:'2026-11-10',to:'2026-11-10'}),n({from:'2026-11-11'}),n({q:'chờ nguyen lieu'}),n({cls:'planned'}),n({q:'khong-co'})]`);
    eq(r,[1,3,1,5,0,1,1,0]);
  });
  await T('17. Cảnh báo: vượt ngưỡng/lần, nhiều lần/ngày, lặp nguyên nhân, hiệu suất thấp — theo ngưỡng từng máy',async()=>{
    const r=await ex(`const S=window.__S;const all=amgDtBuildEvents({runs:S.runs,machines:[],orders:S.orders,ledger:[],nowMs:S.now});
      const set={defaults:{maxEventMin:20,maxEventsPerDay:4,repeatCount:3,minAvailabilityPct:95},machines:{'KT-02':{maxEventMin:0,minAvailabilityPct:50}}};
      const al=amgDtAlerts(all,S.runs,{from:'2026-11-10',to:'2026-11-11'},set,S.now);return {kinds:al.list.map(x=>x.kind+':'+x.machineId).sort(),low:Object.keys(al.lowPerf)}`);
    ok(r.kinds.includes('over:KT-01')&&!r.kinds.includes('over:KT-02'),'ngưỡng riêng máy 02 tắt');
    ok(r.kinds.includes('multi:KT-01'),'4 lần/ngày'); ok(r.kinds.includes('repeat:KT-01')); eq(r.low,['KT-01']);
  });
  await T('18. Báo cáo Excel/PDF: bảng đủ 7 loại, số khớp KPI',async()=>{
    const r=await ex(`const S=window.__S;const all=amgDtBuildEvents({runs:S.runs,machines:S.machines,orders:S.orders,ledger:[],nowMs:S.now});const rows=amgDtFilter(all,{});const an=amgDtAnalyze(rows,S.runs,{},S.now);
      return AMG_DT_REPORTS.map(d=>{const t=amgDtReportTable(d.key,an,rows);return [d.key,t.head.length,t.rows.length,t.rows.every(x=>x.length===t.head.length)]})`);
    eq(r.map(x=>x[0]),['day','machine','shift','cause','top','rel','detail']); ok(r.every(x=>x[3]&&x[2]>=1),JSON.stringify(r));
  });

  /* ---- Quyền ---- */
  await T('19. Phân quyền: nhân viên không xóa sổ lịch sử, không đặt ngưỡng; Admin/Quản đốc đặt được ngưỡng',async()=>{
    a.as('employee','NV'); eq(a.R(`amgCheckWrite(window.__AMG_USER,"downtimeEvents","delete","x").ok`),false); eq(a.R(`amgCheckWrite(window.__AMG_USER,"downtimeSettings","set","thresholds").ok`),false);
    await rej(a.A(`await amgDtSaveSettings({defaults:{maxEventMin:5},machines:{}})`),'Chỉ Quản trị');
    a.as('manager','Quản đốc'); await a.A(`await amgDtSaveSettings({defaults:{maxEventMin:45},machines:{"KT-01":{maxEventMin:20}}})`);
    eq(a.R(`amgDtThreshold(${JSON.stringify(await a.get('downtimeSettings','thresholds'))},"KT-01").maxEventMin`),20); eq(a.R(`amgDtThreshold(${JSON.stringify(await a.get('downtimeSettings','thresholds'))},"KT-05").maxEventMin`),45);
    a.as('admin','Quản trị');
  });

  /* ---- Giao diện ---- */
  await T('20. Giao diện: render trang, mở chi tiết sự kiện, chế độ TV, không lỗi, không có ô nhập dữ liệu gốc',async()=>{
    const errs=[]; a.w.console.error=(...x)=>errs.push(x.join(' ').slice(0,200));
    a.w.__P={runs,machines,orders:[{id:'O1',customer:'KH-O1',spec:'0.2'}]};
    a.R(`(()=>{const P=window.__P;const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;
      window.__root.render(React.createElement(DialogProvider,null,React.createElement(DowntimeMesPage,{machines:P.machines,orders:P.orders,runs:P.runs,ledger:[],settings:null,ledgerError:"",currentUser:{username:"admin",role:"admin",fullName:"Q"},isAdmin:true,loaded:true,flowError:"",onNavigateFocus(){},onUpdateLegacy(){},onDeleteLegacy(){}})));})()`);
    await sleep(200); const root=a.w.__rootEl;
    // kỳ mặc định = tháng hiện tại → chọn "Tất cả" để thấy dữ liệu mẫu tháng 11/2026
    const btn=[...root.querySelectorAll('button')].find(x=>x.textContent==='Tất cả'); btn.click(); await sleep(150);
    let h=root.textContent; ok(h.includes('Theo dõi thời gian dừng máy')&&h.includes('DM-A-1')&&h.includes('Tổng thời gian dừng')&&h.includes('Top 5 máy'),'thiếu nội dung');
    ok(!root.querySelector('textarea')&&!h.includes('Ghi nhận thời gian dừng máy'),'không được có form nhập tay');
    [...root.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('DM-A-1')).click(); await sleep(100);
    ok(a.w.document.body.textContent.includes('TRUY XUẤT NGUỒN')&&a.w.document.body.textContent.includes('Mở lệnh máy gốc'),'hộp chi tiết');
    [...a.w.document.querySelectorAll('button')].filter(x=>x.textContent==='Đóng').pop().click(); await sleep(60);
    [...root.querySelectorAll('button')].find(x=>x.textContent==='Chế độ TV').click(); await sleep(100); ok(root.textContent.includes('Thoát chế độ TV'));
    eq(errs.filter(x=>!/type is invalid/.test(x)),[],'lỗi console: '+errs[0]);
    a.R('window.__root.unmount()');
  });
  await T('21. Không phá luồng cũ: tạm dừng/tiếp tục/kết thúc lệnh vẫn đúng thời gian thực tế; đồng hồ bỏ qua lần dừng đã hủy',async()=>{
    const r=a.R(`amgRunTiming({startedAt:${JSON.stringify(iso(t0))},endedAt:${JSON.stringify(iso(t0+10*H))},productionStatus:'completed',pauses:${JSON.stringify(runs[0].pauses)}},${t0}+20*3600000)`);
    eq(r.pausedMs,105*60000); eq(r.pauseCount,4);
  });

  console.log(out.join('\n')); console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})();
