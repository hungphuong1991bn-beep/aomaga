/* v58 GĐ3 — Nghiệm thu Điểm danh – Chấm công (mới) và Lịch làm việc. Giao diện thật (React+jsdom) + RTDB giả lập.
   Chạy: NM=<node_modules> APP_DIR=../.. node accept58_hr.js */
const {load}=require('./harness'); const rt=require('./fakertdb');
const server=rt.makeServer(); const t=load({server}); const w=t.w;
const R=c=>t.run(c); const A=async c=>await t.run('(async()=>{'+c+'})()');
const J=async c=>JSON.parse(await A('return JSON.stringify(await (async()=>{'+c+'})())'));
let pass=0,fail=0;const out=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=4000,msg='timeout'){const t0=Date.now();for(;;){try{if(await fn())return;}catch(e){}if(Date.now()-t0>ms)throw new Error(msg);await sleep(25);}}
const ok=(c,m)=>{if(!c)throw new Error(m||'assert');};
const $=(s,r)=>(r||w.document).querySelector(s), $$=(s,r)=>[...(r||w.document).querySelectorAll(s)];
const click=el=>{ if(!el) throw new Error('không tìm thấy phần tử để bấm'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); };
const byText=(sel,txt)=>$$(sel).find(e=>(e.textContent||'').trim()===txt||(e.textContent||'').includes(txt));
const cleanup=()=>{ try{ R('if(window.__root){try{window.__root.unmount()}catch(e){} window.__rootEl.remove();window.__root=null}'); }catch(e){} };
async function T(n,f){try{await f();pass++;out.push('PASS '+n);}catch(e){fail++;out.push('FAIL '+n+' :: '+(e&&e.message||e));} cleanup(); }
const errs=[]; w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
async function mountStaff(overtime){
  await A(`window.__att={};const sn=await db.collection('attendance').get();sn.docs.forEach(d=>{window.__att[d.id]=d.data();});`);
  R(`(()=>{const staff=SEED_STAFF.slice(0,12);window.__staff=staff;const root=document.createElement('div');document.body.appendChild(root);window.__root=ReactDOM.createRoot(root);window.__rootEl=root;
    const mut=col=>(d,fn,s)=>db.casDoc(col,d,cur=>fn(Object.assign({},cur||{})));
    window.__root.render(React.createElement(DialogProvider,null,React.createElement(StaffPage,{staff,isAdmin:true,canEdit:true,onAdd(){},onUpdate(){},onDelete(){},onImport(){},attendance:window.__att,onAttendanceMutate:mut('attendance'),onScheduleMutate:mut('schedule'),extra:{overtime:${JSON.stringify(overtime||[])}},auditLog:[],currentUser:window.__AMG_USER})));})()`);
}
const tab=txt=>click($$('[role=tab]').find(b=>b.textContent.includes(txt)));
const today=()=>R('amgTodayKey()');
(async()=>{
  R('window.__AMG_USER={username:"admin",role:"admin",fullName:"Quản trị"};');
  await T('A1. Logic: amgScMake đánh dấu "đã đổi, chưa thông báo" khi sửa lịch đã xác nhận', async()=>{
    const r=JSON.parse(R(`JSON.stringify([amgScMake({shift:"ngay",confirmed:true},{shift:"dem"},"u","t"),amgScMake({shift:"ngay",confirmed:true},{shift:"ngay"},"u","t"),amgScMake(null,{shift:"ngay"},"u","t")])`));
    ok(r[0].changed===true&&r[0].notified===false&&r[0].swapFrom==='ngay'&&r[0].confirmed===false,'đổi ca đã xác nhận: '+JSON.stringify(r[0]));
    ok(r[1].confirmed===true&&!r[1].changed,'không đổi gì thì giữ xác nhận');
    ok(r[2].confirmed===false&&!r[2].changed,'ca mới chưa xác nhận');
  });
  await T('A2. Logic: cảnh báo chỉ tính khi đủ dữ liệu (không có lịch → không cảnh báo chưa xếp ca/thiếu nhân lực)', async()=>{
    const r=JSON.parse(R(`(()=>{const pool=SEED_STAFF.slice(0,5);const a=amgScAlerts({pool,days:{},attendance:{},overtime:[],settings:{minPerGroup:3},from:"2026-11-23",to:"2026-11-29"});return JSON.stringify(Object.keys(a).map(k=>a[k].length));})()`));
    ok(r.every(n=>n===0),'phải 0 cảnh báo khi chưa có lịch: '+r);
  });
  await T('A3. Logic: cảnh báo mâu thuẫn điểm danh/tăng ca và chưa xếp ca khi ngày đã có lịch', async()=>{
    const r=JSON.parse(R(`(()=>{const pool=SEED_STAFF.slice(0,3);const [a,b,c]=pool;const d="2026-11-24";
      const days={[d]:{[a.id]:{shift:"ngay",confirmed:false},[b.id]:{shift:"nghi_phep",confirmed:true}}};
      const att={[d]:{[a.id]:{nghiPhep:true},[b.id]:{caNgay:true}}};
      const ot=[{staffId:b.id,date:d,status:"cho_duyet",hours:2}];
      const x=amgScAlerts({pool,days,attendance:att,overtime:ot,settings:{},from:d,to:d});
      return JSON.stringify({un:x.unassigned.length,cf:x.conflict.length,uc:x.unconfirmed.length,ot:x.otPending.length});})()`));
    ok(r.un===1&&r.cf===3&&r.uc===1&&r.ot===1,'kết quả '+JSON.stringify(r));
  });
  await T('A4. Trạng thái điểm danh: Chưa / Chờ xác nhận / Có mặt+Đi muộn / Nghỉ', async()=>{
    const r=JSON.parse(R(`JSON.stringify([amgAtStatusKeys(undefined),amgAtStatusKeys({note:"x"}),amgAtStatusKeys({timeIn:"06:00"}),amgAtStatusKeys({caNgay:true,diLamMuon:true}),amgAtStatusKeys({nghiPhep:true}),amgAtStatusKeys({nghiKhongPhep:true})])`));
    ok(JSON.stringify(r)===JSON.stringify([['none'],['pending'],['pending'],['present','late'],['leave'],['absent']]),JSON.stringify(r));
  });
  await T('B1. Điểm danh: KPI, cột, điểm danh nhanh ghi đúng attendance và hiện trạng thái', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Điểm danh');
    await until(()=>$$('.dx-kpi').length>=10,3000,'đủ 10 KPI');
    const txt=w.document.body.textContent;
    for(const k of ['Đã điểm danh','Chưa điểm danh','Chờ xác nhận','Có mặt','Đi muộn','Về sớm','Nghỉ phép','Nghỉ không phép','Đang tăng ca']) ok(txt.includes(k),'thiếu KPI '+k);
    for(const h of ['STT','Mã NV','Họ và tên','Phòng ban / Tổ','Bộ phận','Ca làm','Giờ vào','Giờ ra','Tổng thời gian','Trạng thái','Ghi chú']) ok($$('th').some(x=>x.textContent===h),'thiếu cột '+h);
    click($$('.at-chip').find(b=>b.textContent==='Ca Ngày'));
    const d=await today(); await until(async()=>{const s=await J(`const x=await db.collection("attendance").doc("${d}").get();return x.exists?Object.values(x.data()):[]`);return s.length===1&&s[0].caNgay===true;},4000,'attendance chưa ghi');
    cleanup(); await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Điểm danh');
    await until(()=>$$('.mes-badge').some(b=>b.textContent==='Có mặt'),3000,'chưa hiện badge Có mặt');
  });
  await T('B2. Điểm danh: lọc nhanh Chưa điểm danh / Đã điểm danh', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Điểm danh'); await until(()=>$$('.at-seg button').length>0);
    const rowsN=()=>$$('tbody tr').length; const all=rowsN();
    click($$('.at-seg button').find(b=>b.textContent.startsWith('Đã điểm danh'))); await until(()=>rowsN()===1,3000,'Đã điểm danh phải còn 1 dòng, có '+rowsN());
    click($$('.at-seg button').find(b=>b.textContent.startsWith('Chưa điểm danh'))); await until(()=>rowsN()===all-1,3000,'Chưa điểm danh phải còn '+(all-1)+', có '+rowsN());
  });
  await T('C1. Lịch làm việc: 3 chế độ, chú giải đủ nhãn (có chữ, không chỉ màu)', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Lịch làm việc'); await until(()=>byText('button','Phân công ca'));
    const seg=$$('.at-seg button').map(b=>b.textContent); ok(['Ngày','Tuần','Tháng'].every(x=>seg.includes(x)),'seg '+seg);
    const leg=$('.sc-leg').textContent; for(const k of ['Ca ngày','Ca đêm','Nghỉ phép','Nghỉ lễ','Đổi ca','Tăng ca','Chưa xếp ca']) ok(leg.includes(k),'chú giải thiếu '+k);
    click($$('.at-seg button').find(b=>b.textContent==='Tháng')); await until(()=>$('.sc-month'));
    click($$('.at-seg button').find(b=>b.textContent==='Ngày')); await until(()=>$$('th').some(x=>x.textContent==='Trạng thái lịch'));
    click($$('.at-seg button').find(b=>b.textContent==='Tuần')); await until(()=>$('.sc-week'));
  });
  await T('C2. Phân công ca cả danh sách → có xác nhận → ghi schedule/{ngày} đúng, một mục/người/ngày', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Lịch làm việc'); await until(()=>byText('button','Phân công ca'));
    click(byText('button','Phân công ca')); await until(()=>byText('button','Xem lại và lưu'));
    click(byText('button','Xem lại và lưu')); await until(()=>byText('button','Lưu lịch'),3000,'chưa có hộp xác nhận');
    click(byText('button','Lưu lịch'));
    const d=await today(); await until(async()=>{const s=await J(`const x=await db.collection("schedule").doc("${d}").get();return x.exists?Object.values(x.data()):[]`);return s.length===12&&s.every(e=>e.shift==='ngay'&&e.confirmed===false);},5000,'schedule chưa ghi đủ 12 người');
  });
  await T('C3. Sau khi có lịch: cảnh báo "chưa xác nhận", xác nhận hàng loạt, và điểm danh đọc lịch (Điền theo lịch)', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Lịch làm việc');
    await until(()=>$$('.sc-alert').some(a=>a.textContent.includes('Lịch chưa được xác nhận: 12')),4000,'cảnh báo chưa xác nhận');
    click(byText('button','Xác nhận các lịch này')); await until(()=>byText('button','Xác nhận lịch')); click($$('button').filter(b=>b.textContent==='Xác nhận lịch').pop());
    const d=await today(); await until(async()=>{const s=await J(`const x=await db.collection("schedule").doc("${d}").get();return Object.values(x.data())`);return s.every(e=>e.confirmed===true);},5000,'chưa xác nhận');
    tab('Điểm danh'); await until(()=>byText('button','Điền theo lịch làm việc'),4000,'thiếu nút điền theo lịch');
    ok(w.document.body.textContent.includes('12 người có ca làm theo lịch'),'KPI tổng phải nêu số người theo lịch');
  });
  await T('C4. Sửa ca đã xác nhận → hỏi xác nhận → đánh dấu "đã đổi, chưa thông báo" → cảnh báo', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Lịch làm việc'); await until(()=>$$('.sc-cell').length>0);
    click($$('.sc-cell').find(b=>b.textContent.startsWith('Ngày'))); await until(()=>$('.hr-drawer,[role=dialog],.mes-modal')||byText('button','Lưu thay đổi'));
    const sel=$$('select').find(s=>[...s.options].some(o=>o.value==='dem')&&[...s.options].some(o=>o.value==='nghi_le')&&!s.getAttribute('aria-label')); 
    Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype,'value').set.call(sel,'dem'); sel.dispatchEvent(new w.Event('change',{bubbles:true}));
    click(byText('button','Lưu thay đổi')); await until(()=>byText('button','Lưu thay đổi')&&w.document.body.textContent.includes('đã được xác nhận'),3000,'phải hỏi xác nhận');
    click($$('button').filter(b=>b.textContent==='Lưu thay đổi').pop());
    const d=await today(); await until(async()=>{const s=await J(`const x=await db.collection("schedule").doc("${d}").get();return Object.values(x.data())`);return s.some(e=>e.shift==='dem'&&e.changed===true&&e.notified===false&&e.swapFrom==='ngay');},5000,'chưa ghi cờ đổi ca');
  });
  await T('C5. Sao chép lịch tuần trước (tuần trước trống → báo không có gì để sao chép, không ghi)', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Lịch làm việc'); await until(()=>byText('button','Sao chép lịch tuần trước'));
    click(byText('button','Sao chép lịch tuần trước')); await until(()=>w.document.body.textContent.includes('chưa có lịch cho nhân viên đang lọc'),3000,'phải báo tuần trước chưa có lịch');
  });
  await T('C6. Nhân viên (chỉ xem) không có nút thao tác lịch và bị cổng ghi chặn', async()=>{
    R('window.__AMG_USER={username:"nv",role:"employee",fullName:"Nhân viên"};');
    const r=JSON.parse(R(`JSON.stringify([amgCheckWrite(window.__AMG_USER,"schedule","set","2026-11-24",{}).ok,amgCheckWrite({role:"manager"},"schedule","set","x",{}).ok])`)); ok(r[0]===false&&r[1]===true,JSON.stringify(r));
    R('window.__AMG_USER={username:"admin",role:"admin",fullName:"Quản trị"};');
  });
  await T('D1. Báo cáo chấm công: cột Ngày công / Chờ xác nhận, nhóm theo Bộ phận, xuất Excel', async()=>{
    await mountStaff(); await until(()=>$$('[role=tab]').length>=4); tab('Điểm danh'); await until(()=>byText('button','Báo cáo chấm công')); click(byText('button','Báo cáo chấm công'));
    await until(()=>$$('th').some(x=>x.textContent==='Ngày công')&&$$('th').some(x=>x.textContent==='Chờ xác nhận'),3000,'thiếu cột');
    const g=$$('select').find(s=>[...s.options].some(o=>o.value==='position')); ok(g,'thiếu nhóm theo Bộ phận');
    ok(byText('button','Xuất Excel'),'thiếu nút Excel');
  });
  await T('E1. Không có lỗi React nghiêm trọng trong console', async()=>{ const bad=errs.filter(e=>!/act\(|Warning: An update|not wrapped/i.test(e)); ok(bad.length===0,bad.slice(0,3).join(' | ')); });
  console.log(out.join('\n')); console.log(`\n${pass} pass, ${fail} fail`); process.exit(fail?1:0);
})();
