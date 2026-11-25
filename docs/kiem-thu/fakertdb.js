/* Giả lập Firebase Realtime Database (REST PATCH + luồng SSE) cho jsdom.
   - makeServer(): một "máy chủ" dùng chung; nhiều cửa sổ (thiết bị) cùng nối vào → kiểm thử đa thiết bị.
   - attach(w, server, {latency}): gắn fetch + EventSource vào cửa sổ jsdom TRƯỚC khi nạp core/runtime.js.
   Giữ đúng ngữ nghĩa quan trọng: PATCH nhiều đường dẫn là nguyên tử; giá trị null = xóa; mỗi thay đổi được đẩy tới MỌI luồng SSE. */
function makeServer(){
  const s={ root:{}, streams:new Set(), log:[], online:true, writes:0, ver:{}, conflicts:0 };
  s.setPath=(path,val)=>{ const segs=path.split('/').filter(Boolean); if(!segs.length){ s.root=val||{}; return; }
    let o=s.root; for(let i=0;i<segs.length-1;i++){ if(typeof o[segs[i]]!=='object'||o[segs[i]]===null) o[segs[i]]={}; o=o[segs[i]]; }
    if(val===null||val===undefined) delete o[segs[segs.length-1]]; else o[segs[segs.length-1]]=val; };
  s.getPath=(path)=>{ let o=s.root; for(const k of path.split('/').filter(Boolean)){ if(o==null) return null; o=o[k]; } return o===undefined?null:o; };
  s.patch=(body)=>{ s.writes++; const data={}; Object.keys(body).forEach(p=>{ s.setPath('/'+p,body[p]); data[p]=body[p]; s.ver[p]=(s.ver[p]||0)+1; });
    s.streams.forEach(st=>st.emit('patch',{path:'/',data})); };
  return s;
}
function attach(w,server,opt={}){
  const lat=opt.latency||0; const tick=(f)=>setTimeout(f,lat);
  w.__net={online:true};
  w.fetch=(url,init={})=>new Promise((res,rej)=>tick(()=>{
    if(!w.__net.online||!server.online) return rej(new Error('network down'));
    const path=String(url).replace(/^https?:\/\/[^/]+/,'').replace(/\.json.*$/,'');
    const rel=path.replace(/^\/amg/,'').replace(/^\//,'');
    const hdr=init.headers||{}; const method=init.method||'GET';
    const mk=(status,body,extra={})=>({ok:status>=200&&status<300,status,json:async()=>body,headers:{get:k=>server.hideEtag?null:(extra[String(k).toLowerCase()]||null)}});
    const etagOf=()=>s_etag(rel);
    function s_etag(r){ return server.getPath('/'+r)==null?'null_etag':String(server.ver[r]||0)+'-'+String(server.writes); }
    if(method==='PATCH'){ server.patch(JSON.parse(init.body)); return res(mk(200,{})); }
    if(method==='PUT'){ const im=hdr['if-match']; const curTag=server.getPath('/'+rel)==null?'null_etag':String(server.ver[rel]||0); if(im!==undefined&&im!==curTag){ server.conflicts++; return res(mk(412,server.getPath('/'+rel))); } server.patch({[rel]:JSON.parse(init.body)}); return res(mk(200,{})); }
    const curTag=server.getPath('/'+rel)==null?'null_etag':String(server.ver[rel]||0);
    res(mk(200,server.getPath('/'+rel),hdr['X-Firebase-ETag']?{etag:curTag}:{}));
  }));
  w.EventSource=class{
    constructor(url){ this.readyState=1; this.l={}; this.url=url; this._st={emit:(t,d)=>{ if(this.readyState===2||!w.__net.online) return; tick(()=>{ const dd=typeof d==='function'?d():d; (this.l[t]||[]).forEach(f=>f({data:JSON.stringify(dd)})); }); }};
      server.streams.add(this._st); tick(()=>{ if(!w.__net.online){ this.onerror&&this.onerror(); return; } (this.l.open||[]).forEach(f=>f({})); this._st.emit('put',()=>({path:'/',data:Object.keys(server.root).length?JSON.parse(JSON.stringify(server.root)):null})); }); }
    addEventListener(t,f){ (this.l[t]=this.l[t]||[]).push(f); }
    close(){ this.readyState=2; server.streams.delete(this._st); }
  };
}
module.exports={makeServer,attach};
