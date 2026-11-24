/* ===================== TAB ĐƠN HÀNG (v46) =====================
   Giao diện mới của tab Đơn hàng. Dữ liệu vẫn là collection orders; công đoạn lưu bằng stage key chuẩn (STAGES)
   trong order.routing và được getApplicableStages/normalizeOrderStages/orderProgress đọc như bình thường. */

const AMG_ORDER_PROTECTED = ["id", "stages", "finishedDone", "finishedShort", "status", "completedAt", "completedBy", "completionMode", "completionNote", "completedShort", "stageComplete", "statusHistory", "productionStartedAt", "lastCompletedAt", "lastCompletedBy", "lastCompletionSummary", "completionSummary", "openRunIds", "version", "createdAt", "createdBy", "updatedAt", "updatedBy"];

function amgStageMachineText(stageKey, machines) {
  const types = amgStageMachineTypes(stageKey);
  return types.map(t => {
    const list = (machines || []).filter(m => m.typeKey === t.key).map(m => m.id).sort(amgNaturalCmp);
    const range = list.length ? (list.length > 1 ? `${list[0]} … ${list[list.length - 1]}` : list[0]) : `${t.prefix} (chưa có máy)`;
    return types.length > 1 ? `${t.label.replace("Máy ", "")}: ${range}` : range;
  }).join(" · ");
}

/* Trường ghi vào đơn từ biểu mẫu (dùng chung tab Đơn hàng và tab Kế hoạch khi xác nhận quy trình cho đơn cũ) */
function amgOrderBaseFromEditor(f, routing, user) {
  const base = { customer: f.customer.trim(), materialCode: f.materialCode.trim(), spec: f.spec.trim(), quantity: Number(f.quantity), unit: f.unit === "m" ? "m" : "kg", note: f.note.trim(), orderDate: f.orderDate || null, deliveryDate: f.deliveryDate || "", priority: f.priority, inventory: Number(f.inventory) || 0, routing, routingConfirmed: true, routingConfirmedAt: new Date().toISOString(), routingConfirmedBy: (user && user.fullName) || "" };
  // Tương thích mã cũ: đơn chỉ Kéo trung = dây ủ mềm (thành phẩm tại Kéo trung); đơn có Kéo trung + công đoạn khác = dây cứng
  if (routing.length === 1 && routing[0] === "keo_trung") base.wireFinish = "mềm"; else if (routing.indexOf("keo_trung") > -1) base.wireFinish = "cứng";
  return base;
}

/* ---------- Biểu mẫu thêm / sửa đơn ---------- */
function OrderEditor({ mode, order, orders, runs, machines, onSave, onClose }) {
  const { askConfirm } = useDialog();
  const isNew = mode === "add";
  const myRuns = isNew ? [] : amgRunsOfOrder(runs, order.id);
  const openRuns = myRuns.filter(amgIsOpenRun);
  const hasOutput = !isNew && STAGES.some(s => amgStageDone(order, s.key) > 0);
  const lockedStages = new Set();
  if (!isNew) { STAGES.forEach(s => { if (amgStageDone(order, s.key) > 0 || myRuns.some(r => r.stageKey === s.key && r.productionStatus !== "cancelled")) lockedStages.add(s.key); }); }
  // Đơn chưa xác nhận quy trình: KHÔNG tích sẵn công đoạn suy từ quy cách — người dùng tự chọn (có thể bấm "Dùng gợi ý")
  const confirmedBefore = !isNew && amgIsFlowOrder(order);
  const suggestion = !isNew && !confirmedBefore ? amgOrderRoute(order) : [];
  const initialRoute = confirmedBefore ? amgOrderRoute(order) : [];
  const [f, setF] = useState(() => isNew ? { customer: "", code: "", materialCode: "", spec: "", quantity: "", unit: "kg", note: "", orderDate: amgTodayKey(), deliveryDate: "", priority: "normal", inventory: 0 }
    : { customer: order.customer || "", code: order.id, materialCode: order.materialCode || "", spec: order.spec || "", quantity: order.quantity ?? "", unit: amgOrderUnit(order), note: order.note || "", orderDate: order.orderDate || "", deliveryDate: order.deliveryDate || "", priority: order.priority || "normal", inventory: order.inventory || 0 });
  const [routing, setRouting] = useState(initialRoute);
  const [customOrder, setCustomOrder] = useState(!isNew && initialRoute.join() !== STAGES.map(s => s.key).filter(k => initialRoute.includes(k)).join());
  const [step, setStep] = useState(1);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => Object.assign({}, p, { [k]: v }));
  const canon = list => STAGES.map(s => s.key).filter(k => list.includes(k));
  function toggle(k) {
    if (lockedStages.has(k) && routing.includes(k)) return;
    setRouting(r => { const has = r.includes(k); const n = has ? r.filter(x => x !== k) : r.concat([k]); return customOrder ? n : canon(n); });
  }
  function move(k, d) {
    setRouting(r => { const i = r.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= r.length) return r; const n = r.slice(); [n[i], n[j]] = [n[j], n[i]]; return n; });
    setCustomOrder(true);
  }
  function validate() {
    const e = {};
    if (!f.customer.trim()) e.customer = "Nhập tên khách hàng";
    if (!f.spec.trim()) e.spec = "Nhập quy cách";
    const q = Number(f.quantity);
    if (f.quantity === "" || !Number.isFinite(q) || q <= 0) e.quantity = "Số lượng phải lớn hơn 0";
    const code = f.code.trim();
    if (isNew && code) {
      if (!/^[A-Za-z0-9_-]{2,30}$/.test(code)) e.code = "Mã đơn chỉ gồm chữ, số, - hoặc _ (2–30 ký tự)";
      else if (orders.some(o => o.id.toLowerCase() === code.toLowerCase())) e.code = "Mã đơn đã tồn tại";
    }
    if (f.orderDate && f.deliveryDate && f.deliveryDate < f.orderDate) e.deliveryDate = "Ngày giao không được trước ngày nhận";
    if (routing.length === 0) e.routing = "Chọn ít nhất một công đoạn";
    else if (!isNew) { const lost = [...lockedStages].filter(k => routing.indexOf(k) < 0); if (lost.length) e.routing = `Công đoạn ${lost.map(amgStageLabel).join(", ")} đã có sản lượng/lệnh nên phải nằm trong quy trình`; }
    if (!isNew && order.status === "completed") e._all = "Đơn đã hoàn thành — mở lại đơn trước khi sửa";
    setErrs(e);
    return Object.keys(e).length === 0;
  }
  function next() { if (validate()) setStep(2); }
  async function save() {
    if (busy) return;
    if (!isNew) {
      const warns = [];
      if (openRuns.length) warns.push(`Đơn đang có ${openRuns.length} lệnh đang mở trên máy ${openRuns.map(r => r.machineId).join(", ")}.`);
      if (hasOutput) warns.push("Đơn đã có sản lượng — sản lượng đã ghi nhận được giữ nguyên, chỉ số liệu còn lại được tính lại.");
      if (hasOutput && routing[routing.length - 1] !== initialRoute[initialRoute.length - 1]) warns.push("Công đoạn cuối thay đổi nên SẢN LƯỢNG THÀNH PHẨM sẽ tính theo công đoạn cuối mới.");
      if (warns.length && !(await askConfirm(warns.join("\n\n") + "\n\nTiếp tục lưu thay đổi?", { title: "Cảnh báo khi sửa đơn", confirmLabel: "Vẫn lưu" }))) return;
    }
    setBusy(true);
    try { await onSave({ f, routing, isNew }); onClose(); } catch (e) { setErrs({ _all: e.message || String(e) }); setBusy(false); }
  }
  const fieldErr = k => errs[k] && rkh("div", { style: { color: COLORS.red, fontSize: FZ(12), marginTop: 3 } }, errs[k]);
  const fld = (label, k, props, hint) => rkh("div", { style: { marginBottom: 12 } },
    rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, label),
    rkh("input", Object.assign({ className: "mes-input", value: f[k], onChange: e => set(k, e.target.value), style: { width: "100%", borderColor: errs[k] ? COLORS.red : undefined } }, props || {})),
    hint && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 3 } }, hint), fieldErr(k));
  const sectionTitle = t => rkh("div", { style: { fontSize: FZ(13), fontWeight: 800, color: COLORS.copper, margin: "6px 0 10px", paddingBottom: 6, borderBottom: `2px solid ${COLORS.border}` } }, t);

  if (step === 2) {
    const last = routing[routing.length - 1];
    return rkh(Modal, { title: "Xác nhận quy trình sản xuất", onClose, width: 640 },
      rkh(AmgNotice, { tone: "info" }, "Kiểm tra lại quy trình. Sau khi xác nhận, đơn xuất hiện ở tab Kế hoạch sản xuất để phân máy. Chưa cần chọn máy cụ thể ở bước này."),
      rkh("div", { style: { marginBottom: 12, fontSize: FZ(13) } }, rkh("b", null, f.customer), ` · ${f.spec}${f.materialCode ? " · NL " + f.materialCode : ""} · SL ${fmtNum(Number(f.quantity))}`),
      routing.map((k, i) => rkh("div", { key: k, style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 6, borderRadius: 10, border: `1px solid ${amgStageColor(k)}`, background: `${amgStageColor(k)}12` } },
        rkh("div", { className: "mes-mono", style: { width: 26, height: 26, borderRadius: 999, background: amgStageColor(k), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 } }, i + 1),
        rkh("div", { style: { flex: 1, minWidth: 0 } }, rkh("div", { style: { fontWeight: 800, color: amgStageColor(k) } }, amgStageLabel(k), k === last && rkh("span", { style: { fontSize: FZ(12), marginLeft: 8, color: COLORS.green } }, "● công đoạn cuối — tính ĐÃ SẢN XUẤT")),
          rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim } }, "Nhóm máy: " + amgStageMachineText(k, machines))),
        rkh("div", { style: { display: "flex", gap: 4 } }, rkh(Button, { size: "sm", disabled: i === 0, onClick: () => move(k, -1) }, "↑"), rkh(Button, { size: "sm", disabled: i === routing.length - 1, onClick: () => move(k, 1) }, "↓")))),
      errs._all && rkh(AmgNotice, { tone: "err" }, errs._all),
      rkh("div", { style: { display: "flex", gap: 10, justifyContent: "space-between", marginTop: 12 } },
        rkh(Button, { onClick: () => setStep(1) }, "← Quay lại"),
        rkh(Button, { variant: "primary", disabled: busy, onClick: save }, busy ? "Đang lưu..." : "Xác nhận quy trình & lưu đơn")));
  }
  return rkh(Modal, { title: isNew ? "Thêm đơn hàng mới" : `Sửa đơn ${order.id}`, onClose, width: 760 },
    !isNew && (openRuns.length > 0 || hasOutput) && rkh(AmgNotice, { tone: "warn" }, `⚠ ${openRuns.length > 0 ? `Đơn đang được phân máy (${myRuns.filter(r => r.productionStatus !== "cancelled").length} lệnh)` : ""}${openRuns.length > 0 && hasOutput ? " và " : ""}${hasOutput ? "đã có sản lượng" : ""}. Dữ liệu sản xuất đã ghi nhận không bị xóa; công đoạn đã chạy bị khóa không cho bỏ chọn.`),
    !isNew && order.status === "completed" && rkh(AmgNotice, { tone: "err" }, "Đơn đã hoàn thành. Mở lại đơn ở tab Đơn hàng hoàn thành trước khi đổi quy trình."),
    sectionTitle("1. Thông tin đơn hàng"),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 14px" } },
      fld("Khách hàng *", "customer", { placeholder: "ví dụ: HÒA AN" }),
      fld("Mã đơn", "code", { disabled: !isNew, placeholder: "Để trống để tự sinh" }, isNew ? "Tự sinh nếu để trống" : "Không đổi được mã đơn"),
      fld("Nguyên liệu (mã liệu)", "materialCode", { placeholder: "A / B / C ..." }),
      fld("Quy cách *", "spec", { placeholder: "ví dụ: 0.254BC" }),
      fld(`Số lượng (${f.unit}) *`, "quantity", { type: "number", min: 0, step: "any" }),
      rkh("div", { style: { marginBottom: 12 } }, rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, "Đơn vị sản lượng *"),
        rkh("select", { className: "mes-input", value: f.unit, disabled: hasOutput, onChange: e => set("unit", e.target.value) }, AMG_UNITS.map(u => rkh("option", { key: u, value: u }, u === "kg" ? "kg (khối lượng)" : "m (chiều dài)"))),
        rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 3 } }, hasOutput ? "Đơn đã có sản lượng — không đổi được đơn vị" : "Một đơn dùng một đơn vị, không cộng lẫn kg và mét")),
      fld("Tồn kho", "inventory", { type: "number", min: 0, step: "any" }),
      fld("Ngày nhận", "orderDate", { type: "date" }),
      fld("Ngày giao", "deliveryDate", { type: "date" }),
      rkh("div", { style: { marginBottom: 12 } }, rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, "Ưu tiên"),
        rkh("select", { className: "mes-input", value: f.priority, onChange: e => set("priority", e.target.value) }, AMG_PRIORITY_KEYS.map(k => rkh("option", { key: k, value: k }, amgPriorityMeta(k).label)))),
      rkh("div", { style: { marginBottom: 12, gridColumn: "1 / -1" } }, rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, "Ghi chú"), rkh("input", { className: "mes-input", style: { width: "100%" }, value: f.note, onChange: e => set("note", e.target.value) }))),
    sectionTitle("2. Công đoạn sản xuất — tích những công đoạn cần thực hiện"),
    !isNew && !confirmedBefore && order.status !== "completed" && rkh(AmgNotice, { tone: "warn" }, "Đơn này CHƯA xác nhận quy trình nên chưa được phân lệnh. Hệ thống không tự suy công đoạn: hãy tích đúng các công đoạn cần làm rồi xác nhận." + (suggestion.length && routing.length === 0 ? `\nGợi ý theo quy cách (chưa áp dụng): ${suggestion.map(amgStageLabel).join(" → ")}` : ""),
      suggestion.length > 0 && routing.length === 0 && rkh("div", { style: { marginTop: 6 } }, rkh(Button, { size: "sm", onClick: () => setRouting(suggestion) }, "Dùng gợi ý này (vẫn cần xác nhận ở bước sau)"))),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8, marginBottom: 6 } }, STAGES.map(s => {
      const on = routing.includes(s.key), locked = lockedStages.has(s.key) && on;
      return rkh("label", { key: s.key, title: locked ? "Công đoạn đã có lệnh/sản lượng — không thể bỏ chọn" : "", style: { display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, cursor: locked ? "not-allowed" : "pointer", border: `2px solid ${on ? s.color : COLORS.border}`, background: on ? `${s.color}16` : COLORS.bgPanel2 } },
        rkh("input", { type: "checkbox", checked: on, disabled: locked, onChange: () => toggle(s.key), style: { width: 18, height: 18, marginTop: 2, accentColor: s.color } }),
        rkh("div", { style: { minWidth: 0 } }, rkh("div", { style: { fontWeight: 800, color: s.color, fontSize: FZ(14) } }, s.label, locked && " 🔒"), rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim, marginTop: 2 } }, amgStageMachineText(s.key, machines))));
    })),
    fieldErr("routing"),
    routing.length > 1 && rkh("div", { style: { marginTop: 8, fontSize: FZ(13), color: COLORS.textDim } }, "Thứ tự: ", routing.map(amgStageLabel).join(" → "), " · chỉnh thứ tự ở bước xác nhận."),
    errs._all && rkh(AmgNotice, { tone: "err" }, errs._all),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 } }, rkh(Button, { onClick: onClose }, "Hủy"),
      rkh(Button, { variant: "primary", disabled: !isNew && order.status === "completed", onClick: next }, "Tiếp tục: xác nhận quy trình →")));
}

/* ---------- Dòng đơn hàng: lưới cột khi đủ rộng, thẻ dòng gọn khi hẹp (không bao giờ cuộn ngang) ---------- */
const AMG_ORDER_COLS = "38px minmax(110px,1.5fr) minmax(140px,1.8fr) 62px minmax(74px,.9fr) 74px 98px minmax(90px,1.3fr) 82px 90px 82px 112px 112px";
function OrderRow({ r, no, wide, runs, isAdmin, manage, picked, onView, onEdit, onDel, onPick }) {
  const o = r.o, sm = amgOrderStatusMeta(r.life.key), pm = amgPriorityMeta(o.priority);
  const edge = r.life.overdue ? COLORS.red : r.life.dueSoon ? COLORS.amber : r.life.key === "producing" ? COLORS.green : "transparent";
  const dueColor = r.life.overdue ? COLORS.red : r.life.dueSoon ? COLORS.amber : COLORS.text;
  const pill = (m, label) => rkh("span", { className: "amg-pill", style: { background: m + "1f", color: m } }, label);
  const flags = rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, pill(sm.color, sm.label), r.life.overdue && pill(COLORS.red, "Quá hạn"), r.life.dueSoon && !r.life.overdue && pill(COLORS.orange, "Sắp giao"));
  const prog = rkh("div", { style: { minWidth: 0 } }, rkh("div", { className: "mes-mono", style: { fontWeight: 700, color: COLORS.green, fontSize: FZ(13) } }, fmtNum(r.prog.completedQty), rkh("span", { style: { color: COLORS.textFaint, fontWeight: 500 } }, r.prog.pct === null ? "" : ` · ${Math.round(r.prog.pct)}%`)), rkh(ProgressBar, { pct: r.prog.pct }));
  const acts = rkh("div", { onClick: e => e.stopPropagation(), style: { display: "flex", gap: 4, flexWrap: "wrap", justifyContent: wide ? "flex-start" : "flex-end" } },
    manage && isAdmin && rkh(Button, { size: "sm", variant: picked ? "primary" : undefined, onClick: onPick, "aria-pressed": picked }, picked ? "✓ Đã chọn" : "Chọn"),
    rkh(Button, { size: "sm", onClick: onView }, "Xem"), isAdmin && !manage && rkh(Button, { size: "sm", onClick: onEdit }, "Sửa"), isAdmin && !manage && rkh(Button, { size: "sm", variant: "danger", onClick: onDel, title: "Xóa đơn" }, rkh(Trash2, { size: 13 })));
  const cust = rkh("div", { style: { minWidth: 0 } }, rkh(Clamp, { text: o.customer || "—", lines: 2, style: { fontWeight: 800 } }), rkh("div", { className: "mes-mono", title: o.id, style: { fontSize: FZ(12), color: COLORS.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.id));
  const chips = rkh("div", { style: { minWidth: 0 } }, rkh(StageChips, { order: o, runs, compact: true }), !amgIsFlowOrder(o) && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 2 } }, "quy trình suy từ quy cách"));
  const rowStyle = { borderLeftColor: edge };
  const cls = "amg-row" + (picked ? " amg-row--sel" : "");
  const click = manage && isAdmin ? onPick : onView;
  if (wide) {
    return rkh("div", { className: cls, style: Object.assign({ gridTemplateColumns: AMG_ORDER_COLS }, rowStyle), onClick: click },
      rkh("div", { className: "mes-mono", style: { color: COLORS.textFaint } }, no), cust, chips,
      rkh("div", null, o.materialCode || "—"), rkh(Clamp, { text: o.spec, lines: 2, mono: true }),
      rkh("div", { className: "mes-mono", style: { fontWeight: 700, textAlign: "right" } }, fmtNum(o.quantity), rkh("span", { style: { fontSize: FZ(12), color: COLORS.textFaint, fontWeight: 600 } }, " " + amgOrderUnit(o))), prog,
      rkh(Clamp, { text: o.note, lines: 2, style: { fontSize: FZ(12), color: COLORS.textDim } }),
      rkh("div", { className: "mes-mono" }, o.orderDate ? amgFmtDate(o.orderDate) : "—"),
      rkh("div", { className: "mes-mono", style: { color: dueColor, fontWeight: r.life.overdue || r.life.dueSoon ? 800 : 500 } }, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—"),
      pill(pm.color, pm.label), flags, acts);
  }
  return rkh("div", { className: cls + " amg-row--card", style: rowStyle, onClick: click },
    rkh("div", { style: { display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" } },
      rkh("div", { style: { display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0, flex: "1 1 200px" } }, rkh("span", { className: "mes-mono", style: { color: COLORS.textFaint, minWidth: 22 } }, no), cust),
      rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } }, pill(pm.color, pm.label), flags)),
    chips,
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: "6px 12px" } },
      rkh(KV, { label: "Nguyên liệu" }, o.materialCode || "—"), rkh(KV, { label: "Quy cách" }, rkh(Clamp, { text: o.spec, lines: 2, mono: true })),
      rkh(KV, { label: "Số lượng" }, rkh("span", { className: "mes-mono" }, fmtNum(o.quantity) + " " + amgOrderUnit(o))), rkh(KV, { label: "Đã sản xuất" }, prog),
      rkh(KV, { label: "Ngày nhận" }, o.orderDate ? amgFmtDate(o.orderDate) : "—"), rkh(KV, { label: "Ngày giao", style: { color: dueColor } }, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—")),
    o.note && rkh(KV, { label: "Ghi chú" }, rkh(Clamp, { text: o.note, lines: 2, style: { fontWeight: 500, color: COLORS.textDim } })),
    acts);
}

/* ---------- Trang Đơn hàng ---------- */
function OrdersPage({ orders, runs, machines, auditLog, isAdmin, currentUser, onAdd, onUpdate, onDelete, onBulkDelete, onRestoreSeed, extra, completedCount, onNavigate }) {
  const { askConfirm, showAlert } = useDialog();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fCust, setFCust] = useState("all");
  const [fStage, setFStage] = useState("all");
  const [fPrio, setFPrio] = useState("all");
  const [rFrom, setRFrom] = useState(""), [rTo, setRTo] = useState(""), [dFrom, setDFrom] = useState(""), [dTo, setDTo] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [manage, setManage] = useState(false); // chế độ quản lý: chọn nhiều để xóa — KHÔNG còn checkbox cạnh STT
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const [boxRef, boxW] = useBoxWidth();
  const wide = amgIsWide(boxW);
  const rs = runs || [];
  const rows = useMemo(() => orders.map(o => {
    const n = normalizeOrderStages(o);
    return { o, n, prog: orderProgress(n), life: amgOrderLifecycle(o, rs), route: amgOrderRoute(o) };
  }), [orders, rs]);
  const cnt = { all: rows.length, new: 0, waiting: 0, producing: 0, completed: 0, soon: 0, overdue: 0 }; // completed luôn 0: tab này chỉ nhận đơn đang hoạt động
  rows.forEach(r => { cnt[r.life.key]++; if (r.life.dueSoon) cnt.soon++; if (r.life.overdue) cnt.overdue++; });
  const customers = [...new Set(orders.map(o => o.customer || "Chưa rõ"))].sort();
  const t = q.trim().toLowerCase();
  const list = rows.filter(r => {
    const o = r.o;
    if (fStatus === "soon" ? !r.life.dueSoon : fStatus === "overdue" ? !r.life.overdue : fStatus !== "all" && r.life.key !== fStatus) return false;
    if (fCust !== "all" && (o.customer || "Chưa rõ") !== fCust) return false;
    if (fStage !== "all" && r.route.indexOf(fStage) < 0) return false;
    if (fPrio !== "all" && (o.priority || "normal") !== fPrio) return false;
    if (rFrom && (o.orderDate || "") < rFrom) return false;
    if (rTo && (o.orderDate || "9999") > rTo) return false;
    if (dFrom && (o.deliveryDate || "") < dFrom) return false;
    if (dTo && (o.deliveryDate || "9999") > dTo) return false;
    if (!t) return true;
    return [o.id, o.customer, o.spec, o.materialCode, o.note, r.route.map(amgStageLabel).join(" "), amgPriorityMeta(o.priority).label, amgOrderStatusMeta(r.life.key).label, o.quantity, o.orderDate, o.deliveryDate].some(v => String(v ?? "").toLowerCase().includes(t));
  });
  useEffect(() => { const ids = new Set(list.map(r => r.o.id)); setSelected(p => { const n = new Set([...p].filter(id => ids.has(id))); return n.size === p.size ? p : n; }); }, [orders, q, fStatus, fCust, fStage, fPrio, rFrom, rTo, dFrom, dTo]); // eslint-disable-line
  useEffect(() => { setPage(1); }, [q, fStatus, fCust, fStage, fPrio, rFrom, rTo, dFrom, dTo, pageSize]);
  const pg = amgPaginate(list, page, pageSize);
  const pageIds = pg.items.map(r => r.o.id);
  const toggleSel = id => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitManage = () => { setManage(false); setSelected(new Set()); };
  const cols = [
    { key: "stt", label: "STT", export: (r, i) => i }, { key: "customer", label: "KHÁCH HÀNG", export: r => r.o.customer }, { key: "id", label: "Mã đơn", export: r => r.o.id },
    { key: "route", label: "Công đoạn", export: r => r.route.map(amgStageLabel).join(" → ") }, { key: "mat", label: "NGUYÊN LIỆU", export: r => r.o.materialCode },
    { key: "spec", label: "QUY CÁCH", export: r => r.o.spec }, { key: "qty", label: "SỐ LƯỢNG", export: r => r.o.quantity }, { key: "unit", label: "ĐƠN VỊ", export: r => amgOrderUnit(r.o) }, { key: "done", label: "ĐÃ SẢN XUẤT", export: r => r.prog.completedQty },
    { key: "note", label: "GHI CHÚ", export: r => r.o.note || "" }, { key: "od", label: "NGÀY NHẬN", export: r => amgFmtDate(r.o.orderDate) }, { key: "dd", label: "NGÀY GIAO", export: r => amgFmtDate(r.o.deliveryDate) },
    { key: "prio", label: "ƯU TIÊN", export: r => amgPriorityMeta(r.o.priority).label }, { key: "st", label: "TRẠNG THÁI", export: r => amgOrderStatusMeta(r.life.key).label + (r.life.overdue ? " (quá hạn)" : r.life.dueSoon ? " (sắp giao)" : "") }
  ];
  function exportExcel() {
    const data = list.map((r, i) => { const x = {}; cols.forEach(c => { x[c.label] = c.key === "stt" ? i + 1 : c.export(r); }); return x; });
    const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Đơn hàng"); XLSX.writeFile(wb, "don-hang.xlsx");
  }
  async function handleSave({ f, routing, isNew }) {
    const base = amgOrderBaseFromEditor(f, routing, currentUser);
    if (isNew) {
      const stages = {}; STAGES.forEach(s => { stages[s.key] = { done: 0, remain: 0 }; });
      const id = f.code.trim() || uid("ORD");
      const now = new Date().toISOString();
      await onAdd(normalizeOrderStages(Object.assign({ id, stages, finishedDone: 0, finishedShort: 0, createdAt: now, createdBy: currentUser.fullName || "" }, base)));
      setQ(""); setFStatus("all");
    } else {
      await onUpdate(Object.assign({ id: modal.order.id }, base));
    }
  }
  function blockedDelete(ids) {
    const bad = ids.filter(id => amgRunsOfOrder(rs, id).length > 0 || STAGES.some(s => amgStageDone(orders.find(o => o.id === id) || {}, s.key) > 0));
    return bad;
  }
  async function del(o) {
    const bad = blockedDelete([o.id]);
    if (bad.length) { await showAlert(`Đơn ${o.id} đã có lệnh máy hoặc sản lượng nên không thể xóa để bảo toàn dữ liệu sản xuất.`, { title: "Không xóa được" }); return; }
    if (await askConfirm(`Xóa đơn ${o.id} (${o.customer} / ${o.spec})? Hành động không thể hoàn tác.`, { danger: true, confirmLabel: "Xóa đơn" })) { try { await onDelete(o.id); } catch (e) { await showAlert(e.message || String(e), { title: "Không xóa được" }); } }
  }
  async function bulkDel() {
    const ids = [...selected];
    const bad = blockedDelete(ids);
    if (bad.length) { await showAlert(`Có ${bad.length} đơn đã có lệnh máy hoặc sản lượng (${bad.slice(0, 5).join(", ")}${bad.length > 5 ? "…" : ""}) nên không thể xóa. Bỏ chọn các đơn này rồi thử lại.`, { title: "Không xóa được" }); return; }
    if (await askConfirm(`Xóa ${ids.length} đơn hàng đã chọn? Hành động không thể hoàn tác.`, { danger: true, confirmLabel: `Xóa ${ids.length} đơn` })) { try { await onBulkDelete(ids); setSelected(new Set()); } catch (e) { await showAlert(e.message || String(e), { title: "Không xóa được" }); } }
  }
  const sel = { className: "mes-input", style: { width: "auto", minWidth: 140 } };
  const dateIn = (v, s, title) => rkh("input", { className: "mes-input", type: "date", title, value: v, onChange: e => s(e.target.value), style: { width: "auto" } });
  const modalOrder = modal && modal.order ? (orders.find(o => o.id === modal.order.id) || modal.order) : null;
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${list.length} / ${orders.length} đơn hàng`, title: "Đơn hàng & quy trình sản xuất", icon: ClipboardList, iconColor: COLORS.copper,
      action: rkh("div", { style: { display: "flex", gap: 8 } }, rkh(Button, { disabled: list.length === 0, onClick: exportExcel }, rkh(Download, { size: 14 }), " Xuất Excel"), isAdmin && rkh(Button, { onClick: () => (manage ? exitManage() : setManage(true)) }, manage ? "Thoát chọn nhiều" : "Chọn nhiều"), isAdmin && rkh(Button, { variant: "primary", onClick: () => setModal({ kind: "add" }) }, rkh(Plus, { size: 14 }), " Thêm đơn hàng")) }),
    rkh(GuideBox, { steps: ["Bấm Thêm đơn hàng → nhập thông tin (chọn đơn vị kg hoặc m) → tích các công đoạn cần làm → xác nhận quy trình. Danh sách công đoạn đã xác nhận là nguồn duy nhất để phân lệnh máy.", "Không cần chọn máy ở đây: việc phân máy làm ở tab Kế hoạch sản xuất.", "Cột ĐÃ SẢN XUẤT là sản lượng thành phẩm theo công đoạn cuối của quy trình (không cộng dồn các công đoạn). Đơn đã hoàn thành tự chuyển sang tab Đơn hàng hoàn thành (kèm BOM, lệnh máy, sản lượng).", "Bấm vào thẻ thống kê để lọc nhanh; dùng ô tìm kiếm và các bộ lọc để thu hẹp danh sách. Muốn xóa nhiều đơn: bấm Chọn nhiều (chỉ Quản trị)."] }),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(135px,1fr))", gap: 10, marginBottom: 14 } },
      [["Đơn đang hoạt động", "all", COLORS.text], ["Đơn mới", "new", COLORS.blue], ["Chờ sản xuất", "waiting", COLORS.amber], ["Đang sản xuất", "producing", COLORS.green], ["Sắp giao", "soon", COLORS.orange], ["Quá hạn", "overdue", COLORS.red]]
        .map(([l, k, c]) => amgKpiTile(l, cnt[k], c, fStatus === k, () => setFStatus(s => (s === k ? "all" : k)))).concat([amgKpiTile("Đã hoàn thành (lưu trữ)", completedCount || 0, COLORS.violet, false, onNavigate ? () => onNavigate("completed") : undefined, "Bấm để mở tab Đơn hàng hoàn thành")])),
    rkh("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 } },
      rkh("div", { style: { position: "relative", flex: 1, minWidth: 220 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }), rkh("input", { className: "mes-input", style: { paddingLeft: 30 }, placeholder: "Tìm mã đơn, khách hàng, quy cách, nguyên liệu, ghi chú, công đoạn...", value: q, onChange: e => setQ(e.target.value) })),
      rkh("select", Object.assign({ value: fCust, onChange: e => setFCust(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi khách hàng"), customers.map(c => rkh("option", { key: c, value: c }, c))),
      rkh("select", Object.assign({ value: fStage, onChange: e => setFStage(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => rkh("option", { key: s.key, value: s.key }, s.label))),
      rkh("select", Object.assign({ value: fPrio, onChange: e => setFPrio(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi ưu tiên"), AMG_PRIORITY_KEYS.map(k => rkh("option", { key: k, value: k }, amgPriorityMeta(k).label))),
      rkh("select", Object.assign({ value: fStatus, onChange: e => setFStatus(e.target.value) }, sel), [["all", "Mọi trạng thái"], ["new", "Đơn mới"], ["waiting", "Chờ sản xuất"], ["producing", "Đang sản xuất"], ["soon", "Sắp giao"], ["overdue", "Quá hạn"]].map(([v, l]) => rkh("option", { key: v, value: v }, l)))),
    rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12, fontSize: FZ(12), color: COLORS.textDim } }, "Ngày nhận:", dateIn(rFrom, setRFrom, "Nhận từ ngày"), "–", dateIn(rTo, setRTo, "Nhận đến ngày"), "Ngày giao:", dateIn(dFrom, setDFrom, "Giao từ ngày"), "–", dateIn(dTo, setDTo, "Giao đến ngày"),
      (rFrom || rTo || dFrom || dTo || fCust !== "all" || fStage !== "all" || fPrio !== "all" || fStatus !== "all" || q) && rkh(Button, { size: "sm", variant: "ghost", onClick: () => { setQ(""); setFStatus("all"); setFCust("all"); setFStage("all"); setFPrio("all"); setRFrom(""); setRTo(""); setDFrom(""); setDTo(""); } }, "Xóa bộ lọc")),
    isAdmin && manage && rkh("div", { className: "mes-no-print", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: `${COLORS.red}12`, border: `1px solid ${COLORS.red}40` } },
      rkh("b", { style: { fontSize: FZ(13) } }, `Chế độ chọn nhiều · đã chọn ${selected.size} đơn`),
      rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        rkh(Button, { size: "sm", onClick: () => setSelected(p => new Set([...p, ...pageIds])) }, "Chọn cả trang"),
        rkh(Button, { size: "sm", onClick: () => setSelected(new Set(list.map(r => r.o.id))) }, `Chọn tất cả ${list.length} kết quả`),
        rkh(Button, { size: "sm", disabled: selected.size === 0, onClick: () => setSelected(new Set()) }, "Bỏ chọn"),
        rkh(Button, { size: "sm", variant: "danger", disabled: selected.size === 0, onClick: bulkDel }, rkh(Trash2, { size: 14 }), " Xóa đã chọn"),
        rkh(Button, { size: "sm", onClick: exitManage }, "Thoát"))),
    rkh("div", { className: "mes-card", ref: boxRef, style: { overflow: "hidden", borderTop: `4px solid ${COLORS.copper}` } },
      list.length === 0 ? rkh(EmptyState, { title: orders.length === 0 ? "Chưa có dữ liệu đơn hàng" : "Không tìm thấy đơn hàng phù hợp", hint: orders.length === 0 ? "Danh sách đơn hàng trống — có thể dữ liệu chưa được nạp đầy đủ." : undefined, action: isAdmin && orders.length === 0 && rkh(Button, { variant: "primary", onClick: onRestoreSeed }, rkh(RefreshCw, { size: 14 }), " Khôi phục đơn hàng mẫu") }) :
        rkh("div", null,
          wide && rkh("div", { className: "amg-hdr", style: { gridTemplateColumns: AMG_ORDER_COLS } }, ["STT", "Khách hàng / Mã đơn", "Công đoạn", "Nguyên liệu", "Quy cách", "Số lượng", "Đã sản xuất", "Ghi chú", "Ngày nhận", "Ngày giao", "Ưu tiên", "Trạng thái", "Thao tác"].map((h, i) => rkh("div", { key: h, style: { textAlign: i === 5 ? "right" : "left" } }, h))),
          pg.items.map((r, k) => rkh(OrderRow, { key: r.o.id, r, no: pg.from + k + 1, wide, runs: rs, isAdmin, manage, picked: selected.has(r.o.id),
            onView: () => setModal({ kind: "view", order: r.o }), onEdit: () => setModal({ kind: "edit", order: r.o }), onDel: () => del(r.o), onPick: () => toggleSel(r.o.id) })),
          rkh(Pager, { total: list.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }))),
    modal && modal.kind === "view" && modalOrder && rkh(OrderDetailModal, { order: modalOrder, auditLog, extra, runs: rs, isAdmin, onClose: () => setModal(null), onUpdate, onEdit: () => setModal({ kind: "edit", order: modalOrder }) }),
    modal && (modal.kind === "add" || modal.kind === "edit") && rkh(OrderEditor, { mode: modal.kind, order: modal.order, orders, runs: rs, machines: machines || [], onSave: handleSave, onClose: () => setModal(null) }));
}
