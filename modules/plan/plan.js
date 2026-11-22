/* ===================== KẾ HOẠCH SẢN XUẤT (v46) =====================
   Thay cho tab "Máy móc thiết bị" (danh mục máy và chức năng quản lý máy được giữ nguyên ở mục "Danh mục máy").
   Màn 1: Kế hoạch & phân công — đơn lấy trực tiếp từ collection orders (không tạo bản sao).
   Màn 2: Giám sát máy móc — thẻ máy theo lệnh sản xuất, màn hình TV, danh mục máy cũ. */

function PriorityBadge({ value }) {
  const m = amgPriorityMeta(value);
  return rkh(Badge, { color: m.color }, m.label);
}
function StageChips({ order, runs, compact }) {
  const route = amgOrderRoute(order);
  return rkh("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 } }, route.map((k, i) => {
    const st = amgStageInfo(order, runs, k), c = amgStageColor(k);
    const solid = st.state === "complete", live = st.state === "running";
    return rkh(React.Fragment, { key: k },
      i > 0 && rkh("span", { style: { color: COLORS.textFaint, fontSize: 11 } }, "›"),
      rkh("span", { title: `${amgStageLabel(k)} — ${st.state === "complete" ? "đã hoàn thành" : st.state === "running" ? "đang chạy" : st.state === "paused" ? "tạm dừng" : st.state === "assigned" ? "đã phân máy" : "chưa phân máy"} · ${fmtNum(st.done)}${st.qty ? " / " + fmtNum(st.qty) : ""}`,
        className: live ? "pulse-dot" : undefined,
        style: { fontSize: compact ? 10.5 : 11.5, fontWeight: 700, padding: compact ? "2px 6px" : "3px 8px", borderRadius: 999, whiteSpace: "nowrap", border: `1.5px solid ${c}`, background: solid ? c : `${c}${st.state === "unassigned" ? "10" : "26"}`, color: solid ? "#fff" : c } },
        (solid ? "✓ " : "") + amgStageLabel(k)));
  }));
}
function amgKpiTile(label, value, color, active, onClick, sub) {
  return rkh(onClick ? "button" : "div", { key: label, type: onClick ? "button" : undefined, onClick, className: "amg-kpi" + (active ? " amg-kpi--on" : ""), "aria-pressed": onClick ? !!active : undefined,
    style: { "--amg-kpi-c": color, borderLeftColor: color, background: active ? `${color}12` : COLORS.bgPanel } },
    rkh("div", { style: { fontSize: 11, fontWeight: 800, color: COLORS.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" } }, label),
    rkh("div", { className: "mes-mono mes-display", style: { fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 } }, value),
    sub && rkh("div", { style: { fontSize: 11, color: COLORS.textFaint, marginTop: 2 } }, sub));
}

// Máy đang phụ trách đơn: mỗi lệnh mở = một chip "KT-01 · Đang chạy" (rê chuột xem công đoạn/người vận hành/sản lượng)
function RunChips({ openRuns }) {
  if (!openRuns || openRuns.length === 0) return rkh("span", { style: { color: COLORS.textFaint, fontSize: 12 } }, "Chưa có máy");
  return rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, openRuns.map(r => {
    const m = amgRunStatusMeta(r.productionStatus);
    return rkh("span", { key: r.id, className: "amg-pill mes-mono", title: `${r.machineId} · ${amgStageLabel(r.stageKey)} · ${m.label} · ${r.operator || "—"} · ${fmtNum(r.producedQuantity || 0)}/${fmtNum(r.plannedQuantity)}`, style: { background: m.color + "1f", color: m.color, border: `1px solid ${m.color}55` } }, r.machineId);
  }));
}
const AMG_PLAN_COLS = "92px minmax(130px,1.5fr) minmax(90px,1fr) 70px minmax(140px,1.6fr) minmax(130px,1.3fr) minmax(110px,1.1fr) 88px 128px 92px";

function PlanRow({ i, wide, runs, can, openModal }) {
  const o = i.order, bm = amgBucketMeta(i.bucket), info = i.info;
  const dueColor = i.life.overdue ? COLORS.red : i.life.dueSoon ? COLORS.amber : COLORS.text;
  const pill = (c, t) => rkh("span", { className: "amg-pill", style: { background: c + "1f", color: c } }, t);
  const cust = rkh("div", { style: { minWidth: 0 } }, rkh(Clamp, { text: o.customer, lines: 2, style: { fontWeight: 800 } }), rkh("div", { className: "mes-mono", title: o.id, style: { fontSize: 11, color: COLORS.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.id));
  const progress = info ? rkh("div", { style: { minWidth: 0 } },
    rkh("div", { style: { fontSize: 11.5, fontWeight: 800, color: amgStageColor(i.stageKey) } }, amgStageLabel(i.stageKey)),
    rkh("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, rkh(ProgressBar, { pct: info.pct }), rkh("span", { className: "mes-mono", style: { fontSize: 11, flexShrink: 0 } }, info.pct === null ? "—" : Math.round(info.pct) + "%")),
    rkh("div", { style: { fontSize: 11, color: COLORS.textFaint } }, `${fmtNum(info.done)} / ${fmtNum(info.qty)} · còn ${info.remain === null ? "—" : fmtNum(Math.max(0, info.remain))}`)) : rkh("span", { style: { color: COLORS.violet, fontWeight: 800, fontSize: 12 } }, "Đủ công đoạn");
  const due = rkh("div", { className: "mes-mono", style: { color: dueColor, fontWeight: i.life.overdue || i.life.dueSoon ? 800 : 500 } }, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—", i.life.overdue && rkh("div", { style: { fontSize: 10.5 } }, "Quá hạn"), i.life.dueSoon && !i.life.overdue && rkh("div", { style: { fontSize: 10.5 } }, i.life.days === 0 ? "Hôm nay" : `Còn ${i.life.days} ngày`));
  const act = rkh("div", { onClick: e => e.stopPropagation(), style: { display: "flex", gap: 4, justifyContent: wide ? "flex-start" : "flex-end" } },
    can.plan && i.stageKey && i.bucket !== "stage_done" && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "assign", orderId: o.id, stageKey: i.stageKey }) }, "Phân máy"),
    rkh(Button, { size: "sm", onClick: () => openModal({ kind: "detail", orderId: o.id }) }, "Chi tiết"));
  const edge = bm.color;
  const click = () => openModal({ kind: "detail", orderId: o.id });
  if (wide) return rkh("div", { className: "amg-row", style: { gridTemplateColumns: AMG_PLAN_COLS, borderLeftColor: edge }, onClick: click },
    rkh("div", null, rkh(PriorityBadge, { value: o.priority })), cust,
    rkh("div", { style: { minWidth: 0 } }, rkh(Clamp, { text: o.spec, lines: 2, mono: true }), rkh("div", { style: { fontSize: 11, color: COLORS.textFaint } }, "NL " + (o.materialCode || "—"))),
    rkh("div", { className: "mes-mono", style: { textAlign: "right", fontWeight: 700 } }, fmtNum(o.quantity)),
    rkh(StageChips, { order: o, runs, compact: true }), progress, rkh(RunChips, { openRuns: i.openRuns }), due, pill(bm.color, bm.label), act);
  return rkh("div", { className: "amg-row amg-row--card", style: { borderLeftColor: edge }, onClick: click },
    rkh("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start" } }, rkh("div", { style: { flex: "1 1 180px", minWidth: 0 } }, cust), rkh("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" } }, rkh(PriorityBadge, { value: o.priority }), pill(bm.color, bm.label))),
    rkh(StageChips, { order: o, runs, compact: true }),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "6px 12px" } },
      rkh(KV, { label: "Quy cách / NL" }, `${o.spec || "—"} · ${o.materialCode || "—"}`), rkh(KV, { label: "Số lượng" }, rkh("span", { className: "mes-mono" }, fmtNum(o.quantity))),
      rkh(KV, { label: "Máy phụ trách" }, rkh(RunChips, { openRuns: i.openRuns })), rkh(KV, { label: "Ngày giao", style: { color: dueColor } }, due)),
    progress, act);
}


/* ---------- Kiểm tra dữ liệu lệnh: phát hiện lệnh thiếu khóa, trùng, mồ côi, khóa máy lệch ---------- */
function IntegrityPanel({ issues, runs, can, openModal, act }) {
  const [open, setOpen] = useState(false);
  const real = issues.filter(i => i.severity !== "info"), info = issues.length - real.length;
  if (real.length === 0) return info > 0 ? rkh("div", { style: { fontSize: 12, color: COLORS.textFaint, marginBottom: 10 } }, `ℹ ${info} lệnh cũ thiếu trường trạng thái đã được hệ thống suy ra tự động (không ảnh hưởng hiển thị).`) : null;
  const errs = real.filter(i => i.severity === "error").length;
  const tone = errs ? COLORS.red : COLORS.amber;
  const closeBtn = id => { const r = runs.find(x => x.id === id); if (!r || !amgRunIsLive(r)) return null; return rkh(Button, { key: "c" + id, size: "sm", variant: (r.producedQuantity || 0) === 0 ? "danger" : undefined, onClick: () => openModal({ kind: (r.producedQuantity || 0) === 0 ? "cancel" : "finish", runId: id }) }, ((r.producedQuantity || 0) === 0 ? "Hủy lệnh " : "Kết thúc lệnh ") + id.slice(-6)); };
  return rkh("div", { className: "mes-card", style: { marginBottom: 12, borderLeft: `5px solid ${tone}`, padding: "10px 14px" } },
    rkh("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" } },
      rkh("b", { style: { color: tone, fontSize: 13.5 } }, `⚠ Kiểm tra dữ liệu lệnh: ${errs} lỗi, ${real.length - errs} cảnh báo`),
      rkh(Button, { size: "sm", onClick: () => setOpen(o => !o) }, open ? "Thu gọn" : "Xem chi tiết")),
    open && rkh("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 } }, real.map(i => {
      const mid = i.machineId, openIds = amgOpenRunsOfMachine(runs, mid).map(r => r.id);
      return rkh("div", { key: i.id, style: { padding: "8px 10px", borderRadius: 8, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, fontSize: 12.5 } },
        rkh("div", { style: { color: i.severity === "error" ? COLORS.red : COLORS.amber, fontWeight: 700, marginBottom: can.plan && i.fix ? 6 : 0 } }, i.text),
        can.plan && i.fix && rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          i.fix === "relock" && mid && rkh(Button, { size: "sm", variant: "primary", onClick: () => act(() => amgFlowRelockMachine(mid, openIds), `Đã đồng bộ khóa máy ${mid}`) }, "Đồng bộ khóa máy"),
          (i.fix === "cancel" || i.fix === "close") && closeBtn(i.runId),
          i.fix === "keep-one" && amgOpenRunsOfMachine(runs, mid).slice(1).map(r => closeBtn(r.id))));
    })));
}

/* ===================== MÀN 1: KẾ HOẠCH & PHÂN CÔNG ===================== */
function PlanBoard({ orders, machines, runs, can, openModal }) {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [stage, setStage] = useState("all");
  const [prio, setPrio] = useState("all");
  const [fMachine, setFMachine] = useState("all");
  const [fCust, setFCust] = useState("all");
  const [dFrom, setDFrom] = useState(""), [dTo, setDTo] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const [boxRef, boxW] = useBoxWidth();
  const wide = amgIsWide(boxW);
  const items = useMemo(() => orders
    .filter(o => o.status !== "completed" && (legacy || amgIsFlowOrder(o)))
    .map(o => Object.assign({ order: o }, amgPlanBucket(o, runs), { life: amgOrderLifecycle(o, runs) }))
    .sort((a, b) => (amgPriorityMeta(a.order.priority).rank - amgPriorityMeta(b.order.priority).rank) || String(a.order.deliveryDate || "9999").localeCompare(String(b.order.deliveryDate || "9999")) || String(a.order.id).localeCompare(String(b.order.id))), [orders, runs, legacy]);
  const counts = {};
  ["unassigned", "assigned", "running", "paused", "stage_done", "waiting_next"].forEach(k => { counts[k] = items.filter(i => i.bucket === k).length; });
  const legacyCount = orders.filter(o => o.status !== "completed" && !amgIsFlowOrder(o)).length;
  const customers = useMemo(() => [...new Set(items.map(i => i.order.customer || "Chưa rõ"))].sort(), [items]);
  const t = q.trim().toLowerCase();
  const list = items.filter(i => {
    if (bucket !== "all" && i.bucket !== bucket) return false;
    if (stage !== "all" && i.stageKey !== stage) return false;
    if (prio !== "all" && (i.order.priority || "normal") !== prio) return false;
    if (fCust !== "all" && (i.order.customer || "Chưa rõ") !== fCust) return false;
    if (fMachine === "none" ? i.openRuns.length > 0 : fMachine !== "all" && !i.openRuns.some(r => r.machineId === fMachine)) return false;
    if (dFrom && (i.order.deliveryDate || "") < dFrom) return false;
    if (dTo && (i.order.deliveryDate || "9999") > dTo) return false;
    if (!t) return true;
    const machinesOf = amgRunsOfOrder(runs, i.order.id).map(r => r.machineId).join(" ");
    return [i.order.id, i.order.customer, i.order.spec, i.order.materialCode, i.order.note, machinesOf].some(v => String(v || "").toLowerCase().includes(t));
  });
  useEffect(() => { setPage(1); }, [q, bucket, stage, prio, fMachine, fCust, dFrom, dTo, legacy, pageSize]);
  const pg = amgPaginate(list, page, pageSize);
  const machineGroups = useMemo(() => {
    const g = {}; (machines || []).forEach(m => { const k = m.typeLabel || m.typeKey || "Khác"; (g[k] = g[k] || []).push(m.id); });
    return Object.keys(g).map(k => [k, g[k].sort(amgNaturalCmp)]);
  }, [machines]);
  const cols = [
    { key: "id", label: "Mã đơn", export: i => i.order.id }, { key: "customer", label: "Khách hàng", export: i => i.order.customer },
    { key: "material", label: "Nguyên liệu", export: i => i.order.materialCode }, { key: "spec", label: "Quy cách", export: i => i.order.spec },
    { key: "qty", label: "Số lượng", export: i => i.order.quantity }, { key: "route", label: "Quy trình", export: i => i.route.map(amgStageLabel).join(" → ") },
    { key: "cur", label: "Công đoạn hiện tại", export: i => amgStageLabel(i.stageKey) },
    { key: "done", label: "Sản lượng công đoạn", export: i => (i.info ? i.info.done : "") }, { key: "remain", label: "Còn lại", export: i => (i.info ? i.info.remain : "") },
    { key: "machines", label: "Máy đang giữ lệnh", export: i => i.openRuns.map(r => r.machineId + " (" + amgRunStatusMeta(r.productionStatus).label + ")").join(", ") },
    { key: "due", label: "Ngày giao", export: i => amgFmtDate(i.order.deliveryDate) }, { key: "prio", label: "Ưu tiên", export: i => amgPriorityMeta(i.order.priority).label },
    { key: "bucket", label: "Nhóm kế hoạch", export: i => amgBucketMeta(i.bucket).label }
  ];
  const sel = { className: "mes-input", style: { width: "auto", minWidth: 130, maxWidth: 200 } };
  const dateIn = (v, set, title) => rkh("input", { className: "mes-input", type: "date", title, value: v, onChange: e => set(e.target.value), style: { width: "auto" } });
  const dirty = q || bucket !== "all" || stage !== "all" || prio !== "all" || fMachine !== "all" || fCust !== "all" || dFrom || dTo;
  return rkh("div", null,
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 14 } },
      ["unassigned", "assigned", "running", "paused", "stage_done", "waiting_next"].map(k => { const m = amgBucketMeta(k); return amgKpiTile(m.label, counts[k], m.color, bucket === k, () => setBucket(b => (b === k ? "all" : k))); })),
    rkh("div", { className: "amg-toolbar", style: { marginBottom: 10 } },
      rkh("div", { style: { position: "relative", flex: "1 1 220px", minWidth: 200 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }),
        rkh("input", { className: "mes-input", style: { paddingLeft: 30, width: "100%" }, placeholder: "Tìm mã đơn, khách hàng, quy cách, nguyên liệu, mã máy...", value: q, onChange: e => setQ(e.target.value) })),
      rkh("select", Object.assign({ value: fMachine, onChange: e => setFMachine(e.target.value), title: "Lọc theo máy đang giữ lệnh" }, sel), rkh("option", { value: "all" }, "Mọi máy"), rkh("option", { value: "none" }, "Chưa có máy"), machineGroups.map(([g, ids]) => rkh("optgroup", { key: g, label: g }, ids.map(id => rkh("option", { key: id, value: id }, id))))),
      rkh("select", Object.assign({ value: stage, onChange: e => setStage(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => rkh("option", { key: s.key, value: s.key }, s.label))),
      rkh("select", Object.assign({ value: fCust, onChange: e => setFCust(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi khách hàng"), customers.map(c => rkh("option", { key: c, value: c }, c))),
      rkh("select", Object.assign({ value: bucket, onChange: e => setBucket(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi trạng thái"), ["unassigned", "assigned", "running", "paused", "waiting_next", "stage_done"].map(k => rkh("option", { key: k, value: k }, amgBucketMeta(k).label))),
      rkh("select", Object.assign({ value: prio, onChange: e => setPrio(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi mức ưu tiên"), AMG_PRIORITY_KEYS.map(k => rkh("option", { key: k, value: k }, amgPriorityMeta(k).label)))),
    rkh("div", { className: "amg-toolbar", style: { marginBottom: 12, fontSize: 12, color: COLORS.textDim } }, "Ngày giao:", dateIn(dFrom, setDFrom, "Giao từ ngày"), "–", dateIn(dTo, setDTo, "Giao đến ngày"),
      dirty && rkh(Button, { size: "sm", variant: "ghost", onClick: () => { setQ(""); setBucket("all"); setStage("all"); setPrio("all"); setFMachine("all"); setFCust("all"); setDFrom(""); setDTo(""); } }, "Xóa bộ lọc"),
      rkh("span", { style: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" } }, rkh("b", null, `${list.length} / ${items.length} đơn`),
        rkh(Button, { disabled: list.length === 0, onClick: () => amgExportExcel("ke-hoach-san-xuat", cols, list, "Kế hoạch") }, rkh(Download, { size: 14 }), " Xuất Excel"))),
    rkh("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: COLORS.textDim, marginBottom: 12, cursor: "pointer" } },
      rkh("input", { type: "checkbox", checked: legacy, onChange: e => setLegacy(e.target.checked), style: { width: 16, height: 16 } }),
      `Hiện cả ${legacyCount} đơn cũ chưa chọn quy trình (công đoạn suy từ quy cách). Muốn đơn cũ xuất hiện mặc định: mở đơn ở tab Đơn hàng → Chỉnh sửa → Xác nhận quy trình.`),
    rkh("div", { className: "mes-card", ref: boxRef, style: { overflow: "hidden" } },
      list.length === 0 ? rkh(EmptyState, { title: items.length === 0 ? "Chưa có đơn nào trong kế hoạch" : "Không có đơn phù hợp bộ lọc", hint: items.length === 0 ? "Tạo đơn ở tab Đơn hàng và tích các công đoạn cần làm — đơn sẽ tự xuất hiện tại đây." : undefined }) :
        rkh("div", null,
          wide && rkh("div", { className: "amg-hdr", style: { gridTemplateColumns: AMG_PLAN_COLS } }, ["Ưu tiên", "Khách hàng / Mã đơn", "Quy cách", "Số lượng", "Quy trình", "Tiến độ công đoạn", "Máy phụ trách", "Ngày giao", "Trạng thái", ""].map((h, k) => rkh("div", { key: k, style: { textAlign: k === 3 ? "right" : "left" } }, h))),
          pg.items.map(i => rkh(PlanRow, { key: i.order.id, i, wide, runs, can, openModal })),
          rkh(Pager, { total: list.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }))));
}

/* ---------- Chi tiết kế hoạch của một đơn ---------- */
function OrderPlanDetail({ order, runs, machines, orders, auditLog, can, openModal, onClose, act }) {
  const route = amgOrderRoute(order);
  const cur = amgWorkingStage(order, runs), next = cur ? amgNextStage(order, cur) : null;
  const curInfo = cur ? amgStageInfo(order, runs, cur) : null;
  const life = amgOrderLifecycle(order, runs);
  const rd = amgOrderReadiness(order);
  const prog = orderProgress(normalizeOrderStages(order));
  const rows = [["Mã đơn", order.id], ["Khách hàng", order.customer || "—"], ["Nguyên liệu", order.materialCode || "—"], ["Quy cách", order.spec || "—"], ["Số lượng", fmtNum(order.quantity)],
    ["Công đoạn hiện tại", cur ? amgStageLabel(cur) : "Đã đủ công đoạn"], ["Công đoạn tiếp theo", next ? amgStageLabel(next) : "—"],
    ["Sản lượng đã chạy", curInfo ? fmtNum(curInfo.done) : fmtNum(prog.completedQty)], ["Số lượng còn lại", curInfo && curInfo.remain !== null ? fmtNum(Math.max(0, curInfo.remain)) : fmtNum(Math.max(0, prog.remainingQty || 0))],
    ["Ngày giao", order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—"], ["Mức ưu tiên", amgPriorityMeta(order.priority).label], ["Thành phẩm / tiến độ", `${fmtNum(prog.completedQty)}${prog.pct === null ? "" : " · " + Math.round(prog.pct) + "%"}`]];
  return rkh(Modal, { title: `Kế hoạch đơn ${order.id} · ${order.customer || ""}`, onClose, width: 900 },
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, padding: 12, borderRadius: 10, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, marginBottom: 14 } },
      rows.map(([a, b]) => rkh("div", { key: a }, rkh("div", { style: { fontSize: 11, color: COLORS.textFaint, fontWeight: 600 } }, a), rkh("div", { style: { fontSize: 14, fontWeight: 700, wordBreak: "break-word" } }, b)))),
    life.overdue && rkh(AmgNotice, { tone: "err" }, `Đơn quá hạn giao ${Math.abs(life.days)} ngày.`),
    !amgIsFlowOrder(order) && rkh(AmgNotice, { tone: "info" }, "Đơn cũ: công đoạn được suy từ quy cách. Để đơn vào kế hoạch mặc định và có quy trình xác nhận, mở tab Đơn hàng → Chỉnh sửa → Xác nhận quy trình."),
    order.status !== "completed" && rd.allStages && rkh(AmgNotice, { tone: rd.qtyMet ? "ok" : "warn" }, rd.qtyMet ? "Đã hoàn thành mọi công đoạn và đủ số lượng." : `Đã hoàn thành mọi công đoạn nhưng thành phẩm ${fmtNum(rd.finished)} chưa đủ ${fmtNum(rd.qty)}.`,
      can.manager && rkh("div", { style: { marginTop: 8 } }, rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "complete", orderId: order.id }) }, "Xác nhận hoàn thành đơn"))),
    route.map((k, idx) => {
      const st = amgStageInfo(order, runs, k), c = amgStageColor(k), asg = amgStageAssignable(order, k);
      const stLabel = st.state === "complete" ? "Hoàn thành công đoạn" : st.state === "running" ? "Đang sản xuất" : st.state === "paused" ? "Tạm dừng" : st.state === "assigned" ? "Đã phân máy" : "Chưa phân máy";
      const stColor = st.state === "complete" ? COLORS.violet : st.state === "running" ? COLORS.green : st.state === "paused" ? COLORS.amber : st.state === "assigned" ? COLORS.blue : COLORS.red;
      const stRuns = amgSortRunsDesc(st.runs);
      return rkh("div", { key: k, className: "mes-card", style: { padding: 12, marginBottom: 10, borderLeft: `5px solid ${c}`, opacity: st.state === "complete" ? 0.92 : 1 } },
        rkh("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 } },
          rkh("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, rkh("b", { style: { fontSize: 15, color: c } }, `${idx + 1}. ${amgStageLabel(k)}`), rkh(Badge, { color: stColor }, stLabel)),
          can.plan && st.state !== "complete" && rkh(Button, { size: "sm", variant: asg.ok ? "primary" : undefined, disabled: !asg.ok, title: asg.ok ? "" : asg.reason, onClick: () => openModal({ kind: "assign", orderId: order.id, stageKey: k }) }, "Phân máy")),
        !asg.ok && st.state === "unassigned" && rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint, marginBottom: 4 } }, asg.reason),
        rkh("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } }, rkh(ProgressBar, { pct: st.pct, color: c }), rkh("span", { className: "mes-mono", style: { fontSize: 12, flexShrink: 0 } }, `${fmtNum(st.done)} / ${fmtNum(st.qty)} · còn ${st.remain === null ? "—" : fmtNum(Math.max(0, st.remain))}`)),
        stRuns.length > 0 && rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 620, fontSize: 12.5 } },
          rkh("tbody", null, stRuns.map(r => {
            const sm = amgRunStatusMeta(r.productionStatus), open = amgIsOpenRun(r);
            return rkh("tr", { key: r.id },
              rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.machineId),
              rkh("td", null, rkh(Badge, { color: sm.color }, sm.label)),
              rkh("td", { className: "mes-mono" }, `${fmtNum(r.producedQuantity || 0)} / ${fmtNum(r.plannedQuantity)}`),
              rkh("td", null, `${r.operator || "—"} · ${r.shift || "—"}`),
              rkh("td", { style: { fontSize: 11.5 } }, amgFmtDateTime(r.startedAt || r.assignedAt), r.endedAt ? " → " + amgFmtDateTime(r.endedAt) : ""),
              rkh("td", { style: { whiteSpace: "nowrap" } }, open && rkh("div", { style: { display: "flex", gap: 5, flexWrap: "wrap" } },
                can.output && r.productionStatus === "running" && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "output", runId: r.id }) }, "Ghi sản lượng"),
                can.plan && r.productionStatus === "assigned" && rkh(Button, { size: "sm", onClick: () => act(() => amgFlowStart(r.id), `Đã bắt đầu chạy máy ${r.machineId}`) }, "Bắt đầu"),
                can.plan && r.productionStatus === "running" && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "pause", runId: r.id }) }, "Tạm dừng"),
                can.plan && r.productionStatus === "paused" && rkh(Button, { size: "sm", onClick: () => act(() => amgFlowResume(r.id), `Đã tiếp tục chạy máy ${r.machineId}`) }, "Tiếp tục"),
                can.plan && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "finish", runId: r.id }) }, "Kết thúc"),
                can.plan && (r.producedQuantity || 0) === 0 && rkh(Button, { size: "sm", variant: "danger", onClick: () => openModal({ kind: "cancel", runId: r.id }) }, "Hủy"))));
          })))));
    }),
    rkh(OrderPlanHistory, { orderId: order.id, auditLog }));
}
// Lịch sử phân máy / đổi trạng thái lệnh của đơn (từ nhật ký hệ thống: thời gian, người thao tác, nội dung)
function OrderPlanHistory({ orderId, auditLog }) {
  const types = ["plan_assign", "plan_start", "plan_pause", "plan_resume", "plan_finish", "plan_cancel", "production_entry", "run_output", "machine_relock"];
  const rows = (auditLog || []).filter(a => a && a.targetId === orderId && (types.indexOf(a.type) > -1 || /^plan_|^run_/.test(a.type || ""))).slice(0, 30);
  if (!rows.length) return null;
  return rkh("div", { style: { marginTop: 10 } }, rkh("div", { style: { fontSize: 12, fontWeight: 800, color: COLORS.textDim, marginBottom: 6 } }, "LỊCH SỬ PHÂN MÁY & THAY ĐỔI LỆNH"),
    rkh("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, rows.map((a, i) => rkh("div", { key: a.id || i, style: { fontSize: 12, padding: "5px 8px", borderRadius: 6, background: COLORS.bgInset } },
      rkh("span", { className: "mes-mono", style: { color: COLORS.textFaint } }, amgFmtDateTime(a.ts && a.ts.toDate ? a.ts.toDate() : a.ts) + " · "), rkh("b", null, (a.user || a.userName || "—") + ": "), a.detail || a.action || ""))));
}

/* ===================== THẺ MÁY ===================== */
function MachineCard({ machine, runs, orders, can, openModal, act, tv }) {
  const state = amgMachineCardState(machine, runs), meta = amgCardStatusMeta(state);
  const run = amgOpenRunOfMachine(runs, machine.id);
  const oi = run ? amgRunOrderInfo(run, orders) : null;
  const down = machine.status === "broken" || machine.status === "maintenance";
  const planned = run ? Number(run.plannedQuantity) || 0 : 0, produced = run ? Number(run.producedQuantity) || 0 : 0;
  const pct = run && planned > 0 ? Math.min(999, produced / planned * 100) : null;
  const remain = run ? Math.max(0, Math.round((planned - produced) * 100) / 100) : 0;
  const life = oi && oi.order ? amgOrderLifecycle(oi.order, runs) : null;
  const stInfo = run && oi && oi.order ? amgStageInfo(oi.order, runs, run.stageKey) : null;
  const lastPause = run && run.productionStatus === "paused" ? (run.pauses || []).slice(-1)[0] : null;
  const warns = [];
  if (run && !oi.found) warns.push("Đơn gốc không còn tồn tại");
  const extraRuns = amgOpenRunsOfMachine(runs, machine.id).length - 1;
  if (extraRuns > 0) warns.push(`Máy đang giữ thêm ${extraRuns} lệnh mở khác — xem bảng Kiểm tra dữ liệu lệnh`);
  if (life && life.overdue) warns.push(`Đơn quá hạn giao ${Math.abs(life.days)} ngày`);
  else if (life && life.dueSoon) warns.push(life.days === 0 ? "Đơn giao hôm nay" : `Đơn giao sau ${life.days} ngày`);
  if (run && produced > planned && planned > 0) warns.push("Vượt kế hoạch của lệnh");
  if (lastPause) warns.push("Tạm dừng: " + lastPause.reason);
  if (run && down) warns.push("Máy đang " + (machine.status === "broken" ? "hỏng" : "bảo trì") + " nhưng vẫn giữ lệnh — tạm dừng hoặc kết thúc lệnh");
  if (machine.note && (down || !run)) warns.push("Ghi chú máy: " + machine.note);
  const S = tv ? { id: 40, big: 30, mid: 21, small: 17, pad: 18, label: 14 } : { id: 20, big: 17, mid: 13.5, small: 12, pad: 14, label: 10.5 };
  const stageC = run ? amgStageColor(run.stageKey) : COLORS.textFaint;
  const field = (label, value, strong) => rkh("div", { key: label, style: { minWidth: 0 } },
    rkh("div", { style: { fontSize: S.label, color: tv ? "#8EA3C2" : COLORS.textFaint, fontWeight: 700 } }, label),
    rkh("div", { style: { fontSize: strong ? S.big : S.mid, fontWeight: strong ? 800 : 600, color: tv ? "#F1F6FF" : COLORS.text, wordBreak: "break-word", lineHeight: 1.2 } }, value));
  const bg = tv ? "#10233D" : COLORS.bgPanel;
  return rkh("div", { className: "amg-mcard", style: { borderRadius: 14, overflow: "hidden", background: bg, border: `${state === "broken" || state === "maintenance" ? 3 : 2}px solid ${meta.color}`, boxShadow: `0 2px 10px ${meta.color}33`, display: "flex", flexDirection: "column" } },
    rkh("div", { style: { background: meta.color, color: "#fff", padding: `${tv ? 10 : 7}px ${S.pad}px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
      rkh("div", null, rkh("div", { className: "mes-mono", style: { fontSize: S.id, fontWeight: 800, lineHeight: 1 } }, machine.id), rkh("div", { style: { fontSize: tv ? 16 : 11.5, opacity: 0.92 } }, machine.typeLabel || "")),
      rkh("div", { className: state === "running" ? "pulse-dot" : undefined, style: { fontSize: tv ? 20 : 12.5, fontWeight: 800, letterSpacing: ".03em", textAlign: "right" } }, meta.label)),
    rkh("div", { style: { padding: S.pad, display: "flex", flexDirection: "column", gap: tv ? 12 : 9, flex: 1 } },
      down && rkh("div", { style: { padding: tv ? 14 : 9, borderRadius: 8, background: `${meta.color}`, color: "#fff", fontWeight: 800, fontSize: tv ? 22 : 13.5, textAlign: "center" } }, state === "broken" ? "⛔ MÁY HỎNG — KHÔNG NHẬN LỆNH MỚI" : "🔧 ĐANG BẢO TRÌ — KHÔNG NHẬN LỆNH MỚI"),
      !run ? rkh("div", { style: { textAlign: "center", padding: tv ? "26px 0" : "14px 0", fontWeight: 800, fontSize: tv ? 34 : 19, color: tv ? "#7C93B8" : COLORS.textFaint, letterSpacing: ".04em" } }, "MÁY TRỐNG — CHƯA CÓ LỆNH") :
        rkh(React.Fragment, null,
          rkh("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
            rkh("div", { className: "mes-mono", style: { fontSize: S.big + 2, fontWeight: 800, color: tv ? "#fff" : COLORS.text } }, run.orderId),
            rkh("span", { style: { fontSize: tv ? 16 : 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: `${stageC}30`, color: stageC, border: `1.5px solid ${stageC}` } }, amgStageLabel(run.stageKey))),
          rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 12 : 8 } },
            field("Khách hàng", oi.customer || "—"), field("Nguyên liệu", oi.materialCode || "—"), field("Quy cách", oi.spec || "—"), field("Số lượng kế hoạch", fmtNum(planned))),
          rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 12 : 8 } },
            field("Đã sản xuất", fmtNum(produced), true), field("Còn lại", fmtNum(remain), true)),
          rkh("div", null,
            rkh("div", { style: { display: "flex", justifyContent: "space-between", fontSize: S.label + 1, fontWeight: 700, color: tv ? "#B7C6E0" : COLORS.textDim, marginBottom: 3 } }, rkh("span", null, "Tiến độ lệnh"), rkh("span", { className: "mes-mono" }, pct === null ? "—" : Math.round(pct) + "%")),
            rkh("div", { style: { height: tv ? 16 : 10, borderRadius: 8, background: tv ? "#1B3358" : COLORS.bgInset, overflow: "hidden" } }, rkh("div", { style: { width: Math.min(100, pct || 0) + "%", height: "100%", background: pct !== null && pct >= 100 ? COLORS.green : meta.color, transition: "width .4s" } })),
            stInfo && rkh("div", { style: { fontSize: S.label + 1, color: tv ? "#8EA3C2" : COLORS.textFaint, marginTop: 3 } }, `Công đoạn của đơn: ${fmtNum(stInfo.done)} / ${fmtNum(stInfo.qty)}`)),
          rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 10 : 7 } },
            field("Người vận hành", run.operator || "—"), field("Tổ", run.team || amgTeamOfStage(run.stageKey) || "—"), field("Ca", run.shift || "—"), field("Bắt đầu", run.startedAt ? amgFmtDateTime(run.startedAt) : "Chưa bắt đầu"))),
      warns.length > 0 && rkh("div", { style: { fontSize: tv ? 16 : 11.5, color: tv ? "#FFD27A" : COLORS.amber, fontWeight: 700, lineHeight: 1.45 } }, warns.map((w, i) => rkh("div", { key: i }, "⚠ " + w)))),
    !tv && rkh("div", { className: "mes-no-print", style: { padding: "0 14px 12px", display: "flex", gap: 6, flexWrap: "wrap" } },
      run && can.output && run.productionStatus === "running" && !down && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "output", runId: run.id }) }, "Ghi sản lượng"),
      run && can.plan && run.productionStatus === "assigned" && !down && rkh(Button, { size: "sm", variant: "primary", onClick: () => act(() => amgFlowStart(run.id), `Đã bắt đầu chạy máy ${machine.id}`) }, "Bắt đầu chạy"),
      run && can.plan && run.productionStatus === "running" && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "pause", runId: run.id }) }, "Tạm dừng"),
      run && can.plan && run.productionStatus === "paused" && !down && rkh(Button, { size: "sm", onClick: () => act(() => amgFlowResume(run.id), `Đã tiếp tục chạy máy ${machine.id}`) }, "Tiếp tục"),
      run && can.plan && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "finish", runId: run.id }) }, "Kết thúc lệnh"),
      !run && can.plan && !down && rkh(Button, { size: "sm", variant: "primary", disabled: !amgMachineStage(machine), onClick: () => openModal({ kind: "assign", machineId: machine.id }) }, "Phân lệnh"),
      rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "history", machineId: machine.id }) }, "Lịch sử"),
      can.editMachines && rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "status", machineId: machine.id }) }, "Trạng thái máy")));
}

/* ---------- Màn hình TV nhà xưởng (portal ra ngoài khung ứng dụng để chữ không bị phóng theo zoom) ---------- */
function TVWall({ machines, runs, orders, onClose }) {
  const [group, setGroup] = useState("all");
  const [onlyActive, setOnlyActive] = useState(false);
  const [perPage, setPerPage] = useState(8);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const k = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const typeOrder = {}; MACHINE_TYPES.forEach((t, i) => { typeOrder[t.key] = i; });
  const list = useMemo(() => machines.filter(m => amgMachineStage(m) && (group === "all" || m.typeKey === group) &&
    (!onlyActive || amgOpenRunOfMachine(runs, m.id) || m.status === "broken" || m.status === "maintenance"))
    .sort((a, b) => ((typeOrder[a.typeKey] ?? 99) - (typeOrder[b.typeKey] ?? 99)) || amgNaturalCmp(a.id, b.id)), [machines, runs, group, onlyActive]); // eslint-disable-line
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages]); // eslint-disable-line
  useEffect(() => { if (pages <= 1) return; const t = setInterval(() => setPage(p => (p + 1) % pages), 15000); return () => clearInterval(t); }, [pages]);
  const slice = list.slice(page * perPage, page * perPage + perPage);
  const cnt = { running: 0, assigned: 0, paused: 0, idle: 0, broken: 0, maintenance: 0 };
  machines.filter(m => amgMachineStage(m)).forEach(m => { cnt[amgMachineCardState(m, runs)]++; });
  const sel = { padding: "8px 10px", borderRadius: 8, border: "1px solid #35496E", background: "#17294A", color: "#fff", fontSize: 16 };
  const node = rkh("div", { style: { position: "fixed", inset: 0, zIndex: 9000, background: "#071426", color: "#fff", display: "flex", flexDirection: "column", fontFamily: FONT_BODY } },
    rkh("div", { style: { display: "flex", alignItems: "center", gap: 18, padding: "12px 22px", background: "#0B2A4A", borderBottom: "3px solid #D6111C", flexWrap: "wrap" } },
      rkh("div", { style: { fontSize: 28, fontWeight: 800, letterSpacing: ".02em" } }, "AOMAGA · THẺ MÁY SẢN XUẤT"),
      rkh("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", fontSize: 18, fontWeight: 700 } },
        ["running", "assigned", "paused", "idle", "broken", "maintenance"].map(k => { const m = amgCardStatusMeta(k); return rkh("span", { key: k, style: { color: m.color === COLORS.violet ? "#C4B0FF" : m.color, background: "#0A1424", padding: "3px 12px", borderRadius: 999, border: `2px solid ${m.color}` } }, `${m.label.toLowerCase()}: ${cnt[k]}`); })),
      rkh("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
        rkh("select", { style: sel, value: group, onChange: e => { setGroup(e.target.value); setPage(0); } }, rkh("option", { value: "all" }, "Tất cả nhóm máy"), MACHINE_TYPES.filter(t => t.stage).map(t => rkh("option", { key: t.key, value: t.key }, t.label))),
        rkh("label", { style: { fontSize: 16, display: "flex", alignItems: "center", gap: 6 } }, rkh("input", { type: "checkbox", checked: onlyActive, onChange: e => { setOnlyActive(e.target.checked); setPage(0); }, style: { width: 18, height: 18 } }), "Chỉ máy có lệnh/sự cố"),
        rkh("select", { style: sel, value: perPage, onChange: e => { setPerPage(Number(e.target.value)); setPage(0); } }, [4, 6, 8, 12].map(n => rkh("option", { key: n, value: n }, `${n} thẻ/trang`))),
        rkh("div", { className: "mes-mono", style: { fontSize: 30, fontWeight: 800, minWidth: 120, textAlign: "right" } }, now.toLocaleTimeString("vi-VN")),
        rkh("button", { onClick: () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); }, style: Object.assign({ cursor: "pointer" }, sel) }, "Toàn màn hình"),
        rkh("button", { onClick: onClose, style: Object.assign({ cursor: "pointer", background: "#D6111C", border: "none", fontWeight: 800 }, sel) }, "Thoát (Esc)"))),
    rkh("div", { style: { flex: 1, overflow: "auto", padding: 18 } },
      list.length === 0 ? rkh("div", { style: { textAlign: "center", fontSize: 28, color: "#7C93B8", marginTop: 80 } }, "Không có máy phù hợp bộ lọc") :
        rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 16, alignItems: "stretch" } },
          slice.map(m => rkh(MachineCard, { key: m.id, machine: m, runs, orders, can: {}, openModal: () => {}, act: () => {}, tv: true })))),
    rkh("div", { style: { padding: "8px 22px", background: "#0B2A4A", fontSize: 16, color: "#B7C6E0", display: "flex", justifyContent: "space-between" } },
      rkh("span", null, `Trang ${page + 1}/${pages} · ${list.length} máy · tự chuyển trang mỗi 15 giây · dữ liệu cập nhật trực tiếp`), rkh("span", null, "Nhấn Esc để thoát")));
  return typeof ReactDOM !== "undefined" && ReactDOM.createPortal ? ReactDOM.createPortal(node, document.body) : node;
}

/* ===================== MÀN 2: GIÁM SÁT MÁY MÓC ===================== */
function MonitorScreen({ machines, runs, orders, entries, can, openModal, act, catalogProps }) {
  const [sub, setSub] = useState("cards");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [tv, setTv] = useState(false);
  const mm = machines.filter(m => amgMachineStage(m));
  const cnt = { running: 0, assigned: 0, paused: 0, idle: 0, broken: 0, maintenance: 0 };
  mm.forEach(m => { cnt[amgMachineCardState(m, runs)]++; });
  const t = q.trim().toLowerCase();
  const filtered = mm.filter(m => {
    if (group !== "all" && m.typeKey !== group) return false;
    const st = amgMachineCardState(m, runs);
    if (status !== "all" && st !== status) return false;
    if (!t) return true;
    const run = amgOpenRunOfMachine(runs, m.id), oi = run ? amgRunOrderInfo(run, orders) : null;
    return [m.id, m.typeLabel, run && run.orderId, oi && oi.customer, oi && oi.spec, oi && oi.materialCode, run && run.operator].some(v => String(v || "").toLowerCase().includes(t));
  });
  const groups = MACHINE_TYPES.filter(ty => ty.stage).map(ty => ({ type: ty, list: filtered.filter(m => m.typeKey === ty.key).sort((a, b) => amgNaturalCmp(a.id, b.id)) })).filter(g => g.list.length);
  const subBtn = (k, label) => rkh("button", { key: k, onClick: () => setSub(k), style: { background: "none", border: "none", cursor: "pointer", padding: "8px 4px", marginRight: 18, fontWeight: 700, fontSize: 13.5, color: sub === k ? COLORS.copperBright : COLORS.textDim, borderBottom: sub === k ? `2px solid ${COLORS.copper}` : "2px solid transparent" } }, label);
  return rkh("div", null,
    rkh("div", { style: { display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 } }, subBtn("cards", "Thẻ máy"), subBtn("catalog", "Danh mục máy & trạng thái")),
    sub === "catalog" ? rkh("div", { style: { zoom: 0.66 } }, rkh(MachinesPage, catalogProps)) :
      rkh("div", null,
        rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 14 } },
          ["running", "assigned", "paused", "idle", "broken", "maintenance"].map(k => { const m = amgCardStatusMeta(k); return amgKpiTile(m.label.charAt(0) + m.label.slice(1).toLowerCase(), cnt[k], m.color, status === k, () => setStatus(s => (s === k ? "all" : k))); })),
        rkh("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } },
          rkh("div", { style: { position: "relative", flex: 1, minWidth: 220 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }),
            rkh("input", { className: "mes-input", style: { paddingLeft: 30 }, placeholder: "Tìm mã máy, mã đơn, khách hàng, quy cách, người vận hành...", value: q, onChange: e => setQ(e.target.value) })),
          rkh("select", { className: "mes-input", style: { width: "auto", minWidth: 190 }, value: group, onChange: e => setGroup(e.target.value) }, rkh("option", { value: "all" }, "Tất cả nhóm máy"), MACHINE_TYPES.filter(ty => ty.stage).map(ty => rkh("option", { key: ty.key, value: ty.key }, `${ty.label} (${ty.prefix})`))),
          rkh(Button, { variant: "primary", onClick: () => setTv(true) }, "Màn hình TV")),
        groups.length === 0 ? rkh(EmptyState, { title: mm.length === 0 ? "Chưa có máy trong danh mục" : "Không có máy phù hợp bộ lọc", hint: mm.length === 0 ? "Vào mục Danh mục máy để khôi phục/thêm máy." : undefined }) :
          groups.map(g => rkh("div", { key: g.type.key, style: { marginBottom: 20 } },
            rkh("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 6, borderBottom: `3px solid ${g.type.color}` } },
              rkh("div", { className: "mes-display", style: { fontSize: 16, fontWeight: 800, color: g.type.color } }, g.type.label), rkh("span", { style: { fontSize: 12, color: COLORS.textFaint } }, `${g.list.length} máy`)),
            rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 } },
              g.list.map(m => rkh(MachineCard, { key: m.id, machine: m, runs, orders, can, openModal, act }))))),
        tv && rkh(TVWall, { machines, runs, orders, onClose: () => setTv(false) })));
}

/* ===================== TRANG KẾ HOẠCH SẢN XUẤT ===================== */
function PlanPage({ orders, machines, runs, entries, flowError, auditLog, staff, currentUser, isAdmin, canEdit, onUpdateMachine, onAddMachine, onDeleteMachine, onRestoreSeed }) {
  const { showAlert } = useDialog();
  const [screen, setScreen] = useState("plan");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const can = { plan: amgFlowCan(currentUser, "plan"), output: amgFlowCan(currentUser, "output"), manager: amgFlowCan(currentUser, "manager"), editMachines: canEdit };
  const notify = (msg, tone) => { setToast({ msg, tone: tone || "ok" }); setTimeout(() => setToast(null), 6500); };
  async function act(fn, okMsg) {
    try { const r = await fn(); notify(r && r.duplicate ? "Thao tác đã được ghi nhận trước đó" : okMsg); } catch (e) { await showAlert(e.message || String(e), { title: "Không thực hiện được" }); }
  }
  const close = () => setModal(null);
  const issues = useMemo(() => amgRunIssues(runs, orders, machines), [runs, orders, machines]);
  const run = modal && modal.runId ? runs.find(r => r.id === modal.runId) : null;
  const ordObj = modal && modal.orderId ? orders.find(o => o.id === modal.orderId) : null;
  const macObj = modal && modal.machineId ? machines.find(m => m.id === modal.machineId) : null;
  const guide = ["Tạo đơn ở tab Đơn hàng và tích các công đoạn cần làm — đơn tự xuất hiện ở đây.",
    "Bấm Phân máy trên đơn: chọn công đoạn, chọn máy (chỉ hiện máy đúng nhóm, máy hỏng/bảo trì bị khóa), nhập số lượng kế hoạch, ca, người vận hành.",
    "Thẻ máy tự hiện đơn vừa phân. Người vận hành bấm Ghi sản lượng ngay trên thẻ máy; đơn hàng, tiến độ và Tổng quan cập nhật theo.",
    "Hết phần việc: Kết thúc lệnh (máy được giải phóng) và tích Hoàn thành công đoạn để chuyển công đoạn tiếp theo.",
    "Xong công đoạn cuối và đủ số lượng, đơn tự chuyển sang tab Đơn hàng hoàn thành.",
    "Màn hình TV: Giám sát máy móc → Màn hình TV (Esc để thoát)."];
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${orders.filter(o => o.status !== "completed" && amgIsFlowOrder(o)).length} đơn trong kế hoạch · ${machines.filter(m => amgMachineStage(m)).length} máy`, title: "Kế hoạch sản xuất & phân công máy", icon: Cog, iconColor: COLORS.blue }),
    rkh(GuideBox, { steps: guide }),
    flowError && rkh(AmgNotice, { tone: "err" }, "⛔ " + flowError),
    can.plan && rkh(IntegrityPanel, { issues, runs, can, openModal: setModal, act }),
    toast && rkh("div", { className: "mes-fade-in", style: { position: "fixed", top: 70, right: 24, zIndex: 4000, maxWidth: 420, padding: "12px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: "#fff", background: toast.tone === "ok" ? COLORS.green : COLORS.red, boxShadow: "0 6px 20px rgba(0,0,0,.3)" } }, toast.msg),
    rkh("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
      [["plan", "Kế hoạch & phân công sản xuất"], ["monitor", "Giám sát máy móc"]].map(([k, l]) => rkh("button", { key: k, onClick: () => setScreen(k), className: "mes-btn", style: { padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 14, border: `2px solid ${screen === k ? COLORS.copper : COLORS.border}`, background: screen === k ? `${COLORS.copper}16` : COLORS.bgPanel, color: screen === k ? COLORS.copper : COLORS.textDim } }, l))),
    screen === "plan" ? rkh(PlanBoard, { orders, machines, runs, can, openModal: setModal }) :
      rkh(MonitorScreen, { machines, runs, orders, entries, can, openModal: setModal, act, catalogProps: { machines, isAdmin, canEdit, onUpdateMachine, onAddMachine, onDeleteMachine, onRestoreSeed } }),
    modal && modal.kind === "detail" && ordObj && rkh(OrderPlanDetail, { order: ordObj, runs, machines, orders, auditLog, can, openModal: setModal, onClose: close, act }),
    modal && modal.kind === "assign" && (ordObj || macObj) && rkh(AssignModal, { order: ordObj || undefined, orders, machines, runs, staff, fixedMachine: macObj || undefined, initialStage: modal.stageKey, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "output" && run && rkh(OutputModal, { run, orders, machines, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "pause" && run && rkh(PauseModal, { run, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "finish" && run && rkh(FinishRunModal, { run, orders, runs, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "cancel" && run && rkh(CancelRunModal, { run, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "history" && macObj && rkh(MachineHistoryModal, { machine: macObj, runs, orders, entries, onClose: close }),
    modal && modal.kind === "status" && macObj && rkh(MachineStatusModal, { machine: macObj, isAdmin: canEdit, canDelete: isAdmin, onClose: close, onSave: (id, st, note) => onUpdateMachine(id, st, note), onDelete: onDeleteMachine }),
    modal && modal.kind === "complete" && ordObj && rkh(CompleteOrderModal, { order: ordObj, runs, onClose: close, onDone: m => notify(m) }));
}
