/* eslint-disable */
const COMPANY_NAME = "AOMAGA VIỆT NAM";
const COMPANY_FULL_NAME = "CÔNG TY TNHH ĐỒNG KỸ THUẬT AOMAGA VIỆT NAM";
const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  createContext,
  useContext,
  useRef
} = React;
const {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} = window.Recharts || {};
/* ═══════════════════════════════════════════════════════════════
   ★  LỚP DỮ LIỆU — Firebase Realtime Database (REST + SSE)  ★
   Thay hoàn toàn Firestore + Firebase Authentication cũ.
   - Giữ nguyên API giống Firestore (collection/doc/onSnapshot/batch...) để
     toàn bộ mã ứng dụng hiện có chạy không cần sửa.
   - Dữ liệu nằm dưới nút /amg/<bộ sưu tập>/<mã tài liệu> trên Realtime Database.
     Mỗi tài liệu lưu dạng { d: "<JSON>", t: <ms> } để giữ đúng kiểu dữ liệu
     (mảng rỗng, null, đối tượng lồng nhau — RTDB gốc sẽ làm rơi các giá trị này).
   - Đọc: một luồng SSE (EventSource) tới /amg.json → mọi thiết bị thấy thay đổi tức thì.
   - Ghi: ghi vào bộ nhớ + localStorage ngay, rồi gửi PATCH nhiều đường dẫn (nguyên tử).
     Mất mạng: thay đổi được xếp hàng, tự gửi lại khi có mạng.
   - Đăng nhập: dùng tài khoản băm SHA-256 lưu trong bộ sưu tập "users" (không dùng Firebase Auth).
   Cờ window.__isOfflineDb = true được giữ nguyên tên để các màn hình đăng nhập/tài khoản
   chạy nhánh "tài khoản cục bộ" (không Auth, không giao dịch phía máy chủ).
═══════════════════════════════════════════════════════════════ */
const AMG_RTDB_URL = "https://quanlysx-9e9ad-default-rtdb.asia-southeast1.firebasedatabase.app";
(function setupRtdbDb() {
  var BASE = AMG_RTDB_URL.replace(/\/+$/, "");
  var ROOT = "amg";
  var CACHE_KEY = "amg_mes_rtdb_cache_v1";
  var QUEUE_KEY = "amg_mes_rtdb_queue_v1";
  var NO_CACHE = { certificates: true }; // ảnh/PDF chứng chỉ quá nặng cho localStorage
  var ROOT_URL = BASE + "/" + ROOT + ".json";

  /* ---------- Trạng thái kết nối + thanh thông báo ---------- */
  var status = { state: "connecting", pending: 0, lastSync: 0, lastRemote: 0, readError: "", writeError: "" };
  var statusSubs = [];
  var ready = false, readyCbs = [];
  var bannerEl = null;
  function updateBanner() {
    try {
      var msg = "";
      if (!ready && status.state !== "error") msg = "Đang kết nối máy chủ dữ liệu… (lần đầu cần có mạng)";
      else if (status.readError) msg = status.readError;
      else if (status.writeError) msg = status.writeError;
      else if (status.state === "offline") msg = "Mất kết nối — đang dùng dữ liệu lưu trên máy" + (status.pending ? " (" + status.pending + " thay đổi chờ gửi)" : "") + ". Sẽ tự đồng bộ khi có mạng.";
      if (!document.body) return;
      if (!msg) { if (bannerEl) { bannerEl.remove(); bannerEl = null; } return; }
      if (!bannerEl) {
        bannerEl = document.createElement("div");
        bannerEl.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);max-width:92vw;z-index:99999;background:#1f2937;color:#fff;padding:8px 14px;border-radius:8px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);text-align:center";
        document.body.appendChild(bannerEl);
      }
      bannerEl.textContent = msg;
    } catch (e) {}
  }
  function setStatus(p) {
    Object.assign(status, p);
    statusSubs.slice().forEach(function (f) { try { f(status); } catch (e) {} });
    updateBanner();
  }
  window.__rtdbStatus = status;
  window.__rtdbSubscribe = function (fn) {
    statusSubs.push(fn);
    return function () { statusSubs = statusSubs.filter(function (f) { return f !== fn; }); };
  };

  /* ---------- Mã hoá khoá (RTDB cấm . $ # [ ] /) ---------- */
  function encKey(s) {
    return String(s).replace(/[%.$#\[\]\/\u0000-\u001f\u007f]/g, function (c) {
      return "%" + ("0" + c.charCodeAt(0).toString(16).toUpperCase()).slice(-2);
    });
  }
  function decKey(s) {
    return String(s).replace(/%([0-9A-F]{2})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
  }
  function pathOf(col, id) { return encKey(col) + "/" + encKey(id); }

  /* ---------- Kho dữ liệu trong bộ nhớ (+ bản lưu localStorage) ---------- */
  function loadJson(key, fallback) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }
  var data = loadJson(CACHE_KEY, {});
  if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
  var raws = {}; // "col/id" -> chuỗi JSON đã biết trên máy chủ (để bỏ qua bản lặp)
  var hadCache = Object.keys(data).some(function (c) { return Object.keys(data[c] || {}).length > 0; });
  var saveTimer = null;
  function saveCacheSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try {
        var o = {};
        Object.keys(data).forEach(function (c) { if (!NO_CACHE[c]) o[c] = data[c]; });
        localStorage.setItem(CACHE_KEY, JSON.stringify(o));
      } catch (e) { console.warn("Không thể lưu bộ nhớ đệm cục bộ:", e.message); }
    }, 400);
  }

  /* ---------- Người nghe ---------- */
  var listeners = {};
  function subscribe(col, fn) {
    (listeners[col] = listeners[col] || []).push(fn);
    return function () { listeners[col] = (listeners[col] || []).filter(function (f) { return f !== fn; }); };
  }
  function notify(col) {
    if (!ready) return;
    (listeners[col] || []).slice().forEach(function (fn) { fn(); });
  }
  function whenReady(fn) { if (ready) fn(); else readyCbs.push(fn); }
  function markReady() {
    if (ready) return;
    ready = true;
    var cbs = readyCbs; readyCbs = [];
    cbs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    updateBanner();
  }

  /* ---------- Hàng đợi ghi ---------- */
  var queue = loadJson(QUEUE_KEY, []);
  if (!Array.isArray(queue)) queue = [];
  var inflight = false, retryTimer = null, retryDelay = 3000;
  status.pending = queue.length;
  function saveQueue() {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch (e) { console.warn("Không thể lưu hàng đợi:", e.message); }
    setStatus({ pending: queue.length });
  }
  function isPending(p) {
    for (var i = 0; i < queue.length; i++) if (Object.prototype.hasOwnProperty.call(queue[i].w, p)) return true;
    return false;
  }
  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function () { retryTimer = null; flush(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }
  function flush() {
    if (inflight || !queue.length) return;
    inflight = true;
    var item = queue[0];
    fetch(ROOT_URL, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.w) }).then(function (r) {
      inflight = false;
      if (r.ok) {
        queue.shift(); saveQueue(); retryDelay = 3000;
        setStatus({ writeError: "", lastSync: Date.now(), state: status.state === "offline" ? "online" : status.state }); // ghi thành công = máy chủ đang liên lạc được
        flush();
      } else if (r.status === 400) {
        console.error("RTDB từ chối một thay đổi (400) — bỏ qua:", item.w);
        queue.shift(); saveQueue();
        setStatus({ writeError: "Máy chủ từ chối một thay đổi (dữ liệu không hợp lệ)." });
        flush();
      } else {
        setStatus({ writeError: (r.status === 401 || r.status === 403)
          ? "Máy chủ từ chối ghi dữ liệu (kiểm tra Rules của Realtime Database). Thay đổi được giữ trên máy và sẽ gửi lại."
          : "Lỗi máy chủ " + r.status + " — sẽ thử lại." });
        scheduleRetry();
      }
    }).catch(function () {
      inflight = false;
      if (!navigator.onLine) setStatus({ state: "offline" });
      scheduleRetry();
    });
  }
  function enqueue(w) {
    var last = queue[queue.length - 1];
    if (last && !(inflight && queue.length === 1)) Object.assign(last.w, w); // gộp các ghi liên tiếp (mục đang gửi thì không gộp)
    else queue.push({ w: w });
    saveQueue();
    flush();
  }

  /* ---------- Áp dụng thay đổi từ máy chủ ---------- */
  var dirty = {};
  function decodeDoc(v) {
    if (!v || typeof v.d !== "string") return null;
    try { return JSON.parse(v.d); } catch (e) { return null; }
  }
  function applyDoc(col, id, v) {
    var p = pathOf(col, id);
    if (isPending(p)) return; // đang có thay đổi cục bộ chưa gửi xong → giữ bản cục bộ
    var obj = decodeDoc(v);
    var colData = data[col] = data[col] || {};
    if (obj == null) {
      if (colData[id] !== undefined) { delete colData[id]; delete raws[p]; dirty[col] = 1; }
      return;
    }
    if (colData[id] !== undefined && raws[p] === v.d) return;
    colData[id] = obj; raws[p] = v.d; dirty[col] = 1;
  }
  function applyCol(col, v) {
    var seen = {};
    if (v && typeof v === "object") Object.keys(v).forEach(function (k) { var id = decKey(k); seen[id] = 1; applyDoc(col, id, v[k]); });
    Object.keys(data[col] || {}).forEach(function (id) {
      if (!seen[id] && !isPending(pathOf(col, id))) { delete data[col][id]; delete raws[pathOf(col, id)]; dirty[col] = 1; }
    });
  }
  function applyAll(v) {
    var cols = {};
    Object.keys(data).forEach(function (c) { cols[c] = 1; });
    if (v && typeof v === "object") Object.keys(v).forEach(function (k) { cols[decKey(k)] = 1; });
    Object.keys(cols).forEach(function (c) { applyCol(c, v && typeof v === "object" ? v[encKey(c)] : null); });
  }
  function handle(path, value, isPatch) {
    if (isPatch) {
      if (value && typeof value === "object") {
        Object.keys(value).forEach(function (k) { handle(path.replace(/\/$/, "") + "/" + k, value[k], false); });
      }
      return;
    }
    var segs = path.split("/").filter(Boolean).map(decKey);
    if (segs.length === 0) applyAll(value);
    else if (segs.length === 1) applyCol(segs[0], value);
    else if (segs.length === 2) applyDoc(segs[0], segs[1], value);
    else { // ai đó sửa sâu bên trong một tài liệu (vd. từ Firebase Console) → đọc lại cả tài liệu
      fetch(BASE + "/" + ROOT + "/" + pathOf(segs[0], segs[1]) + ".json").then(function (r) { return r.json(); })
        .then(function (v) { applyDoc(segs[0], segs[1], v); flushDirty(); }).catch(function () {});
    }
  }
  function flushDirty() {
    var cols = Object.keys(dirty); dirty = {};
    if (!cols.length) return;
    if (ready) setStatus({ lastRemote: Date.now() }); // có thay đổi THẬT từ thiết bị khác (bản ghi của chính mình đã bị bỏ qua ở applyDoc)
    saveCacheSoon();
    cols.forEach(notify);
  }

  /* ---------- Luồng SSE ---------- */
  var es = null, reconnectTimer = null;
  function scheduleReconnect(ms) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () { reconnectTimer = null; connect(); }, ms);
  }
  function onMsg(ev, isPatch) {
    var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    handle(m.path || "/", m.data, isPatch);
    flushDirty();
    if (!isPatch) { setStatus({ state: "online", readError: "", lastSync: Date.now() }); markReady(); }
  }
  function onDenied() {
    setStatus({ state: "error", readError: "Máy chủ từ chối đọc dữ liệu (kiểm tra Rules của Realtime Database)." });
    if (es) { try { es.close(); } catch (e) {} es = null; }
    scheduleReconnect(15000);
  }
  function connect() {
    if (es) { try { es.close(); } catch (e) {} es = null; }
    if (typeof EventSource === "undefined") { setStatus({ state: "error", readError: "Trình duyệt không hỗ trợ đồng bộ thời gian thực." }); return; }
    es = new EventSource(ROOT_URL);
    es.addEventListener("open", function () { setStatus({ state: "online", readError: "" }); });
    es.addEventListener("put", function (ev) { onMsg(ev, false); });
    es.addEventListener("patch", function (ev) { onMsg(ev, true); });
    es.addEventListener("cancel", onDenied);
    es.addEventListener("auth_revoked", onDenied);
    es.onerror = function () {
      if (es && es.readyState === 2) { // CLOSED: lỗi HTTP, trình duyệt không tự nối lại
        setStatus({ state: navigator.onLine ? "error" : "offline", readError: navigator.onLine ? "Không đọc được dữ liệu từ máy chủ (kiểm tra URL / Rules của Realtime Database)." : "" });
        es = null;
        scheduleReconnect(10000);
      } else {
        setStatus({ state: "offline" });
      }
    };
  }
  window.addEventListener("online", function () { retryDelay = 3000; flush(); if (!es || es.readyState === 2) connect(); else if (es.readyState === 1) setStatus({ state: "online" }); });
  window.addEventListener("offline", function () { setStatus({ state: "offline" }); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !es) connect(); });
  // Đã từng đồng bộ trước đó → sau 8 giây chưa kết nối được vẫn cho dùng bản lưu trên máy (không gieo dữ liệu mẫu vì các bộ sưu tập không trống).
  setTimeout(function () { if (!ready && hadCache) markReady(); }, 8000);
  connect();
  flush();
  // Nút "Đồng bộ" ở thanh trên: nối lại luồng đọc và gửi ngay hàng đợi ghi (không tải lại toàn bộ dữ liệu bằng tay)
  window.__rtdbResync = function () { retryDelay = 3000; if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } flush(); connect(); };

  /* ---------- API tương thích Firestore ---------- */
  function sanitize(d) {
    var out = {};
    Object.keys(d || {}).forEach(function (k) {
      var v = d[k];
      if (v === undefined) return;
      out[k] = (v && typeof v === "object" && typeof v.isEqual === "function" && !(v instanceof Date)) ? new Date().toISOString() : v;
    });
    return out;
  }
  function genId() { return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9); }

  function commitOps(ops) {
    var w = {}, touched = {};
    ops.forEach(function (op) {
      var col = op.col, id = op.id, p = pathOf(col, id);
      var colData = data[col] = data[col] || {};
      if (op.type === "delete") { delete colData[id]; delete raws[p]; w[p] = null; }
      else {
        var clean = sanitize(op.data);
        var next = (op.type === "update" || op.merge) ? Object.assign({}, colData[id] || {}, clean) : clean;
        var json = JSON.stringify(next);
        colData[id] = JSON.parse(json); raws[p] = json;
        w[p] = { d: json, t: Date.now() };
      }
      touched[col] = 1;
    });
    saveCacheSoon();
    Object.keys(touched).forEach(notify);
    enqueue(w);
  }

  function makeSnapshot(docsObj, opts) {
    var entries = Object.keys(docsObj).map(function (id) { return { id: id, data: docsObj[id] }; });
    if (opts && opts.orderBy) {
      var field = opts.orderBy[0], dir = opts.orderBy[1];
      entries.sort(function (a, b) {
        var av = a.data[field], bv = b.data[field];
        if (av == null && bv == null) return 0;
        if (av == null) return dir === "desc" ? 1 : -1;
        if (bv == null) return dir === "desc" ? -1 : 1;
        if (av > bv) return dir === "desc" ? -1 : 1;
        if (av < bv) return dir === "desc" ? 1 : -1;
        return 0;
      });
    }
    if (opts && opts.limit) entries = entries.slice(0, opts.limit);
    return {
      docs: entries.map(function (e) {
        return { id: e.id, data: function () { return Object.assign({}, e.data); }, exists: true };
      })
    };
  }

  function docRef(col, id) {
    return {
      id: id,
      col: col,
      set: function (d, options) { commitOps([{ type: "set", col: col, id: id, data: d, merge: !!(options && options.merge) }]); return Promise.resolve(); },
      update: function (d) { commitOps([{ type: "update", col: col, id: id, data: d }]); return Promise.resolve(); },
      "delete": function () { commitOps([{ type: "delete", col: col, id: id }]); return Promise.resolve(); },
      get: function () {
        return new Promise(function (res) {
          whenReady(function () {
            var d = data[col] && data[col][id];
            res({ exists: function () { return d !== undefined; }, data: function () { return Object.assign({}, d || {}); }, id: id });
          });
        });
      }
    };
  }

  function queryable(col, opts) {
    return {
      orderBy: function (field, dir) { return queryable(col, Object.assign({}, opts, { orderBy: [field, dir] })); },
      limit: function (n) { return queryable(col, Object.assign({}, opts, { limit: n })); },
      get: function () { return new Promise(function (res) { whenReady(function () { res(makeSnapshot(data[col] || {}, opts)); }); }); },
      onSnapshot: function (onNext, onError) {
        var active = true;
        var push = function () {
          if (!active) return;
          try { onNext(makeSnapshot(data[col] || {}, opts)); } catch (e) { if (onError) onError(e); }
        };
        whenReady(push);
        var unsub = subscribe(col, push);
        return function () { active = false; unsub(); };
      }
    };
  }

  function collectionRef(col) {
    var base = queryable(col, {});
    base.doc = function (id) { return docRef(col, id || genId()); };
    base.add = function (d) {
      var id = genId();
      return docRef(col, id).set(d, {}).then(function () { return { id: id }; });
    };
    return base;
  }

  /* ---------- Ghi CÓ ĐIỀU KIỆN trên MỘT tài liệu (v52) ----------
     Dùng ETag của Realtime Database REST: đọc tài liệu + ETag mới nhất từ MÁY CHỦ (không tin bản trên màn hình), chạy mutator,
     rồi PUT kèm "if-match". Nếu có người ghi xen vào, máy chủ trả 412 → đọc lại và chạy lại mutator (tối đa tries lần).
     Nhờ đó hai thiết bị cùng hoàn thành/mở lại một đơn không thể cùng thắng. mutator(cur) được phép bất đồng bộ, được phép ném lỗi
     để hủy; trả null/undefined = không ghi gì. Cần có mạng (ném lỗi rõ ràng nếu mất kết nối). */
  function waitFlushed(ms) {
    return new Promise(function (res, rej) {
      var t0 = Date.now();
      (function poll() {
        if (!queue.length && !inflight) return res();
        if (Date.now() - t0 > ms) return rej(new Error("Mạng chậm hoặc mất kết nối — các thay đổi trước đó chưa gửi xong. Hãy thử lại khi có mạng."));
        setTimeout(poll, 40);
      })();
    });
  }
  async function casDoc(col, id, mutator, opts) {
    opts = opts || {};
    var path = pathOf(col, id), url = BASE + "/" + ROOT + "/" + path + ".json";
    await waitFlushed(opts.flushMs || 8000);
    var tries = opts.tries || 5;
    for (var n = 0; n < tries; n++) {
      var r;
      try { r = await fetch(url, { headers: { "X-Firebase-ETag": "true" } }); }
      catch (e) { throw new Error("Cần kết nối mạng để thực hiện thao tác này (không đọc được dữ liệu mới nhất từ máy chủ)."); }
      if (!r.ok) throw new Error("Máy chủ từ chối đọc dữ liệu (" + r.status + ")");
      var etag = r.headers && typeof r.headers.get === "function" ? r.headers.get("ETag") : null;
      if (!etag) { var ne = new Error("Máy chủ không trả về mã phiên bản (ETag) nên không thể ghi có điều kiện."); ne.code = "no-etag"; throw ne; } // trình duyệt chỉ đọc được ETag nếu máy chủ công khai qua CORS; nơi gọi sẽ tự lùi về đường giao dịch cũ
      var cur = decodeDoc(await r.json());
      var next = await mutator(cur);
      if (next === undefined || next === null) return { committed: false, doc: cur, retries: n };
      var json = JSON.stringify(sanitize(next));
      var w;
      try { w = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify({ d: json, t: Date.now() }) }); }
      catch (e) { throw new Error("Mất kết nối khi đang ghi — chưa có thay đổi nào được lưu. Hãy kiểm tra lại trạng thái đơn rồi thử lại."); }
      if (w.status === 412) continue;
      if (!w.ok) throw new Error("Máy chủ từ chối ghi (" + w.status + ")");
      var colData = data[col] = data[col] || {};
      colData[id] = JSON.parse(json); raws[path] = json;
      saveCacheSoon(); notify(col);
      setStatus({ writeError: "", lastSync: Date.now() });
      return { committed: true, doc: colData[id], retries: n };
    }
    throw new Error("Dữ liệu vừa bị người khác thay đổi liên tục — hãy tải lại trang rồi thử lại.");
  }

  window.__isOfflineDb = true; // = "tài khoản cục bộ, không Firebase Auth" (tên giữ nguyên để tương thích)
  window.__isRtdb = true;
  window.__db = {
    collection: function (col) { return collectionRef(col); },
    batch: function () {
      var ops = [];
      return {
        set: function (ref, d, options) { ops.push({ type: "set", col: ref.col, id: ref.id, data: d, merge: !!(options && options.merge) }); },
        update: function (ref, d) { ops.push({ type: "update", col: ref.col, id: ref.id, data: d }); },
        "delete": function (ref) { ops.push({ type: "delete", col: ref.col, id: ref.id }); },
        commit: function () { if (ops.length) commitOps(ops); return Promise.resolve(); }
      };
    },
    casDoc: casDoc,
    settings: function () {}
  };
})();

const db = window.__db || null,
  auth = window.__auth || null;
const FS = {
  orders: "orders",
  staff: "staff",
  machines: "machines",
  scrap: "scrap",
  audit: "auditLog",
  attendance: "attendance",
  users: "users",
  certificates: "certificates"
};
const serverTimestamp = () => window.firebase ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
const writeBatch = () => window.__db ? window.__db.batch() : {
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: () => Promise.resolve()
};
const setDoc = async (r, d, o) => r && (o?.merge ? r.set(d, {
  merge: true
}) : r.set(d));
const updateDoc = async (r, d) => r && r.update(d);
const deleteDoc = async r => r && r.delete();
const addDoc = async (c, d) => c && c.add(d);
const getDoc = async r => {
  if (!r) return {
    exists: () => false,
    data: () => ({}),
    id: ''
  };
  const s = await r.get();
  return {
    exists: () => s.exists,
    data: () => s.data(),
    id: s.id
  };
};
const collection = (_, col) => window.__db ? window.__db.collection(col) : null;
const doc = (_, col, id) => window.__db ? id ? window.__db.collection(col).doc(id) : window.__db.collection(col).doc() : null;
const query = (ref, ...cs) => {
  if (!ref) return null;
  let q = ref;
  cs.forEach(c => {
    if (c && q) q = c(q);
  });
  return q;
};
// Đăng ký theo dõi dữ liệu nhưng BỎ QUA lần báo lặp không có tài liệu nào đổi (chỉ đổi metadata) → không vẽ lại cả ứng dụng vô ích.
// Lần đầu luôn được chuyển tiếp (kể cả bộ sưu tập rỗng). Bản offline (localStorage) không có docChanges nên luôn chuyển tiếp.
// Giảm số lượt ĐỌC Firestore (gói miễn phí giới hạn 50.000 lượt đọc/ngày): nhật ký và lượt ghi sản lượng chỉ tải
// AMG_READ_WINDOW_DAYS ngày gần nhất. Dữ liệu cũ KHÔNG bị xóa — vẫn nằm trên Firestore và trong tệp sao lưu; sản lượng
// cộng dồn của từng đơn nằm ngay trên đơn (order.stages) nên không phụ thuộc cửa sổ này.
const AMG_READ_WINDOW_DAYS = 120;
function amgWindowStart() { return new Date(Date.now() - AMG_READ_WINDOW_DAYS * 86400000); }
function amgIsQuotaError(e) {
  const t = String((e && (e.code || "")) + " " + (e && e.message || e));
  return /resource-exhausted|quota/i.test(t);
}
const AMG_QUOTA_MSG = "Máy chủ dữ liệu (Firebase Realtime Database) đang báo vượt hạn mức sử dụng. Thay đổi được giữ trên máy và sẽ tự gửi lại; kiểm tra hạn mức của dự án trong Firebase Console nếu tình trạng kéo dài.";
function amgSnapDedup(q, cb, eb) {
  let first = true;
  return q.onSnapshot(s => {
    if (!first) { try { if (typeof s.docChanges === "function" && s.docChanges().length === 0) return; } catch (e) {} }
    first = false;
    cb(s);
  }, eb);
}
const orderBy = (f, d = 'asc') => q => q ? q.orderBy(f, d) : null;
const limit = n => q => q ? q.limit(n) : null;
const onSnapshot = (ref, cb, eb) => {
  if (!ref) {
    if (eb) eb(new Error('no db'));
    return () => {};
  }
  return ref.onSnapshot(s => cb(s), eb || (() => {}));
};
const signInWithEmailAndPassword = (a, e, p) => a ? a.signInWithEmailAndPassword(e, p) : Promise.reject(new Error('Firebase chưa cấu hình'));
const signOut = a => a ? a.signOut() : Promise.resolve();
const createUserWithEmailAndPassword = (a, e, p) => a ? a.createUserWithEmailAndPassword(e, p) : Promise.reject(new Error('no auth'));
const onAuthStateChanged = (a, cb) => a ? a.onAuthStateChanged(cb) : () => {};
