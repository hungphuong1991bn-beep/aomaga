const {boot}=require('./e2e_lib');
const mode=process.argv[2];
const L=boot(mode==='deny'?{fakeOpts:{deny:{read:['productionRuns'],write:[]}}}:{});
const {doc,A,sleep,sha,nativeSet,txt,clickText,db,errs}=L;
const R=[];const ok=(n,c,d)=>R.push((c?'PASS ':'FAIL ')+n+(c?'':' -> '+(d||'')));
(async()=>{
  await sleep(300);
  JSON.parse(await A('return JSON.stringify(genMachineSeed())')).forEach(m=>db.__seed('machines',m.id,m));
  db.__seed('users','admin',{username:'admin',fullName:'Quản trị',role:'admin',pwHash:sha('amg:admin:test')});
  const mk=async(id,routing)=>{const j=await A(`const stages={};STAGES.forEach(s=>stages[s.key]={done:0,remain:0});return JSON.stringify(normalizeOrderStages({id:"${id}",customer:"KH-${id}",spec:"0.254BC",materialCode:"B",quantity:1000,orderDate:"2026-11-01",deliveryDate:"2026-12-30",priority:"normal",stages,finishedDone:0,finishedShort:0,routing:${JSON.stringify(routing)},routingConfirmed:true,createdAt:new Date().toISOString()}));`);const o=JSON.parse(j);db.__seed('orders',o.id,o);};
  await mk('A-001',['keo_trung']); await mk('C-003',['keo_trung']);
  if(mode!=='deny'){
    // lệnh cũ: không productionStatus, dùng startTime, đang chạy trên KT-01
    db.__seed('productionRuns','OLD1',{orderId:'A-001',machineId:'KT-01',stageKey:'keo_trung',status:'running',startTime:new Date().toISOString(),plannedQuantity:1000,producedQuantity:0});
    db.__seed('machines','KT-01',Object.assign({},db.__store.machines['KT-01'],{activeRunId:'OLD1'}));
    // lệnh hỏng dữ liệu: thiếu machineId
    db.__seed('productionRuns','BAD1',{orderId:'C-003',stageKey:'keo_trung',productionStatus:'assigned'});
  }
  await sleep(200);
  const i=[...doc.querySelectorAll('input')]; nativeSet(i[0],'admin'); nativeSet(i[1],'test'); await sleep(50);
  await clickText(/^Đăng nhập/); await sleep(700);
  await clickText(/Kế hoạch sản xuất/); await sleep(600);
  const body=txt(doc.querySelector('.mes-root')||doc.body);
  const rows=[...doc.querySelectorAll('.amg-row')];
  const row=id=>rows.find(r=>txt(r).includes('KH-'+id));
  if(mode==='deny'){
    ok('Quyền đọc productionRuns bị chặn → hiện thông báo lỗi rõ ràng', /quyền|permission|không đọc|lỗi/i.test(body), body.slice(0,300));
  } else {
    ok('Lệnh cũ (status=running, startTime) → đơn A hiển thị ĐANG CHẠY ở KT-01', row('A-001')&&/đang chạy/iu.test(txt(row('A-001')))&&/KT-01/.test(txt(row('A-001'))), row('A-001')&&txt(row('A-001')).slice(0,220));
    ok('Lệnh thiếu machineId KHÔNG tự gán máy; đơn C vẫn chưa phân máy', row('C-003')&&/chưa phân/iu.test(txt(row('C-003')))&&!/KT-0/.test(txt(row('C-003'))), row('C-003')&&txt(row('C-003')).slice(0,220));
    ok('Bảng kiểm tra dữ liệu báo lỗi lệnh thiếu tham chiếu', /thiếu|kiểm tra dữ liệu|bất thường/iu.test(body), '');
    ok('Không xóa dữ liệu gốc', !!db.__store.productionRuns.BAD1&&!!db.__store.productionRuns.OLD1);
  }
  console.log(R.join('\n'));console.log('errs',errs.slice(0,3));process.exit(0);
})().catch(e=>{console.log(R.join('\n'));console.log('FAIL',e.message);process.exit(1)});
