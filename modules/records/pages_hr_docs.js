/* ===================== ĐÀO TẠO / TĂNG CA / TÀI LIỆU (v45) ===================== */

const OT_STATUS = {
  cho_duyet: { label: "Chờ duyệt", get color() { return COLORS.amber; } },
  da_duyet: { label: "Đã duyệt", get color() { return COLORS.green; } },
  tu_choi: { label: "Từ chối", get color() { return COLORS.copper; } }
};
const DOC_STATUS = {
  nhap: { label: "Bản nháp", get color() { return COLORS.textFaint; } },
  cho_duyet: { label: "Chờ phê duyệt", get color() { return COLORS.amber; } },
  da_duyet: { label: "Đã phê duyệt", get color() { return COLORS.green; } },
  het_hieu_luc: { label: "Hết hiệu lực", get color() { return COLORS.copper; } }
};
const DOC_CATS = ["ISO", "UL", "RoHS", "SOP", "Tiêu chuẩn", "Hướng dẫn kiểm tra", "Khác"].map(v => ({ value: v, label: v }));

function TrainingPage({ extra, staff, auditLog, currentUser }) {
  const tr = extra.training || [], ot = extra.overtime || [];
  const today = amgTodayKey();
  const sOpts = amgOpts(staff, s => s.id, s => `${s.name} (${s.team || ""})`);
  const sName = id => (staff.find(s => s.id === id) || {}).name || id || "—";
  const ctx = { staff };
  const trCfg = {
    col: "training", mod: "nhansu", label: "Đào tạo / đánh giá kỹ năng", title: "Đào tạo & kỹ năng", addLabel: "Ghi nhận", exportName: "dao-tao-ky-nang",
    searchKeys: ["id", "title", "trainer", s => sName(s.staffId)], defaultSort: { key: "date", dir: "desc" }, emptyTitle: "Chưa có hồ sơ đào tạo",
    filters: [{ key: "kind", label: "Loại", options: [{ value: "dao_tao", label: "Đào tạo" }, { value: "danh_gia", label: "Đánh giá kỹ năng" }] }],
    defaults: () => ({ kind: "dao_tao", date: today }),
    fields: () => [
      { key: "staffId", label: "Nhân viên", type: "select", required: true, options: sOpts },
      { key: "kind", label: "Loại", type: "select", required: true, options: [{ value: "dao_tao", label: "Đào tạo" }, { value: "danh_gia", label: "Đánh giá kỹ năng" }] },
      { key: "title", label: "Nội dung / kỹ năng", required: true, maxLen: 120 }, { key: "date", label: "Ngày", type: "date", required: true },
      { key: "trainer", label: "Người đào tạo / đánh giá", maxLen: 60 },
      { key: "level", label: "Mức kỹ năng (1–5)", type: "number", min: 1, max: 5, step: 1, visible: a => a.kind === "danh_gia", required: true },
      { key: "result", label: "Kết quả", type: "select", options: [{ value: "dat", label: "Đạt" }, { value: "chua", label: "Chưa đạt" }] },
      { key: "expiry", label: "Hiệu lực đến", type: "date" }, { key: "note", label: "Ghi chú", type: "textarea", wide: true, maxLen: 300 }
    ],
    show: (f, r) => f.key === "staffId" ? sName(r.staffId) : f.key === "kind" ? (r.kind === "danh_gia" ? "Đánh giá kỹ năng" : "Đào tạo") : f.key === "result" ? (r.result === "dat" ? "Đạt" : r.result === "chua" ? "Chưa đạt" : "—") : amgShowValue(f, r[f.key]),
    columns: [{ key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) }, { key: "staff", label: "Nhân viên", sortValue: r => sName(r.staffId), render: r => sName(r.staffId), export: r => sName(r.staffId) },
      { key: "kind", label: "Loại", render: r => r.kind === "danh_gia" ? "Đánh giá" : "Đào tạo", export: r => r.kind === "danh_gia" ? "Đánh giá" : "Đào tạo" }, { key: "title", label: "Nội dung" }, { key: "level", label: "Mức", align: "right" },
      { key: "result", label: "Kết quả", render: r => r.result ? rkh(Badge, { color: r.result === "dat" ? COLORS.green : COLORS.copper }, r.result === "dat" ? "Đạt" : "Chưa đạt") : "—", export: r => r.result === "dat" ? "Đạt" : r.result === "chua" ? "Chưa đạt" : "" }],
    kpis: rows => [{ label: "Lượt đào tạo / đánh giá", value: rows.length }, { label: "Người đã được đào tạo", value: new Set(rows.map(r => r.staffId)).size }, { label: "Chứng nhận sắp hết hạn (30 ngày)", value: rows.filter(r => r.expiry && r.expiry <= amgTodayKey(new Date(Date.now() + 30 * 864e5))).length, tone: "warn" }]
  };
  const otCfg = {
    col: "overtime", mod: "nhansu", label: "Tăng ca", title: "Đăng ký tăng ca", addLabel: "Đăng ký tăng ca", exportName: "tang-ca",
    status: OT_STATUS, searchKeys: ["id", "reason", s => sName(s.staffId)], defaultSort: { key: "date", dir: "desc" }, emptyTitle: "Chưa có đăng ký tăng ca",
    filters: [{ key: "status", label: "Trạng thái", options: Object.keys(OT_STATUS).map(k => ({ value: k, label: OT_STATUS[k].label })) }],
    defaults: () => ({ date: today, status: "cho_duyet", hours: 2 }),
    fields: () => [
      { key: "staffId", label: "Nhân viên", type: "select", required: true, options: sOpts }, { key: "date", label: "Ngày", type: "date", required: true },
      { key: "hours", label: "Số giờ", type: "number", min: 0.5, max: 12, step: 0.5, required: true },
      { key: "reason", label: "Lý do", required: true, wide: true, maxLen: 200 }
    ],
    show: (f, r) => f.key === "staffId" ? sName(r.staffId) : amgShowValue(f, r[f.key]),
    columns: [{ key: "date", label: "Ngày", render: r => amgFmtDate(r.date), export: r => amgFmtDate(r.date) }, { key: "staff", label: "Nhân viên", sortValue: r => sName(r.staffId), render: r => sName(r.staffId), export: r => sName(r.staffId) },
      { key: "hours", label: "Giờ", align: "right" }, { key: "reason", label: "Lý do" }, { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: OT_STATUS, value: r.status }), export: r => (OT_STATUS[r.status] || {}).label }],
    kpis: rows => { const m = rows.filter(r => r.status === "da_duyet" && String(r.date).slice(0, 7) === today.slice(0, 7)); return [{ label: "Chờ duyệt", value: rows.filter(r => r.status === "cho_duyet").length, tone: rows.some(r => r.status === "cho_duyet") ? "warn" : "none" }, { label: "Giờ tăng ca đã duyệt (tháng)", value: m.length ? m.reduce((s, r) => s + Number(r.hours || 0), 0) : "—", tone: "info" }]; },
    transitions: r => r.status === "cho_duyet" ? [{ label: "Duyệt tăng ca", to: "da_duyet", need: "p" }, { label: "Từ chối", to: "tu_choi", need: "p" }] : []
  };
  return rkh(PageFrame, {
    eyebrow: "Nhân sự", title: "Đào tạo, kỹ năng & tăng ca", subtitle: "Bổ sung cho trang Nhân sự (chấm công, tổ, ca giữ nguyên)", icon: Users,
    guide: ["Ghi nhận lượt đào tạo hoặc đánh giá kỹ năng (mức 1–5) cho từng nhân viên.", "Đăng ký tăng ca: tổ trưởng gửi, người có quyền phê duyệt bấm “Duyệt tăng ca”.", "Chấm công, nghỉ phép, phân tổ/ca vẫn ở trang “Nhân sự”."]
  }, rkh(SectionTabs, { sections: [
    { key: "tr", label: "Đào tạo & kỹ năng", render: () => rkh(RecordSection, { cfg: trCfg, rows: tr, user: currentUser, auditLog, ctx }) },
    { key: "ot", label: "Tăng ca", render: () => rkh(RecordSection, { cfg: otCfg, rows: ot, user: currentUser, auditLog, ctx }) }
  ] }));
}

function DocsPage({ extra, auditLog, currentUser }) {
  const docs = extra.documents || [];
  const today = amgTodayKey();
  const in30 = amgTodayKey(new Date(Date.now() + 30 * 864e5));
  const cfg = {
    col: "documents", mod: "tailieu", label: "Tài liệu", title: "Hồ sơ & tài liệu", addLabel: "Thêm tài liệu", exportName: "ho-so-tai-lieu",
    status: DOC_STATUS, searchKeys: ["code", "title", "owner", "id"], defaultSort: { key: "code", dir: "asc" }, emptyTitle: "Chưa có tài liệu", emptyHint: "Thêm tài liệu ISO/UL/RoHS/SOP/tiêu chuẩn/hướng dẫn kiểm tra. Chứng nhận ISO–UL cũ vẫn ở trang “Chứng nhận ISO - UL”.",
    filters: [{ key: "category", label: "Loại", options: DOC_CATS }, { key: "status", label: "Trạng thái", options: Object.keys(DOC_STATUS).map(k => ({ value: k, label: DOC_STATUS[k].label })) }],
    defaults: (c, u) => ({ status: "nhap", revision: "1.0", owner: (u && u.fullName) || "" }),
    fields: () => [
      { key: "code", label: "Mã tài liệu", required: true, maxLen: 40 }, { key: "title", label: "Tên tài liệu", required: true, wide: true, maxLen: 160 },
      { key: "category", label: "Loại", type: "select", required: true, options: DOC_CATS }, { key: "revision", label: "Phiên bản", required: true, maxLen: 20 },
      { key: "effectiveDate", label: "Ngày hiệu lực", type: "date" }, { key: "expiryDate", label: "Ngày hết hiệu lực", type: "date", validate: (v, a) => a.effectiveDate && v < a.effectiveDate ? "Ngày hết hiệu lực phải sau ngày hiệu lực" : "" },
      { key: "owner", label: "Người phụ trách", maxLen: 60 }, { key: "location", label: "Nơi lưu / đường dẫn", maxLen: 200, wide: true },
      { key: "note", label: "Ghi chú", type: "textarea", wide: true, maxLen: 400 }
    ],
    columns: [{ key: "code", label: "Mã" }, { key: "title", label: "Tên tài liệu" }, { key: "category", label: "Loại" }, { key: "revision", label: "Ver" },
      { key: "expiryDate", label: "Hết hiệu lực", render: r => r.expiryDate ? rkh(Badge, { color: r.expiryDate < today ? COLORS.copper : r.expiryDate <= in30 ? COLORS.amber : COLORS.green }, amgFmtDate(r.expiryDate)) : "—", export: r => amgFmtDate(r.expiryDate) },
      { key: "status", label: "Trạng thái", render: r => rkh(StatusPill, { map: DOC_STATUS, value: r.status }), export: r => (DOC_STATUS[r.status] || {}).label }],
    kpis: rows => [{ label: "Tổng tài liệu", value: rows.length, icon: FileTextIcon }, { label: "Chờ phê duyệt", value: rows.filter(r => r.status === "cho_duyet").length, tone: rows.some(r => r.status === "cho_duyet") ? "warn" : "none" },
      { label: "Sắp / đã hết hiệu lực", value: rows.filter(r => r.status === "da_duyet" && r.expiryDate && r.expiryDate <= in30).length, tone: rows.some(r => r.status === "da_duyet" && r.expiryDate && r.expiryDate <= in30) ? "err" : "none" }],
    transitions: d => [
      d.status === "nhap" ? { label: "Gửi phê duyệt", to: "cho_duyet" } : null,
      d.status === "cho_duyet" ? { label: "Phê duyệt", to: "da_duyet", need: "p", stamp: u => ({ approvedBy: (u && u.fullName) || "", approvedAt: new Date().toISOString() }) } : null,
      d.status === "cho_duyet" ? { label: "Trả về chỉnh sửa", to: "nhap", need: "p" } : null,
      d.status === "da_duyet" ? { label: "Đánh dấu hết hiệu lực", to: "het_hieu_luc", need: "p" } : null
    ].filter(Boolean)
  };
  return rkh(PageFrame, {
    eyebrow: "Tài liệu", title: "Hồ sơ & tài liệu quản lý", subtitle: "ISO · UL · RoHS · SOP · tiêu chuẩn · hướng dẫn kiểm tra, có phê duyệt", icon: FileTextIcon,
    guide: ["Thêm tài liệu ở trạng thái nháp rồi bấm “Gửi phê duyệt”.", "Chỉ người có quyền phê duyệt mới bấm được “Phê duyệt”; mọi bước được lưu trong tab Lịch sử.", "Nhập ngày hết hiệu lực để nhận cảnh báo trước 30 ngày."]
  }, rkh(RecordSection, { cfg, rows: docs, user: currentUser, auditLog, ctx: {} }));
}
