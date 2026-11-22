/* ===================== ĐƠN HÀNG HOÀN THÀNH (v46) =====================
   Không có collection riêng: đơn hoàn thành vẫn nằm trong collection orders (order.status === "completed"),
   tab này chỉ là bộ lọc. Không nhân bản, không xóa đơn. */

function CompleteOrderModal({ order, runs, onClose, onDone }) {
  const rd = amgOrderReadiness(order);
  const open = amgRunsOfOrder(runs, order.id).filter(amgIsOpenRun);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const legacy = !amgIsFlowOrder(order);
  const short = !rd.qtyMet;
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try { const r = await amgFlowCompleteOrder({ orderId: order.id, reason }); onDone(r.duplicate ? "Đơn đã được xác nhận trước đó" : `Đơn ${order.id} đã chuyển sang Đơn hàng hoàn thành`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  const blockers = [];
  if (open.length) blockers.push(`Còn lệnh đang mở trên máy ${open.map(r => r.machineId).join(", ")} — kết thúc lệnh trước.`);
  if (!legacy && !rd.allStages) blockers.push("Chưa hoàn thành công đoạn: " + rd.missing.map(amgStageLabel).join(", "));
  return rkh(Modal, { title: `Xác nhận hoàn thành đơn ${order.id}`, onClose, width: 560 },
    amgSummaryRows(order, [["Thành phẩm", fmtNum(rd.finished)], ["Quy trình", rd.route.map(amgStageLabel).join(" → ")]]),
    legacy && rkh(AmgNotice, { tone: "info" }, "Đơn cũ chưa có quy trình được xác nhận: hệ thống xác nhận theo số lượng thành phẩm của công đoạn cuối suy từ quy cách."),
    blockers.map((b, i) => rkh(AmgNotice, { key: i, tone: "err" }, b)),
    short && blockers.length === 0 && rkh(AmgNotice, { tone: "warn" }, `Thành phẩm ${fmtNum(rd.finished)} chưa đủ số lượng đặt ${fmtNum(rd.qty)}. Bắt buộc ghi lý do để hoàn thành thiếu số lượng.`),
    short && rkh(AmgFieldBox, { label: "Lý do hoàn thành thiếu số lượng" }, rkh("input", { className: "mes-input", value: reason, onChange: e => setReason(e.target.value), style: { width: "100%" } })),
    !short && rkh(AmgFieldBox, { label: "Ghi chú (không bắt buộc)" }, rkh("input", { className: "mes-input", value: reason, onChange: e => setReason(e.target.value), style: { width: "100%" } })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng"),
      rkh(Button, { variant: "primary", disabled: busy || blockers.length > 0 || (short && reason.trim().length < 5), onClick: submit }, busy ? "Đang lưu..." : "Xác nhận hoàn thành")));
}

function ReopenOrderModal({ order, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try { await amgFlowReopenOrder({ orderId: order.id, reason }); onDone(`Đã mở lại đơn ${order.id}`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Mở lại đơn ${order.id}`, onClose, width: 520 },
    rkh(AmgNotice, { tone: "warn" }, "Đơn sẽ quay lại danh sách đang sản xuất, công đoạn cuối được mở để tiếp tục. Toàn bộ dữ liệu sản xuất đã ghi nhận được giữ nguyên. Việc mở lại được ghi vào nhật ký kèm tên người thực hiện."),
    rkh(AmgFieldBox, { label: "Lý do mở lại (bắt buộc)" }, rkh("input", { className: "mes-input", autoFocus: true, value: reason, onChange: e => setReason(e.target.value), style: { width: "100%" } })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Hủy"), rkh(Button, { variant: "primary", disabled: busy || reason.trim().length < 5, onClick: submit }, busy ? "Đang lưu..." : "Mở lại đơn")));
}

function CompletedDetailModal({ order, runs, entries, auditLog, extra, scrap, onClose }) {
  const [tab, setTab] = useState("stages");
  const route = amgOrderRoute(order);
  const rd = amgOrderReadiness(order);
  const myRuns = amgSortRunsDesc(amgRunsOfOrder(runs, order.id)).reverse();
  const myEntries = (entries || []).filter(e => e.orderId === order.id).sort((a, b) => String(a.enteredAt || "").localeCompare(String(b.enteredAt || "")));
  const logs = (auditLog || []).filter(a => a.targetId === order.id && a.type !== "production_entry").sort((a, b) => String(amgFmtDateTime(a.ts)).localeCompare(String(amgFmtDateTime(b.ts))));
  const legacyEntries = (auditLog || []).filter(a => a.type === "production_entry" && a.targetId === order.id && !a.runId);
  const insp = ((extra && extra.inspections) || []).filter(i => i.orderId === order.id);
  const ncr = ((extra && extra.ncr) || []).filter(n => n.orderId === order.id);
  const scrapMatch = (scrap || []).filter(s => s.customer === order.customer && s.spec === order.spec);
  const span = amgOrderProductionSpan(order, runs);
  const row = (a, b) => rkh("div", { key: a + String(b), style: { padding: "7px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 12 } }, rkh("span", { style: { color: COLORS.textDim } }, a), rkh("b", { style: { textAlign: "right" } }, b));
  const empty = t => rkh("div", { style: { fontSize: 12.5, color: COLORS.textDim, padding: "8px 0" } }, t);
  const tabs = [["stages", "Công đoạn & máy"], ["log", "Nhật ký sản xuất"], ["quality", "Chất lượng"], ["ng", "NG / phế"], ["history", "Lịch sử đơn"]];
  return rkh(Modal, { title: `${order.id} · ${order.customer || ""} · ${order.spec || ""}`, onClose, width: 900 },
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, padding: 12, borderRadius: 10, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, marginBottom: 12 } },
      [["Số lượng đặt", fmtNum(order.quantity)], ["Thành phẩm", fmtNum(rd.finished)], ["Ngày nhận", amgFmtDate(order.orderDate)], ["Ngày hoàn thành", amgFmtDateTime(order.completedAt)], ["Thời gian sản xuất", amgDurationText(span.from, order.completedAt)], ["Xác nhận bởi", `${order.completedBy || "—"}${order.completionMode === "manual" ? " (thủ công)" : " (tự động)"}`]]
        .map(([a, b]) => rkh("div", { key: a }, rkh("div", { style: { fontSize: 11, color: COLORS.textFaint, fontWeight: 600 } }, a), rkh("div", { style: { fontSize: 14, fontWeight: 700 } }, b)))),
    order.completedShort && rkh(AmgNotice, { tone: "warn" }, "Hoàn thành thiếu số lượng. Lý do: " + (order.completionNote || "—")),
    rkh(DetailTabs, { tabs: tabs.map(([key, label]) => ({ key, label })), active: tab, onChange: setTab }),
    tab === "stages" && rkh("div", null, route.map((k, i) => {
      const sc = (order.stageComplete || {})[k], rs = myRuns.filter(r => r.stageKey === k), c = amgStageColor(k);
      return rkh("div", { key: k, style: { marginBottom: 14, borderLeft: `5px solid ${c}`, paddingLeft: 10 } },
        rkh("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 } }, rkh("b", { style: { color: c } }, `${i + 1}. ${amgStageLabel(k)}`), rkh("span", { className: "mes-mono", style: { fontSize: 13 } }, `Sản lượng: ${fmtNum(amgStageDone(order, k))}`)),
        sc && rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint } }, `Hoàn thành ${amgFmtDateTime(sc.at)} bởi ${sc.by || "—"}${sc.short ? " · thiếu SL: " + sc.reason : ""}`),
        rs.length === 0 ? empty("Chưa có lệnh máy cho công đoạn này (số liệu nhập trực tiếp vào đơn).") : rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 640, fontSize: 12.5 } },
          rkh("thead", null, rkh("tr", null, ["Máy", "Sản lượng", "Người vận hành", "Ca", "Bắt đầu", "Kết thúc"].map(h => rkh("th", { key: h }, h)))),
          rkh("tbody", null, rs.map(r => rkh("tr", { key: r.id }, rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.machineId), rkh("td", { className: "mes-mono" }, fmtNum(r.producedQuantity || 0)), rkh("td", null, r.operator || "—"), rkh("td", null, r.shift || "—"), rkh("td", null, amgFmtDateTime(r.startedAt || r.assignedAt)), rkh("td", null, r.endedAt ? amgFmtDateTime(r.endedAt) : "—")))))));
    })),
    tab === "log" && (myEntries.length + legacyEntries.length === 0 ? empty("Chưa có lượt ghi sản lượng.") : rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 640, fontSize: 12.5 } },
      rkh("thead", null, rkh("tr", null, ["Thời gian", "Công đoạn", "Máy", "Sản lượng", "Người vận hành", "Người nhập", "Ghi chú"].map(h => rkh("th", { key: h }, h)))),
      rkh("tbody", null,
        myEntries.map(e => rkh("tr", { key: e.id, style: { opacity: e.voided ? 0.5 : 1, textDecoration: e.voided ? "line-through" : "none" } }, rkh("td", null, amgFmtDateTime(e.enteredAt)), rkh("td", null, amgStageLabel(e.stageKey)), rkh("td", { className: "mes-mono" }, e.machineId), rkh("td", { className: "mes-mono" }, fmtNum(e.qty)), rkh("td", null, e.operator || "—"), rkh("td", null, e.enteredBy || "—"), rkh("td", null, e.note || ""))),
        legacyEntries.map(e => rkh("tr", { key: e.id }, rkh("td", null, amgFmtDate(e.date)), rkh("td", null, amgStageLabel(e.stageKey)), rkh("td", null, "—"), rkh("td", { className: "mes-mono" }, fmtNum(e.qty)), rkh("td", null, "—"), rkh("td", null, e.user || "—"), rkh("td", null, e.note || ""))))))),
    tab === "quality" && (insp.length + ncr.length === 0 ? empty("Chưa có phiếu kiểm tra hoặc phiếu NG gắn với đơn này.") : rkh("div", null, insp.map(i => row(`${i.id} · ${i.type || ""} · ${amgFmtDate(i.date)}`, i.result === "dat" ? "Đạt" : "NG")), ncr.map(n => row(`${n.id} · ${n.defect || ""}`, (typeof NCR_STATUS !== "undefined" && NCR_STATUS[n.status] ? NCR_STATUS[n.status].label : n.status))))),
    tab === "ng" && rkh("div", null,
      ncr.length === 0 ? empty("Không có phiếu NG gắn với đơn.") : ncr.map(n => row(`${n.id} · ${n.defect || ""} · máy ${n.machineId || "—"}`, amgFmtDate(n.openedDate))),
      myEntries.filter(e => Number(e.ng) > 0).map(e => row(`NG tại máy ${e.machineId} · ${amgStageLabel(e.stageKey)} · ${amgFmtDateTime(e.enteredAt)}`, fmtNum(e.ng))),
      scrapMatch.length > 0 && rkh("div", { style: { marginTop: 10, fontSize: 12, color: COLORS.textFaint } }, "Phế liệu cùng khách hàng & quy cách (đối chiếu gần đúng, phiếu phế không gắn mã đơn):"),
      scrapMatch.map(s => row(`${amgFmtDate(s.date)} · ${amgStageLabel(s.stage)} · ${s.reason || ""}`, `${fmtNum(s.qty)} ${s.unit || ""}`))),
    tab === "history" && rkh("div", null,
      (order.statusHistory || []).map((h, i) => row(`${amgFmtDateTime(h.at)} · mở lại bởi ${h.by}`, h.reason)),
      logs.length === 0 && !(order.statusHistory || []).length ? empty("Chưa có nhật ký.") : logs.map(a => row(`${a.user || ""} · ${amgFmtDateTime(a.ts)}`, a.detail))),
    rkh("div", { className: "mes-no-print", style: { marginTop: 12, display: "flex", justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng")));
}

function CompletedOrdersPage({ orders, runs, entries, auditLog, extra, scrap, currentUser }) {
  const [q, setQ] = useState("");
  const [cust, setCust] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const manager = amgFlowCan(currentUser, "manager");
  const done = useMemo(() => orders.filter(o => o.status === "completed").sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || ""))), [orders]);
  const pending = useMemo(() => orders.filter(o => o.status !== "completed" && ((amgIsFlowOrder(o) && amgOrderReadiness(o).allStages) || amgLegacyDoneCandidate(o))), [orders]);
  const customers = [...new Set(done.map(o => o.customer || "Chưa rõ"))].sort();
  const t = q.trim().toLowerCase();
  const list = done.filter(o => {
    if (cust !== "all" && (o.customer || "Chưa rõ") !== cust) return false;
    const d = String(o.completedAt || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return !t || [o.id, o.customer, o.spec, o.materialCode].some(v => String(v || "").toLowerCase().includes(t));
  });
  const totalQty = list.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const totalFin = list.reduce((s, o) => s + amgOrderReadiness(o).finished, 0);
  const spans = list.map(o => { const sp = amgOrderProductionSpan(o, runs); const a = new Date(sp.from).getTime(), b = new Date(sp.to).getTime(); return Number.isNaN(a) || Number.isNaN(b) ? null : b - a; }).filter(x => x !== null && x >= 0);
  const avgMs = spans.length ? spans.reduce((s, x) => s + x, 0) / spans.length : null;
  const cols = [
    { key: "id", label: "Mã đơn" }, { key: "customer", label: "Khách hàng" }, { key: "materialCode", label: "Nguyên liệu" }, { key: "spec", label: "Quy cách" },
    { key: "quantity", label: "Số lượng đặt" }, { key: "fin", label: "Số lượng thành phẩm", export: o => amgOrderReadiness(o).finished },
    { key: "orderDate", label: "Ngày nhận", export: o => amgFmtDate(o.orderDate) }, { key: "completedAt", label: "Ngày hoàn thành", export: o => amgFmtDateTime(o.completedAt) },
    { key: "dur", label: "Thời gian sản xuất", export: o => { const sp = amgOrderProductionSpan(o, runs); return amgDurationText(sp.from, sp.to); } },
    { key: "st", label: "Trạng thái", export: o => (o.completedShort ? "Hoàn thành thiếu SL" : "Hoàn thành") },
    { key: "route", label: "Quy trình", export: o => amgOrderRoute(o).map(amgStageLabel).join(" → ") },
    { key: "machines", label: "Máy đã chạy", export: o => [...new Set(amgRunsOfOrder(runs, o.id).map(r => r.machineId))].join(", ") }
  ];
  const ordObj = modal && orders.find(o => o.id === modal.orderId);
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${done.length} đơn đã hoàn thành`, title: "Đơn hàng hoàn thành", icon: CheckCircle2, iconColor: COLORS.violet,
      action: rkh(Button, { disabled: list.length === 0, onClick: () => amgExportExcel("don-hang-hoan-thanh", cols, list, "Đơn hoàn thành") }, rkh(Download, { size: 14 }), " Xuất Excel") }),
    rkh(GuideBox, { steps: ["Đơn tự xuất hiện khi hoàn thành công đoạn cuối của quy trình đã xác nhận và đủ số lượng.", "Đơn chưa đủ điều kiện nằm ở khung Chờ xác nhận bên dưới; quản đốc/quản trị xác nhận (ghi lý do nếu thiếu số lượng).", "Bấm vào đơn để xem công đoạn, máy, sản lượng, người vận hành, nhật ký, chất lượng và NG.", "Cần sản xuất thêm: Mở lại đơn (bắt buộc ghi lý do, có nhật ký). Dữ liệu cũ không bị xóa."] }),
    toast && rkh("div", { className: "mes-fade-in", style: { position: "fixed", top: 70, right: 24, zIndex: 4000, maxWidth: 420, padding: "12px 16px", borderRadius: 10, fontWeight: 600, color: "#fff", background: COLORS.green, boxShadow: "0 6px 20px rgba(0,0,0,.3)" } }, toast),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10, marginBottom: 14 } },
      amgKpiTile("Đơn hoàn thành", list.length, COLORS.violet), amgKpiTile("Tổng số lượng đặt", fmtNum(totalQty), COLORS.blue), amgKpiTile("Tổng thành phẩm", fmtNum(totalFin), COLORS.green),
      amgKpiTile("Thời gian SX trung bình", avgMs === null ? "—" : amgDurationText(0, avgMs), COLORS.amber), amgKpiTile("Chờ xác nhận", pending.length, COLORS.orange)),
    pending.length > 0 && rkh("div", { className: "mes-card", style: { padding: 12, marginBottom: 14, border: `1.5px solid ${COLORS.orange}`, borderLeft: `6px solid ${COLORS.orange}` } },
      rkh("div", { style: { fontWeight: 800, marginBottom: 6 } }, `Chờ xác nhận hoàn thành (${pending.length})`),
      rkh("div", { style: { fontSize: 12, color: COLORS.textDim, marginBottom: 8 } }, "Đơn đã đủ công đoạn/số lượng nhưng chưa được xác nhận. Đơn cũ chưa có quy trình xác nhận không tự chuyển — cần người có quyền xác nhận."),
      pending.slice(0, 30).map(o => { const rd = amgOrderReadiness(o); return rkh("div", { key: o.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${COLORS.border}`, fontSize: 13, flexWrap: "wrap" } },
        rkh("span", null, rkh("b", { className: "mes-mono" }, o.id), ` · ${o.customer || ""} · ${o.spec || ""} · thành phẩm ${fmtNum(rd.finished)} / ${fmtNum(rd.qty)}`, !amgIsFlowOrder(o) && rkh("span", { style: { color: COLORS.textFaint } }, " · đơn cũ")),
        manager && rkh(Button, { size: "sm", variant: "primary", onClick: () => setModal({ kind: "complete", orderId: o.id }) }, "Xác nhận hoàn thành")); })),
    rkh("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 } },
      rkh("div", { style: { position: "relative", flex: 1, minWidth: 220 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }), rkh("input", { className: "mes-input", style: { paddingLeft: 30 }, placeholder: "Tìm mã đơn, khách hàng, quy cách, nguyên liệu...", value: q, onChange: e => setQ(e.target.value) })),
      rkh("select", { className: "mes-input", style: { width: "auto", minWidth: 170 }, value: cust, onChange: e => setCust(e.target.value) }, rkh("option", { value: "all" }, "Mọi khách hàng"), customers.map(c => rkh("option", { key: c, value: c }, c))),
      rkh("input", { className: "mes-input", type: "date", style: { width: "auto" }, value: from, onChange: e => setFrom(e.target.value), title: "Hoàn thành từ ngày" }),
      rkh("input", { className: "mes-input", type: "date", style: { width: "auto" }, value: to, onChange: e => setTo(e.target.value), title: "Hoàn thành đến ngày" })),
    rkh("div", { className: "mes-card", style: { overflow: "hidden" } }, list.length === 0 ? rkh(EmptyState, { title: done.length === 0 ? "Chưa có đơn hoàn thành" : "Không có đơn phù hợp bộ lọc", hint: done.length === 0 ? "Đơn sẽ tự xuất hiện khi hoàn thành toàn bộ quy trình." : undefined }) :
      rkh("div", { style: { overflow: "auto", maxHeight: "68vh" } }, rkh("table", { className: "mes-table", style: { minWidth: 1000 } },
        rkh("thead", null, rkh("tr", null, ["STT", "Mã đơn", "Khách hàng", "Nguyên liệu", "Quy cách", "SL đặt", "SL thành phẩm", "Ngày nhận", "Ngày hoàn thành", "Thời gian SX", "Trạng thái", "Thao tác"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, list.map((o, i) => { const rd = amgOrderReadiness(o), sp = amgOrderProductionSpan(o, runs); return rkh("tr", { key: o.id, style: { cursor: "pointer" }, onClick: () => setModal({ kind: "detail", orderId: o.id }) },
          rkh("td", { className: "mes-mono", style: { color: COLORS.textFaint } }, i + 1), rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, o.id), rkh("td", { style: { fontWeight: 600 } }, o.customer || "—"), rkh("td", null, o.materialCode || "—"), rkh("td", { className: "mes-mono" }, o.spec || "—"),
          rkh("td", { className: "mes-mono" }, fmtNum(o.quantity)), rkh("td", { className: "mes-mono", style: { color: COLORS.green, fontWeight: 700 } }, fmtNum(rd.finished)), rkh("td", null, amgFmtDate(o.orderDate)), rkh("td", null, amgFmtDateTime(o.completedAt)), rkh("td", null, amgDurationText(sp.from, sp.to)),
          rkh("td", null, rkh(Badge, { color: o.completedShort ? COLORS.amber : COLORS.violet }, o.completedShort ? "Hoàn thành thiếu SL" : "Hoàn thành")),
          rkh("td", { onClick: e => e.stopPropagation() }, rkh("div", { style: { display: "flex", gap: 5 } }, rkh(Button, { size: "sm", onClick: () => setModal({ kind: "detail", orderId: o.id }) }, "Chi tiết"), manager && rkh(Button, { size: "sm", onClick: () => setModal({ kind: "reopen", orderId: o.id }) }, "Mở lại")))); }))))),
    modal && modal.kind === "detail" && ordObj && rkh(CompletedDetailModal, { order: ordObj, runs, entries, auditLog, extra, scrap, onClose: () => setModal(null) }),
    modal && modal.kind === "reopen" && ordObj && rkh(ReopenOrderModal, { order: ordObj, onClose: () => setModal(null), onDone: m => { setToast(m); setTimeout(() => setToast(""), 6000); } }),
    modal && modal.kind === "complete" && ordObj && rkh(CompleteOrderModal, { order: ordObj, runs, onClose: () => setModal(null), onDone: m => { setToast(m); setTimeout(() => setToast(""), 6000); } }));
}
