/* ===================== KẾ HOẠCH SẢN XUẤT — HỘP THOẠI THAO TÁC (v46) =====================
   Phân máy · Ghi sản lượng · Tạm dừng · Kết thúc lệnh · Lịch sử máy.
   Mọi thao tác gọi lớp ghi dạng giao dịch ở data/flowdata.js; giao diện chỉ kiểm tra sơ bộ để báo lỗi sớm,
   việc kiểm tra thật được lặp lại trong giao dịch với dữ liệu mới nhất. */

const amgInputStyle = { width: "100%" };
function AmgFieldBox({ label, hint, children, wide }) {
  return rkh("div", { style: { marginBottom: 12, gridColumn: wide ? "1 / -1" : undefined } },
    rkh("div", { style: { fontSize: 12, fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, label),
    children,
    hint && rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint, marginTop: 4 } }, hint));
}
function AmgNotice({ tone, children }) {
  const c = tone === "err" ? COLORS.red : tone === "warn" ? COLORS.amber : tone === "ok" ? COLORS.green : COLORS.blue;
  return rkh("div", { style: { padding: "9px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12.5, lineHeight: 1.55, background: `${c}14`, border: `1px solid ${c}55`, color: COLORS.text, whiteSpace: "pre-wrap" } }, children);
}
function amgTeamOfStage(stageKey) {
  const t = Object.keys(TEAM_REPORT_STAGES).find(k => TEAM_REPORT_STAGES[k].indexOf(stageKey) > -1);
  return t || "";
}
function amgOperatorOptions(staff, stageKey) {
  const team = amgTeamOfStage(stageKey);
  return (staff || []).filter(s => s && s.name && (!team || s.team === team)).map(s => s.name);
}
function amgSummaryRows(order, extraRows) {
  const rows = [["Mã đơn", order.id], ["Khách hàng", order.customer || "—"], ["Nguyên liệu", order.materialCode || "—"], ["Quy cách", order.spec || "—"], ["Số lượng đặt", fmtNum(order.quantity)]].concat(extraRows || []);
  return rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, padding: 10, borderRadius: 10, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, marginBottom: 12 } },
    rows.map(([a, b]) => rkh("div", { key: a }, rkh("div", { style: { fontSize: 11, color: COLORS.textFaint, fontWeight: 600 } }, a), rkh("div", { style: { fontSize: 14, fontWeight: 700, color: COLORS.text, wordBreak: "break-word" } }, b))));
}

/* ---------- Phân máy ---------- */
// order: đơn cố định (mở từ kế hoạch) | fixedMachine: máy cố định (mở từ thẻ máy, chọn đơn trong danh sách)
function AssignModal({ order: orderProp, orders, machines, runs, staff, fixedMachine, initialStage, onClose, onDone }) {
  const keyRef = useRef(amgNewKey("RUN"));
  const [orderId, setOrderId] = useState(orderProp ? orderProp.id : "");
  const order = orderProp || orders.find(o => o.id === orderId) || null;
  const route = order ? amgOrderRoute(order) : [];
  const stageOK = k => (order ? amgStageAssignable(order, k) : { ok: false });
  const firstOK = route.find(k => stageOK(k).ok) || route[0] || "";
  const [stageKey, setStageKey] = useState(fixedMachine ? amgMachineStage(fixedMachine) : initialStage || firstOK);
  const [machineId, setMachineId] = useState(fixedMachine ? fixedMachine.id : "");
  const [planned, setPlanned] = useState("");
  const [touched, setTouched] = useState(false);
  const [shift, setShift] = useState(amgCurrentShift().label);
  const [operator, setOperator] = useState("");
  const [note, setNote] = useState("");
  const [startNow, setStartNow] = useState(false); // mặc định CHỈ phân máy (ĐÃ PHÂN MÁY); bấm Bắt đầu chạy khi thật sự chạy
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Khi đổi đơn (chế độ chọn đơn theo máy): chọn lại công đoạn của máy
  const eligibleOrders = useMemo(() => {
    if (!fixedMachine) return [];
    const st = amgMachineStage(fixedMachine);
    return orders.filter(o => o.status !== "completed" && amgIsFlowOrder(o) && amgOrderRoute(o).indexOf(st) > -1 && amgStageAssignable(o, st).ok)
      .sort((a, b) => (amgPriorityMeta(a.priority).rank - amgPriorityMeta(b.priority).rank) || String(a.deliveryDate || "9999").localeCompare(String(b.deliveryDate || "9999")));
  }, [orders, fixedMachine]);

  const info = order && stageKey ? amgStageInfo(order, runs, stageKey) : null;
  useEffect(() => {
    if (touched || !info) return;
    const rem = info.remain === null ? "" : Math.max(0, info.remain - info.plannedOpen);
    setPlanned(rem === "" ? "" : String(Math.round(rem * 100) / 100));
  }, [orderId, stageKey]); // eslint-disable-line
  useEffect(() => { if (!operator) setOperator(""); }, [stageKey]); // eslint-disable-line

  const stageMachines = useMemo(() => (fixedMachine ? [fixedMachine] : amgMachinesForStage(machines, stageKey)), [machines, stageKey, fixedMachine]);
  const types = fixedMachine ? [MACHINE_TYPES.find(t => t.key === fixedMachine.typeKey)].filter(Boolean) : amgStageMachineTypes(stageKey);
  const chosen = machines.find(m => m.id === machineId) || null;
  const chosenCheck = chosen ? amgMachineAssignable(chosen, stageKey, runs) : null;
  const plannedNum = amgParseQty(planned);
  const warns = [];
  if (chosenCheck && chosenCheck.ok && chosenCheck.warn) warns.push(chosenCheck.warn + " (vẫn có thể phân lệnh)");
  if (info && info.remain !== null && Number.isFinite(plannedNum) && plannedNum > info.remain * 1.1 && info.remain > 0) warns.push(`Số lượng kế hoạch (${fmtNum(plannedNum)}) lớn hơn phần còn lại của công đoạn (${fmtNum(info.remain)})`);
  if (info && info.openRuns.length > 0) warns.push(`Công đoạn này đang có ${info.openRuns.length} lệnh khác (máy ${info.openRuns.map(r => r.machineId).join(", ")}) — đang chia lệnh qua nhiều máy`);
  const stageCheck = stageOK(stageKey);
  const problems = [];
  if (!order) problems.push("Chọn đơn hàng");
  else if (!stageCheck.ok) problems.push(stageCheck.reason);
  if (!chosen) problems.push("Chọn máy");
  else if (chosenCheck && !chosenCheck.ok) problems.push(chosenCheck.reason);
  if (!Number.isFinite(plannedNum) || plannedNum <= 0) problems.push("Nhập số lượng kế hoạch hợp lệ (> 0)");
  if (!operator.trim()) problems.push("Nhập người vận hành");

  async function submit() {
    if (busy || problems.length) return;
    setBusy(true); setError("");
    try {
      const res = await amgFlowAssign({ runId: keyRef.current, orderId: order.id, machineId, stageKey, plannedQuantity: planned, shift, operator, team: amgTeamOfStage(stageKey), note, startNow, knownMachineRunIds: amgOpenRunsOfMachine(runs, machineId).map(r => r.id) });
      onDone(res.duplicate ? `Lệnh ${res.run.id} đã được ghi nhận trước đó` : `Đã phân đơn ${order.id} vào máy ${machineId}${startNow ? " và bắt đầu chạy" : ""}`);
      onClose();
    } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }

  const stageColor = amgStageColor(stageKey);
  return rkh(Modal, { title: fixedMachine ? `Phân lệnh cho máy ${fixedMachine.id}` : `Phân máy · ${order ? order.id : ""}`, onClose, width: 760 },
    fixedMachine && rkh(AmgFieldBox, { label: "Đơn hàng", hint: eligibleOrders.length === 0 ? "Chưa có đơn nào đang chờ công đoạn này. Tạo đơn và chọn công đoạn ở tab Đơn hàng." : "Chỉ hiện đơn có công đoạn này trong quy trình và đang đủ điều kiện sản xuất." },
      rkh("select", { className: "mes-input", value: orderId, onChange: e => { setOrderId(e.target.value); setTouched(false); } },
        rkh("option", { value: "" }, "— Chọn đơn hàng —"),
        eligibleOrders.map(o => rkh("option", { key: o.id, value: o.id }, `${o.id} · ${o.customer || ""} · ${o.spec || ""} · ${fmtNum(o.quantity)}${o.priority && o.priority !== "normal" ? " · " + amgPriorityMeta(o.priority).label : ""}`)))),
    order && amgSummaryRows(order, [["Công đoạn hiện tại", amgStageLabel(amgCurrentStage(order))], ["Ngày giao", order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—"], ["Ưu tiên", amgPriorityMeta(order.priority).label]]),
    order && !fixedMachine && rkh(AmgFieldBox, { label: "Công đoạn cần phân máy" },
      rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, route.map(k => {
        const ck = stageOK(k), on = stageKey === k, c = amgStageColor(k);
        return rkh("button", { key: k, type: "button", disabled: !ck.ok, title: ck.ok ? "" : ck.reason, onClick: () => { setStageKey(k); setMachineId(""); setTouched(false); },
          style: { padding: "8px 14px", borderRadius: 999, cursor: ck.ok ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 13, border: `2px solid ${on ? c : COLORS.border}`, background: on ? `${c}22` : COLORS.bgPanel2, color: on ? c : ck.ok ? COLORS.text : COLORS.textFaint, opacity: ck.ok ? 1 : 0.55 } }, amgStageLabel(k));
      }))),
    order && stageKey && rkh(AmgFieldBox, { label: fixedMachine ? "Máy" : `Chọn máy — nhóm ${amgStageLabel(stageKey)} (${stageMachines.length} máy)`, hint: fixedMachine ? "" : "Chỉ hiện máy thuộc công đoạn đã chọn. Máy hỏng, bảo trì hoặc đang giữ lệnh khác bị khóa." },
      rkh("div", { style: { maxHeight: 250, overflowY: "auto", padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 10, background: COLORS.bgInset } },
        stageMachines.length === 0 ? rkh("div", { style: { fontSize: 12.5, color: COLORS.textFaint } }, "Danh mục chưa có máy cho công đoạn này.") :
          types.map(t => {
            const list = stageMachines.filter(m => m.typeKey === t.key);
            if (!list.length) return null;
            return rkh("div", { key: t.key, style: { marginBottom: 10 } },
              rkh("div", { style: { fontSize: 12, fontWeight: 800, color: t.color, marginBottom: 6 } }, `${t.label} (${t.prefix}) · ${list.length} máy`),
              rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(78px,1fr))", gap: 6 } }, list.map(m => {
                const ck = amgMachineAssignable(m, stageKey, runs), on = machineId === m.id;
                const c = !ck.ok ? (m.status === "broken" ? COLORS.red : m.status === "maintenance" ? COLORS.violet : COLORS.amber) : t.color;
                return rkh("button", { key: m.id, type: "button", disabled: !ck.ok || !!fixedMachine, title: ck.ok ? `${m.id} — sẵn sàng` : ck.reason, onClick: () => setMachineId(m.id),
                  style: { padding: "7px 4px", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: FONT_MONO, cursor: ck.ok && !fixedMachine ? "pointer" : "not-allowed", border: `2px solid ${on ? c : `${c}55`}`, background: on ? c : `${c}12`, color: on ? "#fff" : ck.ok ? COLORS.text : COLORS.textFaint, opacity: ck.ok ? 1 : 0.6, textDecoration: ck.ok ? "none" : "line-through" } }, m.id);
              })));
          }))),
    order && rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0 12px" } },
      rkh(AmgFieldBox, { label: "Số lượng kế hoạch của lệnh", hint: info && info.remain !== null ? `Còn lại công đoạn: ${fmtNum(info.remain)} · đã phân cho lệnh khác: ${fmtNum(info.plannedOpen)}` : "" },
        rkh("input", { className: "mes-input", inputMode: "decimal", value: planned, onChange: e => { setPlanned(e.target.value); setTouched(true); }, style: amgInputStyle })),
      rkh(AmgFieldBox, { label: "Ca" },
        rkh("select", { className: "mes-input", value: shift, onChange: e => setShift(e.target.value) }, rkh("option", null, "Ca Ngày"), rkh("option", null, "Ca Đêm"))),
      rkh(AmgFieldBox, { label: "Người vận hành" },
        rkh("input", { className: "mes-input", list: "amg-operators", value: operator, onChange: e => setOperator(e.target.value), placeholder: "Chọn hoặc nhập tên", style: amgInputStyle }),
        rkh("datalist", { id: "amg-operators" }, amgOperatorOptions(staff, stageKey).map(n => rkh("option", { key: n, value: n })))),
      rkh(AmgFieldBox, { label: "Tổ" }, rkh("div", { className: "mes-input", style: { cursor: "default", color: COLORS.textDim } }, amgTeamOfStage(stageKey) || "—"))),
    order && rkh(AmgFieldBox, { label: "Ghi chú", wide: true }, rkh("input", { className: "mes-input", value: note, onChange: e => setNote(e.target.value), placeholder: "Lưu ý cho người vận hành (không bắt buộc)", style: amgInputStyle })),
    order && rkh("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" } },
      rkh("input", { type: "checkbox", checked: startNow, onChange: e => setStartNow(e.target.checked), style: { width: 17, height: 17, accentColor: stageColor } }), "Bắt đầu chạy ngay (nếu bỏ chọn: lệnh ở trạng thái ĐÃ PHÂN MÁY, bấm Bắt đầu chạy sau)"),
    warns.map((w, i) => rkh(AmgNotice, { key: "w" + i, tone: "warn" }, "⚠ " + w)),
    order && problems.length > 0 && rkh(AmgNotice, { tone: "err" }, "Chưa thể xác nhận:\n• " + problems.join("\n• ")),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 } },
      rkh(Button, { onClick: onClose }, "Hủy"),
      rkh(Button, { variant: "primary", disabled: busy || problems.length > 0, onClick: submit }, busy ? "Đang lưu..." : "Xác nhận phân máy")));
}

/* ---------- Ghi sản lượng ---------- */
function OutputModal({ run, orders, machines, onClose, onDone }) {
  const { askConfirm } = useDialog();
  const keyRef = useRef(amgNewKey("OUT"));
  const order = orders.find(o => o.id === run.orderId);
  const machine = machines.find(m => m.id === run.machineId);
  const [qty, setQty] = useState("");
  const [ng, setNg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = amgParseQty(qty);
  const v = qty === "" ? { errors: [], warnings: [] } : amgValidateOutput({ order, run, machine, qty: q, orderId: run.orderId, machineId: run.machineId, stageKey: run.stageKey });
  const info = order ? amgStageInfo(order, [run], run.stageKey) : null;
  async function submit(confirmed) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await amgFlowRecordOutput({ clientKey: keyRef.current, runId: run.id, orderId: run.orderId, machineId: run.machineId, stageKey: run.stageKey, qty: q, ng, note, confirmWarnings: !!confirmed });
      onDone(res.duplicate ? "Lượt ghi này đã được lưu trước đó — không ghi trùng" : `Đã ghi ${fmtNum(q)} · ${amgStageLabel(run.stageKey)} đơn ${run.orderId} = ${fmtNum(res.stageDone)}`);
      onClose();
    } catch (e) {
      if (e.code === "needs-confirm") {
        setBusy(false);
        if (await askConfirm(e.message + "\n\nVẫn ghi nhận số lượng này?", { title: "Cần xác nhận", confirmLabel: "Vẫn ghi nhận" })) submit(true);
        return;
      }
      setError(e.message || String(e)); setBusy(false);
    }
  }
  if (!order) return rkh(Modal, { title: "Ghi sản lượng", onClose, width: 480 }, rkh(AmgNotice, { tone: "err" }, "Không tìm thấy đơn hàng của lệnh này."));
  const runRemain = Math.max(0, Math.round(((run.plannedQuantity || 0) - (run.producedQuantity || 0)) * 100) / 100);
  return rkh(Modal, { title: `Ghi sản lượng · máy ${run.machineId}`, onClose, width: 600 },
    amgSummaryRows(order, [["Công đoạn", amgStageLabel(run.stageKey)], ["Kế hoạch lệnh", fmtNum(run.plannedQuantity)], ["Đã chạy (lệnh)", fmtNum(run.producedQuantity || 0)], ["Còn lại (lệnh)", fmtNum(runRemain)], ["Đã làm (công đoạn)", fmtNum(info ? info.done : 0)]]),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0 12px" } },
      rkh(AmgFieldBox, { label: "Sản lượng lượt này (kg)", hint: "Chỉ nhập số của lượt này, không nhập cộng dồn." },
        rkh("input", { className: "mes-input", autoFocus: true, inputMode: "decimal", value: qty, onChange: e => setQty(e.target.value), placeholder: "0", style: Object.assign({ fontSize: 22, fontWeight: 700, fontFamily: FONT_MONO }, amgInputStyle) })),
      rkh(AmgFieldBox, { label: "NG / phế tại máy (không bắt buộc)" },
        rkh("input", { className: "mes-input", inputMode: "decimal", value: ng, onChange: e => setNg(e.target.value), placeholder: "0", style: amgInputStyle }))),
    runRemain > 0 && rkh("div", { style: { marginBottom: 10 } }, rkh(Button, { size: "sm", variant: "ghost", onClick: () => setQty(String(runRemain)) }, `Điền phần còn lại của lệnh (${fmtNum(runRemain)})`)),
    rkh(AmgFieldBox, { label: "Ghi chú", wide: true }, rkh("input", { className: "mes-input", value: note, onChange: e => setNote(e.target.value), style: amgInputStyle })),
    v.errors.length > 0 && rkh(AmgNotice, { tone: "err" }, v.errors.join("\n")),
    v.warnings.length > 0 && rkh(AmgNotice, { tone: "warn" }, "⚠ " + v.warnings.join("\n⚠ ")),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
      rkh(Button, { onClick: onClose }, "Hủy"),
      rkh(Button, { variant: "primary", disabled: busy || qty === "" || v.errors.length > 0, onClick: () => submit(false) }, busy ? "Đang lưu..." : "Lưu sản lượng")));
}

/* ---------- Tạm dừng ---------- */
function PauseModal({ run, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reasons = ["Đứt dây", "Chờ nguyên liệu", "Thay khuôn / đổi quy cách", "Máy có sự cố", "Hết ca", "Chờ QC"];
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try { await amgFlowPause(run.id, reason); onDone(`Đã tạm dừng lệnh ${run.id}`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Tạm dừng · máy ${run.machineId}`, onClose, width: 480 },
    rkh(AmgFieldBox, { label: "Lý do tạm dừng" },
      rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 } }, reasons.map(r => rkh("button", { key: r, type: "button", onClick: () => setReason(r), style: { padding: "5px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer", border: `1px solid ${reason === r ? COLORS.amber : COLORS.border}`, background: reason === r ? `${COLORS.amber}22` : COLORS.bgPanel2, color: COLORS.text } }, r))),
      rkh("input", { className: "mes-input", value: reason, onChange: e => setReason(e.target.value), placeholder: "Nhập lý do", style: amgInputStyle })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Hủy"), rkh(Button, { variant: "primary", disabled: busy || reason.trim().length < 3, onClick: submit }, busy ? "Đang lưu..." : "Tạm dừng lệnh")));
}

/* ---------- Kết thúc lệnh ---------- */
function FinishRunModal({ run, orders, runs, onClose, onDone }) {
  const order = orders.find(o => o.id === run.orderId);
  const q = order ? amgStageQty(order) : null;
  const done = order ? amgStageDone(order, run.stageKey) : 0;
  const enough = q === null ? false : done >= q * AMG_STAGE_SHORT_TOL;
  const siblings = (runs || []).filter(r => r.id !== run.id && r.orderId === run.orderId && r.stageKey === run.stageKey && amgIsOpenRun(r));
  const [completeStage, setCompleteStage] = useState(enough && siblings.length === 0);
  const [shortReason, setShortReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = order ? amgNextStage(order, run.stageKey) : null;
  const route = order ? amgOrderRoute(order) : [];
  const isLast = route[route.length - 1] === run.stageKey;
  const needReason = completeStage && !enough;
  const blocked = completeStage && siblings.length > 0;
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try {
      const res = await amgFlowFinishRun({ runId: run.id, completeStage, shortReason, note });
      let msg = `Đã kết thúc lệnh ${run.id} — máy ${run.machineId} đã được giải phóng.`;
      if (res.orderCompleted) msg += ` Đơn ${run.orderId} đã hoàn thành toàn bộ quy trình và chuyển sang tab Đơn hàng hoàn thành.`;
      else if (res.stageCompleted && next) msg += ` Công đoạn tiếp theo: ${amgStageLabel(next)} — hãy phân máy.`;
      else if (res.stageCompleted && isLast) msg += " Đã hoàn thành công đoạn cuối; đơn chờ xác nhận hoàn thành (chưa đủ số lượng).";
      onDone(msg); onClose();
    } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Kết thúc lệnh · máy ${run.machineId}`, onClose, width: 600 },
    order && amgSummaryRows(order, [["Công đoạn", amgStageLabel(run.stageKey)], ["Đã chạy (lệnh)", fmtNum(run.producedQuantity || 0)], ["Đã làm (công đoạn)", fmtNum(done)], ["Còn thiếu (công đoạn)", q === null ? "—" : fmtNum(Math.max(0, q - done))]]),
    rkh("label", { style: { display: "flex", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 10, marginBottom: 10, cursor: "pointer", border: `1.5px solid ${completeStage ? COLORS.green : COLORS.border}`, background: completeStage ? `${COLORS.green}12` : COLORS.bgPanel2 } },
      rkh("input", { type: "checkbox", checked: completeStage, onChange: e => setCompleteStage(e.target.checked), style: { width: 18, height: 18, marginTop: 2, accentColor: COLORS.green } }),
      rkh("div", null,
        rkh("div", { style: { fontWeight: 700, fontSize: 14 } }, `Hoàn thành công đoạn ${amgStageLabel(run.stageKey)} của đơn`),
        rkh("div", { style: { fontSize: 12, color: COLORS.textDim, marginTop: 3 } }, next ? `Sau đó đơn chuyển sang công đoạn ${amgStageLabel(next)}.` : isLast ? "Đây là công đoạn cuối: đủ số lượng thì đơn tự chuyển sang tab Đơn hàng hoàn thành." : ""),
        rkh("div", { style: { fontSize: 12, color: COLORS.textFaint, marginTop: 3 } }, "Bỏ chọn nếu chỉ kết thúc lệnh trên máy này và công đoạn còn tiếp tục chạy ở máy khác."))),
    blocked && rkh(AmgNotice, { tone: "err" }, `Công đoạn này còn lệnh đang mở trên máy ${siblings.map(r => r.machineId).join(", ")}. Kết thúc các lệnh đó trước, hoặc bỏ chọn "Hoàn thành công đoạn".`),
    needReason && !blocked && rkh(AmgNotice, { tone: "warn" }, `Công đoạn chưa đủ số lượng đặt (${fmtNum(done)} / ${fmtNum(q)}). Bắt buộc ghi lý do nếu vẫn hoàn thành công đoạn.`),
    needReason && rkh(AmgFieldBox, { label: "Lý do hoàn thành thiếu số lượng", wide: true }, rkh("input", { className: "mes-input", value: shortReason, onChange: e => setShortReason(e.target.value), placeholder: "Ví dụ: khách đồng ý giao đủ theo số đã làm", style: amgInputStyle })),
    rkh(AmgFieldBox, { label: "Ghi chú kết thúc lệnh", wide: true }, rkh("input", { className: "mes-input", value: note, onChange: e => setNote(e.target.value), style: amgInputStyle })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
      rkh(Button, { onClick: onClose }, "Hủy"),
      rkh(Button, { variant: "primary", disabled: busy || blocked || (needReason && shortReason.trim().length < 3), onClick: submit }, busy ? "Đang lưu..." : "Kết thúc lệnh & giải phóng máy")));
}

/* ---------- Hủy lệnh ---------- */
function CancelRunModal({ run, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return; setBusy(true); setError("");
    try { await amgFlowCancelRun(run.id, reason); onDone(`Đã hủy lệnh ${run.id}, máy ${run.machineId} được giải phóng`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Hủy lệnh · máy ${run.machineId}`, onClose, width: 460 },
    rkh(AmgNotice, { tone: "warn" }, "Chỉ hủy được lệnh chưa có sản lượng (phân nhầm máy/đơn). Lệnh đã có sản lượng phải dùng Kết thúc lệnh để giữ dữ liệu."),
    rkh(AmgFieldBox, { label: "Lý do hủy lệnh" }, rkh("input", { className: "mes-input", value: reason, onChange: e => setReason(e.target.value), style: amgInputStyle })),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng"), rkh(Button, { variant: "danger", disabled: busy || reason.trim().length < 3, onClick: submit }, busy ? "Đang lưu..." : "Hủy lệnh")));
}

/* ---------- Lịch sử đơn đã chạy trên một máy ---------- */
function MachineHistoryModal({ machine, runs, orders, entries, onClose }) {
  const list = amgSortRunsDesc(runs.filter(r => r.machineId === machine.id));
  const cols = [
    { key: "orderId", label: "Mã đơn" },
    { key: "customer", label: "Khách hàng", export: r => amgRunOrderInfo(r, orders).customer },
    { key: "spec", label: "Quy cách", export: r => amgRunOrderInfo(r, orders).spec },
    { key: "stage", label: "Công đoạn", export: r => amgStageLabel(r.stageKey) },
    { key: "planned", label: "Kế hoạch", export: r => r.plannedQuantity },
    { key: "produced", label: "Đã sản xuất", export: r => r.producedQuantity || 0 },
    { key: "operator", label: "Người vận hành", export: r => r.operator || "" },
    { key: "shift", label: "Ca", export: r => r.shift || "" },
    { key: "startedAt", label: "Bắt đầu", export: r => amgFmtDateTime(r.startedAt || r.assignedAt) },
    { key: "endedAt", label: "Kết thúc", export: r => (r.endedAt ? amgFmtDateTime(r.endedAt) : "Đang mở") },
    { key: "status", label: "Trạng thái", export: r => amgRunStatusMeta(r.productionStatus).label }
  ];
  return rkh(Modal, { title: `Lịch sử máy ${machine.id} · ${machine.typeLabel || ""}`, onClose, width: 860 },
    rkh("div", { className: "mes-no-print", style: { marginBottom: 10 } }, rkh(Button, { size: "sm", disabled: list.length === 0, onClick: () => amgExportExcel("lich-su-may-" + machine.id, cols, list, "Lịch sử máy") }, rkh(Download, { size: 13 }), " Xuất Excel")),
    list.length === 0 ? rkh("div", { style: { padding: 18, color: COLORS.textFaint, fontSize: 13 } }, "Máy này chưa từng được phân lệnh.") :
      rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 760 } },
        rkh("thead", null, rkh("tr", null, ["Đơn", "Khách hàng / quy cách", "Công đoạn", "Đã sản xuất / KH", "Người vận hành · ca", "Thời gian", "Trạng thái"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, list.map(r => {
          const oi = amgRunOrderInfo(r, orders), sm = amgRunStatusMeta(r.productionStatus);
          return rkh("tr", { key: r.id },
            rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, r.orderId),
            rkh("td", null, rkh("div", { style: { fontWeight: 600 } }, oi.customer || "—"), rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint } }, oi.spec || "")),
            rkh("td", null, rkh(Badge, { color: amgStageColor(r.stageKey) }, amgStageLabel(r.stageKey))),
            rkh("td", { className: "mes-mono" }, `${fmtNum(r.producedQuantity || 0)} / ${fmtNum(r.plannedQuantity)}`),
            rkh("td", null, `${r.operator || "—"} · ${r.shift || "—"}`),
            rkh("td", { style: { fontSize: 12 } }, amgFmtDateTime(r.startedAt || r.assignedAt), " → ", r.endedAt ? amgFmtDateTime(r.endedAt) : "đang mở"),
            rkh("td", null, rkh(Badge, { color: sm.color }, sm.label)));
        })))));
}
// Thông tin đơn của một lệnh: luôn lấy từ đơn gốc; chỉ khi đơn đã bị xóa mới dùng bản chụp lúc kết thúc lệnh
function amgRunOrderInfo(run, orders) {
  const o = (orders || []).find(x => x.id === run.orderId);
  if (o) return { customer: o.customer || "", spec: o.spec || "", materialCode: o.materialCode || "", quantity: o.quantity, found: true, order: o };
  const s = run.snapshot || {};
  return { customer: s.customer || "", spec: s.spec || "", materialCode: s.materialCode || "", quantity: s.orderQuantity ?? null, found: false, order: null };
}
