/* ===================== ĐƠN HÀNG HOÀN THÀNH (v48) =====================
   Không có collection riêng: đơn hoàn thành vẫn nằm trong collection orders (order.status === "completed"); tab này chỉ là bộ lọc
   → không thể có bản ghi hoàn thành trùng, không xóa đơn/lệnh/sản lượng/BOM. Đơn hoàn thành giữ nguyên order.bom để tra cứu (chỉ đọc);
   mở lại đơn (quản lý + lý do) đưa đơn trở lại mọi danh sách đang hoạt động cùng toàn bộ dữ liệu cũ. */

// Gom toàn bộ dữ liệu lưu trữ của một đơn (dùng chung cho chi tiết, Excel, in báo cáo)
function amgBuildOrderArchive(order, runs, entries, extra, auditLog, nowMs) {
  const unit = amgOrderUnit(order);
  const rd = amgOrderReadiness(order);
  const route = amgOrderRoute(order);
  const myRuns = amgRunsOfOrder(runs, order.id).filter(r => r.productionStatus !== "cancelled").sort((a, b) => String(a.startedAt || a.assignedAt || "").localeCompare(String(b.startedAt || b.assignedAt || "")));
  const myEntries = (entries || []).filter(e => e.orderId === order.id).sort((a, b) => String(a.enteredAt || "").localeCompare(String(b.enteredAt || "")));
  const runRows = myRuns.map(r => { const t = amgRunTiming(r, nowMs, order); return { id: r.id, machine: r.machineId, stageKey: r.stageKey, stage: amgStageLabel(r.stageKey), operator: r.operator || "", shift: r.shift || "", start: r.startedAt || null, end: r.endedAt || null, elapsedMs: t.elapsedMs, pausedMs: t.pausedMs, netMs: t.netMs, planned: t.planned, produced: t.produced, rate: t.ratePerHour, unit: t.unit, status: amgRunStatusMeta(r.productionStatus).label }; });
  const stageRows = route.map(k => { const sc = (order.stageComplete || {})[k]; const rr = runRows.filter(r => r.stageKey === k); return { key: k, label: amgStageLabel(k), done: amgStageDone(order, k), unit, completedAt: sc ? sc.at : null, by: sc ? sc.by || "" : "", short: !!(sc && sc.short), reason: sc ? sc.reason || "" : "", netMs: rr.reduce((s, r) => s + r.netMs, 0), runs: rr.length }; });
  const bom = (order.bom || []).map(l => ({ material: l.material, norm: Number(l.norm) || 0, unit: l.unit || "", total: rd.qty !== null ? (Number(l.norm) || 0) * rd.qty : null, note: l.note || "" }));
  const lots = (extra && extra.lots) || [], moves = (extra && extra.stockMoves) || [];
  const byLot = {};
  moves.filter(m => m.type === "xuat" && m.orderId === order.id).forEach(m => { byLot[m.lotId] = (byLot[m.lotId] || 0) + (Number(m.qty) || 0); });
  const issued = Object.keys(byLot).map(id => { const l = lots.find(x => x.id === id) || {}; return { lot: l.lotNo || id, material: l.material || "", qty: byLot[id], unit: l.unit || "" }; });
  const sp = amgOrderProductionSpan(order, runs);
  const sums = amgSumTimings(myRuns, nowMs, order);
  return { unit, rd, route, runRows, stageRows, entries: myEntries, bom, issued, span: sp, sums,
    prodText: amgDurationText(sp.from, order.completedAt || sp.to), netText: amgHm(sums.netMs),
    machines: [...new Set(runRows.map(r => r.machine))] };
}
function amgCompletedStatusText(o) { return o.completedShort ? "Hoàn thành thiếu SL" : "Hoàn thành đủ SL"; }

// Báo cáo in một đơn hoàn thành
function amgOrderReportHtml(order, A) {
  const e = amgEsc, f = v => fmtNum(v);
  const kv = (l, v) => `<div><b>${e(l)}</b>${e(v)}</div>`;
  const tbl = (head, rows) => `<table><thead><tr>${head.map(h => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${e(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}">Không có dữ liệu</td></tr>`}</tbody></table>`;
  return `<h1>BÁO CÁO ĐƠN HÀNG HOÀN THÀNH — ${e(order.id)}</h1><div>AOMAGA MES · In lúc ${e(amgFmtDateTime(new Date().toISOString()))}</div>
  <div class="kv">${kv("Khách hàng", order.customer || "—")}${kv("Nguyên liệu", order.materialCode || "—")}${kv("Quy cách", order.spec || "—")}${kv("Số lượng đặt", `${f(order.quantity)} ${A.unit}`)}${kv("Sản lượng thành phẩm", `${f(A.rd.finished)} ${A.unit}`)}${kv("Trạng thái", amgCompletedStatusText(order))}${kv("Ngày nhận", amgFmtDate(order.orderDate))}${kv("Ngày giao", order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—")}${kv("Ngày hoàn thành", amgFmtDateTime(order.completedAt))}${kv("Người xác nhận", `${order.completedBy || "—"} (${order.completionMode === "manual" ? "thủ công" : "tự động"})`)}${kv("Thời gian sản xuất (từ bắt đầu đến hoàn thành)", A.prodText)}${kv("Tổng thời gian máy chạy thực tế", A.netText)}</div>
  ${order.completedShort ? `<div class="warn">Hoàn thành thiếu số lượng. Lý do: ${e(order.completionNote || "—")}</div>` : ""}
  <h2>Quy trình đã thực hiện</h2>${tbl(["Công đoạn", `Sản lượng (${A.unit})`, "Hoàn thành lúc", "Người xác nhận", "Ghi chú"], A.stageRows.map(s => [s.label, f(s.done), s.completedAt ? amgFmtDateTime(s.completedAt) : "—", s.by || "—", s.short ? "Thiếu SL: " + s.reason : ""]))}
  <h2>Lịch sử lệnh máy</h2>${tbl(["Máy", "Công đoạn", "Người vận hành", "Ca", "Bắt đầu", "Kết thúc", "Tổng chạy", "Tạm dừng", "Thực tế", "Đã chạy", "Năng suất/giờ"], A.runRows.map(r => [r.machine, r.stage, r.operator, r.shift, r.start ? amgFmtDateTime(r.start) : "—", r.end ? amgFmtDateTime(r.end) : "—", amgHm(r.elapsedMs), amgHm(r.pausedMs), amgHm(r.netMs), `${f(r.produced)} ${r.unit}`, r.rate === null ? "—" : `${f(r.rate)} ${r.unit}/giờ`]))}
  <h2>Lịch sử sản lượng</h2>${tbl(["Thời gian", "Công đoạn", "Máy", "Sản lượng", "Người ghi", "Ghi chú"], A.entries.filter(x => !x.voided).map(x => [amgFmtDateTime(x.enteredAt), amgStageLabel(x.stageKey), x.machineId, `${f(x.qty)} ${x.unit || A.unit}`, x.enteredBy || "", x.note || ""]))}
  <h2>BOM và định mức</h2>${tbl(["Vật tư", "Định mức", "Nhu cầu theo SL đặt", "Ghi chú"], A.bom.map(b => [b.material, `${f(b.norm)} ${b.unit}`, b.total === null ? "—" : `${f(b.total)} ${b.unit}`, b.note]))}
  <h2>Vật tư đã xuất cho đơn</h2>${tbl(["Lô", "Vật tư", "Số lượng"], A.issued.map(i => [i.lot, i.material, `${f(i.qty)} ${i.unit}`]))}
  <div class="sig"><div>Người lập<br><br><br></div><div>Quản đốc xác nhận<br><br><br></div><div>Giám đốc<br><br><br></div></div>`;
}

function CompleteOrderModal({ order, runs, onClose, onDone }) {
  const cs = amgOrderCompletionState(order, runs);
  const rd = cs.rd, unit = amgOrderUnit(order);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const short = cs.short;
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try { const r = await amgFlowCompleteOrder({ orderId: order.id, reason, knownRunIds: cs.open.map(x => x.id) }); onDone(r.duplicate ? "Đơn đã được xác nhận trước đó" : `Đơn ${order.id} đã hoàn thành và chuyển sang tab Đơn hàng hoàn thành`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `HOÀN THÀNH ĐƠN ${order.id}`, onClose, width: 580 },
    rkh(AmgNotice, { tone: "info" }, "Đây là bước xác nhận cuối cùng (khác với kết thúc lệnh máy và hoàn thành công đoạn). Sau khi xác nhận, đơn rời mọi danh sách đang hoạt động; BOM, lệnh máy và sản lượng được giữ nguyên để tra cứu."),
    amgSummaryRows(order, [["Thành phẩm", `${fmtNum(rd.finished)} / ${fmtNum(rd.qty)} ${unit}`], ["Quy trình", rd.route.map(amgStageLabel).join(" → ")]]),
    cs.legacy && rkh(AmgNotice, { tone: "info" }, "Đơn cũ chưa xác nhận quy trình: xác nhận theo sản lượng thành phẩm suy từ quy cách."),
    cs.blockers.map((b, i) => rkh(AmgNotice, { key: i, tone: "err" }, b)),
    short && cs.blockers.length === 0 && rkh(AmgNotice, { tone: "warn" }, `Thành phẩm ${fmtNum(rd.finished)} chưa đủ số lượng đặt ${fmtNum(rd.qty)} ${unit}. Cần quyền quản lý và ghi lý do rõ ràng (≥ 5 ký tự) để hoàn thành thiếu số lượng.`),
    short && rkh(AmgFieldBox, { label: "Lý do hoàn thành thiếu số lượng (bắt buộc)" }, rkh("input", { className: "mes-input", value: reason, onChange: e => setReason(e.target.value), style: { width: "100%" } })),
    !short && rkh(AmgFieldBox, { label: "Ghi chú (không bắt buộc)" }, rkh("input", { className: "mes-input", value: reason, onChange: e => setReason(e.target.value), style: { width: "100%" } })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Để sau"),
      rkh(Button, { variant: "primary", disabled: busy || !cs.canConfirm || (short && reason.trim().length < 5), onClick: submit }, busy ? "Đang lưu..." : "HOÀN THÀNH ĐƠN")));
}

function ReopenOrderModal({ order, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try { await amgFlowReopenOrder({ orderId: order.id, reason }); onDone(`Đã mở lại đơn ${order.id} — đơn, BOM và dữ liệu liên quan đã trở lại danh sách đang hoạt động`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Mở lại đơn ${order.id}`, onClose, width: 520 },
    rkh(AmgNotice, { tone: "warn" }, "Đơn quay lại các danh sách đang hoạt động (Đơn hàng, BOM, kế hoạch), công đoạn cuối được mở để tiếp tục. BOM, lệnh máy, sản lượng và lịch sử không bị đổi. Việc mở lại được ghi nhật ký kèm tên người thực hiện và lý do."),
    rkh(AmgFieldBox, { label: "Lý do mở lại (bắt buộc)" }, rkh("input", { className: "mes-input", autoFocus: true, value: reason, onChange: e => setReason(e.target.value), style: { width: "100%" } })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Hủy"), rkh(Button, { variant: "primary", disabled: busy || reason.trim().length < 5, onClick: submit }, busy ? "Đang lưu..." : "Mở lại đơn")));
}

function CompletedDetailModal({ order, runs, entries, auditLog, extra, scrap, onClose }) {
  const [tab, setTab] = useState("stages");
  const A = useMemo(() => amgBuildOrderArchive(order, runs, entries, extra, auditLog, Date.now()), [order, runs, entries, extra, auditLog]);
  const u = A.unit;
  const logs = (auditLog || []).filter(a => a.targetId === order.id && a.type !== "production_entry").sort((a, b) => String(amgFmtDateTime(a.ts)).localeCompare(String(amgFmtDateTime(b.ts))));
  const legacyEntries = (auditLog || []).filter(a => a.type === "production_entry" && a.targetId === order.id && !a.runId);
  const insp = ((extra && extra.inspections) || []).filter(i => i.orderId === order.id);
  const ncr = ((extra && extra.ncr) || []).filter(n => n.orderId === order.id);
  const scrapMatch = (scrap || []).filter(s => s.customer === order.customer && s.spec === order.spec);
  const row = (a, b) => rkh("div", { key: a + String(b), style: { padding: "7px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13), display: "flex", justifyContent: "space-between", gap: 12 } }, rkh("span", { style: { color: COLORS.textDim } }, a), rkh("b", { style: { textAlign: "right" } }, b));
  const empty = t => rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, padding: "8px 0" } }, t);
  const th = hs => rkh("thead", null, rkh("tr", null, hs.map(h => rkh("th", { key: h }, h))));
  const tabs = [["stages", "Công đoạn"], ["runs", "Lịch sử máy"], ["log", "Lịch sử sản lượng"], ["bom", "BOM & định mức"], ["quality", "Chất lượng"], ["ng", "NG / phế"], ["history", "Lịch sử đơn"]];
  const exportDetail = () => amgExportExcelMulti(`don-${order.id}`, [
    { name: "Thông tin", columns: [{ label: "Chỉ tiêu", key: "k" }, { label: "Giá trị", key: "v" }], rows: [["Mã đơn", order.id], ["Khách hàng", order.customer || ""], ["Nguyên liệu", order.materialCode || ""], ["Quy cách", order.spec || ""], ["Đơn vị", u], ["Số lượng đặt", order.quantity], ["Sản lượng thành phẩm", A.rd.finished], ["Ngày nhận", amgFmtDate(order.orderDate)], ["Ngày giao", order.deliveryDate ? amgFmtDate(order.deliveryDate) : ""], ["Ngày hoàn thành", amgFmtDateTime(order.completedAt)], ["Người xác nhận", order.completedBy || ""], ["Chế độ", order.completionMode || ""], ["Trạng thái", amgCompletedStatusText(order)], ["Lý do/ghi chú", order.completionNote || ""], ["Thời gian sản xuất", A.prodText], ["Thời gian máy chạy thực tế", A.netText]].map(([k, v]) => ({ k, v })) },
    { name: "Công đoạn", columns: [{ label: "Công đoạn", key: "label" }, { label: "Sản lượng (" + u + ")", key: "done" }, { label: "Hoàn thành lúc", export: s => s.completedAt ? amgFmtDateTime(s.completedAt) : "" }, { label: "Người xác nhận", key: "by" }, { label: "Thiếu SL", export: s => s.short ? "Có" : "" }, { label: "Lý do", key: "reason" }], rows: A.stageRows },
    { name: "Lệnh máy", columns: [{ label: "Lệnh", key: "id" }, { label: "Máy", key: "machine" }, { label: "Công đoạn", key: "stage" }, { label: "Người vận hành", key: "operator" }, { label: "Ca", key: "shift" }, { label: "Bắt đầu", export: r => r.start ? amgFmtDateTime(r.start) : "" }, { label: "Kết thúc", export: r => r.end ? amgFmtDateTime(r.end) : "" }, { label: "Tổng chạy (phút)", export: r => Math.round(r.elapsedMs / 60000) }, { label: "Tạm dừng (phút)", export: r => Math.round(r.pausedMs / 60000) }, { label: "Thực tế (phút)", export: r => Math.round(r.netMs / 60000) }, { label: "Kế hoạch", key: "planned" }, { label: "Đã chạy", key: "produced" }, { label: "Đơn vị", key: "unit" }, { label: "Năng suất/giờ", export: r => r.rate === null ? "" : r.rate }], rows: A.runRows },
    { name: "Sản lượng", columns: [{ label: "Thời gian", export: e => amgFmtDateTime(e.enteredAt) }, { label: "Công đoạn", export: e => amgStageLabel(e.stageKey) }, { label: "Máy", key: "machineId" }, { label: "Sản lượng", key: "qty" }, { label: "Đơn vị", export: e => e.unit || u }, { label: "NG", export: e => e.ng || "" }, { label: "Người ghi", key: "enteredBy" }, { label: "Đã hủy", export: e => e.voided ? "Có" : "" }, { label: "Ghi chú", key: "note" }], rows: A.entries },
    { name: "BOM", columns: [{ label: "Vật tư", key: "material" }, { label: "Định mức", key: "norm" }, { label: "Đơn vị", key: "unit" }, { label: "Nhu cầu theo SL đặt", export: b => b.total === null ? "" : b.total }, { label: "Ghi chú", key: "note" }], rows: A.bom },
    { name: "Vật tư xuất", columns: [{ label: "Lô", key: "lot" }, { label: "Vật tư", key: "material" }, { label: "Số lượng", key: "qty" }, { label: "Đơn vị", key: "unit" }], rows: A.issued }]);
  return rkh(Modal, { title: `${order.id} · ${order.customer || ""} · ${order.spec || ""}`, onClose, width: 960 },
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 8, padding: 12, borderRadius: 10, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, marginBottom: 12 } },
      [["Nguyên liệu", order.materialCode || "—"], ["Số lượng đặt", `${fmtNum(order.quantity)} ${u}`], ["Thành phẩm", `${fmtNum(A.rd.finished)} ${u}`], ["Ngày nhận · giao", `${amgFmtDate(order.orderDate)} · ${order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—"}`], ["Hoàn thành lúc", amgFmtDateTime(order.completedAt)], ["Thời gian sản xuất", A.prodText], ["Máy chạy thực tế", A.netText], ["Xác nhận bởi", `${order.completedBy || "—"}${order.completionMode === "manual" ? " (thủ công)" : " (tự động)"}`], ["Quy trình", A.route.map(amgStageLabel).join(" → ")]]
        .map(([a, b]) => rkh("div", { key: a }, rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, fontWeight: 600 } }, a), rkh("div", { style: { fontSize: FZ(14), fontWeight: 700 } }, b)))),
    order.completedShort && rkh(AmgNotice, { tone: "warn" }, "Hoàn thành thiếu số lượng. Lý do: " + (order.completionNote || "—")),
    rkh("div", { className: "mes-no-print", style: { display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 8 } },
      rkh(Button, { size: "sm", onClick: exportDetail }, rkh(Download, { size: 13 }), " Xuất Excel đơn"), rkh(Button, { size: "sm", onClick: () => amgPrintHtml("Báo cáo đơn " + order.id, amgOrderReportHtml(order, A)) }, "In báo cáo")),
    rkh(DetailTabs, { tabs: tabs.map(([key, label]) => ({ key, label })), active: tab, onChange: setTab }),
    tab === "stages" && rkh("div", null, A.stageRows.map((s, i) => { const c = amgStageColor(s.key); return rkh("div", { key: s.key, style: { marginBottom: 12, borderLeft: `5px solid ${c}`, paddingLeft: 10 } },
      rkh("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 } }, rkh("b", { style: { color: c } }, `${i + 1}. ${s.label}`), rkh("span", { className: "mes-mono", style: { fontSize: FZ(13) } }, `Sản lượng: ${fmtNum(s.done)} ${u} · ${s.runs} lệnh · máy chạy ${amgHm(s.netMs)}`)),
      s.completedAt ? rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, `Hoàn thành ${amgFmtDateTime(s.completedAt)} bởi ${s.by || "—"}${s.short ? " · thiếu SL: " + s.reason : ""}`) : rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, "Không có bản ghi xác nhận công đoạn (đơn cũ)")); })),
    tab === "runs" && (A.runRows.length === 0 ? empty("Đơn không có lệnh máy (số liệu nhập trực tiếp vào đơn).") : rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 960, fontSize: FZ(13) } }, th(["Máy", "Công đoạn", "Người VH · ca", "Bắt đầu", "Kết thúc", "Tổng chạy", "Tạm dừng", "Thực tế", "Kế hoạch", "Đã chạy", "Năng suất/giờ"]),
      rkh("tbody", null, A.runRows.map(r => rkh("tr", { key: r.id }, rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.machine), rkh("td", null, r.stage), rkh("td", null, `${r.operator || "—"} · ${r.shift || "—"}`), rkh("td", null, r.start ? amgFmtDateTime(r.start) : "—"), rkh("td", null, r.end ? amgFmtDateTime(r.end) : "—"), rkh("td", { className: "mes-mono" }, amgHm(r.elapsedMs)), rkh("td", { className: "mes-mono" }, amgHm(r.pausedMs)), rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, amgHm(r.netMs)), rkh("td", { className: "mes-mono" }, `${fmtNum(r.planned)} ${r.unit}`), rkh("td", { className: "mes-mono" }, `${fmtNum(r.produced)} ${r.unit}`), rkh("td", { className: "mes-mono" }, r.rate === null ? "—" : `${fmtNum(r.rate)} ${r.unit}/giờ`))))))),
    tab === "log" && (A.entries.length + legacyEntries.length === 0 ? empty("Chưa có lượt ghi sản lượng.") : rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 660, fontSize: FZ(13) } }, th(["Thời gian", "Công đoạn", "Máy", "Sản lượng", "Người vận hành", "Người ghi", "Ghi chú"]),
      rkh("tbody", null,
        A.entries.map(e => rkh("tr", { key: e.id, style: { opacity: e.voided ? 0.5 : 1, textDecoration: e.voided ? "line-through" : "none" } }, rkh("td", null, amgFmtDateTime(e.enteredAt)), rkh("td", null, amgStageLabel(e.stageKey)), rkh("td", { className: "mes-mono" }, e.machineId), rkh("td", { className: "mes-mono" }, `${fmtNum(e.qty)} ${e.unit || u}`), rkh("td", null, e.operator || "—"), rkh("td", null, e.enteredBy || "—"), rkh("td", null, e.note || ""))),
        legacyEntries.map(e => rkh("tr", { key: e.id }, rkh("td", null, amgFmtDate(e.date)), rkh("td", null, amgStageLabel(e.stageKey)), rkh("td", null, "—"), rkh("td", { className: "mes-mono" }, `${fmtNum(e.qty)} ${u}`), rkh("td", null, "—"), rkh("td", null, e.user || "—"), rkh("td", null, e.note || ""))))))),
    tab === "bom" && rkh("div", null,
      rkh("div", { style: { fontSize: FZ(13), padding: "8px 10px", borderRadius: 8, marginBottom: 8, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, color: COLORS.textDim } }, "🔒 Chỉ đọc — BOM và định mức được bảo toàn nguyên vẹn khi đơn hoàn thành. Muốn sửa phải mở lại đơn."),
      A.bom.length === 0 ? empty("Đơn không khai báo định mức vật tư.") : rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { fontSize: FZ(13) } }, th(["Vật tư", "Định mức", "Nhu cầu theo SL đặt", "Ghi chú"]),
        rkh("tbody", null, A.bom.map((b, i) => rkh("tr", { key: i }, rkh("td", null, b.material), rkh("td", { className: "mes-mono" }, `${fmtNum(b.norm)} ${b.unit}`), rkh("td", { className: "mes-mono" }, b.total === null ? "—" : `${fmtNum(b.total)} ${b.unit}`), rkh("td", null, b.note)))))),
      rkh("div", { style: { margin: "12px 0 4px", fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim } }, "LỊCH SỬ SỬ DỤNG VẬT TƯ (đã xuất cho đơn)"),
      A.issued.length === 0 ? empty("Chưa có phiếu xuất vật tư gắn với đơn này.") : A.issued.map(i => row(`${i.lot} – ${i.material}`, `${fmtNum(i.qty)} ${i.unit}`))),
    tab === "quality" && (insp.length + ncr.length === 0 ? empty("Chưa có phiếu kiểm tra hoặc phiếu NG gắn với đơn này.") : rkh("div", null, insp.map(i => row(`${i.id} · ${i.type || ""} · ${amgFmtDate(i.date)}`, i.result === "dat" ? "Đạt" : "NG")), ncr.map(n => row(`${n.id} · ${n.defect || ""}`, (typeof NCR_STATUS !== "undefined" && NCR_STATUS[n.status] ? NCR_STATUS[n.status].label : n.status))))),
    tab === "ng" && rkh("div", null,
      ncr.length === 0 ? empty("Không có phiếu NG gắn với đơn.") : ncr.map(n => row(`${n.id} · ${n.defect || ""} · máy ${n.machineId || "—"}`, amgFmtDate(n.openedDate))),
      A.entries.filter(e => Number(e.ng) > 0).map(e => row(`NG tại máy ${e.machineId} · ${amgStageLabel(e.stageKey)} · ${amgFmtDateTime(e.enteredAt)}`, fmtNum(e.ng))),
      scrapMatch.length > 0 && rkh("div", { style: { marginTop: 10, fontSize: FZ(12), color: COLORS.textFaint } }, "Phế liệu cùng khách hàng & quy cách (đối chiếu gần đúng, phiếu phế không gắn mã đơn):"),
      scrapMatch.map(s => row(`${amgFmtDate(s.date)} · ${amgStageLabel(s.stage)} · ${s.reason || ""}`, `${fmtNum(s.qty)} ${s.unit || ""}`))),
    tab === "history" && rkh("div", null,
      (order.statusHistory || []).map((h, i) => row(`${amgFmtDateTime(h.at)} · ${h.action === "complete" ? "xác nhận hoàn thành" : h.action === "reopen" ? "mở lại" : "đổi trạng thái"} · ${h.by || ""}`, h.reason || (h.action === "complete" ? (h.short ? "thiếu SL" : "đủ SL") : ""))),
      logs.length === 0 && !(order.statusHistory || []).length ? empty("Chưa có nhật ký.") : logs.map(a => row(`${a.user || ""} · ${amgFmtDateTime(a.ts)}`, a.detail))),
    rkh("div", { className: "mes-no-print", style: { marginTop: 12, display: "flex", justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng")));
}

function CompletedOrdersPage({ orders, runs, entries, auditLog, extra, scrap, currentUser }) {
  const [q, setQ] = useState("");
  const [cust, setCust] = useState("all");
  const [stage, setStage] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const manager = amgFlowCan(currentUser, "manager");
  const done = useMemo(() => orders.filter(o => o.status === "completed").sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || ""))), [orders]);
  // Chờ xác nhận: đủ công đoạn bắt buộc (hoặc đơn cũ đã đủ SL) nhưng CHƯA bấm HOÀN THÀNH ĐƠN — kèm lý do nếu còn lệnh mở
  const pending = useMemo(() => orders.filter(o => o.status !== "completed").map(o => ({ o, cs: amgOrderCompletionState(o, runs) })).filter(x => x.cs.awaiting), [orders, runs]);
  const customers = [...new Set(done.map(o => o.customer || "Chưa rõ"))].sort();
  const t = q.trim().toLowerCase();
  const list = done.filter(o => {
    if (cust !== "all" && (o.customer || "Chưa rõ") !== cust) return false;
    if (stage !== "all" && amgOrderRoute(o).indexOf(stage) < 0) return false;
    const d = String(o.completedAt || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return !t || [o.id, o.customer, o.spec, o.materialCode, o.completedBy].some(v => String(v || "").toLowerCase().includes(t));
  });
  // KHÔNG cộng lẫn kg và m: tổng theo từng đơn vị
  const sumBy = fn => { const m = {}; list.forEach(o => { const u = amgOrderUnit(o); m[u] = (m[u] || 0) + fn(o); }); return Object.keys(m).sort().map(u => `${fmtNum(m[u])} ${u}`).join(" · ") || "—"; };
  const spans = list.map(o => { const sp = amgOrderProductionSpan(o, runs); const a = new Date(sp.from).getTime(), b = new Date(o.completedAt || sp.to).getTime(); return Number.isNaN(a) || Number.isNaN(b) ? null : b - a; }).filter(x => x !== null && x >= 0);
  const avgMs = spans.length ? spans.reduce((s, x) => s + x, 0) / spans.length : null;
  const cols = [
    { key: "id", label: "Mã đơn" }, { key: "customer", label: "Khách hàng" }, { key: "materialCode", label: "Nguyên liệu" }, { key: "spec", label: "Quy cách" },
    { key: "route", label: "Quy trình đã thực hiện", export: o => amgOrderRoute(o).map(amgStageLabel).join(" → ") },
    { key: "quantity", label: "Số lượng đặt" }, { key: "unit", label: "Đơn vị", export: o => amgOrderUnit(o) }, { key: "fin", label: "Sản lượng thành phẩm", export: o => amgOrderReadiness(o).finished },
    { key: "orderDate", label: "Ngày nhận", export: o => amgFmtDate(o.orderDate) }, { key: "deliveryDate", label: "Ngày giao", export: o => o.deliveryDate ? amgFmtDate(o.deliveryDate) : "" },
    { key: "completedAt", label: "Ngày hoàn thành", export: o => amgFmtDateTime(o.completedAt) },
    { key: "dur", label: "Thời gian sản xuất", export: o => { const sp = amgOrderProductionSpan(o, runs); return amgDurationText(sp.from, o.completedAt || sp.to); } },
    { key: "net", label: "Máy chạy thực tế (phút)", export: o => Math.round(amgSumTimings(amgRunsOfOrder(runs, o.id), Date.now(), o).netMs / 60000) },
    { key: "by", label: "Người xác nhận", export: o => o.completedBy || "" }, { key: "mode", label: "Chế độ", export: o => o.completionMode === "manual" ? "Thủ công" : "Tự động" },
    { key: "st", label: "Trạng thái", export: o => amgCompletedStatusText(o) }, { key: "note", label: "Lý do/ghi chú", export: o => o.completionNote || "" },
    { key: "machines", label: "Máy đã chạy", export: o => [...new Set(amgRunsOfOrder(runs, o.id).map(r => r.machineId))].join(", ") }
  ];
  const printList = () => { const e = amgEsc; amgPrintHtml("Danh sách đơn hàng hoàn thành", `<h1>DANH SÁCH ĐƠN HÀNG HOÀN THÀNH</h1><div>${e(list.length)} đơn · tổng đặt ${e(sumBy(o => Number(o.quantity) || 0))} · thành phẩm ${e(sumBy(o => amgOrderReadiness(o).finished))}</div><table><thead><tr>${["Mã đơn", "Khách hàng", "Nguyên liệu", "Quy cách", "Quy trình", "SL đặt", "Thành phẩm", "Hoàn thành", "Người xác nhận", "Trạng thái"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${list.map(o => `<tr><td>${e(o.id)}</td><td>${e(o.customer)}</td><td>${e(o.materialCode)}</td><td>${e(o.spec)}</td><td>${e(amgOrderRoute(o).map(amgStageLabel).join(" → "))}</td><td>${e(fmtNum(o.quantity))} ${amgOrderUnit(o)}</td><td>${e(fmtNum(amgOrderReadiness(o).finished))} ${amgOrderUnit(o)}</td><td>${e(amgFmtDateTime(o.completedAt))}</td><td>${e(o.completedBy)}</td><td>${e(amgCompletedStatusText(o))}</td></tr>`).join("")}</tbody></table>`); };
  const ordObj = modal && orders.find(o => o.id === modal.orderId);
  const note = m => { setToast(m); setTimeout(() => setToast(""), 6000); };
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${done.length} đơn đã hoàn thành · kho lưu trữ`, title: "Đơn hàng hoàn thành", icon: CheckCircle2, iconColor: COLORS.violet,
      action: rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, rkh(Button, { disabled: list.length === 0, onClick: printList }, "In danh sách"), rkh(Button, { disabled: list.length === 0, onClick: () => amgExportExcel("don-hang-hoan-thanh", cols, list, "Đơn hoàn thành") }, rkh(Download, { size: 14 }), " Xuất Excel")) }),
    rkh(GuideBox, { steps: ["Đơn chỉ xuất hiện ở đây sau khi người có quyền bấm HOÀN THÀNH ĐƠN (sau khi xong công đoạn cuối, không còn lệnh máy mở). Đơn rời hẳn tab Đơn hàng, BOM, kế hoạch và máy.", "Đơn đủ công đoạn nhưng chưa xác nhận nằm ở khung Chờ xác nhận bên dưới; thiếu số lượng phải có lý do và quyền quản lý.", "Bấm vào đơn để xem công đoạn, lịch sử máy, lịch sử sản lượng, BOM & định mức (chỉ đọc), chất lượng, NG. Có Xuất Excel và In báo cáo.", "Cần sản xuất thêm: Mở lại đơn (quản lý, bắt buộc ghi lý do). Dữ liệu và BOM cũ được giữ nguyên, đơn quay lại danh sách hoạt động."] }),
    toast && rkh("div", { className: "mes-fade-in", style: { position: "fixed", top: 70, right: 24, zIndex: 4000, maxWidth: 420, padding: "12px 16px", borderRadius: 10, fontWeight: 600, color: "#fff", background: COLORS.green, boxShadow: "0 6px 20px rgba(0,0,0,.3)" } }, toast),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10, marginBottom: 14 } },
      amgKpiTile("Đơn hoàn thành", list.length, COLORS.violet), amgKpiTile("Tổng số lượng đặt", sumBy(o => Number(o.quantity) || 0), COLORS.blue), amgKpiTile("Tổng thành phẩm", sumBy(o => amgOrderReadiness(o).finished), COLORS.green),
      amgKpiTile("Thời gian SX trung bình", avgMs === null ? "—" : amgDurationText(0, avgMs), COLORS.amber), amgKpiTile("Chờ xác nhận", pending.length, COLORS.orange)),
    pending.length > 0 && rkh("div", { className: "mes-card", style: { padding: 12, marginBottom: 14, border: `1px solid ${COLORS.orange}`, borderLeft: `6px solid ${COLORS.orange}` } },
      rkh("div", { style: { fontWeight: 800, marginBottom: 6 } }, `Chờ xác nhận hoàn thành đơn (${pending.length})`),
      rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim, marginBottom: 8 } }, "Đã xong công đoạn cuối nhưng chưa bấm HOÀN THÀNH ĐƠN. Đơn không tự chuyển; còn lệnh máy mở thì phải kết thúc lệnh trước."),
      pending.slice(0, 30).map(({ o, cs }) => rkh("div", { key: o.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${COLORS.border}`, fontSize: FZ(13), flexWrap: "wrap" } },
        rkh("span", null, rkh("b", { className: "mes-mono" }, o.id), ` · ${o.customer || ""} · ${o.spec || ""} · thành phẩm ${fmtNum(cs.rd.finished)} / ${fmtNum(cs.rd.qty)} ${amgOrderUnit(o)}`, !amgIsFlowOrder(o) && rkh("span", { style: { color: COLORS.textFaint } }, " · đơn cũ"), cs.open.length > 0 && rkh("span", { style: { color: COLORS.red } }, ` · còn lệnh mở: ${cs.open.map(r => r.machineId).join(", ")}`)),
        manager ? rkh(Button, { size: "sm", variant: "primary", onClick: () => setModal({ kind: "complete", orderId: o.id }) }, "HOÀN THÀNH ĐƠN") : rkh("span", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, "Chờ Quản đốc/Admin")))),
    rkh("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 } },
      rkh("div", { style: { position: "relative", flex: 1, minWidth: 220 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }), rkh("input", { className: "mes-input", style: { paddingLeft: 30 }, placeholder: "Tìm mã đơn, khách hàng, quy cách, nguyên liệu, người xác nhận...", value: q, onChange: e => setQ(e.target.value) })),
      rkh("select", { className: "mes-input", style: { width: "auto", minWidth: 170 }, value: cust, onChange: e => setCust(e.target.value) }, rkh("option", { value: "all" }, "Mọi khách hàng"), customers.map(c => rkh("option", { key: c, value: c }, c))),
      rkh("select", { className: "mes-input", style: { width: "auto", minWidth: 160 }, value: stage, onChange: e => setStage(e.target.value) }, rkh("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => rkh("option", { key: s.key, value: s.key }, s.label))),
      rkh("input", { className: "mes-input", type: "date", style: { width: "auto" }, value: from, onChange: e => setFrom(e.target.value), title: "Hoàn thành từ ngày" }),
      rkh("input", { className: "mes-input", type: "date", style: { width: "auto" }, value: to, onChange: e => setTo(e.target.value), title: "Hoàn thành đến ngày" })),
    rkh("div", { className: "mes-card" }, list.length === 0 ? rkh(EmptyState, { title: done.length === 0 ? "Chưa có đơn hoàn thành" : "Không có đơn phù hợp bộ lọc", hint: done.length === 0 ? "Đơn sẽ xuất hiện khi được xác nhận HOÀN THÀNH ĐƠN." : undefined }) :
      rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table", style: { width: "100%" } },
        rkh("thead", null, rkh("tr", null, ["STT", "Mã đơn", "Khách hàng", "Nguyên liệu", "Quy cách", "Quy trình", "SL đặt", "Thành phẩm", "Ngày nhận", "Ngày giao", "Hoàn thành", "Thời gian SX", "Người xác nhận", "Trạng thái", "Thao tác"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, list.map((o, i) => { const rd = amgOrderReadiness(o), sp = amgOrderProductionSpan(o, runs), un = amgOrderUnit(o); return rkh("tr", { key: o.id, style: { cursor: "pointer" }, onClick: () => setModal({ kind: "detail", orderId: o.id }) },
          rkh("td", { className: "mes-mono", style: { color: COLORS.textFaint } }, i + 1), rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, o.id), rkh("td", { style: { fontWeight: 600 } }, o.customer || "—"), rkh("td", null, o.materialCode || "—"), rkh("td", { className: "mes-mono" }, o.spec || "—"),
          rkh("td", { style: { fontSize: FZ(12) } }, amgOrderRoute(o).map(amgStageLabel).join(" → ")),
          rkh("td", { className: "mes-mono" }, fmtNum(o.quantity), rkh("span", { className: "amg-unit" }, un)), rkh("td", { className: "mes-mono", style: { color: COLORS.green, fontWeight: 700 } }, fmtNum(rd.finished), rkh("span", { className: "amg-unit" }, un)),
          rkh("td", null, amgFmtDate(o.orderDate)), rkh("td", null, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—"), rkh("td", null, amgFmtDateTime(o.completedAt)), rkh("td", null, amgDurationText(sp.from, o.completedAt || sp.to)), rkh("td", null, o.completedBy || "—"),
          rkh("td", null, rkh(Badge, { color: o.completedShort ? COLORS.amber : COLORS.violet }, amgCompletedStatusText(o))),
          rkh("td", { onClick: e => e.stopPropagation() }, rkh("div", { style: { display: "flex", gap: 5 } }, rkh(Button, { size: "sm", onClick: () => setModal({ kind: "detail", orderId: o.id }) }, "Chi tiết"), manager && rkh(Button, { size: "sm", onClick: () => setModal({ kind: "reopen", orderId: o.id }) }, "Mở lại")))); }))))),
    modal && modal.kind === "detail" && ordObj && rkh(CompletedDetailModal, { order: ordObj, runs, entries, auditLog, extra, scrap, onClose: () => setModal(null) }),
    modal && modal.kind === "reopen" && ordObj && rkh(ReopenOrderModal, { order: ordObj, onClose: () => setModal(null), onDone: note }),
    modal && modal.kind === "complete" && ordObj && rkh(CompleteOrderModal, { order: ordObj, runs, onClose: () => setModal(null), onDone: note }));
}
