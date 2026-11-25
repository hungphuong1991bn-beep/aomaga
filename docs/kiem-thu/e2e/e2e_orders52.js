/* v52 — E2E tab Đơn hàng + Chi tiết đơn: cột, sắp xếp, lọc/tìm, phân trang, Excel, 5 nút thao tác, sửa/xóa, mở đúng Kế hoạch/Phân máy. */
const {boot}=require('./e2e_lib');
const E=boot(); const {w,doc,errs,sleep,A,db,sha,nativeSet,txt,findBtn,click,clickText}=E;
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(x!==undefined?' :: '+x:''));} };
const store=n=>Object.values(w.__db.__store[n]||{}); const ordr=id=>(w.__db.__store.orders||{})[id];
const rowIds=()=>[...doc.querySelectorAll('.amg-row[data-order]')].map(r=>r.getAttribute('data-order'));
const row=id=>doc.querySelector(`.amg-row[data-order="${id}"]`);
const modal=()=>[...doc.querySelectorAll('.mes-modal-card')].pop()||null; // hộp trên cùng (hộp xác nhận xóa xếp chồng lên chi tiết đơn)
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
  // v53 — Admin xóa đơn đang sản xuất. Chuẩn bị: OR-2 được phân (chưa chạy) trên KTI-03 + OR-3 đang chạy trên KTI-02 (đơn khác) → phải còn nguyên sau khi xóa OR-1.
  await A(`await amgFlowAssign({runId:"RR2",orderId:"OR-2",machineId:"KTI-03",stageKey:"keo_tinh",plannedQuantity:500,shift:"Ca Ngày",operator:"B",startNow:false});
    await amgFlowAssign({runId:"RR3",orderId:"OR-3",machineId:"KTI-02",stageKey:"keo_tinh",plannedQuantity:300,shift:"Ca Ngày",operator:"C",startNow:true});
    await amgFlowRecordOutput({clientKey:"x3",runId:"RR3",orderId:"OR-3",machineId:"KTI-02",stageKey:"keo_tinh",qty:50});`);
  await sleep(300);
  const auditOf=id=>store('auditLog').filter(a=>a.type==='production_entry'&&a.targetId===id);
  ok('E2-pre. Trước khi xóa: OR-1 có lệnh RR1 + lượt sản lượng (productionEntries & auditLog); KTI-01 đang khóa bởi RR1', store('productionRuns').some(r=>r.id==='RR1')&&store('productionEntries').some(e=>e.orderId==='OR-1')&&auditOf('OR-1').length>0&&(w.__db.__store.machines['KTI-01']||{}).activeRunId==='RR1');
  nativeSet(search,'OR-1'); await sleep(250); await click(row('OR-1')); await sleep(400); await click(findBtn(/^XÓA ĐƠN$/,modal())); await sleep(500);
  const fm=modal(), ft=txt(fm||doc.body);
  ok('E2. Admin bấm XÓA ĐƠN trên đơn đang sản xuất: hiện hộp xác nhận mạnh (không còn bị chặn), nêu số lệnh máy/lượt sản lượng/máy KTI-01; đơn chưa bị xóa', !!ordr('OR-1')&&/kể cả đang sản xuất/.test(ft)&&/1 lệnh máy/.test(ft)&&/KTI-01/.test(ft)&&/Không hoàn tác|KHÔNG hoàn tác/.test(ft), ft.slice(0,400));
  const goBtn=()=>doc.querySelector('[data-testid="force-del-go"]'), inR=()=>doc.querySelector('[data-testid="force-del-reason"]'), inC=()=>doc.querySelector('[data-testid="force-del-confirm"]');
  ok('E2a. Nút "Xóa vĩnh viễn" bị khóa khi chưa nhập lý do và chưa gõ mã đơn', goBtn()&&goBtn().disabled);
  nativeSet(inR(),'Nhập nhầm đơn'); await sleep(100); ok('E2b. Chỉ có lý do → vẫn khóa', goBtn().disabled);
  nativeSet(inC(),'OR-9'); await sleep(100); ok('E2c. Gõ sai mã đơn → vẫn khóa', goBtn().disabled);
  nativeSet(inC(),'or-1'); await sleep(100); ok('E2d. Lý do + gõ đúng mã đơn (không phân biệt hoa/thường) → mở khóa', !goBtn().disabled);
  await click(goBtn()); await sleep(900);
  const m1=w.__db.__store.machines['KTI-01']||{};
  ok('E2e. Xóa xong: đơn OR-1 biến mất khỏi Firebase và danh sách', !ordr('OR-1')&&!row('OR-1'));
  ok('E2f. Lệnh RR1 và toàn bộ lượt sản lượng của OR-1 bị xóa (productionEntries + bản sao trong auditLog)', !store('productionRuns').some(r=>r.orderId==='OR-1')&&!store('productionEntries').some(e=>e.orderId==='OR-1')&&auditOf('OR-1').length===0);
  ok('E2g. Khóa máy KTI-01 được giải phóng (không còn trỏ tới lệnh đã xóa); máy KTI-03 của đơn khác vẫn giữ khóa RR2', !m1.activeRunId&&(w.__db.__store.machines['KTI-03']||{}).activeRunId==='RR2'&&(w.__db.__store.machines['KTI-02']||{}).activeRunId==='RR3', 'KTI-01 activeRunId='+m1.activeRunId);
  ok('E2h. Dữ liệu đơn khác còn nguyên: OR-2, OR-3, lệnh RR2/RR3, sản lượng 50 của OR-3', !!ordr('OR-2')&&!!ordr('OR-3')&&store('productionRuns').some(r=>r.id==='RR2')&&store('productionRuns').some(r=>r.id==='RR3')&&store('productionEntries').some(e=>e.orderId==='OR-3')&&auditOf('OR-3').length>0);
  const fd=store('auditLog').filter(a=>a.type==='order_force_delete'&&a.targetId==='OR-1')[0];
  ok('E2i. Nhật ký order_force_delete ghi người xóa, lý do, số lệnh/lượt sản lượng bị xóa; dòng này không bị xóa theo', !!fd&&fd.reason==='Nhập nhầm đơn'&&fd.runCount===1&&fd.entryCount>=1&&/Nhập nhầm đơn/.test(fd.detail)&&!!fd.user, JSON.stringify(fd||{}).slice(0,300));
  // Quản đốc KHÔNG được xóa đơn đang sản xuất (chặn cả ở tầng dữ liệu, không chỉ ẩn nút)
  const mgr=await A(`const u=window.__AMG_USER; window.__AMG_USER=Object.assign({},u,{role:"manager"}); let msg="";try{await amgFlowForceDeleteOrder({orderId:"OR-3",reason:"thử",allRuns:[]});}catch(e){msg=e.message}; window.__AMG_USER=u; return msg;`);
  ok('E2j. Quản đốc gọi xóa-đơn-đang-sản-xuất bị từ chối ở tầng dữ liệu; OR-3 còn nguyên', /Admin/.test(mgr)&&!!ordr('OR-3')&&store('productionRuns').some(r=>r.id==='RR3'), mgr);
  const noWhy=await A(`let msg="";try{await amgFlowForceDeleteOrder({orderId:"OR-3",reason:" ",allRuns:[]});}catch(e){msg=e.message}; return msg;`);
  ok('E2k. Thiếu lý do thì tầng dữ liệu từ chối (không chỉ dựa vào nút bị khóa)', /lý do/.test(noWhy)&&!!ordr('OR-3'), noWhy);
  await closeModal();
  // Xóa nhiều đơn đang sản xuất cùng lúc (Chọn nhiều)
  nativeSet(search,''); await sleep(250);
  await click(findBtn(/^Chọn nhiều$/)); await sleep(250);
  await click(row('OR-2')); await click(row('OR-3')); await sleep(200);
  await click(findBtn(/Xóa đã chọn/)); await sleep(500);
  const bulkTxt=txt(modal()||doc.body);
  ok('E2l. Chọn nhiều + Xóa đã chọn với đơn đang sản xuất (Admin): hộp xác nhận mạnh, yêu cầu gõ "XOA"', /Xóa 2 đơn/.test(bulkTxt)&&/XOA/.test(bulkTxt)&&!!goBtn()&&goBtn().disabled&&!!ordr('OR-2')&&!!ordr('OR-3'), bulkTxt.slice(0,300));
  nativeSet(inR(),'Dọn đơn thử'); nativeSet(inC(),'XOA'); await sleep(150); await click(goBtn()); await sleep(1000);
  ok('E2m. Xác nhận: cả 2 đơn, các lệnh RR2/RR3 và sản lượng đều bị xóa; máy KTI-02/KTI-03 không còn khóa', !ordr('OR-2')&&!ordr('OR-3')&&!store('productionRuns').some(r=>r.orderId==='OR-2'||r.orderId==='OR-3')&&auditOf('OR-3').length===0&&!(w.__db.__store.machines['KTI-03']||{}).activeRunId&&!(w.__db.__store.machines['KTI-02']||{}).activeRunId);
  { const eb=findBtn(/^(Đóng|OK|Đã hiểu|Xác nhận)$/); if(eb) await click(eb); }
  await click(findBtn(/^Thoát chọn nhiều$/)||findBtn(/^Thoát$/)); await sleep(200);
  // Đơn chưa có dữ liệu sản xuất: giữ đường xóa thường (E3/E4)
  await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});await db.collection("orders").doc("OR-3").set(normalizeOrderStages({id:"OR-3",customer:"Công ty Alpha",spec:"0.5",materialCode:"B",quantity:300,orderDate:"2026-11-01",deliveryDate:"2026-12-10",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:["keo_tinh"],routingConfirmed:true}));`); await sleep(400);
  nativeSet(search,'OR-26'); await sleep(250); await click(row('OR-26')); await sleep(400); await click(findBtn(/^XÓA ĐƠN$/,modal())); await sleep(300);
  ok('E3. Xóa đơn chưa có dữ liệu sản xuất: có hộp xác nhận', /Xóa đơn OR-26/.test(txt(doc.body))&&!!findBtn(/^Xóa đơn$/)); await click(findBtn(/^Xóa đơn$/)); await sleep(700);
  ok('E4. Sau xác nhận: đơn bị xóa khỏi Firebase và danh sách; không còn lệnh nào của OR-26', !ordr('OR-26')&&!row('OR-26')&&!store('productionRuns').some(r=>r.orderId==='OR-26'));
  // Kế hoạch / phân máy
  nativeSet(search,'OR-3'); await sleep(250); await click(row('OR-3')); await sleep(400); await click(findBtn(/^LẬP KẾ HOẠCH SẢN XUẤT$/,modal())); await sleep(700);
  const qin=[...doc.querySelectorAll('input.mes-input')].find(i=>/Tìm/.test(i.placeholder||'')||i.value==='OR-3');
  ok('P1. LẬP KẾ HOẠCH SẢN XUẤT mở đúng phân hệ Kế hoạch, tự lọc sẵn đơn OR-3 (không phải tìm lại)', /Kế hoạch sản xuất/.test(txt(doc.querySelector('.mes-topbar-crumb')))&&qin&&qin.value==='OR-3'&&/OR-3/.test(txt(doc.body)), qin&&qin.value);
  await clickText(/^Đơn hàng & BOM/); await sleep(500); nativeSet([...doc.querySelectorAll('input.mes-input')].find(i=>/Tìm/.test(i.placeholder||'')),'OR-3'); await sleep(250); await click(row('OR-3')); await sleep(400); await click(findBtn(/^PHÂN MÁY$/,modal())); await sleep(800);
  ok('P2. PHÂN MÁY mở ngay hộp phân lệnh với đơn OR-3 đã chọn sẵn', !!modal()&&/OR-3/.test(txt(modal()))&&/Kế hoạch sản xuất/.test(txt(doc.querySelector('.mes-topbar-crumb'))), txt(modal()||doc.body).slice(0,160));
  const real=errs.filter(e=>!/Warning: .*(act|unmounted)/i.test(e)); ok('Z. Không có lỗi console/React', real.length===0, real.slice(0,3).join(' || '));
  console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e.stack||e);process.exit(2);});
