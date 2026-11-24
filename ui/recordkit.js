/* ===================== BỘ THÀNH PHẦN CHO PHÂN HỆ MỚI (v45) =====================
   Khuôn chung cho mọi tab: chỉ số, danh sách có tìm kiếm/lọc/sắp xếp, trang chi tiết nhiều tab,
   form có kiểm tra dữ liệu, lịch sử thao tác, xuất Excel / In-PDF, hướng dẫn ngắn. */
const rkh = React.createElement;

function amgFmtDate(s) {
  if (!s) return "—";
  const d = String(s).slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : String(s);
}
function amgFmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${amgFmtDate(amgTodayKey(d))}`;
}
function amgExportExcel(filename, columns, rows, sheetName) {
  const data = rows.map(r => {
    const o = {};
    columns.forEach(c => { o[c.label] = c.export ? c.export(r) : r[c.key]; });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (sheetName || "Dữ liệu").slice(0, 28));
  XLSX.writeFile(wb, filename + ".xlsx");
}

// v48: Excel nhiều sheet — sheets = [{ name, columns:[{label, key|export}], rows }]
function amgExportExcelMulti(filename, sheets) {
  const wb = XLSX.utils.book_new();
  const used = {};
  sheets.forEach((sh, i) => {
    const data = sh.rows.map(r => { const o = {}; sh.columns.forEach(c => { o[c.label] = c.export ? c.export(r) : r[c.key]; }); return o; });
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [Object.fromEntries(sh.columns.map(c => [c.label, ""]))]);
    let nm = String(sh.name || "Sheet" + (i + 1)).replace(/[\\/?*\[\]:]/g, " ").slice(0, 28) || "Sheet" + (i + 1);
    if (used[nm]) nm = nm.slice(0, 25) + "_" + (i + 1);
    used[nm] = true;
    XLSX.utils.book_append_sheet(wb, ws, nm);
  });
  XLSX.writeFile(wb, filename + ".xlsx");
}
function amgEsc(v) { return String(v === null || v === undefined ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
// v48: In báo cáo — dựng HTML độc lập trong iframe ẩn rồi gọi print (không bị chặn popup, không in lẫn giao diện ứng dụng)
function amgPrintHtml(title, bodyHtml) {
  const css = "body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:18px;}h1{font-size:18px;margin:0 0 4px;}h2{font-size:13.5px;margin:16px 0 6px;border-bottom:1px solid #333;padding-bottom:3px;}table{border-collapse:collapse;width:100%;margin-bottom:6px;}th,td{border:1px solid #888;padding:4px 6px;text-align:left;vertical-align:top;}th{background:#eee;}.kv{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 14px;margin:8px 0;}.kv b{display:block;font-size:10px;color:#555;text-transform:uppercase;}.warn{border:1px solid #b45309;background:#fff7ed;padding:6px 8px;margin:6px 0;}.sig{display:flex;justify-content:space-around;margin-top:40px;text-align:center;}@media print{body{margin:8mm;}}";
  const html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + amgEsc(title) + "</title><style>" + css + "</style></head><body>" + bodyHtml + "</body></html>";
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* trình duyệt chặn in */ } setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 4000); }, 250);
  return html;
}

/* ---------- Hướng dẫn ngắn (thu gọn) ---------- */
function GuideBox({ title = "Hướng dẫn sử dụng", steps }) {
  const [open, setOpen] = useState(false);
  return rkh("div", { className: "mes-no-print", style: { marginBottom: 14 } },
    rkh("button", { onClick: () => setOpen(o => !o), style: { background: "transparent", border: "none", color: COLORS.blue, fontSize: FZ(13), fontWeight: 600, cursor: "pointer", padding: 0 } }, (open ? "▾ " : "▸ ") + title),
    open && rkh("ol", { style: { margin: "8px 0 0", paddingLeft: 20, fontSize: FZ(13), color: COLORS.textDim, lineHeight: 1.7 } }, steps.map((s, i) => rkh("li", { key: i }, s))));
}

/* ---------- Thẻ chỉ số ---------- */
function KpiRow({ tiles }) {
  const TONE = { ok: COLORS.green, warn: COLORS.amber, err: COLORS.copper, info: COLORS.blue, none: COLORS.textFaint };
  return rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12, marginBottom: 16 } },
    tiles.map(t => rkh(StatCard, { key: t.label, icon: t.icon || ClipboardList, label: t.label, value: t.value, sub: t.sub, accent: TONE[t.tone || "none"] })));
}

/* ---------- Danh sách có tìm kiếm, lọc, sắp xếp, xuất ---------- */
function RecordList({ title, rows, columns, searchKeys, filters, onRowClick, exportName, emptyTitle, emptyHint, defaultSort, actions }) {
  const [q, setQ] = useState("");
  const [fv, setFv] = useState({});
  const [sort, setSort] = useState(defaultSort || null); // { key, dir }
  const [shown, setShown] = useState(100); // phân trang kiểu "xem thêm" cho danh sách dài; xuất Excel vẫn lấy đủ toàn bộ
  const list = useMemo(() => {
    let r = rows.filter(row => {
      if (q) {
        const t = q.toLowerCase();
        if (!(searchKeys || []).some(k => String(typeof k === "function" ? k(row) : row[k] ?? "").toLowerCase().includes(t))) return false;
      }
      return (filters || []).every(f => !fv[f.key] || (f.get ? f.get(row) : row[f.key]) === fv[f.key]);
    });
    if (sort) {
      const col = columns.find(c => c.key === sort.key);
      const val = x => (col && col.sortValue ? col.sortValue(x) : x[sort.key]);
      r = [...r].sort((a, b) => {
        const A = val(a), B = val(b);
        if (A === B) return 0;
        return (A > B ? 1 : -1) * (sort.dir === "asc" ? 1 : -1);
      });
    }
    return r;
  }, [rows, q, fv, sort]);
  const input = { background: COLORS.bgInset, border: `1px solid ${COLORS.borderLight}`, borderRadius: 8, color: COLORS.text, padding: "8px 10px", fontSize: FZ(13) };
  return rkh("div", { className: "mes-card", style: { padding: 14, marginBottom: 16 } },
    rkh("div", { className: "mes-no-print", style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 } },
      title && rkh("div", { style: { fontWeight: 700, fontSize: FZ(14), marginRight: 8, color: COLORS.text } }, `${title} (${list.length})`),
      rkh("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "Tìm kiếm...", "aria-label": "Tìm kiếm", style: { ...input, flex: "1 1 180px", minWidth: 140 } }),
      (filters || []).map(f => rkh("select", { key: f.key, "aria-label": f.label, value: fv[f.key] || "", onChange: e => setFv(Object.assign({}, fv, { [f.key]: e.target.value })), style: input },
        rkh("option", { value: "" }, `${f.label}: tất cả`), f.options.map(o => rkh("option", { key: o.value, value: o.value }, o.label)))),
      actions,
      exportName && rkh(Button, { variant: "ghost", onClick: () => amgExportExcel(exportName, columns.filter(c => !c.noExport), list, title) }, "Xuất Excel"),
      exportName && rkh(Button, { variant: "ghost", onClick: () => window.print() }, "In / PDF")),
    list.length === 0
      ? rkh(EmptyState, { icon: ClipboardList, title: rows.length === 0 ? (emptyTitle || "Chưa có dữ liệu") : "Không có kết quả phù hợp", hint: rows.length === 0 ? emptyHint : "Thử đổi từ khóa hoặc bộ lọc." })
      : rkh(React.Fragment, null, rkh("div", { className: "mes-scroll-x" },
        rkh("table", { className: "mes-table" },
          rkh("thead", null, rkh("tr", null, columns.map(c => rkh("th", { key: c.key, style: { textAlign: c.align || "left", cursor: c.sortable === false ? "default" : "pointer", whiteSpace: "nowrap" }, onClick: () => c.sortable === false ? null : setSort(s => s && s.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }) }, c.label, sort && sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : "")))),
          rkh("tbody", null, list.slice(0, shown).map(r => rkh("tr", { key: r.id, onClick: onRowClick ? () => onRowClick(r) : undefined, style: { cursor: onRowClick ? "pointer" : "default" } },
            columns.map(c => rkh("td", { key: c.key, style: { textAlign: c.align || "left" } }, c.render ? c.render(r) : (r[c.key] ?? "—")))))))),
        list.length > shown && rkh("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "12px 0 2px" } }, rkh("span", { style: { fontSize: FZ(13), color: COLORS.textDim } }, `Đang hiển thị ${shown}/${list.length} dòng`), rkh(Button, { variant: "ghost", onClick: () => setShown(n => n + 100) }, "Xem thêm 100 dòng")))
  );
}

/* ---------- Ảnh: nén về ~800px JPEG trước khi lưu ---------- */
function amgReadImage(file, maxSide = 800, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Không đọc được ảnh"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Tệp không phải ảnh hợp lệ"));
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- Form có kiểm tra dữ liệu ---------- */
function FormModal({ title, fields, initial, onSave, onClose, width = 620, submitLabel = "Lưu", readOnly }) {
  const [vals, setVals] = useState(() => { const v = Object.assign({}, initial || {}); fields.forEach(f => { if (v[f.key] === undefined && f.default !== undefined) v[f.key] = typeof f.default === "function" ? f.default() : f.default; }); return v; });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState("");
  const set = (k, v) => setVals(p => Object.assign({}, p, { [k]: v }));
  async function submit(e) {
    if (e) e.preventDefault();
    const er = amgValidate(fields, vals);
    setErrs(er);
    if (Object.keys(er).length) { setTop("Còn " + Object.keys(er).length + " mục chưa hợp lệ, xem các dòng báo đỏ."); return; }
    setTop(""); setBusy(true);
    try { await onSave(vals); } catch (x) { setTop((x && x.message) || "Không lưu được. Vui lòng thử lại."); setBusy(false); }
  }
  const input = { width: "100%", background: COLORS.bgInset, border: `1px solid ${COLORS.borderLight}`, borderRadius: 8, color: COLORS.text, padding: "9px 10px", fontSize: FZ(14), fontFamily: "inherit" };
  function control(f) {
    const v = vals[f.key] ?? "";
    const dis = readOnly || f.readOnly;
    if (f.type === "select") {
      const opts = typeof f.options === "function" ? f.options(vals) : f.options;
      return rkh("select", { value: v, disabled: dis, onChange: e => set(f.key, e.target.value), style: input }, rkh("option", { value: "" }, "— Chọn —"), opts.map(o => rkh("option", { key: o.value, value: o.value }, o.label)));
    }
    if (f.type === "textarea") return rkh("textarea", { value: v, disabled: dis, rows: 3, onChange: e => set(f.key, e.target.value), style: Object.assign({}, input, { resize: "vertical" }) });
    if (f.type === "checkbox") return rkh("label", { style: { display: "flex", gap: 8, alignItems: "center", fontSize: FZ(13) } }, rkh("input", { type: "checkbox", checked: !!vals[f.key], disabled: dis, onChange: e => set(f.key, e.target.checked) }), f.checkLabel || "Có");
    if (f.type === "images") {
      const imgs = vals[f.key] || [];
      return rkh("div", null,
        rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 } }, imgs.map((src, i) => rkh("div", { key: i, style: { position: "relative" } },
          rkh("img", { src, alt: "Ảnh " + (i + 1), style: { width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: `1px solid ${COLORS.border}` } }),
          !dis && rkh("button", { type: "button", onClick: () => set(f.key, imgs.filter((_, j) => j !== i)), "aria-label": "Xóa ảnh", style: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: "none", background: COLORS.copper, color: "#fff", cursor: "pointer", fontSize: FZ(12) } }, "×")))),
        !dis && imgs.length < (f.max || 3) && rkh("input", { type: "file", accept: "image/*", onChange: async e => { const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return; try { set(f.key, imgs.concat(await amgReadImage(file))); } catch (x) { setErrs(p => Object.assign({}, p, { [f.key]: x.message })); } } }));
    }
    return rkh("input", { type: f.type === "number" ? "number" : f.type === "date" ? "date" : "text", step: f.step, min: f.min, max: f.max, value: v, disabled: dis, placeholder: f.placeholder, onChange: e => set(f.key, e.target.value), style: input });
  }
  return rkh(Modal, { title, onClose, width },
    rkh("form", { onSubmit: submit, noValidate: true },
      rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0 14px" } },
        fields.filter(f => !f.visible || f.visible(vals)).map(f => rkh("div", { key: f.key, style: { gridColumn: f.wide ? "1 / -1" : "auto" } },
          rkh(Field, { label: (f.label || f.key) + (f.required ? " *" : "") }, control(f)),
          f.help && !errs[f.key] && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginTop: -8, marginBottom: 10 } }, f.help),
          errs[f.key] && rkh("div", { role: "alert", style: { fontSize: FZ(12), color: COLORS.copper, marginTop: -8, marginBottom: 10 } }, errs[f.key])))),
      top && rkh("div", { role: "alert", style: { color: COLORS.copper, fontSize: FZ(13), marginBottom: 10 } }, top),
      rkh("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 } },
        rkh(Button, { variant: "ghost", onClick: onClose }, readOnly ? "Đóng" : "Hủy"),
        !readOnly && rkh(Button, { type: "submit", disabled: busy }, busy ? "Đang lưu..." : submitLabel))));
}

/* ---------- Tab chi tiết ---------- */
function DetailTabs({ tabs, active, onChange }) {
  return rkh("div", { role: "tablist", className: "mes-no-print", style: { display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 } },
    tabs.map(t => rkh("button", { key: t.key, role: "tab", "aria-selected": active === t.key, onClick: () => onChange(t.key), style: { padding: "8px 12px", fontSize: FZ(13), fontWeight: 600, border: "none", background: "transparent", cursor: "pointer", color: active === t.key ? COLORS.copper : COLORS.textDim, borderBottom: `2px solid ${active === t.key ? COLORS.copper : "transparent"}`, marginBottom: -1 } }, t.label)));
}

/* ---------- Lịch sử thao tác của một bản ghi (đọc từ nhật ký chung) ---------- */
function HistoryList({ auditLog, targetId, extraIds }) {
  const ids = [targetId].concat(extraIds || []);
  const items = (auditLog || []).filter(a => ids.includes(a.targetId) && String(a.type || "").startsWith("record_")).slice(0, 50);
  if (items.length === 0) return rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Chưa có lịch sử thao tác.");
  return rkh("div", null, items.map(a => rkh("div", { key: a.id, style: { padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13) } },
    rkh("div", { style: { color: COLORS.text } }, a.detail), rkh("div", { style: { color: COLORS.textFaint, fontSize: FZ(12) } }, `${a.user || ""} · ${amgFmtDateTime(a.ts && a.ts.toMillis ? a.ts.toMillis() : a.ts)}`))));
}

/* ---------- Khung trang chuẩn ---------- */
function PageFrame({ eyebrow, title, subtitle, icon, iconColor, action, guide, children }) {
  return rkh("div", { className: "mes-fade-in" },
    rkh(SectionHeading, { eyebrow, title, subtitle, icon, iconColor, action }),
    guide && rkh(GuideBox, { steps: guide }),
    children);
}
function StatusPill({ map, value }) {
  const m = map[value] || { label: value || "—", color: COLORS.textFaint };
  return rkh(Badge, { color: m.color }, m.label);
}
