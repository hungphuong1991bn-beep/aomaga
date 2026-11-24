const {boot}=require('./e2e_lib');
const L=boot();
const {doc,A,sleep,sha,nativeSet,txt,clickText,findBtn,click,db,errs,modal}=L;
const R=[]; const ok=(n,c,d)=>{R.push((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+(d||'')));};
const rows=()=>[...doc.querySelectorAll('.amg-row')];
const rowOf=id=>rows().find(r=>txt(r).includes('KH-'+id));
const cards=()=>[...doc.querySelectorAll('.amg-mcard')];
const cardOf=id=>cards().find(c=>new RegExp('^'+id).test(txt(c)));
const runs=()=>Object.values(db.__store.productionRuns||{});
const go=async re=>{await clickText(re);await sleep(500);};
async function assign(orderId,machineId,op){
  await clickText(/^Phân máy$/,rowOf(orderId)); await sleep(300);
  const m=modal(); await clickText(new RegExp('^'+machineId+'$'),m); await sleep(100);
  const ins=[...m.querySelectorAll('input.mes-input')];
  nativeSet(ins.find(i=>/Chọn hoặc nhập/.test(i.placeholder)),op); await sleep(100);
  const b=findBtn(/^Xác nhận phân lệnh$/,m); return b;
}
(async()=>{
  await sleep(300);
  JSON.parse(await A('return JSON.stringify(genMachineSeed())')).forEach(m=>db.__seed('machines',m.id,m));
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  const mk=async(id,routing)=>{const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:1000,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:${JSON.stringify(routing)},routingConfirmed:true,createdAt:new Date().toISOString()}));`);const o=JSON.parse(j);db.__seed('orders',o.id,o);};
  await mk('A-001',['keo_trung','keo_tinh']); await mk('B-002',['keo_trung']);
  await sleep(200);
  const inputs=[...doc.querySelectorAll('input')]; nativeSet(inputs[0],'admin'); nativeSet(inputs[1],'test'); await sleep(50);
  await clickText(/^Đăng nhập/); await sleep(700);
  // Orders tab
  await go(/Đơn hàng & BOM/);
  const hdr=doc.querySelector('.amg-hdr');
  ok('Đơn hàng: có danh sách dòng', rows().length>=2, rows().length);
  ok('Đơn hàng: không checkbox trong STT/tiêu đề/dòng', !doc.querySelector('.amg-hdr input[type=checkbox]') && !rows().some(r=>r.querySelector('input[type=checkbox]')));
  ok('Đơn hàng: STT chỉ là số', rows().length&&/^\d+$/.test(txt(rows()[0].firstElementChild)), rows()[0]&&txt(rows()[0].firstElementChild));
  await go(/Chọn nhiều/); ok('Đơn hàng: chế độ chọn nhiều hiện nút Chọn', !!findBtn(/^Chọn$/,rows()[0])||!!findBtn(/Chọn cả trang/));
  await clickText(/^Thoát/);
  // Plan
  await go(/Kế hoạch sản xuất/);
  ok('1. Tạo đơn A (Kéo trung) hiện ở Kế hoạch', !!rowOf('A-001')); 
  ok('1b. A đang CHƯA PHÂN MÁY', /chưa phân/iu.test(txt(rowOf('A-001'))), txt(rowOf('A-001')).slice(0,200));
  let b=await assign('A-001','KT-01','Nguyễn A'); ok('2. Nút xác nhận phân máy dùng được',!b.disabled);
  await click(b); await click(b); await click(b); await sleep(900); // nhấp nhiều lần
  ok('2b. Sau phân lệnh hiện hộp XÁC NHẬN BẮT ĐẦU CHẠY MÁY', !!findBtn(/Xác nhận bắt đầu chạy máy/,modal()), txt(modal()||doc.body).slice(0,120));
  await clickText(/^Để sau$/,modal()); await sleep(300);
  ok('11. Bấm nhiều lần → đúng 1 lệnh mở', runs().filter(r=>r.orderId==='A-001').length===1, runs().length);
  ok('3. A không còn "CHƯA PHÂN MÁY"', !/chưa phân/iu.test(txt(rowOf('A-001'))), txt(rowOf('A-001')).slice(0,200));
  ok('3b. A hiển thị ĐÃ PHÂN MÁY + KT-01', /đã phân máy/iu.test(txt(rowOf('A-001')))&&/KT-01/.test(txt(rowOf('A-001'))), txt(rowOf('A-001')).slice(0,250));
  await go(/Giám sát máy móc/);
  ok('4. KT-01 hiện A-001 / ĐÃ PHÂN MÁY', cardOf('KT-01')&&/A-001/.test(txt(cardOf('KT-01')))&&/ĐÃ PHÂN MÁY/.test(txt(cardOf('KT-01'))), cardOf('KT-01')&&txt(cardOf('KT-01')).slice(0,200));
  ok('4b. Máy khác vẫn MÁY TRỐNG', /MÁY TRỐNG/.test(txt(cardOf('KT-02')||cardOf('KT-03')||doc.body)));
  await clickText(/^Bắt đầu chạy$/,cardOf('KT-01')); await sleep(400);
  ok('5a. Bắt đầu chạy hỏi xác nhận trước khi chạy', !!findBtn(/Xác nhận bắt đầu chạy máy/,modal()));
  await click(findBtn(/Xác nhận bắt đầu chạy máy/,modal())); await sleep(700);
  ok('5. KT-01 → ĐANG CHẠY', /ĐANG CHẠY/.test(txt(cardOf('KT-01'))), txt(cardOf('KT-01')).slice(0,150));
  ok('5b. DB: running+startedAt', runs()[0].productionStatus==='running'&&!!runs()[0].startedAt);
  // remount ("tải lại")
  await go(/Kế hoạch & phân công/);
  ok('6. Sau tải lại: A = ĐANG CHẠY ở KT-01', /đang chạy/iu.test(txt(rowOf('A-001')))&&/KT-01/.test(txt(rowOf('A-001'))), txt(rowOf('A-001')).slice(0,250));
  await go(/Giám sát máy móc/);
  ok('6b. Thẻ máy sau tải lại vẫn đúng', /ĐANG CHẠY/.test(txt(cardOf('KT-01'))));
  // output
  await clickText(/^Ghi sản lượng$/,cardOf('KT-01')); await sleep(300);
  let m=modal(); const num=[...m.querySelectorAll('input')].find(i=>i.type==='number'||/^\d*$/.test(i.value)&&!i.placeholder);
  console.log('output modal:',txt(m).slice(0,200), [...m.querySelectorAll('input')].map(i=>i.type+':'+(i.placeholder||i.value)));
  // pause/resume
  await clickText(/Hủy|Đóng/,m).catch(()=>{}); await sleep(200);
  await clickText(/^Tạm dừng$/,cardOf('KT-01')); await sleep(300); m=modal();
  const reason=[...m.querySelectorAll('input.mes-input,textarea,select')][0]; if(reason) nativeSet(reason,reason.tagName==='SELECT'?reason.options[1].value:'Chờ vật tư'); await sleep(100);
  console.log('pause modal:',txt(m).slice(0,200));
  const pb=m.querySelectorAll('button'); const confirm=[...pb].find(x=>/Tạm dừng|Xác nhận/.test(txt(x))&&!/Hủy/.test(txt(x))); await click(confirm); await sleep(700);
  ok('7. Tạm dừng → TẠM DỪNG', /TẠM DỪNG/.test(txt(cardOf('KT-01'))), txt(cardOf('KT-01')).slice(0,150));
  await clickText(/^Tiếp tục$/,cardOf('KT-01')); await sleep(600);
  ok('7b. Tiếp tục → ĐANG CHẠY', /ĐANG CHẠY/.test(txt(cardOf('KT-01'))));
  // 2nd order other machine
  await go(/Kế hoạch & phân công/);
  b=await assign('B-002','KT-02','Trần B'); await click(b); await sleep(800); await clickText(/^Để sau$/,modal()); await sleep(300);
  ok('9. B-002 ở KT-02, không lẫn A-001/KT-01', runs().some(r=>r.orderId==='B-002'&&r.machineId==='KT-02')&&runs().some(r=>r.orderId==='A-001'&&r.machineId==='KT-01')&&runs().length===2);
  await go(/Giám sát máy móc/);
  ok('9b. Thẻ KT-02 = B-002, KT-01 = A-001', /B-002/.test(txt(cardOf('KT-02')))&&!/A-001/.test(txt(cardOf('KT-02')))&&/A-001/.test(txt(cardOf('KT-01'))));
  ok('9c. Mỗi máy tối đa 1 lệnh đang chạy', Object.values(db.__store.machines).filter(x=>x.activeRunId).length===2);

  // 8 + 10: ghi sản lượng, kết thúc lệnh, hoàn thành công đoạn, chuyển công đoạn, giữ lịch sử
  await go(/Giám sát máy móc/);
  await clickText(/^Ghi sản lượng$/,cardOf('KT-01')); await sleep(300);
  m=modal(); const qi=[...m.querySelectorAll('input')].filter(i=>i.type==='text'); nativeSet(qi[0],'1000'); await sleep(100);
  const sv=[...m.querySelectorAll('button')].find(x=>/Lưu|Ghi/.test(txt(x))&&!/Hủy/.test(txt(x))); console.log('save btn',sv&&txt(sv),sv&&sv.disabled);
  await click(sv); await sleep(800);
  ok('8. Sản lượng ghi vào lệnh + đơn', db.__store.productionRuns&&runs().find(r=>r.orderId==='A-001').producedQuantity===1000 && Object.keys(db.__store.productionEntries||{}).length>=1, JSON.stringify(runs().map(r=>r.producedQuantity)));
  await clickText(/^Kết thúc lệnh$/,cardOf('KT-01')); await sleep(300); m=modal();
  const cb=[...m.querySelectorAll('input[type=checkbox]')]; cb.forEach(c=>{ if(!c.checked) c.click(); }); await sleep(100);
  const fb=[...m.querySelectorAll('button')].filter(x=>/Kết thúc|Xác nhận|Hoàn thành/.test(txt(x))&&!/Hủy/.test(txt(x))).pop(); console.log('finish btn',txt(fb),fb.disabled);
  await click(fb); await sleep(900);
  const ra=runs().find(r=>r.orderId==='A-001');
  ok('10. Lệnh A hoàn tất, máy KT-01 được giải phóng', ra.productionStatus==='completed'&&!db.__store.machines['KT-01'].activeRunId, ra.productionStatus+' lock='+db.__store.machines['KT-01'].activeRunId);
  ok('10b. Sản lượng + lịch sử giữ nguyên', ra.producedQuantity===1000 && Object.keys(db.__store.productionEntries||{}).length>=1 && Object.values(db.__store.auditLog||{}).length>=3, 'audit='+Object.values(db.__store.auditLog||{}).length);
  await go(/Kế hoạch & phân công/);
  const ta=txt(rowOf('A-001')); console.log('A after finish:',ta.slice(0,260));
  ok('10c. A chuyển công đoạn tiếp theo (Kéo tinh), chưa phân máy, không còn gắn KT-01', /Kéo tinh/.test(ta)&&/chưa phân máy|chờ/iu.test(ta)&&!/KT-01/.test(ta));
  await go(/Giám sát máy móc/);
  ok('10d. KT-01 trở về MÁY TRỐNG', /MÁY TRỐNG/.test(txt(cardOf('KT-01'))), txt(cardOf('KT-01')).slice(0,120));
  console.log(R.join('\n')); console.log('errs',errs.slice(0,5)); process.exit(0);
})().catch(e=>{console.log(R.join('\n'));console.log('FAIL',e.message);console.log('errs',errs.slice(0,5));process.exit(1)});
