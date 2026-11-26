/* ===================== KẾ HOẠCH SẢN XUẤT — HỘP THOẠI THAO TÁC (v46) =====================
   Phân máy · Ghi sản lượng · Tạm dừng · Kết thúc lệnh · Lịch sử máy.
   Mọi thao tác gọi lớp ghi dạng giao dịch ở data/flowdata.js; giao diện chỉ kiểm tra sơ bộ để báo lỗi sớm,
   việc kiểm tra thật được lặp lại trong giao dịch với dữ liệu mới nhất. */

const amgInputStyle = { width: "100%" };
function AmgFieldBox({ label, hint, children, wide }) {
  return rkh("div", { style: { marginBottom: 12, gridColumn: wide ? "1 / -1" : undefined } },
    rkh("div", { style: { fontSize: FZ(12), fontWeight: 700, color: COLORS.textDim, marginBottom: 5 } }, label),
    children,
    hint && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 4 } }, hint));
}
function AmgNotice({ tone, children }) {
  const c = tone === "err" ? COLORS.red : tone === "warn" ? COLORS.amber : tone === "ok" ? COLORS.green : COLORS.blue;
  return rkh("div", { style: { padding: "9px 12px", borderRadius: 8, marginBottom: 10, fontSize: FZ(13), lineHeight: 1.55, background: `${c}14`, border: `1px solid ${c}55`, color: COLORS.text, whiteSpace: "pre-wrap" } }, children);
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
  const rows = [["Khách hàng", order.customer || "—"], ["Nguyên liệu", order.materialCode || "—"], ["Quy cách", order.spec || "—"], ["Số lượng đặt", fmtNum(order.quantity) + " " + amgOrderUnit(order)]].concat(extraRows || []);
  return rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, padding: 10, borderRadius: 10, background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, marginBottom: 12 } },
    rows.map(([a, b]) => rkh("div", { key: a }, rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, fontWeight: 600 } }, a), rkh("div", { style: { fontSize: FZ(14), fontWeight: 700, color: COLORS.text, wordBreak: "break-word" } }, b))));
}

/* ---------- Đồng hồ dùng chung (v48) ----------
   MỘT bộ đếm 1 giây cho cả trang; chỉ các thành phần đang cần (lệnh đang chạy/tạm dừng) mới đăng ký. Tuyệt đối không ghi Firebase mỗi giây:
   thời gian hiển thị luôn được TÍNH từ mốc thời gian đã lưu (amgRunTiming). */
const AMG_TICK = { subs: new Set(), timer: null };
function amgUseNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const f = () => setNow(Date.now());
    AMG_TICK.subs.add(f);
    if (!AMG_TICK.timer) AMG_TICK.timer = setInterval(() => { AMG_TICK.subs.forEach(fn => fn()); }, 1000);
    f();
    return () => { AMG_TICK.subs.delete(f); if (AMG_TICK.subs.size === 0 && AMG_TICK.timer) { clearInterval(AMG_TICK.timer); AMG_TICK.timer = null; } };
  }, [active]);
  return now;
}
// Bảng chỉ số của một lệnh: dùng trong thẻ máy, chi tiết lệnh, TV
function RunMetrics({ run, order, now, tv, compact }) {
  const t = amgRunTiming(run, now, order), u = t.unit;
  const paused = run.productionStatus === "paused";
  const cell = (label, value, strong, color) => rkh("div", { key: label, className: "amg-metric", style: { minWidth: 0 } },
    rkh("div", { className: "amg-metric-l" + (tv ? " amg-metric-l--tv" : "") }, label),
    rkh("div", { className: "mes-mono amg-metric-v" + (tv ? " amg-metric-v--tv" : "") + (strong ? " amg-metric-v--strong" : ""), style: color ? { color } : undefined }, value));
  const rate = t.ratePerHour === null ? "—" : `${fmtNum(t.ratePerHour)} ${u}/giờ`;
  const cells = [
    cell("Bắt đầu", t.startedAt ? amgFmtDateTime(t.startedAt) : "Chưa bắt đầu"),
    cell("Tổng thời gian chạy", t.startedAt ? amgClock(t.elapsedMs) : "—", true),
    cell("Tạm dừng", t.startedAt ? amgClock(t.pausedMs) + (t.pauseCount ? ` (${t.pauseCount} lần)` : "") : "—", false, paused ? COLORS.amber : undefined),
    cell("Sản xuất thực tế", t.startedAt ? amgClock(t.netMs) : "—", true, run.productionStatus === "running" ? COLORS.green : undefined)
  ];
  if (!compact) cells.push(
    cell("Kết thúc", t.endedAt ? amgFmtDateTime(t.endedAt) : "—"),
    cell("Kế hoạch", `${fmtNum(t.planned)} ${u}`),
    cell("Đã chạy", `${fmtNum(t.produced)} ${u}`, true),
    cell("Còn lại", `${fmtNum(t.remain)} ${u}`, true),
    cell("Năng suất TB", rate, true));
  else cells.push(cell("Năng suất TB", rate, true));
  return rkh("div", { className: "amg-metrics" + (compact ? " amg-metrics--compact" : "") }, cells);
}

/* ---------- Phân máy ---------- */
// Ba lối vào, cùng một logic kiểm tra:
//   order       : mở từ một đơn (chọn công đoạn trong routing của đơn → máy)
//   machine     : mở từ thẻ máy trống (đơn chọn trong danh sách đủ điều kiện của công đoạn máy đó)
//   wizard      : Công đoạn → Máy → Đơn (danh sách đơn = đúng các đơn có công đoạn đó trong routing đã xác nhận)
function AssignModal({ order: orderProp, orders, machines, runs, staff, fixedMachine, initialStage, onClose, onDone }) {
  const keyRef = useRef(amgNewKey("RUN"));
  const mode = fixedMachine ? "machine" : orderProp ? "order" : "wizard";
  const [orderId, setOrderId] = useState(orderProp ? orderProp.id : "");
  const order = orderProp || orders.find(o => o.id === orderId) || null;
  const route = order ? amgOrderRoute(order) : [];
  const stageOK = k => (order ? amgStageAssignable(order, k) : { ok: false });
  const firstOK = route.find(k => stageOK(k).ok) || route[0] || "";
  const [stageKey, setStageKey] = useState(fixedMachine ? amgMachineStage(fixedMachine) : initialStage || (mode === "order" ? firstOK : ""));
  const [machineId, setMachineId] = useState(fixedMachine ? fixedMachine.id : "");
  const [planned, setPlanned] = useState("");
  const [touched, setTouched] = useState(false);
  const [shift, setShift] = useState(amgCurrentShift().label);
  const [operator, setOperator] = useState("");
  const [note, setNote] = useState("");
  const [startNow, setStartNow] = useState(false); // mặc định CHỈ phân máy (ĐÃ PHÂN MÁY); xác nhận bắt đầu chạy là bước riêng ngay sau đó
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stagesWithMachines = useMemo(() => STAGES.filter(s => amgMachinesForStage(machines, s.key).length > 0), [machines]);
  // Danh sách đơn của công đoạn: CHỈ đơn có công đoạn này trong routing đã xác nhận (xem amgOrdersForStage)
  const stageOrders = useMemo(() => (mode !== "order" && stageKey ? amgOrdersForStage(orders, runs, stageKey) : { eligible: [], waiting: [] }), [orders, runs, stageKey, mode]);
  const info = order && stageKey ? amgStageInfo(order, runs, stageKey) : null;
  useEffect(() => {
    if (touched || !info) return;
    const rem = info.remain === null ? "" : Math.max(0, info.remain - info.plannedOpen);
    setPlanned(rem === "" ? "" : String(Math.round(rem * 100) / 100));
  }, [orderId, stageKey]); // eslint-disable-line

  const stageMachines = useMemo(() => (fixedMachine ? [fixedMachine] : stageKey ? amgMachinesForStage(machines, stageKey) : []), [machines, stageKey, fixedMachine]);
  const types = fixedMachine ? [MACHINE_TYPES.find(t => t.key === fixedMachine.typeKey)].filter(Boolean) : stageKey ? amgStageMachineTypes(stageKey) : [];
  const chosen = machines.find(m => m.id === machineId) || null;
  const chosenCheck = chosen ? amgMachineAssignable(chosen, stageKey, runs) : null;
  const plannedNum = amgParseQty(planned);
  const unit = amgOrderUnit(order);
  const warns = [];
  if (chosenCheck && chosenCheck.ok && chosenCheck.warn) warns.push(chosenCheck.warn + " (vẫn có thể phân lệnh)");
  if (info && info.remain !== null && Number.isFinite(plannedNum) && plannedNum > info.remain * 1.1 && info.remain > 0) warns.push(`Số lượng kế hoạch (${fmtNum(plannedNum)} ${unit}) lớn hơn phần còn lại của công đoạn (${fmtNum(info.remain)} ${unit})`);
  if (info && info.openRuns.length > 0) warns.push(`Công đoạn này đang có ${info.openRuns.length} lệnh khác (máy ${info.openRuns.map(r => r.machineId).join(", ")}) — đang chia lệnh qua nhiều máy`);
  const stageCheck = stageOK(stageKey);
  const problems = [];
  if (!stageKey) problems.push("Chọn công đoạn");
  if (!chosen) problems.push("Chọn máy");
  else if (chosenCheck && !chosenCheck.ok) problems.push(chosenCheck.reason);
  if (!order) problems.push("Chọn đơn hàng");
  else if (!stageCheck.ok) problems.push(stageCheck.reason);
  if (!Number.isFinite(plannedNum) || plannedNum <= 0) problems.push("Nhập số lượng kế hoạch hợp lệ (> 0)");
  if (!operator.trim()) problems.push("Nhập người vận hành");

  async function submit() {
    if (busy || problems.length) return;
    setBusy(true); setError("");
    try {
      const res = await amgFlowAssign({ runId: keyRef.current, orderId: order.id, machineId, stageKey, plannedQuantity: planned, shift, operator, team: amgTeamOfStage(stageKey), note, startNow, knownMachineRunIds: amgOpenRunsOfMachine(runs, machineId).map(r => r.id) });
      onDone(res.duplicate ? `Lệnh ${res.run.id} đã được ghi nhận trước đó` : `Đã phân đơn ${amgOrderLabel(order)} vào máy ${machineId}${startNow ? " và bắt đầu chạy" : ""}`, res.run, !startNow && !res.duplicate);
      onClose();
    } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }

  const stageColor = amgStageColor(stageKey);
  const pillBtn = (k, on, ck, label) => { const c = amgStageColor(k); return rkh("button", { key: k, type: "button", disabled: !ck.ok, title: ck.ok ? "" : ck.reason, onClick: () => { setStageKey(k); setMachineId(""); setTouched(false); if (mode === "wizard") setOrderId(""); },
    style: { padding: "8px 14px", borderRadius: 999, cursor: ck.ok ? "pointer" : "not-allowed", fontWeight: 700, fontSize: FZ(13), border: `2px solid ${on ? c : COLORS.border}`, background: on ? `${c}22` : COLORS.bgPanel2, color: on ? c : ck.ok ? COLORS.text : COLORS.textFaint, opacity: ck.ok ? 1 : 0.55 } }, label); };
  const stepTitle = (n, t) => rkh("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.copper, margin: "4px 0 6px", textTransform: "uppercase", letterSpacing: ".05em" } }, `Bước ${n} · ${t}`);

  const orderPicker = rkh(AmgFieldBox, { key: "op", label: mode === "wizard" ? "Chọn đơn hàng (đủ điều kiện của công đoạn này)" : "Đơn hàng",
    hint: stageOrders.eligible.length === 0 ? (stageKey ? "Chưa có đơn nào đủ điều kiện ở công đoạn này. Đơn chỉ hiện khi công đoạn nằm trong quy trình đã xác nhận của đơn." : "") : `${stageOrders.eligible.length} đơn đủ điều kiện${stageOrders.waiting.length ? ` · ${stageOrders.waiting.length} đơn đang chờ công đoạn trước` : ""}. Đơn đã hoàn thành công đoạn này hoặc không có công đoạn này trong quy trình sẽ không hiện.` },
    rkh("select", { className: "mes-input", value: orderId, onChange: e => { setOrderId(e.target.value); setTouched(false); } },
      rkh("option", { value: "" }, "— Chọn đơn hàng —"),
      stageOrders.eligible.map(o => rkh("option", { key: o.id, value: o.id }, `${o.customer || ""} · ${o.spec || ""} · ${fmtNum(o.quantity)} ${amgOrderUnit(o)}${o.priority && o.priority !== "normal" ? " · " + amgPriorityMeta(o.priority).label : ""}`)),
      stageOrders.waiting.map(w => rkh("option", { key: w.order.id, value: "", disabled: true }, `${amgOrderLabel(w.order)} — chờ: ${w.reason}`))));

  const machineSection = stageKey && rkh(AmgFieldBox, { key: "ms", label: fixedMachine ? "Máy" : `Chọn máy — nhóm ${amgStageLabel(stageKey)} (${stageMachines.length} máy)`, hint: fixedMachine ? "" : "Chỉ hiện máy thuộc công đoạn đã chọn. Máy hỏng, bảo trì hoặc đang giữ lệnh khác bị khóa." },
    rkh("div", { style: { maxHeight: 250, overflowY: "auto", padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 10, background: COLORS.bgInset } },
      stageMachines.length === 0 ? rkh("div", { style: { fontSize: FZ(13), color: COLORS.textFaint } }, "Danh mục chưa có máy cho công đoạn này.") :
        types.map(t => {
          const list = stageMachines.filter(m => m.typeKey === t.key);
          if (!list.length) return null;
          return rkh("div", { key: t.key, style: { marginBottom: 10 } },
            rkh("div", { style: { fontSize: FZ(12), fontWeight: 800, color: t.color, marginBottom: 6 } }, `${t.label} (${t.prefix}) · ${list.length} máy`),
            rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(78px,1fr))", gap: 6 } }, list.map(m => {
              const ck = amgMachineAssignable(m, stageKey, runs), on = machineId === m.id;
              const c = !ck.ok ? (m.status === "broken" ? COLORS.red : m.status === "maintenance" ? COLORS.violet : COLORS.amber) : t.color;
              return rkh("button", { key: m.id, type: "button", disabled: !ck.ok || !!fixedMachine, title: ck.ok ? `${m.id} — sẵn sàng` : ck.reason, onClick: () => setMachineId(m.id),
                style: { padding: "7px 4px", borderRadius: 8, fontSize: FZ(12), fontWeight: 700, fontFamily: FONT_MONO, cursor: ck.ok && !fixedMachine ? "pointer" : "not-allowed", border: `2px solid ${on ? c : `${c}55`}`, background: on ? c : `${c}12`, color: on ? "#fff" : ck.ok ? COLORS.text : COLORS.textFaint, opacity: ck.ok ? 1 : 0.6, textDecoration: ck.ok ? "none" : "line-through" } }, m.id);
            })));
        })));

  const title = mode === "machine" ? `Phân lệnh cho máy ${fixedMachine.id}` : mode === "order" ? `Phân máy · ${order ? amgOrderLabel(order) : ""}` : "Phân lệnh sản xuất";
  return rkh(Modal, { title, onClose, width: 780 },
    mode === "wizard" && stepTitle(1, "Chọn công đoạn"),
    mode === "wizard" && rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 } }, stagesWithMachines.map(s => pillBtn(s.key, stageKey === s.key, { ok: true }, s.label))),
    mode === "wizard" && stageKey && stepTitle(2, "Chọn máy phù hợp"),
    mode === "wizard" && machineSection,
    mode === "wizard" && stageKey && machineId && stepTitle(3, "Chọn đơn hàng"),
    mode === "wizard" && stageKey && machineId && orderPicker,
    mode === "machine" && orderPicker,
    order && amgSummaryRows(order, [["Tồn kho", `${fmtNum(order.inventory || 0)} ${unit}`],
      ["Quy trình", amgOrderRoute(order).map(amgStageLabel).join(" → ")],
      ["Đã hoàn thành (công đoạn)", info ? `${fmtNum(info.done)} ${unit}` : "—"], ["Còn lại (công đoạn)", info && info.remain !== null ? `${fmtNum(Math.max(0, info.remain))} ${unit}` : "—"],
      ["Ngày giao", order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—"], ["Ưu tiên", amgPriorityMeta(order.priority).label]]),
    mode === "order" && order && rkh(AmgFieldBox, { label: "Công đoạn cần phân máy (theo quy trình đã xác nhận)" },
      rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, route.map(k => pillBtn(k, stageKey === k, stageOK(k), amgStageLabel(k))))),
    (mode === "order" || mode === "machine") && order && machineSection,
    order && stageKey && rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0 12px" } },
      rkh(AmgFieldBox, { label: `Số lượng kế hoạch của lệnh (${unit})`, hint: info && info.remain !== null ? `Còn lại công đoạn: ${fmtNum(info.remain)} ${unit} · đã phân cho lệnh khác: ${fmtNum(info.plannedOpen)}` : "" },
        rkh("input", { className: "mes-input", inputMode: "decimal", value: planned, onChange: e => { setPlanned(e.target.value); setTouched(true); }, style: amgInputStyle })),
      rkh(AmgFieldBox, { label: "Ca" },
        rkh("select", { className: "mes-input", value: shift, onChange: e => setShift(e.target.value) }, rkh("option", null, "Ca Ngày"), rkh("option", null, "Ca Đêm"))),
      rkh(AmgFieldBox, { label: "Người vận hành" },
        rkh("input", { className: "mes-input", list: "amg-operators", value: operator, onChange: e => setOperator(e.target.value), placeholder: "Chọn hoặc nhập tên", style: amgInputStyle }),
        rkh("datalist", { id: "amg-operators" }, amgOperatorOptions(staff, stageKey).map(n => rkh("option", { key: n, value: n })))),
      rkh(AmgFieldBox, { label: "Tổ" }, rkh("div", { className: "mes-input", style: { cursor: "default", color: COLORS.textDim } }, amgTeamOfStage(stageKey) || "—"))),
    order && rkh(AmgFieldBox, { label: "Ghi chú", wide: true }, rkh("input", { className: "mes-input", value: note, onChange: e => setNote(e.target.value), placeholder: "Lưu ý cho người vận hành (không bắt buộc)", style: amgInputStyle })),
    order && rkh("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: FZ(13), marginBottom: 12, cursor: "pointer" } },
      rkh("input", { type: "checkbox", checked: startNow, onChange: e => setStartNow(e.target.checked), style: { width: 17, height: 17, accentColor: stageColor } }), "Bắt đầu chạy ngay (bỏ chọn: sau khi phân lệnh, hệ thống hỏi xác nhận bắt đầu chạy máy)"),
    warns.map((w, i) => rkh(AmgNotice, { key: "w" + i, tone: "warn" }, "⚠ " + w)),
    (order || machineId) && problems.length > 0 && rkh(AmgNotice, { tone: "err" }, "Chưa thể xác nhận:\n• " + problems.join("\n• ")),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 } },
      rkh(Button, { onClick: onClose }, "Hủy"),
      rkh(Button, { variant: "primary", disabled: busy || problems.length > 0, onClick: submit }, busy ? "Đang lưu..." : startNow ? "Xác nhận phân lệnh & bắt đầu chạy" : "Xác nhận phân lệnh")));
}

/* ---------- Xác nhận bắt đầu chạy máy (bước 8) ---------- */
function StartConfirmModal({ run, orders, onClose, onDone }) {
  const order = orders.find(o => o.id === run.orderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    if (busy) return; setBusy(true); setError("");
    try { const r = await amgFlowStart(run.id); onDone(r.duplicate ? "Máy đã chạy từ trước" : `Đã bắt đầu chạy máy ${run.machineId} — ${amgOrderLabelById(run.orderId)}`); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Xác nhận bắt đầu chạy · máy ${run.machineId}`, onClose, width: 520 },
    rkh(AmgNotice, { tone: "info" }, "Lệnh đã được lưu (ĐÃ PHÂN MÁY). Bấm xác nhận khi máy thật sự bắt đầu chạy — hệ thống ghi thời gian bắt đầu và chuyển máy sang ĐANG CHẠY trên mọi thiết bị."),
    order && amgSummaryRows(order, [["Máy", run.machineId], ["Công đoạn", amgStageLabel(run.stageKey)], ["Kế hoạch lệnh", `${fmtNum(run.plannedQuantity)} ${run.unit || amgOrderUnit(order)}`], ["Người vận hành · ca", `${run.operator || "—"} · ${run.shift || "—"}`]]),
    error && rkh(AmgNotice, { tone: "err" }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Để sau"), rkh(Button, { variant: "primary", disabled: busy, onClick: go }, busy ? "Đang lưu..." : "Xác nhận bắt đầu chạy máy")));
}

/* ---------- Chi tiết lệnh: thời gian, sản lượng, lịch sử ghi, tạm dừng ---------- */
function RunDetailModal({ run, orders, entries, can, onClose }) {
  const [pauseDlg, setPauseDlg] = useState(null);
  const order = orders.find(o => o.id === run.orderId) || null;
  const active = run.productionStatus === "running" || run.productionStatus === "paused";
  const now = amgUseNow(active);
  const oi = amgRunOrderInfo(run, orders), sm = amgRunStatusMeta(run.productionStatus);
  const t = amgRunTiming(run, now, order), u = t.unit;
  const list = (entries || []).filter(e => e.runId === run.id).sort((a, b) => String(b.enteredAt || "").localeCompare(String(a.enteredAt || "")));
  const sumQty = list.filter(e => !e.voided).reduce((s, e) => s + (Number(e.qty) || 0), 0);
  return rkh(Modal, { title: `Lệnh ${run.machineId} · ${amgOrderLabelById(run.orderId)}`, onClose, width: 820 },
    rkh("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 } }, rkh(Badge, { color: sm.color }, sm.label), rkh(Badge, { color: amgStageColor(run.stageKey) }, amgStageLabel(run.stageKey)),
      rkh("span", { style: { fontSize: FZ(13), color: COLORS.textDim } }, `${oi.customer || "—"} · ${oi.spec || "—"} · NL ${oi.materialCode || "—"}`),
      rkh("span", { className: "mes-mono", style: { marginLeft: "auto", fontSize: FZ(26), fontWeight: 800, color: run.productionStatus === "running" ? COLORS.green : COLORS.text } }, t.startedAt ? amgClock(t.netMs) : "—:--")),
    rkh(RunMetrics, { run, order, now }),
    rkh("div", { style: { margin: "10px 0 4px" } }, rkh(ProgressBar, { pct: t.pct, color: amgStageColor(run.stageKey) }), rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim, marginTop: 3 } }, `Đã chạy ${fmtNum(t.produced)} / ${fmtNum(t.planned)} ${u}${t.pct === null ? "" : " · " + Math.round(t.pct) + "%"} · Người vận hành ${run.operator || "—"} · ${run.shift || "—"}`)),
    (run.pauses || []).length > 0 && rkh("div", { style: { marginTop: 10 } }, rkh("div", { style: { fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, marginBottom: 4 } }, "LỊCH SỬ TẠM DỪNG · đồng bộ sang tab Theo dõi thời gian dừng máy"),
      (run.pauses || []).map((p, i) => rkh("div", { key: i, style: { fontSize: FZ(13), padding: "6px 8px", borderRadius: 6, background: COLORS.bgInset, marginBottom: 3, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", opacity: p.cancelled ? 0.6 : 1 } },
        rkh("span", { style: { flex: "1 1 320px", textDecoration: p.cancelled ? "line-through" : "none" } },
          `${amgFmtDateTime(p.at)} → ${p.resumedAt ? amgFmtDateTime(p.resumedAt) : "đang tạm dừng"} · ${amgHm(amgMs(p.resumedAt || (run.endedAt || now)) - amgMs(p.at))} · ${p.reason || ""}${p.by ? " · " + p.by : ""}`),
        rkh("span", { className: "mes-mono", style: { fontSize: FZ(11), color: COLORS.textFaint } }, amgDtEventId(run.id, i)),
        p.cancelled && rkh(Badge, { color: COLORS.textFaint }, "Đã hủy" + (p.cancelReason ? ": " + p.cancelReason : "")),
        !p.cancelled && p.editedBy && rkh(Badge, { color: COLORS.blue }, "Đã sửa"),
        can && can.plan && !p.cancelled && rkh(Button, { size: "sm", variant: "ghost", onClick: () => setPauseDlg({ kind: "edit", idx: i }) }, "Sửa"),
        can && can.plan && !p.cancelled && p.resumedAt && rkh(Button, { size: "sm", variant: "ghost", onClick: () => setPauseDlg({ kind: "cancel", idx: i }) }, "Hủy")))),
    pauseDlg && pauseDlg.kind === "edit" && rkh(PauseEditModal, { run, idx: pauseDlg.idx, onClose: () => setPauseDlg(null) }),
    pauseDlg && pauseDlg.kind === "cancel" && rkh(PauseCancelModal, { run, idx: pauseDlg.idx, onClose: () => setPauseDlg(null) }),
    rkh("div", { style: { marginTop: 12, fontSize: FZ(12), fontWeight: 800, color: COLORS.textDim, marginBottom: 4 } }, `LỊCH SỬ GHI SẢN LƯỢNG (${list.length} lượt · tổng ${fmtNum(sumQty)} ${u})`),
    list.length === 0 ? rkh("div", { style: { fontSize: FZ(13), color: COLORS.textFaint, padding: "6px 0" } }, "Chưa có lượt ghi sản lượng.") :
      rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 620, fontSize: FZ(13) } },
        rkh("thead", null, rkh("tr", null, ["Thời gian", "Người ghi", "Máy", "Công đoạn", "Sản lượng", "NG", "Ghi chú"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, list.map(e => rkh("tr", { key: e.id, style: { opacity: e.voided ? 0.5 : 1, textDecoration: e.voided ? "line-through" : "none" } },
          rkh("td", null, amgFmtDateTime(e.enteredAt)), rkh("td", null, e.enteredBy || "—"), rkh("td", { className: "mes-mono" }, e.machineId), rkh("td", null, amgStageLabel(e.stageKey)),
          rkh("td", { className: "mes-mono", style: { fontWeight: 700 } }, `${fmtNum(e.qty)} ${e.unit || u}`), rkh("td", { className: "mes-mono" }, Number(e.ng) > 0 ? fmtNum(e.ng) : "—"), rkh("td", null, e.note || "")))))),
    rkh("div", { className: "mes-no-print", style: { marginTop: 12, display: "flex", justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng")));
}

/* ---------- Ghi sản lượng ---------- */
function OutputModal({ run, orders, machines, entries, onClose, onDone }) {
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
      onDone(res.duplicate ? "Lượt ghi này đã được lưu trước đó — không ghi trùng" : `Đã ghi ${fmtNum(q)} ${unit} · ${amgStageLabel(run.stageKey)} đơn ${amgOrderLabelById(run.orderId)} = ${fmtNum(res.stageDone)}`);
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
  const unit = run.unit || amgOrderUnit(order);
  const recent = (entries || []).filter(e => e.runId === run.id && !e.voided).sort((a, b) => String(b.enteredAt || "").localeCompare(String(a.enteredAt || ""))).slice(0, 5);
  return rkh(Modal, { title: `Ghi sản lượng · máy ${run.machineId}`, onClose, width: 600 },
    amgSummaryRows(order, [["Công đoạn", amgStageLabel(run.stageKey)], ["Kế hoạch lệnh", `${fmtNum(run.plannedQuantity)} ${unit}`], ["Đã chạy (lệnh)", `${fmtNum(run.producedQuantity || 0)} ${unit}`], ["Còn lại (lệnh)", `${fmtNum(runRemain)} ${unit}`], ["Đã làm (công đoạn)", `${fmtNum(info ? info.done : 0)} ${unit}`]]),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0 12px" } },
      rkh(AmgFieldBox, { label: `Sản lượng lượt này (${unit})`, hint: "Chỉ nhập số của lượt này, không nhập cộng dồn. Có thể ghi nhiều lần trong ca." },
        rkh("input", { className: "mes-input", autoFocus: true, inputMode: "decimal", value: qty, onChange: e => setQty(e.target.value), placeholder: "0", style: Object.assign({ fontSize: FZ(22), fontWeight: 700, fontFamily: FONT_MONO }, amgInputStyle) })),
      rkh(AmgFieldBox, { label: "NG / phế tại máy (không bắt buộc)" },
        rkh("input", { className: "mes-input", inputMode: "decimal", value: ng, onChange: e => setNg(e.target.value), placeholder: "0", style: amgInputStyle }))),
    runRemain > 0 && rkh("div", { style: { marginBottom: 10 } }, rkh(Button, { size: "sm", variant: "ghost", onClick: () => setQty(String(runRemain)) }, `Điền phần còn lại của lệnh (${fmtNum(runRemain)})`)),
    rkh(AmgFieldBox, { label: "Ghi chú", wide: true }, rkh("input", { className: "mes-input", value: note, onChange: e => setNote(e.target.value), style: amgInputStyle })),
    recent.length > 0 && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim, marginBottom: 10, padding: "6px 8px", borderRadius: 8, background: COLORS.bgInset } }, rkh("b", null, "Các lượt ghi gần nhất:"), recent.map(e => rkh("div", { key: e.id, className: "mes-mono" }, `${amgFmtDateTime(e.enteredAt)} · ${fmtNum(e.qty)} ${e.unit || unit} · ${e.enteredBy || "—"}`))),
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
      rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 } }, reasons.map(r => rkh("button", { key: r, type: "button", onClick: () => setReason(r), style: { padding: "5px 10px", borderRadius: 999, fontSize: FZ(12), cursor: "pointer", border: `1px solid ${reason === r ? COLORS.amber : COLORS.border}`, background: reason === r ? `${COLORS.amber}22` : COLORS.bgPanel2, color: COLORS.text } }, r))),
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
      const res = await amgFlowFinishRun({ runId: run.id, completeStage, shortReason, note, knownSiblingRunIds: siblings.map(r => r.id) });
      let msg = `Đã kết thúc lệnh ${run.id} — máy ${run.machineId} đã được giải phóng, lịch sử sản xuất được giữ nguyên.`;
      if (res.stageCompleted && next) msg += ` Đã hoàn thành công đoạn ${amgStageLabel(run.stageKey)}; đơn chuyển sang công đoạn ${amgStageLabel(next)} — hãy phân máy.`;
      else if (res.readyToComplete) msg += ` Đã hoàn thành công đoạn cuối: đơn ${amgOrderLabelById(run.orderId)} đủ điều kiện — bấm HOÀN THÀNH ĐƠN tại Kế hoạch sản xuất khi muốn đóng đơn.`;
      else if (res.stageCompleted) msg += ` Đã hoàn thành công đoạn ${amgStageLabel(run.stageKey)}.`;
      onDone(msg, res); onClose();
    } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Kết thúc lệnh · máy ${run.machineId}`, onClose, width: 600 },
    order && amgSummaryRows(order, [["Công đoạn", amgStageLabel(run.stageKey)], ["Đã chạy (lệnh)", fmtNum(run.producedQuantity || 0)], ["Đã làm (công đoạn)", fmtNum(done)], ["Còn thiếu (công đoạn)", q === null ? "—" : fmtNum(Math.max(0, q - done))]]),
    rkh("label", { style: { display: "flex", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 10, marginBottom: 10, cursor: "pointer", border: `1px solid ${completeStage ? COLORS.green : COLORS.border}`, background: completeStage ? `${COLORS.green}12` : COLORS.bgPanel2 } },
      rkh("input", { type: "checkbox", checked: completeStage, onChange: e => setCompleteStage(e.target.checked), style: { width: 18, height: 18, marginTop: 2, accentColor: COLORS.green } }),
      rkh("div", null,
        rkh("div", { style: { fontWeight: 700, fontSize: FZ(14) } }, `Hoàn thành công đoạn ${amgStageLabel(run.stageKey)} của đơn (khác với kết thúc lệnh)`),
        rkh("div", { style: { fontSize: FZ(12), color: COLORS.textDim, marginTop: 3 } }, next ? `Sau đó đơn chuyển sang công đoạn ${amgStageLabel(next)}.` : isLast ? "Đây là công đoạn cuối: sau đó hệ thống hỏi xác nhận HOÀN THÀNH ĐƠN (người có quyền xác nhận). Đơn chưa tự chuyển sang tab hoàn thành." : ""),
        rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: 3 } }, "Chỉ KẾT THÚC LỆNH (bỏ chọn): giải phóng máy, giữ nguyên đơn và công đoạn — công đoạn còn có thể phân tiếp ở máy khác."))),
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
    list.length === 0 ? rkh("div", { style: { padding: 18, color: COLORS.textFaint, fontSize: FZ(13) } }, "Máy này chưa từng được phân lệnh.") :
      rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { minWidth: 760 } },
        rkh("thead", null, rkh("tr", null, ["Khách hàng / quy cách", "Công đoạn", "Đã sản xuất / KH", "Người vận hành · ca", "Thời gian", "Trạng thái"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, list.map(r => {
          const oi = amgRunOrderInfo(r, orders), sm = amgRunStatusMeta(r.productionStatus);
          return rkh("tr", { key: r.id },
            rkh("td", null, rkh("div", { style: { fontWeight: 600 } }, oi.customer || "—"), rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, oi.spec || "")),
            rkh("td", null, rkh(Badge, { color: amgStageColor(r.stageKey) }, amgStageLabel(r.stageKey))),
            rkh("td", { className: "mes-mono" }, `${fmtNum(r.producedQuantity || 0)} / ${fmtNum(r.plannedQuantity)}`),
            rkh("td", null, `${r.operator || "—"} · ${r.shift || "—"}`),
            rkh("td", { style: { fontSize: FZ(12) } }, amgFmtDateTime(r.startedAt || r.assignedAt), " → ", r.endedAt ? amgFmtDateTime(r.endedAt) : "đang mở"),
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


/* ---------- v55: sửa / hủy một lần tạm dừng (nguồn của tab Theo dõi thời gian dừng máy) ---------- */
function amgDtToLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function PauseEditModal({ run, idx, onClose }) {
  const p = (run.pauses || [])[idx] || {};
  const [reason, setReason] = useState(p.reason || "");
  const [start, setStart] = useState(amgDtToLocalInput(p.at));
  const [end, setEnd] = useState(p.resumedAt ? amgDtToLocalInput(p.resumedAt) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      const patch = { reason };
      const s0 = amgDtToLocalInput(p.at), e0 = p.resumedAt ? amgDtToLocalInput(p.resumedAt) : "";
      if (start !== s0) patch.startAt = new Date(start).toISOString();       // chỉ ghi lại mốc người dùng đã đổi (giữ nguyên giây/mili giây gốc)
      if (p.resumedAt && end !== e0) patch.endAt = new Date(end).toISOString();
      await amgFlowEditPause(run.id, idx, patch, note);
      onClose();
    } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Sửa lần dừng ${amgDtEventId(run.id, idx)} · máy ${run.machineId}`, onClose, width: 520 },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, "Thay đổi được cập nhật ngay sang tab Theo dõi thời gian dừng máy; nội dung trước và sau khi sửa được lưu lại để truy xuất."),
    rkh(AmgFieldBox, { label: "Nguyên nhân dừng" }, rkh("textarea", { className: "mes-input", rows: 2, value: reason, onChange: e => setReason(e.target.value) })),
    rkh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
      rkh(AmgFieldBox, { label: "Bắt đầu dừng" }, rkh("input", { type: "datetime-local", className: "mes-input", value: start, onChange: e => setStart(e.target.value) })),
      rkh(AmgFieldBox, { label: p.resumedAt ? "Kết thúc dừng" : "Kết thúc dừng (đang dừng — bấm Tiếp tục để kết thúc)" }, rkh("input", { type: "datetime-local", className: "mes-input", value: end, disabled: !p.resumedAt, onChange: e => setEnd(e.target.value) }))),
    rkh(AmgFieldBox, { label: "Lý do chỉnh sửa (bắt buộc)" }, rkh("input", { className: "mes-input", value: note, onChange: e => setNote(e.target.value), placeholder: "VD: ghi nhầm giờ, bổ sung nguyên nhân" })),
    error && rkh("div", { style: { color: COLORS.red, fontSize: FZ(13), marginBottom: 8 } }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng"), rkh(Button, { variant: "primary", disabled: busy || note.trim().length < 3 || reason.trim().length < 3, onClick: save }, busy ? "Đang lưu…" : "Lưu thay đổi")));
}
function PauseCancelModal({ run, idx, onClose }) {
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try { await amgFlowCancelPause(run.id, idx, why); onClose(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
  }
  return rkh(Modal, { title: `Hủy lần dừng ${amgDtEventId(run.id, idx)} · máy ${run.machineId}`, onClose, width: 480 },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, "Lần dừng bị hủy sẽ không còn tính vào thời gian dừng và KPI, nhưng bản ghi và lý do hủy vẫn được giữ để truy xuất."),
    rkh(AmgFieldBox, { label: "Lý do hủy (bắt buộc)" }, rkh("input", { className: "mes-input", value: why, onChange: e => setWhy(e.target.value), placeholder: "VD: bấm tạm dừng nhầm" })),
    error && rkh("div", { style: { color: COLORS.red, fontSize: FZ(13), marginBottom: 8 } }, error),
    rkh("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, rkh(Button, { onClick: onClose }, "Đóng"), rkh(Button, { variant: "danger", disabled: busy || why.trim().length < 3, onClick: save }, busy ? "Đang lưu…" : "Hủy lần dừng")));
}
