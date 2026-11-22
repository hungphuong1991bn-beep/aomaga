/* ===================== CẢNH BÁO & CA LÀM VIỆC (v45) =====================
   Chỉ tính từ dữ liệu thật đang có. Không có dữ liệu thì không có cảnh báo, không tự bịa. */
function amgTodayKey(d) {
  const x = d || new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
// Ca hiện tại theo cấu hình AMG_CONFIG.shifts (mặc định tạm: ca ngày 06:00-18:00, còn lại là ca đêm)
function amgCurrentShift(now) {
  const d = now || new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  const toM = s => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
  const day = AMG_CONFIG.shifts.ngay;
  const isDay = mins >= toM(day.from) && mins < toM(day.to);
  return isDay ? { key: "caNgay", label: "Ca Ngày", range: `${day.from}–${day.to}` } : { key: "caDem", label: "Ca Đêm", range: `${day.to}–${day.from}` };
}
function amgComputeAlerts({ orders, machines, attendance, now, extra }) {
  const out = [];
  const list = a => (a || []).slice(0, 4).map(m => m.name || m.id).join(", ") + ((a || []).length > 4 ? "…" : "");
  const broken = (machines || []).filter(m => m.status === "broken");
  if (broken.length) out.push({ id: "m-broken", level: "err", title: `${broken.length} máy hỏng/dừng`, detail: list(broken), tab: "machines" });
  const maint = (machines || []).filter(m => m.status === "maintenance");
  if (maint.length) out.push({ id: "m-maint", level: "warn", title: `${maint.length} máy đang bảo trì`, detail: list(maint), tab: "machines" });
  const unk = (machines || []).filter(m => m.status === "unknown");
  if (unk.length) out.push({ id: "m-unk", level: "info", title: `${unk.length} máy chưa xác định trạng thái`, detail: "Cần người vận hành xác nhận", tab: "machines" });
  // Đơn đến hạn: chỉ khi đơn có trường deliveryDate (YYYY-MM-DD)
  const today = new Date((now || new Date()).toDateString()).getTime();
  const late = [], soon = [];
  (orders || []).forEach(o => {
    if (!o.deliveryDate) return;
    const t = new Date(o.deliveryDate + "T00:00:00").getTime();
    if (Number.isNaN(t)) return;
    if (orderProgress(normalizeOrderStages(o)).statusLabel === "Hoàn thành") return;
    const days = Math.round((t - today) / 86400000);
    if (days < 0) late.push(o); else if (days <= 7) soon.push(o);
  });
  if (late.length) out.push({ id: "o-late", level: "err", title: `${late.length} đơn quá hạn giao`, detail: late.slice(0, 4).map(o => o.id).join(", "), tab: "orders" });
  if (soon.length) out.push({ id: "o-soon", level: "warn", title: `${soon.length} đơn sắp đến hạn (≤ 7 ngày)`, detail: soon.slice(0, 4).map(o => o.id).join(", "), tab: "orders" });
  const att = (attendance || {})[amgTodayKey(now)] || {};
  const absent = Object.keys(att).filter(id => att[id] && att[id].nghiKhongPhep).length;
  if (absent) out.push({ id: "a-abs", level: "warn", title: `${absent} người nghỉ không phép hôm nay`, detail: "", tab: "staff" });
  // Phân hệ mới (v45): chỉ cảnh báo khi có dữ liệu thật
  const ex = extra || {};
  const todayKey = amgTodayKey(now);
  const plus = n => amgTodayKey(new Date(new Date((now || new Date()).toDateString()).getTime() + n * 86400000));
  const ncrOpen = (ex.ncr || []).filter(n => n.status && n.status !== "dong");
  if (ncrOpen.length) out.push({ id: "q-ncr", level: ncrOpen.some(n => n.dueDate && n.dueDate < todayKey) ? "err" : "warn", title: `${ncrOpen.length} phiếu NG chưa đóng`, detail: ncrOpen.slice(0, 4).map(n => n.id).join(", "), tab: "inspect" });
  const quar = (ex.lots || []).filter(l => l.status === "cach_ly");
  if (quar.length) out.push({ id: "k-quar", level: "warn", title: `${quar.length} lô nguyên liệu đang cách ly`, detail: quar.slice(0, 4).map(l => l.lotNo || l.id).join(", "), tab: "warehouse" });
  const due = (ex.maintenance || []).filter(m => m.status !== "xong" && m.nextDue && m.nextDue <= plus(7));
  const dueP = (ex.maintenance || []).filter(m => m.kind === "dinh_ky" && m.status === "xong" && m.nextDue && m.nextDue <= plus(7));
  const dueAll = due.concat(dueP);
  if (dueAll.length) out.push({ id: "b-due", level: dueAll.some(m => m.nextDue < todayKey) ? "err" : "warn", title: `${dueAll.length} việc bảo trì đến hạn (≤ 7 ngày)`, detail: dueAll.slice(0, 4).map(m => m.machineId).join(", "), tab: "maintenance" });
  const docExp = (ex.documents || []).filter(d => d.status === "da_duyet" && d.expiryDate && d.expiryDate <= plus(30));
  if (docExp.length) out.push({ id: "d-exp", level: "warn", title: `${docExp.length} tài liệu sắp/đã hết hiệu lực`, detail: docExp.slice(0, 4).map(d => d.code || d.id).join(", "), tab: "docs" });
  const rank = { err: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
