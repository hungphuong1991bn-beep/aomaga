const path=__dirname+'/../';
const {load}=require(path+'harness');
const crypto=require('crypto');
function boot(opts={}){
  const t=load(Object.assign({fake:true},opts));
  const w=t.w, doc=w.document;
  const errs=[]; w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,500)); w.addEventListener('error',e=>errs.push('uncaught: '+e.message));
  w.console.warn=()=>{};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const A=async code=>await t.run('(async()=>{'+code+'})()');
  const db=w.__db;
  const sha=(s)=>crypto.createHash('sha256').update(s).digest('hex');
  const nativeSet=(el,val)=>{ const proto=el.tagName==='SELECT'?w.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); };
  const txt=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const buttons=(scope)=>[...(scope||doc).querySelectorAll('button')];
  const findBtn=(re,scope)=>buttons(scope).find(b=>re.test(txt(b)));
  const click=async(el)=>{ if(!el) throw new Error('no element to click'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); await sleep(60); };
  const clickText=async(re,scope)=>{ const b=findBtn(re,scope); if(!b) throw new Error('button not found: '+re+' | have: '+buttons(scope).map(txt).filter(Boolean).slice(0,40).join(' | ')); await click(b); return b; };
  const modal=()=>[...doc.querySelectorAll('.mes-modal-card')].pop()||null;
  return {t,w,doc,errs,sleep,A,db,sha,nativeSet,txt,buttons,findBtn,click,clickText,modal};
}
function seedStore(db,sha,W){
  // seed qua API Node: users + machines + vài đơn
  const set=(c,id,d)=>db.collection(c).doc(id).set(d);
  return {set};
}
module.exports={boot};
