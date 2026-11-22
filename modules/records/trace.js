/* ===================== GĐ5: TRUY XUẤT XUYÊN PHÂN HỆ & TOÀN VẸN DỮ LIỆU (v45) ===================== */

// Hàm thuần (có kiểm thử): dựng chuỗi truy xuất từ một lô hoặc một đơn hàng
function amgTrace(kind, id, d) {
  const lots = d.lots || [], moves = d.stockMoves || [], insp = d.inspections || [], ncr = d.ncr || [], orders = d.orders || [], plans = d.plans || [], log = d.auditLog || [];
  const out = { kind, id, lots: [], orders: [], inspections: [], ncr: [], moves: [], plans: [], production: [] };
  if (kind === "lot") {
    const l = lots.find(x => x.id === id); if (!l) return null;
    out.lots = [l]; out.moves = moves.filter(m => m.lotId === id);
    out.inspections = insp.filter(i => i.lotId === id); out.ncr = ncr.filter(n => n.lotId === id);
    const oids = Array.from(new Set(out.moves.filter(m => m.type === "xuat" && m.orderId).map(m => m.orderId)));
    out.orders = orders.filter(o => oids.includes(o.id));
  } else {
    const o = orders.find(x => x.id === id); if (!o) return null;
    out.orders = [o]; out.moves = moves.filter(m => m.orderId === id && m.type === "xuat");
    const lids = Array.from(new Set(out.moves.map(m => m.lotId)));
    out.lots = lots.filter(l => lids.includes(l.id));
    out.inspections = insp.filter(i => i.orderId === id || lids.includes(i.lotId));
    out.ncr = ncr.filter(n => n.orderId === id || lids.includes(n.lotId));
    out.plans = plans.filter(p => p.orderId === id);
    out.production = log.filter(a => a.type === "production_entry" && a.targetId === id);
  }
  return out;
}

// Hàm thuần: tìm tham chiếu mồ côi / số liệu bất hợp lý
function amgIntegrity(d) {
  const lots = d.lots || [], moves = d.stockMoves || [], insp = d.inspections || [], ncr = d.ncr || [], orders = d.orders || [], machines = d.machines || [], plans = d.plans || [], mt = d.maintenance || [];
  const has = (arr, id) => arr.some(x => x.id === id);
  const issues = [];
  const add = (col, id, msg, tab) => issues.push({ id: col + ":" + id, col, rid: id, msg, tab });
  moves.forEach(m => { if (!has(lots, m.lotId)) add("stockMoves", m.id, "Phiếu kho tham chiếu lô không tồn tại", "warehouse"); if (m.orderId && !has(orders, m.orderId)) add("stockMoves", m.id, `Tham chiếu đơn ${m.orderId} không tồn tại`, "warehouse"); });
  lots.forEach(l => { let r = Number(l.qtyOK) || 0; moves.forEach(m => { if (m.lotId === l.id) r += (m.type === "nhap" ? 1 : -1) * (Number(m.qty) || 0); }); if (r < -1e-9) add("lots", l.id, "Tồn kho âm", "warehouse"); if ((Number(l.qtyOK) || 0) + (Number(l.qtyNG) || 0) > (Number(l.qtyReceived) || 0) + 1e-9) add("lots", l.id, "OK + NG lớn hơn số lượng nhập", "warehouse"); });
  insp.forEach(i => { if (i.orderId && !has(orders, i.orderId)) add("inspections", i.id, `Đơn ${i.orderId} không tồn tại`, "inspect"); if (i.lotId && !has(lots, i.lotId)) add("inspections", i.id, "Lô không tồn tại", "inspect"); if (i.machineId && !has(machines, i.machineId)) add("inspections", i.id, `Máy ${i.machineId} không tồn tại`, "inspect"); if (i.result === "dat" && ["c_dim", "c_res", "c_curv", "c_flat", "c_surf", "c_iron"].some(k => i[k] === "ng")) add("inspections", i.id, "Kết luận Đạt nhưng có tiêu chí NG", "inspect"); });
  ncr.forEach(n => { if (n.lotId && !has(lots, n.lotId)) add("ncr", n.id, "Lô không tồn tại", "inspect"); if (n.inspectionId && !has(insp, n.inspectionId)) add("ncr", n.id, "Phiếu kiểm không tồn tại", "inspect"); if (n.status === "dong" && !n.verification) add("ncr", n.id, "Đã đóng nhưng thiếu xác nhận sau khắc phục", "inspect"); });
  insp.filter(i => i.result === "ng").forEach(i => { if (!ncr.some(n => n.inspectionId === i.id)) add("inspections", i.id, "Phiếu kiểm NG chưa có phiếu NG", "inspect"); });
  plans.forEach(p => { if (p.machineId && !has(machines, p.machineId)) add("plans", p.id, `Máy ${p.machineId} không tồn tại`, "ops"); if (p.orderId && !has(orders, p.orderId)) add("plans", p.id, `Đơn ${p.orderId} không tồn tại`, "ops"); });
  mt.forEach(m => { if (m.machineId && !has(machines, m.machineId)) add("maintenance", m.id, `Máy ${m.machineId} không tồn tại`, "maintenance"); });
  orders.forEach(o => { const q = Number(o.quantity), dl = (o.deliveries || []).reduce((s, x) => s + (Number(x.qty) || 0), 0); if (q && dl > q * 1.05) add("orders", o.id, "Tổng giao hàng vượt 105% số lượng đặt", "orders"); });
  return issues;
}

function TracePage({ extra, orders, machines, auditLog, onNavigate }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const d = Object.assign({}, extra, { orders, machines, auditLog });
  const term = q.trim().toLowerCase();
  const hits = term ? [].concat(
    (extra.lots || []).filter(l => [l.id, l.lotNo, l.material, l.supplier].some(v => String(v || "").toLowerCase().includes(term))).map(l => ({ kind: "lot", id: l.id, label: `Lô ${l.lotNo || l.id} – ${l.material || ""}` })),
    orders.filter(o => [o.id, o.customer, o.spec].some(v => String(v || "").toLowerCase().includes(term))).map(o => ({ kind: "order", id: o.id, label: `Đơn ${o.customer || ""} / ${o.spec || ""} (${o.id})` }))
  ).slice(0, 20) : [];
  const t = sel ? amgTrace(sel.kind, sel.id, d) : null;
  const issues = amgIntegrity(d);
  const sec = (title, items, fn) => rkh("div", { style: { marginBottom: 12 } }, rkh("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 4 } }, `${title} (${items.length})`),
    items.length ? items.slice(0, 30).map((x, i) => rkh("div", { key: i, style: { fontSize: 12.5, padding: "5px 0", borderBottom: `1px solid ${COLORS.border}` } }, fn(x))) : rkh("div", { style: { fontSize: 12.5, color: COLORS.textDim } }, "Không có."));
  const inp = { background: COLORS.bgInset, border: `1.5px solid ${COLORS.borderLight}`, borderRadius: 8, color: COLORS.text, padding: "9px 12px", fontSize: 13.5, width: "100%", maxWidth: 420 };
  return rkh(PageFrame, {
    eyebrow: "Truy xuất", title: "Truy xuất & toàn vẹn dữ liệu", subtitle: "Từ một lô hoặc một đơn hàng, xem toàn bộ chuỗi liên quan; kiểm tra tham chiếu sai", icon: Search,
    guide: ["Nhập số lô, tên vật liệu, mã đơn hoặc khách hàng rồi chọn kết quả.", "Từ lô: phiếu kiểm, phiếu NG, nhập/xuất và các đơn đã dùng lô.", "Từ đơn: lô đã xuất, kiểm tra, NG, kế hoạch và sản lượng.", "Tab “Toàn vẹn dữ liệu” liệt kê bản ghi tham chiếu sai (không tự sửa, chỉ báo)."]
  }, rkh(SectionTabs, { sections: [
    { key: "trace", label: "Truy xuất", render: () => rkh("div", null,
      rkh("input", { value: q, onChange: e => { setQ(e.target.value); setSel(null); }, placeholder: "Số lô, vật liệu, mã đơn, khách hàng…", "aria-label": "Tìm truy xuất", style: inp }),
      term && !sel && rkh("div", { style: { margin: "10px 0" } }, hits.length ? hits.map(h => rkh("div", { key: h.kind + h.id, style: { padding: "6px 0" } }, rkh(Button, { variant: "ghost", onClick: () => setSel(h) }, h.label))) : rkh("div", { style: { color: COLORS.textDim, fontSize: 13 } }, "Không tìm thấy.")),
      t && rkh("div", { style: { marginTop: 14 } },
        rkh("div", { style: { fontWeight: 700, marginBottom: 8 } }, t.kind === "lot" ? "Chuỗi truy xuất từ lô" : "Chuỗi truy xuất từ đơn hàng"),
        sec("Lô nguyên liệu", t.lots, l => `${l.lotNo || l.id} – ${l.material || ""} · ${l.supplier || ""} · ${(LOT_STATUS[l.status] || {}).label || ""}`),
        sec("Đơn hàng", t.orders, o => `${o.customer || ""} / ${o.spec || ""} (${o.id})`),
        sec("Nhập/xuất", t.moves, m => `${amgFmtDate(m.date)} · ${m.type === "nhap" ? "Nhập" : "Xuất"} ${m.qty}${m.orderId ? " → " + m.orderId : ""}`),
        sec("Phiếu kiểm tra", t.inspections, i => `${i.id} · ${i.type} · ${amgFmtDate(i.date)} · ${i.result === "dat" ? "Đạt" : "NG"}`),
        sec("Phiếu NG", t.ncr, n => `${n.id} · ${n.defect || ""} · ${(NCR_STATUS[n.status] || {}).label || ""}`),
        t.kind === "order" && sec("Kế hoạch", t.plans, p => `${amgFmtDate(p.date)} · ${p.machineId || ""} · ${p.targetQty}`),
        t.kind === "order" && sec("Lượt nhập sản lượng", t.production, a => `${amgFmtDate(a.date)} · ${(STAGE_MAP[a.stageKey] || {}).label || ""} · ${a.qty}`))) },
    { key: "int", label: `Toàn vẹn dữ liệu (${issues.length})`, render: () => rkh(RecordList, { title: "Vấn đề phát hiện", rows: issues, searchKeys: ["msg", "rid", "col"], exportName: "toan-ven-du-lieu", emptyTitle: "Không phát hiện vấn đề", emptyHint: "Mọi tham chiếu giữa các phân hệ đều hợp lệ.",
      columns: [{ key: "col", label: "Phân hệ" }, { key: "rid", label: "Mã" }, { key: "msg", label: "Vấn đề" }, { key: "go", label: "", sortable: false, noExport: true, render: r => rkh(Button, { variant: "ghost", onClick: () => onNavigate && onNavigate(r.tab) }, "Mở") }] }) }
  ] }));
}
