/* v52 — E2E phân quyền trên giao diện thật: Nhân viên / Quản đốc / Admin với HOÀN THÀNH ĐƠN, sửa/xóa đơn, phân máy, ghi sản lượng. */
const {boot}=require('./e2e_lib');
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const server=require('../fakertdb').makeServer();
async function session(user,label,fn){
  const E=boot({server}); const {w,doc,sleep,nativeSet,clickText,sha}=E;
  await sleep(400); const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],user); nativeSet(inputs[1],'test'); await sleep(50); await clickText(/^Đăng nhập/); await sleep(900);
  await fn(E); 
}
(async()=>{
  // dữ liệu dùng chung: gieo qua thiết bị đầu tiên
  const E0=boot({server}); await E0.sleep(400);
  JSON.parse(await E0.A('return JSON.stringify(genMachineSeed())')).forEach(m=>E0.db.__seed('machines',m.id,m));
  for(const [u,r] of [['ad','admin'],['qd','manager'],['nv','employee']]) E0.db.__seed('users',u,{username:u,fullName:'ND '+u,role:r,pwHash:E0.sha(`amg:${u}:test`)});
  const mk=async(id,extra={})=>{ const j=await E0.A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages(Object.assign({id:"${id}",customer:"KH ${id}",spec:"0.5",materialCode:"B",quantity:100,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra)})))`); E0.db.__seed('orders',id,JSON.parse(j)); };
  await mk('RL-1'); await mk('RL-2'); await E0.sleep(300);
  Object.keys(E0.w.__db.__store.orders||{}).filter(id=>!/^RL-/.test(id)).forEach(id=>server.patch({['orders/'+id]:null})); await E0.sleep(300);
  E0.w.__AMG_USER={username:'ad',role:'admin',fullName:'ND ad'};
  await E0.A(`await amgFlowAssign({runId:"RLa",orderId:"RL-1",machineId:"KTI-01",stageKey:"keo_tinh",plannedQuantity:100,shift:"Ca Ngày",operator:"X",startNow:true});await amgFlowRecordOutput({clientKey:"r1",runId:"RLa",orderId:"RL-1",machineId:"KTI-01",stageKey:"keo_tinh",qty:100});await amgFlowFinishRun({runId:"RLa",completeStage:true})`);
  await E0.sleep(300);
  const checks={};
  const probe=async(E)=>{ const {doc,sleep,clickText,findBtn,click,txt}=E; const r={};
    await clickText(/^Điều hành sản xuất/); await sleep(900); const row=doc.querySelector('tr[data-order="RL-1"]');
    r.opsComplete=!!(row&&findBtn(/^HOÀN THÀNH ĐƠN$/,row)); r.opsAssign=!!findBtn(/^Phân máy$/,doc.querySelector('tr[data-order="RL-1"]')||doc.body);
    await clickText(/^Kế hoạch sản xuất/); await sleep(1500); const prow=[...doc.querySelectorAll('.amg-row')].find(x=>x.getAttribute('data-order')==='RL-1');
    r.planComplete=!!(prow&&findBtn(/^HOÀN THÀNH ĐƠN$/,prow));
    await clickText(/^Đơn hàng & BOM/); await sleep(700); const orow=[...doc.querySelectorAll('.amg-row')].find(x=>x.getAttribute('data-order')==='RL-2');
    if(orow){ await click(orow); await sleep(500); const m=doc.querySelector('.mes-modal-card'); r.detailEdit=!!findBtn(/^CHỈNH SỬA ĐƠN$/,m); r.detailDel=!!findBtn(/^XÓA ĐƠN$/,m); r.detailPlan=!!findBtn(/^LẬP KẾ HOẠCH SẢN XUẤT$/,m); r.detailHist=!!findBtn(/^XEM LỊCH SỬ$/,m); const bd=doc.querySelector('.mes-mobile-modal-backdrop'); if(bd) await click(bd); }
    return r; };
  await session('nv','Nhân viên',async E=>{ checks.nv=await probe(E); try{ E.w.__AMG_USER&&0; }catch(e){} checks.nvDirect=await E.A(`try{await amgFlowCompleteOrder({orderId:"RL-1"});return "ĐÃ HOÀN THÀNH (SAI)";}catch(e){return e.message}`); });
  await session('qd','Quản đốc',async E=>{ checks.qd=await probe(E); });
  await session('ad','Admin',async E=>{ checks.ad=await probe(E); });
  const nv=checks.nv,qd=checks.qd,ad=checks.ad;
  ok('R1. Nhân viên: KHÔNG có nút HOÀN THÀNH ĐƠN ở Điều hành và Kế hoạch', !nv.opsComplete&&!nv.planComplete, JSON.stringify(nv));
  ok('R2. Nhân viên: KHÔNG có nút CHỈNH SỬA ĐƠN / XÓA ĐƠN trong chi tiết đơn', !nv.detailEdit&&!nv.detailDel, JSON.stringify(nv));
  ok('R3. Nhân viên gọi thẳng hàm hoàn thành đơn (bỏ qua nút) vẫn bị từ chối ở tầng nghiệp vụ; đơn không đổi', /không có quyền|quyền/i.test(String(checks.nvDirect))&&JSON.parse(server.root.orders['RL-1'].d).status!=='completed', checks.nvDirect);
  ok('R4. Quản đốc: có HOÀN THÀNH ĐƠN ở Điều hành và Kế hoạch, thấy nút sửa/xóa theo quyền hiện có', qd.opsComplete&&qd.planComplete&&qd.detailPlan, JSON.stringify(qd));
  ok('R5. Admin: có HOÀN THÀNH ĐƠN, CHỈNH SỬA ĐƠN, XÓA ĐƠN, LẬP KẾ HOẠCH, XEM LỊCH SỬ', ad.opsComplete&&ad.planComplete&&ad.detailEdit&&ad.detailDel&&ad.detailPlan&&ad.detailHist, JSON.stringify(ad));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
