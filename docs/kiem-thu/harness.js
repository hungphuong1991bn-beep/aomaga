const fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');
const APP=process.env.APP_DIR||'/home/claude/src/aomaga_v45';
function load(opts={}){
  const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
  const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto,configurable:true});w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
  if(opts.storage) for(const k in opts.storage) w.localStorage.setItem(k,opts.storage[k]);
  const ctx=dom.getInternalVMContext();
  const run=(code,name)=>new vm.Script(code,{filename:name}).runInContext(ctx);
  run(fs.readFileSync((process.env.NM||'/home/claude/test/node_modules')+'/react/umd/react.development.js','utf8'),'react');
  run(fs.readFileSync((process.env.NM||'/home/claude/test/node_modules')+'/react-dom/umd/react-dom.development.js','utf8'),'react-dom');
  run(fs.readFileSync((process.env.NM||'/home/claude/test/node_modules')+'/xlsx/dist/xlsx.full.min.js','utf8'),'xlsx');
  if(opts.net!==false){ const rt=require('./fakertdb'); w.__server=opts.server||rt.makeServer(); rt.attach(w,w.__server,{latency:opts.latency||0}); } // RTDB giả lập (đúng lớp dữ liệu thật của v51+)
  if(opts.fake&&opts.net===false){ // Firebase "thật" (giả lập trung thực): không đi nhánh localStorage
    const {makeFakeFirestore}=require('./fakefs'); const fdb=opts.sharedDb||makeFakeFirestore(opts.fakeOpts||{});
    w.__db=fdb; w.firebase={firestore:{FieldValue:{serverTimestamp:()=>fdb.__SENTINEL}}};
    run('window.PropTypes={};window.Recharts={};window.XLSX=window.XLSX||{};',"stubs");
  } else
  run('window.PropTypes={};window.Recharts={};window.XLSX=window.XLSX||{};window.firebase={firestore:{FieldValue:{serverTimestamp:function(){return new Date().toISOString();}}}};',"stubs");
  run('(()=>{let v=null;Object.defineProperty(window,"__AMG_USER",{configurable:true,get(){return v},set(x){ if(x) v=x; }})})()','amguser');
  const srcs=[...html.matchAll(/<script src="([^"]+?)\?v=[\d.]+"/g)].map(m=>m[1]).filter(s=>!s.startsWith('http'));
  for(const s of srcs){ run(fs.readFileSync(path.join(APP,s),'utf8'),s); }
  if(opts.net!==false&&w.__db){ // tiện ích cho E2E: gieo trực tiếp lên máy chủ RTDB giả lập và đọc lại kho dữ liệu (tương đương __seed/__store của bản giả Firestore cũ)
    const srv=w.__server;
    w.__db.__seed=(col,id,obj)=>srv.patch({[col+'/'+id]:{d:JSON.stringify(obj),t:Date.now()}});
    Object.defineProperty(w.__db,'__store',{configurable:true,get:()=>{ const o={}; Object.keys(srv.root).forEach(c=>{ o[c]={}; Object.keys(srv.root[c]||{}).forEach(i=>{ try{ o[c][i]=JSON.parse(srv.root[c][i].d); }catch(e){} }); }); return o; }});
  }
  return {dom,w,run,ctx,srcs};
}
module.exports={load};
