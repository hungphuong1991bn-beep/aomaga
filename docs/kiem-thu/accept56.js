/* v56 — Nghiệm thu TRUNG TÂM ĐIỀU HÀNH SẢN XUẤT (tab Kế hoạch sản xuất → Giám sát máy móc).
   Dữ liệu dựng bằng chính các hàm nghiệp vụ thật (phân lệnh, bắt đầu, tạm dừng, ghi sản lượng, kết thúc) trên RTDB giả lập,
   rồi vẽ giao diện thật bằng React + jsdom và thao tác như người dùng (bấm nhóm, gõ tìm kiếm, bấm lọc, bấm nút điều hành).
   Chạy: NM=<node_modules> APP_DIR=../.. node accept56.js */
const {load}=require('./harness'); const rt=require('./fakertdb');
const server=rt.makeServer();
const t=load({server}); const w=t.w;
const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
const J=async c=>JSON.parse(await A('return JSON.stringify(await (async()=>{'+c+'})())'));
const list=async col=>J(`const s=await db.collection("${col}").get();return s.docs.map(d=>Object.assign({id:d.id},d.data()))`);
let pass=0,fail=0;const out=[];
const cleanup=()=>{ try{ R('if(window.__root){try{window.__root.unmount()}catch(e){} window.__rootEl.remove();window.__root=null}'); }catch(e){} };
async function T(n,f){try{await f();pass++;out.push('PASS '+n);}catch(e){fail++;out.push('FAIL '+n+' :: '+(e&&e.message||e));} cleanup(); R('localStorage.removeItem("amg_cc_view");localStorage.removeItem("amg_cc_group")'); }
const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a));};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert');};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000,msg='timeout'){const t0=Date.now();for(;;){try{if(await fn())return;}catch(e){}if(Date.now()-t0>ms)throw new Error(msg);await sleep(20);}}
const errs=[]; w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=el=>{ if(!el) throw new Error('không tìm thấy phần tử để bấm'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); };
const typeIn=(el,v)=>{ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(el,v); el.dispatchEvent(new w.Event('input',{bubbles:true})); };
const CAN="{plan:true,output:true,manager:true,editMachines:true}";
const cc=(extra)=>`React.createElement(CommandCenter,Object.assign({machines:X.machines,runs:X.runs,orders:X.orders,can:${CAN},openModal:m=>window.__modals.push(m),act:(f,msg)=>window.__acts.push(msg),onTv:g=>{window.__tv=g}},${extra||'{}'}))`;
function mount(expr){ R(`(()=>{const X=window.__X;const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;window.__root.render(React.createElement(DialogProvider,null,${expr}));})()`); }
function unmount(){ cleanup(); }
const tiles=()=>$$('.cc-tile'), rows=()=>$$('.cc-row:not(.cc-row--h)');
const items=()=>$$('[data-machine]');
async function refresh(){ const [machines,runs,orders]=await Promise.all([list('machines'),list('productionRuns'),list('orders')]); w.__X={machines,runs,orders}; R('window.__X.runs=window.__X.runs.map(amgNormalizeRun)'); return w.__X; }

(async()=>{
  R('window.__AMG_USER={username:"admin",role:"admin",fullName:"Quản trị"}; window.__modals=[]; window.__acts=[];');
  await until(async()=>R('window.__rtdbStatus.state')==='online',2000,'không kết nối');
  await A(`const bt=db.batch();genMachineSeed().forEach(m=>bt.set(db.collection(FS.machines).doc(m.id),m));await bt.commit();`);
  const mk=(id,extra)=>A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});
    const o=normalizeOrderStages(Object.assign({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:1000,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra||{})}));
    await db.collection(FS.orders).doc(o.id).set(o);`);
  // ---- dữ liệu thật ----
  await mk('O1',{customer:"Công ty Điện Cáp Á Châu",spec:"0.254BC",quantity:1000,routing:["keo_tinh","keo_sieu_tinh","u_nhiet"]});
  await mk('O2',{customer:"Hoàng Gia",spec:"7/0.2TC",quantity:500,deliveryDate:"2026-11-01",routing:["keo_tinh","keo_sieu_tinh","ma_thiec","ben"]});
  await mk('O3',{customer:"Phú Thịnh",spec:"0.3BC",quantity:300,routing:["keo_tinh"]});
  await mk('O4',{customer:"Minh Anh",spec:"0.2BC",quantity:400,routing:["keo_tinh","keo_sieu_tinh"],stageComplete:{keo_tinh:true},stages:{keo_tinh:{done:400,remain:0}}});
  await mk('O5',{customer:"Bảo Long",spec:"0.18BC",quantity:100,routing:["keo_tinh"]});
  await mk('O7',{customer:"Đại Dương",spec:"7/0.2BC",quantity:200,routing:["ben"]});
  await mk('O6',{customer:"Chưa Xác Nhận",spec:"0.5",quantity:50,routing:undefined,routingConfirmed:false});
  await A(`await db.collection(FS.machines).doc("KTI-05").set({status:"broken",note:"Hỏng motor kéo"},{merge:true});
           await db.collection(FS.machines).doc("KTI-06").set({status:"maintenance",note:"Bảo dưỡng định kỳ"},{merge:true});`);
  const asg=(runId,orderId,machineId,stageKey,qty,op,startNow)=>A(`await amgFlowAssign({runId:"${runId}",orderId:"${orderId}",machineId:"${machineId}",stageKey:"${stageKey}",plannedQuantity:${qty},shift:"Ca Ngày",operator:"${op}",startNow:${startNow}});`);
  await asg('R1','O1','KTI-01','keo_tinh',600,'Nguyễn A',true);
  await A(`await amgFlowRecordOutput({clientKey:"k1",runId:"R1",orderId:"O1",machineId:"KTI-01",stageKey:"keo_tinh",qty:250});`);
  await asg('R2','O1','KST-01','keo_sieu_tinh',200,'Trần B',false);
  await asg('R3','O2','KTI-02','keo_tinh',500,'Lê C',true);
  await A(`await amgFlowPause("R3","Hỏng motor kéo");`);
  await asg('R5','O5','KTI-04','keo_tinh',100,'Phạm D',true);
  await A(`await amgFlowRecordOutput({clientKey:"k5",runId:"R5",orderId:"O5",machineId:"KTI-04",stageKey:"keo_tinh",qty:50});`);
  await A(`await amgFlowFinishRun({runId:"R5",completeStage:false,note:"dừng sớm"});`);
  await asg('R7','O7','B400-01','ben',200,'Võ E',true);
  await refresh();
  await sleep(800); // đợi ứng dụng gieo xong dữ liệu mặc định của chính nó
  const before=JSON.stringify(w.__db.__store);

  /* ===== A. Logic thuần ===== */
  await T('1. Đúng 10 nhóm theo MACHINE_TYPES, kể cả Máy sang lô; tổng máy trong nhóm = tổng máy trong danh mục',async()=>{
    const g=await J(`return amgCcGroups(window.__X.machines).map(x=>[x.key,x.machines.length])`);
    eq(g.map(x=>x[0]),['keo_trung','keo_tinh','keo_sieu_tinh','ma_thiec','u_nhiet','ben_500','ben_630','ben_400','ben_300','sang_lo']);
    eq(g.reduce((s,x)=>s+x[1],0),w.__X.machines.length);
    ok(g.find(x=>x[0]==='sang_lo')[1]>0,'nhóm Máy sang lô trống');
    const exp=await J(`return MACHINE_TYPES.map(t=>[t.key,t.count])`); eq(g,exp,'số máy từng nhóm khớp danh mục');
  });
  await T('2. Máy lạ (typeKey không có trong danh mục) không bị mất: gom nhóm "Máy khác"',async()=>{
    const g=await J(`const m=window.__X.machines.concat([{id:"ZZ-01",typeKey:"zz",typeLabel:"Lạ",status:"unknown"}]);const gs=amgCcGroups(m);return [gs.length,gs[10].key,gs[10].machines.length]`);
    eq(g,[11,'khac',1]);
  });
  await T('3. Tìm mã máy: mọi cách viết đều ra đúng một máy (kti12 / KTI-12 / kti 12 / kti-12 / b300-5 / kt1)',async()=>{
    const f=async q=>J(`const s=amgCcSearch(${JSON.stringify(q)},window.__X.machines,window.__X.runs,window.__X.orders);return s.exact?s.exact.id:null`);
    eq(await f('kti12'),'KTI-12'); eq(await f('KTI-12'),'KTI-12'); eq(await f('kti 12'),'KTI-12'); eq(await f('kti-12'),'KTI-12');
    eq(await f('b300-5'),'B300-05'); eq(await f('kt1'),'KT-01'); eq(await f('SL-2'),'SL-02'); eq(await f('b50001'),'B500-01');
    eq(await f('kti'),null,'"kti" không phải một mã máy cụ thể');
  });
  await T('4. Tìm theo khách hàng / quy cách (không dấu, không phân biệt hoa thường) → đơn + máy đang chạy đơn đó',async()=>{
    const s=await J(`const s=amgCcSearch("dien cap a chau",window.__X.machines,window.__X.runs,window.__X.orders);return {orders:s.orders.map(o=>o.id),machines:[...s.machineIds].sort(),groups:[...s.groupKeys].sort()}`);
    eq(s.orders,['O1']); eq(s.machines,['KST-01','KTI-01']); eq(s.groups,['keo_sieu_tinh','keo_tinh']);
    const s2=await J(`const s=amgCcSearch("7/0.2tc",window.__X.machines,window.__X.runs,window.__X.orders);return {orders:s.orders.map(o=>o.id),machines:[...s.machineIds]}`);
    eq(s2.orders,['O2']); eq(s2.machines,['KTI-02']);
  });
  await T('5. Tìm theo mã đơn nội bộ cũng ra đơn; đơn đã hoàn thành không lẫn vào kết quả',async()=>{
    const s=await J(`return amgCcSearch("O7",window.__X.machines,window.__X.runs,window.__X.orders).orders.map(o=>o.id)`); ok(s.includes('O7'));
  });
  await T('6. Hành trình đơn đúng quy trình đã xác nhận: đã xong / đang chạy / tiếp theo + máy + sản lượng + thời gian',async()=>{
    const j=await J(`const o=window.__X.orders.find(x=>x.id==="O1");const j=amgCcJourney(o,window.__X.runs);return {flow:j.flow,route:j.route,bucket:j.bucket,steps:j.steps.map(s=>({k:s.key,st:s.state,done:s.done,m:s.machines.map(x=>x.id),next:s.isNext,hasStart:!!s.startedAt}))}`);
    eq(j.route,['keo_tinh','keo_sieu_tinh','u_nhiet']); eq(j.bucket,'running');
    eq(j.steps[0],{k:'keo_tinh',st:'running',done:250,m:['KTI-01'],next:false,hasStart:true});
    eq(j.steps[1].st,'assigned'); eq(j.steps[1].m,['KST-01']); eq(j.steps[1].hasStart,false);
    eq(j.steps[2],{k:'u_nhiet',st:'pending',done:0,m:[],next:false,hasStart:false}); eq(j.steps[1].next,true);
    const j4=await J(`const o=window.__X.orders.find(x=>x.id==="O4");const j=amgCcJourney(o,window.__X.runs);return j.steps.map(s=>[s.key,s.state])`);
    eq(j4,[['keo_tinh','done'],['keo_sieu_tinh','next']]);
    const j6=await J(`const o=window.__X.orders.find(x=>x.id==="O6");const j=amgCcJourney(o,window.__X.runs);return [j.flow,j.steps.length]`);
    eq(j6,[false,0],'đơn chưa xác nhận quy trình: không tự suy công đoạn');
  });
  await T('7. KPI lấy từ dữ liệu thật',async()=>{
    const k=await J(`return amgCcKpis(window.__X.machines,window.__X.runs,window.__X.orders)`);
    eq(k.machines.total,w.__X.machines.length);
    eq([k.machines.running,k.machines.assigned,k.machines.paused,k.machines.broken,k.machines.maintenance],[2,1,1,1,1]);
    eq(k.machines.idle,k.machines.total-6);
    eq(k.orders.running,2,'O1 và O7'); eq(k.orders.paused,1,'O2');
    eq(k.orders.unassigned,2,'O3, O5'); eq(k.orders.waiting,1,'O4'); eq(k.ordersWaitingMachine,3);
  });
  await T('8. Cảnh báo chỉ phát khi dữ liệu thật đáp ứng điều kiện (đủ 7 loại, đúng máy/đơn)',async()=>{
    const a=await J(`return amgCcAlerts(window.__X.machines,window.__X.runs,window.__X.orders,Date.now()+3600000).map(x=>({t:x.type,m:x.machineId||null,o:x.orderId||null,g:x.groupKey||null,c:x.count||null,d:x.detail}))`);
    const by=ty=>a.filter(x=>x.t===ty);
    eq(by('broken').map(x=>x.m),['KTI-05']); ok(by('broken')[0].d.includes('Hỏng motor kéo'));
    eq(by('paused').map(x=>x.m),['KTI-02']); ok(by('paused')[0].d.includes('Hỏng motor kéo')&&/đã dừng/.test(by('paused')[0].d),'thiếu nguyên nhân/thời gian dừng');
    eq(by('overdue').map(x=>x.o),['O2']);
    eq(by('unassigned').map(x=>x.o).sort(),['O3','O5']);
    eq(by('waiting').map(x=>x.o),['O4']);
    eq(by('short').map(x=>[x.m,x.o]),[['KTI-04','O5']]);
    ok(by('idle').length>0,'thiếu cảnh báo máy chưa có lệnh');
    ok(!by('idle').some(x=>x.g==='sang_lo'),'máy sang lô chưa gắn công đoạn không được báo "chưa có lệnh"');
    ok(!by('idle').some(x=>x.g==='keo_tinh'&&x.c!==w.__X.machines.filter(m=>m.typeKey==='keo_tinh').length-4),'đếm sai số máy tinh chưa có lệnh');
    ok(!a.some(x=>x.o==='O6'),'đơn chưa xác nhận quy trình không được cảnh báo');
    const none=await J(`return amgCcAlerts([],[],[],Date.now()).length`); eq(none,0,'không dữ liệu → không cảnh báo');
  });
  await T('9. Sắp xếp: theo mã máy, theo trạng thái, theo đơn hàng (máy không đơn luôn cuối)',async()=>{
    const r=await J(`const v=window.__X.machines.map(m=>amgCcMachineView(m,window.__X.runs.filter(amgIsOpenRun),window.__X.orders));
      return {st:amgCcSortViews(v,"status","asc").slice(0,6).map(x=>x.state),ord:amgCcSortViews(v,"order","asc").slice(0,3).map(x=>x.machine.id),id:amgCcSortViews(v,"id","asc").slice(0,2).map(x=>x.machine.id)}`);
    eq(r.st,['running','running','assigned','paused','broken','maintenance']);
    eq(r.id,['KT-01','KT-02']); ok(r.ord.every(x=>['KTI-01','KST-01','KTI-02','B400-01'].includes(x)),'đơn lên đầu');
  });

  /* ===== B. Giao diện thật ===== */
  await T('10. Vẽ không lỗi; 7 thẻ KPI đúng số liệu; thanh có "Tất cả" + 10 nhóm kèm số lượng',async()=>{
    const e0=errs.length; mount(cc()); await sleep(200);
    eq(errs.length,e0,'lỗi khi vẽ: '+errs.slice(e0).join('|'));
    eq($$('.cc-kpi').length,7);
    const kv=id=>$(`[data-kpi="${id}"] .cc-kpi-v`).textContent;
    eq([kv('total'),kv('running'),kv('assigned'),kv('paused'),kv('down'),kv('orders-running'),kv('orders-waiting')],[String(w.__X.machines.length),'2','1','1','2','2','3']);
    eq($$('.cc-gbtn').length,11);
    const cnt=g=>$(`[data-group="${g}"] .cc-gcount`).textContent;
    eq([cnt('keo_trung'),cnt('keo_tinh'),cnt('keo_sieu_tinh'),cnt('ma_thiec'),cnt('u_nhiet'),cnt('ben_500'),cnt('ben_630'),cnt('ben_400'),cnt('ben_300'),cnt('sang_lo')],['4','64','19','5','4','10','2','33','15','4']);
    unmount();
  });
  await T('11. Mở nhanh vào nhóm có máy đang chạy; bấm nhóm khác → hiện ngay đúng các máy của nhóm (một lần bấm, không cuộn qua nhóm khác)',async()=>{
    R('localStorage.removeItem("amg_cc_group")'); mount(cc()); await sleep(150);
    eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'keo_tinh','mặc định: nhóm đầu tiên có máy chạy');
    eq(tiles().length,64);
    click($('[data-group="ben_400"]')); await sleep(80);
    eq(tiles().length,33); ok(tiles().every(x=>x.getAttribute('data-machine').startsWith('B400-')));
    eq($$('[data-section]').length,0,'không hiện nhiều nhóm nối nhau');
    click($('[data-group="sang_lo"]')); await sleep(80); eq(tiles().length,4,'Máy sang lô hiện đủ 4 máy');
    click($('[data-group="all"]')); await sleep(80);
    eq(tiles().length,w.__X.machines.length,'xem tất cả = toàn bộ máy'); eq($$('[data-section]').length,10);
    eq(w.localStorage.getItem('amg_cc_group'),'all','ghi nhớ nhóm đã chọn');
    unmount();
  });
  await T('12. Thẻ máy đủ thông tin: mã/tên máy, trạng thái, khách, quy cách, loại, công đoạn, KH/TT/còn/%, người vận hành, ca',async()=>{
    mount(cc()); await sleep(100); click($('[data-group="keo_tinh"]')); await sleep(80);
    const c=$('[data-machine="KTI-01"]'); const tx=c.textContent;
    for(const k of ['KTI-01','Máy kéo tinh','ĐANG CHẠY','Công ty Điện Cáp Á Châu','0.254BC','Dây đơn BC','Kéo tinh','Kế hoạch','600','Thực tế','250','Còn lại','350','42%','Nguyễn A','Ca Ngày']) ok(tx.includes(k),'thiếu '+k+' trong: '+tx.slice(0,300));
    eq(c.getAttribute('data-state'),'running');
    eq($('[data-machine="KTI-02"]').getAttribute('data-state'),'paused'); ok($('[data-machine="KTI-02"]').textContent.includes('Hỏng motor kéo'));
    eq($('[data-machine="KTI-05"]').getAttribute('data-state'),'broken'); eq($('[data-machine="KTI-06"]').getAttribute('data-state'),'maintenance');
    eq($('[data-machine="KTI-03"]').getAttribute('data-state'),'idle');
    eq($('[data-machine="KTI-01"]').style.getPropertyValue('--cc-c'),R('amgCcMeta("running").color'));
    ok(R('amgCcMeta("assigned").color')!==R('amgCcMeta("paused").color'),'chờ (vàng) phải khác tạm dừng (cam)');
    unmount();
  });
  await T('13. Tìm mã máy: tự chuyển đúng nhóm, chỉ hiện máy đó, nổi bật, có thông báo',async()=>{
    mount(cc()); await sleep(100); click($('[data-group="keo_trung"]')); await sleep(60);
    typeIn($('[data-cc-search]'),'b300-7'); await sleep(120);
    eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'ben_300'); eq(items().map(x=>x.getAttribute('data-machine')),['B300-07']);
    ok(items()[0].className.includes('cc-hit'),'chưa nổi bật'); ok($('[data-banner="exact"]').textContent.includes('Máy bện 300'));
    typeIn($('[data-cc-search]'),'kst-1'); await sleep(120);
    eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'keo_sieu_tinh'); eq(items().map(x=>x.getAttribute('data-machine')),['KST-01']);
    typeIn($('[data-cc-search]'),'khong co may nay 999'); await sleep(100);
    ok(/Không tìm thấy/.test(w.document.body.textContent),'thiếu thông báo không tìm thấy');
    unmount();
  });
  await T('14. Tìm đơn hàng: hiện thẻ đơn (công đoạn, tình trạng, sản lượng, các máy liên quan) + máy đang chạy đơn đó',async()=>{
    mount(cc()); await sleep(100);
    typeIn($('[data-cc-search]'),'hoang gia'); await sleep(120);
    const oc=$('[data-orders="search"]'); ok(oc,'thiếu khung kết quả đơn'); const tx=oc.textContent;
    for(const k of ['Hoàng Gia','7/0.2TC','Dây bện TC','Tạm dừng','Kéo tinh','KTI-02','Quá hạn'.toLowerCase()]) ok(tx.toLowerCase().includes(k.toLowerCase()),'thiếu '+k);
    eq(items().map(x=>x.getAttribute('data-machine')),['KTI-02']);
    typeIn($('[data-cc-search]'),'o1'); await sleep(120); // O1 trải nhiều công đoạn → nhiều nhóm
    const m1=items().map(x=>x.getAttribute('data-machine')).sort(); ok(m1.includes('KTI-01')&&m1.includes('KST-01'),'đơn nhiều công đoạn phải hiện mọi máy liên quan: '+m1);
    eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'all','nhiều nhóm → xem tất cả');
    unmount();
  });
  await T('15. Hành trình đơn: bấm "Hành trình sản xuất" → các công đoạn theo đúng thứ tự, trạng thái, máy, thời gian; bấm máy → nhảy tới máy',async()=>{
    mount(cc()); await sleep(100); typeIn($('[data-cc-search]'),'dien cap a chau'); await sleep(100);
    click($$('.cc-ocard button').find(b=>b.textContent==='Hành trình sản xuất')); await sleep(100);
    const st=$$('[data-step]'); eq(st.map(x=>x.getAttribute('data-step')),['keo_tinh','keo_sieu_tinh','u_nhiet']); eq(st.map(x=>x.getAttribute('data-state')),['running','assigned','pending']);
    ok(st[0].textContent.includes('KTI-01')&&st[0].textContent.includes('250 / 1.000')||st[0].textContent.includes('250 / 1,000')||/250 \/ 1[.,]?000/.test(st[0].textContent),'thiếu sản lượng: '+st[0].textContent);
    ok(st[0].textContent.includes('Bắt đầu:')&&st[2].textContent.includes('Chưa bắt đầu')&&st[1].textContent.includes('Tiếp theo')&&!st[2].textContent.includes('Tiếp theo'),'thiếu thời gian/nhãn Tiếp theo: '+st.map(x=>x.textContent).join(' || '));
    click(st[1].querySelector('.cc-mchip')); await sleep(120);
    ok(!$('[data-step]'),'hộp hành trình phải đóng'); eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'keo_sieu_tinh'); ok(items()[0]&&items().some(x=>x.getAttribute('data-machine')==='KST-01'&&x.className.includes('cc-hit')));
    unmount();
  });
  await T('16. Bộ lọc trạng thái: Đang chạy / Chờ lệnh / Tạm dừng / Máy trống / Sự cố / Bảo trì đều đúng; số đếm trên nút đúng',async()=>{
    mount(cc()); await sleep(100); click($('[data-group="all"]')); await sleep(60);
    const f=async k=>{ click($(`[data-filter="${k}"]`)); await sleep(70); return items().map(x=>x.getAttribute('data-machine')).sort(); };
    eq(await f('running'),['B400-01','KTI-01']); eq(await f('assigned'),['KST-01']); eq(await f('paused'),['KTI-02']); eq(await f('broken'),['KTI-05']); eq(await f('maintenance'),['KTI-06']);
    const idle=await f('idle'); eq(idle.length,w.__X.machines.length-6); ok(idle.includes('SL-01'),'máy sang lô là máy trống');
    eq($('[data-filter="idle"] b').textContent,String(idle.length));
    click($('[data-filter="all"]')); await sleep(70); eq(items().length,w.__X.machines.length);
    click($('[data-kpi="running"]')); await sleep(80); eq(items().map(x=>x.getAttribute('data-machine')).sort(),['B400-01','KTI-01'],'bấm thẻ KPI = lọc'); eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'all');
    unmount();
  });
  await T('17. Chế độ Lưới / Danh sách + ghi nhớ lựa chọn; danh sách một máy một dòng, sắp xếp theo mã máy / trạng thái / đơn',async()=>{
    R('localStorage.removeItem("amg_cc_view")'); mount(cc()); await sleep(100); click($('[data-group="keo_tinh"]')); await sleep(60);
    ok(tiles().length>0&&rows().length===0,'mặc định là lưới');
    click($('[data-view="list"]')); await sleep(80);
    eq(w.localStorage.getItem('amg_cc_view'),'list'); eq(rows().length,64); eq(tiles().length,0);
    unmount(); mount(cc()); await sleep(100); ok(rows().length>0,'nhớ chế độ Danh sách sau khi mở lại'); unmount();
    mount(cc()); await sleep(100);
    click($$('.cc-sort[data-sort="status"]')[0]); await sleep(70);
    eq(rows().slice(0,2).map(r=>r.getAttribute('data-state')),['running','paused']);
    click($$('.cc-sort[data-sort="status"]')[0]); await sleep(70); // đảo chiều
    eq(rows()[0].getAttribute('data-state'),'idle');
    click($$('.cc-sort[data-sort="order"]')[0]); await sleep(70); eq(rows()[0].getAttribute('data-state')!=='idle',true,'máy có đơn lên đầu');
    click($$('.cc-sort[data-sort="id"]')[0]); await sleep(70); eq(rows()[0].getAttribute('data-machine'),'KTI-01');
    R('localStorage.setItem("amg_cc_view","grid")'); unmount();
  });
  await T('18. Màn hình hẹp (điện thoại): danh sách tự chuyển thành thẻ — không bảng cuộn ngang, không mất máy',async()=>{
    R('localStorage.setItem("amg_cc_view","list")');
    const proto=w.HTMLElement.prototype, d0=Object.getOwnPropertyDescriptor(proto,'clientWidth'); Object.defineProperty(proto,'clientWidth',{configurable:true,get(){return 380}});
    mount(cc()); await sleep(150); click($('[data-group="ben_400"]')); await sleep(80);
    eq(rows().length,0); eq(tiles().length,33); eq($('.cc-list').getAttribute('data-view'),'grid');
    ok($('.cc-nav')&&$$('.cc-gbtn').length===11,'thanh nhóm vẫn đủ 11 nút (cuộn ngang trên điện thoại)');
    unmount(); if(d0) Object.defineProperty(proto,'clientWidth',d0); else delete proto.clientWidth;
    R('localStorage.setItem("amg_cc_view","grid")');
  });
  await T('19. Cảnh báo: chip theo loại; bấm cảnh báo máy → mở đúng máy; bấm cảnh báo đơn → mở hành trình; bấm "máy chưa có lệnh" → lọc Máy trống của nhóm',async()=>{
    mount(cc()); await sleep(100);
    ok($('.cc-alerts').textContent.includes('Máy sự cố')&&$('.cc-alerts').textContent.includes('Đơn quá hạn'));
    click($('[data-alert-type="broken"]')); await sleep(60);
    click($('[data-alert^="broken:"]')); await sleep(120);
    eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'keo_tinh'); ok(items().some(x=>x.getAttribute('data-machine')==='KTI-05'&&x.className.includes('cc-hit')));
    click($('[data-alert-type="overdue"]')); await sleep(60); click($('[data-alert^="overdue:"]')); await sleep(100);
    ok($('[data-step]'),'cảnh báo đơn mở hành trình'); click($$('button').find(b=>b.textContent==='Đóng')); await sleep(60);
    click($('[data-alert-type="idle"]')); await sleep(60); click($('[data-alert^="idle:keo_tinh"]')); await sleep(100);
    eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'keo_tinh'); ok(items().every(x=>x.getAttribute('data-state')==='idle'),'chỉ máy trống');
    unmount();
  });
  await T('20. Thẻ KPI đơn hàng: "Đơn đang sản xuất" và "Đơn chờ phân máy" mở danh sách đơn thật',async()=>{
    mount(cc()); await sleep(100);
    click($('[data-kpi="orders-waiting"]')); await sleep(100);
    const cards=$$('[data-orders="waiting"] .cc-ocard'); eq(cards.length,3); const tx=$('[data-orders="waiting"]').textContent; ok(tx.includes('Phú Thịnh')&&tx.includes('Minh Anh')&&tx.includes('Bảo Long'));
    click($('[data-kpi="orders-running"]')); await sleep(100); eq($$('[data-orders="running"] .cc-ocard').length,2);
    unmount();
  });
  await T('21. Thao tác điều hành gọi đúng hộp thoại/hàm nghiệp vụ cũ (phân lệnh, bắt đầu, tạm dừng, tiếp tục, kết thúc, ghi sản lượng, chi tiết, lịch sử, trạng thái máy)',async()=>{
    R('window.__modals=[];window.__acts=[]'); mount(cc()); await sleep(100); click($('[data-group="keo_tinh"]')); await sleep(60);
    const btn=(id,label)=>[...$(`[data-machine="${id}"]`).querySelectorAll('button')].find(b=>b.textContent===label);
    click(btn('KTI-01','Ghi sản lượng')); click(btn('KTI-01','Tạm dừng')); click(btn('KTI-01','Kết thúc lệnh')); click(btn('KTI-01','Chi tiết lệnh')); click(btn('KTI-01','Lịch sử')); click(btn('KTI-01','Trạng thái máy'));
    click(btn('KTI-03','Phân lệnh')); click(btn('KTI-02','Tiếp tục'));
    eq(R('window.__modals.map(m=>m.kind+":"+(m.runId||m.machineId))'),['output:R1','pause:R1','finish:R1','rundetail:R1','history:KTI-01','status:KTI-01','assign:KTI-03']);
    eq(R('window.__acts.length'),1,'Tiếp tục gọi act'); eq(R('window.__acts[0]'),'Đã tiếp tục chạy máy KTI-02');
    ok(!btn('KTI-05','Phân lệnh')&&!btn('KTI-05','Ghi sản lượng'),'máy hỏng không có nút phân lệnh/ghi sản lượng'); ok(!btn('KTI-06','Phân lệnh'));
    click($('[data-group="keo_sieu_tinh"]')); await sleep(60); click(btn('KST-01','Bắt đầu chạy')); eq(R('window.__modals.slice(-1)[0].kind+":"+window.__modals.slice(-1)[0].runId'),'start:R2');
    unmount();
  });
  await T('22. Phân quyền giữ nguyên: người không có quyền không thấy nút điều hành; công nhân chỉ ghi sản lượng',async()=>{
    mount(cc("{can:{plan:false,output:false,manager:false,editMachines:false}}")); await sleep(100); click($('[data-group="keo_tinh"]')); await sleep(60);
    const labels=[...$('[data-machine="KTI-01"]').querySelectorAll('button')].map(b=>b.textContent).filter(x=>x!=='Hành trình');
    ok(!labels.includes('Ghi sản lượng')&&!labels.includes('Tạm dừng')&&!labels.includes('Kết thúc lệnh')&&!labels.includes('Trạng thái máy'),'nút điều hành lọt ra: '+labels);
    unmount();
    mount(cc("{can:{plan:false,output:true,manager:false,editMachines:false}}")); await sleep(100); click($('[data-group="keo_tinh"]')); await sleep(60);
    const l2=[...$('[data-machine="KTI-01"]').querySelectorAll('button')].map(b=>b.textContent); ok(l2.includes('Ghi sản lượng')&&!l2.includes('Kết thúc lệnh')&&!l2.includes('Tạm dừng'),'công nhân: '+l2); unmount();
  });
  await T('23. Màn hình TV: nút mở TV truyền nhóm đang chọn; TV hiện đủ 10 nhóm (kể cả Máy sang lô) và đủ máy',async()=>{
    R('window.__tv=null'); mount(cc()); await sleep(100); click($('[data-group="ben_400"]')); await sleep(60); click($$('button').find(b=>b.textContent==='Màn hình TV')); eq(R('window.__tv'),'ben_400'); unmount();
    mount(`React.createElement(TVWall,{machines:X.machines,runs:X.runs,orders:X.orders,onClose(){},initialGroup:"sang_lo"})`); await sleep(150);
    const sel=$$('select')[0]; eq([...sel.options].length,11,'tất cả + 10 nhóm'); eq(sel.value,'sang_lo');
    eq($$('.amg-mcard').length,4,'TV hiện đủ 4 máy sang lô'); unmount();
    mount(`React.createElement(TVWall,{machines:X.machines,runs:X.runs,orders:X.orders,onClose(){}})`); await sleep(150);
    ok(/Trang 1\/\d+ · 160 máy/.test(w.document.body.textContent)||w.document.body.textContent.includes(w.__X.machines.length+' máy'),'TV phải đếm đủ '+w.__X.machines.length+' máy'); unmount();
  });
  await T('24. Mục Giám sát máy móc đầy đủ qua PlanPage: Trung tâm điều hành + Danh mục máy cũ; tiêu điểm từ tìm kiếm toàn hệ thống mở đúng máy',async()=>{
    R(`window.__AMG_FOCUS={tab:"machines",screen:"monitor",q:"KTI-02"}`);
    mount(`React.createElement(PlanPage,{orders:X.orders,machines:X.machines,runs:X.runs,entries:[],staff:[],currentUser:{username:"admin",role:"admin",fullName:"Quản trị"},isAdmin:true,canEdit:true,auditLog:[],onUpdateMachine(){},onAddMachine(){},onDeleteMachine(){},onRestoreSeed(){}})`); await sleep(250);
    ok($('.cc-root'),'thiếu Trung tâm điều hành'); eq(items().map(x=>x.getAttribute('data-machine')),['KTI-02']); eq($('[data-group][aria-selected="true"]').getAttribute('data-group'),'keo_tinh');
    click($$('button').find(b=>b.textContent==='Danh mục máy & trạng thái')); await sleep(150); ok(!$('.cc-root')&&w.document.body.textContent.includes('Máy kéo'),'Danh mục máy cũ phải còn');
    click($$('button').find(b=>b.textContent==='Trung tâm điều hành máy')); await sleep(100); ok($('.cc-root'));
    click($$('button').find(b=>b.textContent==='Kế hoạch & phân công sản xuất')); await sleep(150); ok(w.document.body.textContent.includes('Phân máy'),'màn Kế hoạch & phân công còn nguyên');
    unmount();
  });
  await T('25. Chế độ Trung tâm điều hành chỉ ĐỌC: dữ liệu Firebase không đổi sau mọi thao tác tìm/lọc/chuyển nhóm/xem hành trình',async()=>{
    eq(JSON.stringify(w.__db.__store),before,'dữ liệu bị thay đổi');
    const ghost=await J(`const m=JSON.stringify(window.__X.machines),r=JSON.stringify(window.__X.runs),o=JSON.stringify(window.__X.orders);
      amgCcSearch("a",window.__X.machines,window.__X.runs,window.__X.orders);amgCcAlerts(window.__X.machines,window.__X.runs,window.__X.orders);window.__X.orders.forEach(x=>amgCcJourney(x,window.__X.runs));amgCcKpis(window.__X.machines,window.__X.runs,window.__X.orders);
      return JSON.stringify(window.__X.machines)===m&&JSON.stringify(window.__X.runs)===r&&JSON.stringify(window.__X.orders)===o`);
    ok(ghost,'hàm thuần làm đổi dữ liệu vào');
  });
  await T('26. Dữ liệu cũ/thiếu trường không làm vỡ giao diện (lệnh mồ côi, đơn đã xóa, quy cách trống)',async()=>{
    const e0=errs.length;
    R(`window.__X2={machines:window.__X.machines,orders:window.__X.orders.filter(o=>o.id!=="O1").concat([{id:"OX",customer:"",spec:"",quantity:null,status:"active"}]),runs:window.__X.runs.concat([{id:"RBAD",machineId:"KTI-10",stageKey:"keo_tinh",productionStatus:"running",orderId:"O-DA-XOA",plannedQuantity:10,producedQuantity:0,snapshot:{customer:"Khách cũ",spec:"0.1BC"}}])}`);
    R(`(()=>{const X=window.__X2;const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;window.__root.render(React.createElement(DialogProvider,null,React.createElement(CommandCenter,{machines:X.machines,runs:X.runs,orders:X.orders,can:${CAN},openModal(){},act(){}})));})()`); await sleep(200);
    click($('[data-group="all"]')); await sleep(100); typeIn($('[data-cc-search]'),'khach cu'); await sleep(100);
    ok($('[data-machine="KTI-10"]')&&$('[data-machine="KTI-10"]').textContent.includes('Khách cũ')&&$('[data-machine="KTI-10"]').textContent.includes('Đơn gốc không còn tồn tại'));
    eq(errs.length,e0,'lỗi: '+errs.slice(e0).join('|')); unmount();
  });
  console.log(out.join('\n')); console.log(`\n${pass} pass, ${fail} fail`);
  if(errs.length) console.log('console.error:',errs.slice(0,3));
  process.exit(fail?1:0);
})();
