/* ===================== TAB ĐƠN HÀNG (v46) =====================
   Giao diện mới của tab Đơn hàng. Dữ liệu vẫn là collection orders; công đoạn lưu bằng stage key chuẩn (STAGES)
   trong order.routing và được getApplicableStages/normalizeOrderStages/orderProgress đọc như bình thường. */

const AMG_ORDER_PROTECTED = ["id", "stages", "finishedDone", "finishedShort", "status", "completedAt", "completedBy", "completionMode", "completionNote", "completedShort", "stageComplete", "statusHistory", "productionStartedAt", "lastCompletedAt", "lastCompletedBy", "lastCompletionSummary", "completionSummary", "openRunIds", "version", "createdAt", "createdBy", "updatedAt", "updatedBy"];
// v59: các trường người dùng sửa trong biểu mẫu đơn (nhãn dùng khi báo xung đột). Chỉ những trường THỰC SỰ bị sửa so với lúc mở biểu mẫu mới được ghi lên đơn.
const AMG_ORDER_EDIT_LABELS = { customer: "Khách hàng", materialCode: "Vật liệu", spec: "Quy cách", quantity: "Số lượng", unit: "Đơn vị", note: "Ghi chú", orderDate: "Ngày nhận", deliveryDate: "Ngày giao", priority: "Ưu tiên", inventory: "Tồn kho", routing: "Quy trình" };

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

// v59: dạng "như biểu mẫu thấy" của một đơn (cùng cách chuẩn hóa với OrderEditor) — dùng để so bản mới nhất trên máy chủ với bản lúc mở biểu mẫu.
function amgOrderEditorShape(order, user) {
  const route = amgIsFlowOrder(order) ? amgOrderRoute(order) : [];
  return amgOrderBaseFromEditor({ customer: order.customer || "", materialCode: order.materialCode || "", spec: order.spec || "", quantity: order.quantity ?? "", unit: amgOrderUnit(order), note: order.note || "", orderDate: order.orderDate || "", deliveryDate: order.deliveryDate || "", priority: order.priority || "normal", inventory: order.inventory || 0 }, route, user);
}
// v59: ghép bản sửa từ biểu mẫu lên bản MỚI NHẤT của đơn. `baseEditor` = bản chụp lúc mở biểu mẫu (cùng dạng với `updated`).
// Trường người dùng không sửa → giữ bản mới nhất; trường người dùng sửa mà người khác cũng đã sửa khác đi → ném lỗi xung đột (không ghi đè âm thầm).
function amgMergeOrderEdit(cur, updated, baseEditor, user) {
  const merged = Object.assign({}, cur), same = (a, b) => JSON.stringify(a) === JSON.stringify(b), clash = [];
  const curShape = baseEditor ? amgOrderEditorShape(cur, user) : null;
  Object.keys(updated).forEach(k => {
    if (AMG_ORDER_PROTECTED.indexOf(k) >= 0) return;
    if (baseEditor && AMG_ORDER_EDIT_LABELS[k] && Object.prototype.hasOwnProperty.call(baseEditor, k)) {
      if (same(baseEditor[k], updated[k])) return; // người dùng không sửa trường này
      if (!same(curShape[k], baseEditor[k]) && !same(curShape[k], updated[k])) { clash.push(AMG_ORDER_EDIT_LABELS[k]); return; }
    }
    merged[k] = updated[k];
  });
  if (clash.length) { const e = new Error("Đơn này vừa được người khác sửa các trường: " + clash.join(", ") + ". Chưa có gì bị ghi đè. Hãy đóng biểu mẫu, mở lại để xem bản mới nhất rồi nhập lại thay đổi của bạn."); e.code = "version-conflict"; throw e; }
  return merged;
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
  const [f0] = useState(() => Object.assign({}, f)); // v59: bản gốc lúc MỞ biểu mẫu — để chỉ ghi các trường thật sự bị sửa
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
    try { await onSave({ f, routing, isNew, base0: isNew ? null : { f: f0, routing: initialRoute } }); onClose(); } catch (e) { setErrs({ _all: e.message || String(e) }); setBusy(false); }
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
  return rkh(Modal, { title: isNew ? "Thêm đơn hàng mới" : `Sửa đơn ${amgOrderLabel(order)}`, onClose, width: 760 },
    !isNew && (openRuns.length > 0 || hasOutput) && rkh(AmgNotice, { tone: "warn" }, `⚠ ${openRuns.length > 0 ? `Đơn đang được phân máy (${myRuns.filter(r => r.productionStatus !== "cancelled").length} lệnh)` : ""}${openRuns.length > 0 && hasOutput ? " và " : ""}${hasOutput ? "đã có sản lượng" : ""}. Dữ liệu sản xuất đã ghi nhận không bị xóa; công đoạn đã chạy bị khóa không cho bỏ chọn.`),
    !isNew && order.status === "completed" && rkh(AmgNotice, { tone: "err" }, "Đơn đã hoàn thành. Mở lại đơn ở tab Đơn hàng hoàn thành trước khi đổi quy trình."),
    sectionTitle("1. Thông tin đơn hàng"),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 14px" } },
      fld("Khách hàng *", "customer", { placeholder: "ví dụ: HÒA AN" }),
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
const AMG_ORDER_COLS = "36px minmax(118px,1.5fr) minmax(128px,1.5fr) minmax(78px,.9fr) minmax(66px,.8fr) 58px minmax(72px,.9fr) 88px 84px 78px 80px 80px 74px minmax(96px,1fr) 104px";
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
  const cust = rkh("div", { style: { minWidth: 0 } }, rkh(Clamp, { text: o.customer || "—", lines: 2, style: { fontWeight: 800 } }), wide && o.note ? rkh("div", { title: o.note, style: { fontSize: FZ(11.5), color: COLORS.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, o.note) : null);
  const chips = rkh("div", { style: { minWidth: 0 } }, rkh(StageChips, { order: o, runs, compact: true }), !amgIsFlowOrder(o) && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 2 } }, "quy trình suy từ quy cách"));
  const rowStyle = { borderLeftColor: edge };
  const cls = "amg-row" + (picked ? " amg-row--sel" : "");
  const click = manage && isAdmin ? onPick : onView;
  if (wide) {
    return rkh("div", { className: cls, "data-order": o.id, style: Object.assign({ gridTemplateColumns: AMG_ORDER_COLS }, rowStyle), onClick: click },
      rkh("div", { className: "mes-mono", style: { color: COLORS.textFaint } }, no), cust, chips,
      rkh("div", { "data-col": "stage", style: { fontSize: FZ(12.5), fontWeight: 700 } }, r.curStage || "—"),
      rkh("div", { "data-col": "machines", className: "mes-mono", style: { fontSize: FZ(12), color: r.machines.length ? COLORS.green : COLORS.textFaint, fontWeight: 700 } }, r.machines.join(", ") || "—"),
      rkh("div", null, o.materialCode || "—"), rkh(Clamp, { text: String(o.spec == null ? "—" : o.spec), lines: 2, mono: true }),
      rkh("div", { className: "mes-mono", style: { fontWeight: 700, textAlign: "right" } }, fmtNum(o.quantity), rkh("span", { style: { fontSize: FZ(12), color: COLORS.textFaint, fontWeight: 600 } }, " " + amgOrderUnit(o))),
      prog,
      rkh("div", { "data-col": "remain", className: "mes-mono", style: { fontWeight: 700, textAlign: "right" } }, r.remain === null ? "—" : fmtNum(r.remain)),
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
      rkh(KV, { label: "Số lượng" }, rkh("span", { className: "mes-mono" }, fmtNum(o.quantity) + " " + amgOrderUnit(o))), rkh(KV, { label: "Đã sản xuất" }, prog), rkh(KV, { label: "Còn lại" }, rkh("span", { className: "mes-mono" }, r.remain === null ? "—" : fmtNum(r.remain) + " " + amgOrderUnit(o))), rkh(KV, { label: "Công đoạn hiện tại" }, r.curStage || "—"), rkh(KV, { label: "Máy đang sản xuất" }, rkh("span", { className: "mes-mono" }, r.machines.join(", ") || "—")),
      rkh(KV, { label: "Ngày nhận" }, o.orderDate ? amgFmtDate(o.orderDate) : "—"), rkh(KV, { label: "Ngày giao", style: { color: dueColor } }, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—")),
    o.note && rkh(KV, { label: "Ghi chú" }, rkh(Clamp, { text: o.note, lines: 2, style: { fontWeight: 500, color: COLORS.textDim } })),
    acts);
}

/* ---------- Xóa đơn kể cả đang sản xuất (v53 — chỉ Admin) ---------- */
function amgOrderImpact(o, runs, entries, extra) {
  const rr = amgRunsOfOrder(runs || [], o.id), open = rr.filter(amgIsOpenRun), ex = extra || {};
  const linked = ["stockMoves", "inspections", "ncr", "plans"].reduce((n, c) => n + (ex[c] || []).filter(x => x && x.orderId === o.id).length, 0);
  const prog = orderProgress(normalizeOrderStages(o));
  return { runs: rr.length, open: open.length, machines: [...new Set(open.map(r => r.machineId))], entries: (entries || []).filter(e => e.orderId === o.id).length, done: prog.completedQty || 0, linked };
}
function OrderForceDeleteModal({ orders: orders0, runs, entries, extra, onConfirm, onClose }) {
  const [orders, setOrders] = useState(orders0); // sau khi xóa một phần, chỉ còn các đơn bị lỗi
  const single = orders.length === 1;
  const word = "XOA"; // v54: không còn mã đơn nên luôn gõ XOA
  const [reason, setReason] = useState(""), [typed, setTyped] = useState(""), [busy, setBusy] = useState(false), [errs, setErrs] = useState([]);
  const info = orders.map(o => ({ o, im: amgOrderImpact(o, runs, entries, extra) }));
  const tot = info.reduce((a, x) => ({ runs: a.runs + x.im.runs, open: a.open + x.im.open, entries: a.entries + x.im.entries, linked: a.linked + x.im.linked }), { runs: 0, open: 0, entries: 0, linked: 0 });
  const okForm = reason.trim().length >= 3 && typed.trim().toLowerCase() === word.toLowerCase() && !busy;
  async function go() {
    if (!okForm) return;
    setBusy(true); setErrs([]);
    try {
      const res = await onConfirm(orders.map(o => o.id), reason.trim());
      const failed = (res && res.failed) || [];
      if (failed.length) {
        const okN = (res.ok || []).length;
        setErrs((okN ? [`Đã xóa ${okN} đơn; còn ${failed.length} đơn chưa xóa được:`] : []).concat(failed.map(f => `${amgOrderLabelById(f.id)}: ${f.message}`)));
        if (okN) { const bad = new Set(failed.map(f => f.id)); setOrders(l => l.filter(o => bad.has(o.id))); setTyped(""); }
        setBusy(false); return;
      }
      onClose(true, Object.assign({}, res, { ok: (res.ok || []).concat(orders0.length > orders.length ? new Array(orders0.length - orders.length).fill(null) : []) }));
    } catch (e) { setErrs([e.message || String(e)]); setBusy(false); }
  }
  return rkh(Modal, { title: single ? `Xóa đơn ${amgOrderLabel(orders[0])} — kể cả đang sản xuất` : `Xóa ${orders.length} đơn — kể cả đang sản xuất`, onClose: () => onClose(false), width: 620 },
    rkh(AmgNotice, { tone: "err" }, "⚠ Chỉ Admin. Xóa vĩnh viễn, KHÔNG hoàn tác được. Đơn, toàn bộ lệnh máy và sản lượng đã ghi của đơn sẽ bị xóa; máy đang bị khóa bởi lệnh của đơn sẽ được giải phóng."),
    rkh("div", { style: { margin: "10px 0", maxHeight: 230, overflowY: "auto" } }, info.slice(0, 8).map(({ o, im }) => rkh("div", { key: o.id, style: { padding: "8px 10px", marginBottom: 6, borderRadius: 10, border: `1px solid ${im.runs || im.done ? COLORS.red : COLORS.border}`, background: COLORS.bgPanel2 } },
      rkh("div", { style: { fontWeight: 800 } }, `${o.customer || "—"} · ${o.spec || "—"}`),
      rkh("div", { style: { fontSize: FZ(12.5), color: COLORS.textDim, marginTop: 2 } }, `${im.runs} lệnh máy (${im.open} đang mở${im.machines.length ? " trên máy " + im.machines.join(", ") : ""}) · đã sản xuất ${fmtNum(im.done)} ${amgOrderUnit(o)} · ${im.entries} lượt sản lượng`)))),
    info.length > 8 && rkh("div", { style: { fontSize: FZ(12.5), color: COLORS.textDim, marginBottom: 8 } }, `… và ${info.length - 8} đơn khác`),
    rkh("div", { style: { fontSize: FZ(13), marginBottom: 10 } }, `Tổng cộng sẽ xóa: ${orders.length} đơn · ${tot.runs} lệnh máy (${tot.open} đang mở) · ${tot.entries} lượt sản lượng.`),
    tot.linked > 0 && rkh(AmgNotice, { tone: "warn" }, `Giữ nguyên ${tot.linked} phiếu kho / kiểm tra / NG / kế hoạch ngày đang tham chiếu tới đơn này (thuộc phân hệ khác). Các phiếu đó sẽ báo "đơn không tồn tại" ở bảng Kiểm tra dữ liệu.`),
    rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, margin: "10px 0 5px" } }, "Lý do xóa * (ghi vào nhật ký)"),
    rkh("input", { className: "mes-input", "data-testid": "force-del-reason", style: { width: "100%" }, value: reason, onChange: e => setReason(e.target.value), placeholder: "ví dụ: nhập nhầm đơn, khách hủy đơn..." }),
    rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, margin: "10px 0 5px" } }, `Gõ "${word}" để xác nhận xóa`),
    rkh("input", { className: "mes-input", "data-testid": "force-del-confirm", style: { width: "100%" }, value: typed, onChange: e => setTyped(e.target.value), autoComplete: "off" }),
    errs.length > 0 && rkh(AmgNotice, { tone: "err" }, errs.join("\n")),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 } }, rkh(Button, { onClick: () => onClose(false), disabled: busy }, "Hủy"),
      rkh(Button, { variant: "danger", "data-testid": "force-del-go", disabled: !okForm, onClick: go }, busy ? "Đang xóa..." : single ? "Xóa vĩnh viễn đơn này" : `Xóa vĩnh viễn ${orders.length} đơn`)));
}

/* ---------- Trang Đơn hàng ---------- */
function OrdersPage({ orders, runs, entries, machines, auditLog, isAdmin, currentUser, onAdd, onUpdate, onDelete, onBulkDelete, onForceDelete, onRestoreSeed, extra, completedCount, onNavigate, onNavigateFocus }) {
  const { askConfirm, showAlert } = useDialog();
  const focus0 = useState(() => amgTakeFocus("orders"))[0]; // từ tìm kiếm toàn hệ thống
  const [q, setQ] = useState(() => (focus0 && focus0.q ? focus0.q : ""));
  const [fStatus, setFStatus] = useState(() => (focus0 && ["new", "waiting", "producing", "soon", "overdue"].indexOf(focus0.status) > -1 ? focus0.status : "all")); // v57: Tổng quan mở sẵn đúng bộ lọc
  const [fCust, setFCust] = useState("all");
  const [fStage, setFStage] = useState(() => (focus0 && focus0.stage && STAGE_MAP[focus0.stage] ? focus0.stage : "all")); // v57: Tổng quan mở sẵn đúng công đoạn
  const [fPrio, setFPrio] = useState("all");
  const [rFrom, setRFrom] = useState(""), [rTo, setRTo] = useState(""), [dFrom, setDFrom] = useState(""), [dTo, setDTo] = useState("");
  const [modal, setModal] = useState(() => { const o = focus0 && focus0.orderId ? orders.find(x => x.id === focus0.orderId) : null; return o ? { kind: "view", order: o } : null; });
  const [selected, setSelected] = useState(() => new Set());
  const [force, setForce] = useState(null); // { orders, resolve } — hộp xóa tận gốc (Admin)
  const isRoot = amgIsRoot(currentUser);
  const askForce = list => new Promise(resolve => setForce({ orders: list, resolve }));
  const [manage, setManage] = useState(false); // chế độ quản lý: chọn nhiều để xóa — KHÔNG còn checkbox cạnh STT
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20);
  const [boxRef, boxW] = useBoxWidth();
  const wide = !boxW || boxW >= 1260; // 15 cột cần ≥ ~1240px; hẹp hơn thì tự chuyển sang thẻ dòng (đủ mọi thông tin, không cuộn ngang, không mất cột)
  const rs = runs || [];
  const rows = useMemo(() => orders.map(o => {
    const n = normalizeOrderStages(o);
    const pb = amgIsFlowOrder(o) ? amgPlanBucket(o, rs) : null, openR = amgRunsOfOrder(rs, o.id).filter(amgIsOpenRun), prog = orderProgress(n), qn = Number(o.quantity);
    return { o, n, prog, life: amgOrderLifecycle(o, rs), route: amgOrderRoute(o), curStage: pb && pb.stageKey ? amgStageLabel(pb.stageKey) : "", machines: [...new Set(openR.map(x => x.machineId))], remain: Number.isFinite(qn) ? Math.max(0, Math.round((qn - prog.completedQty) * 100) / 100) : null };
  }), [orders, rs]);
  const cnt = { all: rows.length, new: 0, waiting: 0, producing: 0, completed: 0, soon: 0, overdue: 0 }; // completed luôn 0: tab này chỉ nhận đơn đang hoạt động
  rows.forEach(r => { cnt[r.life.key]++; if (r.life.dueSoon) cnt.soon++; if (r.life.overdue) cnt.overdue++; });
  const customers = [...new Set(orders.map(o => o.customer || "Chưa rõ"))].sort();
  const t = q.trim().toLowerCase();
  const [sort, setSort] = useState({ key: "", dir: 1 });
  const listBase = rows.filter(r => {
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
    return [o.customer, o.spec, o.materialCode, o.note, r.route.map(amgStageLabel).join(" "), amgPriorityMeta(o.priority).label, amgOrderStatusMeta(r.life.key).label, o.quantity, o.orderDate, o.deliveryDate].some(v => String(v ?? "").toLowerCase().includes(t));
  });
  const SORTERS = {
    customer: r => String(r.o.customer || ""), stage: r => r.curStage || "", machines: r => r.machines.join(","), mat: r => String(r.o.materialCode || ""), spec: r => String(r.o.spec == null ? "" : r.o.spec),
    qty: r => Number(r.o.quantity) || 0, done: r => r.prog.completedQty || 0, remain: r => (r.remain === null ? -1 : r.remain), od: r => String(r.o.orderDate || ""), dd: r => String(r.o.deliveryDate || "9999-99-99"),
    prio: r => amgPriorityMeta(r.o.priority).rank, st: r => (r.life.overdue ? 0 : r.life.dueSoon ? 1 : 2) * 10 + ["producing", "waiting", "new"].indexOf(r.life.key)
  };
  const list = useMemo(() => { const f = SORTERS[sort.key]; if (!f) return listBase; return listBase.slice().sort((a, b) => { const x = f(a), y = f(b); const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true }); return (c || String(a.o.id).localeCompare(String(b.o.id), "vi", { numeric: true })) * sort.dir; }); }, [listBase, sort]); // eslint-disable-line
  useEffect(() => { const ids = new Set(list.map(r => r.o.id)); setSelected(p => { const n = new Set([...p].filter(id => ids.has(id))); return n.size === p.size ? p : n; }); }, [orders, q, fStatus, fCust, fStage, fPrio, rFrom, rTo, dFrom, dTo]); // eslint-disable-line
  useEffect(() => { setPage(1); }, [q, fStatus, fCust, fStage, fPrio, rFrom, rTo, dFrom, dTo, pageSize]);
  const pg = amgPaginate(list, page, pageSize);
  const pageIds = pg.items.map(r => r.o.id);
  const toggleSel = id => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitManage = () => { setManage(false); setSelected(new Set()); };
  const cols = [
    { key: "stt", label: "STT", export: (r, i) => i }, { key: "customer", label: "KHÁCH HÀNG", export: r => r.o.customer },
    { key: "route", label: "Công đoạn", export: r => r.route.map(amgStageLabel).join(" → ") }, { key: "mat", label: "NGUYÊN LIỆU", export: r => r.o.materialCode },
    { key: "spec", label: "QUY CÁCH", export: r => r.o.spec }, { key: "qty", label: "SỐ LƯỢNG", export: r => r.o.quantity }, { key: "unit", label: "ĐƠN VỊ", export: r => amgOrderUnit(r.o) }, { key: "done", label: "ĐÃ SẢN XUẤT", export: r => r.prog.completedQty }, { key: "remain", label: "CÒN LẠI", export: r => (r.remain === null ? "" : r.remain) }, { key: "pct", label: "TIẾN ĐỘ (%)", export: r => (r.prog.pct === null ? "" : Math.round(r.prog.pct * 10) / 10) }, { key: "cur", label: "CÔNG ĐOẠN HIỆN TẠI", export: r => r.curStage }, { key: "mach", label: "MÁY ĐANG SẢN XUẤT", export: r => r.machines.join(", ") },
    { key: "note", label: "GHI CHÚ", export: r => r.o.note || "" }, { key: "od", label: "NGÀY NHẬN", export: r => amgFmtDate(r.o.orderDate) }, { key: "dd", label: "NGÀY GIAO", export: r => amgFmtDate(r.o.deliveryDate) },
    { key: "prio", label: "ƯU TIÊN", export: r => amgPriorityMeta(r.o.priority).label }, { key: "st", label: "TRẠNG THÁI", export: r => amgOrderStatusMeta(r.life.key).label + (r.life.overdue ? " (quá hạn)" : r.life.dueSoon ? " (sắp giao)" : "") }
  ];
  function exportExcel() {
    const data = list.map((r, i) => { const x = {}; cols.forEach(c => { x[c.label] = c.key === "stt" ? i + 1 : c.export(r); }); return x; });
    const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Đơn hàng"); XLSX.writeFile(wb, "don-hang.xlsx");
  }
  async function handleSave({ f, routing, isNew, base0 }) {
    const base = amgOrderBaseFromEditor(f, routing, currentUser);
    if (isNew) {
      const stages = {}; STAGES.forEach(s => { stages[s.key] = { done: 0, remain: 0 }; });
      const id = uid("ORD"); // v54: không còn mã đơn nhập tay — id nội bộ tự sinh
      const now = new Date().toISOString();
      await onAdd(normalizeOrderStages(Object.assign({ id, stages, finishedDone: 0, finishedShort: 0, createdAt: now, createdBy: currentUser.fullName || "" }, base)));
      setQ(""); setFStatus("all");
    } else {
      await onUpdate(Object.assign({ id: modal.order.id }, base), base0 ? { baseEditor: amgOrderBaseFromEditor(base0.f, base0.routing, currentUser) } : undefined);
    }
  }
  function blockedDelete(ids) {
    const bad = ids.filter(id => amgRunsOfOrder(rs, id).length > 0 || STAGES.some(s => amgStageDone(orders.find(o => o.id === id) || {}, s.key) > 0));
    return bad;
  }
  const NEED_ROOT = "Chỉ Admin mới được xóa đơn đã có lệnh máy hoặc sản lượng (đang sản xuất).";
  async function del(o) {
    if (o.status === "completed") { await showAlert(`Đơn ${amgOrderLabel(o)} đã hoàn thành nên không xóa theo cách thông thường. Đơn hoàn thành là dữ liệu lưu trữ; muốn chỉnh sửa hãy mở lại đơn (có lý do, có nhật ký).`, { title: "Không xóa được" }); return false; }
    const bad = blockedDelete([o.id]);
    if (bad.length) {
      if (!isRoot || !onForceDelete) { await showAlert(`Đơn ${amgOrderLabel(o)} đã có lệnh máy hoặc sản lượng. ${NEED_ROOT}`, { title: "Không xóa được" }); return false; }
      return askForce([o]); // Admin: hộp xác nhận mạnh (lý do + gõ XOA)
    }
    if (await askConfirm(`Xóa đơn ${amgOrderLabel(o)}? Hành động không thể hoàn tác.`, { danger: true, confirmLabel: "Xóa đơn" })) { try { await onDelete(o.id); return true; } catch (e) { await showAlert(e.message || String(e), { title: "Không xóa được" }); } }
    return false;
  }
  async function bulkDel() {
    const ids = [...selected];
    const bad = blockedDelete(ids);
    if (bad.length) {
      if (!isRoot || !onForceDelete) { await showAlert(`Có ${bad.length} đơn đã có lệnh máy hoặc sản lượng (${bad.slice(0, 5).map(amgOrderLabelById).join(", ")}${bad.length > 5 ? "…" : ""}). ${NEED_ROOT} Bỏ chọn các đơn này rồi thử lại.`, { title: "Không xóa được" }); return; }
      const done = await askForce(orders.filter(o => selected.has(o.id)));
      if (done) setSelected(new Set());
      return;
    }
    if (await askConfirm(`Xóa ${ids.length} đơn hàng đã chọn? Hành động không thể hoàn tác.`, { danger: true, confirmLabel: `Xóa ${ids.length} đơn` })) { try { await onBulkDelete(ids); setSelected(new Set()); } catch (e) { await showAlert(e.message || String(e), { title: "Không xóa được" }); } }
  }
  const sel = { className: "mes-input", style: { width: "auto", minWidth: 140 } };
  const dateIn = (v, s, title) => rkh("input", { className: "mes-input", type: "date", title, value: v, onChange: e => s(e.target.value), style: { width: "auto" } });
  const modalOrder = modal && modal.order ? (orders.find(o => o.id === modal.order.id) || modal.order) : null;
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${list.length} / ${orders.length} đơn hàng`, title: "Đơn hàng & quy trình sản xuất", icon: ClipboardList, iconColor: COLORS.copper,
      action: rkh("div", { style: { display: "flex", gap: 8 } }, rkh(Button, { disabled: list.length === 0, onClick: exportExcel }, rkh(Download, { size: 14 }), " Xuất Excel"), isAdmin && rkh(Button, { onClick: () => (manage ? exitManage() : setManage(true)) }, manage ? "Thoát chọn nhiều" : "Chọn nhiều"), isAdmin && rkh(Button, { variant: "primary", onClick: () => setModal({ kind: "add" }) }, rkh(Plus, { size: 14 }), " Thêm đơn hàng")) }),
    rkh(GuideBox, { steps: ["Bấm Thêm đơn hàng → nhập thông tin (chọn đơn vị kg hoặc m) → tích các công đoạn cần làm → xác nhận quy trình. Danh sách công đoạn đã xác nhận là nguồn duy nhất để phân lệnh máy.", "Không cần chọn máy ở đây: việc phân máy làm ở tab Kế hoạch sản xuất.", "Cột ĐÃ SẢN XUẤT là sản lượng thành phẩm theo công đoạn cuối của quy trình (không cộng dồn các công đoạn). Đơn đã hoàn thành tự chuyển sang tab Đơn hàng hoàn thành (kèm BOM, lệnh máy, sản lượng).", "Bấm vào thẻ thống kê để lọc nhanh; dùng ô tìm kiếm và các bộ lọc để thu hẹp danh sách. Muốn xóa nhiều đơn: bấm Chọn nhiều (chỉ Quản trị). Đơn đã có lệnh máy/sản lượng (đang sản xuất) chỉ Admin xóa được — hệ thống hỏi lý do, yêu cầu gõ XOA và ghi nhật ký. Đơn đã hoàn thành: Admin xóa ở tab Đơn hàng hoàn thành."] }),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(135px,1fr))", gap: 10, marginBottom: 14 } },
      [["Đơn đang hoạt động", "all", COLORS.text], ["Đơn mới", "new", COLORS.blue], ["Chờ sản xuất", "waiting", COLORS.amber], ["Đang sản xuất", "producing", COLORS.green], ["Sắp giao", "soon", COLORS.orange], ["Quá hạn", "overdue", COLORS.red]]
        .map(([l, k, c]) => amgKpiTile(l, cnt[k], c, fStatus === k, () => setFStatus(s => (s === k ? "all" : k)))).concat([amgKpiTile("Đã hoàn thành (lưu trữ)", completedCount || 0, COLORS.violet, false, onNavigate ? () => onNavigate("completed") : undefined, "Bấm để mở tab Đơn hàng hoàn thành")])),
    rkh("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 } },
      rkh("div", { style: { position: "relative", flex: 1, minWidth: 220 } }, rkh(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: COLORS.textFaint } }), rkh("input", { className: "mes-input", style: { paddingLeft: 30 }, placeholder: "Tìm khách hàng, quy cách, nguyên liệu, ghi chú, công đoạn...", value: q, onChange: e => setQ(e.target.value) })),
      rkh("select", Object.assign({ value: fCust, onChange: e => setFCust(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi khách hàng"), customers.map(c => rkh("option", { key: c, value: c }, c))),
      rkh("select", Object.assign({ value: fStage, onChange: e => setFStage(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => rkh("option", { key: s.key, value: s.key }, s.label))),
      rkh("select", Object.assign({ value: fPrio, onChange: e => setFPrio(e.target.value) }, sel), rkh("option", { value: "all" }, "Mọi ưu tiên"), AMG_PRIORITY_KEYS.map(k => rkh("option", { key: k, value: k }, amgPriorityMeta(k).label))),
      rkh("select", Object.assign({ value: fStatus, onChange: e => setFStatus(e.target.value) }, sel), [["all", "Mọi trạng thái"], ["new", "Đơn mới"], ["waiting", "Chờ sản xuất"], ["producing", "Đang sản xuất"], ["soon", "Sắp giao"], ["overdue", "Quá hạn"]].map(([v, l]) => rkh("option", { key: v, value: v }, l)))),
    rkh("div", { className: "mes-no-print", style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: FZ(12), color: COLORS.textDim } }, "Sắp xếp:",
      rkh("select", Object.assign({ "aria-label": "Sắp xếp danh sách đơn", value: sort.key, onChange: e => setSort({ key: e.target.value, dir: 1 }) }, sel), rkh("option", { value: "" }, "Mặc định"), [["customer", "Khách hàng"], ["od", "Ngày nhận"], ["dd", "Ngày giao"], ["qty", "Số lượng đặt"], ["done", "Đã sản xuất"], ["remain", "Còn lại"], ["prio", "Ưu tiên"], ["st", "Trạng thái / cảnh báo"]].map(([k, l]) => rkh("option", { key: k, value: k }, l))),
      sort.key && rkh(Button, { size: "sm", onClick: () => setSort(p => ({ key: p.key, dir: -p.dir })) }, sort.dir === 1 ? "Tăng dần ▲" : "Giảm dần ▼"), sort.key && rkh(Button, { size: "sm", variant: "ghost", onClick: () => setSort({ key: "", dir: 1 }) }, "Bỏ sắp xếp")),
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
          wide && rkh("div", { className: "amg-hdr", style: { gridTemplateColumns: AMG_ORDER_COLS } }, [["STT", ""], ["Khách hàng", "customer"], ["Quy trình", ""], ["Công đoạn hiện tại", "stage"], ["Máy đang SX", "machines"], ["Vật liệu", "mat"], ["Quy cách", "spec"], ["SL đặt", "qty"], ["Đã sản xuất", "done"], ["Còn lại", "remain"], ["Ngày nhận", "od"], ["Ngày giao", "dd"], ["Ưu tiên", "prio"], ["Trạng thái / cảnh báo", "st"], ["Thao tác", ""]].map(([h, k], i) => rkh("div", { key: h, style: { textAlign: [7, 9].indexOf(i) > -1 ? "right" : "left" } }, k ? rkh("button", { type: "button", "data-sort": k, onClick: () => setSort(p => (p.key === k ? { key: k, dir: -p.dir } : { key: k, dir: 1 })), title: "Sắp xếp theo " + h, style: { all: "unset", cursor: "pointer", fontWeight: "inherit", display: "inline-flex", gap: 3, alignItems: "center" } }, h, sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : "") : h))),
          pg.items.map((r, k) => rkh(OrderRow, { key: r.o.id, r, no: pg.from + k + 1, wide, runs: rs, isAdmin, manage, picked: selected.has(r.o.id),
            onView: () => setModal({ kind: "view", order: r.o }), onEdit: () => setModal({ kind: "edit", order: r.o }), onDel: () => del(r.o), onPick: () => toggleSel(r.o.id) })),
          rkh(Pager, { total: list.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }))),
    modal && modal.kind === "view" && modalOrder && rkh(OrderDetailModal, { order: modalOrder, auditLog, extra, runs: rs, entries: entries || [], currentUser, isAdmin, onClose: () => setModal(null), onUpdate, onEdit: () => setModal({ kind: "edit", order: modalOrder }), onDelete: async o => { if (await del(o)) setModal(null); }, onNavigateFocus }),
    modal && (modal.kind === "add" || modal.kind === "edit") && rkh(OrderEditor, { mode: modal.kind, order: modal.order, orders, runs: rs, machines: machines || [], onSave: handleSave, onClose: () => setModal(null) }),
    force && rkh(OrderForceDeleteModal, { orders: force.orders, runs: rs, entries: entries || [], extra, onConfirm: onForceDelete, onClose: (ok, res) => { const f = force; setForce(null); if (ok) { setModal(null); if (res && res.ok && res.ok.length > 1) showAlert(`Đã xóa ${res.ok.length} đơn (kèm lệnh máy và sản lượng).`, { title: "Đã xóa" }); } f.resolve(!!ok); } }));
}
