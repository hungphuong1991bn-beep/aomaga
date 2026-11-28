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
  var FAILED_KEY = "amg_mes_rtdb_failed_v1";      // v59: thao tác máy chủ từ chối (400) — KHÔNG bỏ mất, giữ để xem/gửi lại
  var CONFLICT_KEY = "amg_mes_rtdb_conflicts_v1"; // v59: trường bị hai người cùng sửa khác nhau — giữ giá trị của người sửa sau để đối chiếu
  var DEVICE_KEY = "amg_mes_device_v1";
  // Trường "dấu vết" (không phải dữ liệu nghiệp vụ): hai người cùng ghi thì lấy lần ghi sau, KHÔNG coi là xung đột.
  var SOFT_FIELDS = { updatedAt: 1, updatedBy: 1, version: 1, lastEditedBy: 1 };
  var NO_CACHE = { certificates: true }; // ảnh/PDF chứng chỉ quá nặng cho localStorage
  var ROOT_URL = BASE + "/" + ROOT + ".json";

  /* ---------- Trạng thái kết nối + thanh thông báo ---------- */
  var status = { state: "connecting", pending: 0, lastSync: 0, lastRemote: 0, readError: "", writeError: "", conflicts: 0, failed: 0, sent: 0, device: "" };
  var statusSubs = [];
  var ready = false, readyCbs = [];
  var serverConfirmed = false, serverCbs = []; // true sau khi đã nhận bản đầy đủ TỪ MÁY CHỦ (không phải chỉ bản lưu trên máy)
  var bannerEl = null;
  function updateBanner() {
    try {
      var msg = "";
      if (!ready && status.state !== "error") msg = "Đang kết nối máy chủ dữ liệu… (lần đầu cần có mạng)";
      else if (status.readError) msg = status.readError;
      else if (status.writeError) msg = status.writeError;
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

  /* ---------- Thiết bị + định danh thao tác (v59) ---------- */
  function newId(prefix) { return prefix + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
  function hasOwn(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  var DEV = (function () {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!id) { id = newId("dev_"); try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {} }
    var ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    var label = /Electron/i.test(ua) ? "Windows (EXE)" : (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()) ? "Android (APK)" : "Web";
    return { id: id, label: label };
  })();
  status.device = DEV.id;
  function curUser() { try { var u = window.__AMG_USER; return u ? (u.username || u.fullName || "") : ""; } catch (e) { return ""; } }

  /* ---------- Hàng đợi ghi (bền vững qua đóng/mở ứng dụng) ----------
     Mỗi mục có: id (duy nhất), ts (lúc tạo), user, dev (thiết bị), kind:
       "patch" — ghi nguyên tài liệu theo đường dẫn (set/delete/add): gửi một PATCH nhiều đường dẫn (nguyên tử). Gửi lại nhiều lần cho cùng kết quả (idempotent).
       "merge" — chỉ các TRƯỜNG đã đổi (ops[].fields) kèm giá trị gốc lúc sửa (ops[].base): lúc gửi đọc bản mới nhất từ máy chủ rồi ghép theo từng trường (so sánh 3 chiều);
                 trường bị người khác sửa khác đi → ghi nhận xung đột, KHÔNG ghi đè. Mục định dạng cũ ({w}) được nhận tiếp như "patch". */
  function loadList(key) { var v = loadJson(key, []); return Array.isArray(v) ? v : []; }
  var queue = loadList(QUEUE_KEY).map(function (it) {
    if (!it || typeof it !== "object") return null;
    if (!it.kind) it.kind = it.ops ? "merge" : "patch";
    if (it.kind === "patch" && (!it.w || typeof it.w !== "object")) return null;
    if (it.kind === "merge" && !Array.isArray(it.ops)) return null;
    if (!it.id) it.id = newId("q_");
    if (!it.ts) it.ts = Date.now();
    if (!it.dev) it.dev = DEV.id;
    if (it.user === undefined) it.user = "";
    return it;
  }).filter(Boolean);
  var failedOps = loadList(FAILED_KEY);
  var conflicts = loadList(CONFLICT_KEY);
  var inflight = false, retryTimer = null, retryDelay = 3000;
  status.pending = queue.length; status.failed = failedOps.length; status.conflicts = conflicts.length;
  var pendingCache = null;
  function pendingSet() {
    if (pendingCache) return pendingCache;
    pendingCache = {};
    queue.forEach(function (it) {
      if (it.kind === "merge") it.ops.forEach(function (o) { pendingCache[pathOf(o.col, o.id)] = 1; });
      else Object.keys(it.w || {}).forEach(function (k) { pendingCache[k] = 1; });
    });
    return pendingCache;
  }
  function saveList(key, list) { try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { console.warn("Không thể lưu " + key + ":", e.message); } }
  function saveQueue() {
    pendingCache = null;
    saveList(QUEUE_KEY, queue);
    setStatus({ pending: queue.length });
  }
  function saveFailed() { saveList(FAILED_KEY, failedOps); setStatus({ failed: failedOps.length }); }
  function saveConflicts() { saveList(CONFLICT_KEY, conflicts); setStatus({ conflicts: conflicts.length }); }
  function isPending(p) { return pendingSet()[p] === 1; }
  function scheduleRetry() {
    if (retryTimer) return;
    var d = Math.round(retryDelay * (0.8 + Math.random() * 0.4)); // thêm độ lệch ngẫu nhiên để nhiều thiết bị không cùng gửi một lúc
    retryTimer = setTimeout(function () { retryTimer = null; flush(); }, d);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }
  function moveToFailed(item, reason) {
    failedOps.push({ id: item.id, ts: item.ts, user: item.user, dev: item.dev, kind: item.kind, w: item.w, ops: item.ops, reason: reason, failedAt: Date.now() });
    saveFailed();
    console.error("RTDB từ chối một thay đổi — đã giữ lại để xem/gửi lại:", reason, item);
    setStatus({ writeError: "" });
  }
  function itemPathsDesc(it) {
    return it.kind === "merge" ? it.ops.map(function (o) { return o.col + "/" + o.id; }).join(", ") : Object.keys(it.w || {}).join(", ");
  }
  function retryErr(msg, denied) { var e = new Error(msg); e.retry = true; e.denied = !!denied; return e; }

  /* Gửi MỘT thao tác "merge" cho một tài liệu: đọc bản mới nhất + ETag, ghép từng trường, ghi có điều kiện (if-match). */
  async function applyMergeOp(item, op) {
    var path = pathOf(op.col, op.id), url = BASE + "/" + ROOT + "/" + path + ".json";
    for (var n = 0; n < 6; n++) {
      var r;
      try { r = await fetch(url, { headers: { "X-Firebase-ETag": "true" } }); } catch (e) { throw retryErr("net"); }
      if (r.status === 401 || r.status === 403) throw retryErr("denied", true);
      if (!r.ok) throw retryErr("srv" + r.status);
      var etag = r.headers && typeof r.headers.get === "function" ? r.headers.get("ETag") : null;
      var rawDoc = await r.json();
      var cur = decodeDoc(rawDoc);
      var next = cur ? Object.assign({}, cur) : {};
      var found = [], applied = 0;
      if (!cur && op.existed) { // tài liệu đã bị người khác xóa → không "hồi sinh" bản chỉ có vài trường
        Object.keys(op.fields).forEach(function (k) { found.push({ field: k, mine: op.fields[k], theirs: "(bản ghi đã bị xóa)", base: op.base ? op.base[k] : undefined }); });
      } else {
        Object.keys(op.fields).forEach(function (k) {
          var mine = op.fields[k], curVal = cur && hasOwn(cur, k) ? cur[k] : undefined, bs = op.base ? op.base[k] : undefined;
          if (same(curVal, mine)) return;                                  // máy chủ đã có đúng giá trị này
          if (SOFT_FIELDS[k] || !cur || same(curVal, bs)) { next[k] = mine; applied++; return; } // máy chủ chưa đổi so với lúc sửa → áp dụng
          found.push({ field: k, mine: mine, theirs: curVal, base: bs });  // người khác đã sửa trường này khác đi → xung đột
        });
      }
      if (applied > 0) {
        var json = JSON.stringify(sanitize(next));
        var headers = { "Content-Type": "application/json" };
        if (etag) headers["if-match"] = etag;
        var w;
        try { w = await fetch(url, { method: "PUT", headers: headers, body: JSON.stringify({ d: json, t: Date.now(), v: ((rawDoc && rawDoc.v) || 0) + 1, by: item.user || "", dev: item.dev || DEV.id }) }); }
        catch (e) { throw retryErr("net"); }
        if (w.status === 412) continue;                                   // có người ghi xen vào → đọc lại và ghép lại
        if (w.status === 400) return { failed: "Máy chủ từ chối (400)", found: found };
        if (w.status === 401 || w.status === 403) throw retryErr("denied", true);
        if (!w.ok) throw retryErr("srv" + w.status);
        setLocalDoc(op.col, op.id, JSON.parse(json), json);
      } else if (cur) {
        setLocalDoc(op.col, op.id, cur, rawDoc.d);                        // không có gì để ghi: màn hình theo đúng bản trên máy chủ
      }
      return { found: found };
    }
    throw retryErr("busy");
  }
  function setLocalDoc(col, id, obj, json) {
    var colData = data[col] = data[col] || {};
    colData[id] = obj; raws[pathOf(col, id)] = json;
    overlayPending(col, id);
    dirty[col] = 1; flushDirty();
  }
  // Sau khi lấy bản máy chủ, phủ lại các thay đổi cục bộ còn đang chờ gửi (nếu có) để màn hình không "nhảy lùi".
  function overlayPending(col, id) {
    var p = pathOf(col, id), colData = data[col];
    for (var i = 1; i < queue.length; i++) {
      var it = queue[i];
      if (it.kind === "merge") it.ops.forEach(function (o) { if (o.col === col && o.id === id && colData[id]) Object.assign(colData[id], o.fields); });
      else if (hasOwn(it.w, p)) { var d = decodeDoc(it.w[p]); if (d) colData[id] = d; else delete colData[id]; }
    }
  }
  function recordConflicts(item, op, found) {
    if (!found.length) return;
    found.forEach(function (c) {
      conflicts.push({ id: newId("cf_"), col: op.col, docId: op.id, field: c.field, mine: c.mine, theirs: c.theirs, base: c.base, ts: Date.now(), user: item.user, dev: item.dev, opTs: item.ts });
    });
    saveConflicts();
    // nhật ký (append-only) — mỗi xung đột một dòng, mã cố định theo thao tác nên gửi lại không tạo dòng trùng
    var w = {};
    found.forEach(function (c) {
      var aid = "SYNC-CF-" + item.id + "-" + op.col + "-" + op.id + "-" + c.field;
      var entry = { id: aid, type: "sync_conflict", ts: new Date().toISOString(), user: item.user || "", targetId: op.id,
        detail: "Xung đột đồng bộ " + op.col + "/" + op.id + " — trường \"" + c.field + "\": giá trị của " + (item.user || "người dùng") + " (" + JSON.stringify(c.mine) + ") khác giá trị đã có trên máy chủ (" + JSON.stringify(c.theirs) + "). Máy chủ giữ nguyên, chờ đối chiếu." };
      w[pathOf("auditLog", aid)] = { d: JSON.stringify(entry), t: Date.now() };
    });
    queue.splice(1, 0, { id: newId("q_"), ts: Date.now(), user: item.user, dev: item.dev, kind: "patch", w: w });
  }
  async function sendItem(item) {
    if (item.kind === "merge") {
      while (item.ops.length) {
        var op = item.ops[0];
        var res = await applyMergeOp(item, op);
        if (res.failed) {
          failedOps.push({ id: newId("fl_"), ts: item.ts, user: item.user, dev: item.dev, kind: "merge", ops: [op], reason: res.failed, failedAt: Date.now() });
          saveFailed();
        }
        item.ops.shift();
        recordConflicts(item, op, res.found || []);
        saveQueue();
      }
      return;
    }
    var r;
    try { r = await fetch(ROOT_URL, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.w) }); } catch (e) { throw retryErr("net"); }
    if (r.ok) return;
    if (r.status === 400) { moveToFailed(item, "Máy chủ từ chối (400)"); return; }
    throw retryErr(r.status === 401 || r.status === 403 ? "denied" : "srv" + r.status, r.status === 401 || r.status === 403);
  }
  function flush() {
    if (inflight || !queue.length) return;
    inflight = true;
    var item = queue[0];
    sendItem(item).then(function () {
      inflight = false;
      var i = queue.indexOf(item); if (i >= 0) queue.splice(i, 1);
      saveQueue(); retryDelay = 3000;
      setStatus({ writeError: "", sent: status.sent + 1, lastSync: Date.now(), state: status.state === "offline" ? "online" : status.state }); // ghi thành công = máy chủ đang liên lạc được
      flush();
    }).catch(function (e) {
      inflight = false;
      if (e && e.retry) {
        if (e.denied) setStatus({ writeError: "Máy chủ từ chối ghi dữ liệu (kiểm tra Rules của Realtime Database). Thay đổi được giữ trên máy và sẽ gửi lại." });
        else if (!navigator.onLine) setStatus({ state: "offline" });
        else if (/^srv/.test(e.message)) setStatus({ writeError: "Lỗi máy chủ " + e.message.slice(3) + " — sẽ thử lại." });
      } else { console.error("Lỗi gửi hàng đợi:", e); setStatus({ writeError: "Lỗi đồng bộ không xác định — thay đổi được giữ trên máy và sẽ thử lại." }); }
      scheduleRetry();
    });
  }
  function newItem(kind, extra) { return Object.assign({ id: newId("q_"), ts: Date.now(), user: curUser(), dev: DEV.id, kind: kind }, extra); }
  function canCoalesce(last) { return last && !(inflight && queue.length === 1) && last.dev === DEV.id && last.user === curUser(); }
  function enqueuePatch(w) {
    var last = queue[queue.length - 1];
    if (canCoalesce(last) && last.kind === "patch") Object.assign(last.w, w); // gộp các ghi liên tiếp (mục đang gửi thì không gộp)
    else queue.push(newItem("patch", { w: w }));
    saveQueue();
    flush();
  }
  function enqueueMerge(ops) {
    var last = queue[queue.length - 1];
    if (canCoalesce(last) && last.kind === "merge") {
      ops.forEach(function (o) {
        var prev = last.ops.length ? last.ops[last.ops.length - 1] : null;
        if (prev && prev.col === o.col && prev.id === o.id) { // cùng tài liệu, liền nhau: giữ giá trị gốc đầu tiên, giá trị mới cuối cùng
          Object.keys(o.base).forEach(function (k) { if (!hasOwn(prev.base, k) && !hasOwn(prev.fields, k)) prev.base[k] = o.base[k]; });
          Object.assign(prev.fields, o.fields);
        } else last.ops.push(o);
      });
    } else queue.push(newItem("merge", { ops: ops }));
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
    if (!isPatch) {
      setStatus({ state: "online", readError: "", lastSync: Date.now() }); markReady();
      if (!serverConfirmed) { serverConfirmed = true; var sc = serverCbs; serverCbs = []; sc.forEach(function (f) { try { f(true); } catch (e) {} }); }
    }
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
  window.addEventListener("online", function () { retryDelay = 3000; if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } flush(); connect(); }); // nối lại để nhận bản đầy đủ mới nhất (không bỏ sót thay đổi trong lúc mất mạng)
  window.addEventListener("offline", function () { setStatus({ state: "offline" }); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !es) connect(); });
  // Đã từng đồng bộ trước đó → sau 8 giây chưa kết nối được vẫn cho dùng bản lưu trên máy (không gieo dữ liệu mẫu vì các bộ sưu tập không trống).
  setTimeout(function () { if (!ready && hadCache) markReady(); }, 8000);
  connect();
  flush();
  // Nút "Đồng bộ" ở thanh trên: nối lại luồng đọc và gửi ngay hàng đợi ghi (không tải lại toàn bộ dữ liệu bằng tay)
  window.__rtdbServerConfirmed = function () { return serverConfirmed; };
  window.__rtdbHasCache = function () { return hadCache; };
  window.__rtdbWaitServer = function (ms) { return new Promise(function (res) { if (serverConfirmed) return res(true); serverCbs.push(res); setTimeout(function () { res(serverConfirmed); }, ms || 10000); }); };
  window.__rtdbDevice = function () { return { id: DEV.id, label: DEV.label }; };
  window.__rtdbQueueInfo = function () { return { pending: queue.length, failed: failedOps.length, conflicts: conflicts.length, sent: status.sent, items: queue.map(function (it) { return { id: it.id, ts: it.ts, user: it.user, dev: it.dev, kind: it.kind, targets: itemPathsDesc(it) }; }) }; };
  window.__rtdbConflicts = function () { return conflicts.map(function (c) { return Object.assign({}, c); }); };
  window.__rtdbFailed = function () { return failedOps.map(function (f) { return { id: f.id, ts: f.ts, user: f.user, dev: f.dev, kind: f.kind, reason: f.reason, targets: itemPathsDesc(f) }; }); };
  // Xử lý xung đột: "theirs" = giữ giá trị trên máy chủ (bỏ giá trị của mình); "mine" = ghi giá trị của mình (chỉ thành công nếu máy chủ chưa đổi tiếp)
  window.__rtdbResolveConflict = function (id, choice) {
    var i = conflicts.findIndex(function (c) { return c.id === id; }); if (i < 0) return false;
    var c = conflicts[i];
    if (choice === "mine") {
      var f = {}; f[c.field] = c.mine; var b = {}; if (c.theirs !== undefined && c.theirs !== "(bản ghi đã bị xóa)") b[c.field] = c.theirs;
      var colData = data[c.col] = data[c.col] || {};
      if (colData[c.docId]) { colData[c.docId][c.field] = c.mine; saveCacheSoon(); notify(c.col); }
      enqueueMerge([{ col: c.col, id: c.docId, fields: f, base: b, existed: true }]);
    }
    conflicts.splice(i, 1); saveConflicts();
    return true;
  };
  window.__rtdbRetryFailed = function (id) {
    var i = failedOps.findIndex(function (f) { return f.id === id; }); if (i < 0) return false;
    var f = failedOps.splice(i, 1)[0]; saveFailed();
    var it = newItem(f.kind, f.kind === "merge" ? { ops: f.ops } : { w: f.w }); it.ts = f.ts || it.ts; it.user = f.user || it.user; it.dev = f.dev || it.dev;
    queue.push(it); saveQueue(); flush(); return true;
  };
  window.__rtdbDiscardFailed = function (id) {
    var i = failedOps.findIndex(function (f) { return f.id === id; }); if (i < 0) return false;
    failedOps.splice(i, 1); saveFailed(); return true;
  };
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
    var touched = {}, groups = [];
    function group(kind) {
      var g = groups[groups.length - 1];
      if (!g || g.kind !== kind) { g = { kind: kind, w: {}, ops: [] }; groups.push(g); }
      return g;
    }
    ops.forEach(function (op) {
      var col = op.col, id = op.id, p = pathOf(col, id);
      var colData = data[col] = data[col] || {};
      if (op.type === "delete") { delete colData[id]; delete raws[p]; group("patch").w[p] = null; touched[col] = 1; return; }
      var clean = sanitize(op.data);
      var existed = colData[id] !== undefined, local = colData[id] || {};
      if (op.type === "update" || op.merge) {
        // v59: chỉ gửi những trường THỰC SỰ đổi so với bản đang hiển thị; mỗi trường mang theo giá trị gốc để so 3 chiều khi gửi.
        var fields = {}, base = {}, hard = 0, any = 0;
        Object.keys(clean).forEach(function (k) {
          var nv = clean[k];
          if (existed && hasOwn(local, k) && same(local[k], nv)) return;
          fields[k] = nv; any++;
          if (existed && hasOwn(local, k)) base[k] = local[k];
          if (!SOFT_FIELDS[k]) hard++;
        });
        if (existed && (!any || !hard)) return; // không đổi gì có ý nghĩa → không ghi, không phát tín hiệu cho thiết bị khác
        var next = Object.assign({}, local, clean), json = JSON.stringify(next);
        colData[id] = JSON.parse(json); raws[p] = json;
        group("merge").ops.push({ col: col, id: id, fields: fields, base: base, existed: existed });
      } else {
        var json2 = JSON.stringify(clean);
        colData[id] = JSON.parse(json2); raws[p] = json2;
        group("patch").w[p] = { d: json2, t: Date.now() };
      }
      touched[col] = 1;
    });
    saveCacheSoon();
    Object.keys(touched).forEach(notify);
    groups.forEach(function (g) { if (g.kind === "merge") enqueueMerge(g.ops); else enqueuePatch(g.w); });
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
        if (Date.now() - t0 > ms) { var ne = new Error("Mạng chậm hoặc mất kết nối — các thay đổi trước đó chưa gửi xong. Hãy thử lại khi có mạng."); ne.code = "network"; return rej(ne); }
        setTimeout(poll, 40);
      })();
    });
  }
  async function casDoc(col, id, mutator, opts) {
    opts = opts || {};
    var path = pathOf(col, id), url = BASE + "/" + ROOT + "/" + path + ".json";
    await waitFlushed(opts.flushMs || 8000);
    var tries = opts.tries || 12; // v59: nhiều thiết bị cùng ghi một bản ghi → thử lại nhiều lần, giãn cách ngẫu nhiên để không đụng nhau mãi
    for (var n = 0; n < tries; n++) {
      var r;
      try { r = await fetch(url, { headers: { "X-Firebase-ETag": "true" } }); }
      catch (e) { var e1 = new Error("Cần kết nối mạng để thực hiện thao tác này (không đọc được dữ liệu mới nhất từ máy chủ)."); e1.code = "network"; throw e1; }
      if (!r.ok) throw new Error("Máy chủ từ chối đọc dữ liệu (" + r.status + ")");
      var etag = r.headers && typeof r.headers.get === "function" ? r.headers.get("ETag") : null;
      if (!etag) { var ne = new Error("Máy chủ không trả về mã phiên bản (ETag) nên không thể ghi có điều kiện."); ne.code = "no-etag"; throw ne; } // trình duyệt chỉ đọc được ETag nếu máy chủ công khai qua CORS; nơi gọi sẽ tự lùi về đường giao dịch cũ
      var rawCur = await r.json();
      var cur = decodeDoc(rawCur);
      var next = await mutator(cur);
      if (next === undefined || next === null) return { committed: false, doc: cur, retries: n };
      var json = JSON.stringify(sanitize(next));
      var w;
      try { w = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify({ d: json, t: Date.now(), v: ((rawCur && rawCur.v) || 0) + 1, by: curUser(), dev: DEV.id }) }); }
      catch (e) { var e2 = new Error("Mất kết nối khi đang ghi — chưa có thay đổi nào được lưu. Hãy kiểm tra lại trạng thái đơn rồi thử lại."); e2.code = "network-write"; throw e2; }
      if (w.status === 412) { await new Promise(function (r) { setTimeout(r, Math.random() * 25 * (n + 1)); }); continue; }
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
  schedule: "schedule",
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
