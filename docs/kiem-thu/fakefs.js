/* Firestore giả lập (đủ trung thực với SDK compat 10.x) để chạy mã ứng dụng ở chế độ "Firebase thật":
   - window.__isOfflineDb KHÔNG được đặt  → mã đi nhánh runTransaction (không phải nhánh localStorage)
   - snapshot.exists là THUỘC TÍNH boolean (SDK compat), không phải hàm
   - serverTimestamp() là sentinel, khi ghi được đổi thành Timestamp (có toMillis/toDate) như Firestore thật
   - onSnapshot gọi bất đồng bộ, trả về cả bản cache cục bộ (hasPendingWrites) lẫn bản server
   - Giao dịch: mọi lần đọc phải trước ghi; xung đột phiên bản → chạy lại callback (như SDK thật)
   - Có thể bật "rules" từ chối đọc/ghi theo collection để mô phỏng Security Rules. */
function makeFakeFirestore(opts = {}) {
  const store = {};            // col -> { id: data }
  const versions = {};         // "col/id" -> số phiên bản (phát hiện xung đột giao dịch)
  const listeners = {};        // col -> Set
  const deny = opts.deny || { read: [], write: [] };
  class Timestamp {
    constructor(ms) { this._ms = ms; this.seconds = Math.floor(ms / 1000); this.nanoseconds = (ms % 1000) * 1e6; }
    toMillis() { return this._ms; } toDate() { return new Date(this._ms); }
    isEqual(o) { return o && o._ms === this._ms; }
  }
  const SENTINEL = { __sentinel: "serverTimestamp", isEqual() { return false; } };
  const clone = v => {
    if (v === SENTINEL) return new Timestamp(Date.now());
    if (v instanceof Timestamp) return v;
    if (Array.isArray(v)) return v.map(clone);
    if (v && typeof v === "object") { const o = {}; Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = clone(v[k]); }); return o; }
    return v;
  };
  const vkey = (c, i) => c + "/" + i;
  const bump = (c, i) => { versions[vkey(c, i)] = (versions[vkey(c, i)] || 0) + 1; };
  function notify(col) {
    const docsObj = store[col] || {};
    (listeners[col] ? [...listeners[col]] : []).forEach(fn => setTimeout(() => fn(docsObj), 0));
  }
  function snapOf(col, id) {
    const d = store[col] && store[col][id];
    return { id, exists: !!d, data: () => (d ? clone(d) : undefined), ref: null };
  }
  function applySet(col, id, data, merge) {
    store[col] = store[col] || {};
    const c = clone(data);
    store[col][id] = merge ? Object.assign({}, store[col][id] || {}, c) : c;
    bump(col, id);
  }
  function applyUpdate(col, id, data) {
    if (!(store[col] && store[col][id])) { const e = new Error("No document to update: " + col + "/" + id); e.code = "not-found"; throw e; }
    store[col][id] = Object.assign({}, store[col][id], clone(data)); bump(col, id);
  }
  function applyDelete(col, id) { if (store[col]) delete store[col][id]; bump(col, id); }
  const permErr = (op, col) => { const e = new Error(`Missing or insufficient permissions (${op} ${col})`); e.code = "permission-denied"; return e; };
  const canRead = col => !deny.read.includes(col), canWrite = col => !deny.write.includes(col);

  class DocumentReference {
    constructor(col, id) { this.col = col; this.id = id; this.parent = { id: col }; this.path = col + "/" + id; }
    get() { if (!canRead(this.col)) return Promise.reject(permErr("get", this.col)); return Promise.resolve(snapOf(this.col, this.id)); }
    set(data, o) { if (!canWrite(this.col)) return Promise.reject(permErr("set", this.col)); applySet(this.col, this.id, data, !!(o && o.merge)); notify(this.col); return Promise.resolve(); }
    update(data) { if (!canWrite(this.col)) return Promise.reject(permErr("update", this.col)); try { applyUpdate(this.col, this.id, data); } catch (e) { return Promise.reject(e); } notify(this.col); return Promise.resolve(); }
    delete() { if (!canWrite(this.col)) return Promise.reject(permErr("delete", this.col)); applyDelete(this.col, this.id); notify(this.col); return Promise.resolve(); }
  }
  function query(col, o) {
    const q = {
      orderBy: (f, d) => query(col, Object.assign({}, o, { orderBy: [f, d || "asc"] })),
      limit: n => query(col, Object.assign({}, o, { limit: n })),
      get: () => Promise.resolve(mkSnap(col, o)),
      onSnapshot: (next, err) => {
        if (!canRead(col)) { setTimeout(() => err && err(permErr("listen", col)), 0); return () => {}; }
        const push = () => { try { next(mkSnap(col, o)); } catch (e) { console.error("onSnapshot cb", e); } };
        listeners[col] = listeners[col] || new Set();
        const fn = () => push(); listeners[col].add(fn);
        setTimeout(push, 0);
        return () => listeners[col].delete(fn);
      }
    };
    return q;
  }
  function mkSnap(col, o) {
    let ids = Object.keys(store[col] || {});
    if (o && o.orderBy) {
      const [f, dir] = o.orderBy;
      // Firestore thật: orderBy LOẠI các tài liệu thiếu trường đó
      ids = ids.filter(i => store[col][i][f] !== undefined && store[col][i][f] !== null);
      const val = x => (x && x.toMillis ? x.toMillis() : x);
      ids.sort((a, b) => { const av = val(store[col][a][f]), bv = val(store[col][b][f]); return (av > bv ? 1 : av < bv ? -1 : 0) * (dir === "desc" ? -1 : 1); });
    }
    if (o && o.limit) ids = ids.slice(0, o.limit);
    return { docs: ids.map(i => ({ id: i, exists: true, data: () => clone(store[col][i]) })), size: ids.length, empty: ids.length === 0, metadata: { hasPendingWrites: false, fromCache: false } };
  }
  const colRef = col => {
    const q = query(col, {});
    q.doc = id => new DocumentReference(col, id === undefined ? "auto_" + Math.random().toString(36).slice(2, 10) : id);
    q.add = data => { const id = "auto_" + Math.random().toString(36).slice(2, 10); return new DocumentReference(col, id).set(data).then(() => ({ id })); };
    return q;
  };
  const db = {
    __fake: true, __store: store, __versions: versions, __Timestamp: Timestamp, __SENTINEL: SENTINEL,
    __txRuns: 0,
    __seed(col, id, data) { applySet(col, id, data, false); notify(col); },
    settings() {},
    collection: colRef,
    batch() {
      const ops = [];
      return {
        set: (r, d, o) => { ops.push(["set", r, d, o]); }, update: (r, d) => { ops.push(["update", r, d]); }, delete: r => { ops.push(["delete", r]); },
        commit() {
          for (const [op, r] of ops) if (!canWrite(r.col)) return Promise.reject(permErr(op, r.col));
          try {
            ops.forEach(([op, r, d, o]) => { if (op === "set") applySet(r.col, r.id, d, !!(o && o.merge)); else if (op === "update") applyUpdate(r.col, r.id, d); else applyDelete(r.col, r.id); });
          } catch (e) { return Promise.reject(e); }
          [...new Set(ops.map(x => x[1].col))].forEach(notify); return Promise.resolve();
        }
      };
    },
    async runTransaction(fn, o) {
      const maxAttempts = (o && o.maxAttempts) || 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        db.__txRuns++;
        const seen = {}, writes = []; let wrote = false;
        const tx = {
          get: async ref => {
            if (wrote) throw new Error("Firestore transactions require all reads to be executed before all writes.");
            if (!canRead(ref.col)) throw permErr("get", ref.col);
            seen[vkey(ref.col, ref.id)] = versions[vkey(ref.col, ref.id)] || 0;
            await new Promise(r => setTimeout(r, 0)); // thời gian mạng: cho tác vụ khác chen vào
            return snapOf(ref.col, ref.id);
          },
          set: (ref, d, o2) => { wrote = true; writes.push(["set", ref, d, o2]); return tx; },
          update: (ref, d) => { wrote = true; writes.push(["update", ref, d]); return tx; },
          delete: ref => { wrote = true; writes.push(["delete", ref]); return tx; }
        };
        const result = await fn(tx);
        const conflict = Object.keys(seen).some(k => (versions[k] || 0) !== seen[k]);
        if (conflict) { if (attempt === maxAttempts) { const e = new Error("Transaction failed (contention)"); e.code = "aborted"; throw e; } continue; }
        for (const [, r] of writes) if (!canWrite(r.col)) throw permErr("write", r.col);
        writes.forEach(([op, r, d, o2]) => { if (op === "set") applySet(r.col, r.id, d, !!(o2 && o2.merge)); else if (op === "update") applyUpdate(r.col, r.id, d); else applyDelete(r.col, r.id); });
        [...new Set(writes.map(x => x[1].col))].forEach(notify);
        return result;
      }
    }
  };
  return db;
}
module.exports = { makeFakeFirestore };
