/* ===================== ĐIỀU HÀNH SẢN XUẤT / BẢO TRÌ & HỒ SƠ MÁY (v45) ===================== */

const PLAN_STATUS = {
  ke_hoach: { label: "Kế hoạch", get color() { return COLORS.blue; } },
  dang_chay: { label: "Đang chạy", get color() { return COLORS.amber; } },
  xong: { label: "Hoàn thành", get color() { return COLORS.green; } },
  huy: { label: "Hủy", get color() { return COLORS.textFaint; } }
};
const MT_STATUS = {
  ke_hoach: { label: "Kế hoạch", get color() { return COLORS.blue; } },
  dang_lam: { label: "Đang thực hiện", get color() { return COLORS.amber; } },
  xong: { label: "Hoàn thành", get color() { return COLORS.green; } }
};
const MT_KIND = [{ value: "dinh_ky", label: "Bảo trì định kỳ" }, { value: "sua_chua", label: "Sửa chữa" }, { value: "khan_cap", label: "Sự cố khẩn cấp" }];
const MT_KIND_LABEL = { dinh_ky: "Bảo trì định kỳ", sua_chua: "Sửa chữa", khan_cap: "Sự cố khẩn cấp" };

// Sản lượng thực tế theo ngày/đơn/công đoạn — đọc từ nhật ký nhập liệu có sẵn, không nhập lại
function amgActualOutput(auditLog, date, orderId, stageKey) {
  return (auditLog || []).reduce((s, a) => a.type === "production_entry" && a.date === date && (!orderId || a.targetId === orderId) && (!stageKey || a.stageKey === stageKey) && typeof a.qty === "number" ? s + a.qty : s, 0);
}

/* ---------------- ĐIỀU HÀNH ---------------- */
function OpsPage({ extra, orders, machines, staff, auditLog, currentUser }) {
  const plans = extra.plans || [], hand = extra.handovers || [];
  const [tv, setTv] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const today = amgTodayKey(now);
  const shift = amgCurrentShift(now);
  const ctx = { plans, orders, machines, staff };
  const planLabel = p => `${p.machineId || "—"} · ${p.orderId || "—"}`;

  const planCfg = {
    col: "plans", mod: "dieuhanh", label: "Kế hoạch sản xuất", title: "Kế hoạch ngày / tuần", addLabel: "Lập kế hoạch", exportName: "ke-hoach-san-xuat",
    status: PLAN_STATUS, searchKeys: ["id", "orderId", "machineId", "team", "assignee"], defaultSort: { key: "date", dir: "desc" },
    emptyTitle: "Chưa có kế hoạch", emptyHint: "Lập kế hoạch ngày hoặc tuần; sản lượng thực tế được lấy tự động từ nhật ký nhập liệu.",
    filters: [{ key: "horizon", label: "Loại", options: [{ value: "ngay", label: "Kế hoạch ngày" }, { value: "tuan", label: "Kế hoạch tuần" }] }, { key: "status", label: "Trạng thái", options: Object.keys(PLAN_STATUS).map(k => ({ value: k, label: PLAN_STATUS[k].label })) }],
    defaults: () => ({ horizon: "ngay", date: today, shift: shift.key === "caDem" ? "dem" : "ngay", status: "ke_hoach" }),
    fields: () => [
      { key: "horizon", label: "Loại kế hoạch", type: "select", required: true, options: [{ value: "ngay", label: "Kế hoạch ngày" }, { value: "tuan", label: "Kế hoạch tuần (từ ngày…)" }] },
      { key: "date", label: "Ngày", type: "date", required: true },
      { key: "shift", label: "Ca", type: "select", required: true, options: AMG_SHIFT_OPTS },
      { key: "orderId", label: "Đơn hàng", type: "select", required: true, options: amgOpts(orders, o => o.id, o => `${o.id} – ${o.customer || ""} ${o.spec || ""}`) },
      { key: "stage", label: "Công đoạn", type: "select", required: true, options: STAGES.map(s => ({ value: s.key, label: s.label })) },
      { key: "machineId", label: "Máy được giao", type: "select", required: true, options: amgOpts(machines, m => m.id, m => `${m.id} – ${m.typeLabel || ""}`),
        validate: (v, a, ) => { const m = machines.find(x => x.id === v); return m && m.status === "broken" ? "Máy đang hỏng, không thể giao việc" : ""; } },
      { key: "targetQty", label: "Sản lượng kế hoạch", type: "number", min: 1, step: "any", required: true },
      { key: "team", label: "Tổ", type: "select", options: TEAMS.map(t => ({ value: t, label: t })) },
      { key: "assignee", label: "Người phụ trách", maxLen: 60 },
      { key: "status", label: "Trạng thái", type: "select", required: true, options: Object.keys(PLAN_STATUS).map(k => ({ value: k, label: PLAN_STATUS[k].label })) },
      { key: "note", label: "Ghi chú", type: "textarea", wide: true, maxLen: 300 }
    ],
    columns: [
      { key: "date", label: "Ngày", render: r => amgFmtDate(r.date) + (r.horizon === "tuan" ? " (tuần)" : ""), export: r => amgFmtDate(r.date) },
      { key: "shift", label: "Ca", render: r => AMG_SHIFT_LABEL[r.shift] || "—", export: r => AMG_SHIFT_LABEL[r.shift] || "" },
      { key: "machineId", label: "Máy" }, { key: "orderId", label: "Đơn hàng" },
      { key: "stage", label: "Công đoạn", render: r => (STAGE_MAP[r.stage] || {}).label || r.stage, export: r => (STAGE_MAP[r.stage] || {}).label || r.stage },
      { key: "targetQty", label: "Kế hoạch", align: "right" },
      { key: "actual", label: "Thực tế", align: "right", sortValue: r => amgActualOutput(auditLog, r.date, r.orderId, r.stage), render: r => amgActualOutput(auditLog, r.date, r.orderId, r.stage).toLocaleString("vi-VN"), export: r => amgActualOutput(auditLog, r.date, r.orderId, r.stage) },
      { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: PLAN_STATUS, value: r.status }), export: r => (PLAN_STATUS[r.status] || {}).label }
    ],
    kpis: rows => {
      const t = rows.filter(r => r.date === today && r.status !== "huy");
      const tgt = t.reduce((s, r) => s + (Number(r.targetQty) || 0), 0);
      const act = t.reduce((s, r) => s + amgActualOutput(auditLog, r.date, r.orderId, r.stage), 0);
      return [
        { label: "Việc kế hoạch hôm nay", value: t.length, icon: CalendarIcon },
        { label: "Đạt kế hoạch hôm nay", value: tgt ? Math.round(act / tgt * 100) + "%" : "—", tone: tgt && act >= tgt ? "ok" : tgt ? "warn" : "none", sub: tgt ? `${act.toLocaleString("vi-VN")} / ${tgt.toLocaleString("vi-VN")}` : "Chưa có kế hoạch" },
        { label: "Đang chạy", value: rows.filter(r => r.status === "dang_chay").length, tone: "info" },
        { label: "Việc sắp tới", value: rows.filter(r => r.status === "ke_hoach" && r.date >= today).length }
      ];
    },
    transitions: p => [
      p.status === "ke_hoach" ? { label: "Bắt đầu chạy", to: "dang_chay" } : null,
      p.status === "dang_chay" ? { label: "Hoàn thành", to: "xong" } : null,
      p.status !== "huy" && p.status !== "xong" ? { label: "Hủy kế hoạch", to: "huy" } : null
    ].filter(Boolean)
  };

  const handCfg = {
    col: "handovers", mod: "dieuhanh", label: "Biên bản bàn giao ca", title: "Bàn giao ca", addLabel: "Lập biên bản bàn giao", exportName: "ban-giao-ca",
    status: { cho_nhan: { label: "Chờ nhận ca", color: COLORS.amber }, da_nhan: { label: "Đã nhận ca", color: COLORS.green } },
    searchKeys: ["id", "fromPerson", "toPerson", "issues"], defaultSort: { key: "date", dir: "desc" },
    emptyTitle: "Chưa có biên bản bàn giao ca",
    defaults: (c, u) => ({ date: today, shift: shift.key === "caDem" ? "dem" : "ngay", fromPerson: (u && u.fullName) || "", status: "cho_nhan" }),
    fields: () => [
      { key: "date", label: "Ngày", type: "date", required: true },
      { key: "shift", label: "Ca bàn giao", type: "select", required: true, options: AMG_SHIFT_OPTS },
      { key: "fromPerson", label: "Người giao ca", required: true, maxLen: 60 },
      { key: "toPerson", label: "Người nhận ca", required: true, maxLen: 60 },
      { key: "machineNote", label: "Tình trạng máy", type: "textarea", wide: true, maxLen: 500 },
      { key: "wip", label: "Sản phẩm dở dang", type: "textarea", wide: true, maxLen: 500 },
      { key: "issues", label: "Sự cố / tồn đọng", type: "textarea", wide: true, maxLen: 500 },
      { key: "nextActions", label: "Việc cần làm ca sau", type: "textarea", wide: true, maxLen: 500 }
    ],
    columns: [
      { key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) }, { key: "shift", label: "Ca", render: r => AMG_SHIFT_LABEL[r.shift] || "—", export: r => AMG_SHIFT_LABEL[r.shift] || "" },
      { key: "fromPerson", label: "Giao" }, { key: "toPerson", label: "Nhận" }, { key: "issues", label: "Sự cố / tồn đọng" },
      { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: { cho_nhan: { label: "Chờ nhận ca", color: COLORS.amber }, da_nhan: { label: "Đã nhận ca", color: COLORS.green } }, value: r.status }), export: r => r.status === "da_nhan" ? "Đã nhận ca" : "Chờ nhận ca" }
    ],
    kpis: rows => [{ label: "Biên bản hôm nay", value: rows.filter(r => r.date === today).length }, { label: "Chờ nhận ca", value: rows.filter(r => r.status === "cho_nhan").length, tone: rows.some(r => r.status === "cho_nhan") ? "warn" : "none" }],
    transitions: h => h.status === "cho_nhan" ? [{ label: "Xác nhận đã nhận ca", to: "da_nhan", stamp: u => ({ receivedBy: (u && u.fullName) || "", receivedAt: new Date().toISOString() }) }] : []
  };

  // ---- Màn hình theo dõi trực tiếp (dùng chung cho chế độ quản lý và chế độ TV) ----
  const live = () => {
    const todayPlans = plans.filter(p => p.date === today && p.status !== "huy");
    const byStatus = {}; machines.forEach(m => { byStatus[m.status || "unknown"] = (byStatus[m.status || "unknown"] || 0) + 1; });
    const stageToday = STAGES.map(s => ({ s, qty: amgActualOutput(auditLog, today, null, s.key) })).filter(x => x.qty > 0);
    const next = plans.filter(p => p.status === "ke_hoach" && (p.date > today || (p.date === today))).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 6);
    const logs = (auditLog || []).filter(a => a.type !== "permission_denied").slice(0, tv ? 8 : 12);
    const big = tv ? 1.35 : 1;
    const card = { background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 };
    const h = t => rkh("div", { style: { fontWeight: 700, fontSize: 13 * big, marginBottom: 8, color: COLORS.text } }, t);
    return rkh("div", { style: { fontSize: 13 * big } },
      rkh("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14, color: COLORS.textDim } },
        rkh("b", { style: { color: COLORS.text, fontSize: 16 * big } }, `${shift.label} (${shift.range})`), rkh("span", null, amgFmtDate(today) + " · " + now.toTimeString().slice(0, 5)),
        rkh("span", { style: { marginLeft: "auto", display: "flex", gap: 8 }, className: "mes-no-print" },
          rkh(Button, { variant: "ghost", onClick: () => { const on = !tv; setTv(on); try { if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch (e) {} } }, tv ? "Thoát chế độ TV" : "Chế độ TV"))),
      rkh(KpiRow, { tiles: [
        { label: "Máy đang chạy", value: byStatus.running || 0, tone: "ok" }, { label: "Máy hỏng", value: byStatus.broken || 0, tone: byStatus.broken ? "err" : "none" },
        { label: "Đang bảo trì", value: byStatus.maintenance || 0, tone: byStatus.maintenance ? "warn" : "none" }, { label: "Chưa xác định", value: byStatus.unknown || 0, tone: "none" },
        { label: "Sản lượng nhập hôm nay", value: stageToday.reduce((s, x) => s + x.qty, 0).toLocaleString("vi-VN"), tone: "info" }
      ] }),
      rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(" + (tv ? 380 : 300) + "px,1fr))", gap: 12 } },
        rkh("div", { style: card }, h("Kế hoạch hôm nay: kế hoạch / thực tế"),
          todayPlans.length ? todayPlans.map(p => { const a = amgActualOutput(auditLog, p.date, p.orderId, p.stage); const pc = p.targetQty ? Math.min(100, Math.round(a / p.targetQty * 100)) : 0;
            return rkh("div", { key: p.id, style: { marginBottom: 10 } }, rkh("div", { style: { display: "flex", justifyContent: "space-between" } }, rkh("span", null, `${planLabel(p)} · ${(STAGE_MAP[p.stage] || {}).label || ""}`), rkh("b", null, `${a.toLocaleString("vi-VN")}/${Number(p.targetQty).toLocaleString("vi-VN")}`)),
              rkh("div", { style: { height: 7, background: COLORS.bgInset, borderRadius: 4, marginTop: 4 } }, rkh("div", { style: { width: pc + "%", height: "100%", background: pc >= 100 ? COLORS.green : COLORS.amber, borderRadius: 4 } }))); })
            : rkh("div", { style: { color: COLORS.textDim } }, "Chưa có kế hoạch cho hôm nay.")),
        rkh("div", { style: card }, h("Tiến độ theo công đoạn (nhập liệu hôm nay)"),
          stageToday.length ? stageToday.map(x => rkh("div", { key: x.s.key, style: { display: "flex", justifyContent: "space-between", padding: "4px 0" } }, rkh("span", null, x.s.label), rkh("b", null, x.qty.toLocaleString("vi-VN")))) : rkh("div", { style: { color: COLORS.textDim } }, "Chưa có sản lượng nhập hôm nay.")),
        rkh("div", { style: card }, h("Máy theo dõi"),
          rkh("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, machines.map(m => { const st = MACHINE_STATUS[m.status] || MACHINE_STATUS.unknown; return rkh("span", { key: m.id, title: st.label, style: { fontSize: 11.5 * big, padding: "3px 8px", borderRadius: 6, background: st.color + "22", color: st.color, border: `1px solid ${st.color}55` } }, m.id); }))),
        rkh("div", { style: card }, h("Việc tiếp theo"),
          next.length ? next.map(p => rkh("div", { key: p.id, style: { padding: "4px 0" } }, `${amgFmtDate(p.date)} · ${AMG_SHIFT_LABEL[p.shift] || ""} · ${planLabel(p)} · ${Number(p.targetQty).toLocaleString("vi-VN")}`)) : rkh("div", { style: { color: COLORS.textDim } }, "Không có việc đang chờ.")),
        rkh("div", { style: Object.assign({}, card, { gridColumn: "1 / -1" }) }, h("Nhật ký vận hành gần nhất"),
          logs.length ? logs.map(a => rkh("div", { key: a.id, style: { padding: "4px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 12 * big } }, `${amgFmtDateTime(a.ts && a.ts.toDate ? a.ts.toDate().toISOString() : a.ts)} · ${a.user || ""} · ${a.detail || a.type}`)) : rkh("div", { style: { color: COLORS.textDim } }, "Chưa có nhật ký."))));
  };

  if (tv) return rkh("div", { style: { position: "fixed", inset: 0, zIndex: 200, background: COLORS.bg, padding: 20, overflow: "auto" } }, live());

  return rkh(PageFrame, {
    eyebrow: "Điều hành", title: "Trung tâm điều hành sản xuất", subtitle: "Kế hoạch ngày/tuần, ca, máy, tiến độ và bàn giao ca", icon: CalendarIcon,
    guide: ["Tab “Theo dõi trực tiếp” cho thấy ca hiện tại, máy, kế hoạch/thực tế, việc tiếp theo và nhật ký.", "Bấm “Chế độ TV” để hiển thị toàn màn hình, chữ lớn, không có nút sửa – dùng cho màn hình xưởng.", "Kế hoạch: giao máy, đơn hàng, công đoạn và sản lượng; máy hỏng không giao được.", "Thực tế lấy tự động từ nhập liệu sản lượng – không cần nhập hai lần.", "Cuối ca lập biên bản bàn giao; ca sau bấm “Xác nhận đã nhận ca”."]
  }, rkh(SectionTabs, {
    sections: [
      { key: "live", label: "Theo dõi trực tiếp", render: live },
      { key: "plans", label: "Kế hoạch", render: () => rkh(RecordSection, { cfg: planCfg, rows: plans, user: currentUser, auditLog, ctx }) },
      { key: "hand", label: "Bàn giao ca", render: () => rkh(RecordSection, { cfg: handCfg, rows: hand, user: currentUser, auditLog, ctx }) }
    ]
  }));
}

/* ---------------- BẢO TRÌ & HỒ SƠ MÁY ---------------- */
function MaintenancePage({ extra, machines, auditLog, currentUser }) {
  const mt = extra.maintenance || [], cl = extra.checklists || [], prof = extra.machineProfiles || [];
  const today = amgTodayKey();
  const plus = n => amgTodayKey(new Date(new Date().getTime() + n * 86400000));
  const mOpts = amgOpts(machines, m => m.id, m => `${m.id} – ${m.typeLabel || ""}`);
  const ctx = { machines, mt, cl, prof };
  const money = n => (Number(n) || 0).toLocaleString("vi-VN");

  const mtCfg = {
    col: "maintenance", mod: "dung", label: "Phiếu bảo trì / sửa chữa", title: "Phiếu bảo trì / sửa chữa", addLabel: "Lập phiếu", exportName: "bao-tri-sua-chua",
    status: MT_STATUS, searchKeys: ["id", "machineId", "cause", "handler", "parts"], defaultSort: { key: "date", dir: "desc" },
    emptyTitle: "Chưa có phiếu bảo trì", emptyHint: "Ghi nhận bảo trì định kỳ, sửa chữa, sự cố. Đặt “Kỳ bảo trì tới” để có cảnh báo đến hạn.",
    filters: [{ key: "kind", label: "Loại", options: MT_KIND }, { key: "status", label: "Trạng thái", options: Object.keys(MT_STATUS).map(k => ({ value: k, label: MT_STATUS[k].label })) }, { key: "machineId", label: "Máy", options: mOpts }],
    defaults: (c, u) => ({ kind: "sua_chua", date: today, status: "ke_hoach", handler: (u && u.fullName) || "" }),
    fields: () => [
      { key: "kind", label: "Loại", type: "select", required: true, options: MT_KIND },
      { key: "machineId", label: "Máy", type: "select", required: true, options: mOpts },
      { key: "date", label: "Ngày", type: "date", required: true },
      { key: "status", label: "Trạng thái", type: "select", required: true, options: Object.keys(MT_STATUS).map(k => ({ value: k, label: MT_STATUS[k].label })) },
      { key: "cause", label: "Nguyên nhân / nội dung", required: true, wide: true, maxLen: 300 },
      { key: "handler", label: "Người xử lý", required: true, maxLen: 60 },
      { key: "parts", label: "Phụ tùng thay thế", maxLen: 200 },
      { key: "cost", label: "Chi phí (VND)", type: "number", min: 0, step: "any" },
      { key: "downMinutes", label: "Thời gian dừng máy (phút)", type: "number", min: 0, step: "any" },
      { key: "result", label: "Kết quả", type: "textarea", wide: true, maxLen: 400, validate: (v, a) => a.status === "xong" && !v ? "Phiếu hoàn thành cần ghi kết quả" : "" },
      { key: "nextDue", label: "Kỳ bảo trì tới", type: "date", visible: a => a.kind === "dinh_ky" }
    ],
    columns: [
      { key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) }, { key: "machineId", label: "Máy" },
      { key: "kind", label: "Loại", render: r => MT_KIND_LABEL[r.kind] || r.kind, export: r => MT_KIND_LABEL[r.kind] || r.kind }, { key: "cause", label: "Nội dung" }, { key: "handler", label: "Người xử lý" },
      { key: "cost", label: "Chi phí", align: "right", render: r => money(r.cost), export: r => Number(r.cost) || 0 }, { key: "downMinutes", label: "Dừng (phút)", align: "right" },
      { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: MT_STATUS, value: r.status }), export: r => (MT_STATUS[r.status] || {}).label }
    ],
    kpis: rows => {
      const m = rows.filter(r => String(r.date).slice(0, 7) === today.slice(0, 7));
      const due = rows.filter(r => r.kind === "dinh_ky" && r.nextDue && r.nextDue <= plus(7));
      return [
        { label: "Phiếu đang mở", value: rows.filter(r => r.status !== "xong").length, tone: rows.some(r => r.status !== "xong") ? "warn" : "none", icon: Wrench },
        { label: "Chi phí trong tháng", value: m.length ? money(m.reduce((s, r) => s + (Number(r.cost) || 0), 0)) : "—" },
        { label: "Giờ dừng máy trong tháng", value: m.length ? (m.reduce((s, r) => s + (Number(r.downMinutes) || 0), 0) / 60).toFixed(1) : "—", tone: "warn" },
        { label: "Bảo trì đến hạn ≤ 7 ngày", value: due.length, tone: due.length ? "err" : "none" }
      ];
    },
    transitions: r => [
      r.status === "ke_hoach" ? { label: "Bắt đầu thực hiện", to: "dang_lam" } : null,
      r.status === "dang_lam" ? { label: "Hoàn thành", to: "xong", fields: [{ key: "result", label: "Kết quả", required: true, type: "textarea", wide: true, maxLen: 400 }, { key: "downMinutes", label: "Thời gian dừng máy (phút)", type: "number", min: 0, step: "any" }, { key: "cost", label: "Chi phí (VND)", type: "number", min: 0, step: "any" }] } : null
    ].filter(Boolean)
  };

  const clItems = [{ key: "k_clean", label: "Vệ sinh máy" }, { key: "k_oil", label: "Bôi trơn / dầu" }, { key: "k_safe", label: "Che chắn an toàn" }, { key: "k_noise", label: "Âm thanh / rung bất thường" }, { key: "k_temp", label: "Nhiệt độ" }, { key: "k_param", label: "Thông số cài đặt" }];
  const OKNG = [{ value: "dat", label: "Đạt" }, { value: "ng", label: "Không đạt" }];
  const clCfg = {
    col: "checklists", mod: "may", label: "Checklist đầu ca", title: "Checklist máy đầu ca", addLabel: "Làm checklist", exportName: "checklist-dau-ca",
    searchKeys: ["id", "machineId", "inspector"], defaultSort: { key: "date", dir: "desc" },
    emptyTitle: "Chưa có checklist", filters: [{ key: "machineId", label: "Máy", options: mOpts }, { key: "result", label: "Kết quả", options: [{ value: "dat", label: "Đạt" }, { value: "ng", label: "Có mục không đạt" }] }],
    defaults: (c, u) => ({ date: today, shift: amgCurrentShift().key === "caDem" ? "dem" : "ngay", inspector: (u && u.fullName) || "", k_clean: "dat", k_oil: "dat", k_safe: "dat", k_noise: "dat", k_temp: "dat", k_param: "dat" }),
    fields: () => [
      { key: "machineId", label: "Máy", type: "select", required: true, options: mOpts }, { key: "date", label: "Ngày", type: "date", required: true },
      { key: "shift", label: "Ca", type: "select", required: true, options: AMG_SHIFT_OPTS }, { key: "inspector", label: "Người kiểm", required: true, maxLen: 60 }
    ].concat(clItems.map(i => ({ key: i.key, label: i.label, type: "select", required: true, options: OKNG }))).concat([
      { key: "note", label: "Ghi chú / bất thường", type: "textarea", wide: true, maxLen: 400, validate: (v, a) => clItems.some(i => a[i.key] === "ng") && !v ? "Có mục không đạt: hãy ghi rõ bất thường" : "" },
      { key: "images", label: "Hình ảnh", type: "images", max: 3, wide: true }]),
    show: (f, rec) => clItems.some(i => i.key === f.key) ? (rec[f.key] === "dat" ? "Đạt" : "Không đạt") : f.key === "shift" ? AMG_SHIFT_LABEL[rec.shift] : amgShowValue(f, rec[f.key]),
    columns: [
      { key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) }, { key: "machineId", label: "Máy" }, { key: "shift", label: "Ca", render: r => AMG_SHIFT_LABEL[r.shift], export: r => AMG_SHIFT_LABEL[r.shift] },
      { key: "inspector", label: "Người kiểm" },
      { key: "result", label: "Kết quả", sortValue: r => clItems.some(i => r[i.key] === "ng") ? 1 : 0, render: r => clItems.some(i => r[i.key] === "ng") ? rkh(Badge, { color: COLORS.copper }, "Có mục không đạt") : rkh(Badge, { color: COLORS.green }, "Đạt"), export: r => clItems.some(i => r[i.key] === "ng") ? "Có mục không đạt" : "Đạt" }
    ],
    kpis: rows => {
      const t = rows.filter(r => r.date === today); const done = new Set(t.map(r => r.machineId));
      return [{ label: "Checklist hôm nay", value: t.length, icon: CheckSquare }, { label: "Máy chưa kiểm hôm nay", value: machines.length ? machines.filter(m => !done.has(m.id)).length : "—", tone: machines.some(m => !done.has(m.id)) ? "warn" : "ok" },
        { label: "Mục không đạt hôm nay", value: t.filter(r => clItems.some(i => r[i.key] === "ng")).length, tone: t.some(r => clItems.some(i => r[i.key] === "ng")) ? "err" : "none" }];
    }
  };

  const profCfg = {
    col: "machineProfiles", mod: "may", label: "Hồ sơ máy", title: "Hồ sơ máy", addLabel: "Lập hồ sơ máy", exportName: "ho-so-may",
    searchKeys: ["machineId", "brand", "model", "serial", "owner"], defaultSort: { key: "machineId", dir: "asc" }, emptyTitle: "Chưa có hồ sơ máy", emptyHint: "Lập hồ sơ cho từng máy: hãng, model, số seri, công suất, người phụ trách, chu kỳ bảo trì.",
    defaults: () => ({}),
    fields: (c, rec) => [
      { key: "machineId", label: "Máy", type: "select", required: true, options: mOpts, validate: v => prof.some(p => p.machineId === v && (!rec || p.id !== rec.id)) ? "Máy này đã có hồ sơ" : "" },
      { key: "brand", label: "Hãng sản xuất", maxLen: 60 }, { key: "model", label: "Model", maxLen: 60 }, { key: "serial", label: "Số seri", maxLen: 60 },
      { key: "year", label: "Năm sản xuất", type: "number", min: 1950, max: 2100 }, { key: "commissionedDate", label: "Ngày đưa vào sử dụng", type: "date" },
      { key: "power", label: "Công suất / thông số chính", maxLen: 80 }, { key: "location", label: "Vị trí đặt máy", maxLen: 60 },
      { key: "owner", label: "Người phụ trách máy", maxLen: 60 }, { key: "cycleDays", label: "Chu kỳ bảo trì (ngày)", type: "number", min: 1, max: 3650 },
      { key: "note", label: "Ghi chú", type: "textarea", wide: true, maxLen: 400 }
    ],
    columns: [{ key: "machineId", label: "Máy" }, { key: "brand", label: "Hãng" }, { key: "model", label: "Model" }, { key: "owner", label: "Phụ trách" }, { key: "cycleDays", label: "Chu kỳ BT (ngày)", align: "right" }],
    kpis: rows => [{ label: "Máy đã có hồ sơ", value: `${rows.length}/${machines.length}` }, { label: "Máy chưa có hồ sơ", value: machines.filter(m => !rows.some(p => p.machineId === m.id)).length, tone: machines.some(m => !rows.some(p => p.machineId === m.id)) ? "warn" : "ok" }],
    detailTabs: [{
      key: "hs", label: "Lịch sử máy", render: p => {
        const m = machines.find(x => x.id === p.machineId) || {};
        const h = mt.filter(x => x.machineId === p.machineId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const c = cl.filter(x => x.machineId === p.machineId).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
        const cost = h.reduce((s, x) => s + (Number(x.cost) || 0), 0), down = h.reduce((s, x) => s + (Number(x.downMinutes) || 0), 0);
        const nxt = h.filter(x => x.nextDue).map(x => x.nextDue).sort().pop();
        const row = (a, b) => rkh("div", { style: { padding: "6px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 12.5 } }, rkh("b", null, a), " ", b);
        return rkh("div", null,
          rkh(KpiRow, { tiles: [{ label: "Trạng thái hiện tại", value: (MACHINE_STATUS[m.status] || MACHINE_STATUS.unknown).label }, { label: "Số lần sửa/bảo trì", value: h.length }, { label: "Tổng chi phí", value: h.length ? money(cost) : "—" }, { label: "Tổng dừng máy (giờ)", value: h.length ? (down / 60).toFixed(1) : "—" }, { label: "Kỳ bảo trì tới", value: nxt ? amgFmtDate(nxt) : "—" }] }),
          rkh("div", { style: { fontWeight: 700, fontSize: 13, margin: "6px 0" } }, "Lịch sử sửa chữa / bảo trì"),
          h.length ? h.map(x => row(`${amgFmtDate(x.date)} · ${MT_KIND_LABEL[x.kind]}`, `${x.cause || ""} — ${x.handler || ""}${x.cost ? " — " + money(x.cost) + "đ" : ""}`)) : rkh("div", { style: { fontSize: 12.5, color: COLORS.textDim } }, "Chưa có."),
          rkh("div", { style: { fontWeight: 700, fontSize: 13, margin: "12px 0 6px" } }, "Checklist đầu ca gần nhất"),
          c.length ? c.map(x => row(`${amgFmtDate(x.date)} · ${AMG_SHIFT_LABEL[x.shift]}`, `${x.inspector || ""} — ${clItems.some(i => x[i.key] === "ng") ? "Có mục không đạt" : "Đạt"}`)) : rkh("div", { style: { fontSize: 12.5, color: COLORS.textDim } }, "Chưa có."));
      }
    }]
  };

  // Lịch bảo trì định kỳ: dựng từ các phiếu định kỳ có "kỳ tới"
  const schedule = mt.filter(r => r.kind === "dinh_ky" && r.nextDue).map(r => ({ id: r.id, machineId: r.machineId, nextDue: r.nextDue, handler: r.handler, cause: r.cause }));
  const schedList = rkh(RecordList, {
    title: "Lịch bảo trì định kỳ", rows: schedule, searchKeys: ["machineId", "cause"], defaultSort: { key: "nextDue", dir: "asc" }, exportName: "lich-bao-tri", emptyTitle: "Chưa có lịch bảo trì", emptyHint: "Tạo phiếu “Bảo trì định kỳ” và nhập “Kỳ bảo trì tới”.",
    columns: [{ key: "machineId", label: "Máy" }, { key: "cause", label: "Nội dung" }, { key: "handler", label: "Người xử lý" },
      { key: "nextDue", label: "Đến hạn", render: r => rkh(Badge, { color: r.nextDue < today ? COLORS.copper : r.nextDue <= plus(7) ? COLORS.amber : COLORS.green }, amgFmtDate(r.nextDue)), export: r => amgFmtDate(r.nextDue) }]
  });

  return rkh(PageFrame, {
    eyebrow: "Thiết bị", title: "Bảo trì, sửa chữa & hồ sơ máy", subtitle: "Phiếu bảo trì, lịch định kỳ, checklist đầu ca và hồ sơ từng máy", icon: Wrench,
    guide: ["Phiếu bảo trì/sửa chữa: ghi nguyên nhân, người xử lý, phụ tùng, chi phí, thời gian dừng và kết quả.", "Bảo trì định kỳ: nhập “Kỳ bảo trì tới” để hệ thống cảnh báo trước 7 ngày.", "Checklist đầu ca: mỗi máy kiểm một lần/ca; mục không đạt bắt buộc ghi rõ bất thường.", "Hồ sơ máy: thông tin kỹ thuật + toàn bộ lịch sử sửa chữa, checklist, chi phí, giờ dừng."]
  }, rkh(SectionTabs, {
    sections: [
      { key: "mt", label: "Bảo trì / sửa chữa", render: () => rkh(RecordSection, { cfg: mtCfg, rows: mt, user: currentUser, auditLog, ctx }) },
      { key: "lich", label: "Lịch định kỳ", render: () => schedList },
      { key: "cl", label: "Checklist đầu ca", render: () => rkh(RecordSection, { cfg: clCfg, rows: cl, user: currentUser, auditLog, ctx }) },
      { key: "hs", label: "Hồ sơ máy", render: () => rkh(RecordSection, { cfg: profCfg, rows: prof, user: currentUser, auditLog, ctx }) }
    ]
  }));
}
