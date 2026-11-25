/* ===================== TÌM KIẾM TOÀN HỆ THỐNG + TRẠNG THÁI ĐỒNG BỘ (v52) =====================
   Thuần hàm, không đọc Firebase: chỉ dùng dữ liệu đã có trong bộ nhớ (onSnapshot) → gõ phím không tốn thêm lượt đọc.
   Chỉ đưa vào chỉ mục các nhóm dữ liệu thuộc tab mà người dùng ĐƯỢC XEM (allowedTabs, lấy từ amgNavVisible).
   Không dấu / không phân biệt hoa thường ("keo tinh" tìm được "Kéo tinh"). */
function amgSearchNorm(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
}
// Dữ liệu thật có thể là số (vd. quy cách 0.2) hoặc thiếu → luôn đổi về chuỗi trước khi xử lý
function amgSearchStr(v) { return v == null ? "" : String(v).trim(); }
// Gom mọi giá trị chữ/số NGẮN của bản ghi (bỏ ảnh/tệp base64) để tìm theo từ khóa bất kỳ
function amgSearchHay(rec, extra) {
  const parts = [];
  Object.keys(rec || {}).forEach(k => { const v = rec[k]; if ((typeof v === "string" && v.length <= 160) || typeof v === "number") parts.push(v); });
  (extra || []).forEach(v => { if (v != null && v !== "") parts.push(v); });
  return amgSearchNorm(parts.join(" "));
}
const AMG_SEARCH_GROUPS = [
  { key: "orders", label: "Đơn hàng" }, { key: "completed", label: "Đơn hàng hoàn thành" }, { key: "customers", label: "Khách hàng" },
  { key: "materials", label: "Mã vật liệu" }, { key: "specs", label: "Quy cách sản phẩm" }, { key: "machines", label: "Máy sản xuất" },
  { key: "runs", label: "Lệnh sản xuất" }, { key: "staff", label: "Nhân sự" }, { key: "quality", label: "Phiếu chất lượng" }, { key: "docs", label: "Hồ sơ và tài liệu" }
];
function amgBuildSearchIndex({ orders, runs, machines, staff, extra, allowedTabs }) {
  const ok = tab => !allowedTabs || allowedTabs.indexOf(tab) > -1;
  const out = [];
  const add = (group, tab, id, title, sub, hay, focus) => { if (ok(tab)) out.push({ group, tab, id: String(id), title, sub: sub || "", hay, focus: focus || { q: String(id) } }); };
  const seenC = {}, seenM = {}, seenS = {};
  (orders || []).forEach(o => {
    const done = o.status === "completed", tab = done ? "completed" : "orders";
    const unit = o.unit === "m" ? "m" : "kg";
    add(done ? "completed" : "orders", tab, o.id, `${o.id} · ${o.customer || "—"}`, [o.spec, o.materialCode, o.quantity != null ? `${o.quantity} ${unit}` : ""].filter(Boolean).join(" · "), amgSearchHay(o), { orderId: o.id });
    const c = amgSearchStr(o.customer); if (c) { (seenC[c] = seenC[c] || { n: 0, tab }).n++; }
    const m = amgSearchStr(o.materialCode); if (m) { (seenM[m] = seenM[m] || { n: 0, tab }).n++; }
    const s = amgSearchStr(o.spec); if (s) { (seenS[s] = seenS[s] || { n: 0, tab }).n++; }
  });
  const tabOrders = "orders";
  Object.keys(seenC).forEach(c => add("customers", tabOrders, "KH:" + c, c, `${seenC[c].n} đơn hàng`, amgSearchNorm(c), { q: c }));
  Object.keys(seenM).forEach(m => add("materials", tabOrders, "VL:" + m, m, `${seenM[m].n} đơn hàng`, amgSearchNorm(m), { q: m }));
  Object.keys(seenS).forEach(s => add("specs", tabOrders, "QC:" + s, s, `${seenS[s].n} đơn hàng`, amgSearchNorm(s), { q: s }));
  (machines || []).forEach(m => add("machines", "machines", m.id, `${m.id} · ${m.name || m.typeLabel || ""}`.replace(/ · $/, ""), [m.typeLabel, m.status].filter(Boolean).join(" · "), amgSearchHay(m), { q: m.id, screen: "monitor" }));
  (runs || []).forEach(r => add("runs", "machines", r.id, `${r.id} · ${r.machineId || "—"} · ${r.orderId || "—"}`, [r.stageKey, r.operator, r.productionStatus].filter(Boolean).join(" · "), amgSearchHay(r), { q: r.machineId || r.id, screen: "monitor" }));
  (staff || []).forEach(s => add("staff", "staff", s.id, `${s.name || s.id}${s.code ? " · " + s.code : ""}`, [s.team, s.shift, s.status].filter(Boolean).join(" · "), amgSearchHay(s), { q: s.name || s.id }));
  ((extra && extra.inspections) || []).forEach(r => add("quality", "inspect", r.id, `${r.id} · Phiếu kiểm tra`, [r.orderId, r.result, r.type].filter(Boolean).join(" · "), amgSearchHay(r), { q: r.id }));
  ((extra && extra.ncr) || []).forEach(r => add("quality", "inspect", r.id, `${r.id} · Phiếu NG`, [r.orderId, r.status].filter(Boolean).join(" · "), amgSearchHay(r), { q: r.id }));
  ((extra && extra.documents) || []).forEach(r => add("docs", "docs", r.id, `${r.title || r.name || r.id}`, [r.id, r.type, r.category].filter(Boolean).join(" · "), amgSearchHay(r), { q: r.title || r.name || r.id }));
  return out;
}
// Mọi từ khóa phải xuất hiện; khớp ở đầu mã/tên được ưu tiên. Mỗi nhóm giới hạn perGroup kết quả (total vẫn đếm đủ).
function amgSearchRun(index, q, perGroup) {
  const words = amgSearchNorm(q).split(" ").filter(Boolean);
  if (!words.length) return { total: 0, groups: [] };
  const lim = perGroup || 6, by = {};
  (index || []).forEach(e => {
    if (!words.every(w => e.hay.indexOf(w) > -1)) return;
    const t = amgSearchNorm(e.title);
    const score = (t.indexOf(words[0]) === 0 ? 0 : t.indexOf(words[0]) > -1 ? 1 : 2);
    (by[e.group] = by[e.group] || []).push({ e, score });
  });
  const groups = AMG_SEARCH_GROUPS.filter(g => by[g.key]).map(g => {
    const all = by[g.key].sort((a, b) => a.score - b.score || String(a.e.title).localeCompare(String(b.e.title), "vi"));
    return { key: g.key, label: g.label, count: all.length, items: all.slice(0, lim).map(x => x.e) };
  });
  return { total: groups.reduce((s, g) => s + g.count, 0), groups };
}
// Nhận "tiêu điểm" do tìm kiếm/kế hoạch đặt trước khi chuyển tab; chỉ trang đích mới đọc (và xóa) nó.
function amgTakeFocus(tab) {
  const f = typeof window !== "undefined" ? window.__AMG_FOCUS : null;
  if (f && f.tab === tab) { window.__AMG_FOCUS = null; return f; }
  return null;
}
// Trạng thái đồng bộ HIỂN THỊ — suy ra từ trạng thái kết nối thật của lớp dữ liệu (window.__rtdbStatus), không phải từ việc giao diện vừa vẽ.
function amgSyncView(s, nowMs) {
  s = s || {}; const now = nowMs || Date.now();
  const hm = ms => { const d = new Date(ms), p = n => String(n).padStart(2, "0"); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
  if (s.readError || s.writeError || s.state === "error") return { key: "error", label: "Có lỗi đồng bộ", tone: "err", title: s.readError || s.writeError || "Không đọc được dữ liệu từ máy chủ" };
  if (s.state === "offline") return { key: "offline", label: "Mất kết nối" + (s.pending ? ` (${s.pending} chờ gửi)` : ""), tone: "warn", title: "Đang dùng dữ liệu lưu trên máy. Sẽ tự đồng bộ khi có mạng." };
  if (s.state === "connecting" || !s.lastSync && s.state !== "online") return { key: "connecting", label: "Đang kết nối", tone: "info", title: "Đang kết nối máy chủ dữ liệu" };
  if (s.pending > 0) return { key: "syncing", label: `Đang đồng bộ (${s.pending})`, tone: "info", title: "Có thay đổi đang chờ gửi lên máy chủ" };
  if (s.lastRemote && now - s.lastRemote < 4000) return { key: "updated", label: "Vừa nhận cập nhật", tone: "ok", title: "Dữ liệu vừa được cập nhật từ thiết bị khác lúc " + hm(s.lastRemote) };
  if (s.lastSync) return { key: "synced", label: "Đã đồng bộ", tone: "ok", title: "Đồng bộ lần cuối lúc " + hm(s.lastSync) };
  return { key: "connected", label: "Đã kết nối", tone: "ok", title: "Đã kết nối máy chủ dữ liệu" };
}
