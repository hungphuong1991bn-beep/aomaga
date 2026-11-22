const {load}=require('./harness');
const t=load();t.w.db=undefined;
const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
let pass=0,fail=0;const out=[];
const T=async(n,f)=>{try{await f();pass++;out.push('PASS '+n)}catch(e){fail++;out.push('FAIL '+n+' :: '+(e.message||e)+(process.env.STACK?'\n'+e.stack:''))}};
const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a))};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert')};
async function rejects(p,sub){try{await p}catch(e){if(sub&&!String(e.message).includes(sub))throw new Error('wrong error: '+e.message);return}throw new Error('expected rejection')}
const as=u=>R('window.__AMG_USER='+JSON.stringify(u));
const ADMIN={username:'admin',role:'admin',fullName:'Admin'},QD={username:'qd',role:'manager',fullName:'QĐ'},NV={username:'nv',role:'employee',fullName:'NV'};
(async()=>{
 as(ADMIN);
 await T('Vai trò suy từ role: admin→Admin, manager→Quản đốc, employee/lạ→Nhân viên',async()=>{
   eq(R('[amgRoleOf({role:"admin"}),amgRoleOf({role:"manager"}),amgRoleOf({role:"employee"}),amgRoleOf({role:"employee",roleV2:"gd"}),amgRoleOf({role:"zzz"})]'),['qt','qd','nv','nv','nv']);
   eq(R('Object.keys(AMG_ROLES)'),['qt','qd','nv']);
 });
 await T('Tab hiển thị: Nhân viên thấy TẤT CẢ trừ Phân quyền/Quản trị; Quản đốc cũng vậy; Admin thấy hết',async()=>{
   const vis=u=>R(`NAV_ITEMS.filter(n=>n.roles.includes(${JSON.stringify(u.role)})&&(!n.mod||amgIsPower(${JSON.stringify(u)})||amgCan(${JSON.stringify(u)},"v",n.mod))).map(n=>n.key)`);
   const all=R('NAV_ITEMS.map(n=>n.key)');
   const adm=vis(ADMIN),qd=vis(QD),nv=vis(NV);
   eq(adm.length,all.length,'admin');
   eq(all.filter(k=>!qd.includes(k)).sort(),['admin','perms'],'qd');
   eq(all.filter(k=>!nv.includes(k)).sort(),['admin','perms'],'nv');
   ok(nv.includes('orders')&&nv.includes('machines')&&nv.includes('completed')&&nv.includes('warehouse')&&nv.includes('reports2'));
 });
 await T('Ma trận: Nhân viên chỉ xem ở Đơn hàng; điều khiển Điều hành/Máy; Quản đốc đủ quyền trừ Quản trị',async()=>{
   const can=(u,a,m)=>R(`amgCan(${JSON.stringify(u)},"${a}","${m}")`);
   ok(!can(NV,'t','don')&&!can(NV,'s','don')&&!can(NV,'x','don')&&can(NV,'v','don'));
   ok(can(NV,'s','dieuhanh')&&can(NV,'t','dieuhanh')&&can(NV,'t','tong')&&can(NV,'s','may'));
   ok(!can(NV,'v','quantri')&&!can(QD,'v','quantri')&&can(ADMIN,'v','quantri'));
   for(const m of ['tong','don','dieuhanh','may','kho','qc','nhansu','dung','baocao','tailieu']) for(const a of 'vtsxcp') ok(can(QD,a,m),'QD '+a+m);
 });
 await T('Quyền ghi dữ liệu: users chỉ Admin; Quản đốc xóa đơn/máy được; Nhân viên không xóa',async()=>{
   const w=(u,col,op)=>R(`amgCheckWrite(${JSON.stringify(u)},"${col}","${op}","x",{})`).ok;
   ok(w(ADMIN,'users','set')&&!w(QD,'users','set')&&!w(QD,'users','delete')&&!w(NV,'users','set'));
   ok(w(QD,'orders','delete')&&w(QD,'machines','delete')&&w(QD,'certificates','delete'));
   ok(!w(NV,'orders','delete')&&w(NV,'orders','set')&&w(NV,'productionRuns','set'));
 });
 await T('Lập tài khoản: chỉ Admin; Quản đốc/Nhân viên bị chặn',async()=>{
   as(QD); await rejects(A('await amgCreateAccount({username:"abc.def",password:"123456",role:"employee",fullName:"x"},[])'),'Chỉ Admin');
   as(NV); await rejects(A('await amgCreateAccount({username:"abc.def",password:"123456",role:"employee",fullName:"x"},[])'),'Chỉ Admin');
   as(ADMIN);
 });
 await T('Admin lập Quản đốc + Nhân viên; kiểm tra tên/mật khẩu/trùng; không lưu mật khẩu chữ',async()=>{ console.log('USER NOW',R('JSON.stringify(window.__AMG_USER)'));
   await A('await amgCreateAccount({username:"quan.doc",password:"matkhau1",role:"manager",fullName:"Quản Đốc A"},[])');
   await A('await amgCreateAccount({username:"nv.an",password:"matkhau2",role:"employee",fullName:"Nhân Viên An",team:"KÉO"},[])');
   const us=JSON.parse(await A('const a=[];await new Promise(r=>db.collection(FS.users).onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()}));return JSON.stringify(a)'));
   const qd=us.find(u=>u.username==='quan.doc'),nv=us.find(u=>u.username==='nv.an');
   eq([qd.role,nv.role,nv.team],['manager','employee','KÉO']);
   ok(qd.pwHash&&!('password' in qd)&&!JSON.stringify(us).includes('matkhau'),'không được lưu mật khẩu dạng chữ');
   await rejects(A(`await amgCreateAccount({username:"quan.doc",password:"123456",role:"employee"},${JSON.stringify(us)})`),'đã tồn tại');
   await rejects(A('await amgCreateAccount({username:"ab",password:"123456",role:"employee"},[])'),'Tên đăng nhập');
   await rejects(A('await amgCreateAccount({username:"hop.le",password:"123",role:"employee"},[])'),'Mật khẩu');
   await rejects(A('await amgCreateAccount({username:"hop.le",password:"123456",role:"superuser"},[])'),'Vai trò');
   t.w.__US=us;
 });
 await T('Đăng nhập cục bộ bằng tài khoản mới đúng/sai mật khẩu; tài khoản khóa bị từ chối',async()=>{
   const attempt=async(user,pw,users)=>{
     const logged=[]; t.w.__logged=logged;
     R(`(()=>{const root=document.createElement('div');document.body.appendChild(root);window.__r=ReactDOM.createRoot(root);window.__re=root;
       window.__r.render(React.createElement(DialogProvider,null,React.createElement(LoginScreen,{users:${JSON.stringify(users)},onLogin:p=>window.__logged.push(p),storageError:false})));})()`);
     await new Promise(r=>setTimeout(r,100));
     const inputs=[...t.w.__re.querySelectorAll('input')];
     const setv=(el,v)=>{const d=Object.getOwnPropertyDescriptor(t.w.HTMLInputElement.prototype,'value');d.set.call(el,v);el.dispatchEvent(new t.w.Event('input',{bubbles:true}));};
     setv(inputs[0],user); setv(inputs[1],pw);
     await new Promise(r=>setTimeout(r,50));
     const btn=[...t.w.__re.querySelectorAll('button')].find(b=>/Đăng nhập$/.test(b.textContent.trim())&&!/nhanh/i.test(b.textContent));
     btn.click(); await new Promise(r=>setTimeout(r,300));
     const txt=t.w.__re.textContent; R('window.__r.unmount();window.__re.remove()');
     return {logged,txt};
   };
   let r=await attempt('quan.doc','matkhau1',t.w.__US); eq(r.logged.length,1,'đúng mật khẩu'); eq(r.logged[0].role,'manager'); ok(!('pwHash' in r.logged[0]),'hồ sơ phiên không chứa pwHash');
   r=await attempt('quan.doc','sai',t.w.__US); eq(r.logged.length,0); ok(r.txt.includes('Sai tài khoản'));
   const locked=t.w.__US.map(u=>u.username==='nv.an'?Object.assign({},u,{disabled:true}):u);
   r=await attempt('nv.an','matkhau2',locked); eq(r.logged.length,0); ok(r.txt.includes('bị khóa')||r.txt.includes('chưa được cấp'));
   r=await attempt('to.keo','anything',t.w.__US); eq(r.logged.length,0,'tài khoản tổ cũ không còn đăng nhập dự phòng');
   ok(!R('DEFAULT_USERS.some(u=>u.username!=="admin")'),'DEFAULT_USERS chỉ còn admin');
 });
 await T('Sửa vai trò: bảo vệ Admin cuối, không tự đổi vai trò/khóa mình, Quản đốc không sửa được',async()=>{
   const us=t.w.__US.concat([{username:'admin',role:'admin',id:'admin',uid:'admin'}]);
   await db_set('admin',{username:'admin',role:'admin',fullName:'Admin'});
   await A(`await amgUpdateAccount({username:"nv.an",fullName:"An",role:"manager",team:""},${JSON.stringify(us)})`);
   await rejects(A(`await amgUpdateAccount({username:"admin",fullName:"A",role:"employee"},${JSON.stringify(us)})`),'');
   await rejects(A(`await amgUpdateAccount({username:"admin",fullName:"A",role:"admin",disabled:true},${JSON.stringify(us)})`),'');
   as(QD); await rejects(A(`await amgUpdateAccount({username:"nv.an",fullName:"An",role:"employee"},${JSON.stringify(us)})`),'Chỉ Admin');
   await rejects(A(`await amgDeleteAccount("nv.an",${JSON.stringify(us)})`),'Chỉ Admin'); as(ADMIN);
   await rejects(A(`await amgDeleteAccount("admin",${JSON.stringify(us)})`),'');
 });
 async function db_set(id,d){await A(`await db.collection(FS.users).doc("${id}").set(${JSON.stringify(d)})`)}
 await T('Gỡ 10 tài khoản tổ cũ: chỉ Admin, giữ admin và tài khoản mới',async()=>{
   const legacy=R('AMG_LEGACY_TEAM_ACCOUNTS');
   for(const u of legacy) await db_set('LEG-'+u,{username:u,role:'employee',fullName:'Tổ '+u,team:'KÉO',uid:'LEG-'+u});
   const read=async()=>JSON.parse(await A('const a=[];await new Promise(r=>db.collection(FS.users).onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id,uid:d.id},d.data())));r()}));return JSON.stringify(a)'));
   let us=await read(); eq(R(`amgLegacyAccountsIn(${JSON.stringify(us)}).length`),10);
   as(QD); await rejects(A(`await amgRemoveLegacyAccounts(${JSON.stringify(us)})`),'Chỉ Admin'); as(ADMIN);
   const removed=JSON.parse(await A(`return JSON.stringify(await amgRemoveLegacyAccounts(${JSON.stringify(us)}))`));
   eq(removed.length,10); us=await read();
   ok(!us.some(u=>legacy.includes(u.username)),'đã gỡ hết'); ok(us.some(u=>u.username==='admin')&&us.some(u=>u.username==='quan.doc'),'giữ admin + tài khoản mới');
 });
 await T('Giao diện: Nhân viên không thấy Thêm/Sửa/Xóa đơn nhưng có nút Phân máy; Quản đốc có đủ; panel gỡ tài khoản tổ hiển thị',async()=>{
   await A(`const b=db.batch();genMachineSeed().forEach(m=>b.set(db.collection(FS.machines).doc(m.id),m));await b.commit();
     const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});
     await db.collection(FS.orders).doc("O-UI").set(normalizeOrderStages({id:"O-UI",customer:"KH",spec:"0.2",materialCode:"A",quantity:100,stages,routing:["keo_trung"],routingConfirmed:true,wireFinish:"mềm"}));`);
   const get=async c=>JSON.parse(await A(`const a=[];await new Promise(r=>db.collection("${c}").onSnapshot(s=>{s.docs.forEach(d=>a.push(Object.assign({id:d.id},d.data())));r()}));return JSON.stringify(a)`));
   t.w.__P={orders:await get('orders'),machines:await get('machines')};
   const html=async(expr)=>{R(`(()=>{const P=window.__P;const root=document.createElement('div');document.body.appendChild(root);window.__r=ReactDOM.createRoot(root);window.__re=root;window.__r.render(React.createElement(DialogProvider,null,${expr}));})()`);
     await new Promise(r=>setTimeout(r,200));const h=t.w.__re.textContent;R('window.__r.unmount();window.__re.remove()');return h;};
   const ord=(admin)=>`React.createElement(OrdersPage,{orders:P.orders,runs:[],machines:P.machines,auditLog:[],isAdmin:${admin},currentUser:{role:"x"},onAdd(){},onUpdate(){},onDelete(){},onBulkDelete(){},onRestoreSeed(){},extra:{}})`;
   let h=await html(ord(false)); ok(h.includes('KH')&&!h.includes('Thêm đơn hàng')&&!/\bSửa\b/.test(h),'NV thấy đơn nhưng không có Thêm/Sửa');
   h=await html(ord(true)); ok(h.includes('Thêm đơn hàng')&&/Sửa/.test(h),'Quản đốc/Admin có Thêm/Sửa');
   const plan=(u)=>`React.createElement(PlanPage,{orders:P.orders,machines:P.machines,runs:[],entries:[],staff:[],currentUser:${JSON.stringify(u)},isAdmin:${amgPower(u)},canEdit:true,onUpdateMachine(){},onAddMachine(){},onDeleteMachine(){},onRestoreSeed(){}})`;
   function amgPower(u){return u.role==='admin'||u.role==='manager'}
   h=await html(plan(NV)); ok(h.includes('Phân máy'),'Nhân viên có nút Phân máy');
   R(`(()=>{const root=document.createElement('div');document.body.appendChild(root);window.__r=ReactDOM.createRoot(root);window.__re=root;window.__r.render(React.createElement(DialogProvider,null,React.createElement(LegacyAccountsPanel,{users:[{username:'to.keo',role:'employee',fullName:'Tổ Kéo'}],onRemoved(){}})));})()`);
   await new Promise(r=>setTimeout(r,100));
   ok(t.w.__re.textContent.includes('Sao lưu rồi gỡ')&&t.w.__re.textContent.includes('to.keo')); R('window.__r.unmount();window.__re.remove()');
 });
 console.log(out.join('\n'));console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0);
})();
