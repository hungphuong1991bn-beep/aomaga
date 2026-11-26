/* ===================== THEO DÕI THỜI GIAN DỪNG MÁY — GIAO DIỆN MES (v55) =====================
   Chỉ ĐỌC: mọi sự kiện được dựng từ Kế hoạch sản xuất (productionRuns.pauses) + Thẻ máy (dữ liệu cũ) bằng domain/downtime.js.
   Không có ô nhập dữ liệu gốc ở đây; sửa/hủy một lần dừng thực hiện tại Kế hoạch sản xuất (Chi tiết lệnh). */
const dth = React.createElement;
const DT_CLASS_COLOR = () => ({ breakdown: COLORS.red, planned: COLORS.blue, other: COLORS.amber });
const DT_CAT_COLOR = () => ({ equipment: COLORS.red, power: "#B91C1C", changeover: COLORS.blue, maintenance: COLORS.violet, material: COLORS.amber, mold: COLORS.copper, order: COLORS.green, manpower: "#0E7490", other: COLORS.textFaint });
const DT_PRESETS = [{ k: "today", l: "Hôm nay" }, { k: "week", l: "Tuần này" }, { k: "month", l: "Tháng này" }, { k: "30d", l: "30 ngày" }, { k: "all", l: "Tất cả" }, { k: "custom", l: "Tùy chọn" }];

function dtPresetRange(k) {
  const now = new Date(), key = d => amgTodayKey(d);
  if (k === "today") return { from: key(now), to: key(now) };
  if (k === "week") { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)); return { from: key(d), to: key(now) }; }
  if (k === "month") return { from: key(new Date(now.getFullYear(), now.getMonth(), 1)), to: key(now) };
  if (k === "30d") return { from: key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: key(now) };
  return { from: "", to: "" };
}
function useDtNow() {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), 30000); return () => clearInterval(t); }, []);
  return n;
}
const dtIso = ms => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const dtDate = k => (k ? k.split("-").reverse().join("/") : "—");
const dtMinLabel = v => `${Math.round(v * 10) / 10} phút`;

/* ---------- Thành phần nhỏ ---------- */
function DtStateBadge({ e }) {
  const map = { open: [COLORS.red, "ĐANG DỪNG"], closed: [COLORS.green, e.closedByFinish ? "Đóng khi kết thúc lệnh" : "Đã xử lý"], unclosed: [COLORS.amber, "Chưa đóng"], cancelled: [COLORS.textFaint, "Đã hủy"], removed: [COLORS.textFaint, "Nguồn đã xóa"] };
  const m = map[e.state] || map.closed;
  return dth(Badge, { color: m[0] }, m[1]);
}
function DtRanked({ items, color, valueOf, labelOf, emptyText }) {
  if (!items.length) return dth("div", { style: { color: COLORS.textFaint, fontSize: FZ(13), padding: "8px 0" } }, emptyText || "Chưa có dữ liệu");
  const max = Math.max.apply(null, items.map(valueOf)) || 1;
  return dth("div", { style: { display: "grid", gap: 8 } }, items.map((it, i) => dth("div", { key: it.key || it.id || i },
    dth("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: FZ(13), marginBottom: 3 } },
      dth("span", { style: { fontWeight: 700 } }, `${i + 1}. ${it.name}`), dth("span", { className: "mes-mono", style: { color: COLORS.textDim } }, labelOf(it))),
    dth("div", { style: { height: 8, borderRadius: 4, background: COLORS.bgInset, overflow: "hidden" } }, dth("div", { style: { width: Math.max(3, valueOf(it) / max * 100) + "%", height: "100%", background: (typeof color === "function" ? color(it) : color), borderRadius: 4 } })))));
}
function DtChart({ title, eyebrow, accent, height, hasData, children }) {
  const ok = typeof ResponsiveContainer !== "undefined" && ResponsiveContainer;
  if (!ok) return dth("div", { className: "mes-card", style: { padding: 18 } }, dth("div", { className: "mes-display", style: { fontWeight: 700 } }, title), dth("div", { style: { color: COLORS.textFaint, fontSize: FZ(13), marginTop: 8 } }, "Không tải được thư viện biểu đồ (cần internet lần đầu)."));
  if (!hasData) return dth("div", { className: "mes-card", style: { padding: 18, border: `1px solid ${accent}55`, borderTop: `4px solid ${accent}` } }, dth("div", { className: "mes-display", style: { fontSize: FZ(14), fontWeight: 700 } }, title), dth("div", { style: { color: COLORS.textFaint, fontSize: FZ(13), padding: "34px 0", textAlign: "center" } }, "Chưa có dữ liệu trong bộ lọc hiện tại"));
  return dth(ChartCard, { title, eyebrow, accent, height }, children);
}
const dtTip = { contentStyle: { background: COLORS.bgPanel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: FZ(12) }, formatter: v => [amgHm(v * 60000), "Thời gian dừng"] };
const dtAxis = { tick: { fill: COLORS.textFaint, fontSize: FZ(12) }, axisLine: { stroke: COLORS.border }, tickLine: false };

/* ---------- Hộp chi tiết: nguồn từ Kế hoạch sản xuất + lịch sử ---------- */
function DtDetailModal({ e, orders, onClose, onNavigateFocus, isAdmin, onEditLegacy, onDeleteLegacy, machines }) {
  const led = e.ledger, revs = led && led.revisions ? led.revisions.slice().reverse() : [];
  const actLabel = { create: "Tạo (bấm Tạm dừng)", resume: "Tiếp tục chạy (kết thúc dừng)", close: "Đóng khi kết thúc lệnh", edit: "Chỉnh sửa", cancel: "Hủy", removed: "Nguồn bị xóa" };
  const view = v => (v ? `${v.reason || "—"} · ${v.startAt ? amgFmtDateTime(v.startAt) : "—"} → ${v.endAt ? amgFmtDateTime(v.endAt) : "đang dừng"}` : "—");
  const row = (k, v, mono) => dth("div", { key: k, style: { display: "grid", gridTemplateColumns: "150px 1fr", gap: 8, padding: "6px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13) } },
    dth("div", { style: { color: COLORS.textDim, fontWeight: 700 } }, k), dth("div", { className: mono ? "mes-mono" : "", style: { wordBreak: "break-word" } }, v == null || v === "" ? "—" : v));
  const legacy = e.source === "machine";
  const machineRec = legacy ? ((machines.find(m => m.id === e.machineId) || {}).downtimeLog || []).find(x => x.id === e.machineLogId) : null;
  const [editing, setEditing] = useState(false);
  const classColor = DT_CLASS_COLOR()[e.cat.cls];
  return dth(Modal, { title: `Sự kiện dừng máy ${e.id}`, onClose, width: 860 },
    dth("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } }, dth(DtStateBadge, { e }), dth(Badge, { color: classColor }, AMG_DT_CLASSES[e.cat.cls].label), dth(Badge, { color: DT_CAT_COLOR()[e.cat.key] }, e.cat.label),
      e.edited && dth(Badge, { color: COLORS.blue }, "Đã chỉnh sửa"), dth(Badge, { color: COLORS.textDim }, legacy ? "Nguồn: Thẻ máy (đổi trạng thái)" : e.source === "plan" ? "Nguồn: Kế hoạch sản xuất" : "Sổ lịch sử")),
    dth("div", { className: "mes-card", style: { padding: "4px 14px", marginBottom: 12 } },
      row("Mã sự kiện", e.id, true), row("Ngày sản xuất", dtDate(e.date)), row("Ca", e.shiftLabel + (e.shiftDerived ? " (suy ra theo giờ bắt đầu theo cấu hình ca)" : "")), row("Máy", e.machineLabel),
      row("Đơn hàng", e.orderLabel), row("Khách hàng", e.customer), row("Quy cách", e.spec), row("Mã nguyên liệu", e.materialCode), row("Công đoạn", e.stageKey ? amgStageLabel(e.stageKey) : ""), row("Người vận hành", e.operator),
      row("Bắt đầu dừng", amgFmtDateTime(dtIso(e.startMs))), row("Kết thúc dừng", e.endMs ? amgFmtDateTime(dtIso(e.endMs)) : e.state === "open" ? "Đang dừng" : "Chưa ghi nhận"),
      row("Tổng thời gian dừng", e.durMs == null ? "Chưa xác định (lần dừng chưa đóng)" : amgHm(e.durMs) + (e.effMs !== e.durMs && e.source === "machine" ? ` · tính ${amgHm(e.effMs)} (đã trừ ${amgHm(e.overlapMs)} trùng tạm dừng lệnh)` : "")),
      row("Nguyên nhân (gốc nhân viên ghi)", e.reason || "Chưa ghi nguyên nhân"), row("Phân loại tự động", `${e.cat.label} → ${AMG_DT_CLASSES[e.cat.cls].label}${e.cat.by === "status" ? " (theo trạng thái máy vì không có nguyên nhân)" : e.cat.by === "none" ? " (không có nguyên nhân để phân loại)" : ""}`),
      row("Nhân sự ghi nhận", e.recordedBy), row("Nhân sự xác nhận (tiếp tục chạy)", e.confirmedBy), e.state === "cancelled" || e.state === "removed" ? row("Lý do hủy / xóa", `${e.cancelReason || e.excludedWhy}${e.cancelledBy ? " · " + e.cancelledBy : ""}${e.cancelledAt ? " · " + amgFmtDateTime(e.cancelledAt) : ""}`) : null,
      e.excludedWhy && e.state !== "cancelled" && e.state !== "removed" ? row("Ghi chú tính toán", e.excludedWhy) : null),
    dth("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, margin: "6px 0" } }, "TRUY XUẤT NGUỒN"),
    dth("div", { className: "mes-card", style: { padding: "4px 14px", marginBottom: 12 } },
      e.source !== "machine" ? row("Lệnh máy (Kế hoạch)", e.runId, true) : row("Bản ghi Thẻ máy", e.machineLogId, true),
      e.source !== "machine" ? row("Lần dừng thứ", e.pauseIndex >= 0 ? `#${e.pauseIndex + 1} của lệnh` : "") : null,
      e.source !== "machine" ? row("Mã đơn nội bộ", e.orderId, true) : null,
      dth("div", { key: "nav", style: { display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 0" } },
        e.source !== "machine" && e.state !== "removed" && dth(Button, { size: "sm", onClick: () => { onClose(); onNavigateFocus("machines", { runDetail: e.runId }); } }, "Mở lệnh máy gốc (sửa/hủy tại đây)"),
        e.orderId && e.state !== "removed" && orders.some(o => o.id === e.orderId) && dth(Button, { size: "sm", onClick: () => { onClose(); onNavigateFocus("machines", { orderDetail: e.orderId }); } }, "Mở đơn hàng & kế hoạch của đơn"),
        legacy && dth(Button, { size: "sm", onClick: () => { onClose(); onNavigateFocus("machines", {}); } }, "Mở Kế hoạch / Thẻ máy"),
        legacy && isAdmin && machineRec && dth(Button, { size: "sm", onClick: () => setEditing(true) }, "Sửa bản ghi cũ (Admin)"),
        legacy && isAdmin && machineRec && dth(Button, { size: "sm", variant: "danger", onClick: async () => { if (window.confirm("Xóa bản ghi dừng máy cũ này của Thẻ máy? Không thể hoàn tác.")) { await onDeleteLegacy(e.machineId, e.machineLogId); onClose(); } } }, "Xóa bản ghi cũ (Admin)"))),
    dth("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, margin: "6px 0" } }, "LỊCH SỬ & TRUY XUẤT"),
    led ? dth("div", { className: "mes-card", style: { padding: "4px 14px", marginBottom: 6 } }, row("Tạo lúc", `${led.createdAt ? amgFmtDateTime(led.createdAt) : "—"} · ${led.createdBy || "—"}`), row("Cập nhật lúc", `${led.updatedAt ? amgFmtDateTime(led.updatedAt) : "—"} · ${led.updatedBy || "—"}`)) :
      dth("div", { style: { fontSize: FZ(13), color: COLORS.textFaint, marginBottom: 6 } }, legacy ? "Dữ liệu Thẻ máy cũ — chưa có sổ lịch sử chỉnh sửa." : "Sự kiện phát sinh trước khi có sổ lịch sử (v55): chưa có nhật ký chỉnh sửa. Nhật ký hệ thống (Phân quyền & giám sát) vẫn lưu lần tạm dừng/tiếp tục."),
    revs.length > 0 && dth("div", { style: { display: "grid", gap: 6 } }, revs.map((r, i) => dth("div", { key: i, style: { padding: "8px 10px", borderRadius: 8, background: COLORS.bgInset, fontSize: FZ(13) } },
      dth("div", { style: { fontWeight: 700 } }, `${actLabel[r.action] || r.action} · ${r.by || "—"} · ${amgFmtDateTime(r.ts)}${r.note ? " · " + r.note : ""}`),
      (r.before || r.after) && dth("div", { style: { color: COLORS.textDim, marginTop: 3 } }, dth("div", null, "Trước: " + view(r.before)), dth("div", null, "Sau: " + view(r.after)))))),
    dth("div", { className: "mes-no-print", style: { marginTop: 12, display: "flex", justifyContent: "flex-end" } }, dth(Button, { onClick: onClose }, "Đóng")),
    editing && machineRec && dth(DowntimeEditModal, { machineId: e.machineId, record: machineRec, onClose: () => setEditing(false), onSave: onEditLegacy }));
}

/* ---------- Hộp cài đặt ngưỡng theo máy (Admin / Quản đốc) ---------- */
function DtSettingsModal({ machines, settings, onClose }) {
  const init = AMG_DT_DEFAULTS;
  const d0 = Object.assign({}, init, (settings && settings.defaults) || {});
  const [def, setDef] = useState({ maxEventMin: String(d0.maxEventMin), maxEventsPerDay: String(d0.maxEventsPerDay), minAvailabilityPct: String(d0.minAvailabilityPct), repeatCount: String(d0.repeatCount), surgePct: String(d0.surgePct), surgeMinMin: String(d0.surgeMinMin) });
  const [per, setPer] = useState(() => { const o = {}; machines.forEach(m => { const x = (settings && settings.machines && settings.machines[m.id]) || {}; o[m.id] = { maxEventMin: x.maxEventMin == null ? "" : String(x.maxEventMin), maxEventsPerDay: x.maxEventsPerDay == null ? "" : String(x.maxEventsPerDay), minAvailabilityPct: x.minAvailabilityPct == null ? "" : String(x.minAvailabilityPct) }; }); return o; });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const num = (v, label) => { const n = Number(String(v).replace(",", ".")); if (!Number.isFinite(n) || n < 0) throw new Error(`${label}: phải là số ≥ 0`); return n; };
  async function save() {
    setBusy(true); setError("");
    try {
      const defaults = { maxEventMin: num(def.maxEventMin, "Ngưỡng/lần"), maxEventsPerDay: num(def.maxEventsPerDay, "Số lần/ngày"), minAvailabilityPct: num(def.minAvailabilityPct, "Availability tối thiểu"), repeatCount: num(def.repeatCount, "Số lần lặp"), surgePct: num(def.surgePct, "% tăng"), surgeMinMin: num(def.surgeMinMin, "Phút tăng tối thiểu") };
      if (defaults.minAvailabilityPct > 100) throw new Error("Availability tối thiểu không quá 100%");
      const machinesCfg = {};
      machines.forEach(m => {
        const x = per[m.id], o = {};
        if (x.maxEventMin !== "") o.maxEventMin = num(x.maxEventMin, `${m.id} ngưỡng/lần`);
        if (x.maxEventsPerDay !== "") o.maxEventsPerDay = num(x.maxEventsPerDay, `${m.id} số lần/ngày`);
        if (x.minAvailabilityPct !== "") { o.minAvailabilityPct = num(x.minAvailabilityPct, `${m.id} Availability`); if (o.minAvailabilityPct > 100) throw new Error(`${m.id}: Availability không quá 100%`); }
        if (Object.keys(o).length) machinesCfg[m.id] = o;
      });
      await amgDtSaveSettings({ defaults, machines: machinesCfg });
      onClose();
    } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  const inp = (val, on, ph) => dth("input", { className: "mes-input", inputMode: "decimal", value: val, placeholder: ph, onChange: e => on(e.target.value), style: { width: "100%" } });
  const fld = (label, k) => dth(Field, { key: k, label }, inp(def[k], v => setDef(Object.assign({}, def, { [k]: v }))));
  return dth(Modal, { title: "Ngưỡng cảnh báo dừng máy", onClose, width: 760 },
    dth("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, "Giá trị mặc định áp dụng cho mọi máy; ô riêng của máy để trống = dùng mặc định. Đặt 0 để tắt cảnh báo tương ứng."),
    dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 } },
      fld("Dừng tối đa/lần (phút)", "maxEventMin"), fld("Số lần dừng/ngày", "maxEventsPerDay"), fld("Availability tối thiểu (%)", "minAvailabilityPct"), fld("Nguyên nhân lặp (số lần)", "repeatCount"), fld("Tăng bất thường (% so kỳ trước)", "surgePct"), fld("…và tăng ít nhất (phút)", "surgeMinMin")),
    dth("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, marginBottom: 6 } }, "NGƯỠNG RIÊNG THEO MÁY"),
    dth("div", { className: "mes-scroll-x", style: { maxHeight: 320, overflow: "auto" } }, dth("table", { className: "mes-table", style: { minWidth: 560, fontSize: FZ(13) } },
      dth("thead", null, dth("tr", null, ["Máy", "Dừng tối đa/lần (phút)", "Số lần/ngày", "Availability tối thiểu (%)"].map(h => dth("th", { key: h }, h)))),
      dth("tbody", null, machines.map(m => dth("tr", { key: m.id }, dth("td", { className: "mes-mono", style: { fontWeight: 700 } }, m.id),
        ["maxEventMin", "maxEventsPerDay", "minAvailabilityPct"].map(k => dth("td", { key: k }, inp(per[m.id][k], v => setPer(Object.assign({}, per, { [m.id]: Object.assign({}, per[m.id], { [k]: v }) })), "mặc định")))))))),
    error && dth("div", { style: { color: COLORS.red, fontSize: FZ(13), margin: "8px 0" } }, error),
    dth("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 } }, dth(Button, { onClick: onClose }, "Đóng"), dth(Button, { variant: "primary", disabled: busy, onClick: save }, busy ? "Đang lưu…" : "Lưu ngưỡng")));
}

/* ---------- Xuất báo cáo ---------- */
function dtExportXlsx(kinds, an, events, label) {
  if (!window.XLSX || !XLSX.utils) { alert("Không tải được thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng và thử lại."); return; }
  const wb = XLSX.utils.book_new();
  kinds.forEach(k => {
    const def = AMG_DT_REPORTS.find(r => r.key === k), t = amgDtReportTable(k, an, events);
    const aoa = [[def.label + " — " + label], []].concat([t.head], t.rows);
    if (t.note) aoa.push([], [t.note]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = t.head.map((h, i) => ({ wch: Math.min(48, Math.max(12, String(h).length + 2, ...t.rows.slice(0, 50).map(r => String(r[i] == null ? "" : r[i]).length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, def.sheet.slice(0, 31));
  });
  XLSX.writeFile(wb, `dung_may_${kinds.length > 1 ? "tong_hop" : kinds[0]}_${amgTodayKey()}.xlsx`);
}
function dtExportPdf(kind, an, events, label, who) {
  const def = AMG_DT_REPORTS.find(r => r.key === kind), t = amgDtReportTable(kind, an, events);
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank");
  if (!w) { alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên (pop-up) cho trang này rồi thử lại."); return; }
  const derived = events.some(e => e.shiftDerived);
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(def.label)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:18px;font-size:12px}h1{font-size:18px;margin:0 0 4px}.m{color:#555;margin-bottom:12px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}
    .k{display:flex;gap:14px;margin:8px 0 12px}.k div{border:1px solid #bbb;padding:6px 10px;border-radius:4px}.k b{display:block;font-size:15px}
    @page{size:A4 landscape;margin:12mm}</style></head><body>
    <h1>AOMAGA VIỆT NAM — ${esc(def.label)}</h1><div class="m">${esc(label)} · Lập bởi ${esc(who || "—")} lúc ${esc(new Date().toLocaleString("vi-VN"))}</div>
    <div class="k"><div>Số lần dừng<b>${an.count}</b></div><div>Tổng thời gian dừng<b>${esc(amgHm(an.total))}</b></div><div>Số máy phát sinh dừng<b>${an.machinesAffected}</b></div><div>Availability<b>${an.runRatePct === null ? "Chưa đủ dữ liệu" : an.runRatePct + "%"}</b></div></div>
    <table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${t.head.length}">Không có dữ liệu trong bộ lọc</td></tr>`}</tbody></table>
    ${t.note ? `<p>${esc(t.note)}</p>` : ""}${derived ? "<p>* Ca suy ra theo giờ bắt đầu (dữ liệu Thẻ máy không ghi ca).</p>" : ""}
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}

/* ===================== TRANG CHÍNH ===================== */
function DowntimeMesPage({ machines, orders, runs, ledger, settings, ledgerError, currentUser, isAdmin, onNavigateFocus, onUpdateLegacy, onDeleteLegacy, flowError, loaded }) {
  const nowMs = useDtNow();
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(() => dtPresetRange("month"));
  const [fMachine, setFMachine] = useState("all"), [fShift, setFShift] = useState("all"), [fCat, setFCat] = useState("all"), [fCls, setFCls] = useState("all"), [fOrder, setFOrder] = useState("all"), [fSource, setFSource] = useState("all");
  const [q, setQ] = useState(""), [showInactive, setShowInactive] = useState(false);
  const [sel, setSel] = useState(null), [limit, setLimit] = useState(100), [tv, setTv] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [repKind, setRepKind] = useState("day");
  const canSettings = amgIsPower(currentUser);

  const all = useMemo(() => amgDtBuildEvents({ runs, machines, orders, ledger, nowMs }), [runs, machines, orders, ledger, nowMs]);
  const f = { from: range.from, to: range.to, machineId: fMachine, shift: fShift, cat: fCat, cls: fCls, orderId: fOrder, source: fSource, q, showInactive };
  const rows = useMemo(() => amgDtFilter(all, f), [all, range.from, range.to, fMachine, fShift, fCat, fCls, fOrder, fSource, q, showInactive]);
  const an = useMemo(() => amgDtAnalyze(rows, runs, { from: range.from, to: range.to }, nowMs), [rows, runs, range.from, range.to, nowMs]);
  const alerts = useMemo(() => amgDtAlerts(all, runs, { from: range.from, to: range.to, machineId: fMachine }, settings, nowMs), [all, runs, range.from, range.to, fMachine, settings, nowMs]);
  const mtable = useMemo(() => amgDtMachineTable(an, rows, alerts.lowPerf), [an, rows, alerts]);
  const openNow = useMemo(() => all.filter(e => e.state === "open"), [all]);
  const orderOpts = useMemo(() => { const m = {}; all.forEach(e => { if (e.orderId) m[e.orderId] = e.orderLabel; }); return Object.keys(m).map(id => ({ id, label: m[id] })).sort((a, b) => a.label.localeCompare(b.label)); }, [all]);
  const planCount = all.filter(e => e.source === "plan").length, machCount = all.filter(e => e.source === "machine" && e.countable).length;
  const label = `Kỳ: ${range.from ? dtDate(range.from) : "đầu dữ liệu"} → ${range.to ? dtDate(range.to) : "hiện tại"} · Máy: ${fMachine === "all" ? "tất cả" : fMachine} · Ca: ${fShift === "all" ? "tất cả" : fShift === "ngay" ? "Ngày" : "Đêm"}`;
  const cc = DT_CLASS_COLOR(), cat = DT_CAT_COLOR();
  const applyPreset = k => { setPreset(k); if (k !== "custom") setRange(dtPresetRange(k)); };
  const clear = () => { setFMachine("all"); setFShift("all"); setFCat("all"); setFCls("all"); setFOrder("all"); setFSource("all"); setQ(""); setShowInactive(false); applyPreset("month"); };
  const selEvent = sel ? all.find(e => e.id === sel) : null;
  const sync = flowError ? { c: COLORS.red, t: "Lỗi đọc Kế hoạch sản xuất" } : !loaded ? { c: COLORS.amber, t: "Đang tải dữ liệu…" } : { c: COLORS.green, t: "Đồng bộ trực tiếp từ Kế hoạch sản xuất" };

  const kpis = [
    amgKpiTile("Tổng thời gian dừng", an.count ? amgHm(an.total) : "0 phút", an.total ? COLORS.red : COLORS.green, false, null, an.openCount ? `${an.openCount} máy đang dừng — tính đến hiện tại` : "Chỉ tính lần dừng không bị hủy"),
    amgKpiTile("Số lần dừng máy", an.count, COLORS.amber, false, null, an.unclosed ? `${an.unclosed} lần chưa đóng (thiếu dữ liệu)` : ""),
    amgKpiTile("Số máy phát sinh dừng", an.machinesAffected, COLORS.violet, false, null, `${machines.length} máy trong hệ thống`),
    amgKpiTile("Dừng trung bình / lần", an.avgMs === null ? "—" : amgHm(an.avgMs), COLORS.blue, false, null, an.avgMs === null ? "Chưa có lần dừng nào" : ""),
    amgKpiTile("Máy dừng nhiều nhất", an.topMachine ? an.topMachine.id : "—", COLORS.copper, false, null, an.topMachine ? `${amgHm(an.topMachine.ms)} · ${an.topMachine.n} lần` : "Chưa có dữ liệu"),
    amgKpiTile("Tỷ lệ thời gian vận hành", an.runRatePct === null ? "Chưa đủ dữ liệu" : an.runRatePct + "%", an.runRatePct === null ? COLORS.textFaint : an.runRatePct >= 85 ? COLORS.green : an.runRatePct >= 70 ? COLORS.amber : COLORS.red, false, null,
      an.runRatePct === null ? "Chưa có lệnh máy đã chạy trong kỳ" : `Vận hành ${amgHm(an.rel.availPct == null ? 0 : an.schedMs * an.runRatePct / 100)} / kế hoạch ${amgHm(an.schedMs)}`)
  ];

  /* ----- phần biểu đồ ----- */
  const machineData = an.machines.map(m => ({ name: m.id, v: amgDtMin(m.ms) }));
  const causeData = an.causes.map(c => ({ name: c.name, v: amgDtMin(c.ms), key: c.key }));
  const shiftData = an.shifts.map(s => ({ name: s.name, v: amgDtMin(s.ms), n: s.n }));
  const trendData = an.trend.map(t => ({ name: an.trendBy === "month" ? t.key.split("-").reverse().join("/") : t.key.slice(8) + "/" + t.key.slice(5, 7), v: amgDtMin(t.ms), n: t.n }));
  const charts = dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 16, marginBottom: 16 } },
    dth(DtChart, { title: "Thời gian dừng theo từng máy (phút)", eyebrow: "Tổng hợp theo bộ lọc", accent: COLORS.red, height: Math.max(240, machineData.length * 28 + 40), hasData: machineData.length > 0 },
      dth(BarChart, { data: machineData, layout: "vertical", margin: { left: 8, right: 16 } }, dth(CartesianGrid, { strokeDasharray: "3 3", stroke: COLORS.border, horizontal: false }), dth(XAxis, Object.assign({ type: "number" }, dtAxis)), dth(YAxis, Object.assign({ type: "category", dataKey: "name", width: 64 }, dtAxis)), dth(Tooltip, dtTip), dth(Bar, { dataKey: "v", fill: COLORS.red, radius: [0, 4, 4, 0] }))),
    dth(DtChart, { title: "Thời gian dừng theo nguyên nhân (phút)", eyebrow: "Nhóm tự động phân loại", accent: COLORS.amber, height: Math.max(240, causeData.length * 32 + 40), hasData: causeData.length > 0 },
      dth(BarChart, { data: causeData, layout: "vertical", margin: { left: 8, right: 16 } }, dth(CartesianGrid, { strokeDasharray: "3 3", stroke: COLORS.border, horizontal: false }), dth(XAxis, Object.assign({ type: "number" }, dtAxis)), dth(YAxis, Object.assign({ type: "category", dataKey: "name", width: 120 }, dtAxis)), dth(Tooltip, dtTip), dth(Bar, { dataKey: "v", radius: [0, 4, 4, 0] }, causeData.map(d => dth(Cell, { key: d.key, fill: cat[d.key] || COLORS.textFaint }))))),
    dth(DtChart, { title: "So sánh thời gian dừng giữa các ca (phút)", eyebrow: "Ca Ngày / Ca Đêm", accent: COLORS.blue, height: 240, hasData: shiftData.some(s => s.v > 0) },
      dth(BarChart, { data: shiftData }, dth(CartesianGrid, { strokeDasharray: "3 3", stroke: COLORS.border, vertical: false }), dth(XAxis, Object.assign({ dataKey: "name" }, dtAxis)), dth(YAxis, Object.assign({}, dtAxis, { axisLine: false })), dth(Tooltip, dtTip), dth(Bar, { dataKey: "v", fill: COLORS.blue, radius: [4, 4, 0, 0] }))),
    dth(DtChart, { title: `Xu hướng dừng máy theo ${an.trendBy === "month" ? "tháng" : "ngày"} (phút)`, eyebrow: "Theo kỳ lọc", accent: COLORS.violet, height: 240, hasData: trendData.length > 0 },
      dth(LineChart, { data: trendData }, dth(CartesianGrid, { strokeDasharray: "3 3", stroke: COLORS.border, vertical: false }), dth(XAxis, Object.assign({ dataKey: "name" }, dtAxis)), dth(YAxis, Object.assign({}, dtAxis, { axisLine: false })), dth(Tooltip, dtTip), dth(Line, { type: "monotone", dataKey: "v", stroke: COLORS.violet, strokeWidth: 2, dot: { r: 3 } }))));
  const tops = dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 16, marginBottom: 16 } },
    dth("div", { className: "mes-card", style: { padding: 18, borderTop: `4px solid ${COLORS.copper}` } }, dth("div", { className: "mes-display", style: { fontSize: FZ(14), fontWeight: 700, marginBottom: 12 } }, "Top 5 máy có thời gian dừng cao nhất"),
      dth(DtRanked, { items: an.top5, color: COLORS.copper, valueOf: x => x.ms, labelOf: x => `${amgHm(x.ms)} · ${x.n} lần` })),
    dth("div", { className: "mes-card", style: { padding: 18, borderTop: `4px solid ${COLORS.amber}` } }, dth("div", { className: "mes-display", style: { fontSize: FZ(14), fontWeight: 700, marginBottom: 12 } }, "Nguyên nhân gây dừng máy nhiều nhất"),
      dth(DtRanked, { items: an.causes.slice(0, 5), color: x => cat[x.key], valueOf: x => x.ms, labelOf: x => `${amgHm(x.ms)} · ${x.n} lần` })));

  /* ----- cảnh báo ----- */
  const alertBox = dth("div", { className: "mes-card", style: { padding: 14, marginBottom: 16, borderTop: `4px solid ${alerts.list.length ? COLORS.red : COLORS.green}` } },
    dth("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: alerts.list.length ? 10 : 0, flexWrap: "wrap" } },
      dth("div", { className: "mes-display", style: { fontSize: FZ(14), fontWeight: 700 } }, `Cảnh báo thông minh (${alerts.list.length})`),
      !alerts.list.length && dth("span", { style: { color: COLORS.green, fontSize: FZ(13) } }, "Không có cảnh báo theo ngưỡng hiện tại"),
      canSettings && dth(Button, { size: "sm", style: { marginLeft: "auto" }, onClick: () => setSettingsOpen(true) }, "Cài ngưỡng theo máy")),
    alerts.list.length > 0 && dth("div", { style: { display: "grid", gap: 6, maxHeight: tv ? "none" : 220, overflow: "auto" } }, alerts.list.map(a => dth("div", { key: a.id, onClick: a.eventIds.length ? () => setSel(a.eventIds[0]) : undefined, style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "7px 10px", borderRadius: 8, background: (a.level === "err" ? COLORS.red : COLORS.amber) + "14", borderLeft: `4px solid ${a.level === "err" ? COLORS.red : COLORS.amber}`, cursor: a.eventIds.length ? "pointer" : "default", fontSize: FZ(13) } },
      dth("b", null, a.title), dth("span", { style: { color: COLORS.textDim } }, a.detail)))));

  const openStrip = openNow.length > 0 && dth("div", { className: "mes-card", style: { padding: 12, marginBottom: 16, border: `1px solid ${COLORS.red}55`, background: COLORS.red + "0d" } },
    dth("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.red, letterSpacing: ".05em", marginBottom: 8 } }, `ĐANG DỪNG NGAY BÂY GIỜ · ${openNow.length} MÁY`),
    dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 8 } }, openNow.map(e => dth("button", { key: e.id, type: "button", onClick: () => setSel(e.id), style: { textAlign: "left", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.red}55`, background: COLORS.bgPanel, cursor: "pointer", color: COLORS.text } },
      dth("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 } }, dth("b", { className: "mes-mono" }, e.machineId), dth("span", { className: "mes-mono", style: { color: COLORS.red, fontWeight: 800 } }, amgHm(e.durMs))),
      dth("div", { style: { fontSize: FZ(12), color: COLORS.textDim } }, `${e.reason || "Chưa ghi nguyên nhân"} · từ ${amgFmtDateTime(dtIso(e.startMs))}`)))));

  /* ----- OEE & độ tin cậy ----- */
  const rel = an.rel;
  const relTile = (label, val, why, color) => dth("div", { key: label, className: "mes-card", style: { padding: "10px 14px", minWidth: 0, borderLeft: `4px solid ${color}` } },
    dth("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: ".04em" } }, label),
    dth("div", { className: "mes-mono mes-display", style: { fontSize: val === null ? FZ(16) : FZ(22), fontWeight: 800, color: val === null ? COLORS.textFaint : color, marginTop: 3 } }, val === null ? "Chưa đủ dữ liệu" : val),
    why && dth("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 3 } }, why));
  const oeePanel = dth("div", { className: "mes-card", style: { padding: 16, marginBottom: 16, borderTop: `4px solid ${COLORS.green}` } },
    dth("div", { className: "mes-display", style: { fontSize: FZ(14), fontWeight: 700, marginBottom: 4 } }, "OEE & hiệu suất thiết bị"),
    dth("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginBottom: 12 } }, "Thời gian sản xuất kế hoạch = thời gian các lệnh máy đã chạy trong kỳ; thời gian vận hành = kế hoạch − tạm dừng. MTTR/MTBF chỉ tính trên dừng do sự cố thiết bị / mất điện; dừng có kế hoạch (chuyển đổi, bảo trì) và dừng chờ không bị coi là hỏng."),
    dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 10, marginBottom: 14 } },
      relTile("Availability", rel.availPct === null ? null : rel.availPct + "%", rel.availWhy, COLORS.green),
      relTile("Downtime", amgHm(an.total), `Sự cố ${amgHm((an.classes.find(c => c.key === "breakdown") || { ms: 0 }).ms)} · Kế hoạch ${amgHm((an.classes.find(c => c.key === "planned") || { ms: 0 }).ms)} · Chờ/khác ${amgHm((an.classes.find(c => c.key === "other") || { ms: 0 }).ms)}`, COLORS.red),
      relTile("MTTR", rel.mttrMs === null ? null : amgHm(rel.mttrMs), rel.mttrMs === null ? rel.mttrWhy : `${rel.closedBreakdowns} sự cố đã sửa xong`, COLORS.blue),
      relTile("MTBF", rel.mtbfMs === null ? null : amgHm(rel.mtbfMs), rel.mtbfMs === null ? rel.mtbfWhy : `${rel.breakdowns} sự cố trong kỳ`, COLORS.violet),
      relTile("OEE", null, rel.oeeWhy, COLORS.textFaint)),
    dth("div", { className: "mes-scroll-x" }, dth("table", { className: "mes-table", style: { minWidth: 860, fontSize: FZ(13) } },
      dth("thead", null, dth("tr", null, ["Máy", "Số lần dừng", "Sự cố", "Có kế hoạch", "Chờ / khác", "TG kế hoạch", "Availability", "MTTR", "MTBF", "Đánh giá"].map(h => dth("th", { key: h }, h)))),
      dth("tbody", null, mtable.length === 0 ? dth("tr", null, dth("td", { colSpan: 10, style: { color: COLORS.textFaint, textAlign: "center", padding: 16 } }, "Chưa có dữ liệu")) : mtable.map(r => dth("tr", { key: r.id, style: r.low ? { background: COLORS.red + "10" } : undefined },
        dth("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.id), dth("td", null, r.n), dth("td", null, r.breakdownMs ? amgHm(r.breakdownMs) : "—"), dth("td", null, r.plannedMs ? amgHm(r.plannedMs) : "—"), dth("td", null, r.otherMs ? amgHm(r.otherMs) : "—"),
        dth("td", null, r.schedMs ? amgHm(r.schedMs) : "—"), dth("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.availPct === null ? "Chưa đủ dữ liệu" : r.availPct + "%"),
        dth("td", null, r.mttrMs === null ? "—" : amgHm(r.mttrMs)), dth("td", null, r.mtbfMs === null ? "—" : amgHm(r.mtbfMs)),
        dth("td", null, r.low ? dth(Badge, { color: COLORS.red }, "Hiệu suất thấp") : r.availPct === null ? dth("span", { style: { color: COLORS.textFaint } }, "—") : dth(Badge, { color: COLORS.green }, "Đạt ngưỡng"))))))));

  /* ----- bảng dữ liệu ----- */
  const th = { whiteSpace: "nowrap" };
  const table = dth("div", { className: "mes-card", style: { marginBottom: 16, borderTop: `4px solid ${COLORS.violet}` } },
    dth("div", { style: { padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } }, dth("div", { className: "mes-display", style: { fontSize: FZ(14), fontWeight: 700 } }, `Bảng sự kiện dừng máy (${rows.length})`),
      dth("span", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, "Bấm vào dòng để xem chi tiết nguồn từ Kế hoạch sản xuất")),
    rows.length === 0 ? dth(EmptyState, { icon: History, title: all.length === 0 ? "Chưa có sự kiện dừng máy nào" : "Không có sự kiện phù hợp bộ lọc", hint: all.length === 0 ? "Khi một lệnh máy bấm \"Tạm dừng\" ở Kế hoạch sản xuất, sự kiện sẽ tự xuất hiện ở đây." : "Thử mở rộng khoảng thời gian hoặc bấm \"Xóa lọc\"." }) :
      dth("div", { className: "mes-scroll-x" }, dth("table", { className: "mes-table", style: { minWidth: 1100, fontSize: FZ(13) } },
        dth("thead", { style: { position: "sticky", top: 0 } }, dth("tr", null, ["Mã sự kiện", "Ngày", "Ca", "Máy", "Đơn hàng", "Sản phẩm / quy cách", "Bắt đầu", "Kết thúc", "Tổng dừng", "Nguyên nhân", "Loại", "Trạng thái"].map(h => dth("th", { key: h, style: th }, h)))),
        dth("tbody", null, rows.slice(0, limit).map(e => dth("tr", { key: e.id, onClick: () => setSel(e.id), style: { cursor: "pointer", background: e.state === "open" ? COLORS.red + "10" : undefined, opacity: e.state === "cancelled" || e.state === "removed" ? 0.55 : 1 } },
          dth("td", { className: "mes-mono", style: { fontSize: FZ(11) } }, e.id), dth("td", { style: th }, dtDate(e.date)), dth("td", { style: th }, e.shiftLabel + (e.shiftDerived ? "*" : "")),
          dth("td", { className: "mes-mono", style: { fontWeight: 700 } }, e.machineId), dth("td", null, e.customer || (e.source === "machine" ? "—" : e.orderLabel)), dth("td", null, e.spec || "—"),
          dth("td", { style: th }, amgFmtDateTime(dtIso(e.startMs))), dth("td", { style: th }, e.endMs ? amgFmtDateTime(dtIso(e.endMs)) : e.state === "open" ? "Đang dừng" : "—"),
          dth("td", { className: "mes-mono", style: { fontWeight: 800, color: e.state === "open" ? COLORS.red : undefined, whiteSpace: "nowrap" } }, e.durMs == null ? "—" : amgHm(e.durMs)),
          dth("td", { style: { minWidth: 180 } }, dth("div", null, e.reason || dth("i", { style: { color: COLORS.textFaint } }, "Chưa ghi nguyên nhân")), dth("div", { style: { marginTop: 2 } }, dth(Badge, { color: cat[e.cat.key] }, e.cat.label))),
          dth("td", null, dth(Badge, { color: cc[e.cat.cls] }, AMG_DT_CLASSES[e.cat.cls].short)), dth("td", null, dth(DtStateBadge, { e }))))))),
    rows.length > limit && dth("div", { style: { padding: 12, textAlign: "center" } }, dth(Button, { onClick: () => setLimit(limit + 200) }, `Xem thêm (${rows.length - limit} dòng còn lại)`)),
    rows.some(e => e.shiftDerived) && dth("div", { style: { padding: "0 14px 12px", fontSize: FZ(12), color: COLORS.textFaint } }, "* Ca suy ra theo giờ bắt đầu và cấu hình ca (dữ liệu Thẻ máy không lưu ca)."));

  const exportBar = dth("div", { className: "mes-card mes-no-print", style: { padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", borderTop: `4px solid ${COLORS.green}` } },
    dth(Field, { label: "Báo cáo" }, dth("select", { className: "mes-input", value: repKind, onChange: e => setRepKind(e.target.value), style: { minWidth: 240 } }, AMG_DT_REPORTS.map(r => dth("option", { key: r.key, value: r.key }, r.label)))),
    dth(Button, { variant: "primary", onClick: () => dtExportXlsx([repKind], an, rows, label), style: { background: `linear-gradient(135deg, ${COLORS.green}, #0F7A38)` } }, dth(Download, { size: 14 }), " Excel"),
    dth(Button, { onClick: () => dtExportPdf(repKind, an, rows, label, currentUser && (currentUser.fullName || currentUser.username)) }, dth(Download, { size: 14 }), " PDF (in)"),
    dth(Button, { onClick: () => dtExportXlsx(AMG_DT_REPORTS.map(r => r.key), an, rows, label) }, dth(Download, { size: 14 }), " Excel — tất cả báo cáo"),
    dth("span", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, "Báo cáo theo bộ lọc đang chọn. PDF: chọn \"Lưu thành PDF\" trong hộp thoại in."));

  /* ----- bộ lọc ----- */
  const sel0 = { className: "mes-input", style: { minWidth: 140 } };
  const filters = dth("div", { className: "mes-card mes-no-print", style: { padding: 14, marginBottom: 16, borderTop: `4px solid ${COLORS.blue}` } },
    dth("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" } },
      DT_PRESETS.map(p => dth(Button, { key: p.k, size: "sm", variant: preset === p.k ? "primary" : undefined, onClick: () => applyPreset(p.k) }, p.l)),
      dth("input", { type: "date", className: "mes-input", value: range.from, onChange: e => { setPreset("custom"); setRange(Object.assign({}, range, { from: e.target.value })); }, style: { width: 150 }, "aria-label": "Từ ngày" }), dth("span", null, "→"),
      dth("input", { type: "date", className: "mes-input", value: range.to, onChange: e => { setPreset("custom"); setRange(Object.assign({}, range, { to: e.target.value })); }, style: { width: 150 }, "aria-label": "Đến ngày" })),
    dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, alignItems: "end" } },
      dth(Field, { label: "Tìm kiếm" }, dth("input", { className: "mes-input", value: q, placeholder: "Máy, nguyên nhân, đơn, mã sự kiện…", onChange: e => setQ(e.target.value) })),
      dth(Field, { label: "Máy" }, dth("select", Object.assign({ value: fMachine, onChange: e => setFMachine(e.target.value) }, sel0), dth("option", { value: "all" }, "Tất cả máy"), machines.map(m => dth("option", { key: m.id, value: m.id }, m.id + " · " + (m.typeLabel || ""))))),
      dth(Field, { label: "Ca" }, dth("select", Object.assign({ value: fShift, onChange: e => setFShift(e.target.value) }, sel0), dth("option", { value: "all" }, "Tất cả ca"), dth("option", { value: "ngay" }, "Ca Ngày"), dth("option", { value: "dem" }, "Ca Đêm"))),
      dth(Field, { label: "Nhóm nguyên nhân" }, dth("select", Object.assign({ value: fCat, onChange: e => setFCat(e.target.value) }, sel0), dth("option", { value: "all" }, "Tất cả"), AMG_DT_CATS.map(c => dth("option", { key: c.key, value: c.key }, c.label)))),
      dth(Field, { label: "Loại dừng" }, dth("select", Object.assign({ value: fCls, onChange: e => setFCls(e.target.value) }, sel0), dth("option", { value: "all" }, "Tất cả"), Object.keys(AMG_DT_CLASSES).map(k => dth("option", { key: k, value: k }, AMG_DT_CLASSES[k].label)))),
      dth(Field, { label: "Đơn hàng" }, dth("select", Object.assign({ value: fOrder, onChange: e => setFOrder(e.target.value) }, sel0), dth("option", { value: "all" }, "Tất cả đơn"), orderOpts.map(o => dth("option", { key: o.id, value: o.id }, o.label)))),
      dth(Field, { label: "Nguồn" }, dth("select", Object.assign({ value: fSource, onChange: e => setFSource(e.target.value) }, sel0), dth("option", { value: "all" }, "Tất cả"), dth("option", { value: "plan" }, "Kế hoạch sản xuất"), dth("option", { value: "machine" }, "Thẻ máy (cũ)"))),
      dth("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, dth("label", { style: { fontSize: FZ(13), display: "flex", gap: 6, alignItems: "center" } }, dth("input", { type: "checkbox", checked: showInactive, onChange: e => setShowInactive(e.target.checked) }), "Hiện cả bản ghi đã hủy / xóa"), dth(Button, { size: "sm", onClick: clear }, "Xóa lọc"))));

  const banner = (ledgerError || flowError) && dth("div", { style: { padding: "8px 12px", borderRadius: 8, background: COLORS.amber + "1a", border: `1px solid ${COLORS.amber}66`, fontSize: FZ(13), marginBottom: 12 } }, flowError || ledgerError);

  return dth("div", { className: tv ? "dt-tv" : "", style: tv ? { "--amg-fs": 1.3 } : undefined },
    dth(SectionHeading, { eyebrow: `${planCount} lần tạm dừng từ Kế hoạch${machCount ? ` · ${machCount} bản ghi Thẻ máy cũ` : ""}`, title: "Theo dõi thời gian dừng máy", subtitle: "Dữ liệu đồng bộ tự động từ Kế hoạch sản xuất — không nhập lại tại đây", icon: History, iconColor: COLORS.red,
      action: dth("div", { className: "mes-no-print", style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, dth(Badge, { color: sync.c }, sync.t), dth(Button, { size: "sm", onClick: () => setTv(!tv) }, tv ? "Thoát chế độ TV" : "Chế độ TV")) }),
    banner,
    tv ? null : filters,
    tv ? dth("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, label) : null,
    dth("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 12, marginBottom: 16 } }, kpis),
    openStrip, alertBox, charts, tops,
    tv ? null : oeePanel, tv ? null : exportBar, tv ? null : table,
    selEvent && dth(DtDetailModal, { e: selEvent, orders, machines, isAdmin, onClose: () => setSel(null), onNavigateFocus, onEditLegacy: onUpdateLegacy, onDeleteLegacy }),
    settingsOpen && canSettings && dth(DtSettingsModal, { machines, settings, onClose: () => setSettingsOpen(false) }));
}
