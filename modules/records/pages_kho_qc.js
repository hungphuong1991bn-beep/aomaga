/* ===================== KHO & NGUYÊN LIỆU / KIỂM TRA QA-QC & NG (v45) ===================== */

const LOT_STATUS = {
  cho_iqc: { label: "Chờ IQC", get color() { return COLORS.amber; } },
  dat: { label: "Đạt – dùng được", get color() { return COLORS.green; } },
  cach_ly: { label: "Cách ly", get color() { return COLORS.copper; } },
  tra_ncc: { label: "Trả nhà cung cấp", get color() { return COLORS.textFaint; } },
  het: { label: "Đã dùng hết", get color() { return COLORS.textFaint; } }
};
const NCR_STATUS = {
  mo: { label: "Mới mở", get color() { return COLORS.copper; } },
  dang_xu_ly: { label: "Đang xử lý", get color() { return COLORS.amber; } },
  cho_xn: { label: "Chờ xác nhận", get color() { return COLORS.blue; } },
  dong: { label: "Đã đóng", get color() { return COLORS.green; } }
};
const INSPECT_TYPES = [{ value: "IQC", label: "IQC – kiểm đầu vào" }, { value: "IPQC", label: "IPQC – kiểm trong chuyền" }, { value: "OQC", label: "OQC – kiểm đầu ra" }];
const CRITERIA = [
  { key: "c_dim", label: "Kích thước" }, { key: "c_res", label: "Điện trở" }, { key: "c_curv", label: "Độ cong" },
  { key: "c_flat", label: "Độ phẳng" }, { key: "c_surf", label: "Bề mặt" }, { key: "c_iron", label: "Tạp chất / nhiễm sắt" }
];
const CRIT_OPTS = [{ value: "dat", label: "Đạt" }, { value: "ng", label: "NG" }, { value: "khong", label: "Không kiểm" }];

function lotRemaining(lot, moves) {
  let r = Number(lot.qtyOK) || 0;
  (moves || []).forEach(m => { if (m.lotId === lot.id) r += (m.type === "nhap" ? 1 : -1) * (Number(m.qty) || 0); });
  return r;
}
function failedCriteria(rec) { return CRITERIA.filter(c => rec[c.key] === "ng").map(c => c.label); }

/* ---------------- KHO ---------------- */
function WarehousePage({ extra, orders, auditLog, currentUser }) {
  const lots = extra.lots || [], moves = extra.stockMoves || [], insp = extra.inspections || [];
  const lotLabel = l => `${l.lotNo || l.id} – ${l.material || ""}`;
  const ctx = { lots, moves, orders, insp };

  const lotCfg = {
    col: "lots", mod: "kho", label: "Lô nguyên liệu", title: "Lô nguyên liệu", addLabel: "Nhập lô mới", exportName: "lo-nguyen-lieu",
    status: LOT_STATUS, searchKeys: ["lotNo", "material", "supplier", "location", "id"], defaultSort: { key: "receivedDate", dir: "desc" },
    emptyTitle: "Chưa có lô nguyên liệu", emptyHint: "Bấm “Nhập lô mới” để ghi nhận lô đầu tiên. Hệ thống không tạo dữ liệu mẫu.",
    filters: [{ key: "status", label: "Trạng thái", options: Object.keys(LOT_STATUS).map(k => ({ value: k, label: LOT_STATUS[k].label })) }],
    defaults: () => ({ status: "cho_iqc", receivedDate: amgTodayKey(), unit: "kg" }),
    fields: () => [
      { key: "lotNo", label: "Số lô", required: true, maxLen: 40 },
      { key: "material", label: "Tên nguyên liệu", required: true, maxLen: 80 },
      { key: "supplier", label: "Nhà cung cấp", required: true, maxLen: 80 },
      { key: "receivedDate", label: "Ngày nhập", type: "date", required: true },
      { key: "qtyReceived", label: "Số lượng nhập", type: "number", min: 0, step: "any", required: true },
      { key: "unit", label: "Đơn vị", required: true, maxLen: 10 },
      { key: "qtyOK", label: "Số lượng đạt (OK)", type: "number", min: 0, step: "any", required: true, validate: (v, a) => Number(v) + Number(a.qtyNG || 0) > Number(a.qtyReceived) ? "OK + NG không được lớn hơn số lượng nhập" : "" },
      { key: "qtyNG", label: "Số lượng NG", type: "number", min: 0, step: "any" },
      { key: "location", label: "Vị trí kho", maxLen: 40 },
      { key: "certificate", label: "Số chứng chỉ / COC", maxLen: 60 },
      { key: "status", label: "Trạng thái", type: "select", required: true, options: Object.keys(LOT_STATUS).map(k => ({ value: k, label: LOT_STATUS[k].label })) },
      { key: "note", label: "Ghi chú", type: "textarea", wide: true, maxLen: 500 }
    ],
    columns: [
      { key: "lotNo", label: "Số lô" }, { key: "material", label: "Nguyên liệu" }, { key: "supplier", label: "Nhà cung cấp" },
      { key: "receivedDate", label: "Ngày nhập", render: r => amgFmtDate(r.receivedDate), export: r => amgFmtDate(r.receivedDate) },
      { key: "qtyOK", label: "OK", align: "right" }, { key: "qtyNG", label: "NG", align: "right" },
      { key: "remain", label: "Tồn", align: "right", sortValue: r => lotRemaining(r, moves), render: r => lotRemaining(r, moves).toLocaleString("vi-VN"), export: r => lotRemaining(r, moves) },
      { key: "location", label: "Vị trí" },
      { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: LOT_STATUS, value: r.status }), export: r => (LOT_STATUS[r.status] || {}).label }
    ],
    kpis: rows => {
      const rec = rows.reduce((s, l) => s + (Number(l.qtyReceived) || 0), 0), ng = rows.reduce((s, l) => s + (Number(l.qtyNG) || 0), 0);
      const avail = rows.filter(l => l.status === "dat").reduce((s, l) => s + lotRemaining(l, moves), 0);
      return [
        { label: "Lô đang quản lý", value: rows.filter(l => l.status !== "het").length, icon: Package },
        { label: "Tồn khả dụng (lô đạt)", value: rows.length ? avail.toLocaleString("vi-VN") : "—", tone: "ok" },
        { label: "Chờ IQC", value: rows.filter(l => l.status === "cho_iqc").length, tone: rows.some(l => l.status === "cho_iqc") ? "warn" : "none" },
        { label: "Đang cách ly", value: rows.filter(l => l.status === "cach_ly").length, tone: rows.some(l => l.status === "cach_ly") ? "err" : "none" },
        { label: "Tỷ lệ NG khi nhập", value: rec ? (ng / rec * 100).toFixed(1) + "%" : "—", tone: ng ? "warn" : "none" }
      ];
    },
    transitions: l => [
      l.status === "cho_iqc" || l.status === "cach_ly" ? { label: "Xác nhận đạt IQC (phê duyệt)", to: "dat", need: "p", mod: "qc" } : null,
      l.status !== "cach_ly" && l.status !== "het" && l.status !== "tra_ncc" ? { label: "Cách ly lô", to: "cach_ly" } : null,
      l.status === "cach_ly" ? { label: "Trả nhà cung cấp", to: "tra_ncc" } : null,
      l.status === "dat" ? { label: "Đánh dấu đã dùng hết", to: "het" } : null
    ].filter(Boolean),
    detailTabs: [{
      key: "tm", label: "Truy xuất nguồn gốc", render: l => {
        const mv = moves.filter(m => m.lotId === l.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const ins = insp.filter(i => i.lotId === l.id);
        const ords = Array.from(new Set(mv.filter(m => m.type === "xuat" && m.orderId).map(m => m.orderId)));
        const row = (a, b) => rkh("div", { style: { padding: "6px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13) } }, rkh("b", null, a), " ", b);
        return rkh("div", null,
          rkh("div", { style: { fontWeight: 700, margin: "4px 0", fontSize: FZ(13) } }, "Kiểm tra IQC / chất lượng liên quan"),
          ins.length ? ins.map(i => row(`${i.id} · ${i.type} · ${amgFmtDate(i.date)}`, `Kết quả: ${i.result === "dat" ? "Đạt" : "NG"}`)) : rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Chưa có phiếu kiểm tra."),
          rkh("div", { style: { fontWeight: 700, margin: "12px 0 4px", fontSize: FZ(13) } }, "Đơn hàng đã sử dụng lô này"),
          ords.length ? ords.map(o => row(o, (orders.find(x => x.id === o) || {}).customer || "")) : rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Chưa xuất cho đơn hàng nào."),
          rkh("div", { style: { fontWeight: 700, margin: "12px 0 4px", fontSize: FZ(13) } }, "Lịch sử nhập/xuất"),
          mv.length ? mv.map(m => row(`${amgFmtDate(m.date)} · ${m.type === "nhap" ? "Nhập" : "Xuất"} ${m.qty}`, m.orderId ? "→ " + m.orderId : (m.note || ""))) : rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Chưa có phiếu nhập/xuất."));
      }
    }]
  };

  const moveCfg = {
    col: "stockMoves", mod: "kho", label: "Phiếu nhập/xuất kho", title: "Nhập / xuất kho", addLabel: "Lập phiếu", exportName: "nhap-xuat-kho",
    searchKeys: ["id", "orderId", "handler", "note"], defaultSort: { key: "date", dir: "desc" },
    emptyTitle: "Chưa có phiếu nhập/xuất", emptyHint: "Phiếu xuất chỉ chọn được lô đã đạt IQC và còn tồn.",
    filters: [{ key: "type", label: "Loại", options: [{ value: "nhap", label: "Nhập" }, { value: "xuat", label: "Xuất" }] }],
    defaults: (c, u) => ({ date: amgTodayKey(), type: "xuat", handler: (u && u.fullName) || "" }),
    fields: (c, rec) => [
      { key: "type", label: "Loại phiếu", type: "select", required: true, options: [{ value: "nhap", label: "Nhập thêm" }, { value: "xuat", label: "Xuất kho" }] },
      { key: "date", label: "Ngày", type: "date", required: true },
      { key: "lotId", label: "Lô nguyên liệu", type: "select", required: true, options: lots.filter(l => l.status !== "het" && l.status !== "tra_ncc").map(l => ({ value: l.id, label: lotLabel(l) })),
        validate: (v, a) => { const l = lots.find(x => x.id === v); if (!l) return "Lô không tồn tại"; if (a.type === "xuat" && l.status !== "dat") return "Chỉ xuất lô đã đạt IQC (lô này: " + (LOT_STATUS[l.status] || {}).label + ")"; return ""; } },
      { key: "qty", label: "Số lượng", type: "number", min: 0.0001, step: "any", required: true,
        validate: (v, a) => { const l = lots.find(x => x.id === a.lotId); if (!l || a.type !== "xuat") return ""; const own = rec && rec.lotId === l.id && rec.type === "xuat" ? Number(rec.qty) || 0 : 0; return Number(v) > lotRemaining(l, moves) + own ? `Vượt tồn kho (còn ${lotRemaining(l, moves) + own})` : ""; } },
      { key: "orderId", label: "Đơn hàng sử dụng", type: "select", options: amgOpts(orders, o => o.id, o => `${o.id} – ${o.customer || ""} ${o.spec || ""}`), visible: a => a.type === "xuat" },
      { key: "handler", label: "Người thực hiện", required: true, maxLen: 60 },
      { key: "note", label: "Ghi chú", type: "textarea", wide: true, maxLen: 300 }
    ],
    columns: [
      { key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) },
      { key: "type", label: "Loại", render: r => r.type === "nhap" ? "Nhập" : "Xuất", export: r => r.type === "nhap" ? "Nhập" : "Xuất" },
      { key: "lotId", label: "Lô", render: r => { const l = lots.find(x => x.id === r.lotId); return l ? l.lotNo : r.lotId; }, export: r => { const l = lots.find(x => x.id === r.lotId); return l ? l.lotNo : r.lotId; } },
      { key: "qty", label: "Số lượng", align: "right" }, { key: "orderId", label: "Đơn hàng" }, { key: "handler", label: "Người thực hiện" }
    ],
    kpis: rows => [{ label: "Phiếu trong tháng", value: rows.filter(r => String(r.date).slice(0, 7) === amgTodayKey().slice(0, 7)).length }, { label: "Xuất trong tháng", value: rows.filter(r => r.type === "xuat" && String(r.date).slice(0, 7) === amgTodayKey().slice(0, 7)).reduce((s, r) => s + (Number(r.qty) || 0), 0).toLocaleString("vi-VN") }]
  };

  // Tồn theo nhà cung cấp / vị trí: tính từ chính các lô, không lưu riêng
  const group = key => {
    const m = {};
    lots.forEach(l => { const k = l[key] || "(chưa ghi)"; m[k] = m[k] || { id: k, name: k, lots: 0, received: 0, ng: 0, remain: 0 }; m[k].lots++; m[k].received += Number(l.qtyReceived) || 0; m[k].ng += Number(l.qtyNG) || 0; if (l.status === "dat") m[k].remain += lotRemaining(l, moves); });
    return Object.keys(m).map(k => m[k]);
  };
  const groupTable = (title, key, label) => rkh(RecordList, {
    title, rows: group(key), searchKeys: ["name"], exportName: "ton-kho-" + key, defaultSort: { key: "remain", dir: "desc" }, emptyTitle: "Chưa có lô nào",
    columns: [{ key: "name", label }, { key: "lots", label: "Số lô", align: "right" }, { key: "received", label: "Đã nhập", align: "right" },
      { key: "ng", label: "NG", align: "right" }, { key: "rate", label: "Tỷ lệ NG", align: "right", sortValue: r => r.received ? r.ng / r.received : 0, render: r => r.received ? (r.ng / r.received * 100).toFixed(1) + "%" : "—", export: r => r.received ? (r.ng / r.received * 100).toFixed(1) + "%" : "" },
      { key: "remain", label: "Tồn khả dụng", align: "right" }]
  });

  return rkh(PageFrame, {
    eyebrow: "Kho", title: "Kho & nguyên liệu", subtitle: "Lô, nhập/xuất, tồn, cách ly và truy xuất nguồn gốc", icon: Package,
    guide: ["Nhập lô mới ở tab “Lô nguyên liệu” với trạng thái Chờ IQC.", "Người có quyền phê duyệt QA/QC xác nhận “Đạt IQC” thì lô mới được xuất.", "Lô lỗi: bấm “Cách ly lô” – hệ thống chặn xuất kho lô này.", "Bấm vào một lô để xem truy xuất: phiếu kiểm tra, đơn hàng đã dùng, lịch sử nhập/xuất."]
  }, rkh(SectionTabs, {
    sections: [
      { key: "lots", label: "Lô nguyên liệu", render: () => rkh(RecordSection, { cfg: lotCfg, rows: lots, user: currentUser, auditLog, ctx }) },
      { key: "moves", label: "Nhập / xuất", render: () => rkh(RecordSection, { cfg: moveCfg, rows: moves, user: currentUser, auditLog, ctx }) },
      { key: "ncc", label: "Theo nhà cung cấp", render: () => groupTable("Nhà cung cấp", "supplier", "Nhà cung cấp") },
      { key: "vt", label: "Theo vị trí", render: () => groupTable("Vị trí kho", "location", "Vị trí") }
    ]
  }));
}

/* ---------------- QA/QC ---------------- */
function InspectPage({ extra, orders, machines, auditLog, currentUser }) {
  const lots = extra.lots || [], insp = extra.inspections || [], ncr = extra.ncr || [];
  const ctx = { lots, orders, machines, insp, ncr };
  const stageOpts = STAGES.map(s => ({ value: s.key, label: s.label })).concat([{ value: "kiem_cuoi", label: "Kiểm cuối / đóng gói" }]);
  const stageLabel = k => (stageOpts.find(o => o.value === k) || {}).label || k || "—";
  const today = amgTodayKey();

  const inspCfg = {
    col: "inspections", mod: "qc", label: "Phiếu kiểm tra", title: "Phiếu kiểm tra", addLabel: "Lập phiếu kiểm", exportName: "phieu-kiem-tra",
    searchKeys: ["id", "orderId", "material", "inspector", "machineId"], defaultSort: { key: "date", dir: "desc" },
    emptyTitle: "Chưa có phiếu kiểm tra", emptyHint: "Bấm “Lập phiếu kiểm”. Kết quả NG sẽ tự mở phiếu NG và cách ly lô (nếu có).",
    filters: [{ key: "type", label: "Loại", options: INSPECT_TYPES.map(t => ({ value: t.value, label: t.value })) }, { key: "result", label: "Kết quả", options: [{ value: "dat", label: "Đạt" }, { value: "ng", label: "NG" }] }],
    defaults: (c, u) => ({ date: today, time: new Date().toTimeString().slice(0, 5), inspector: (u && u.fullName) || "", shift: amgCurrentShift().key === "caDem" ? "dem" : "ngay", c_dim: "khong", c_res: "khong", c_curv: "khong", c_flat: "khong", c_surf: "khong", c_iron: "khong" }),
    fields: () => [
      { key: "type", label: "Loại kiểm tra", type: "select", required: true, options: INSPECT_TYPES },
      { key: "date", label: "Ngày", type: "date", required: true },
      { key: "time", label: "Giờ (HH:MM)", required: true, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", patternMsg: "Giờ theo dạng HH:MM, ví dụ 14:30" },
      { key: "shift", label: "Ca", type: "select", required: true, options: AMG_SHIFT_OPTS },
      { key: "orderId", label: "Đơn hàng", type: "select", options: amgOpts(orders, o => o.id, o => `${o.id} – ${o.customer || ""} ${o.spec || ""}`) },
      { key: "lotId", label: "Lô nguyên liệu", type: "select", options: lots.map(l => ({ value: l.id, label: `${l.lotNo || l.id} – ${l.material || ""}` })), visible: a => a.type === "IQC", required: false },
      { key: "material", label: "Vật tư / sản phẩm", maxLen: 80 },
      { key: "stage", label: "Công đoạn", type: "select", options: stageOpts },
      { key: "machineId", label: "Máy", type: "select", options: amgOpts(machines, m => m.id, m => `${m.id} – ${m.typeLabel || ""}`) },
      { key: "inspector", label: "Người kiểm", required: true, maxLen: 60 },
      { key: "standard", label: "Tiêu chuẩn áp dụng", required: true, maxLen: 120, help: "Ví dụ: UL 758, RoHS, tiêu chuẩn khách hàng…" },
    ].concat(CRITERIA.map(c => ({ key: c.key, label: c.label, type: "select", options: CRIT_OPTS }))).concat([
      { key: "measure", label: "Số đo thực tế", type: "textarea", wide: true, maxLen: 500 },
      { key: "result", label: "Kết luận", type: "select", required: true, options: [{ value: "dat", label: "Đạt" }, { value: "ng", label: "NG" }],
        validate: (v, a) => v === "dat" && CRITERIA.some(c => a[c.key] === "ng") ? "Có tiêu chí NG nên kết luận không thể là Đạt" : "" },
      { key: "images", label: "Hình ảnh", type: "images", max: 3, wide: true }
    ]),
    columns: [
      { key: "date", label: "Ngày", render: r => amgFmtDate(r.date) + " " + (r.time || ""), export: r => amgFmtDate(r.date) + " " + (r.time || "") },
      { key: "type", label: "Loại" }, { key: "orderId", label: "Đơn hàng" }, { key: "stage", label: "Công đoạn", render: r => stageLabel(r.stage), export: r => stageLabel(r.stage) },
      { key: "machineId", label: "Máy" }, { key: "inspector", label: "Người kiểm" },
      { key: "result", label: "Kết quả", render: r => rkh(Badge, { color: r.result === "dat" ? COLORS.green : COLORS.copper }, r.result === "dat" ? "Đạt" : "NG"), export: r => r.result === "dat" ? "Đạt" : "NG" }
    ],
    kpis: rows => {
      const m = rows.filter(r => String(r.date).slice(0, 7) === today.slice(0, 7));
      const okc = m.filter(r => r.result === "dat").length;
      return [
        { label: "Phiếu kiểm hôm nay", value: rows.filter(r => r.date === today).length, icon: CheckSquare },
        { label: "Tỷ lệ đạt trong tháng", value: m.length ? (okc / m.length * 100).toFixed(1) + "%" : "—", tone: m.length && okc / m.length < 0.95 ? "warn" : "ok" },
        { label: "Phiếu NG trong tháng", value: m.length ? m.length - okc : "—", tone: m.length - okc > 0 ? "err" : "none" },
        { label: "NG chưa đóng", value: ncr.filter(n => n.status !== "dong").length, tone: ncr.some(n => n.status !== "dong") ? "warn" : "none" }
      ];
    },
    show: (f, rec) => f.key === "stage" ? stageLabel(rec.stage) : f.key === "shift" ? AMG_SHIFT_LABEL[rec.shift] || "—" : f.key.startsWith("c_") ? (CRIT_OPTS.find(o => o.value === rec[f.key]) || {}).label || "—" : f.key === "type" ? rec.type : f.key === "result" ? (rec.result === "dat" ? "Đạt" : "NG") : amgShowValue(f, rec[f.key]),
    // NG → tự mở phiếu NG (một lần, khi tạo mới) và cách ly lô nếu là IQC
    afterSave: async (saved, isNew, c, user) => {
      if (!isNew || saved.result !== "ng") return;
      const fails = failedCriteria(saved);
      await amgSaveRecord("ncr", {
        inspectionId: saved.id, orderId: saved.orderId || "", lotId: saved.lotId || "", machineId: saved.machineId || "", stage: saved.stage || "",
        defect: fails.length ? "Không đạt: " + fails.join(", ") : "Phiếu kiểm kết luận NG", status: "mo", owner: "", openedDate: today
      }, user, `Tự mở phiếu NG từ phiếu kiểm ${saved.id}`);
      if (saved.lotId) {
        const lot = lots.find(l => l.id === saved.lotId);
        if (lot && lot.status !== "cach_ly") await amgSaveRecord("lots", Object.assign({}, lot, { status: "cach_ly" }), user, `Cách ly lô ${lot.lotNo || lot.id} do phiếu kiểm ${saved.id} NG`);
      }
    }
  };

  const ncrCfg = {
    col: "ncr", mod: "qc", label: "Phiếu NG", title: "Phiếu NG (không phù hợp)", addLabel: "Mở phiếu NG", exportName: "phieu-ng",
    status: NCR_STATUS, searchKeys: ["id", "defect", "owner", "orderId", "machineId"], defaultSort: { key: "openedDate", dir: "desc" },
    emptyTitle: "Chưa có phiếu NG", emptyHint: "Phiếu NG tự mở khi phiếu kiểm kết luận NG, hoặc mở thủ công.",
    filters: [{ key: "status", label: "Trạng thái", options: Object.keys(NCR_STATUS).map(k => ({ value: k, label: NCR_STATUS[k].label })) }],
    defaults: () => ({ status: "mo", openedDate: today }),
    fields: () => [
      { key: "defect", label: "Mô tả lỗi", required: true, wide: true, maxLen: 300 },
      { key: "openedDate", label: "Ngày mở", type: "date", required: true },
      { key: "inspectionId", label: "Phiếu kiểm liên quan", type: "select", options: insp.map(i => ({ value: i.id, label: `${i.id} · ${i.type} · ${amgFmtDate(i.date)}` })) },
      { key: "orderId", label: "Đơn hàng", type: "select", options: amgOpts(orders, o => o.id, o => `${o.id} – ${o.customer || ""}`) },
      { key: "lotId", label: "Lô nguyên liệu", type: "select", options: lots.map(l => ({ value: l.id, label: l.lotNo || l.id })) },
      { key: "machineId", label: "Máy", type: "select", options: amgOpts(machines, m => m.id, m => m.id) },
      { key: "qtyNG", label: "Số lượng NG", type: "number", min: 0, step: "any" },
      { key: "owner", label: "Người phụ trách xử lý", maxLen: 60 },
      { key: "dueDate", label: "Hạn xử lý", type: "date" },
      { key: "rootCause", label: "Nguyên nhân gốc", type: "textarea", wide: true, maxLen: 600 },
      { key: "corrective", label: "Hành động khắc phục", type: "textarea", wide: true, maxLen: 600 },
      { key: "verification", label: "Xác nhận sau khắc phục", type: "textarea", wide: true, maxLen: 600 }
    ],
    columns: [
      { key: "id", label: "Mã" }, { key: "openedDate", label: "Ngày mở", render: r => amgFmtDate(r.openedDate), export: r => amgFmtDate(r.openedDate) },
      { key: "defect", label: "Lỗi" }, { key: "orderId", label: "Đơn hàng" }, { key: "owner", label: "Phụ trách" },
      { key: "dueDate", label: "Hạn", render: r => amgFmtDate(r.dueDate), export: r => amgFmtDate(r.dueDate) },
      { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: NCR_STATUS, value: r.status }), export: r => (NCR_STATUS[r.status] || {}).label }
    ],
    kpis: rows => {
      const open = rows.filter(n => n.status !== "dong");
      return [
        { label: "Phiếu NG đang mở", value: open.length, tone: open.length ? "warn" : "ok" },
        { label: "Quá hạn xử lý", value: open.filter(n => n.dueDate && n.dueDate < today).length, tone: open.some(n => n.dueDate && n.dueDate < today) ? "err" : "none" },
        { label: "Chờ xác nhận đóng", value: rows.filter(n => n.status === "cho_xn").length, tone: "info" },
        { label: "Đã đóng", value: rows.filter(n => n.status === "dong").length, tone: "ok" }
      ];
    },
    transitions: n => {
      const req = (k, l) => ({ key: k, label: l, required: true, type: "textarea", wide: true, maxLen: 600 });
      return [
        n.status === "mo" ? { label: "Bắt đầu xử lý", to: "dang_xu_ly", fields: [{ key: "owner", label: "Người phụ trách xử lý", required: true, maxLen: 60 }, { key: "dueDate", label: "Hạn xử lý", type: "date", required: true }, req("rootCause", "Nguyên nhân gốc")] } : null,
        n.status === "dang_xu_ly" ? { label: "Báo đã khắc phục", to: "cho_xn", fields: [req("corrective", "Hành động khắc phục")] } : null,
        n.status === "cho_xn" ? { label: "Xác nhận & đóng (phê duyệt)", to: "dong", need: "p", fields: [req("verification", "Xác nhận sau khắc phục")], stamp: u => ({ closedDate: today, closedBy: (u && u.fullName) || "" }) } : null,
        n.status === "cho_xn" ? { label: "Yêu cầu làm lại", to: "dang_xu_ly" } : null
      ].filter(Boolean);
    },
    detailTabs: [{
      key: "tm", label: "Truy xuất", render: n => {
        const i = insp.find(x => x.id === n.inspectionId), l = lots.find(x => x.id === n.lotId), o = orders.find(x => x.id === n.orderId);
        const row = (a, b) => rkh("div", { style: { padding: "6px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13) } }, rkh("b", null, a + ": "), b || "—");
        return rkh("div", null,
          row("Phiếu kiểm", i ? `${i.id} · ${i.type} · ${amgFmtDate(i.date)} · ${i.result === "dat" ? "Đạt" : "NG"}` : ""),
          row("Lô nguyên liệu", l ? `${l.lotNo || l.id} – ${l.material || ""} (${(LOT_STATUS[l.status] || {}).label})` : ""),
          row("Đơn hàng", o ? `${o.id} – ${o.customer || ""} ${o.spec || ""}` : ""), row("Máy", n.machineId), row("Công đoạn", stageLabel(n.stage)),
          n.closedDate && row("Đóng phiếu", `${amgFmtDate(n.closedDate)} bởi ${n.closedBy || ""}`));
      }
    }]
  };

  return rkh(PageFrame, {
    eyebrow: "Chất lượng", title: "Kiểm tra QA/QC & phiếu NG", subtitle: "IQC · IPQC · OQC và quy trình xử lý sản phẩm/vật tư NG", icon: CheckSquare,
    guide: ["Lập phiếu kiểm: chọn loại (IQC/IPQC/OQC), đơn hàng, công đoạn, máy, ca; đánh giá từng tiêu chí và đính kèm ảnh.", "Kết luận NG → hệ thống tự mở phiếu NG, cách ly lô (nếu là IQC) và hiện cảnh báo trên chuông.", "Phiếu NG đi qua: Mới mở → Đang xử lý (nguyên nhân gốc) → Chờ xác nhận (khắc phục) → Đóng (cần quyền phê duyệt).", "Mọi thay đổi đều được ghi vào lịch sử của phiếu."]
  }, rkh(SectionTabs, {
    sections: [
      { key: "insp", label: "Phiếu kiểm tra", render: () => rkh(RecordSection, { cfg: inspCfg, rows: insp, user: currentUser, auditLog, ctx }) },
      { key: "ncr", label: "Phiếu NG", render: () => rkh(RecordSection, { cfg: ncrCfg, rows: ncr, user: currentUser, auditLog, ctx }) }
    ]
  }));
}
