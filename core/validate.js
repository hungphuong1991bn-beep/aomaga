/* ===================== KIỂM TRA DỮ LIỆU ĐẦU VÀO (v45) =====================
   field: { key, label, type, required, min, max, maxLen, pattern, patternMsg, validate(val, values), visible(values) }
   Trả về { tenTruong: "thông báo tiếng Việt" } — rỗng nếu hợp lệ. */
function amgValidate(fields, values) {
  const errs = {};
  (fields || []).forEach(f => {
    if (f.visible && !f.visible(values)) return;
    const v = values[f.key];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0 && f.type !== "images");
    if (f.required && empty) { errs[f.key] = `Vui lòng nhập ${String(f.label || f.key).toLowerCase()}`; return; }
    if (empty) return;
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) { errs[f.key] = `${f.label} phải là số`; return; }
      if (f.min !== undefined && n < f.min) { errs[f.key] = `${f.label} không được nhỏ hơn ${f.min}`; return; }
      if (f.max !== undefined && n > f.max) { errs[f.key] = `${f.label} không được lớn hơn ${f.max}`; return; }
    }
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) { errs[f.key] = `${f.label} chưa đúng định dạng ngày`; return; }
    if (typeof v === "string") {
      if (f.maxLen && v.length > f.maxLen) { errs[f.key] = `${f.label} tối đa ${f.maxLen} ký tự`; return; }
      if (f.pattern && !new RegExp(f.pattern).test(v)) { errs[f.key] = f.patternMsg || `${f.label} chưa đúng định dạng`; return; }
    }
    if (f.validate) { const m = f.validate(v, values); if (m) errs[f.key] = m; }
  });
  return errs;
}
