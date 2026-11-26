/* ===================== BÁO CÁO NÂNG CAO (v45) =====================
   Chỉ dùng dữ liệu thật đã có: lượt nhập sản lượng (nhật ký chung), phế liệu, kế hoạch, phiếu kiểm tra, phiếu NG, bảo trì.
   Không có dữ liệu → hiển thị trống / "—", không suy đoán. */

function amgEntryDate(a) { return a.date || ""; }
function amgEntryHour(a) {
  const t = a.ts && a.ts.toDate ? a.ts.toDate() : a.ts ? new Date(a.ts) : null;
  return t && !Number.isNaN(t.getTime()) ? t : null;
}
function amgBucket(date, mode) {
  if (!date) return "—";
  if (mode === "month") return date.slice(0, 7);
  if (mode === "year") return date.slice(0, 4);
  if (mode === "week") {
    const d = new Date(date + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
    return "Tuần từ " + amgTodayKey(d);
  }
  return date;
}
const AMG_TEAM_BY_STAGE = (() => { const m = {}; Object.keys(TEAM_STAGE_OPTIONS).forEach(t => TEAM_STAGE_OPTIONS[t].forEach(s => { m[s] = t; })); return m; })();

function ReportsPlusPage({ auditLog, scrap, extra, machines, orders }) {
  const today = amgTodayKey();
  const [from, setFrom] = useState(amgTodayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(today);
  const [by, setBy] = useState("customer");
  const inRange = d => d && d >= from && d <= to;
  const entries = (auditLog || []).filter(a => a.type === "production_entry" && typeof a.qty === "number" && inRange(a.date));
  const stageLbl = k => (STAGE_MAP[k] || {}).label || k || "—";
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

  const groups = {
    customer: { label: "Khách hàng", key: a => a.customer || "—" }, spec: { label: "Sản phẩm (quy cách)", key: a => a.spec || "—" },
    stage: { label: "Công đoạn", key: a => stageLbl(a.stageKey) }, team: { label: "Tổ (theo công đoạn)", key: a => AMG_TEAM_BY_STAGE[a.stageKey] || "Khác" },
    shift: { label: "Ca (theo giờ nhập)", key: a => { const t = amgEntryHour(a); return t ? amgCurrentShift(t).label : "Không rõ"; } },
    day: { label: "Ngày", key: a => amgBucket(a.date, "day") }, week: { label: "Tuần", key: a => amgBucket(a.date, "week") },
    month: { label: "Tháng", key: a => amgBucket(a.date, "month") }, year: { label: "Năm", key: a => amgBucket(a.date, "year") }
  };
  const g = groups[by];
  const prodRows = (() => { const m = {}; entries.forEach(a => { const k = g.key(a); m[k] = m[k] || { id: k, name: k, qty: 0, count: 0 }; m[k].qty += a.qty; m[k].count++; }); return Object.keys(m).map(k => m[k]); })();
  const maxQ = Math.max(1, ...prodRows.map(r => r.qty));

  // Kế hoạch vs thực tế
  const planRows = (extra.plans || []).filter(p => inRange(p.date) && p.status !== "huy").map(p => {
    const actual = amgActualOutput(auditLog, p.date, p.orderId, p.stage);
    return { id: p.id, date: p.date, machineId: p.machineId, orderId: p.orderId, stage: p.stage, target: Number(p.targetQty) || 0, actual, pct: p.targetQty ? Math.round(actual / p.targetQty * 100) : null };
  });
  const totT = sum(planRows, r => r.target), totA = sum(planRows, r => r.actual);

  // Chất lượng
  const inspR = (extra.inspections || []).filter(i => inRange(i.date));
  const qrows = (() => { const m = {}; inspR.forEach(i => { const k = stageLbl(i.stage === "kiem_cuoi" ? "kiem_cuoi" : i.stage) || "—"; m[k] = m[k] || { id: k, name: i.stage === "kiem_cuoi" ? "Kiểm cuối" : k, total: 0, ng: 0 }; m[k].total++; if (i.result === "ng") m[k].ng++; }); return Object.keys(m).map(k => m[k]); })();
  const scrapR = (scrap || []).filter(s => inRange(s.date));
  const scrapByStage = (() => { const m = {}; scrapR.forEach(s => { const k = stageLbl(s.stage); m[k] = m[k] || { id: k, name: k, qty: 0, n: 0 }; m[k].qty += Number(s.qty) || 0; m[k].n++; }); return Object.keys(m).map(k => m[k]); })();

  // Thiết bị
  const mtR = (extra.maintenance || []).filter(m => inRange(m.date));
  const mrows = (() => { const m = {}; mtR.forEach(x => { const k = x.machineId || "—"; m[k] = m[k] || { id: k, name: k, n: 0, cost: 0, down: 0 }; m[k].n++; m[k].cost += Number(x.cost) || 0; m[k].down += Number(x.downMinutes) || 0; }); return Object.keys(m).map(k => m[k]); })();
  const periodH = Math.max(1, (new Date(to) - new Date(from)) / 3600000 + 24);

  const inp = { background: COLORS.bgInset, border: `1px solid ${COLORS.borderLight}`, borderRadius: 8, color: COLORS.text, padding: "8px 10px", fontSize: FZ(13) };
  const bar = (v, mx, c) => rkh("div", { style: { height: 8, background: COLORS.bgInset, borderRadius: 4, minWidth: 80 } }, rkh("div", { style: { width: Math.round(v / mx * 100) + "%", height: "100%", background: c || COLORS.blue, borderRadius: 4 } }));

  const filterBar = rkh("div", { className: "mes-no-print", style: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 } },
    rkh("label", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Từ ngày "), rkh("input", { type: "date", value: from, onChange: e => setFrom(e.target.value), style: inp }),
    rkh("label", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "đến "), rkh("input", { type: "date", value: to, onChange: e => setTo(e.target.value), style: inp }),
    rkh("span", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, [["today", "Hôm nay"], ["week", "7 ngày"], ["month", "Tháng này"], ["year", "Năm nay"]].map(([k, l]) => rkh(Button, { key: k, variant: "ghost", onClick: () => {
      const n = new Date(); setTo(today);
      setFrom(k === "today" ? today : k === "week" ? amgTodayKey(new Date(n.getTime() - 6 * 864e5)) : k === "month" ? amgTodayKey(new Date(n.getFullYear(), n.getMonth(), 1)) : n.getFullYear() + "-01-01");
    } }, l))));

  const sections = [
    { key: "prod", label: "Sản lượng", render: () => rkh("div", null,
      rkh("div", { className: "mes-no-print", style: { marginBottom: 10 } }, rkh("select", { value: by, onChange: e => setBy(e.target.value), "aria-label": "Nhóm theo", style: inp }, Object.keys(groups).map(k => rkh("option", { key: k, value: k }, "Nhóm theo: " + groups[k].label)))),
      rkh(KpiRow, { tiles: [{ label: "Tổng sản lượng nhập", value: entries.length ? sum(entries, a => a.qty).toLocaleString("vi-VN") : "—", tone: "info" }, { label: "Số lượt nhập", value: entries.length }, { label: "Số nhóm", value: prodRows.length }] }),
      rkh(RecordList, { title: "Sản lượng theo " + g.label.toLowerCase(), rows: prodRows, searchKeys: ["name"], exportName: "bao-cao-san-luong", defaultSort: { key: "qty", dir: "desc" }, emptyTitle: "Không có sản lượng trong kỳ",
        columns: [{ key: "name", label: g.label }, { key: "count", label: "Số lượt", align: "right" }, { key: "qty", label: "Sản lượng", align: "right", render: r => r.qty.toLocaleString("vi-VN"), export: r => r.qty }, { key: "bar", label: "", sortable: false, noExport: true, render: r => bar(r.qty, maxQ) }] })) },
    { key: "plan", label: "Kế hoạch vs thực tế", render: () => rkh("div", null,
      rkh(KpiRow, { tiles: [{ label: "Kế hoạch", value: planRows.length ? totT.toLocaleString("vi-VN") : "—" }, { label: "Thực tế", value: planRows.length ? totA.toLocaleString("vi-VN") : "—", tone: "info" }, { label: "Tỷ lệ đạt kế hoạch", value: totT ? Math.round(totA / totT * 100) + "%" : "—", tone: totT && totA >= totT ? "ok" : totT ? "warn" : "none" }] }),
      rkh(RecordList, { title: "Chi tiết kế hoạch", rows: planRows, searchKeys: ["machineId", "orderId"], exportName: "ke-hoach-thuc-te", defaultSort: { key: "date", dir: "desc" }, emptyTitle: "Chưa có kế hoạch trong kỳ", emptyHint: "Lập kế hoạch ở mục “Điều hành sản xuất”.",
        columns: [{ key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) }, { key: "machineId", label: "Máy" }, { key: "orderId", label: "Đơn hàng", render: r => amgOrderLabelById(r.orderId), export: r => amgOrderLabelById(r.orderId) }, { key: "stage", label: "Công đoạn", render: r => stageLbl(r.stage), export: r => stageLbl(r.stage) },
          { key: "target", label: "Kế hoạch", align: "right" }, { key: "actual", label: "Thực tế", align: "right" }, { key: "pct", label: "Đạt", align: "right", render: r => r.pct === null ? "—" : r.pct + "%", export: r => r.pct === null ? "" : r.pct + "%" }] })) },
    { key: "q", label: "Chất lượng & phế liệu", render: () => rkh("div", null,
      rkh(KpiRow, { tiles: [{ label: "Phiếu kiểm trong kỳ", value: inspR.length }, { label: "Tỷ lệ NG", value: inspR.length ? (inspR.filter(i => i.result === "ng").length / inspR.length * 100).toFixed(1) + "%" : "—", tone: inspR.some(i => i.result === "ng") ? "warn" : "none" }, { label: "Phế liệu trong kỳ", value: scrapR.length ? sum(scrapR, s => s.qty).toLocaleString("vi-VN") : "—", tone: "warn" }] }),
      rkh(RecordList, { title: "Tỷ lệ NG theo công đoạn", rows: qrows, searchKeys: ["name"], exportName: "ty-le-ng", emptyTitle: "Chưa có phiếu kiểm trong kỳ", columns: [{ key: "name", label: "Công đoạn" }, { key: "total", label: "Số phiếu", align: "right" }, { key: "ng", label: "NG", align: "right" }, { key: "rate", label: "Tỷ lệ NG", align: "right", sortValue: r => r.ng / r.total, render: r => (r.ng / r.total * 100).toFixed(1) + "%", export: r => (r.ng / r.total * 100).toFixed(1) + "%" }] }),
      rkh(RecordList, { title: "Phế liệu theo công đoạn", rows: scrapByStage, searchKeys: ["name"], exportName: "phe-lieu", emptyTitle: "Không có phế liệu trong kỳ", columns: [{ key: "name", label: "Công đoạn" }, { key: "n", label: "Số lần", align: "right" }, { key: "qty", label: "Khối lượng", align: "right", render: r => r.qty.toLocaleString("vi-VN"), export: r => r.qty }] })) },
    { key: "eq", label: "Thiết bị", render: () => rkh("div", null,
      rkh(KpiRow, { tiles: [{ label: "Số lần bảo trì / sửa", value: mtR.length }, { label: "Chi phí", value: mtR.length ? sum(mtR, x => x.cost).toLocaleString("vi-VN") : "—" }, { label: "Giờ dừng máy", value: mtR.length ? (sum(mtR, x => x.downMinutes) / 60).toFixed(1) : "—", tone: "warn" }] }),
      rkh(RecordList, { title: "Hiệu suất thiết bị theo máy", rows: mrows, searchKeys: ["name"], exportName: "hieu-suat-thiet-bi", emptyTitle: "Chưa có phiếu bảo trì trong kỳ",
        columns: [{ key: "name", label: "Máy" }, { key: "n", label: "Số lần", align: "right" }, { key: "cost", label: "Chi phí", align: "right", render: r => r.cost.toLocaleString("vi-VN"), export: r => r.cost }, { key: "down", label: "Dừng (giờ)", align: "right", render: r => (r.down / 60).toFixed(1), export: r => (r.down / 60).toFixed(1) },
          { key: "avail", label: "Sẵn sàng*", align: "right", sortValue: r => -r.down, render: r => Math.max(0, (1 - r.down / 60 / periodH) * 100).toFixed(1) + "%", export: r => Math.max(0, (1 - r.down / 60 / periodH) * 100).toFixed(1) + "%" }] }),
      rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint } }, "* Sẵn sàng = 1 − giờ dừng ghi nhận ÷ số giờ lịch của kỳ (chỉ tính từ phiếu bảo trì đã ghi, chưa phải OEE đầy đủ).")) }
  ];

  return rkh(PageFrame, {
    eyebrow: "Báo cáo", title: "Báo cáo nâng cao", subtitle: "Theo khách hàng, sản phẩm, công đoạn, tổ, ca, ngày/tuần/tháng/năm — chỉ từ dữ liệu thật", icon: BarChart3,
    guide: ["Chọn khoảng ngày (hoặc nút nhanh Hôm nay / 7 ngày / Tháng này / Năm nay).", "Tab Sản lượng: đổi “Nhóm theo” để xem theo khách hàng, sản phẩm, công đoạn, tổ, ca, ngày…", "Mỗi bảng có nút Xuất Excel và In / PDF.", "Báo cáo cũ ở mục “Báo cáo & biểu đồ” vẫn giữ nguyên."]
  }, filterBar, rkh(SectionTabs, { sections }));
}
