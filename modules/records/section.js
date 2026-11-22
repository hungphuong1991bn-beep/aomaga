/* ===================== KHUNG PHÂN HỆ DÙNG CHUNG (v45) =====================
   Một "phần" = KPI + danh sách (tìm kiếm/lọc/xuất) + thêm + chi tiết (2 tab: Chi tiết / Lịch sử)
   + sửa + xóa + chuyển trạng thái (có kiểm quyền phê duyệt). Mọi thao tác ghi đi qua amgSaveRecord/amgDeleteRecord
   nên được cổng ghi kiểm tra quyền, khóa phiên bản và ghi nhật ký chung đúng MỘT lần. */

// Quyền thao tác của người dùng hiện tại (quản trị cũ = toàn quyền)
function amgAllow(user, action, mod) {
  if (!user) return false;
  return amgIsPower(user) || amgCan(user, action, mod);
}

function RecordSection({ cfg, rows, user, auditLog, ctx, readOnly }) {
  const { askConfirm, showAlert } = useDialog();
  const [form, setForm] = useState(null);       // { rec } sửa/thêm
  const [viewId, setViewId] = useState(null);
  const [tab, setTab] = useState("ct");
  const [trans, setTrans] = useState(null);     // { rec, tr } chuyển trạng thái có nhập thêm
  const canAdd = !readOnly && amgAllow(user, "t", cfg.mod);
  const canEdit = !readOnly && amgAllow(user, "s", cfg.mod);
  const canDel = !readOnly && amgAllow(user, "x", cfg.mod);
  const live = viewId ? rows.find(r => r.id === viewId) : null;

  async function persist(rec, detail) {
    try {
      const saved = await amgSaveRecord(cfg.col, rec, user, detail);
      if (cfg.afterSave) { try { await cfg.afterSave(saved, !rec.id, ctx, user, showAlert); } catch (e) { await showAlert("Đã lưu, nhưng bước liên quan chưa thực hiện được: " + (e.message || e)); } }
      return saved;
    } catch (e) { throw e; }
  }
  async function remove(rec) {
    const ok = await askConfirm(`Xóa ${cfg.label.toLowerCase()} ${rec.id}? Thao tác được ghi vào nhật ký.`, { danger: true, confirmLabel: "Xóa" });
    if (!ok) return;
    try { await amgDeleteRecord(cfg.col, rec.id, user); setViewId(null); }
    catch (e) { await showAlert("Không xóa được: " + (e.message || e)); }
  }
  async function doTransition(rec, tr, extra) {
    const next = Object.assign({}, rec, extra || {}, { status: tr.to });
    if (tr.stamp) Object.assign(next, tr.stamp(user));
    try { await persist(next, `${cfg.label} ${rec.id}: ${tr.label}`); setTrans(null); }
    catch (e) { await showAlert("Không thực hiện được: " + (e.message || e)); throw e; }
  }

  const tiles = cfg.kpis ? cfg.kpis(rows, ctx) : [];
  const columns = cfg.columns;
  const fields = cfg.fields;

  return rkh("div", null,
    tiles.length > 0 && rkh(KpiRow, { tiles }),
    rkh(RecordList, {
      title: cfg.title, rows, columns, searchKeys: cfg.searchKeys, filters: cfg.filters, exportName: cfg.exportName,
      defaultSort: cfg.defaultSort, emptyTitle: cfg.emptyTitle, emptyHint: cfg.emptyHint, onRowClick: r => { setTab("ct"); setViewId(r.id); },
      actions: canAdd && rkh(Button, { onClick: () => setForm({ rec: null }) }, "+ " + (cfg.addLabel || "Thêm mới"))
    }),
    form && rkh(FormModal, {
      title: (form.rec ? "Sửa " : "Thêm ") + cfg.label.toLowerCase(), fields: typeof fields === "function" ? fields(ctx, form.rec) : fields,
      initial: form.rec || (cfg.defaults ? cfg.defaults(ctx, user) : {}),
      onClose: () => setForm(null),
      onSave: async vals => {
        const rec = Object.assign({}, form.rec || {}, vals);
        const saved = await persist(rec, cfg.detailText ? cfg.detailText(rec, !form.rec) : undefined);
        setForm(null);
        if (!form.rec) setViewId(saved.id);
      }
    }),
    live && rkh(Modal, { title: `${cfg.label} · ${live.id}`, onClose: () => setViewId(null), width: cfg.detailWidth || 720 },
      rkh(DetailTabs, { tabs: [{ key: "ct", label: "Chi tiết" }].concat((cfg.detailTabs || []).map(t => ({ key: t.key, label: t.label }))).concat([{ key: "ls", label: "Lịch sử" }]), active: tab, onChange: setTab }),
      tab === "ct" && rkh("div", null,
        rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "8px 16px", marginBottom: 12 } },
          (typeof fields === "function" ? fields(ctx, live) : fields).filter(f => f.type !== "images" && (!f.visible || f.visible(live))).map(f => rkh("div", { key: f.key, style: { gridColumn: f.wide ? "1 / -1" : "auto" } },
            rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint } }, f.label || f.key),
            rkh("div", { style: { fontSize: 13.5, color: COLORS.text, whiteSpace: "pre-wrap" } }, cfg.show ? cfg.show(f, live, ctx) : amgShowValue(f, live[f.key]))))),
        (typeof fields === "function" ? fields(ctx, live) : fields).filter(f => f.type === "images" && (live[f.key] || []).length).map(f => rkh("div", { key: f.key, style: { marginBottom: 10 } },
          rkh("div", { style: { fontSize: 11.5, color: COLORS.textFaint, marginBottom: 4 } }, f.label),
          rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, live[f.key].map((src, i) => rkh("img", { key: i, src, alt: f.label + " " + (i + 1), style: { width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: `1px solid ${COLORS.border}` } }))))),
        cfg.status && rkh("div", { style: { marginBottom: 12 } }, rkh(StatusPill, { map: cfg.status, value: live.status })),
        rkh("div", { className: "mes-no-print", style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 } },
          (cfg.transitions ? cfg.transitions(live, ctx) : []).filter(tr => amgAllow(user, tr.need || "s", tr.mod || cfg.mod) && !readOnly).map(tr => rkh(Button, { key: tr.label, onClick: () => tr.fields ? setTrans({ rec: live, tr }) : doTransition(live, tr) }, tr.label)),
          canEdit && rkh(Button, { variant: "ghost", onClick: () => setForm({ rec: live }) }, "Sửa"),
          canDel && rkh(Button, { variant: "danger", onClick: () => remove(live) }, "Xóa"),
          rkh(Button, { variant: "ghost", onClick: () => window.print() }, "In / PDF"))),
      (cfg.detailTabs || []).map(t => tab === t.key && rkh("div", { key: t.key }, t.render(live, ctx, user))),
      tab === "ls" && rkh(HistoryList, { auditLog, targetId: live.id })),
    trans && rkh(FormModal, {
      title: trans.tr.label, fields: trans.tr.fields, initial: trans.rec, submitLabel: "Xác nhận", width: 520,
      onClose: () => setTrans(null),
      onSave: vals => doTransition(trans.rec, trans.tr, vals)
    }));
}

function amgShowValue(f, v) {
  if (v === undefined || v === null || v === "") return "—";
  if (f.type === "date") return amgFmtDate(v);
  if (f.type === "select") { const o = (typeof f.options === "function" ? f.options({}) : f.options || []).find(x => x.value === v); return o ? o.label : String(v); }
  if (f.type === "checkbox") return v ? "Có" : "Không";
  if (f.type === "number") return Number(v).toLocaleString("vi-VN");
  return String(v);
}

/* Trang nhiều phần (tab ngang). sections: [{ key, label, render() }] */
function SectionTabs({ sections, initial }) {
  const [active, setActive] = useState(initial || sections[0].key);
  const cur = sections.find(s => s.key === active) || sections[0];
  return rkh("div", null,
    rkh(DetailTabs, { tabs: sections.map(s => ({ key: s.key, label: s.label })), active: cur.key, onChange: setActive }),
    cur.render());
}

// Danh mục chọn từ dữ liệu có sẵn (đơn hàng, máy, nhân sự...) → options cho form
function amgOpts(list, valueFn, labelFn) {
  return (list || []).map(x => ({ value: valueFn(x), label: labelFn(x) }));
}
const AMG_SHIFT_OPTS = [{ value: "ngay", label: "Ca ngày" }, { value: "dem", label: "Ca đêm" }];
const AMG_SHIFT_LABEL = { ngay: "Ca ngày", dem: "Ca đêm" };
