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
   ★  OFFLINE DATA LAYER — MiniFirestore shim (localStorage)  ★
   Khi CHƯA điền Firebase config (mặc định), window.__db là null,
   nhưng useAppData() và rất nhiều handler trong file này gọi thẳng
   db.collection(...).doc(...).set/update/onSnapshot(...) mà không
   kiểm tra null ⇒ app crash ngay khi mount (đúng lỗi "treo ở màn
   khởi động" trong ảnh chụp). Thay vì sửa từng nơi gọi db.* rải rác
   khắp file (rủi ro sót rất cao), ta giả lập một API tương thích
   Firestore (collection/doc/onSnapshot/batch...) nhưng lưu bằng
   localStorage, để MỌI đoạn code hiện có chạy đúng như thiết kế ban
   đầu, kể cả khi không kết nối Firebase (đúng như comment gốc trong
   index.html: "Bỏ trống = chạy offline với localStorage").
═══════════════════════════════════════════════════════════════ */
(function setupOfflineDb() {
  if (window.__db) return; // Đã cấu hình Firebase thật → dùng Firestore, bỏ qua shim này
  var STORAGE_KEY = "amg_mes_offline_db_v1";

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveAll(all) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) {
      console.warn("Không thể ghi localStorage:", e.message);
    }
  }
  function isFieldValueSentinel(v) {
    return v && typeof v === "object" && typeof v.isEqual === "function" && !(v instanceof Date);
  }
  function sanitize(data) {
    var out = {};
    Object.keys(data || {}).forEach(function (k) {
      var v = data[k];
      out[k] = isFieldValueSentinel(v) ? new Date().toISOString() : v;
    });
    return out;
  }
  function genId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  var listeners = {}; // { colName: Set<fn> }
  function notify(col) {
    var all = loadAll();
    var docsObj = all[col] || {};
    (listeners[col] || []).forEach(function (fn) { fn(docsObj); });
  }
  function subscribe(col, fn) {
    if (!listeners[col]) listeners[col] = [];
    listeners[col].push(fn);
    return function () {
      listeners[col] = (listeners[col] || []).filter(function (f) { return f !== fn; });
    };
  }
  // Đồng bộ giữa nhiều tab/thiết bị đang mở cùng trình duyệt (LAN dùng chung máy)
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) Object.keys(listeners).forEach(notify);
  });

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
      set: function (data, options) {
        var all = loadAll();
        all[col] = all[col] || {};
        var clean = sanitize(data);
        all[col][id] = (options && options.merge) ? Object.assign({}, all[col][id] || {}, clean) : clean;
        saveAll(all);
        notify(col);
        return Promise.resolve();
      },
      update: function (data) {
        var all = loadAll();
        all[col] = all[col] || {};
        all[col][id] = Object.assign({}, all[col][id] || {}, sanitize(data));
        saveAll(all);
        notify(col);
        return Promise.resolve();
      },
      "delete": function () {
        var all = loadAll();
        if (all[col]) delete all[col][id];
        saveAll(all);
        notify(col);
        return Promise.resolve();
      },
      get: function () {
        var all = loadAll();
        var d = all[col] && all[col][id];
        return Promise.resolve({
          exists: function () { return !!d; },
          data: function () { return Object.assign({}, d || {}); },
          id: id
        });
      }
    };
  }

  function queryable(col, opts) {
    return {
      orderBy: function (field, dir) {
        return queryable(col, Object.assign({}, opts, { orderBy: [field, dir] }));
      },
      limit: function (n) {
        return queryable(col, Object.assign({}, opts, { limit: n }));
      },
      onSnapshot: function (onNext, onError) {
        var push = function () {
          try {
            var all = loadAll();
            onNext(makeSnapshot(all[col] || {}, opts));
          } catch (e) { if (onError) onError(e); }
        };
        push();
        return subscribe(col, push);
      }
    };
  }

  function collectionRef(col) {
    var base = queryable(col, {});
    base.doc = function (id) { return docRef(col, id || genId()); };
    base.add = function (data) {
      var id = genId();
      return docRef(col, id).set(data, {}).then(function () { return { id: id }; });
    };
    return base;
  }

  window.__isOfflineDb = true;
  window.__db = {
    collection: function (col) { return collectionRef(col); },
    batch: function () {
      var ops = [];
      return {
        set: function (ref, data, options) { ops.push({ type: "set", ref: ref, data: data, options: options }); },
        update: function (ref, data) { ops.push({ type: "update", ref: ref, data: data }); },
        "delete": function (ref) { ops.push({ type: "delete", ref: ref }); },
        commit: function () {
          var touched = {};
          var all = loadAll();
          ops.forEach(function (op) {
            var col = op.ref.col, id = op.ref.id;
            all[col] = all[col] || {};
            if (op.type === "delete") {
              delete all[col][id];
            } else if (op.type === "update") {
              all[col][id] = Object.assign({}, all[col][id] || {}, sanitize(op.data));
            } else {
              var clean = sanitize(op.data);
              all[col][id] = (op.options && op.options.merge) ? Object.assign({}, all[col][id] || {}, clean) : clean;
            }
            touched[col] = true;
          });
          saveAll(all);
          Object.keys(touched).forEach(notify);
          return Promise.resolve();
        }
      };
    },
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
