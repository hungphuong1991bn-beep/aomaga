/* ===================== CHI TIẾT ĐƠN HÀNG — 7 TAB (v45) =====================
   Không đổi quy tắc tính hiện có: tiến độ/công đoạn lấy từ normalizeOrderStages, getApplicableStages, orderProgress.
   BOM & giao hàng được lưu ngay trên đơn (order.bom, order.deliveries) và đi qua onUpdate cũ → có version/nhật ký như mọi sửa đơn. */

function OrderDetailModal({ order, auditLog, extra, runs, entries, currentUser, isAdmin: isAdminProp, onClose, onUpdate, onEdit, onDelete, onNavigateFocus, readOnly: readOnlyProp }) {
  // Đơn đã hoàn thành: CHỈ XEM (BOM, định mức, giao hàng không sửa/xóa được). Muốn sửa phải mở lại đơn.
  const readOnly = !!readOnlyProp || order.status === "completed";
  const isAdmin = isAdminProp && !readOnly;
  const [tab, setTab] = useState("info");
  const [bomForm, setBomForm] = useState(null);   // { line } | {}
  const [delForm, setDelForm] = useState(null);
  const { askConfirm, showAlert } = useDialog();
  const o = normalizeOrderStages(order);
  const prog = orderProgress(o);
  const applicable = getApplicableStages(o);
  const bom = order.bom || [];
  const deliveries = order.deliveries || [];
  const qty = typeof o.quantity === "number" ? o.quantity : null;
  const fmt = n => (Number(n) || 0).toLocaleString("vi-VN");
  const unit = amgOrderUnit(order);
  const lots = (extra && extra.lots) || [], moves = (extra && extra.stockMoves) || [], insp = (extra && extra.inspections) || [], ncr = (extra && extra.ncr) || [];

  const prodEntries = (auditLog || []).filter(a => a.type === "production_entry" && a.targetId === order.id).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const issuedByLot = {};
  moves.filter(m => m.type === "xuat" && m.orderId === order.id).forEach(m => { issuedByLot[m.lotId] = (issuedByLot[m.lotId] || 0) + (Number(m.qty) || 0); });
  const delivered = deliveries.reduce((s, d) => s + (Number(d.qty) || 0), 0);

  async function saveLines(patch, detail) {
    try { await onUpdate(Object.assign({}, order, patch)); } catch (e) { await showAlert("Không lưu được: " + (e.message || e)); throw e; }
  }
  const row = (a, b) => rkh("div", { key: a, style: { padding: "7px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13), display: "flex", justifyContent: "space-between", gap: 12 } }, rkh("span", { style: { color: COLORS.textDim } }, a), rkh("b", { style: { color: COLORS.text, textAlign: "right" } }, b));
  const empty = t => rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, padding: "8px 0" } }, t);

  const bomFields = [
    { key: "material", label: "Vật tư / nguyên liệu", required: true, maxLen: 80 },
    { key: "norm", label: "Định mức / 1 đơn vị thành phẩm", type: "number", min: 0, step: "any", required: true },
    { key: "unit", label: "Đơn vị", required: true, maxLen: 12 },
    { key: "note", label: "Ghi chú", wide: true, maxLen: 200 }
  ];
  const delFields = [
    { key: "date", label: "Ngày giao", type: "date", required: true },
    { key: "qty", label: "Số lượng giao", type: "number", min: 0.0001, step: "any", required: true,
      validate: (v, a) => qty !== null && delivered - (a._old || 0) + Number(v) > qty * 1.05 ? "Tổng đã giao vượt quá 105% số lượng đặt hàng" : "" },
    { key: "receiver", label: "Người nhận / phiếu giao", maxLen: 80 },
    { key: "note", label: "Ghi chú", wide: true, maxLen: 200 }
  ];

  const orderRuns = amgSortRunsDesc(amgRunsOfOrder(runs || [], order.id));
  const A = amgBuildOrderArchive(order, runs || [], entries || [], extra, auditLog, Date.now());
  const openRuns = orderRuns.filter(amgIsOpenRun);
  const curPlan = amgIsFlowOrder(order) && order.status !== "completed" ? amgPlanBucket(order, runs || []) : null;
  const curStage = curPlan && curPlan.stageKey ? amgStageLabel(curPlan.stageKey) : "—";
  const runMachines = [...new Set(openRuns.map(r => r.machineId))];
  const canPlan = !!currentUser && amgFlowCan(currentUser, "plan") && order.status !== "completed";
  const issuedByMat = {}; A.issued.forEach(i => { const k = amgSearchNorm(i.material); issuedByMat[k] = (issuedByMat[k] || 0) + (Number(i.qty) || 0); });
  const goPlan = focus => { if (onNavigateFocus) { onClose(); onNavigateFocus("machines", Object.assign({ screen: "plan" }, focus)); } };
  const actionBar = !readOnly && order.status !== "completed" && rkh("div", { className: "mes-no-print", "data-testid": "order-actions", style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 } },
    isAdmin && onEdit && rkh(Button, { onClick: onEdit }, "CHỈNH SỬA ĐƠN"),
    isAdmin && onDelete && rkh(Button, { variant: "danger", onClick: () => onDelete(order) }, "XÓA ĐƠN"),
    canPlan && onNavigateFocus && rkh(Button, { variant: "primary", onClick: () => goPlan({ q: order.id }) }, "LẬP KẾ HOẠCH SẢN XUẤT"),
    canPlan && onNavigateFocus && rkh(Button, { variant: "primary", disabled: !amgIsFlowOrder(order), title: amgIsFlowOrder(order) ? "" : "Đơn chưa xác nhận quy trình — sửa đơn để xác nhận trước khi phân máy", onClick: () => goPlan({ assign: { orderId: order.id, stageKey: curPlan && curPlan.stageKey } }) }, "PHÂN MÁY"),
    rkh(Button, { variant: "ghost", onClick: () => setTab("edits") }, "XEM LỊCH SỬ"));
  const tabs = [["info", "Thông tin chung"], ["machines", "Máy & lệnh sản xuất"], ["bom", "BOM và định mức"], ["stages", "Tiến độ công đoạn"], ["prod", "Lịch sử sản xuất"], ["quality", "Lịch sử chất lượng"], ["edits", "Lịch sử chỉnh sửa"], ["ship", "Lịch sử giao hàng"]];

  return rkh(Modal, { title: `${order.customer || ""} · ${order.spec || ""}`, onClose, width: 760 },
    actionBar,
    rkh(DetailTabs, { tabs: tabs.map(([key, label]) => ({ key, label })), active: tab, onChange: setTab }),

    tab === "info" && rkh("div", null,
      row("Mã đơn", order.id), row("Khách hàng", order.customer || "—"), row("Ngày xuống đơn", amgFmtDate(order.orderDate)),
      row("Ngày giao hàng", order.deliveryDate ? amgFmtDate(order.deliveryDate) : "Chưa nhập"), row("Quy cách", order.spec || "—"), row("Mã vật liệu", order.materialCode || "—"),
      row("Mức ưu tiên", amgPriorityMeta(order.priority).label), row("Quy trình", applicable.map(k => amgStageLabel(k)).join(" → ") + (amgIsFlowOrder(order) ? "" : " (suy từ quy cách)")), row("Ghi chú", order.note || "—"), order.status === "completed" && row("Hoàn thành lúc", amgFmtDateTime(order.completedAt) + (order.completedBy ? " · " + order.completedBy : "")), row("Loại dây", order.wireFinish === "mềm" ? "Dây ủ mềm" : order.wireFinish === "cứng" ? "Dây cứng" : "Theo quy cách"),
      row("Số lượng đặt", qty !== null ? fmt(qty) + " " + unit : "—"), row("Đơn vị tính", unit), row("Tồn kho", fmt(order.inventory) + " " + unit), row("Số lượng đã sản xuất (thành phẩm)", fmt(prog.completedQty) + " " + unit), row("Số lượng còn lại", qty !== null ? fmt(Math.max(0, qty - prog.completedQty)) + " " + unit : "—"), row("Công đoạn hiện tại", curStage), row("Máy đang sản xuất", runMachines.join(", ") || "—"),
      row("Tiến độ", prog.pct === null ? "—" : prog.pct.toFixed(1) + "%"), row("Trạng thái", rkh(Badge, { color: prog.statusColor }, prog.statusLabel)),
      null),

    tab === "machines" && (A.runRows.length === 0 ? empty("Đơn chưa được phân máy. Dùng nút PHÂN MÁY ở trên hoặc mở tab Kế hoạch sản xuất.") : rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
      rkh("thead", null, rkh("tr", null, ["Máy", "Công đoạn", "Người vận hành", "Ca", "Bắt đầu", "Kết thúc", "Chạy thực tế", "Tạm dừng", "SL kế hoạch", "SL thực tế", "Trạng thái lệnh"].map(h => rkh("th", { key: h }, h)))),
      rkh("tbody", null, A.runRows.map(r => rkh("tr", { key: r.id },
        rkh("td", { className: "mes-mono" }, r.machine), rkh("td", null, r.stage), rkh("td", null, r.operator || "—"), rkh("td", null, r.shift || "—"),
        rkh("td", null, r.start ? amgFmtDateTime(r.start) : "—"), rkh("td", null, r.end ? amgFmtDateTime(r.end) : "—"),
        rkh("td", { className: "mes-mono" }, amgHm(r.netMs)), rkh("td", { className: "mes-mono" }, amgHm(r.pausedMs)),
        rkh("td", { className: "mes-mono" }, fmt(r.planned) + " " + r.unit), rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, fmt(r.produced) + " " + r.unit), rkh("td", null, r.status))))))),
    tab === "bom" && rkh("div", null,
      readOnly && rkh("div", { style: { fontSize: FZ(13), padding: "8px 10px", borderRadius: 8, marginBottom: 8, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, color: COLORS.textDim } }, "🔒 Đơn đã hoàn thành — BOM và định mức được lưu để tra cứu (chỉ đọc). Mở lại đơn nếu cần chỉnh sửa."),
      rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 8 } }, "Công đoạn áp dụng (theo quy tắc quy cách hiện hành): ", applicable.map(k => (STAGE_MAP[k] || {}).label || k).join(" → ") || "—"),
      bom.length === 0 ? empty("Chưa khai báo định mức vật tư cho đơn này.") : rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
        rkh("thead", null, rkh("tr", null, ["Vật tư", "Định mức", "Cần cho đơn", "Đã xuất kho", "Còn thiếu", "Ghi chú", ""].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, bom.map(l => rkh("tr", { key: l.id }, rkh("td", null, l.material), rkh("td", null, `${fmt(l.norm)} ${l.unit}`), rkh("td", null, qty !== null ? `${fmt(l.norm * qty)} ${l.unit}` : "—"), rkh("td", null, `${fmt(issuedByMat[amgSearchNorm(l.material)] || 0)} ${l.unit}`), rkh("td", { style: { fontWeight: 700, color: qty !== null && l.norm * qty > (issuedByMat[amgSearchNorm(l.material)] || 0) + 1e-9 ? COLORS.red : COLORS.green } }, qty !== null ? `${fmt(Math.max(0, l.norm * qty - (issuedByMat[amgSearchNorm(l.material)] || 0)))} ${l.unit}` : "—"), rkh("td", null, l.note || ""),
          rkh("td", { className: "mes-no-print" }, isAdmin && rkh("span", { style: { display: "flex", gap: 6 } },
            rkh(Button, { variant: "ghost", onClick: () => setBomForm({ line: l }) }, "Sửa"),
            rkh(Button, { variant: "danger", onClick: async () => { if (await askConfirm(`Xóa dòng BOM “${l.material}”?`, { danger: true, confirmLabel: "Xóa" })) saveLines({ bom: bom.filter(x => x.id !== l.id) }); } }, "Xóa")))))))),
      isAdmin && rkh("div", { className: "mes-no-print", style: { marginTop: 10 } }, rkh(Button, { onClick: () => setBomForm({}) }, "+ Thêm dòng BOM")),
      Object.keys(issuedByLot).length > 0 && rkh("div", { style: { marginTop: 14 } },
        rkh("div", { style: { fontWeight: 700, fontSize: FZ(13), marginBottom: 4 } }, "Đã xuất kho cho đơn này"),
        Object.keys(issuedByLot).map(id => { const l = lots.find(x => x.id === id) || {}; return row(`${l.lotNo || id} – ${l.material || ""}`, fmt(issuedByLot[id]) + " " + (l.unit || "")); }))),

    tab === "stages" && rkh("div", null,
      rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, "Quy trình: ", applicable.map(amgStageLabel).join(" → ") || "—"),
      applicable.map((k, i) => {
        const st = o.stages[k] || { done: 0, remain: 0 }, done = amgStageComplete(order, k), live = openRuns.some(r => r.stageKey === k) || st.done > 0;
        const state = done ? { l: "Hoàn thành", c: COLORS.green } : live ? { l: "Đang thực hiện", c: COLORS.amber } : { l: "Chưa thực hiện", c: COLORS.textFaint };
        const pc = qty ? Math.min(100, Math.round(st.done / qty * 100)) : 0, miss = qty !== null ? Math.max(0, qty - st.done) : null;
        return rkh("div", { key: k, "data-stage": k, style: { marginBottom: 12 } },
          rkh("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: FZ(13) } }, rkh("b", null, `${i + 1}. ${amgStageLabel(k)}`), rkh("span", { style: { color: state.c, fontWeight: 800 } }, state.l), rkh("span", null, `Sản lượng ${fmt(st.done)} ${unit}${miss !== null ? ` · còn thiếu ${fmt(miss)}` : ""}`)),
          rkh("div", { style: { height: 7, background: COLORS.bgInset, borderRadius: 4, marginTop: 4 } }, rkh("div", { style: { width: pc + "%", height: "100%", background: done || pc >= 100 ? COLORS.green : COLORS.amber, borderRadius: 4 } })));
      })),

    tab === "prod" && ((() => { const ents = A.entries.filter(e => !e.voided).slice().reverse();
      if (ents.length === 0 && prodEntries.length === 0) return empty("Chưa có lượt ghi nhận sản lượng cho đơn này.");
      if (ents.length === 0) return rkh("div", null, prodEntries.map(a => row(`${amgFmtDate(a.date)} · ${(STAGE_MAP[a.stageKey] || {}).label || a.stageKey || ""}`, `${fmt(a.qty)} — ${a.user || ""}`)));
      return rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
        rkh("thead", null, rkh("tr", null, ["Thời gian ghi nhận", "Công đoạn", "Máy", "Sản lượng", "Người thực hiện", "Ghi chú"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, ents.map(e => rkh("tr", { key: e.id || e.clientKey || e.enteredAt }, rkh("td", null, amgFmtDateTime(e.enteredAt)), rkh("td", null, amgStageLabel(e.stageKey)), rkh("td", { className: "mes-mono" }, e.machineId || "—"), rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, `${fmt(e.qty)} ${e.unit || unit}`), rkh("td", null, e.enteredBy || e.user || "—"), rkh("td", null, e.note || ""))))));
    })()),

    tab === "quality" && (() => {
      const mi = insp.filter(i => i.orderId === order.id), mn = ncr.filter(n => n.orderId === order.id);
      if (!mi.length && !mn.length) return empty("Chưa có phiếu kiểm tra hoặc phiếu NG gắn với đơn này. Chọn đơn hàng khi lập phiếu ở mục “Kiểm tra QA/QC & NG”.");
      return rkh("div", null, mi.map(i => row(`${i.id} · ${i.type} · ${amgFmtDate(i.date)}`, i.result === "dat" ? "Đạt" : "NG")), mn.map(n => row(`${n.id} · ${n.defect || ""}`, (NCR_STATUS[n.status] || {}).label || n.status)));
    })(),

    tab === "edits" && rkh(OrderHistoryList, { auditLog: auditLog || [], orderId: order.id }),

    tab === "ship" && rkh("div", null,
      row("Số lượng đặt", qty !== null ? fmt(qty) : "—"), row("Đã giao", fmt(delivered)), row("Còn phải giao", qty !== null ? fmt(Math.max(0, qty - delivered)) : "—"),
      deliveries.length === 0 ? empty("Chưa có lần giao hàng nào.") : deliveries.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(d => rkh("div", { key: d.id, style: { padding: "7px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13), display: "flex", justifyContent: "space-between", gap: 8 } },
        rkh("span", null, `${amgFmtDate(d.date)} · ${d.receiver || ""} ${d.note ? "— " + d.note : ""}`),
        rkh("span", { style: { display: "flex", gap: 6, alignItems: "center" } }, rkh("b", null, fmt(d.qty)), isAdmin && rkh(Button, { variant: "danger", onClick: async () => { if (await askConfirm("Xóa lần giao hàng này?", { danger: true, confirmLabel: "Xóa" })) saveLines({ deliveries: deliveries.filter(x => x.id !== d.id) }); } }, "Xóa")))),
      isAdmin && rkh("div", { className: "mes-no-print", style: { marginTop: 10 } }, rkh(Button, { onClick: () => setDelForm({}) }, "+ Ghi nhận giao hàng"))),

    bomForm && rkh(FormModal, { title: bomForm.line ? "Sửa dòng BOM" : "Thêm dòng BOM", fields: bomFields, initial: bomForm.line || { unit: "kg" }, onClose: () => setBomForm(null), width: 520,
      onSave: async v => { const line = Object.assign({ id: (bomForm.line && bomForm.line.id) || amgNewId("BOM") }, v, { norm: Number(v.norm) }); await saveLines({ bom: bomForm.line ? bom.map(x => x.id === line.id ? line : x) : bom.concat([line]) }); setBomForm(null); } }),
    delForm && rkh(FormModal, { title: "Ghi nhận giao hàng", fields: delFields, initial: { date: amgTodayKey() }, onClose: () => setDelForm(null), width: 520,
      onSave: async v => { const d = { id: amgNewId("GH"), date: v.date, qty: Number(v.qty), receiver: v.receiver || "", note: v.note || "" }; await saveLines({ deliveries: deliveries.concat([d]) }); setDelForm(null); } }));
}
