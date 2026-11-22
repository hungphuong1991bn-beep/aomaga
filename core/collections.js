/* ===================== BỘ DỮ LIỆU MỚI (v45, chỉ thêm, không đổi bộ cũ) =====================
   col → { mod: phân hệ trong ma trận quyền, prefix: tiền tố mã bản ghi, label: tên tiếng Việt } */
const AMG_COLLECTIONS = {
  lots:        { mod: "kho",      prefix: "LOT", label: "Lô nguyên liệu" },
  stockMoves:  { mod: "kho",      prefix: "PNX", label: "Phiếu nhập/xuất kho" },
  inspections: { mod: "qc",       prefix: "KT",  label: "Phiếu kiểm tra chất lượng" },
  ncr:         { mod: "qc",       prefix: "NG",  label: "Phiếu NG" },
  machineProfiles: { mod: "may",  prefix: "HM",  label: "Hồ sơ máy" },
  checklists:  { mod: "may",      prefix: "CL",  label: "Checklist đầu ca" },
  maintenance: { mod: "dung",     prefix: "BT",  label: "Phiếu bảo trì / sửa chữa" },
  plans:       { mod: "dieuhanh", prefix: "KH",  label: "Kế hoạch sản xuất" },
  handovers:   { mod: "dieuhanh", prefix: "BG",  label: "Biên bản bàn giao ca" },
  training:    { mod: "nhansu",   prefix: "DT",  label: "Đào tạo / đánh giá kỹ năng" },
  overtime:    { mod: "nhansu",   prefix: "TC",  label: "Tăng ca" },
  documents:   { mod: "tailieu",  prefix: "TL",  label: "Tài liệu" }
};
