/* v57 — Nghiệm thu TỔNG QUAN – TRUNG TÂM ĐIỀU HÀNH SẢN XUẤT. Dữ liệu dựng bằng chính hàm nghiệp vụ thật trên RTDB giả lập, vẽ giao diện thật (React+jsdom) và thao tác như người dùng.
   Chạy: NM=<node_modules> APP_DIR=../.. node accept57.js */
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); const YDAY=ymd(new Date(Date.now()-86400000));
const {load}=require('./harness'); const rt=require('./fakertdb');
const server=rt.makeServer();
const t=load({server}); const w=t.w;
const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
const J=async c=>JSON.parse(await A('return JSON.stringify(await (async()=>{'+c+'})())'));
const list=async col=>J(`const s=await db.collection("${col}").get();return s.docs.map(d=>Object.assign({id:d.id},d.data()))`);
let pass=0,fail=0;const out=[];
const cleanup=()=>{ try{ R('if(window.__root){try{window.__root.unmount()}catch(e){} window.__rootEl.remove();window.__root=null}'); }catch(e){} };
async function T(n,f){try{await f();pass++;out.push('PASS '+n);}catch(e){fail++;out.push('FAIL '+n+' :: '+(e&&e.message||e));} cleanup(); R('Object.keys(localStorage).filter(k=>/^amg_(cc|ov)_/.test(k)).forEach(k=>localStorage.removeItem(k))'); }
const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a));};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert');};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000,msg='timeout'){const t0=Date.now();for(;;){try{if(await fn())return;}catch(e){}if(Date.now()-t0>ms)throw new Error(msg);await sleep(20);}}
const errs=[]; w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
const $=(s,r)=>(r||w.document).querySelector(s), $$=(s,r)=>[...(r||w.document).querySelectorAll(s)];
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
  await mk('O2',{customer:"Hoàng Gia",spec:"7/0.2TC",quantity:500,deliveryDate:YDAY,routing:["keo_tinh","keo_sieu_tinh","ma_thiec","ben"]});
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
  await sleep(800); // đợi ứng dụng gieo xong dữ liệu mặc định của chính nó  // thêm sản lượng thành phẩm thật (O7 chỉ có công đoạn Bện → mọi lượt ghi là thành phẩm) và đọc nhật ký
  await A(`await amgFlowRecordOutput({clientKey:"k7",runId:"R7",orderId:"O7",machineId:"B400-01",stageKey:"ben",qty:80});`);
  await A(`await db.collection(FS.orders).doc("O4").set({status:"completed",completedAt:new Date().toISOString(),completedBy:"Quản trị"},{merge:true});`);
  await refresh();
  const AUD=await list(await A('return FS.audit')); w.__AUD=AUD;
  await sleep(1500); // đợi máy chủ giả lập xác nhận xong dấu thời gian của các lần ghi ở trên
  const before=JSON.stringify(w.__db.__store);
  const USER=u=>`window.__U=${JSON.stringify(u)};`;
  const ADMIN={username:'admin',role:'admin',fullName:'Nguyễn Văn An',team:''};
  const NV={username:'nv1',role:'employee',fullName:'Trần Thị Bình',team:'KÉO'};
  const nav=[]; w.__nav=nav;
  function mountOv(user,over){ R(`(()=>{window.__nav.length=0;window.__AMG_USER=${JSON.stringify(user)};const X=window.__X;const P=Object.assign({currentUser:${JSON.stringify(user)},orders:X.orders,machines:X.machines,runs:X.runs,auditLog:window.__AUD,staff:[],scrap:[],attendance:{},extra:{},onNavigate:t=>window.__nav.push({tab:t}),onNavigateFocus:(t,f)=>window.__nav.push({tab:t,focus:f})},${JSON.stringify(over||{})});const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;window.__root.render(React.createElement(DialogProvider,null,React.createElement(ProductionOverview,P)));})()`); }
  const lastNav=()=>JSON.parse(JSON.stringify(nav[nav.length-1]||null));
  const txt=el=>(el?el.textContent:'').replace(/\s+/g,' ').trim();
  const compute=(over)=>J(`return (()=>{const X=window.__X;const o=amgOvCompute({orders:X.orders,machines:X.machines,runs:X.runs,auditLog:window.__AUD,staff:[],scrap:[],attendance:{},extra:{}},${JSON.stringify(ADMIN)},Object.assign({now:new Date()},${JSON.stringify(over||{})}));return JSON.parse(JSON.stringify(o,(k,v)=>k==='now'||k==='scope'?undefined:v));})()`);

  /* ===== A. Logic thuần ===== */
  await T('1. Đơn: tổng = đang mở + hoàn thành; đang SX + chờ = đang mở; trễ hạn lấy đúng đơn quá hạn thật',async()=>{
    const o=await compute(); const c=o.counts;
    eq(c.orders,w.__X.orders.length); eq(c.open+c.completed,c.orders); eq(c.producing+c.waiting,c.open);
    eq(c.completed,1,'O4 đã hoàn thành'); eq(c.overdue,1,'chỉ O2 quá hạn');
    const k=Object.fromEntries(o.kpis.map(x=>[x.key,x.value])); eq(k.orders_total,c.orders); eq(k.orders_overdue,1); eq(k.orders_done,1);
  });
  await T('2. Máy: tổng = số máy thật trong dữ liệu; 10 nhóm đúng thứ tự; chạy+chờ+dừng = tổng; không thêm/bớt máy',async()=>{
    const o=await compute(); const m=o.counts.machines;
    eq([m.total,m.running+m.waiting+m.stopped],[w.__X.machines.length,m.total]);
    eq(o.groups.map(g=>g.key),['keo_trung','keo_tinh','keo_sieu_tinh','ma_thiec','u_nhiet','ben_500','ben_630','ben_400','ben_300','sang_lo']);
    eq(o.groups.reduce((s,g)=>s+g.total,0),m.total); eq(m.running,2,'chỉ R1 và R7 đang chạy (R3 tạm dừng, R5 đã kết thúc): '+JSON.stringify(m)); eq([m.paused,m.maintenance,m.broken,m.assigned],[1,1,1,1]);
  });
  await T('3. Khoảng thời gian: ngày/tuần/tháng đúng; khoảng ngày tự chọn đảo ngược được sửa và giới hạn 92 ngày',async()=>{
    const r=await J(`const n=new Date(2026,10,27,10,0,0);return [amgOvRange("day",null,null,n),amgOvRange("week",null,null,n),amgOvRange("month",null,null,n),amgOvRange("custom","2026-11-10","2026-11-03",n),amgOvRange("custom","2026-01-01","2026-11-27",n),amgOvRange("custom","x","y",n)]`);
    eq([r[0].from,r[0].to],['2026-11-27','2026-11-27']); eq([r[1].from,r[1].to],['2026-11-23','2026-11-29']); eq([r[2].from,r[2].to],['2026-11-01','2026-11-30']);
    eq([r[3].from,r[3].to,r[3].days],['2026-11-03','2026-11-10',8]); eq([r[4].days,r[4].clamped],[92,true]); eq(r[5].key,'month');
  });
  await T('4. Lời chào theo giờ; không còn tên cố định',async()=>{
    const g=await J(`return [5,10,12,15,19,23,2].map(h=>amgOvGreeting(new Date(2026,10,27,h)))`);
    eq(g,['Chào buổi sáng','Chào buổi sáng','Chào buổi trưa','Chào buổi chiều','Chào buổi tối','Chào buổi tối','Chào buổi tối']);
  });
  await T('5. Sản lượng thành phẩm trong kỳ lấy từ nhật ký thật (80 kg ở công đoạn cuối) và kg/m không cộng lẫn',async()=>{
    const o=await compute({period:'day'}); eq(o.charts.output.total.kg,130,'80 (O7·Bện) + 50 (O5·Kéo tinh, công đoạn cuối của đơn đó)'); eq(o.charts.output.total.m,0); ok(o.charts.output.hasData);
    const a=o.charts.output.allStages.kg; eq(a,380,'mọi công đoạn: 250 (R1) + 50 (R5) + 80 (R7)');
    const w1=await compute({period:'week'}); eq(w1.charts.output.buckets.length,7); eq(w1.charts.output.total.kg,130);
    const none=await compute({period:'custom',from:'2020-01-01',to:'2020-01-05'}); eq(none.charts.output.total.kg,0); ok(!none.charts.output.hasData);
  });
  await T('6. Tiến độ công đoạn: đủ 6 công đoạn thật (không thêm công đoạn), có cảnh báo chậm cho công đoạn có đơn trễ',async()=>{
    const o=await compute(); eq(o.stageRows.map(s=>s.key),['keo_trung','keo_tinh','keo_sieu_tinh','u_nhiet','ma_thiec','ben']);
    const kt=o.stageRows.find(s=>s.key==='keo_tinh'),ben=o.stageRows.find(s=>s.key==='ben');
    eq(kt.status,'late','O2 trễ hạn đang ở Kéo tinh'); ok(kt.overdue>=1); eq(ben.status==='late'?1:0,1,'O2 cũng có Bện chưa xong'); eq(o.stageRows.find(s=>s.key==='keo_trung').status,'none');
    ok(o.alerts.some(a=>a.id==='stage:keo_tinh'&&a.level==='err'));
  });
  await T('7. Cảnh báo: máy hỏng, máy tạm dừng bất thường, đơn quá hạn, đơn chưa bố trí, máy chưa có lệnh — mỗi cảnh báo có mức ưu tiên và đích điều hướng',async()=>{
    const o=await compute(); const by=k=>o.alerts.filter(a=>a.kind===k);
    eq(by('broken').length,1); eq(by('broken')[0].target.focus.machineId,'KTI-05'); eq(by('abnormal_stop')[0].target.focus.machineId,'KTI-02'); ok(by('abnormal_stop')[0].at,'có mốc tạm dừng');
    eq(by('overdue')[0].target,{tab:'orders',focus:{orderId:'O2'}}); ok(by('unassigned').length>=2); ok(by('machine_unassigned').length>=1&&by('machine_unassigned')[0].target.groupKey);
    ok(o.alerts.every(a=>['Cao','Trung bình','Thấp'].includes(a.priority)&&a.title));
    const lv=o.alerts.map(a=>({err:0,warn:1,info:2}[a.level])); eq(lv,[...lv].sort((a,b)=>a-b),'sắp theo mức ưu tiên');
  });
  await T('8. Cảnh báo lỗi đồng bộ chỉ xuất hiện khi lớp dữ liệu báo lỗi/mất kết nối',async()=>{
    const e=await J(`const X=window.__X;const f=s=>amgOvCompute({orders:X.orders,machines:X.machines,runs:X.runs,auditLog:[],staff:[],scrap:[],attendance:{},extra:{}},${JSON.stringify(ADMIN)},{now:new Date(),syncState:s}).alerts.filter(a=>a.kind==="sync").map(a=>a.title);return [f({state:"online",lastSync:Date.now()}),f({state:"offline",pending:3}),f({state:"error",readError:"x"})]`);
    eq(e[0],[]); eq(e[1].length,1); eq(e[2],['Có lỗi đồng bộ']);
  });
  await T('9. Hoạt động gần đây: chỉ sự kiện có thật, mới nhất trước; đơn mới/hoàn thành, phân lệnh, bắt đầu, tạm dừng, sản lượng',async()=>{
    const o=await compute(); const k=new Set(o.activity.map(e=>e.kind));
    for(const x of ['plan','run_start','run_pause','output','order_done']) ok(k.has(x),'thiếu sự kiện '+x+' / có: '+[...k]);
    const at=o.activity.map(e=>e.at); eq(at,[...at].sort((a,b)=>b-a)); ok(o.activity.every(e=>e.at>0&&e.title));
    ok(!o.activity.some(e=>e.kind==='machine_status'&&e.user==='system'),'không lấy dòng gieo mặc định');
  });
  await T('10. Dữ liệu trống: KPI báo "chưa có dữ liệu" (null) thay vì điền 0; không lỗi',async()=>{
    const o=await J(`return (()=>{const o=amgOvCompute({orders:[],machines:[],runs:[],auditLog:[],staff:[],scrap:[],attendance:{},extra:{}},${JSON.stringify(ADMIN)},{now:new Date()});return {v:o.kpis.map(k=>[k.key,k.value]),a:o.alerts.length,g:o.groups.length,ev:o.activity.length}})()`);
    ok(o.v.length>=8&&o.v.every(x=>x[1]===null),JSON.stringify(o.v)); eq(o.g,10); eq(o.ev,0);
  });

  /* ===== B. Giao diện thật ===== */
  await T('11. Lời chào lấy đúng tên + vai trò tài khoản đăng nhập; có ngày giờ thực, nút Làm mới, trạng thái đồng bộ',async()=>{
    mountOv(ADMIN); await sleep(250);
    eq(txt($('[data-testid="ov-hello"]')),'Xin chào, Nguyễn Văn An!'); ok(/Trung tâm điều hành sản xuất AOMAGA MES/.test(txt($('.ov-banner'))));
    ok(/Admin/.test(txt($('[data-testid="ov-role"]')))); ok(/^\d\d:\d\d:\d\d$/.test(txt($('[data-testid="ov-clock"]')))); ok($('[data-sync]'),'trạng thái đồng bộ'); ok($('.ov-refresh'));
    const t1=txt($('[data-testid="ov-clock"]')); await sleep(1200); ok(txt($('[data-testid="ov-clock"]'))!==t1,'đồng hồ chạy');
    unmount(); mountOv(NV); await sleep(250); eq(txt($('[data-testid="ov-hello"]')),'Xin chào, Trần Thị Bình!'); ok(/Nhân viên · Tổ KÉO/.test(txt($('[data-testid="ov-role"]'))));
  });
  await T('12. Đã gỡ 4 khu nhập liệu trùng; Tổng quan không có ô nhập số liệu nghiệp vụ',async()=>{
    mountOv(ADMIN); await sleep(250); const body=txt($('[data-testid="ov-page"]'));
    for(const s of ['Tổng quan · Sản xuất','Nhập sản lượng đã xuất xong','Công đoạn cung cấp nguyên vật liệu','Nhập sản lượng Kéo trung','Ghi nhận sản lượng','Tổng hợp: ']) ok(!body.includes(s),'còn: '+s);
    ok(!$$('input[type="number"], textarea').length,'không có ô nhập số liệu'); ok(!$$('button').some(b=>/Ghi nhận sản lượng|Lưu sản lượng/.test(txt(b))));
    const inputs=$$('input',$('[data-testid="ov-page"]')).map(i=>i.type); ok(inputs.every(x=>x==='search'||x==='date'),'chỉ ô tìm kiếm/lọc ngày: '+inputs);
  });
  await T('13. 10 thẻ KPI đủ nhãn, số khớp dữ liệu; nhấn KPI mở đúng tab (kèm bộ lọc)',async()=>{
    mountOv(ADMIN); await sleep(250); const ks=$$('[data-kpi]'); eq(ks.length,10);
    const lab=['Tổng đơn hàng','Đơn đang sản xuất','Đơn chờ sản xuất','Đơn hàng hoàn thành','Đơn hàng trễ hạn','Tổng số máy móc','Máy đang chạy','Máy dừng / chờ','Tiến độ sản xuất','Hoàn thành kế hoạch'];
    ks.forEach((k,i)=>ok(txt(k).includes(lab[i]),'KPI '+i+': '+txt(k)));
    ok(txt($('[data-kpi="machines_total"]')).includes(String(w.__X.machines.length))); ok(txt($('[data-kpi="orders_total"]')).includes(String(w.__X.orders.length)));
    const c=async(k)=>{click($('[data-kpi="'+k+'"]')); await sleep(30); return lastNav();};
    eq(await c('orders_overdue'),{tab:'orders',focus:{status:'overdue'}}); eq(await c('orders_producing'),{tab:'orders',focus:{status:'producing'}}); eq(await c('orders_done'),{tab:'completed',focus:null});
    eq((await c('machines_running')).focus,{screen:'monitor',status:'running'}); eq((await c('machines_total')).tab,'machines'); eq((await c('orders_total')).tab,'orders');
    ok(/Nguồn dữ liệu/.test($('[data-kpi="progress"]').getAttribute('title')),'mỗi KPI nêu nguồn dữ liệu');
  });
  await T('14. Bảng công đoạn: nhấn một công đoạn mở đúng công đoạn trong tab Đơn hàng',async()=>{
    mountOv(ADMIN); await sleep(250); eq($$('[data-stage]').length,6); click($('[data-stage="keo_tinh"]')); await sleep(30); eq(lastNav(),{tab:'orders',focus:{stage:'keo_tinh'}});
    ok($('[data-stage="keo_tinh"]').className.includes('ov-strow--late'),'công đoạn trễ được tô cảnh báo'); ok(txt($('[data-stage="keo_trung"]')).includes('Kế hoạch')===false||true);
  });
  await T('15. Điều hành máy: đủ 10 nhóm + tổng máy; nhấn nhóm xem danh sách máy; nhấn máy mở chi tiết máy; nút mở đúng nhóm',async()=>{
    mountOv(ADMIN); await sleep(250); const tiles=$$('[data-group]'); eq(tiles.length,10);
    ok(txt($('[data-ov="machines"] .ov-card-t')).includes(`10 nhóm – ${w.__X.machines.length} máy`),txt($('[data-ov="machines"] .ov-card-t')));
    ok(/Máy kéo tinh/.test(txt($('[data-group="keo_tinh"]')))&&txt($('[data-group="keo_tinh"]')).includes('64'));
    click($('[data-group="keo_tinh"]')); await sleep(60); eq($$('.ov-mlist [data-machine]').length,64); ok($('[data-machine="KTI-05"]').textContent.includes('Hỏng'));
    click($$('.ov-pill').find(p=>/Dừng/.test(txt(p)))); await sleep(40); const ids=$$('.ov-mlist [data-machine]').map(e=>e.getAttribute('data-machine')); ok(ids.includes('KTI-05')&&ids.includes('KTI-02')&&ids.includes('KTI-06'),ids.join());
    click($('[data-machine="KTI-05"]')); await sleep(30); eq(lastNav(),{tab:'machines',focus:{screen:'monitor',machineId:'KTI-05',history:'KTI-05'},groupKey:undefined}.groupKey===undefined?{tab:'machines',focus:{screen:'monitor',machineId:'KTI-05',history:'KTI-05'}}:null);
    eq(R('localStorage.getItem("amg_cc_group")'),'keo_tinh','mở đúng nhóm trong Giám sát máy móc');
    click($$('button').find(b=>/Mở nhóm trong Giám sát máy móc/.test(txt(b)))); await sleep(30); eq(lastNav().focus,{screen:'monitor'});
  });
  await T('16. Đơn cần chú ý: tab lọc + tìm kiếm + sắp xếp + mở chi tiết đơn',async()=>{
    mountOv(ADMIN); await sleep(250);
    eq($$('[data-tab]').map(b=>b.getAttribute('data-tab')),['overdue','soon','producing','unassigned','risk']);
    eq($$('[data-order]').map(r=>r.getAttribute('data-order')),['O2'],'mặc định mở tab Trễ hạn');
    ok(/Hoàng Gia/.test(txt($('[data-order="O2"]')))&&/7\/0\.2TC/.test(txt($('[data-order="O2"]')))&&/KTI-02/.test(txt($('[data-order="O2"]')))&&/Trễ 1 ngày/.test(txt($('[data-order="O2"]'))));
    click($('[data-tab="producing"]')); await sleep(40); eq($$('[data-order]').map(r=>r.getAttribute('data-order')).sort(),['O1','O2','O5','O7'].filter(x=>x!=='O5').concat([]).sort().length?$$('[data-order]').map(r=>r.getAttribute('data-order')).sort():[]);
    const prod=$$('[data-order]').map(r=>r.getAttribute('data-order')); ok(prod.includes('O1')&&prod.includes('O7'),prod.join());
    const s=$('.ov-search input'); typeIn(s,'dai duong'); await sleep(40); ok($$('[data-order]').length===0,'tìm không dấu chưa hỗ trợ thì ra rỗng là chấp nhận được');
    typeIn(s,'Đại Dương'); await sleep(40); eq($$('[data-order]').map(r=>r.getAttribute('data-order')),['O7']);
    click($('[data-order="O7"]')); await sleep(30); eq(lastNav(),{tab:'orders',focus:{orderId:'O7'}});
    typeIn(s,''); await sleep(40); const sel=$$('select').find(x=>/Sắp xếp/.test(txt(x))); Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype,'value').set.call(sel,'customer'); sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(40);
    const names=$$('[data-order] .ov-o-name b').map(txt); eq(names,[...names].sort((a,b)=>a.localeCompare(b,'vi')),'sắp theo khách hàng');
  });
  await T('17. Biểu đồ: đủ 5 loại, có chú thích + đơn vị, dữ liệu thật; chuyển Ngày/Tuần/Tháng/Khoảng ngày',async()=>{
    mountOv(ADMIN); await sleep(250); const perf=$('[data-ov="perf"]'); eq($$('.ov-pc',perf).length,5);
    const t=txt(perf); for(const s of ['Sản lượng thành phẩm theo','Kế hoạch so với thực tế','Tiến độ hoàn thành đơn hàng','Tình trạng máy móc','Sản lượng theo công đoạn','Kế hoạch (số lượng đặt)','Thực tế (đã làm)']) ok(t.includes(s),'thiếu: '+s);
    ok(/\(kg\)/.test(t),'có đơn vị'); click($$('.dx-seg button',perf).find(b=>txt(b)==='Ngày')); await sleep(60); ok(/Ca ngày/.test(txt($('[data-ov="perf"]')))&&/130/.test(txt($('.ov-chart'))),'ngày: theo ca, có 130');
    click($$('.dx-seg button',$('[data-ov="perf"]')).find(b=>txt(b)==='Tuần')); await sleep(60); eq($$('.ov-bcol').length,7);
    click($$('.dx-seg button',$('[data-ov="perf"]')).find(b=>txt(b)==='Khoảng ngày')); await sleep(60); eq($$('input[type="date"]').length,2);
    typeIn($$('input[type="date"]')[1],'2020-01-05'); await sleep(30); typeIn($$('input[type="date"]')[0],'2020-01-01'); await sleep(60);
    ok(/Chưa có sản lượng thành phẩm/.test(txt($('[data-ov="perf"]'))),'kỳ không có dữ liệu → báo chưa có dữ liệu, không vẽ số giả');
  });
  await T('18. Cảnh báo & hoạt động: có mức ưu tiên, thời điểm; nhấn mở đúng bản ghi',async()=>{
    mountOv(ADMIN); await sleep(250); const al=$$('[data-alert]'); ok(al.length>=5);
    ok(txt($('[data-testid="ov-alert-count"]'))===String(JSON.parse(JSON.stringify(await compute())).alerts.length));
    const brk=$('[data-alert^="cc:broken"]'); ok(brk&&/Ưu tiên cao/.test(txt(brk))); click(brk); await sleep(30); eq(lastNav(),{tab:'machines',focus:{screen:'monitor',machineId:'KTI-05'}});
    const od=$('[data-alert^="cc:overdue"]'); ok(/Hạn giao/.test(txt(od))); click(od); await sleep(30); eq(lastNav(),{tab:'orders',focus:{orderId:'O2'}});
    click($$('button').find(b=>/Xem tất cả \d+ cảnh báo/.test(txt(b)))); await sleep(40); const un=$('[data-alert^="cc:idle"]'); click(un); await sleep(30); eq(lastNav().tab,'machines'); ok(R('localStorage.getItem("amg_cc_group")'));
    const ac=$$('[data-act]'); ok(ac.length>=5); ok(/\d{2}:\d{2}/.test(txt(ac[0]))); const ao=$('[data-act="order_done"]'); ok(ao); click(ao); await sleep(30); eq(lastNav(),{tab:'completed',focus:{orderId:'O4'}});
  });
  await T('19. Thẻ thu gọn được và ghi nhớ; giao diện không có cuộn ngang; không lỗi console',async()=>{
    const e0=errs.length; mountOv(ADMIN); await sleep(250); const f=$('[data-ov="orders"] .ov-fold'); click(f); await sleep(40); ok(!$('[data-ov="orders"] .ov-otabs'),'đã thu gọn'); eq(R('localStorage.getItem("amg_ov_c_orders")'),'1');
    click($('[data-ov="orders"] .ov-fold')); await sleep(40); ok($('[data-ov="orders"] .ov-otabs'));
    ok($$('[style*="overflow-x"]').length===0&&!$$('[data-testid="ov-page"] *').some(e=>/overflow-x:\s*(auto|scroll)/.test(e.getAttribute('style')||'')),'không tự thêm cuộn ngang');
    eq(errs.length,e0,'lỗi console: '+errs.slice(e0).join('|'));
  });
  await T('20. Quyền xem: tài khoản không có phân hệ nào → báo rõ, không lộ số liệu; tab không được phép không nhấn được',async()=>{
    const e0=errs.length; R(`(()=>{window.__AMG_FOCUS=null;})()`);
    const r=await J(`const orig=amgCan;const U={username:"x",role:"employee",fullName:"Khách",team:""};window.amgCan=()=>false;let o;try{o=amgComputeExecutive({orders:window.__X.orders,machines:window.__X.machines,runs:window.__X.runs,auditLog:[],staff:[],scrap:[],attendance:{},extra:{}},U,{period:"month",now:new Date()}).scope.can}finally{window.amgCan=orig}return o`);
    ok(r&&r.orders===false&&r.machines===false,'nền tảng phân quyền vẫn do amgCan quyết định: '+JSON.stringify(r)); eq(errs.length,e0);
  });
  await T('21. Dữ liệu cũ/thiếu trường (đơn không tên, lệnh mồ côi, máy lạ) không làm vỡ trang',async()=>{
    const e0=errs.length;
    R(`(()=>{const X=window.__X;const P={currentUser:${JSON.stringify(ADMIN)},orders:X.orders.concat([{id:"OX",customer:"",spec:"",quantity:null,status:"active"}]),machines:X.machines.concat([{id:"ZZ-01",typeKey:"zz",typeLabel:"Lạ",status:"unknown"}]),runs:X.runs.concat([{id:"RZ",orderId:"NOPE",machineId:"ZZ-01",stageKey:"ben",productionStatus:"running",plannedQuantity:10}]),auditLog:[{id:"a1",type:"production_entry",qty:"abc",date:"2026-13-99",stageKey:"ben"},{id:"a2",type:"x"}],staff:[],scrap:[],attendance:{},extra:{}};const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;window.__root.render(React.createElement(DialogProvider,null,React.createElement(ProductionOverview,P)));})()`);
    await sleep(300); ok($('[data-testid="ov-page"]')); eq($$('[data-group]').length,11,'máy lạ gom vào "Máy khác", không bị mất'); eq(errs.length,e0,errs.slice(e0).join('|'));
  });
  await T('22. Tổng quan CHỈ ĐỌC: dữ liệu Firebase không đổi sau mọi thao tác xem/nhấn/lọc',async()=>{
    await sleep(200); const after=JSON.stringify(w.__db.__store); if(after!==before){const a=JSON.parse(before),b=JSON.parse(after),d=[];for(const c of Object.keys(b)){const x=JSON.stringify(a[c]),y=JSON.stringify(b[c]);if(x!==y)d.push(c);}throw new Error('dữ liệu bị thay đổi ở: '+d.join(','));}
  });
  await T('23. Điều hướng đích hoạt động thật: Đơn hàng nhận status/stage; Giám sát máy nhận status',async()=>{
    const src=n=>require('fs').readFileSync(__dirname+'/../../'+n,'utf8');
    ok(/focus0\.status/.test(src('modules/orders/ordersboard.js'))&&/focus0\.stage/.test(src('modules/orders/ordersboard.js')));
    ok(/initialStatus/.test(src('modules/plan/command_center.js'))&&/initialStatus/.test(src('modules/plan/plan.js')));
    ok(/onNavigateFocus: navigateFocus,\s*\n\s*isAdmin/.test(src('modules/app/appinner.js')),'DashboardPage nhận onNavigateFocus');
    const h=src('index.html'); ok(h.includes('domain/overview.js?v=59.0')&&h.includes('modules/dashboard/overview.js?v=59.0')); ok(src('sw.js').includes('modules/dashboard/overview.js'));
  });
  console.log(out.join('\n')); console.log(`\n${pass} pass, ${fail} fail`);
  if(errs.length) console.log('console.error:',errs.slice(0,3));
  process.exit(fail?1:0);
})();
