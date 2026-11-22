# Giai đoạn 4 (hoàn tất): các phân hệ doanh nghiệp

Không đổi/xóa dữ liệu cũ. Dữ liệu mới nằm trong các collection riêng, không có dữ liệu mẫu. Mọi thao tác ghi đi qua cổng quyền + khóa phiên bản + nhật ký chung (auditLog, một dòng/thao tác).

## Menu mới (hiện theo quyền chức vụ)
- **Đơn hàng → bấm một đơn**: 7 tab (Thông tin chung, BOM và định mức, Tiến độ công đoạn, Lịch sử sản xuất, Lịch sử chất lượng, Lịch sử chỉnh sửa, Lịch sử giao hàng). Có thêm ô "Ngày giao hàng" → chỉ số/cảnh báo "sắp đến hạn" hoạt động. Quy tắc tính cũ giữ nguyên.
- **Điều hành sản xuất**: theo dõi trực tiếp (ca, máy, kế hoạch/thực tế, việc tiếp theo, nhật ký), kế hoạch ngày/tuần, bàn giao ca, **chế độ TV** (toàn màn hình, chữ lớn, không nút sửa).
- **Kho & nguyên liệu**: lô, nhập/xuất, tồn, cách ly, theo NCC/vị trí, truy xuất (IQC ↔ đơn hàng ↔ nhập/xuất).
- **Kiểm tra QA/QC & NG**: IQC/IPQC/OQC với 6 tiêu chí + ảnh; kết luận NG tự mở phiếu NG và cách ly lô; phiếu NG: Mới → Đang xử lý → Chờ xác nhận → Đóng (cần quyền phê duyệt).
- **Bảo trì & sửa chữa**: phiếu, lịch định kỳ (cảnh báo trước 7 ngày), checklist đầu ca, hồ sơ máy + lịch sử.
- **Đào tạo & tăng ca**: đào tạo, đánh giá kỹ năng 1–5, tăng ca có duyệt.
- **Hồ sơ & tài liệu**: ISO/UL/RoHS/SOP/tiêu chuẩn/hướng dẫn kiểm tra, nháp → chờ duyệt → đã duyệt (lịch sử phê duyệt).
- **Báo cáo nâng cao**: theo khách hàng, sản phẩm, công đoạn, tổ, ca, ngày/tuần/tháng/năm; kế hoạch vs thực tế; NG; phế liệu; thiết bị. Xuất Excel/PDF.
- **Phân quyền & giám sát** (quản trị): ma trận 8 chức vụ × 11 phân hệ, ánh xạ 11 tài khoản, log thao tác bị từ chối.

## Cần xác nhận
- Giờ ca (tạm 06:00–18:00 Ca Ngày).
- Quyền trong ma trận là đề xuất; điều chỉnh ở core/policy.js nếu khác thực tế.
- Áp dụng docs/firestore.rules cần quyền Firebase Console (hiện chưa có) — ứng dụng đã tự chặn ở tầng ghi.
- "Theo tổ" trong báo cáo suy ra từ công đoạn; "theo ca" suy ra từ giờ nhập.
- Sẵn sàng thiết bị chỉ tính từ phiếu bảo trì, chưa phải OEE đầy đủ.
