/* v52 — E2E tab Đơn hàng + Chi tiết đơn: cột, sắp xếp, lọc/tìm, phân trang, Excel, 5 nút thao tác, sửa/xóa, mở đúng Kế hoạch/Phân máy. */
const {boot}=require('./e2e_lib');
const E=boot(); const {w,doc,errs,sleep,A,db,sha,nativeSet,txt,findBtn,click,clickText}=E;
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const store=n=>Object.values(w.__db.__store[n]||{}); const ordr=id=>(w.__db.__store.orders||{})[id];
const rowIds=()=>[...doc.querySelectorAll('.amg-row[data-order]')].map(r=>r.getAttribute('data-order'));
const row=id=>doc.querySelector(`.amg-row[data-order="${id}"]`);
const modal=()=>doc.querySelector('.mes-modal-card');
const closeModal=async()=>{ const b=doc.querySelector('.mes-mobile-modal-backdrop'); if(b){ await click(b); await sleep(200);} };
(async()=>{
  await sleep(300);
  JSON.parse(await A('return JSON.stringify(genMachineSeed())')).forEach(m=>db.__seed('machines',m.id,m));
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  const mk=async(id,cust,spec,q,extra={})=>{ const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages(Object.assign({id:"${id}",customer:"${cust}",spec:"${spec}",materialCode:"B",quantity:${q},orderDate:"2026-11-0${1+(q%5)}",deliveryDate:"2026-12-${10+(q%15)}",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true},${JSON.stringify(extra)})))`); db.__seed('orders',id,JSON.parse(j)); };
  await mk('OR-1','Công ty Alpha','0.254BC',1000,{priority:'high',bom:[{id:'B1',material:'Đồng cathode',norm:1.02,unit:'kg',note:''}],note:'Giao gấp'});
  await mk('OR-2','Công ty Beta','0.3AB',500,{deliveryDate:'2026-11-01'});   // quá hạn
  await mk('OR-3','Công ty Alpha','0.5',300);
  for(let i=4;i<=26;i++) await mk('OR-'+i,'KH '+i,'0.'+i,100+i);              // để có >20 đơn → phân trang
  await sleep(200); Object.keys(w.__db.__store.orders||{}).filter(id=>!/^OR-/.test(id)).forEach(id=>w.__server.patch({['orders/'+id]:null})); await sleep(300);
  const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],'admin'); nativeSet(inputs[1],'test'); await sleep(50); await clickText(/^Đăng nhập/); await sleep(900);
  await A(`await amgFlowAssign({runId:"RR1",orderId:"OR-1",machineId:"KTI-01",stageKey:"keo_tinh",plannedQuantity:1000,shift:"Ca Ngày",operator:"Nguyễn Văn A",startNow:true});
    await amgFlowRecordOutput({clientKey:"x1",runId:"RR1",orderId:"OR-1",machineId:"KTI-01",stageKey:"keo_tinh",qty:400});`);
  await sleep(300);
  await clickText(/^Đơn hàng & BOM/); await sleep(600);

  // ---- Danh sách ----
  const hdr=txt(doc.querySelector('.amg-hdr'));
  const needCols=['STT','Mã đơn','Khách hàng','Quy trình','Công đoạn hiện tại','Máy đang SX','Vật liệu','Quy cách','SL đặt','Đã sản xuất','Còn lại','Ngày nhận','Ngày giao','Ưu tiên','Trạng thái','cảnh báo'];
  ok('L1. Bảng có đủ cột theo yêu cầu (STT, mã, khách, ngày nhận/giao, vật liệu, quy cách, SL đặt, đã SX, còn lại, quy trình, công đoạn hiện tại, máy, ưu tiên, trạng thái, cảnh báo)', needCols.every(c=>hdr.includes(c)), hdr);
  const r1=row('OR-1'), t1=txt(r1);
  ok('L2. Dòng OR-1 hiện đủ thông tin thật: khách, vật liệu, quy cách, SL + ĐVT, đã SX 400, còn lại 600, công đoạn, máy, ưu tiên', /Công ty Alpha/.test(t1)&&/0\.254BC/.test(t1)&&/1\.?000/.test(t1)&&/kg/.test(t1)&&/400/.test(t1)&&/600/.test(t1)&&/KTI-01/.test(t1)&&/Kéo tinh/i.test(t1), t1.slice(0,300));
  ok('L3. Cột Ngày nhận / Ngày giao đúng định dạng dd/mm/yyyy', /\d\d\/\d\d\/2026/.test(t1)&&(t1.match(/\d\d\/\d\d\/2026/g)||[]).length>=2, t1.slice(0,300));
  ok('L4. Đơn quá hạn có cảnh báo "Quá hạn"', /Quá hạn/.test(txt(row('OR-2'))));
  ok('L5. Phân trang: trang 1 chỉ 20 đơn trên tổng 26; có bộ chuyển trang', rowIds().length===20&&/26/.test(txt(doc.body)));
  // sắp xếp
  const firstIds=()=>rowIds().slice(0,3).join(',');
  const sortBtn=k=>doc.querySelector(`[data-sort="${k}"]`);
  await click(sortBtn('qty')); await sleep(200); const asc=firstIds(); await click(sortBtn('qty')); await sleep(200); const desc=firstIds();
  ok('S1. Bấm tiêu đề cột "SL đặt" sắp xếp tăng rồi giảm dần (tăng: OR-4 = 104 đứng đầu; giảm: OR-1 = 1000 đứng đầu)', asc.split(',')[0]==='OR-4'&&desc.split(',')[0]==='OR-1', asc+' | '+desc);
  const qty=id=>Number(ordr(id).quantity); const a0=rowIds()[0]; ok('S2. Giảm dần: đơn đầu tiên là đơn có SL lớn nhất (OR-1 = 1000)', a0==='OR-1', a0);
  await click(sortBtn('dd')); await sleep(200); const ddAsc=rowIds().slice(0,2); ok('S3. Sắp xếp theo Ngày giao tăng dần: đơn quá hạn (01/11) đứng đầu', ddAsc[0]==='OR-2', ddAsc.join(','));
  // tìm kiếm + lọc
  const search=[...doc.querySelectorAll('input.mes-input')].find(i=>/Tìm/.test(i.placeholder||'')); nativeSet(search,'alpha'); await sleep(300);
  ok('F1. Tìm "alpha" → chỉ các đơn của Công ty Alpha (OR-1, OR-3)', rowIds().sort().join()==='OR-1,OR-3', rowIds().join());
  nativeSet(search,''); await sleep(200);
  const selCust=[...doc.querySelectorAll('select')].find(s=>[...s.options].some(o=>/Mọi khách hàng/.test(o.textContent))); nativeSet(selCust,'Công ty Beta'); await sleep(250);
  ok('F2. Lọc theo khách hàng Công ty Beta → chỉ OR-2', rowIds().join()==='OR-2', rowIds().join()); nativeSet(selCust,'all'); await sleep(250);
  // Excel
  let wbCap=null; const origWF=w.XLSX.writeFile; w.XLSX.writeFile=(wb,name)=>{wbCap={wb,name};}; await click(findBtn(/Xuất Excel/)); w.XLSX.writeFile=origWF;
  const heads=wbCap?Object.keys(w.XLSX.utils.sheet_to_json(wbCap.wb.Sheets[wbCap.wb.SheetNames[0]])[0]||{}):[];
  ok('X1. Xuất Excel có các cột Còn lại, Tiến độ, Công đoạn hiện tại, Máy đang sản xuất', ['CÒN LẠI','TIẾN ĐỘ (%)','CÔNG ĐOẠN HIỆN TẠI','MÁY ĐANG SẢN XUẤT','NGÀY NHẬN','NGÀY GIAO'].every(h=>heads.includes(h)), heads.join('|'));

  // ---- Chi tiết đơn ----
  nativeSet(search,'OR-1'); await sleep(250); await click(row('OR-1')); await sleep(500);
  const m=txt(modal());
  ok('D1. Mở chi tiết OR-1; có 5 nút thao tác: CHỈNH SỬA ĐƠN, XÓA ĐƠN, LẬP KẾ HOẠCH SẢN XUẤT, PHÂN MÁY, XEM LỊCH SỬ', ['CHỈNH SỬA ĐƠN','XÓA ĐƠN','LẬP KẾ HOẠCH SẢN XUẤT','PHÂN MÁY','XEM LỊCH SỬ'].every(l=>!!findBtn(new RegExp('^'+l+'$'),modal())), m.slice(0,200));
  ok('D2. Nhóm A thông tin đơn: mã, khách, ngày nhận/giao, quy cách, vật liệu, SL đặt, ĐVT, ưu tiên, ghi chú, trạng thái, tiến độ', ['Mã đơn','Khách hàng','Ngày giao hàng','Quy quy'.slice(0,0)+'Quy cách','Mã vật liệu','Số lượng đặt','Đơn vị tính','Mức ưu tiên','Ghi chú','Trạng thái','Tiến độ','Số lượng còn lại','Công đoạn hiện tại','Máy đang sản xuất'].every(l=>m.includes(l))&&/Giao gấp/.test(m)&&/KTI-01/.test(m)&&/600/.test(m), m.slice(0,500));
  const tabBtn=re=>findBtn(re,modal());
  await click(tabBtn(/^Máy & lệnh sản xuất$/)); await sleep(200); const mt=txt(modal());
  ok('D3. Nhóm C máy & lệnh: máy, công đoạn, người vận hành, ca, bắt đầu, kết thúc, chạy thực tế, tạm dừng, SL kế hoạch/thực tế, trạng thái lệnh', ['Máy','Công đoạn','Người vận hành','Ca','Bắt đầu','Kết thúc','Chạy thực tế','Tạm dừng','SL kế hoạch','SL thực tế','Trạng thái lệnh'].every(l=>mt.includes(l))&&/KTI-01/.test(mt)&&/Nguyễn Văn A/.test(mt)&&/Ca Ngày/.test(mt), mt.slice(0,300));
  await click(tabBtn(/^Tiến độ công đoạn$/)); await sleep(200); const st=txt(modal());
  ok('D4. Nhóm B quy trình: thứ tự công đoạn, trạng thái (đang thực hiện), sản lượng, còn thiếu', /1\. Kéo tinh/i.test(st)&&/Đang thực hiện/.test(st)&&/400/.test(st)&&/còn thiếu 600/.test(st), st.slice(0,300));
  await click(tabBtn(/^BOM và định mức$/)); await sleep(200); const bt=txt(modal());
  ok('D5. Nhóm D BOM: vật tư, định mức, nhu cầu theo SL đơn (1.020), đã xuất kho, còn thiếu', /Đồng cathode/.test(bt)&&/1\.?020/.test(bt)&&/Đã xuất kho/.test(bt)&&/Còn thiếu/.test(bt), bt.slice(0,300));
  await click(tabBtn(/^Lịch sử sản xuất$/)); await sleep(200); const pt=txt(modal());
  ok('D6. Nhóm E lịch sử sản xuất: thời gian ghi nhận, công đoạn, máy, sản lượng, người thực hiện, ghi chú', ['Thời gian ghi nhận','Công đoạn','Máy','Sản lượng','Người thực hiện','Ghi chú'].every(l=>pt.includes(l))&&/400/.test(pt)&&/KTI-01/.test(pt), pt.slice(0,260));
  await click(tabBtn(/^Lịch sử chất lượng$/)); await sleep(150); ok('D7. Nhóm F lịch sử chất lượng hiển thị (trống có hướng dẫn)', /Chưa có phiếu|Đạt|NG/.test(txt(modal())));
  await click(tabBtn(/^Lịch sử giao hàng$/)); await sleep(150); ok('D8. Nhóm G giao hàng hiển thị', /Đã giao|Còn phải giao/.test(txt(modal())));
  await click(findBtn(/^XEM LỊCH SỬ$/,modal())); await sleep(200); ok('D9. Nút XEM LỊCH SỬ mở tab Lịch sử chỉnh sửa', /Lịch sử chỉnh sửa/.test(txt(modal())));
  // sửa đơn: lưu đồng bộ + nhật ký
  const auditBefore=store('auditLog').length;
  await click(findBtn(/^CHỈNH SỬA ĐƠN$/,modal())); await sleep(400);
  const custIn=[...modal().querySelectorAll('input')].find(i=>i.value==='Công ty Alpha'); nativeSet(custIn,'Công ty Alpha (đã sửa)'); await sleep(50);
  await click(findBtn(/^Tiếp tục: xác nhận quy trình/,modal())); await sleep(300);
  const sv=findBtn(/^Xác nhận quy trình & lưu đơn$/,modal()); await click(sv); await sleep(400);
  const warn=findBtn(/^Vẫn lưu$/); if(warn){ await click(warn); await sleep(600); }
  await sleep(400);
  ok('E1. CHỈNH SỬA ĐƠN lưu lên Firebase và ghi nhật ký chỉnh sửa', ordr('OR-1').customer==='Công ty Alpha (đã sửa)'&&store('auditLog').length>auditBefore&&store('auditLog').some(a=>a.targetId==='OR-1'&&/OR-1/.test(JSON.stringify(a))), 'customer='+ordr('OR-1').customer+' audit '+auditBefore+'→'+store('auditLog').length);
  await closeModal();
  // xóa
  nativeSet(search,'OR-1'); await sleep(250); await click(row('OR-1')); await sleep(400); await click(findBtn(/^XÓA ĐƠN$/,modal())); await sleep(400);
  ok('E2. XÓA đơn đã có lệnh/sản lượng bị chặn (bảo toàn dữ liệu), đơn vẫn còn', !!ordr('OR-1')&&/không thể xóa|Không xóa được/.test(txt(doc.body)));
  const okb=findBtn(/^(Đóng|OK|Đã hiểu|Xác nhận)$/); if(okb) await click(okb); await sleep(200); await closeModal();
  nativeSet(search,'OR-26'); await sleep(250); await click(row('OR-26')); await sleep(400); await click(findBtn(/^XÓA ĐƠN$/,modal())); await sleep(300);
  ok('E3. Xóa đơn chưa có dữ liệu sản xuất: có hộp xác nhận', /Xóa đơn OR-26/.test(txt(doc.body))&&!!findBtn(/^Xóa đơn$/)); await click(findBtn(/^Xóa đơn$/)); await sleep(700);
  ok('E4. Sau xác nhận: đơn bị xóa khỏi Firebase và danh sách; lệnh/sản lượng của các đơn khác còn nguyên', !ordr('OR-26')&&!row('OR-26')&&store('productionRuns').some(r=>r.id==='RR1'));
  // Kế hoạch / phân máy
  nativeSet(search,'OR-3'); await sleep(250); await click(row('OR-3')); await sleep(400); await click(findBtn(/^LẬP KẾ HOẠCH SẢN XUẤT$/,modal())); await sleep(700);
  const qin=[...doc.querySelectorAll('input.mes-input')].find(i=>/Tìm/.test(i.placeholder||'')||i.value==='OR-3');
  ok('P1. LẬP KẾ HOẠCH SẢN XUẤT mở đúng phân hệ Kế hoạch, tự lọc sẵn đơn OR-3 (không phải tìm lại)', /Kế hoạch sản xuất/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&qin&&qin.value==='OR-3'&&/OR-3/.test(txt(doc.body)), qin&&qin.value);
  await clickText(/^Đơn hàng & BOM/); await sleep(500); nativeSet([...doc.querySelectorAll('input.mes-input')].find(i=>/Tìm/.test(i.placeholder||'')),'OR-3'); await sleep(250); await click(row('OR-3')); await sleep(400); await click(findBtn(/^PHÂN MÁY$/,modal())); await sleep(800);
  ok('P2. PHÂN MÁY mở ngay hộp phân lệnh với đơn OR-3 đã chọn sẵn', !!modal()&&/OR-3/.test(txt(modal()))&&/Kế hoạch sản xuất/.test(txt(doc.querySelector('.mes-topbar-crumb'))), txt(modal()||doc.body).slice(0,160));
  const real=errs.filter(e=>!/Warning: .*(act|unmounted)/i.test(e)); ok('Z. Không có lỗi console/React', real.length===0, real.slice(0,3).join(' || '));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
