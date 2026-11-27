/* ===================== TRUNG TÂM ĐIỀU HÀNH SẢN XUẤT (v56) =====================
   Thay phần "Thẻ máy" của mục Giám sát máy móc (modules/plan/plan.js → MonitorScreen).
   NGUYÊN TẮC
   - Không tạo dữ liệu mới, không ghi Firebase ở file này: mọi số liệu đọc từ machines / productionRuns / orders đang có.
   - Tận dụng nguyên logic sẵn có (domain/flow.js): amgMachineCardState, amgOpenRunOfMachine, amgStageInfo, amgPlanBucket...
   - Mọi thao tác điều hành (phân lệnh, bắt đầu, tạm dừng, tiếp tục, kết thúc, ghi sản lượng) vẫn đi qua openModal / act của PlanPage,
     tức là dùng đúng hộp thoại và hàm nghiệp vụ cũ → phân quyền, kiểm tra và đồng bộ không đổi.
   - Phần 1 (amgCc*) là hàm thuần, kiểm thử được độc lập (docs/kiem-thu/accept56.js). Phần 2 là giao diện. */

/* ---------- PHẦN 1: LOGIC THUẦN ---------- */
const AMG_CC_FILTERS = [
  { key: "all", label: "Tất cả" }, { key: "running", label: "Đang chạy" }, { key: "assigned", label: "Chờ lệnh" },
  { key: "paused", label: "Tạm dừng" }, { key: "idle", label: "Máy trống" }, { key: "broken", label: "Sự cố" }, { key: "maintenance", label: "Bảo trì" }
];
// Thứ tự trạng thái khi sắp xếp theo "Trạng thái"
const AMG_CC_STATE_RANK = { running: 0, assigned: 1, paused: 2, broken: 3, maintenance: 4, idle: 5 };

// Màu/nhãn trạng thái của trung tâm điều hành (đọc COLORS lúc gọi để theo giao diện sáng/tối; mọi màu là hex 6 ký tự)
function amgCcMeta(state) {
  const dark = typeof AMG_THEME !== "undefined" && AMG_THEME === "dark";
  const m = {
    running: { label: "Đang chạy", band: "ĐANG CHẠY", color: COLORS.green },
    assigned: { label: "Chờ sản xuất", band: "ĐÃ PHÂN MÁY · CHỜ CHẠY", color: dark ? "#FACC15" : "#CA8A04" },
    paused: { label: "Tạm dừng", band: "TẠM DỪNG", color: COLORS.orange },
    idle: { label: "Chưa phân lệnh", band: "MÁY TRỐNG", color: COLORS.textFaint },
    broken: { label: "Máy hỏng / sự cố", band: "SỰ CỐ", color: COLORS.red },
    maintenance: { label: "Bảo trì", band: "BẢO TRÌ", color: COLORS.violet }
  };
  return m[state] || m.idle;
}

// Chuẩn hóa chuỗi để tìm kiếm: không phân biệt hoa/thường, có dấu/không dấu
function amgCcNorm(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
}
// Các dạng viết của mã máy: "KTI-01" ≡ "kti01" ≡ "kti1" ≡ "kti-1" ≡ "KTI 1"
function amgCcIdForms(s) {
  const n = amgCcNorm(s), compact = n.replace(/[^a-z0-9]/g, "");
  const forms = [compact];
  let m = n.match(/^([a-z0-9]+)[\s\-_]+0*(\d+)$/);
  if (!m) m = n.match(/^([a-z]+)0*(\d{1,3})$/);
  if (m) forms.push(m[1] + "-" + m[2]);
  return forms;
}
// Hậu tố loại dây đọc thẳng từ quy cách (cùng quy ước với domain/stages.js). Không đọc được → "—", không đoán.
function amgCcProductType(spec) {
  const s = String(spec == null ? "" : spec).trim().toUpperCase();
  if (!s) return "—";
  const stranded = s.indexOf("/") > -1;
  if (/BC$/.test(s) || /\dBC\b/.test(s)) return stranded ? "Dây bện BC" : "Dây đơn BC";
  if (/TC$/.test(s) || /\dTC\b/.test(s)) return stranded ? "Dây bện TC" : "Dây đơn TC";
  return stranded ? "Dây bện" : "Dây đơn";
}

// 10 nhóm máy theo đúng MACHINE_TYPES (kể cả "Máy sang lô" chưa gắn công đoạn). Máy có typeKey lạ không bị mất: gom vào nhóm "Khác".
function amgCcGroups(machines) {
  const list = machines || [];
  const known = {};
  MACHINE_TYPES.forEach(t => { known[t.key] = true; });
  const groups = MACHINE_TYPES.map(t => ({
    key: t.key, type: t, label: t.label, short: t.label.replace(/^Máy\s+/, ""), color: t.color,
    machines: list.filter(m => m.typeKey === t.key).sort((a, b) => amgNaturalCmp(a.id, b.id))
  }));
  const other = list.filter(m => !known[m.typeKey]).sort((a, b) => amgNaturalCmp(a.id, b.id));
  if (other.length) groups.push({ key: "khac", type: null, label: "Máy khác", short: "Khác", color: "#64748B", machines: other });
  return groups;
}
function amgCcGroupKeyOf(machine) {
  return MACHINE_TYPES.some(t => t.key === machine.typeKey) ? machine.typeKey : "khac";
}

// Ảnh chụp một máy: mọi thứ thẻ máy cần hiển thị, tính từ dữ liệu thật
function amgCcMachineView(machine, runs, orders) {
  const state = amgMachineCardState(machine, runs);
  const run = amgOpenRunOfMachine(runs, machine.id);
  const oi = run ? amgRunOrderInfo(run, orders) : null;
  const order = oi && oi.order ? oi.order : null;
  const unit = run ? (run.unit || (order ? amgOrderUnit(order) : "kg")) : "kg";
  const planned = run ? Number(run.plannedQuantity) || 0 : 0;
  const produced = run ? Number(run.producedQuantity) || 0 : 0;
  return {
    machine, state, run, oi, order, unit, planned, produced,
    remain: run ? Math.max(0, Math.round((planned - produced) * 100) / 100) : 0,
    pct: run && planned > 0 ? Math.min(999, produced / planned * 100) : null,
    stageKey: run ? run.stageKey : null,
    customer: oi ? oi.customer : "", spec: oi ? oi.spec : "",
    product: oi ? amgCcProductType(oi.spec) : "—",
    operator: run ? run.operator || "" : "", shift: run ? run.shift || "" : "",
    orderLabel: run ? (order ? amgOrderLabel(order) : (oi && (oi.customer || oi.spec) ? [oi.customer, oi.spec].filter(Boolean).join(" · ") : "Đơn đã xóa")) : "",
    extraRuns: amgOpenRunsOfMachine(runs, machine.id).length - 1
  };
}

/* Tìm kiếm thống nhất: mã máy, tên máy, mã đơn (id nội bộ), khách hàng, quy cách, nguyên liệu, người vận hành.
   Trả: { active, exact (máy khớp đúng mã), machineIds:Set, groupKeys:Set, orders:[đơn khớp] } */
function amgCcSearch(q, machines, runs, orders) {
  const text = amgCcNorm(q);
  const out = { active: false, exact: null, machineIds: new Set(), groupKeys: new Set(), orders: [], tokens: [] };
  if (!text) return out;
  out.active = true;
  const tokens = text.split(" ").filter(Boolean);
  out.tokens = tokens;
  const qForms = amgCcIdForms(q);
  const exact = (machines || []).find(m => amgCcIdForms(m.id).some(f => qForms.indexOf(f) > -1));
  if (exact) {
    out.exact = exact; out.machineIds.add(exact.id); out.groupKeys.add(amgCcGroupKeyOf(exact));
    return out;
  }
  const tokCompact = tokens.map(t => t.replace(/[^a-z0-9]/g, ""));
  const open = (runs || []).filter(amgIsOpenRun); // thẻ máy chỉ phụ thuộc lệnh đang mở → lọc một lần cho nhanh
  (machines || []).forEach(m => {
    const v = amgCcMachineView(m, open, orders);
    const hay = amgCcNorm([m.id, m.typeLabel, m.note, v.customer, v.spec, v.oi && v.oi.materialCode, v.run && v.run.orderId, v.operator, v.run && v.run.team].join(" | "));
    const idc = amgCcNorm(m.id).replace(/[^a-z0-9]/g, "");
    if (tokens.every((t, i) => hay.indexOf(t) > -1 || (tokCompact[i] && idc.indexOf(tokCompact[i]) > -1))) {
      out.machineIds.add(m.id); out.groupKeys.add(amgCcGroupKeyOf(m));
    }
  });
  (orders || []).forEach(o => {
    if (!amgIsActiveOrder(o)) return;
    const hay = amgCcNorm([o.customer, o.spec, o.materialCode, o.id, o.orderCode, o.note].join(" | "));
    if (tokens.every(t => hay.indexOf(t) > -1)) out.orders.push(o);
  });
  return out;
}

/* Hành trình sản xuất của MỘT đơn: đúng quy trình đã xác nhận của đơn (amgOrderRoute) — không tạo/đổi công đoạn.
   Mỗi công đoạn: trạng thái, sản lượng, máy phụ trách, thời gian bắt đầu/kết thúc (nếu có dữ liệu). */
function amgCcJourney(order, runs) {
  const flow = amgIsFlowOrder(order);
  const route = flow ? amgOrderRoute(order) : [];
  const working = flow ? amgWorkingStage(order, runs) : null;
  const wIdx = working ? route.indexOf(working) : -1;
  const ms = v => { const n = amgMs(v); return Number.isNaN(n) ? null : n; };
  const steps = route.map((k, i) => {
    const info = amgStageInfo(order, runs, k);
    const rs = info.runs.filter(r => r.productionStatus !== "cancelled");
    const starts = rs.map(r => ms(r.startedAt)).filter(x => x !== null);
    const ends = rs.filter(r => r.productionStatus === "completed").map(r => ms(r.endedAt)).filter(x => x !== null);
    let state = "pending";
    if (info.complete) state = "done";
    else if (info.state === "running") state = "running";
    else if (info.state === "paused") state = "paused";
    else if (info.state === "assigned") state = "assigned";
    else if (k === working) state = "next";
    const machineMap = {};
    rs.forEach(r => {
      const cur = machineMap[r.machineId];
      const rank = amgIsOpenRun(r) ? 1 : 0;
      if (!cur || rank > cur.rank) machineMap[r.machineId] = { id: r.machineId, rank, status: r.productionStatus, runId: r.id, operator: r.operator || "", shift: r.shift || "", produced: Number(r.producedQuantity) || 0, planned: Number(r.plannedQuantity) || 0 };
    });
    return {
      key: k, label: amgStageLabel(k), color: amgStageColor(k), state, index: i,
      done: info.done, qty: info.qty, remain: info.remain, pct: info.pct, runCount: rs.length,
      machines: Object.keys(machineMap).map(id => machineMap[id]),
      startedAt: starts.length ? new Date(Math.min.apply(null, starts)).toISOString() : null,
      endedAt: info.complete && ends.length ? new Date(Math.max.apply(null, ends)).toISOString() : null,
      isNext: false
    };
  });
  if (wIdx > -1) {
    const target = steps[wIdx].state === "next" ? null : steps[wIdx + 1]; // đang làm dở → công đoạn kế là "tiếp theo"
    if (target && target.state !== "done") target.isNext = true;
  }
  const plan = flow ? amgPlanBucket(order, runs) : { bucket: null };
  return { order, flow, route, working, steps, bucket: plan.bucket, life: amgOrderLifecycle(order, runs), unit: amgOrderUnit(order), label: amgOrderLabel(order) };
}
function amgCcStepMeta(state) {
  const m = {
    done: { label: "Đã hoàn thành", color: COLORS.blue }, running: { label: "Đang thực hiện", color: COLORS.green },
    paused: { label: "Tạm dừng", color: COLORS.orange }, assigned: { label: "Đã phân máy · chờ chạy", color: amgCcMeta("assigned").color },
    next: { label: "Chờ phân máy", color: COLORS.red }, pending: { label: "Chưa tới lượt", color: COLORS.textFaint }
  };
  return m[state] || m.pending;
}

/* Cảnh báo vận hành — CHỈ phát khi dữ liệu thật đáp ứng điều kiện, không suy diễn.
   broken     máy có trạng thái Hỏng/Dừng
   paused     lệnh đang tạm dừng (kèm nguyên nhân + đã dừng bao lâu, nếu có lần dừng đang mở)
   idle       máy có công đoạn, không hỏng/bảo trì, chưa có lệnh mở — gộp theo nhóm máy
   overdue    đơn chưa hoàn thành đã quá ngày giao
   unassigned đơn có công đoạn đang làm nhưng chưa phân máy
   waiting    công đoạn trước đã xong, công đoạn kế chưa phân máy
   short      lệnh đã kết thúc nhưng sản lượng < 99,5% kế hoạch lệnh, công đoạn chưa hoàn thành và không còn lệnh mở nào bù cho công đoạn đó */
const AMG_CC_ALERT_TYPES = [
  { key: "broken", label: "Máy sự cố", sev: "err" }, { key: "overdue", label: "Đơn quá hạn", sev: "err" },
  { key: "paused", label: "Máy tạm dừng", sev: "warn" }, { key: "unassigned", label: "Đơn chưa phân máy", sev: "warn" },
  { key: "waiting", label: "Chờ chuyển công đoạn", sev: "warn" }, { key: "short", label: "Sản lượng thấp hơn kế hoạch", sev: "warn" },
  { key: "idle", label: "Máy chưa có lệnh", sev: "info" }
];
function amgCcAlerts(machines, runs, orders, nowMs) {
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const out = [];
  const open = (runs || []).filter(amgIsOpenRun);
  const typeRank = {}; AMG_CC_ALERT_TYPES.forEach((t, i) => { typeRank[t.key] = i; });
  const add = (type, id, o) => out.push(Object.assign({ type, id: type + ":" + id, sev: AMG_CC_ALERT_TYPES[typeRank[type]].sev }, o));
  (machines || []).forEach(m => {
    const v = amgCcMachineView(m, open, orders);
    if (m.status === "broken") add("broken", m.id, { title: `${m.id} — máy hỏng / sự cố`, detail: [m.note, v.run ? "đang giữ lệnh — cần tạm dừng hoặc kết thúc" : ""].filter(Boolean).join(" · "), machineId: m.id });
    if (v.run && v.run.productionStatus === "paused") {
      const ps = (v.run.pauses || []).filter(p => !p.cancelled && !p.resumedAt).slice(-1)[0];
      const since = ps ? amgMs(ps.at) : NaN;
      add("paused", m.id, { title: `${m.id} — đang tạm dừng`, detail: [ps && ps.reason, Number.isNaN(since) ? "" : "đã dừng " + amgHm(now - since), v.orderLabel].filter(Boolean).join(" · "), machineId: m.id });
    }
  });
  const idleBy = {};
  (machines || []).forEach(m => {
    if (!amgMachineStage(m) || m.status === "broken" || m.status === "maintenance") return;
    if (amgOpenRunOfMachine(open, m.id)) return;
    const gk = amgCcGroupKeyOf(m); (idleBy[gk] = idleBy[gk] || []).push(m.id);
  });
  amgCcGroups(machines).forEach(g => {
    const ids = idleBy[g.key];
    if (ids && ids.length) add("idle", g.key, { title: `${g.short}: ${ids.length} máy chưa có lệnh sản xuất`, detail: ids.slice(0, 6).join(", ") + (ids.length > 6 ? ` … +${ids.length - 6}` : ""), groupKey: g.key, count: ids.length });
  });
  (orders || []).forEach(o => {
    if (!amgIsActiveOrder(o) || !amgIsFlowOrder(o)) return;
    const life = amgOrderLifecycle(o, runs), plan = amgPlanBucket(o, runs), label = amgOrderLabel(o);
    if (life.overdue) add("overdue", o.id, { title: `${label} — quá hạn giao ${Math.abs(life.days)} ngày`, detail: plan.stageKey ? "Công đoạn hiện tại: " + amgStageLabel(plan.stageKey) : "", orderId: o.id });
    if (plan.bucket === "unassigned") add("unassigned", o.id, { title: `${label} — chưa phân máy`, detail: "Công đoạn cần phân máy: " + amgStageLabel(plan.stageKey), orderId: o.id });
    if (plan.bucket === "waiting_next") add("waiting", o.id, { title: `${label} — chờ chuyển sang ${amgStageLabel(plan.stageKey)}`, detail: "Công đoạn trước đã hoàn thành, chưa phân máy cho công đoạn kế", orderId: o.id });
    amgRunsOfOrder(runs, o.id).forEach(r => {
      if (r.productionStatus !== "completed") return;
      const planned = Number(r.plannedQuantity) || 0, produced = Number(r.producedQuantity) || 0;
      if (planned <= 0 || produced >= planned * AMG_STAGE_SHORT_TOL) return;
      if (amgStageComplete(o, r.stageKey)) return;
      if (amgRunsOfOrder(runs, o.id).some(x => x.stageKey === r.stageKey && amgIsOpenRun(x))) return;
      add("short", r.id, { title: `${r.machineId} · ${label} — thấp hơn kế hoạch`, detail: `${amgStageLabel(r.stageKey)}: ${fmtNum(produced)} / ${fmtNum(planned)} ${r.unit || amgOrderUnit(o)}`, machineId: r.machineId, orderId: o.id });
    });
  });
  out.sort((a, b) => ({ err: 0, warn: 1, info: 2 }[a.sev] - { err: 0, warn: 1, info: 2 }[b.sev]) || typeRank[a.type] - typeRank[b.type] || amgNaturalCmp(a.id, b.id));
  return out;
}

// Số liệu thẻ KPI: toàn bộ máy và đơn thật của hệ thống
function amgCcKpis(machines, runs, orders) {
  const c = { total: (machines || []).length, running: 0, assigned: 0, paused: 0, idle: 0, broken: 0, maintenance: 0 };
  const open = (runs || []).filter(amgIsOpenRun);
  (machines || []).forEach(m => { c[amgMachineCardState(m, open)]++; });
  const o = { running: 0, paused: 0, assignedOnly: 0, unassigned: 0, waiting: 0 };
  (orders || []).forEach(x => {
    if (!amgIsActiveOrder(x) || !amgIsFlowOrder(x)) return;
    const b = amgPlanBucket(x, runs).bucket;
    if (b === "running") o.running++; else if (b === "paused") o.paused++; else if (b === "assigned") o.assignedOnly++;
    else if (b === "unassigned") o.unassigned++; else if (b === "waiting_next") o.waiting++;
  });
  return { machines: c, orders: o, ordersWaitingMachine: o.unassigned + o.waiting };
}

// Lọc + sắp xếp danh sách máy (dùng cho cả Lưới và Danh sách)
function amgCcSortViews(views, key, dir) {
  const sgn = dir === "desc" ? -1 : 1;
  const typeIdx = {}; MACHINE_TYPES.forEach((t, i) => { typeIdx[t.key] = i; });
  const byId = (a, b) => ((typeIdx[a.machine.typeKey] ?? 99) - (typeIdx[b.machine.typeKey] ?? 99)) || amgNaturalCmp(a.machine.id, b.machine.id);
  const arr = views.slice();
  if (key === "status") arr.sort((a, b) => sgn * ((AMG_CC_STATE_RANK[a.state] ?? 9) - (AMG_CC_STATE_RANK[b.state] ?? 9)) || byId(a, b));
  else if (key === "order") arr.sort((a, b) => {
    if (!a.run !== !b.run) return a.run ? -1 : 1; // máy không có đơn luôn nằm cuối
    return sgn * amgNaturalCmp(a.orderLabel, b.orderLabel) || byId(a, b);
  });
  else arr.sort((a, b) => sgn * byId(a, b));
  return arr;
}

/* ---------- Ghi nhớ lựa chọn của người dùng (chỉ trên thiết bị, không ghi Firebase) ---------- */
function amgCcPref(key, def) { try { const v = localStorage.getItem("amg_cc_" + key); return v == null ? def : v; } catch (e) { return def; } }
function amgCcSetPref(key, val) { try { localStorage.setItem("amg_cc_" + key, String(val)); } catch (e) { /* bỏ qua: chế độ riêng tư */ } }

/* ---------- PHẦN 2: GIAO DIỆN ---------- */
// Nút thao tác của một máy — CÙNG điều kiện quyền/trạng thái với MachineCard cũ, gọi cùng openModal/act
function amgCcActions(v, can, openModal, act) {
  const m = v.machine, run = v.run, down = m.status === "broken" || m.status === "maintenance";
  const out = [];
  const B = (label, props) => rkh(Button, Object.assign({ key: label, size: "sm" }, props), label);
  if (run && can.output && run.productionStatus === "running" && !down) out.push(B("Ghi sản lượng", { variant: "primary", onClick: () => openModal({ kind: "output", runId: run.id }) }));
  if (run && can.plan && run.productionStatus === "assigned" && !down) out.push(B("Bắt đầu chạy", { variant: "primary", onClick: () => openModal({ kind: "start", runId: run.id }) }));
  if (run && can.plan && run.productionStatus === "running") out.push(B("Tạm dừng", { onClick: () => openModal({ kind: "pause", runId: run.id }) }));
  if (run && can.plan && run.productionStatus === "paused" && !down) out.push(B("Tiếp tục", { onClick: () => act(() => amgFlowResume(run.id), `Đã tiếp tục chạy máy ${m.id}`) }));
  if (run && can.plan) out.push(B("Kết thúc lệnh", { onClick: () => openModal({ kind: "finish", runId: run.id }) }));
  if (!run && can.plan && !down) {
    const hasStage = !!amgMachineStage(m);
    out.push(B("Phân lệnh", { variant: "primary", disabled: !hasStage, title: hasStage ? "" : "Nhóm máy này chưa gắn công đoạn nên chưa phân lệnh được trong hệ thống", onClick: () => openModal({ kind: "assign", machineId: m.id }) }));
  }
  if (run) out.push(B("Chi tiết lệnh", { variant: "ghost", onClick: () => openModal({ kind: "rundetail", runId: run.id }) }));
  out.push(B("Lịch sử", { variant: "ghost", onClick: () => openModal({ kind: "history", machineId: m.id }) }));
  if (can.editMachines) out.push(B("Trạng thái máy", { variant: "ghost", onClick: () => openModal({ kind: "status", machineId: m.id }) }));
  return out;
}

// Dòng cảnh báo ngắn trên thẻ máy (chỉ khi dữ liệu thật có)
function amgCcTileWarn(v, runs) {
  const m = v.machine, run = v.run, w = [];
  if (run && (m.status === "broken" || m.status === "maintenance")) w.push("Máy đang " + (m.status === "broken" ? "hỏng" : "bảo trì") + " nhưng còn giữ lệnh");
  if (run && run.productionStatus === "paused") { const p = (run.pauses || []).filter(x => !x.cancelled).slice(-1)[0]; if (p && p.reason) w.push("Dừng: " + p.reason); }
  if (run && v.oi && !v.oi.found) w.push("Đơn gốc không còn tồn tại");
  if (v.extraRuns > 0) w.push(`Còn ${v.extraRuns} lệnh mở khác trên máy`);
  const life = v.order ? amgOrderLifecycle(v.order, runs) : null;
  if (life && life.overdue) w.push(`Đơn quá hạn ${Math.abs(life.days)} ngày`);
  else if (life && life.dueSoon) w.push(life.days === 0 ? "Đơn giao hôm nay" : `Đơn giao sau ${life.days} ngày`);
  if (run && v.planned > 0 && v.produced > v.planned) w.push("Vượt kế hoạch lệnh");
  if (m.note && (m.status === "broken" || m.status === "maintenance" || !run)) w.push(m.note);
  return w;
}

function CcTile({ v, runs, can, openModal, act, hit, onJourney }) {
  const m = v.machine, meta = amgCcMeta(v.state), run = v.run;
  const live = !!run && (run.productionStatus === "running" || run.productionStatus === "paused");
  const now = amgUseNow(live);
  const tm = run && run.startedAt ? amgRunTiming(run, now, v.order) : null;
  const warns = amgCcTileWarn(v, runs);
  const stageC = run ? amgStageColor(run.stageKey) : COLORS.textFaint;
  const down = v.state === "broken" || v.state === "maintenance";
  return rkh("div", { className: "cc-tile amg-mcard" + (hit ? " cc-hit" : ""), "data-machine": m.id, "data-state": v.state, style: { "--cc-c": meta.color } },
    rkh("div", { className: "cc-tile-band" },
      rkh("div", { style: { minWidth: 0 } }, rkh("div", { className: "cc-tile-id mes-mono" }, m.id), rkh("div", { className: "cc-tile-type", title: m.typeLabel }, m.typeLabel || "")),
      rkh("div", { className: "cc-tile-st" + (v.state === "running" ? " pulse-dot" : "") }, meta.band)),
    rkh("div", { className: "cc-tile-body" },
      !run ? rkh("div", { className: "cc-tile-empty" }, down ? (v.state === "broken" ? "Máy hỏng — không nhận lệnh mới" : "Đang bảo trì — không nhận lệnh mới") : (amgMachineStage(m) ? "Chưa phân lệnh" : "Chưa gắn công đoạn trong hệ thống")) :
        rkh(React.Fragment, null,
          rkh("div", { className: "cc-tile-top" },
            rkh("button", { type: "button", className: "cc-link cc-tile-cust", title: v.orderLabel + " — bấm xem hành trình đơn", onClick: () => v.order && onJourney(v.order.id) }, v.customer || "—"),
            rkh("span", { className: "cc-chip", style: { color: stageC, borderColor: stageC, background: stageC + "1f" } }, amgStageLabel(run.stageKey))),
          rkh("div", { className: "cc-tile-spec mes-mono", title: v.spec }, v.spec || "—", rkh("span", { className: "cc-tile-prod" }, " · " + v.product)),
          rkh("div", { className: "cc-nums" },
            rkh("div", null, rkh("span", { className: "cc-nl" }, "Kế hoạch"), rkh("b", { className: "mes-mono" }, fmtNum(v.planned))),
            rkh("div", null, rkh("span", { className: "cc-nl" }, "Thực tế"), rkh("b", { className: "mes-mono" }, fmtNum(v.produced))),
            rkh("div", null, rkh("span", { className: "cc-nl" }, "Còn lại"), rkh("b", { className: "mes-mono" }, fmtNum(v.remain))),
            rkh("div", null, rkh("span", { className: "cc-nl" }, "Hoàn thành"), rkh("b", { className: "mes-mono" }, v.pct === null ? "—" : Math.round(v.pct) + "%"))),
          rkh("div", { className: "cc-bar", title: `${fmtNum(v.produced)} / ${fmtNum(v.planned)} ${v.unit}` }, rkh("div", { style: { width: Math.min(100, v.pct || 0) + "%", background: v.pct !== null && v.pct >= 100 ? COLORS.green : meta.color } })),
          rkh("div", { className: "cc-tile-meta" },
            rkh("span", { title: "Người vận hành" }, v.operator || "Chưa có người vận hành"), rkh("span", null, v.shift || "—"), rkh("span", { className: "mes-mono" }, v.unit),
            tm && rkh("span", { className: "mes-mono", title: "Thời gian sản xuất thực tế" }, amgClock(tm.netMs)),
            tm && rkh("span", { className: "mes-mono", title: "Năng suất trung bình theo thời gian chạy thực tế" }, "Năng suất " + (tm.ratePerHour === null ? "—" : fmtNum(tm.ratePerHour) + " " + v.unit + "/giờ")))),
      warns.length > 0 && rkh("div", { className: "cc-warn", title: warns.join("\n") }, "⚠ " + warns[0] + (warns.length > 1 ? ` (+${warns.length - 1})` : ""))),
    rkh("div", { className: "cc-acts mes-no-print" }, amgCcActions(v, can, openModal, act)));
}

function CcRow({ v, runs, can, openModal, act, hit, onJourney }) {
  const m = v.machine, meta = amgCcMeta(v.state), run = v.run;
  const warns = amgCcTileWarn(v, runs);
  const acts = amgCcActions(v, can, openModal, act);
  const stageC = run ? amgStageColor(run.stageKey) : COLORS.textFaint;
  const num = (x, strong) => rkh("div", { className: "cc-r-num mes-mono", style: strong ? { fontWeight: 800 } : null }, run ? x : "—");
  return rkh("div", { className: "cc-row" + (hit ? " cc-hit" : ""), "data-machine": m.id, "data-state": v.state, style: { "--cc-c": meta.color } },
    rkh("div", { className: "cc-r-id" }, rkh("b", { className: "mes-mono" }, m.id), rkh("div", { className: "cc-r-sub" }, m.typeLabel)),
    rkh("div", null, rkh("span", { className: "amg-pill", style: { background: meta.color + "1f", color: meta.color } }, meta.label)),
    rkh("div", { className: "cc-r-order" }, run ? rkh(React.Fragment, null,
      rkh("button", { type: "button", className: "cc-link", title: v.orderLabel, onClick: () => v.order && onJourney(v.order.id) }, v.customer || "—"),
      rkh("div", { className: "cc-r-sub mes-mono", title: v.spec }, (v.spec || "—") + " · " + v.product),
      warns.length > 0 && rkh("div", { className: "cc-r-warn", title: warns.join("\n") }, "⚠ " + warns[0])) : rkh("span", { className: "cc-r-sub" }, warns[0] || (v.state === "idle" ? "Chưa phân lệnh" : meta.label))),
    rkh("div", null, run ? rkh("span", { className: "cc-chip", style: { color: stageC, borderColor: stageC, background: stageC + "1f" } }, amgStageLabel(run.stageKey)) : "—"),
    num(fmtNum(v.planned)), num(fmtNum(v.produced), true), num(fmtNum(v.remain)),
    rkh("div", { className: "cc-r-prog" }, run ? rkh(React.Fragment, null, rkh("div", { className: "cc-bar" }, rkh("div", { style: { width: Math.min(100, v.pct || 0) + "%", background: v.pct !== null && v.pct >= 100 ? COLORS.green : meta.color } })), rkh("span", { className: "mes-mono" }, v.pct === null ? "—" : Math.round(v.pct) + "%")) : "—"),
    rkh("div", { className: "cc-r-who" }, run ? rkh(React.Fragment, null, v.operator || "—", rkh("div", { className: "cc-r-sub" }, v.shift || "—")) : "—"),
    rkh("div", { className: "cc-r-acts mes-no-print" }, acts));
}

// Một đơn hàng tìm thấy / đang sản xuất: máy đang phụ trách + nút mở hành trình
function CcOrderCard({ order, runs, onMachine, onJourney, openModal }) {
  const j = useMemo(() => amgCcJourney(order, runs), [order, runs]);
  const bm = j.bucket ? amgBucketMeta(j.bucket) : { label: "Chưa xác nhận quy trình", color: COLORS.amber };
  const cur = j.steps.find(s => s.key === j.working) || null;
  const chips = [];
  j.steps.forEach(s => s.machines.filter(x => x.rank === 1).forEach(x => chips.push({ s, x })));
  return rkh("div", { className: "cc-ocard", style: { borderLeftColor: bm.color } },
    rkh("div", { className: "cc-ocard-h" },
      rkh("div", { style: { minWidth: 0 } }, rkh("div", { className: "cc-ocard-t", title: j.label }, order.customer || "—"), rkh("div", { className: "cc-r-sub mes-mono" }, (order.spec || "—") + " · " + amgCcProductType(order.spec))),
      rkh("span", { className: "amg-pill", style: { background: bm.color + "1f", color: bm.color } }, bm.label)),
    rkh("div", { className: "cc-ocard-g" },
      rkh("div", null, rkh("span", { className: "cc-nl" }, "Công đoạn hiện tại"), rkh("b", null, cur ? cur.label : (j.flow ? "Đủ công đoạn" : "—"))),
      rkh("div", null, rkh("span", { className: "cc-nl" }, "Sản lượng công đoạn"), rkh("b", { className: "mes-mono" }, cur ? `${fmtNum(cur.done)} / ${fmtNum(cur.qty)} ${j.unit}` : "—")),
      rkh("div", null, rkh("span", { className: "cc-nl" }, "Còn lại"), rkh("b", { className: "mes-mono" }, cur && cur.remain !== null ? fmtNum(Math.max(0, cur.remain)) + " " + j.unit : "—")),
      rkh("div", null, rkh("span", { className: "cc-nl" }, "Ngày giao"), rkh("b", { className: "mes-mono", style: { color: j.life.overdue ? COLORS.red : undefined } }, order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—", j.life.overdue ? " · quá hạn" : ""))),
    cur && cur.pct !== null && rkh("div", { className: "cc-bar", style: { margin: "2px 0 6px" } }, rkh("div", { style: { width: Math.min(100, cur.pct) + "%", background: bm.color } })),
    rkh("div", { className: "cc-ocard-m" }, chips.length ? chips.map(({ s, x }) => {
      const c = amgCcMeta(x.status === "running" ? "running" : x.status === "paused" ? "paused" : "assigned").color;
      return rkh("button", { key: s.key + x.id, type: "button", className: "cc-mchip mes-mono", title: `${s.label} · ${amgRunStatusMeta(x.status).label} · ${x.operator || "—"} · ${fmtNum(x.produced)}/${fmtNum(x.planned)}`, style: { color: c, borderColor: c, background: c + "1a" }, onClick: () => onMachine(x.id) }, x.id, rkh("span", { className: "cc-mchip-s" }, s.label));
    }) : rkh("span", { className: "cc-r-sub" }, j.flow ? "Chưa có máy giữ lệnh" : "Đơn chưa xác nhận quy trình")),
    rkh("div", { className: "cc-ocard-a" }, j.flow && rkh(Button, { size: "sm", variant: "primary", onClick: () => onJourney(order.id) }, "Hành trình sản xuất"), rkh(Button, { size: "sm", variant: "ghost", onClick: () => openModal({ kind: "detail", orderId: order.id }) }, "Kế hoạch đơn")));
}

// Hành trình công đoạn của một đơn
function CcJourneyModal({ orderId, orders, runs, onClose, onMachine, openModal }) {
  const order = (orders || []).find(o => o.id === orderId);
  const j = useMemo(() => order ? amgCcJourney(order, runs) : null, [order, runs]);
  if (!order || !j) return rkh(Modal, { title: "Hành trình sản xuất", onClose, width: 560 }, rkh(EmptyState, { title: "Không tìm thấy đơn hàng", hint: "Đơn có thể đã hoàn thành hoặc đã bị xóa." }));
  return rkh(Modal, { title: "Hành trình · " + j.label, onClose, width: 980 },
    rkh("div", { className: "cc-j-head" },
      rkh("span", null, rkh("span", { className: "cc-nl" }, "Số lượng đặt"), " ", rkh("b", { className: "mes-mono" }, fmtNum(order.quantity) + " " + j.unit)),
      rkh("span", null, rkh("span", { className: "cc-nl" }, "Ngày giao"), " ", rkh("b", { className: "mes-mono", style: { color: j.life.overdue ? COLORS.red : undefined } }, order.deliveryDate ? amgFmtDate(order.deliveryDate) : "—", j.life.overdue ? " · quá hạn" : "")),
      j.bucket && rkh("span", { className: "amg-pill", style: { background: amgBucketMeta(j.bucket).color + "1f", color: amgBucketMeta(j.bucket).color } }, amgBucketMeta(j.bucket).label)),
    !j.flow ? rkh("div", { className: "cc-r-sub", style: { padding: "12px 0" } }, "Đơn chưa xác nhận quy trình nên chưa có hành trình. Hệ thống không tự suy ra công đoạn từ quy cách — Quản đốc/Admin xác nhận quy trình ở tab Đơn hàng.") :
      rkh("div", { className: "cc-journey" }, j.steps.map((s, i) => {
        const sm = amgCcStepMeta(s.state);
        return rkh("div", { key: s.key, className: "cc-step", "data-step": s.key, "data-state": s.state, style: { "--cc-c": sm.color, borderTopColor: s.color } },
          rkh("div", { className: "cc-step-h" }, rkh("b", { style: { color: s.color } }, (i + 1) + ". " + s.label), s.isNext && rkh("span", { className: "cc-chip", style: { color: COLORS.blue, borderColor: COLORS.blue } }, "Tiếp theo")),
          rkh("span", { className: "amg-pill", style: { background: sm.color + "1f", color: sm.color } }, (s.state === "done" ? "✓ " : "") + sm.label),
          rkh("div", { className: "cc-bar", style: { margin: "8px 0 4px" } }, rkh("div", { style: { width: Math.min(100, s.pct || 0) + "%", background: sm.color } })),
          rkh("div", { className: "mes-mono cc-step-q" }, `${fmtNum(s.done)} / ${s.qty === null ? "—" : fmtNum(s.qty)} ${j.unit}`, s.remain !== null && s.state !== "done" ? ` · còn ${fmtNum(Math.max(0, s.remain))}` : ""),
          rkh("div", { className: "cc-step-m" }, s.machines.length ? s.machines.map(x => rkh("button", { key: x.id, type: "button", className: "cc-mchip mes-mono", title: `${amgRunStatusMeta(x.status).label} · ${x.operator || "—"} · ${fmtNum(x.produced)}/${fmtNum(x.planned)}`, style: x.rank ? { color: amgCcMeta(x.status === "running" ? "running" : x.status === "paused" ? "paused" : "assigned").color, borderColor: "currentColor" } : null, onClick: () => { onClose(); onMachine(x.id); } }, x.id)) : rkh("span", { className: "cc-r-sub" }, "Chưa có máy")),
          rkh("div", { className: "cc-r-sub" }, s.startedAt ? "Bắt đầu: " + amgFmtDateTime(s.startedAt) : "Chưa bắt đầu"), s.endedAt && rkh("div", { className: "cc-r-sub" }, "Kết thúc: " + amgFmtDateTime(s.endedAt)));
      })),
    rkh("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 } },
      rkh(Button, { onClick: () => { onClose(); openModal({ kind: "detail", orderId: order.id }); } }, "Mở kế hoạch chi tiết của đơn"), rkh(Button, { variant: "primary", onClick: onClose }, "Đóng")));
}

function CcAlerts({ alerts, onPick }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("all");
  const counts = {}; alerts.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
  const shown = alerts.filter(a => type === "all" || a.type === type);
  const sevColor = s => (s === "err" ? COLORS.red : s === "warn" ? COLORS.orange : COLORS.blue);
  const hasUrgent = alerts.some(a => a.sev === "err");
  return rkh("div", { className: "cc-alerts mes-card", "data-open": open ? "1" : "0", style: { borderLeft: `5px solid ${alerts.length === 0 ? COLORS.green : hasUrgent ? COLORS.red : COLORS.orange}` } },
    rkh("div", { className: "cc-alerts-h" },
      rkh("b", { style: { fontSize: FZ(14) } }, alerts.length === 0 ? "Cảnh báo vận hành — không có cảnh báo" : `Cảnh báo vận hành (${alerts.length})`),
      rkh("div", { className: "cc-alert-chips" }, AMG_CC_ALERT_TYPES.filter(t => counts[t.key]).map(t => rkh("button", { key: t.key, type: "button", "data-alert-type": t.key, className: "cc-achip" + (type === t.key && open ? " cc-achip--on" : ""), style: { "--cc-c": sevColor(t.sev) }, onClick: () => { if (open && type === t.key) setOpen(false); else { setType(t.key); setOpen(true); } } }, t.label, rkh("b", { className: "mes-mono" }, counts[t.key])))),
      alerts.length > 0 && rkh(Button, { size: "sm", variant: "ghost", onClick: () => { setType("all"); setOpen(o => !o); } }, open ? "Thu gọn" : "Xem tất cả")),
    open && rkh("div", { className: "cc-alert-list" }, shown.slice(0, 80).map(a => rkh("button", { key: a.id, type: "button", className: "cc-alert", "data-alert": a.id, style: { "--cc-c": sevColor(a.sev) }, onClick: () => onPick(a) },
      rkh("span", { className: "cc-alert-dot" }), rkh("span", { className: "cc-alert-t" }, a.title), a.detail && rkh("span", { className: "cc-alert-d" }, a.detail))),
      shown.length > 80 && rkh("div", { className: "cc-r-sub", style: { padding: 6 } }, `… và ${shown.length - 80} cảnh báo khác — lọc theo loại để xem.`)));
}

function CommandCenter({ machines, runs, orders, can, openModal, act, initialQ, focusMachineId, onTv }) {
  const groups = useMemo(() => amgCcGroups(machines), [machines]);
  const firstActive = () => { const open = (runs || []).filter(amgIsOpenRun); const g = groups.find(x => x.machines.some(m => amgOpenRunOfMachine(open, m.id))); return (g || groups[0] || { key: "all" }).key; };
  const [group, setGroupRaw] = useState(() => { const s = amgCcPref("group", ""); return s === "all" || groups.some(g => g.key === s) ? s : firstActive(); });
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState(initialQ || "");
  const [view, setViewRaw] = useState(() => (amgCcPref("view", "grid") === "list" ? "list" : "grid"));
  const [sortKey, setSortKey] = useState(() => { const s = amgCcPref("sort", "id"); return ["id", "status", "order"].indexOf(s) > -1 ? s : "id"; });
  const [sortDir, setSortDir] = useState("asc");
  const [focusId, setFocusId] = useState(focusMachineId || null);
  const [panel, setPanel] = useState(null); // { title, orders } khi bấm thẻ KPI đơn hàng
  const [journey, setJourney] = useState(null);
  const [boxRef, boxW] = useBoxWidth();
  const navRef = useRef(null);
  const setGroup = g => { setGroupRaw(g); amgCcSetPref("group", g); };
  const setView = v => { setViewRaw(v); amgCcSetPref("view", v); };
  const setSort = k => { amgCcSetPref("sort", k); if (k === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };

  const kpi = useMemo(() => amgCcKpis(machines, runs, orders), [machines, runs, orders]);
  const alerts = useMemo(() => amgCcAlerts(machines, runs, orders), [machines, runs, orders]);
  const search = useMemo(() => amgCcSearch(q, machines, runs, orders), [q, machines, runs, orders]);
  const views = useMemo(() => {
    const open = (runs || []).filter(amgIsOpenRun), m = {};
    (machines || []).forEach(x => { m[x.id] = amgCcMachineView(x, open, orders); });
    return m;
  }, [machines, runs, orders]);

  // Tìm mã máy → tự chuyển đúng nhóm + nổi bật; kết quả nằm trong một nhóm → chuyển nhóm đó; nằm nhiều nhóm → xem tất cả
  useEffect(() => {
    if (!search.active) return;
    if (search.exact) { setGroup(amgCcGroupKeyOf(search.exact)); setStatus("all"); setFocusId(search.exact.id); return; }
    if (search.groupKeys.size === 1) setGroup([...search.groupKeys][0]);
    else if (search.groupKeys.size > 1) setGroup("all");
  }, [q]); // eslint-disable-line
  // Nổi bật rồi tự tắt sau 8 giây; cuộn tới máy được chọn
  useEffect(() => {
    if (!focusId) return undefined;
    const t1 = setTimeout(() => {
      const els = document.querySelectorAll("[data-machine]");
      for (let i = 0; i < els.length; i++) if (els[i].getAttribute("data-machine") === focusId) { if (els[i].scrollIntoView) els[i].scrollIntoView({ block: "center", behavior: "smooth" }); break; }
    }, 60);
    const t2 = setTimeout(() => setFocusId(null), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focusId, group]);
  // Thanh nhóm tự cuộn để nhóm đang chọn nằm giữa (điện thoại)
  useEffect(() => {
    const c = navRef.current; if (!c) return;
    const b = c.querySelector('[aria-selected="true"]'); if (b) c.scrollLeft = Math.max(0, b.offsetLeft - (c.clientWidth - b.offsetWidth) / 2);
  }, [group]);

  const goMachine = id => {
    const m = (machines || []).find(x => x.id === id); if (!m) return;
    setQ(""); setStatus("all"); setPanel(null); setGroup(amgCcGroupKeyOf(m)); setFocusId(id);
  };
  const pickAlert = a => {
    if (a.type === "idle") { setQ(""); setPanel(null); setGroup(a.groupKey); setStatus("idle"); return; }
    if (a.machineId && (a.type === "broken" || a.type === "paused" || a.type === "short")) { if (a.type === "short" && a.orderId) { setJourney(a.orderId); return; } goMachine(a.machineId); return; }
    if (a.orderId) setJourney(a.orderId);
  };
  const openOrdersPanel = which => {
    const list = (orders || []).filter(o => amgIsActiveOrder(o) && amgIsFlowOrder(o)).filter(o => { const b = amgPlanBucket(o, runs).bucket; return which === "running" ? b === "running" : b === "unassigned" || b === "waiting_next"; });
    setQ(""); setPanel({ which, title: which === "running" ? "Đơn hàng đang sản xuất" : "Đơn hàng chờ phân máy", orders: list });
  };

  const scopeMachines = group === "all" ? (machines || []) : (groups.find(g => g.key === group) || { machines: [] }).machines;
  const searched = scopeMachines.filter(m => !search.active || search.machineIds.has(m.id));
  const counts = { all: searched.length, running: 0, assigned: 0, paused: 0, idle: 0, broken: 0, maintenance: 0 };
  searched.forEach(m => { counts[views[m.id].state]++; });
  const visible = amgCcSortViews(searched.filter(m => status === "all" || views[m.id].state === status).map(m => views[m.id]), sortKey, sortDir);
  const wide = !boxW || boxW >= 1000;
  const useRows = view === "list" && wide;
  const renderItem = v => rkh(useRows ? CcRow : CcTile, { key: v.machine.id, v, runs, can, openModal, act, hit: focusId === v.machine.id, onJourney: setJourney });
  const sections = group === "all" && sortKey === "id" ? groups.map(g => ({ g, items: visible.filter(v => amgCcGroupKeyOf(v.machine) === g.key) })).filter(s => s.items.length) : null;
  const curGroup = groups.find(g => g.key === group);
  const sortBtn = (k, l) => rkh("button", { key: k, type: "button", className: "cc-sort" + (sortKey === k ? " cc-sort--on" : ""), "data-sort": k, onClick: () => setSort(k) }, l, sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const kpiTile = (label, value, color, onClick, sub, active, id) => rkh("button", { key: id, type: "button", "data-kpi": id, className: "cc-kpi" + (active ? " cc-kpi--on" : ""), style: { "--cc-c": color }, onClick },
    rkh("span", { className: "cc-kpi-l" }, label), rkh("span", { className: "cc-kpi-v mes-mono" }, value), sub && rkh("span", { className: "cc-kpi-s" }, sub));
  const selectStatus = k => { setStatus(k); if (k !== "all") { setPanel(null); } };
  const kpiMachine = (k) => { setQ(""); setPanel(null); setGroup("all"); setStatus(k); };
  const mc = kpi.machines;

  return rkh("div", { ref: boxRef, className: "cc-root", "data-cc": "1" },
    rkh("div", { className: "cc-kpis" },
      kpiTile("Tổng số máy", mc.total, COLORS.blue, () => kpiMachine("all"), `${mc.idle} máy chưa phân lệnh`, group === "all" && status === "all" && !panel, "total"),
      kpiTile("Máy đang chạy", mc.running, amgCcMeta("running").color, () => kpiMachine("running"), null, status === "running" && group === "all", "running"),
      kpiTile("Máy đang chờ", mc.assigned, amgCcMeta("assigned").color, () => kpiMachine("assigned"), "đã phân, chưa chạy", status === "assigned" && group === "all", "assigned"),
      kpiTile("Máy tạm dừng", mc.paused, amgCcMeta("paused").color, () => kpiMachine("paused"), null, status === "paused" && group === "all", "paused"),
      kpiTile("Máy hỏng / bảo trì", mc.broken + mc.maintenance, amgCcMeta("broken").color, () => kpiMachine(mc.broken ? "broken" : "maintenance"), `${mc.broken} hỏng · ${mc.maintenance} bảo trì`, (status === "broken" || status === "maintenance") && group === "all", "down"),
      kpiTile("Đơn đang sản xuất", kpi.orders.running, COLORS.green, () => openOrdersPanel("running"), kpi.orders.paused ? `${kpi.orders.paused} đơn tạm dừng` : null, !!panel && panel.which === "running", "orders-running"),
      kpiTile("Đơn chờ phân máy", kpi.ordersWaitingMachine, COLORS.red, () => openOrdersPanel("waiting"), kpi.orders.waiting ? `${kpi.orders.waiting} chờ chuyển công đoạn` : null, !!panel && panel.which === "waiting", "orders-waiting")),

    rkh(CcAlerts, { alerts, onPick: pickAlert }),

    rkh("div", { className: "cc-sticky" },
      rkh("div", { className: "cc-nav", role: "tablist", "aria-label": "Nhóm máy theo công đoạn", ref: navRef },
        rkh("button", { type: "button", role: "tab", "aria-selected": group === "all", "data-group": "all", className: "cc-gbtn" + (group === "all" ? " cc-gbtn--on" : ""), style: { "--cc-c": COLORS.navy }, onClick: () => { setGroup("all"); setQ(""); } }, rkh("span", { className: "cc-gname" }, "Tất cả máy"), rkh("span", { className: "cc-gcount mes-mono" }, (machines || []).length)),
        groups.map(g => {
          const running = g.machines.filter(m => views[m.id] && views[m.id].state === "running").length;
          const hits = search.active ? g.machines.filter(m => search.machineIds.has(m.id)).length : null;
          return rkh("button", { key: g.key, type: "button", role: "tab", "aria-selected": group === g.key, "data-group": g.key, className: "cc-gbtn" + (group === g.key ? " cc-gbtn--on" : ""), style: { "--cc-c": g.color }, title: `${g.label}: ${g.machines.length} máy, ${running} đang chạy`, onClick: () => setGroup(g.key) },
            rkh("span", { className: "cc-gname" }, g.short),
            rkh("span", { className: "cc-gcount mes-mono" }, hits !== null ? `${hits}/${g.machines.length}` : g.machines.length),
            running > 0 && rkh("span", { className: "cc-grun mes-mono", title: "Đang chạy" }, running));
        })),
      rkh("div", { className: "cc-tools" },
        rkh("div", { className: "cc-search" }, rkh(Search, { size: 15 }),
          rkh("input", { className: "mes-input", type: "search", "data-cc-search": "1", "aria-label": "Tìm máy hoặc đơn hàng", placeholder: "Tìm mã máy, tên máy, đơn hàng, khách hàng, quy cách...", value: q, onChange: e => { setQ(e.target.value); setPanel(null); } }),
          q && rkh("button", { type: "button", className: "cc-search-x", "aria-label": "Xóa tìm kiếm", onClick: () => setQ("") }, "×")),
        rkh("div", { className: "cc-seg", role: "group", "aria-label": "Chế độ hiển thị" },
          rkh("button", { type: "button", "data-view": "grid", "aria-pressed": view === "grid", className: view === "grid" ? "on" : "", onClick: () => setView("grid") }, "Lưới"),
          rkh("button", { type: "button", "data-view": "list", "aria-pressed": view === "list", className: view === "list" ? "on" : "", onClick: () => setView("list") }, "Danh sách")),
        rkh("div", { className: "cc-sorts" }, rkh("span", { className: "cc-nl" }, "Sắp xếp"), sortBtn("id", "Mã máy"), sortBtn("status", "Trạng thái"), sortBtn("order", "Đơn hàng")),
        onTv && rkh(Button, { variant: "primary", onClick: () => onTv(curGroup ? curGroup.key : "all") }, "Màn hình TV")),
      rkh("div", { className: "cc-filters", role: "group", "aria-label": "Lọc theo trạng thái" }, AMG_CC_FILTERS.map(f => {
        const col = f.key === "all" ? COLORS.blue : amgCcMeta(f.key).color;
        return rkh("button", { key: f.key, type: "button", "data-filter": f.key, "aria-pressed": status === f.key, className: "cc-fbtn" + (status === f.key ? " cc-fbtn--on" : ""), style: { "--cc-c": col }, onClick: () => selectStatus(f.key) }, f.label, rkh("b", { className: "mes-mono" }, counts[f.key]));
      }))),

    search.active && search.exact && rkh("div", { className: "cc-banner", "data-banner": "exact" }, `Máy ${search.exact.id} thuộc ${(groups.find(g => g.key === amgCcGroupKeyOf(search.exact)) || {}).label || "—"} — đã mở đúng nhóm và đánh dấu máy.`),
    search.active && !search.exact && search.orders.length > 0 && rkh("div", { className: "cc-orders", "data-orders": "search" },
      rkh("div", { className: "cc-sec-h" }, `Đơn hàng khớp “${q.trim()}” (${search.orders.length})`),
      rkh("div", { className: "cc-ocards" }, search.orders.slice(0, 8).map(o => rkh(CcOrderCard, { key: o.id, order: o, runs, onMachine: goMachine, onJourney: setJourney, openModal }))),
      search.orders.length > 8 && rkh("div", { className: "cc-r-sub" }, `Hiển thị 8/${search.orders.length} đơn — gõ thêm khách hàng hoặc quy cách để thu hẹp.`)),
    panel && rkh("div", { className: "cc-orders", "data-orders": panel.which },
      rkh("div", { className: "cc-sec-h", style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } }, `${panel.title} (${panel.orders.length})`, rkh(Button, { size: "sm", variant: "ghost", onClick: () => setPanel(null) }, "Đóng")),
      panel.orders.length === 0 ? rkh("div", { className: "cc-r-sub", style: { padding: 8 } }, "Hiện không có đơn nào.") : rkh("div", { className: "cc-ocards" }, panel.orders.slice(0, 24).map(o => rkh(CcOrderCard, { key: o.id, order: o, runs, onMachine: goMachine, onJourney: setJourney, openModal }))),
      panel.orders.length > 24 && rkh("div", { className: "cc-r-sub" }, `Hiển thị 24/${panel.orders.length} đơn.`)),

    (machines || []).length === 0 ? rkh(EmptyState, { title: "Chưa có máy trong danh mục", hint: "Vào mục Danh mục máy & trạng thái để khôi phục/thêm máy." }) :
      visible.length === 0 ? rkh(EmptyState, { title: search.active && !search.orders.length ? "Không tìm thấy máy hoặc đơn hàng phù hợp" : "Không có máy phù hợp bộ lọc", hint: "Thử xóa bộ lọc trạng thái hoặc chọn “Tất cả máy”.", action: rkh(Button, { size: "sm", onClick: () => { setStatus("all"); setQ(""); setGroup("all"); } }, "Xem tất cả máy") }) :
        rkh("div", { className: "cc-list", "data-count": visible.length, "data-view": useRows ? "list" : "grid" },
          useRows && rkh("div", { className: "cc-row cc-row--h" }, ["Mã máy", "Trạng thái", "Đơn hàng", "Công đoạn", "Kế hoạch", "Thực tế", "Còn lại", "Hoàn thành", "Vận hành · ca", "Thao tác"].map((h, i) => {
            const k = i === 0 ? "id" : i === 1 ? "status" : i === 2 ? "order" : null;
            return k ? rkh("button", { key: h, type: "button", className: "cc-sort cc-sort--h" + (sortKey === k ? " cc-sort--on" : ""), onClick: () => setSort(k) }, h, sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "") : rkh("div", { key: h, className: i >= 4 && i <= 6 ? "cc-r-numh" : "" }, h);
          })),
          sections ? sections.map(s => rkh("div", { key: s.g.key, className: "cc-section", "data-section": s.g.key },
            rkh("div", { className: "cc-sec-h", style: { borderBottomColor: s.g.color, color: s.g.color } }, s.g.label, rkh("span", { className: "cc-r-sub" }, ` ${s.items.length} máy`)),
            rkh("div", { className: useRows ? "cc-rows" : "cc-grid" }, s.items.map(renderItem)))) :
            rkh("div", { className: useRows ? "cc-rows" : "cc-grid" }, visible.map(renderItem))),

    journey && rkh(CcJourneyModal, { orderId: journey, orders, runs, onClose: () => setJourney(null), onMachine: goMachine, openModal }));
}
