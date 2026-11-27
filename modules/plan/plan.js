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
      i > 0 && rkh("span", { style: { color: COLORS.textFaint, fontSize: FZ(12) } }, "›"),
      rkh("span", { title: `${amgStageLabel(k)} — ${st.state === "complete" ? "đã hoàn thành" : st.state === "running" ? "đang chạy" : st.state === "paused" ? "tạm dừng" : st.state === "assigned" ? "đã phân máy" : "chưa phân máy"} · ${fmtNum(st.done)}${st.qty ? " / " + fmtNum(st.qty) : ""}`,
        className: live ? "pulse-dot" : undefined,
        style: { fontSize: compact ? 10.5 : 11.5, fontWeight: 700, padding: compact ? "2px 6px" : "3px 8px", borderRadius: 999, whiteSpace: "nowrap", border: `1px solid ${c}`, background: solid ? c : `${c}${st.state === "unassigned" ? "10" : "26"}`, color: solid ? "#fff" : c } },
        (solid ? "✓ " : "") + amgStageLabel(k)));
  }));
}
function amgKpiTile(label, value, color, active, onClick, sub) {
  return rkh(onClick ? "button" : "div", { key: label, type: onClick ? "button" : undefined, onClick, className: "amg-kpi" + (active ? " amg-kpi--on" : ""), "aria-pressed": onClick ? !!active : undefined,
    style: { "--amg-kpi-c": color, borderLeftColor: color, background: active ? `${color}12` : COLORS.bgPanel } },
    rkh("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" } }, label),
    rkh("div", { className: "mes-mono mes-display", style: { fontSize: FZ(26), fontWeight: 800, color, lineHeight: 1.1 } }, value),
    sub && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 2 } }, sub));
}

// Máy đang phụ trách đơn: mỗi lệnh mở = một chip "KT-01 · Đang chạy" (rê chuột xem công đoạn/người vận hành/sản lượng)
function RunChips({ openRuns }) {
  if (!openRuns || openRuns.length === 0) return rkh("span", { style: { color: COLORS.textFaint, fontSize: FZ(12) } }, "Chưa có máy");
  return rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, openRuns.map(r => {
    const m = amgRunStatusMeta(r.productionStatus);
    return rkh("span", { key: r.id, className: "amg-pill mes-mono", title: `${r.machineId} · ${amgStageLabel(r.stageKey)} · ${m.label} · ${r.operator || "—"} · ${fmtNum(r.producedQuantity || 0)}/${fmtNum(r.plannedQuantity)}`, style: { background: m.color + "1f", color: m.color, border: `1px solid ${m.color}55` } }, r.machineId);
  }));
}
/* ---------- v54: bảng Kế hoạch sản xuất — bố cục cột chuyên nghiệp ----------
   8 cột, mỗi ô tự xuống dòng (không cắt chữ, không chồng chữ). Không còn cột Mã đơn: đơn gọi bằng Khách hàng + Quy cách.
   Rộng ≥ AMG_PLAN_WIDE_MIN: bảng nhiều cột; hẹp hơn: thẻ gọn có đủ thông tin. */
const AMG_PLAN_WIDE_MIN = 1180;
const AMG_PLAN_COLS = "minmax(190px,2fr) 118px minmax(170px,1.55fr) minmax(176px,1.45fr) minmax(112px,1fr) 100px 124px 108px";
const AMG_PLAN_HEAD = [["Đơn hàng", ""], ["Số lượng", ""], ["Quy trình", ""], ["Tiến độ công đoạn", ""], ["Máy phụ trách", ""], ["Ngày giao", ""], ["Trạng thái", ""], ["Thao tác", "r"]];

// Người vận hành + ca của các lệnh đang mở (đọc từ chính lệnh máy)
function RunWho({ openRuns }) {
  const rs = openRuns || [], ops = [...new Set(rs.map(r => r.operator).filter(Boolean))], sh = [...new Set(rs.map(r => r.shift).filter(Boolean))];
  if (!rs.length) return null;
  return rkh("div", { "data-col": "who", className: "pl-sub", style: { marginTop: 4 } }, `${ops.join(", ") || "Chưa có người vận hành"}${sh.length ? " · " + sh.join(", ") : ""}`);
}
function PlanRow({ i, wide, runs, can, openModal }) {
  const o = i.order, bm = amgBucketMeta(i.bucket), info = i.info, rdy = amgOrderReadiness(o), un = amgOrderUnit(o);
  const dueColor = i.life.overdue ? COLORS.red : i.life.dueSoon ? COLORS.amber : COLORS.text;
  const pill = (c, t) => rkh("span", { className: "amg-pill", style: { background: c + "1f", color: c } }, t);
  const hasPrio = o.priority && o.priority !== "normal";
  const cust = rkh("div", { className: "pl-cell", "data-col": "order" },
    rkh("div", { className: "pl-main", title: o.customer || "" }, o.customer || "—"),
    rkh("div", { className: "pl-spec mes-mono", title: o.spec || "" }, o.spec || "—"),
    rkh("div", { className: "pl-tags" }, o.materialCode ? rkh("span", { className: "pl-tag" }, "NL " + o.materialCode) : null, hasPrio ? rkh(PriorityBadge, { value: o.priority }) : null));
  const qty = rkh("div", { className: "pl-cell", "data-col": "qty" },
    rkh("div", { className: "pl-main pl-num mes-mono" }, fmtNum(o.quantity), rkh("span", { className: "amg-unit" }, un)),
    rkh("div", { "data-col": "finished", className: "pl-sub pl-num" }, `Xong ${fmtNum(rdy.finished)}`),
    rkh("div", { className: "pl-sub pl-num" }, `Còn ${fmtNum(Math.max(0, (rdy.qty || 0) - rdy.finished))}`));
  const progress = rkh("div", { className: "pl-cell", "data-col": "progress" }, info ? rkh(React.Fragment, null,
    rkh("div", { style: { fontSize: FZ(12.5), fontWeight: 800, color: amgStageColor(i.stageKey), marginBottom: 4 } }, amgStageLabel(i.stageKey)),
    rkh("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, rkh("div", { style: { flex: 1, minWidth: 40 } }, rkh(ProgressBar, { pct: info.pct })), rkh("span", { className: "mes-mono pl-num", style: { fontSize: FZ(12.5), fontWeight: 700, flexShrink: 0 } }, info.pct === null ? "—" : Math.round(info.pct) + "%")),
    rkh("div", { className: "pl-sub pl-num", style: { marginTop: 4 } }, `${fmtNum(info.done)} / ${fmtNum(info.qty)} · còn ${info.remain === null ? "—" : fmtNum(Math.max(0, info.remain))}`)) :
    rkh("span", { style: { color: COLORS.violet, fontWeight: 800, fontSize: FZ(12.5) } }, "Đủ công đoạn"));
  const due = rkh("div", { className: "pl-cell mes-mono pl-num", "data-col": "due", style: { color: dueColor, fontWeight: i.life.overdue || i.life.dueSoon ? 800 : 600 } }, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—",
    i.life.overdue && rkh("div", { className: "pl-sub", style: { color: COLORS.red, fontWeight: 700 } }, "Quá hạn"),
    i.life.dueSoon && !i.life.overdue && rkh("div", { className: "pl-sub", style: { color: COLORS.amber, fontWeight: 700 } }, i.life.days === 0 ? "Hôm nay" : `Còn ${i.life.days} ngày`));
  const machines = rkh("div", { className: "pl-cell", "data-col": "machines" }, rkh(RunChips, { openRuns: i.openRuns }), rkh(RunWho, { openRuns: i.openRuns }));
  const status = rkh("div", { className: "pl-cell", "data-col": "status" }, pill(bm.color, bm.label));
  const act = rkh("div", { className: "pl-act", onClick: e => e.stopPropagation() },
    can.plan && i.stageKey && i.bucket !== "stage_done" && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "assign", orderId: o.id, stageKey: i.stageKey }) }, "Phân máy"),
    can.manager && i.bucket === "stage_done" && rkh(Button, { size: "sm", variant: "primary", onClick: () => can.completeOrder(o) }, "HOÀN THÀNH ĐƠN"),
    rkh(Button, { size: "sm", onClick: () => openModal({ kind: "detail", orderId: o.id }) }, "Chi tiết"));
  const click = () => openModal({ kind: "detail", orderId: o.id });
  if (wide) return rkh("div", { className: "amg-row pl-row", "data-order": o.id, style: { "--pl-cols": AMG_PLAN_COLS, borderLeftColor: bm.color }, onClick: click },
    cust, qty, rkh("div", { className: "pl-cell" }, rkh(StageChips, { order: o, runs, compact: true })), progress, machines, due, status, act);
  return rkh("div", { className: "amg-row pl-row pl-row--card", "data-order": o.id, style: { borderLeftColor: bm.color }, onClick: click },
    rkh("div", { className: "pl-card-top" }, rkh("div", { style: { flex: "1 1 200px", minWidth: 0 } }, cust), rkh("div", { className: "pl-card-st" }, status, due)),
    rkh(StageChips, { order: o, runs, compact: true }),
    rkh("div", { className: "pl-card-grid" }, rkh(KV, { label: "Số lượng" }, qty), rkh(KV, { label: "Tiến độ công đoạn" }, progress), rkh(KV, { label: "Máy phụ trách" }, machines)),
    act);
}


/* ---------- Kiểm tra dữ liệu lệnh: phát hiện lệnh thiếu khóa, trùng, mồ côi, khóa máy lệch ---------- */
function IntegrityPanel({ issues, runs, can, openModal, act }) {
  const [open, setOpen] = useState(false);
  const real = issues.filter(i => i.severity !== "info"), info = issues.length - real.length;
  if (real.length === 0) return info > 0 ? rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginBottom: 10 } }, `ℹ ${info} lệnh cũ thiếu trường trạng thái đã được hệ thống suy ra tự động (không ảnh hưởng hiển thị).`) : null;
  const errs = real.filter(i => i.severity === "error").length;
  const tone = errs ? COLORS.red : COLORS.amber;
  const closeBtn = id => { const r = runs.find(x => x.id === id); if (!r || !amgRunIsLive(r)) return null; return rkh(Button, { key: "c" + id, size: "sm", variant: (r.producedQuantity || 0) === 0 ? "danger" : undefined, onClick: () => openModal({ kind: (r.producedQuantity || 0) === 0 ? "cancel" : "finish", runId: id }) }, ((r.producedQuantity || 0) === 0 ? "Hủy lệnh " : "Kết thúc lệnh ") + id.slice(-6)); };
  return rkh("div", { className: "mes-card", style: { marginBottom: 12, borderLeft: `5px solid ${tone}`, padding: "10px 14px" } },
    rkh("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" } },
      rkh("b", { style: { color: tone, fontSize: FZ(14) } }, `⚠ Kiểm tra dữ liệu lệnh: ${errs} lỗi, ${real.length - errs} cảnh báo`),
      rkh(Button, { size: "sm", onClick: () => setOpen(o => !o) }, open ? "Thu gọn" : "Xem chi tiết")),
    open && rkh("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 } }, real.map(i => {
      const mid = i.machineId, openIds = amgOpenRunsOfMachine(runs, mid).map(r => r.id);
      return rkh("div", { key: i.id, style: { padding: "8px 10px", borderRadius: 8, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, fontSize: FZ(13) } },
        rkh("div", { style: { color: i.severity === "error" ? COLORS.red : COLORS.amber, fontWeight: 700, marginBottom: can.plan && i.fix ? 6 : 0 } }, i.text),
        can.plan && i.fix && rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          i.fix === "relock" && mid && rkh(Button, { size: "sm", variant: "primary", onClick: () => act(() => amgFlowRelockMachine(mid, openIds), `Đã đồng bộ khóa máy ${mid}`) }, "Đồng bộ khóa máy"),
          (i.fix === "cancel" || i.fix === "close") && closeBtn(i.runId),
          i.fix === "keep-one" && amgOpenRunsOfMachine(runs, mid).slice(1).map(r => closeBtn(r.id))));
    })));
}

/* Đơn CHƯA xác nhận quy trình: xử lý riêng — hệ thống không suy diễn công đoạn, không cho phân lệnh cho tới khi người có quyền tích và xác nhận */
function UnconfirmedPanel({ orders, isAdmin, openModal }) {
  const [open, setOpen] = useState(false);
  return rkh("div", { className: "mes-card", style: { marginBottom: 12, padding: "10px 14px", borderLeft: `5px solid ${COLORS.amber}` } },
    rkh("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" } },
      rkh("div", null, rkh("b", { style: { color: COLORS.amber, fontSize: FZ(14) } }, `⚠ ${orders.length} đơn chưa xác nhận quy trình — chưa được phân lệnh`),
        rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim, marginTop: 2 } }, "Hệ thống không tự suy công đoạn từ quy cách. Quản đốc/Admin tích công đoạn cần làm và xác nhận để đơn vào kế hoạch.")),
      rkh(Button, { size: "sm", onClick: () => setOpen(o => !o) }, open ? "Thu gọn" : "Xem danh sách")),
    open && rkh("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 4 } }, orders.slice(0, 60).map(o => rkh("div", { key: o.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 8px", borderRadius: 8, background: COLORS.bgInset, fontSize: FZ(13) } },
      rkh("span", null, rkh("b", null, o.customer || "—"), ` · ${o.spec || "—"} · ${fmtNum(o.quantity)} ${amgOrderUnit(o)}`),
      isAdmin ? rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "routing", orderId: o.id }) }, "Xác nhận quy trình") : rkh("span", { style: { color: COLORS.textFaint } }, "Chờ Quản đốc/Admin xác nhận")))));
}

/* ===================== MÀN 1: KẾ HOẠCH & PHÂN CÔNG ===================== */
function PlanBoard({ orders, machines, runs, can, openModal, isAdmin, initialQ, initialOrderId }) {
  const [q, setQ] = useState(initialQ || "");
  const [only, setOnly] = useState(initialOrderId || ""); // lọc theo một đơn (đi từ Đơn hàng / Điều hành) — không phải gõ mã
  const [bucket, setBucket] = useState("all");
  const [stage, setStage] = useState("all");
  const [prio, setPrio] = useState("all");
  const [fMachine, setFMachine] = useState("all");
  const [fCust, setFCust] = useState("all");
  const [dFrom, setDFrom] = useState(""), [dTo, setDTo] = useState("");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const [boxRef, boxW] = useBoxWidth();
  const wide = !boxW || boxW >= AMG_PLAN_WIDE_MIN;
  const items = useMemo(() => orders
    .filter(o => amgIsActiveOrder(o) && amgIsFlowOrder(o))
    .map(o => Object.assign({ order: o }, amgPlanBucket(o, runs), { life: amgOrderLifecycle(o, runs) }))
    .sort((a, b) => (amgPriorityMeta(a.order.priority).rank - amgPriorityMeta(b.order.priority).rank) || String(a.order.deliveryDate || "9999").localeCompare(String(b.order.deliveryDate || "9999")) || String(a.order.customer || "").localeCompare(String(b.order.customer || "")) || String(a.order.id).localeCompare(String(b.order.id))), [orders, runs]);
  const counts = {};
  ["unassigned", "assigned", "running", "paused", "stage_done", "waiting_next"].forEach(k => { counts[k] = items.filter(i => i.bucket === k).length; });
  const unconfirmed = useMemo(() => amgUnconfirmedOrders(orders), [orders]);
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
    if (only && i.order.id !== only) return false;
    if (!t) return true;
    const machinesOf = amgRunsOfOrder(runs, i.order.id).map(r => r.machineId).join(" ");
    return [i.order.customer, i.order.spec, i.order.materialCode, i.order.note, machinesOf].some(v => String(v || "").toLowerCase().includes(t));
  });
  useEffect(() => { setPage(1); }, [q, bucket, stage, prio, fMachine, fCust, dFrom, dTo, pageSize, only]);
  const pg = amgPaginate(list, page, pageSize);
  const machineGroups = useMemo(() => {
    const g = {}; (machines || []).forEach(m => { const k = m.typeLabel || m.typeKey || "Khác"; (g[k] = g[k] || []).push(m.id); });
    return Object.keys(g).map(k => [k, g[k].sort(amgNaturalCmp)]);
  }, [machines]);
  const cols = [
    { key: "customer", label: "Khách hàng", export: i => i.order.customer },
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
  const dirty = only || q || bucket !== "all" || stage !== "all" || prio !== "all" || fMachine !== "all" || fCust !== "all" || dFrom || dTo;
  return rkh("div", null,
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 14 } },
      ["unassigned", "assigned", "running", "paused", "stage_done", "waiting_next"].map(k => { const m = amgBucketMeta(k); return amgKpiTile(m.label, counts[k], m.color, bucket === k, () => setBucket(b => (b === k ? "all" : k))); })),
    rkh("div", { className: "amg-toolbar", style: { marginBottom: 10 } },
      rkh("div", { style: { position: "relative", flex: "1 1 220px", minWidth: 200 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }),
        rkh("input", { className: "mes-input", style: { paddingLeft: 30, width: "100%" }, placeholder: "Tìm khách hàng, quy cách, nguyên liệu, mã máy...", value: q, onChange: e => setQ(e.target.value) })),
      rkh("select", Object.assign({ value: fMachine, onChange: e => setFMachine(e.target.value), title: "Lọc theo máy đang giữ lệnh" }, sel), rkh("option", { value: "all" }, "Mọi máy"), rkh("option", { value: "none" }, "Chưa có máy"), machineGroups.map(([g, ids]) => rkh("optgroup", { key: g, label: g }, ids.map(id => rkh("option", { key: id, value: id }, id))))),
      rkh("select", Object.assign({ value: stage, onChange: e => setStage(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => rkh("option", { key: s.key, value: s.key }, s.label))),
      rkh("select", Object.assign({ value: fCust, onChange: e => setFCust(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi khách hàng"), customers.map(c => rkh("option", { key: c, value: c }, c))),
      rkh("select", Object.assign({ value: bucket, onChange: e => setBucket(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi trạng thái"), ["unassigned", "assigned", "running", "paused", "waiting_next", "stage_done"].map(k => rkh("option", { key: k, value: k }, amgBucketMeta(k).label))),
      rkh("select", Object.assign({ value: prio, onChange: e => setPrio(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi mức ưu tiên"), AMG_PRIORITY_KEYS.map(k => rkh("option", { key: k, value: k }, amgPriorityMeta(k).label)))),
    rkh("div", { className: "amg-toolbar", style: { marginBottom: 12, fontSize: FZ(12), color: COLORS.textDim } }, "Ngày giao:", dateIn(dFrom, setDFrom, "Giao từ ngày"), "–", dateIn(dTo, setDTo, "Giao đến ngày"),
      dirty && rkh(Button, { size: "sm", variant: "ghost", onClick: () => { setQ(""); setBucket("all"); setStage("all"); setPrio("all"); setFMachine("all"); setFCust("all"); setDFrom(""); setDTo(""); setOnly(""); } }, "Xóa bộ lọc"),
      rkh("span", { style: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" } }, rkh("b", null, `${list.length} / ${items.length} đơn`),
        rkh(Button, { disabled: list.length === 0, onClick: () => amgExportExcel("ke-hoach-san-xuat", cols, list, "Kế hoạch") }, rkh(Download, { size: 14 }), " Xuất Excel"))),
    only && rkh(AmgNotice, { tone: "info" }, `Đang xem riêng đơn: ${amgOrderLabelById(only)}. Bấm "Xóa bộ lọc" để xem toàn bộ kế hoạch.`),
    unconfirmed.length > 0 && rkh(UnconfirmedPanel, { orders: unconfirmed, isAdmin, openModal }),
    rkh("div", { className: "mes-card", ref: boxRef, style: { overflow: "hidden" } },
      list.length === 0 ? rkh(EmptyState, { title: items.length === 0 ? "Chưa có đơn nào trong kế hoạch" : "Không có đơn phù hợp bộ lọc", hint: items.length === 0 ? "Tạo đơn ở tab Đơn hàng và tích các công đoạn cần làm — đơn sẽ tự xuất hiện tại đây." : undefined }) :
        rkh("div", null,
          wide && rkh("div", { className: "pl-hdr", style: { "--pl-cols": AMG_PLAN_COLS } }, AMG_PLAN_HEAD.map(([h, al], k) => rkh("div", { key: k, style: { textAlign: al === "r" ? "right" : "left" } }, h))),
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
  const rows = [["Khách hàng", order.customer || "—"], ["Nguyên liệu", order.materialCode || "—"], ["Quy cách", order.spec || "—"], ["Số lượng", fmtNum(order.quantity)],
    ["Công đoạn hiện tại", cur ? amgStageLabel(cur) : "Đã đủ công đoạn"], ["Công đoạn tiếp theo", next ? amgStageLabel(next) : "—"],
    ["Sản lượng đã chạy", curInfo ? fmtNum(curInfo.done) : fmtNum(prog.completedQty)], ["Số lượng còn lại", curInfo && curInfo.remain !== null ? fmtNum(Math.max(0, curInfo.remain)) : fmtNum(Math.max(0, prog.remainingQty || 0))],
    ["Ngày giao", order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—"], ["Mức ưu tiên", amgPriorityMeta(order.priority).label], ["Thành phẩm / tiến độ", `${fmtNum(prog.completedQty)}${prog.pct === null ? "" : " · " + Math.round(prog.pct) + "%"}`]];
  return rkh(Modal, { title: `Kế hoạch đơn · ${amgOrderLabel(order)}`, onClose, width: 900 },
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, padding: 12, borderRadius: 10, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, marginBottom: 14 } },
      rows.map(([a, b]) => rkh("div", { key: a }, rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, fontWeight: 600 } }, a), rkh("div", { style: { fontSize: FZ(14), fontWeight: 700, wordBreak: "break-word" } }, b)))),
    life.overdue && rkh(AmgNotice, { tone: "err" }, `Đơn quá hạn giao ${Math.abs(life.days)} ngày.`),
    !amgIsFlowOrder(order) && rkh(AmgNotice, { tone: "info" }, "Đơn cũ: công đoạn được suy từ quy cách. Để đơn vào kế hoạch mặc định và có quy trình xác nhận, mở tab Đơn hàng → Chỉnh sửa → Xác nhận quy trình."),
    order.status !== "completed" && rd.allStages && rkh(AmgNotice, { tone: rd.qtyMet ? "ok" : "warn" }, (rd.qtyMet ? "Đã hoàn thành mọi công đoạn và đủ số lượng." : `Đã hoàn thành mọi công đoạn nhưng thành phẩm ${fmtNum(rd.finished)} chưa đủ ${fmtNum(rd.qty)}.`) + (amgRunsOfOrder(runs, order.id).some(amgIsOpenRun) ? " Còn lệnh đang mở — kết thúc lệnh trước khi hoàn thành đơn." : " Bấm HOÀN THÀNH ĐƠN để đóng đơn và chuyển sang Đơn hàng hoàn thành."),
      can.manager && rkh("div", { style: { marginTop: 8 } }, rkh(Button, { size: "sm", variant: "primary", onClick: () => can.completeOrder(order) }, "HOÀN THÀNH ĐƠN"))),
    route.map((k, idx) => {
      const st = amgStageInfo(order, runs, k), c = amgStageColor(k), asg = amgStageAssignable(order, k);
      const stLabel = st.state === "complete" ? "Hoàn thành công đoạn" : st.state === "running" ? "Đang sản xuất" : st.state === "paused" ? "Tạm dừng" : st.state === "assigned" ? "Đã phân máy" : "Chưa phân máy";
      const stColor = st.state === "complete" ? COLORS.violet : st.state === "running" ? COLORS.green : st.state === "paused" ? COLORS.amber : st.state === "assigned" ? COLORS.blue : COLORS.red;
      const stRuns = amgSortRunsDesc(st.runs); const ou = amgOrderUnit(order);
      return rkh("div", { key: k, className: "mes-card", style: { padding: 12, marginBottom: 10, borderLeft: `5px solid ${c}`, opacity: st.state === "complete" ? 0.92 : 1 } },
        rkh("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 } },
          rkh("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, rkh("b", { style: { fontSize: FZ(15), color: c } }, `${idx + 1}. ${amgStageLabel(k)}`), rkh(Badge, { color: stColor }, stLabel)),
          can.plan && st.state !== "complete" && rkh(Button, { size: "sm", variant: asg.ok ? "primary" : undefined, disabled: !asg.ok, title: asg.ok ? "" : asg.reason, onClick: () => openModal({ kind: "assign", orderId: order.id, stageKey: k }) }, "Phân máy")),
        !asg.ok && st.state === "unassigned" && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginBottom: 4 } }, asg.reason),
        rkh("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } }, rkh(ProgressBar, { pct: st.pct, color: c }), rkh("span", { className: "mes-mono", style: { fontSize: FZ(12), flexShrink: 0 } }, `${fmtNum(st.done)} / ${fmtNum(st.qty)} ${ou} · còn ${st.remain === null ? "—" : fmtNum(Math.max(0, st.remain))} ${ou}`)),
        stRuns.length > 0 && rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 620, fontSize: FZ(13) } },
          rkh("tbody", null, stRuns.map(r => {
            const sm = amgRunStatusMeta(r.productionStatus), open = amgIsOpenRun(r);
            return rkh("tr", { key: r.id },
              rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.machineId),
              rkh("td", null, rkh(Badge, { color: sm.color }, sm.label)),
              rkh("td", { className: "mes-mono" }, `${fmtNum(r.producedQuantity || 0)} / ${fmtNum(r.plannedQuantity)} ${r.unit || amgOrderUnit(order)}`),
              rkh("td", null, `${r.operator || "—"} · ${r.shift || "—"}`),
              rkh("td", { style: { fontSize: FZ(12) } }, amgFmtDateTime(r.startedAt || r.assignedAt), r.endedAt ? " → " + amgFmtDateTime(r.endedAt) : ""),
              rkh("td", { style: { whiteSpace: "nowrap" } }, open && rkh("div", { style: { display: "flex", gap: 5, flexWrap: "wrap" } },
                can.output && r.productionStatus === "running" && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "output", runId: r.id }) }, "Ghi sản lượng"),
                can.plan && r.productionStatus === "assigned" && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "start", runId: r.id }) }, "Bắt đầu"),
                rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "rundetail", runId: r.id }) }, "Chi tiết"),
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
  return rkh("div", { style: { marginTop: 10 } }, rkh("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, marginBottom: 6 } }, "LỊCH SỬ PHÂN MÁY & THAY ĐỔI LỆNH"),
    rkh("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, rows.map((a, i) => rkh("div", { key: a.id || i, style: { fontSize: FZ(12), padding: "5px 8px", borderRadius: 6, background: COLORS.bgInset } },
      rkh("span", { className: "mes-mono", style: { color: COLORS.textFaint } }, amgFmtDateTime(a.ts && a.ts.toDate ? a.ts.toDate() : a.ts) + " · "), rkh("b", null, (a.user || a.userName || "—") + ": "), a.detail || a.action || ""))));
}

/* ===================== THẺ MÁY ===================== */
function MachineCard({ machine, runs, orders, can, openModal, act, tv }) {
  const state = amgMachineCardState(machine, runs), meta = amgCardStatusMeta(state);
  const run = amgOpenRunOfMachine(runs, machine.id);
  const oi = run ? amgRunOrderInfo(run, orders) : null;
  const down = machine.status === "broken" || machine.status === "maintenance";
  const live = !!run && (run.productionStatus === "running" || run.productionStatus === "paused");
  const now = amgUseNow(live); // đồng hồ chạy: tính từ mốc thời gian đã lưu, không ghi Firebase
  const unit = run ? (run.unit || (oi && oi.order ? amgOrderUnit(oi.order) : "kg")) : "kg";
  const tm = run ? amgRunTiming(run, now, oi && oi.order) : null;
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
            rkh("div", { className: "mes-mono", style: { fontSize: S.big + 2, fontWeight: 800, color: tv ? "#fff" : COLORS.text } }, oi.customer || "—"),
            rkh("span", { style: { fontSize: tv ? 16 : 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: `${stageC}30`, color: stageC, border: `1px solid ${stageC}` } }, amgStageLabel(run.stageKey))),
          rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 12 : 8 } },
            field("Hạn giao", oi.order && oi.order.deliveryDate ? amgFmtDate(oi.order.deliveryDate) : "—"), field("Nguyên liệu", oi.materialCode || "—"), field("Quy cách", oi.spec || "—"), field("Số lượng kế hoạch", `${fmtNum(planned)} ${unit}`)),
          rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 12 : 8 } },
            field(`Đã sản xuất (${unit})`, fmtNum(produced), true), field(`Còn lại (${unit})`, fmtNum(remain), true)),
          rkh("div", null,
            rkh("div", { style: { display: "flex", justifyContent: "space-between", fontSize: S.label + 1, fontWeight: 700, color: tv ? "#B7C6E0" : COLORS.textDim, marginBottom: 3 } }, rkh("span", null, "Tiến độ lệnh"), rkh("span", { className: "mes-mono" }, pct === null ? "—" : Math.round(pct) + "%")),
            rkh("div", { style: { height: tv ? 16 : 10, borderRadius: 8, background: tv ? "#1B3358" : COLORS.bgInset, overflow: "hidden" } }, rkh("div", { style: { width: Math.min(100, pct || 0) + "%", height: "100%", background: pct !== null && pct >= 100 ? COLORS.green : meta.color, transition: "width .4s" } })),
            stInfo && rkh("div", { style: { fontSize: S.label + 1, color: tv ? "#8EA3C2" : COLORS.textFaint, marginTop: 3 } }, `Công đoạn của đơn: ${fmtNum(stInfo.done)} / ${fmtNum(stInfo.qty)} ${unit}`)),
          run.startedAt && rkh("div", { className: "amg-clockrow" + (tv ? " amg-clockrow--tv" : "") },
            rkh("div", { className: "mes-mono amg-clock" + (tv ? " amg-clock--tv" : ""), style: { color: run.productionStatus === "running" ? (tv ? "#7CF2A6" : COLORS.green) : run.productionStatus === "paused" ? COLORS.amber : undefined } }, amgClock(tm.netMs)),
            rkh("div", { className: "amg-clock-l" + (tv ? " amg-clock-l--tv" : "") }, run.productionStatus === "paused" ? "thời gian sản xuất thực tế · ĐANG TẠM DỪNG" : "thời gian sản xuất thực tế")),
          run.startedAt && rkh(RunMetrics, { run, order: oi && oi.order, now, tv, compact: true }),
          rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 10 : 7 } },
            field("Người vận hành", run.operator || "—"), field("Tổ", run.team || amgTeamOfStage(run.stageKey) || "—"), field("Ca", run.shift || "—"), field("Trạng thái lệnh", run.startedAt ? amgRunStatusMeta(run.productionStatus).label : "Chưa bắt đầu chạy"))),
      warns.length > 0 && rkh("div", { style: { fontSize: tv ? 16 : 11.5, color: tv ? "#FFD27A" : COLORS.amber, fontWeight: 700, lineHeight: 1.45 } }, warns.map((w, i) => rkh("div", { key: i }, "⚠ " + w)))),
    !tv && rkh("div", { className: "mes-no-print", style: { padding: "0 14px 12px", display: "flex", gap: 6, flexWrap: "wrap" } },
      run && can.output && run.productionStatus === "running" && !down && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "output", runId: run.id }) }, "Ghi sản lượng"),
      run && can.plan && run.productionStatus === "assigned" && !down && rkh(Button, { size: "sm", variant: "primary", onClick: () => openModal({ kind: "start", runId: run.id }) }, "Bắt đầu chạy"),
      run && can.plan && run.productionStatus === "running" && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "pause", runId: run.id }) }, "Tạm dừng"),
      run && can.plan && run.productionStatus === "paused" && !down && rkh(Button, { size: "sm", onClick: () => act(() => amgFlowResume(run.id), `Đã tiếp tục chạy máy ${machine.id}`) }, "Tiếp tục"),
      run && can.plan && rkh(Button, { size: "sm", onClick: () => openModal({ kind: "finish", runId: run.id }) }, "Kết thúc lệnh"),
      run && rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "rundetail", runId: run.id }) }, "Chi tiết lệnh"),
      !run && can.plan && !down && rkh(Button, { size: "sm", variant: "primary", disabled: !amgMachineStage(machine), onClick: () => openModal({ kind: "assign", machineId: machine.id }) }, "Phân lệnh"),
      rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "history", machineId: machine.id }) }, "Lịch sử"),
      can.editMachines && rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "status", machineId: machine.id }) }, "Trạng thái máy")));
}

/* ---------- Màn hình TV nhà xưởng (portal ra ngoài khung ứng dụng để chữ không bị phóng theo zoom) ---------- */
function TVWall({ machines, runs, orders, onClose, initialGroup }) {
  const [group, setGroup] = useState(initialGroup && initialGroup !== "khac" ? initialGroup : "all");
  const [onlyActive, setOnlyActive] = useState(false);
  const [perPage, setPerPage] = useState(8);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const k = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const typeOrder = {}; MACHINE_TYPES.forEach((t, i) => { typeOrder[t.key] = i; });
  const list = useMemo(() => machines.filter(m => (group === "all" || m.typeKey === group) &&
    (!onlyActive || amgOpenRunOfMachine(runs, m.id) || m.status === "broken" || m.status === "maintenance"))
    .sort((a, b) => ((typeOrder[a.typeKey] ?? 99) - (typeOrder[b.typeKey] ?? 99)) || amgNaturalCmp(a.id, b.id)), [machines, runs, group, onlyActive]); // eslint-disable-line
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages]); // eslint-disable-line
  useEffect(() => { if (pages <= 1) return; const t = setInterval(() => setPage(p => (p + 1) % pages), 15000); return () => clearInterval(t); }, [pages]);
  const slice = list.slice(page * perPage, page * perPage + perPage);
  const cnt = { running: 0, assigned: 0, paused: 0, idle: 0, broken: 0, maintenance: 0 };
  machines.forEach(m => { cnt[amgMachineCardState(m, runs)]++; });
  const sel = { padding: "8px 10px", borderRadius: 8, border: "1px solid #35496E", background: "#17294A", color: "#fff", fontSize: FZ(16) };
  const node = rkh("div", { style: { position: "fixed", inset: 0, zIndex: 9000, background: "#071426", color: "#fff", display: "flex", flexDirection: "column", fontFamily: FONT_BODY } },
    rkh("div", { style: { display: "flex", alignItems: "center", gap: 18, padding: "12px 22px", background: "#0B2A4A", borderBottom: "3px solid #D6111C", flexWrap: "wrap" } },
      rkh("div", { style: { fontSize: FZ(28), fontWeight: 800, letterSpacing: ".02em" } }, "AOMAGA · THẺ MÁY SẢN XUẤT"),
      rkh("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", fontSize: FZ(18), fontWeight: 700 } },
        ["running", "assigned", "paused", "idle", "broken", "maintenance"].map(k => { const m = amgCardStatusMeta(k); return rkh("span", { key: k, style: { color: m.color === COLORS.violet ? "#C4B0FF" : m.color, background: "#0A1424", padding: "3px 12px", borderRadius: 999, border: `2px solid ${m.color}` } }, `${m.label.toLowerCase()}: ${cnt[k]}`); })),
      rkh("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
        rkh("select", { style: sel, value: group, onChange: e => { setGroup(e.target.value); setPage(0); } }, rkh("option", { value: "all" }, "Tất cả nhóm máy"), MACHINE_TYPES.map(t => rkh("option", { key: t.key, value: t.key }, t.label))),
        rkh("label", { style: { fontSize: FZ(16), display: "flex", alignItems: "center", gap: 6 } }, rkh("input", { type: "checkbox", checked: onlyActive, onChange: e => { setOnlyActive(e.target.checked); setPage(0); }, style: { width: 18, height: 18 } }), "Chỉ máy có lệnh/sự cố"),
        rkh("select", { style: sel, value: perPage, onChange: e => { setPerPage(Number(e.target.value)); setPage(0); } }, [4, 6, 8, 12].map(n => rkh("option", { key: n, value: n }, `${n} thẻ/trang`))),
        rkh("div", { className: "mes-mono", style: { fontSize: FZ(30), fontWeight: 800, minWidth: 120, textAlign: "right" } }, now.toLocaleTimeString("vi-VN")),
        rkh("button", { onClick: () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); }, style: Object.assign({ cursor: "pointer" }, sel) }, "Toàn màn hình"),
        rkh("button", { onClick: onClose, style: Object.assign({ cursor: "pointer", background: "#D6111C", border: "none", fontWeight: 800 }, sel) }, "Thoát (Esc)"))),
    rkh("div", { style: { flex: 1, overflow: "auto", padding: 18 } },
      list.length === 0 ? rkh("div", { style: { textAlign: "center", fontSize: FZ(28), color: "#7C93B8", marginTop: 80 } }, "Không có máy phù hợp bộ lọc") :
        rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 16, alignItems: "stretch" } },
          slice.map(m => rkh(MachineCard, { key: m.id, machine: m, runs, orders, can: {}, openModal: () => {}, act: () => {}, tv: true })))),
    rkh("div", { style: { padding: "8px 22px", background: "#0B2A4A", fontSize: FZ(16), color: "#B7C6E0", display: "flex", justifyContent: "space-between" } },
      rkh("span", null, `Trang ${page + 1}/${pages} · ${list.length} máy · tự chuyển trang mỗi 15 giây · dữ liệu cập nhật trực tiếp`), rkh("span", null, "Nhấn Esc để thoát")));
  return typeof ReactDOM !== "undefined" && ReactDOM.createPortal ? ReactDOM.createPortal(node, document.body) : node;
}

/* ===================== MÀN 2: GIÁM SÁT MÁY MÓC ===================== */
// v56: tab "Thẻ máy" là Trung tâm điều hành sản xuất (modules/plan/command_center.js): KPI, cảnh báo, thanh công đoạn, tìm kiếm, Lưới/Danh sách.
// "Danh mục máy & trạng thái" và Màn hình TV giữ nguyên chức năng.
function MonitorScreen({ machines, runs, orders, entries, can, openModal, act, catalogProps, initialQ, focusMachineId, initialStatus }) {
  const [sub, setSub] = useState("cards");
  const [tv, setTv] = useState(null); // null = tắt; ngược lại là nhóm máy khởi tạo của màn hình TV
  const subBtn = (k, label) => rkh("button", { key: k, onClick: () => setSub(k), style: { background: "none", border: "none", cursor: "pointer", padding: "8px 4px", marginRight: 18, fontWeight: 700, fontSize: FZ(14), color: sub === k ? COLORS.copperBright : COLORS.textDim, borderBottom: sub === k ? `2px solid ${COLORS.copper}` : "2px solid transparent" } }, label);
  return rkh("div", null,
    rkh("div", { style: { display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 } }, subBtn("cards", "Trung tâm điều hành máy"), subBtn("catalog", "Danh mục máy & trạng thái")),
    sub === "catalog" ? rkh("div", null, rkh(MachinesPage, catalogProps)) :
      rkh("div", null,
        rkh(CommandCenter, { machines, runs, orders, can, openModal, act, initialQ: initialQ || "", focusMachineId, initialStatus, onTv: g => setTv(g || "all") }),
        tv !== null && rkh(TVWall, { machines, runs, orders, initialGroup: tv, onClose: () => setTv(null) })));
}

/* ===================== TRANG KẾ HOẠCH SẢN XUẤT ===================== */
function PlanPage({ orders, machines, runs, entries, flowError, auditLog, staff, currentUser, isAdmin, canEdit, onUpdateOrder, onNavigate, onUpdateMachine, onAddMachine, onDeleteMachine, onRestoreSeed }) {
  const { showAlert } = useDialog();
  const focus0 = useState(() => amgTakeFocus("machines"))[0]; // từ tìm kiếm toàn hệ thống (máy / lệnh sản xuất)
  const [screen, setScreen] = useState(focus0 && focus0.screen ? focus0.screen : "plan");
  // Điều hướng từ Điều hành / Đơn hàng / tìm kiếm: mở sẵn đúng hộp thoại cho đúng đối tượng (quyền vẫn được kiểm tra lại ở tầng nghiệp vụ)
  const [modal, setModal] = useState(() => {
    const f = focus0; if (!f) return null;
    if (f.assign && amgFlowCan(currentUser, "plan")) return { kind: "assign", orderId: f.assign.orderId, stageKey: f.assign.stageKey, machineId: f.assign.machineId };
    if (f.output && amgFlowCan(currentUser, "output")) return { kind: "output", runId: f.output };
    if (f.history) return { kind: "history", machineId: f.history };
    if (f.orderDetail) return { kind: "detail", orderId: f.orderDetail };
    if (f.runDetail) return { kind: "rundetail", runId: f.runDetail }; // v55: truy xuất ngược từ tab Theo dõi thời gian dừng máy về lệnh/kế hoạch gốc
    return null;
  });
  const [toast, setToast] = useState(null);
  const busyComplete = React.useRef({});
  const can = { plan: amgFlowCan(currentUser, "plan"), output: amgFlowCan(currentUser, "output"), manager: amgFlowCan(currentUser, "manager"), editMachines: canEdit };
  const toastTimer = React.useRef(null);
  const notify = (msg, tone, openOrderId) => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast({ msg, tone: tone || "ok", openOrderId: openOrderId || null }); toastTimer.current = setTimeout(() => { toastTimer.current = null; setToast(null); }, openOrderId ? 12000 : 6500); };
  // HOÀN THÀNH ĐƠN MỘT BƯỚC: kiểm tra điều kiện → hoàn thành ngay (không hộp xác nhận lần hai). Chỉ khi thiếu số lượng mới mở hộp nhập lý do (bắt buộc theo quy định).
  async function completeOrderNow(order) {
    if (!order || busyComplete.current[order.id]) return;
    busyComplete.current[order.id] = true;
    try {
      const r = await amgCompleteOrderOneStep(order, runs, { source: "plan" });
      if (r.status === "blocked") { await showAlert(r.blockers.join("\n"), { title: "Chưa hoàn thành được đơn " + amgOrderLabel(order) }); return; }
      if (r.status === "need_reason") { setModal({ kind: "complete", orderId: order.id }); return; }
      setModal(null);
      notify(r.status === "duplicate" ? `Đơn ${amgOrderLabel(order)} đã được hoàn thành trước đó (có thể người khác vừa thực hiện)` : `Đơn ${amgOrderLabel(order)} đã hoàn thành và chuyển sang Đơn hàng hoàn thành`, "ok", order.id);
    } catch (e) { await showAlert(e.message || String(e), { title: "Không hoàn thành được đơn" }); }
    finally { delete busyComplete.current[order.id]; }
  }
  can.completeOrder = completeOrderNow;
  const openCompleted = id => { window.__AMG_FOCUS = { tab: "completed", orderId: id }; if (onNavigate) onNavigate("completed"); };
  async function act(fn, okMsg) {
    try { const r = await fn(); notify(r && r.duplicate ? "Thao tác đã được ghi nhận trước đó" : okMsg); } catch (e) { await showAlert(e.message || String(e), { title: "Không thực hiện được" }); }
  }
  const close = () => setModal(null);
  const issues = useMemo(() => amgRunIssues(runs, orders, machines), [runs, orders, machines]);
  const run = modal && modal.runId ? runs.find(r => r.id === modal.runId) : null;
  const ordObj = modal && modal.orderId ? orders.find(o => o.id === modal.orderId) : null;
  const macObj = modal && modal.machineId ? machines.find(m => m.id === modal.machineId) : null;
  const guide = ["Tạo đơn ở tab Đơn hàng, tích các công đoạn cần làm và xác nhận quy trình — đơn tự xuất hiện ở đây. Đơn chưa xác nhận quy trình nằm riêng và chưa phân lệnh được.",
    "Bấm + Phân lệnh: (1) chọn công đoạn → (2) chọn máy → (3) chọn đơn (chỉ đơn có công đoạn đó trong quy trình) → nhập số lượng kế hoạch, ca, người vận hành → Xác nhận phân lệnh → Xác nhận bắt đầu chạy máy.",
    "Thẻ máy hiện đơn, đồng hồ thời gian sản xuất thực tế, tạm dừng, sản lượng (kg hoặc m) và năng suất trung bình. Ghi sản lượng nhiều lần trong ca ngay trên thẻ máy.",
    "BA VIỆC KHÁC NHAU: Kết thúc lệnh = giải phóng máy · Hoàn thành công đoạn = chuyển công đoạn kế · Hoàn thành đơn = người có quyền bấm HOÀN THÀNH ĐƠN (một bước) sau khi xong công đoạn cuối; kết thúc lệnh không bao giờ tự hoàn thành đơn.",
    "Bấm HOÀN THÀNH ĐƠN là đơn rời ngay mọi danh sách đang hoạt động (Đơn hàng, BOM, kế hoạch, máy) và sang tab Đơn hàng hoàn thành — không cần xác nhận lần hai, không dữ liệu nào bị xóa.",
    "Giám sát máy móc: bấm một nhóm máy để xem ngay các máy của nhóm, gõ mã máy hoặc tên khách hàng/quy cách vào ô tìm kiếm để mở đúng máy hoặc đơn. Màn hình TV: Giám sát máy móc → Màn hình TV (Esc để thoát)."];
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${orders.filter(o => amgIsActiveOrder(o) && amgIsFlowOrder(o)).length} đơn trong kế hoạch · ${machines.filter(m => amgMachineStage(m)).length} máy`, title: "Kế hoạch sản xuất & phân công máy", icon: Cog, iconColor: COLORS.blue,
      action: can.plan && rkh(Button, { variant: "primary", onClick: () => setModal({ kind: "assign" }) }, "+ Phân lệnh (Công đoạn → Máy → Đơn)") }),
    screen === "plan" && rkh(GuideBox, { steps: guide }),
    flowError && rkh(AmgNotice, { tone: "err" }, "⛔ " + flowError),
    can.plan && rkh(IntegrityPanel, { issues, runs, can, openModal: setModal, act }),
    toast && rkh("div", { className: "mes-fade-in", style: { position: "fixed", top: 70, right: 24, zIndex: 4000, maxWidth: 420, padding: "12px 16px", borderRadius: 10, fontSize: FZ(14), fontWeight: 600, color: "#fff", background: toast.tone === "ok" ? COLORS.green : COLORS.red, boxShadow: "0 6px 20px rgba(0,0,0,.3)" } }, toast.msg, toast.openOrderId && onNavigate && rkh("div", { style: { marginTop: 8 } }, rkh(Button, { size: "sm", onClick: () => openCompleted(toast.openOrderId) }, "Mở chi tiết đơn đã hoàn thành"))),
    rkh("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
      [["plan", "Kế hoạch & phân công sản xuất"], ["monitor", "Giám sát máy móc"]].map(([k, l]) => rkh("button", { key: k, onClick: () => setScreen(k), className: "mes-btn", style: { padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: FZ(14), border: `2px solid ${screen === k ? COLORS.copper : COLORS.border}`, background: screen === k ? `${COLORS.copper}16` : COLORS.bgPanel, color: screen === k ? COLORS.copper : COLORS.textDim } }, l))),
    screen === "plan" ? rkh(PlanBoard, { orders, machines, runs, can, openModal: setModal, isAdmin, initialQ: focus0 && focus0.q ? focus0.q : "", initialOrderId: focus0 && focus0.orderId ? focus0.orderId : "" }) :
      rkh(MonitorScreen, { initialQ: focus0 && focus0.q ? focus0.q : "", focusMachineId: focus0 && focus0.machineId ? focus0.machineId : null, initialStatus: focus0 && focus0.status ? focus0.status : "", machines, runs, orders, entries, can, openModal: setModal, act, catalogProps: { machines, isAdmin, canEdit, onUpdateMachine, onAddMachine, onDeleteMachine, onRestoreSeed } }),
    modal && modal.kind === "detail" && ordObj && rkh(OrderPlanDetail, { order: ordObj, runs, machines, orders, auditLog, can, openModal: setModal, onClose: close, act }),
    modal && modal.kind === "assign" && rkh(AssignModal, { order: ordObj || undefined, orders, machines, runs, staff, fixedMachine: macObj || undefined, initialStage: modal.stageKey, onClose: close, onDone: (m, newRun, askStart) => { notify(m); if (askStart && newRun) setTimeout(() => setModal({ kind: "start", runId: newRun.id }), 80); } }),
    modal && modal.kind === "start" && run && rkh(StartConfirmModal, { run, orders, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "rundetail" && run && rkh(RunDetailModal, { run, orders, entries, can, onClose: close }),
    modal && modal.kind === "routing" && ordObj && rkh(OrderEditor, { mode: "edit", order: ordObj, orders, runs, machines, onSave: async ({ f, routing }) => { await onUpdateOrder(Object.assign({ id: ordObj.id }, amgOrderBaseFromEditor(f, routing, currentUser))); notify(`Đã xác nhận quy trình đơn ${ordObj.id} — đơn đã vào kế hoạch`); }, onClose: close }),
    modal && modal.kind === "output" && run && rkh(OutputModal, { run, orders, machines, entries, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "pause" && run && rkh(PauseModal, { run, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "finish" && run && rkh(FinishRunModal, { run, orders, runs, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "cancel" && run && rkh(CancelRunModal, { run, onClose: close, onDone: m => notify(m) }),
    modal && modal.kind === "history" && macObj && rkh(MachineHistoryModal, { machine: macObj, runs, orders, entries, onClose: close }),
    modal && modal.kind === "status" && macObj && rkh(MachineStatusModal, { machine: macObj, isAdmin: canEdit, canDelete: isAdmin, onClose: close, onSave: (id, st, note) => onUpdateMachine(id, st, note), onDelete: onDeleteMachine }),
    modal && modal.kind === "complete" && ordObj && rkh(CompleteOrderModal, { order: ordObj, runs, onClose: close, onDone: (m, id) => notify(m, "ok", id) }));
}
