const {load}=require('./harness');
const fs=require('fs');
const rt=require('./fakertdb'); const server=rt.makeServer(); server.root=JSON.parse(fs.readFileSync('/tmp/db.json','utf8')); // "tải lại trang": thiết bị mới đọc lại toàn bộ dữ liệu đã lưu trên máy chủ
const t=load({server});
const errs=[];
t.w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
t.w.addEventListener('error',e=>errs.push('uncaught: '+e.message));
const A=async code=>await t.run('(async()=>{'+code+'})()');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  t.run('window.__AMG_USER={username:"admin",role:"admin",fullName:"Quản trị"}');
  // test 14: tải lại trang không mất liên kết
  const runs=JSON.parse(await A('const a=[];await new Promise(r=>{db.collection("productionRuns").onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()})});return JSON.stringify(a)'));
  console.log('reload: runs persisted =',runs.length,' RUN-E machine',runs.find(r=>r.id==='RUN-E')&&runs.find(r=>r.id==='RUN-E').machineId);
  const orders=JSON.parse(await A('const a=[];await new Promise(r=>{db.collection(FS.orders).onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()})});return JSON.stringify(a)'));
  const machines=JSON.parse(await A('const a=[];await new Promise(r=>{db.collection(FS.machines).onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()})});return JSON.stringify(a)'));
  const entries=JSON.parse(await A('const a=[];await new Promise(r=>{db.collection("productionEntries").onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()})});return JSON.stringify(a)'));
  const audit=JSON.parse(await A('const a=[];await new Promise(r=>{db.collection(FS.audit).onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()})});return JSON.stringify(a)'));
  console.log('orders',orders.length,'machines',machines.length,'legacy orders (no routing):',orders.filter(o=>!o.routing).length);
  t.w.__P={orders,machines,runs,entries,audit};
  const render=async(name,expr,check)=>{
    const before=errs.length;
    t.run(`(()=>{const P=window.__P;const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;
      window.__root.render(React.createElement(DialogProvider,null,${expr}));})()`);
    await sleep(150);
    const html=t.w.__rootEl.innerHTML;
    const newErr=errs.slice(before);
    console.log((newErr.length?'FAIL ':'PASS ')+name+' (html '+html.length+' chars)'+(newErr.length?' :: '+newErr[0]:''));
    if(check) { const r=check(html); console.log('   ',r); }
    t.run('window.__root.unmount();window.__rootEl.remove()');
    await sleep(30);
  };
  const user='{username:"admin",role:"admin",fullName:"Quản trị"}';
  await render('PlanPage',`React.createElement(PlanPage,{orders:P.orders,machines:P.machines,runs:P.runs,entries:P.entries,staff:[],currentUser:${user},isAdmin:true,canEdit:true,onUpdateMachine(){},onAddMachine(){},onDeleteMachine(){},onRestoreSeed(){}})`,h=>['Chưa phân máy','Đang sản xuất','Phân máy'].map(k=>k+':'+h.includes(k)).join(' '));
  await render('OrdersPage',`React.createElement(OrdersPage,{orders:P.orders,runs:P.runs,machines:P.machines,auditLog:P.audit,isAdmin:true,currentUser:${user},onAdd(){},onUpdate(){},onDelete(){},onBulkDelete(){},onRestoreSeed(){},extra:{}})`,h=>['Tổng đơn hàng','Quá hạn','KHÁCH HÀNG','NGUYÊN LIỆU','ĐÃ SẢN XUẤT','THAO TÁC'].map(k=>k+':'+h.includes(k)).join(' '));
  await render('CompletedOrdersPage',`React.createElement(CompletedOrdersPage,{orders:P.orders,runs:P.runs,entries:P.entries,auditLog:P.audit,extra:{},scrap:[],currentUser:${user}})`,h=>'ORD-T6 hiển thị:'+h.includes('ORD-T6')+' | ORD-T2 (chưa xong) hiển thị trong bảng:'+(h.split('Chờ xác nhận')[0].length>0));
  await render('OrderEditor(add)',`React.createElement(OrderEditor,{mode:'add',orders:P.orders,runs:P.runs,machines:P.machines,onSave(){},onClose(){}})`,h=>['Kéo trung','Kéo siêu tinh','Ủ nhiệt','Mạ thiếc','Bện','KT-01','B300'].map(k=>k+':'+h.includes(k)).join(' '));
  await render('OrderEditor(edit order có sản lượng)',`React.createElement(OrderEditor,{mode:'edit',order:P.orders.find(o=>o.id==='ORD-T2'),orders:P.orders,runs:P.runs,machines:P.machines,onSave(){},onClose(){}})`,h=>'cảnh báo đã phân máy/sản lượng:'+h.includes('đã có sản lượng')+' khóa:'+h.includes('🔒'));
  await render('MachineCard TV running',`React.createElement(MachineCard,{machine:P.machines.find(m=>m.id==='KT-01'),runs:P.runs,orders:P.orders,can:{},openModal(){},act(){},tv:true})`,h=>'KT-01 hiển thị đơn:'+(h.includes('ORD-T1')||h.includes('ORD-P'))+' ĐANG CHẠY:'+h.includes('ĐANG CHẠY'));
  await render('MachineCard broken',`React.createElement(MachineCard,{machine:P.machines.find(m=>m.id==='KT-03'),runs:P.runs,orders:P.orders,can:{plan:true},openModal(){},act(){},tv:false})`,h=>'HỎNG:'+h.includes('HỎNG')+' CHƯA PHÂN CÔNG:'+h.includes('CHƯA PHÂN CÔNG')+' nút Phân lệnh bị ẩn:'+!h.includes('Phân lệnh'));
  await render('MachineCard idle',`React.createElement(MachineCard,{machine:P.machines.find(m=>m.id==='KT-02'),runs:[],orders:P.orders,can:{plan:true},openModal(){},act(){},tv:false})`,h=>'CHƯA PHÂN CÔNG:'+h.includes('CHƯA PHÂN CÔNG'));
  await render('AssignModal(fixed machine)',`React.createElement(AssignModal,{orders:P.orders,machines:P.machines,runs:P.runs,staff:[],fixedMachine:P.machines.find(m=>m.id==='KT-02'),onClose(){},onDone(){}})`);
  await render('AssignModal(order)',`React.createElement(AssignModal,{order:P.orders.find(o=>o.id==='ORD-T3'),orders:P.orders,machines:P.machines,runs:P.runs,staff:[],initialStage:'keo_tinh',onClose(){},onDone(){}})`,h=>'chỉ máy KTI (không có KT-0x/UN):'+(h.includes('KTI-64')&&!h.includes('>UN-01<')&&!h.includes('>KT-01<')));
  await render('OutputModal',`React.createElement(OutputModal,{run:P.runs.find(r=>r.id==='RP0')||P.runs[0],orders:P.orders,machines:P.machines,onClose(){},onDone(){}})`);
  await render('FinishRunModal',`React.createElement(FinishRunModal,{run:P.runs.find(r=>r.id==='RUN-E'),orders:P.orders,runs:P.runs,onClose(){},onDone(){}})`);
  await render('CompletedDetailModal',`React.createElement(CompletedDetailModal,{order:P.orders.find(o=>o.id==='ORD-T6'),runs:P.runs,entries:P.entries,auditLog:P.audit,extra:{},scrap:[],onClose(){}})`,h=>'có máy KT-02/KTI-02:'+(h.includes('KT-02')||h.includes('KTI-02')));
  await render('OrderDetailModal (đơn cũ)',`React.createElement(OrderDetailModal,{order:P.orders.find(o=>o.id==='ORD001'),auditLog:P.audit,extra:{},runs:P.runs,isAdmin:true,onClose(){},onUpdate(){},onEdit(){}})`);
  await render('TVWall',`React.createElement(TVWall,{machines:P.machines,runs:P.runs,orders:P.orders,onClose(){}})`);
  await render('MachineHistoryModal',`React.createElement(MachineHistoryModal,{machine:P.machines.find(m=>m.id==='KT-02'),runs:P.runs,orders:P.orders,entries:P.entries,onClose(){}})`,h=>'có lịch sử:'+h.includes('ORD-T'));
  // 13: xuất Excel
  const xl=JSON.parse(await A(`
    let captured=null; const orig=XLSX.writeFile; XLSX.writeFile=(wb,name)=>{captured={name,sheets:wb.SheetNames,rows:XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])};};
    const o=window.__P.orders.filter(x=>x.status==='completed');
    amgExportExcel('don-hang-hoan-thanh',[{key:'id',label:'Mã đơn'},{key:'customer',label:'Khách hàng'},{key:'fin',label:'Thành phẩm',export:x=>amgOrderReadiness(x).finished}],o,'Đơn hoàn thành');
    XLSX.writeFile=orig; return JSON.stringify(captured);`));
  console.log('Excel:',xl.name,xl.sheets,'rows',xl.rows.length,JSON.stringify(xl.rows[0]));
  console.log('\nlỗi console.error tổng:',errs.length); errs.slice(0,5).forEach(e=>console.log(' -',e));
  process.exit(0);
})();
