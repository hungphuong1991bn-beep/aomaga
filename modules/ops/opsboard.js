/* ===================== ĐIỀU HÀNH SẢN XUẤT — BẢNG ĐIỀU KHIỂN MES (v52) =====================
   Dữ liệu 100% từ Firebase thật (đơn, lệnh máy, sản lượng, máy, chất lượng) qua amgComputeOpsLive. Không số mẫu.
   Đồng hồ từng máy tính từ mốc thời gian đã lưu (amgUseNow dùng chung MỘT bộ đếm 1 giây) — không ghi Firebase.
   Thao tác nhanh chỉ điều hướng tới đúng phân hệ với đúng đối tượng; quyền được kiểm tra lại ở tầng nghiệp vụ. */
const AMG_OPS_STATE_FILTERS = [
  { key: "all", label: "Tất cả" }, { key: "running", label: "Đang chạy" }, { key: "paused", label: "Tạm dừng" }, { key: "broken", label: "Sự cố / dừng" },
  { key: "assigned", label: "Đã phân lệnh" }, { key: "maintenance", label: "Bảo trì" }, { key: "idle", label: "Chưa phân công" }
];
function amgOpsFmtU(map) { const k = Object.keys(map || {}).filter(u => map[u] > 0); return k.length ? k.map(u => `${fmtNum(map[u])} ${u}`).join(" · ") : "0"; }
function OpsLiveBoard({ orders, machines, runs, entries, extra, currentUser, onNav, tv, onTv, onExit }) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 30000); return () => clearInterval(t); }, []);
  const L = useMemo(() => amgComputeOpsLive({ orders, machines, runs, entries, extra, now: tick }), [orders, machines, runs, entries, extra, tick]);
  const [fState, setFState] = useState("all"), [fStage, setFStage] = useState("all"), [q, setQ] = useState("");
  const [modal, setModal] = useState(null), [toast, setToast] = useState(null), busy = React.useRef({});
  const { showAlert } = useDialog();
  const can = { plan: amgFlowCan(currentUser, "plan"), output: amgFlowCan(currentUser, "output"), manager: amgFlowCan(currentUser, "manager") };
  useEffect(() => { if (!tv) return undefined; const k = e => { if (e.key === "Escape" && onExit) onExit(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [tv]); // eslint-disable-line
  const go = (tab, focus) => { if (onNav) onNav(tab, focus); };
  const K = L.kpi, big = tv ? 1.3 : 1;
  const sq = amgSearchNorm(q);
  const cards = L.cards.filter(c => (fState === "all" || c.state === fState) && (fStage === "all" || c.stageKey === fStage) &&
    (!sq || amgSearchNorm([c.id, c.name, c.run && c.run.orderId, c.order && c.order.customer, c.order && c.order.spec, c.run && c.run.operator].join(" ")).indexOf(sq) > -1) &&
    (!tv || c.state !== "idle"));
  const stCount = s => (s === "all" ? L.cards.length : L.cards.filter(c => c.state === s).length);
  const rateTxt = Object.keys(L.rate).filter(u => L.rate[u] !== null).map(u => `${L.rate[u]}% (${u})`).join(" · ") || "—";
  async function completeNow(order) {
    if (busy.current[order.id]) return; busy.current[order.id] = true;
    try {
      const r = await amgCompleteOrderOneStep(order, runs, { source: "dieuhanh" });
      if (r.status === "blocked") { await showAlert(r.blockers.join("\n"), { title: "Chưa hoàn thành được đơn " + order.id }); return; }
      if (r.status === "need_reason") { setModal({ kind: "complete", orderId: order.id }); return; }
      setToast({ msg: r.status === "duplicate" ? `Đơn ${order.id} đã được hoàn thành trước đó` : `Đơn ${order.id} đã hoàn thành và chuyển sang Đơn hàng hoàn thành`, id: order.id });
      setTimeout(() => setToast(null), 12000);
    } catch (e) { await showAlert(e.message || String(e), { title: "Không hoàn thành được đơn" }); }
    finally { delete busy.current[order.id]; }
  }
  const tile = (label, value, color, sub, onClick, active) => amgKpiTile(label, value, color, active, onClick, sub);
  const kpis = rkh("div", { className: "amg-kpis", style: { display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(${tv ? 210 : 165}px,1fr))`, gap: 10, marginBottom: 14 } },
    tile("Đơn đang sản xuất", K.ordersInProduction, COLORS.blue),
    tile("Lệnh máy đang mở", K.openRuns, COLORS.blue, `${K.runsRunning} chạy · ${K.runsPaused} dừng · ${K.runsAssigned} chờ chạy`),
    tile("Máy hoạt động", K.machinesRunning, COLORS.green, `trên ${K.machines} máy`, () => setFState("running"), fState === "running"),
    tile("Máy tạm dừng", K.machinesPaused, COLORS.amber, "", () => setFState("paused"), fState === "paused"),
    tile("Máy dừng / sự cố", K.machinesStopped, K.machinesStopped ? COLORS.red : COLORS.textFaint, "", () => setFState("broken"), fState === "broken"),
    tile("Máy bảo trì", K.machinesMaintenance, K.machinesMaintenance ? COLORS.violet : COLORS.textFaint, "", () => setFState("maintenance"), fState === "maintenance"),
    tile("Sản lượng trong ngày", amgOpsFmtU(L.outputToday), COLORS.green, "tổng các lượt ghi hôm nay"),
    tile("SL kế hoạch", amgOpsFmtU(L.planned), COLORS.textDim, "lệnh đang mở + kết thúc hôm nay"),
    tile("SL thực tế", amgOpsFmtU(L.actual), COLORS.blue, "cộng dồn các lệnh đó"),
    tile("Hoàn thành kế hoạch", rateTxt, COLORS.copper),
    tile("Đơn sắp đến hạn", K.dueSoon, K.dueSoon ? COLORS.amber : COLORS.textFaint),
    tile("Đơn quá hạn", K.overdue, K.overdue ? COLORS.red : COLORS.textFaint));
  const chip = (f) => rkh("button", { key: f.key, type: "button", className: "mes-chip" + (fState === f.key ? " is-on" : ""), "aria-pressed": fState === f.key, onClick: () => setFState(f.key), style: { padding: "6px 12px", borderRadius: 999, border: `1px solid ${fState === f.key ? COLORS.copper : COLORS.border}`, background: fState === f.key ? COLORS.copper + "18" : COLORS.bgPanel, color: fState === f.key ? COLORS.copper : COLORS.textDim, fontWeight: 700, fontSize: FZ(12.5), cursor: "pointer" } }, `${f.label} (${stCount(f.key)})`);
  const quick = c => !tv && rkh("div", { className: "mes-no-print amg-ops-quick", style: { display: "flex", gap: 6, flexWrap: "wrap", padding: "0 14px 12px", marginTop: -6 } },
    c.run && c.order && can.plan && rkh(Button, { size: "sm", variant: "ghost", onClick: () => go("machines", { screen: "plan", q: c.run.orderId }) }, "Mở kế hoạch"),
    !c.run && can.plan && c.state !== "broken" && c.state !== "maintenance" && rkh(Button, { size: "sm", variant: "primary", onClick: () => go("machines", { screen: "monitor", assign: { machineId: c.id } }) }, "Phân máy"),
    c.run && rkh(Button, { size: "sm", variant: "ghost", onClick: () => go("machines", { screen: "monitor", q: c.id }) }, "Xem lệnh đang chạy"),
    c.run && can.output && c.run.productionStatus === "running" && rkh(Button, { size: "sm", variant: "primary", onClick: () => go("machines", { screen: "monitor", output: c.run.id }) }, "Ghi sản lượng"),
    rkh(Button, { size: "sm", variant: "ghost", onClick: () => go("machines", { screen: "monitor", history: c.id }) }, "Lịch sử máy"),
    c.order && rkh(Button, { size: "sm", variant: "ghost", onClick: () => go("orders", { orderId: c.order.id }) }, "Chi tiết đơn"));
  const LVC = { err: COLORS.red, warn: COLORS.amber, info: COLORS.blue };
  const alertsEl = rkh("div", { className: "mes-card", style: { padding: 14, marginBottom: 14 } },
    rkh("div", { style: { fontWeight: 800, fontSize: FZ(14 * big), marginBottom: 8 } }, `Cảnh báo điều hành (${L.alerts.length})`),
    L.alerts.length === 0 && rkh("div", { style: { color: COLORS.textDim, fontSize: FZ(13 * big) } }, "Không có cảnh báo từ dữ liệu hiện có."),
    L.alerts.slice(0, tv ? 8 : 40).map(a => rkh("button", { key: a.id, type: "button", className: "dx-alert", "data-alert": a.kind, onClick: () => { if (tv) return; if (a.tab) go(a.tab); else if (a.machineId) go("machines", { screen: "monitor", q: a.machineId }); else if (a.orderId) go("orders", { orderId: a.orderId }); } },
      rkh("span", { className: "dx-alert-dot", style: { background: LVC[a.level] } }),
      rkh("span", { style: { minWidth: 0 } }, rkh("span", { className: "dx-alert-t", style: { display: "block" } }, a.title), a.detail ? rkh("span", { className: "dx-alert-d", style: { display: "block" } }, a.detail) : null))));
  const th = { textAlign: "left", padding: "8px 10px", fontSize: FZ(12), color: COLORS.textFaint, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", fontSize: FZ(13 * big), borderBottom: `1px solid ${COLORS.border}`, verticalAlign: "middle" };
  const ordersEl = rkh("div", { className: "mes-card", style: { padding: 0, marginBottom: 14, overflow: "hidden" } },
    rkh("div", { style: { padding: "12px 14px", fontWeight: 800, fontSize: FZ(14 * big) } }, `Theo dõi đơn hàng đang sản xuất (${L.orderRows.length})`),
    L.orderRows.length === 0 ? rkh("div", { style: { padding: "0 14px 14px", color: COLORS.textDim } }, "Chưa có đơn nào đang sản xuất.") :
      rkh("div", { style: { overflowX: "auto" } }, rkh("table", { className: "mes-table", style: { width: "100%", borderCollapse: "collapse", minWidth: 860 } },
        rkh("thead", null, rkh("tr", null, ["Mã đơn", "Khách hàng", "Quy cách", "Công đoạn hiện tại", "Máy đang chạy", "Tiến độ", "Hạn giao", "Trạng thái", tv ? null : "Thao tác"].filter(Boolean).map(h => rkh("th", { key: h, style: th }, h)))),
        rkh("tbody", null, L.orderRows.map(r => { const o = r.order, pb = r.plan, bm = amgBucketMeta(pb.bucket), pr = amgPriorityMeta(o.priority);
          return rkh("tr", { key: o.id, "data-order": o.id, onClick: tv ? undefined : () => go("orders", { orderId: o.id }), style: { cursor: tv ? "default" : "pointer" } },
            rkh("td", { style: td, className: "mes-mono" }, rkh("b", null, o.id), o.priority && o.priority !== "normal" ? rkh("span", { style: { marginLeft: 6, fontSize: FZ(11), fontWeight: 800, color: pr.color } }, pr.label) : null),
            rkh("td", { style: td }, o.customer || "—"), rkh("td", { style: td }, String(o.spec == null ? "—" : o.spec)),
            rkh("td", { style: td }, pb.stageKey ? amgStageLabel(pb.stageKey) : "—"),
            rkh("td", { style: td, className: "mes-mono" }, r.machines.join(", ") || "—"),
            rkh("td", { style: Object.assign({ minWidth: 120 }, td) }, rkh("div", { style: { height: 8, borderRadius: 6, background: COLORS.bgInset, overflow: "hidden" } }, rkh("div", { style: { width: Math.min(100, r.progress || 0) + "%", height: "100%", background: COLORS.green } })), rkh("div", { style: { fontSize: FZ(11.5), color: COLORS.textDim, marginTop: 2 } }, r.progress === null ? "—" : r.progress + "%")),
            rkh("td", { style: Object.assign({ color: r.life.overdue ? COLORS.red : r.life.dueSoon ? COLORS.amber : COLORS.text, fontWeight: r.life.overdue || r.life.dueSoon ? 800 : 500 }, td) }, o.deliveryDate ? amgFmtDate(o.deliveryDate) : "—", r.life.overdue ? ` (trễ ${Math.abs(r.life.days)} ngày)` : r.life.dueSoon ? ` (còn ${r.life.days} ngày)` : ""),
            rkh("td", { style: td }, rkh("span", { style: { fontWeight: 800, color: bm.color, fontSize: FZ(12 * big) } }, bm.label)),
            !tv && rkh("td", { style: td, onClick: e => e.stopPropagation() }, rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
              can.plan && pb.stageKey && pb.bucket !== "stage_done" && rkh(Button, { size: "sm", onClick: () => go("machines", { screen: "plan", assign: { orderId: o.id, stageKey: pb.stageKey } }) }, "Phân máy"),
              can.manager && r.ready && rkh(Button, { size: "sm", variant: "primary", onClick: () => completeNow(o) }, "HOÀN THÀNH ĐƠN"),
              rkh(Button, { size: "sm", variant: "ghost", onClick: () => go("orders", { orderId: o.id }) }, "Chi tiết"))));
        })))));
  const machinesEl = rkh("div", { style: { marginBottom: 14 } },
    !tv && rkh("div", { className: "mes-no-print", style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 } },
      AMG_OPS_STATE_FILTERS.map(chip),
      rkh("select", { className: "mes-input", style: { width: "auto", minWidth: 150 }, value: fStage, onChange: e => setFStage(e.target.value), "aria-label": "Lọc theo công đoạn" }, rkh("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => rkh("option", { key: s.key, value: s.key }, s.label))),
      rkh("input", { className: "mes-input", style: { width: 220 }, placeholder: "Tìm máy, đơn, khách, người vận hành…", value: q, onChange: e => setQ(e.target.value) })),
    cards.length === 0 ? rkh("div", { className: "mes-card", style: { padding: 16, color: COLORS.textDim } }, L.cards.length ? "Không có máy khớp bộ lọc." : "Chưa có máy sản xuất nào trong dữ liệu.") :
      rkh("div", { className: "amg-ops-cards", style: { display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${tv ? 420 : 300}px,1fr))`, gap: 12 } },
        cards.map(c => rkh("div", { key: c.id, "data-machine": c.id, "data-state": c.state, style: { display: "flex", flexDirection: "column" } },
          rkh(MachineCard, { machine: c.machine, runs, orders, can: {}, openModal: () => {}, act: () => {}, tv: !!tv }), quick(c)))));
  const body = rkh("div", { style: { fontSize: FZ(13 * big) } },
    rkh("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 } },
      rkh("b", { className: "mes-display", style: { fontSize: FZ(16 * big) } }, "Giám sát nhà máy"), rkh("span", { style: { color: COLORS.textFaint } }, "dữ liệu trực tiếp từ hệ thống · tự cập nhật khi có thay đổi"),
      rkh("span", { style: { marginLeft: "auto", display: "flex", gap: 8 }, className: "mes-no-print" },
        tv ? rkh(Button, { variant: "ghost", onClick: onExit }, "Thoát chế độ TV (Esc)") : rkh(Button, { variant: "ghost", onClick: onTv }, "Chế độ TV"))),
    toast && rkh("div", { className: "mes-card mes-fade-in", role: "status", style: { padding: "10px 14px", marginBottom: 12, borderLeft: `4px solid ${COLORS.green}`, fontWeight: 700 } }, toast.msg, rkh("div", { style: { marginTop: 6 } }, rkh(Button, { size: "sm", onClick: () => go("completed", { orderId: toast.id }) }, "Mở chi tiết đơn đã hoàn thành"))),
    kpis, alertsEl, ordersEl, machinesEl,
    modal && modal.kind === "complete" && (() => { const o = orders.find(x => x.id === modal.orderId); return o ? rkh(CompleteOrderModal, { order: o, runs, onClose: () => setModal(null), onDone: (m, id) => { setModal(null); setToast({ msg: m, id }); setTimeout(() => setToast(null), 12000); } }) : null; })());
  if (tv) return rkh("div", { style: { position: "fixed", inset: 0, zIndex: 200, background: COLORS.bg, padding: 20, overflow: "auto" } }, body);
  return body;
}
