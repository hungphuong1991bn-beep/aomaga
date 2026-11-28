/* v59 — Kiểm thử ĐỒNG BỘ ĐA THIẾT BỊ / CHỐNG GHI ĐÈ / OFFLINE / THIẾT BỊ MỚI / GỬI LẶP / PHỤC HỒI LỖI.
   Nhiều cửa sổ jsdom cùng nối vào một máy chủ RTDB giả lập (fakertdb.js).
   Chạy: NM=<node_modules> APP_DIR=../.. node accept59_sync.js */
const {load}=require('./harness'); const rt=require('./fakertdb');
let pass=0,fail=0;const out=[];
async function T(n,f){try{await f();pass++;out.push('PASS '+n);}catch(e){fail++;out.push('FAIL '+n+' :: '+(e&&e.message||e));}}
const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a));};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert');};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000,msg='timeout'){const t0=Date.now();for(;;){try{if(await fn())return;}catch(e){}if(Date.now()-t0>ms)throw new Error(msg);await sleep(20);}}
const dev=(server,name,seedStorage)=>{ const t=load({server,storage:seedStorage}); const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
  const J=async c=>JSON.parse(await A('return JSON.stringify(await (async()=>{'+c+'})())'));
  const get=async(col,id)=>J(`const s=await db.collection("${col}").doc("${id}").get();return (typeof s.exists==="function"?s.exists():s.exists)?s.data():null`);
  const as=(role,n)=>R(`window.__AMG_USER={username:"${role}",role:"${role}",fullName:"${n||role}"}`);
  const offline=()=>{ t.w.__net.online=false; t.w.dispatchEvent(new t.w.Event('offline')); };
  const online=()=>{ t.w.__net.online=true; t.w.dispatchEvent(new t.w.Event('online')); R('window.__rtdbResync&&window.__rtdbResync()'); };
  const storage=()=>{ const o={}; for(let i=0;i<t.w.localStorage.length;i++){ const k=t.w.localStorage.key(i); o[k]=t.w.localStorage.getItem(k); } return o; };
  return {name,t,w:t.w,R,A,J,get,as,offline,online,storage}; };
const srvDoc=(s,col,id)=>{ const v=s.getPath('/'+col+'/'+id); return v&&v.d?JSON.parse(v.d):null; };
const connected=d=>until(async()=>d.R('window.__rtdbStatus.state')==='online',3000,d.name+' chưa kết nối');
const ORDER={id:'S-1',customer:'KH cũ',spec:'0.254BC',quantity:100,note:'ghi chú gốc'};
(async()=>{
  // ───────── KT1: đồng bộ đa thiết bị tức thì ─────────
  await T('KT1. A tạo/sửa đơn → B nhận tự động, không F5',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'),b=dev(s,'B'); a.as('admin','A'); b.as('admin','B'); await connected(a); await connected(b);
    await a.A(`await db.collection("orders").doc("S-1").set(${JSON.stringify(ORDER)})`);
    await until(async()=>(await b.get('orders','S-1'))?.quantity===100,2000,'B không thấy đơn mới');
    await a.A(`await db.collection("orders").doc("S-1").set({quantity:150},{merge:true})`);
    await until(async()=>(await b.get('orders','S-1'))?.quantity===150,2000,'B không thấy sửa đổi');
  });
  // ───────── KT2: hai người sửa HAI TRƯỜNG KHÁC NHAU (B đang giữ dữ liệu cũ) ─────────
  await T('KT2. A sửa số lượng, B (dữ liệu cũ) sửa khách hàng → cả hai thay đổi đều còn',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'),b=dev(s,'B'); a.as('admin','A'); b.as('admin','B'); await connected(a); await connected(b);
    await a.A(`await db.collection("orders").doc("S-1").set(${JSON.stringify(ORDER)})`);
    await until(async()=>!!(await b.get('orders','S-1')),2000);
    b.offline(); // B giữ bản cũ, sửa khách hàng bằng cả bản ghi cũ (như biểu mẫu mở từ trước)
    await a.A(`await db.collection("orders").doc("S-1").set({quantity:200},{merge:true})`);
    await b.A(`await db.collection("orders").doc("S-1").set(Object.assign({},${JSON.stringify(ORDER)},{customer:"KH mới"}),{merge:true})`);
    b.online();
    await until(async()=>{ const d=srvDoc(s,'orders','S-1'); return d&&d.customer==='KH mới'; },4000,'thay đổi của B chưa lên máy chủ');
    const d=srvDoc(s,'orders','S-1'); eq(d.quantity,200,'thay đổi số lượng của A bị ghi đè âm thầm'); eq(d.customer,'KH mới');
  });
  // ───────── KT3: cùng sửa MỘT trường → phát hiện xung đột, không ghi đè âm thầm ─────────
  await T('KT3. A và B cùng sửa số lượng → phát hiện xung đột, giữ giá trị của A, không mất giá trị của B',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'),b=dev(s,'B'); a.as('admin','A'); b.as('admin','B'); await connected(a); await connected(b);
    await a.A(`await db.collection("orders").doc("S-1").set(${JSON.stringify(ORDER)})`);
    await until(async()=>!!(await b.get('orders','S-1')),2000);
    b.offline();
    await a.A(`await db.collection("orders").doc("S-1").set({quantity:200},{merge:true})`);
    await until(async()=>srvDoc(s,'orders','S-1')?.quantity===200,2000);
    await b.A(`await db.collection("orders").doc("S-1").set({quantity:300},{merge:true})`);
    b.online();
    await until(async()=>(b.R('window.__rtdbStatus.conflicts')||0)>=1,4000,'không phát hiện xung đột');
    eq(srvDoc(s,'orders','S-1').quantity,200,'máy chủ bị ghi đè âm thầm');
    const list=b.R('JSON.stringify(window.__rtdbConflicts?window.__rtdbConflicts():[])'); ok(list.includes('300'),'giá trị của B phải được giữ lại để đối chiếu: '+list);
  });
  // ───────── KT4: mất mạng → hàng đợi bền vững qua đóng/mở lại ─────────
  await T('KT4. Mất mạng: thao tác vào hàng đợi, đóng/mở lại vẫn còn, có mạng thì tự gửi; hàng đợi có mã/người/thiết bị',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); a.as('admin','Quản trị A'); await connected(a);
    a.offline();
    await a.A(`await db.collection("orders").doc("OFF-1").set({id:"OFF-1",customer:"KH off",quantity:5})`);
    eq(a.R('window.__rtdbStatus.pending')>=1,true,'pending phải >=1');
    ok(!srvDoc(s,'orders','OFF-1'),'chưa có trên máy chủ');
    const q=JSON.parse(a.w.localStorage.getItem('amg_mes_rtdb_queue_v1')||'[]'); ok(q.length>=1,'hàng đợi chưa lưu');
    ok(q[0].id&&q[0].ts&&q[0].dev,'mục hàng đợi thiếu mã/thời điểm/thiết bị: '+JSON.stringify(Object.keys(q[0])));
    // mở lại ứng dụng (cửa sổ mới, cùng localStorage), vẫn mất mạng
    const a2=dev(s,'A2',a.storage()); a2.as('admin','Quản trị A'); a2.offline();
    eq(JSON.parse(a2.w.localStorage.getItem('amg_mes_rtdb_queue_v1')||'[]').length>=1,true,'hàng đợi mất sau khi mở lại');
    a2.online(); await until(async()=>!!srvDoc(s,'orders','OFF-1'),5000,'không tự gửi khi có mạng');
    await until(async()=>a2.R('window.__rtdbStatus.pending')===0,3000,'pending chưa về 0');
  });
  // ───────── KT5: thiết bị mới — tải dữ liệu thật, KHÔNG gieo đơn/nhân sự/phế liệu mẫu ─────────
  await T('KT5a. Thiết bị mới + máy chủ có dữ liệu thật: tải đủ, không thêm dữ liệu mẫu',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); a.as('admin','A'); await connected(a);
    await a.A(`await db.collection("orders").doc("REAL-1").set({id:"REAL-1",customer:"Khách thật",quantity:7})`);
    await until(async()=>!!srvDoc(s,'orders','REAL-1'),2000);
    const before=Object.keys(s.root.orders||{}).length;
    const c=dev(s,'C'); c.as('admin','C'); await connected(c);
    await until(async()=>(await c.get('orders','REAL-1'))?.customer==='Khách thật',3000,'thiết bị mới không tải được dữ liệu');
    await sleep(300); eq(Object.keys(s.root.orders||{}).length,before,'thiết bị mới đã ghi thêm đơn lên máy chủ');
  });
  await T('KT5b. Máy chủ trống + thiết bị mới: không tạo đơn hàng/nhân sự/phế liệu mẫu trong dữ liệu thật',async()=>{
    const s=rt.makeServer(); const c=dev(s,'C'); c.as('admin','C'); await connected(c); await sleep(800);
    eq(Object.keys(s.root.orders||{}).length,0,'đã gieo đơn mẫu vào dữ liệu thật');
    eq(Object.keys(s.root.staff||{}).length,0,'đã gieo nhân sự mẫu'); eq(Object.keys(s.root.scrap||{}).length,0,'đã gieo phế liệu mẫu');
  });
  // ───────── KT6: nâng cấp phiên bản — hàng đợi và dữ liệu cục bộ còn nguyên ─────────
  await T('KT6. Mở bản mới với dữ liệu cục bộ cũ: hàng đợi chờ gửi (định dạng cũ + mới) không bị xóa, được gửi lên',async()=>{
    const s=rt.makeServer(); const legacy=JSON.stringify([{w:{'orders/LEG-1':{d:JSON.stringify({id:'LEG-1',customer:'Từ bản cũ'}),t:1}}}]);
    const c=dev(s,'C',{amg_mes_rtdb_queue_v1:legacy}); c.as('admin','C'); c.R('0');
    await until(async()=>!!srvDoc(s,'orders','LEG-1'),5000,'mục hàng đợi định dạng cũ không được gửi');
  });
  // ───────── KT7: gửi lặp → không tạo bản ghi trùng ─────────
  await T('KT7. Máy chủ đã nhận nhưng phản hồi bị mất (gửi lại nhiều lần) → vẫn đúng 1 đơn, 1 dòng nhật ký',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); a.as('admin','A'); await connected(a);
    const orig=a.w.fetch; let drops=2;
    a.w.fetch=(url,init={})=>{ const p=orig(url,init); if((init.method==='PATCH'||init.method==='PUT')&&drops>0){ drops--; return p.then(()=>{ throw new Error('mất phản hồi'); }); } return p; };
    await a.A(`const id="DUP-1"; await db.collection("orders").doc(id).set({id,customer:"Một lần",quantity:1}); await db.collection("auditLog").doc("AL-DUP-1").set({id:"AL-DUP-1",type:"order_add",targetId:id,ts:new Date().toISOString()});`);
    await until(async()=>a.R('window.__rtdbStatus.pending')===0,12000,'hàng đợi không về 0');
    eq(Object.keys(s.root.orders).filter(k=>k==='DUP-1').length,1); eq(Object.keys(s.root.auditLog||{}).filter(k=>k.includes('DUP-1')).length,1);
  });
  await T('KT7b. Hai lệnh ghi cùng lúc qua amgSafeUpdate từ hai thiết bị: cả hai cùng được áp dụng (không mất lần nào)',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'),b=dev(s,'B'); a.as('admin','A'); b.as('admin','B'); await connected(a); await connected(b);
    await a.A(`await db.collection("orders").doc("INC-1").set({id:"INC-1",customer:"KH",quantity:0,counter:0})`);
    await until(async()=>!!(await b.get('orders','INC-1')),2000);
    const inc=d=>d.A(`for(let i=0;i<5;i++){ await amgSafeUpdate("orders","INC-1",o=>Object.assign({},o,{counter:(o.counter||0)+1})); }`);
    await Promise.all([inc(a),inc(b)]);
    await until(async()=>srvDoc(s,'orders','INC-1')?.counter===10,5000,'mất bản cập nhật: counter='+srvDoc(s,'orders','INC-1')?.counter);
  });
  // ───────── KT8: lỗi máy chủ — không mất dữ liệu cục bộ, tự phục hồi; máy chủ từ chối (400) không làm mất thao tác ─────────
  await T('KT8a. Máy chủ lỗi 500 rồi hoạt động lại: dữ liệu cục bộ giữ nguyên và tự đồng bộ',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); a.as('admin','A'); await connected(a);
    s.online=false; await a.A(`await db.collection("orders").doc("REC-1").set({id:"REC-1",customer:"KH rec",quantity:9})`);
    eq((await a.get('orders','REC-1'))?.quantity,9,'dữ liệu cục bộ mất'); ok(!srvDoc(s,'orders','REC-1'));
    s.online=true; a.R('window.__rtdbResync()'); await until(async()=>!!srvDoc(s,'orders','REC-1'),9000,'không tự phục hồi');
  });
  await T('KT8b. Máy chủ trả 400 cho một thao tác: thao tác KHÔNG bị bỏ mất âm thầm (được giữ để xem/gửi lại) và báo lỗi trên trạng thái',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); a.as('admin','A'); await connected(a);
    const orig=a.w.fetch; let rejectOnce=true;
    a.w.fetch=(url,init={})=>{ if(init.method==='PATCH'&&rejectOnce){ rejectOnce=false; return Promise.resolve({ok:false,status:400,json:async()=>({}),headers:{get:()=>null}}); } return orig(url,init); };
    await a.A(`await db.collection("orders").doc("BAD-1").set({id:"BAD-1",customer:"KH bad",quantity:3})`);
    await until(async()=>a.R('window.__rtdbStatus.pending')===0,4000,'hàng đợi kẹt');
    const failed=JSON.parse(a.w.localStorage.getItem('amg_mes_rtdb_failed_v1')||'[]'); ok(failed.length>=1&&JSON.stringify(failed).includes('BAD-1'),'thao tác bị từ chối đã mất, không được lưu lại');
    ok((a.R('window.__rtdbStatus.failed')||0)>=1,'trạng thái không báo số thao tác lỗi');
  });
  // ───────── KT2b/KT3b: biểu mẫu sửa đơn (bản chụp lúc mở) ─────────
  await T('KT2b. Biểu mẫu cũ chỉ sửa khách hàng: số lượng do người khác vừa đổi KHÔNG bị ghi đè bằng số cũ trên form',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); await connected(a);
    const r=a.R(`(()=>{ const u={fullName:"B"}; const open={id:"X",customer:"KH cũ",materialCode:"B",spec:"0.254",quantity:100,unit:"kg",note:"",orderDate:"2026-11-01",deliveryDate:"",priority:"normal",inventory:0,routing:[]};
      const be=amgOrderEditorShape(open,u); const upd=Object.assign({id:"X"},amgOrderEditorShape(Object.assign({},open,{customer:"KH mới"}),u));
      const cur=Object.assign({},open,{quantity:200}); // A đã đổi số lượng sau khi B mở form
      return JSON.stringify(amgMergeOrderEdit(cur,upd,be,u)); })()`);
    const m=JSON.parse(r); eq(m.customer,'KH mới'); eq(m.quantity,200,'số lượng của người khác bị ghi đè bằng số cũ');
  });
  await T('KT3b. Biểu mẫu cũ sửa số lượng mà người khác cũng vừa sửa số lượng khác → báo xung đột, không ghi',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); await connected(a);
    const msg=a.R(`(()=>{ const u={fullName:"B"}; const open={id:"X",customer:"KH",materialCode:"B",spec:"0.254",quantity:100,unit:"kg",note:"",orderDate:"2026-11-01",deliveryDate:"",priority:"normal",inventory:0};
      const be=amgOrderEditorShape(open,u); const upd=Object.assign({id:"X"},amgOrderEditorShape(Object.assign({},open,{quantity:300}),u));
      try{ amgMergeOrderEdit(Object.assign({},open,{quantity:200}),upd,be,u); return "NO-ERROR"; }catch(e){ return e.code+"|"+e.message; } })()`);
    ok(msg.startsWith('version-conflict|')&&msg.includes('Số lượng'),'phải báo xung đột trường Số lượng: '+msg);
  });
  await T('KT3c. Cùng đặt ngày giao từ trống: không báo xung đột giả (bản máy chủ chưa có trường này)',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); await connected(a);
    const r=JSON.parse(a.R(`(()=>{ const u={fullName:"B"}; const open={id:"X",customer:"KH",materialCode:"B",spec:"0.254",quantity:100,unit:"kg",note:"",orderDate:"2026-11-01",priority:"normal"};
      const be=amgOrderEditorShape(open,u); const upd=Object.assign({id:"X"},amgOrderEditorShape(Object.assign({},open,{deliveryDate:"2026-12-01"}),u));
      return JSON.stringify(amgMergeOrderEdit(Object.assign({},open),upd,be,u)); })()`)); eq(r.deliveryDate,'2026-12-01');
  });
  // ───────── Trạng thái đồng bộ trên header ─────────
  await T('TT. amgSyncView có đủ trạng thái: syncing / synced / offline / error / conflict',async()=>{
    const s=rt.makeServer(); const a=dev(s,'A'); await connected(a);
    const v=(o)=>a.R(`amgSyncView(${JSON.stringify(Object.assign({state:'online',pending:0,lastSync:Date.now(),lastRemote:0,readError:'',writeError:'',conflicts:0,failed:0},o))},Date.now()).key`);
    eq(v({conflicts:1}),'conflict'); eq(v({state:'offline'}),'offline'); eq(v({pending:2}),'syncing'); eq(v({writeError:'x'}),'error'); eq(v({failed:1}),'error');
  });
  console.log(out.join('\n')); console.log(pass+' pass, '+fail+' fail'); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
