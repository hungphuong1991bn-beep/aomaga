# v54 — Bỏ mã đơn ở mọi tab, Admin xóa đơn, làm lại tab Kế hoạch sản xuất

## 1. Bỏ mã đơn
Mã đơn không còn hiện ở bất kỳ tab nào. Đơn được gọi bằng **Khách hàng · Quy cách** (hàm `amgOrderLabel` / `amgOrderLabelById`, core/format.js).
- Form thêm/sửa đơn: bỏ ô "Mã đơn" (id nội bộ tự sinh `ORD-xxxxxxx`, người dùng không nhập, không thấy).
- Đã gỡ ở: Đơn hàng (cột, sắp xếp, tìm kiếm, Excel), Chi tiết đơn, Đơn hoàn thành (bảng, chi tiết, Excel, in), Kế hoạch (bảng, chi tiết, thẻ máy, TV, phân máy, ghi sản lượng, lịch sử máy), Điều hành, Tổng quan, Phiếu kho / Kiểm tra / NG / Kế hoạch ngày, Báo cáo, Truy xuất, Kiểm tra dữ liệu, Cảnh báo, Tìm kiếm toàn hệ thống, nhật ký.
- Id vẫn dùng bên trong để nối lệnh máy / sản lượng / phiếu, nên dữ liệu cũ không bị ảnh hưởng và không cần chuyển đổi.
- Nút "Lập kế hoạch sản xuất" / "Mở kế hoạch" nay mở Kế hoạch đã lọc sẵn đúng đơn (có dòng thông báo + nút "Xóa bộ lọc"), không còn gõ mã vào ô tìm kiếm.

## 2. Xóa đơn (Admin)
- Hộp xác nhận xóa: nêu đơn bằng Khách hàng · Quy cách, bắt buộc **lý do** và **gõ XOA** (trước đây gõ mã đơn).
- Mới: **tab Đơn hàng hoàn thành có nút xóa (biểu tượng thùng rác) chỉ Admin thấy** — xóa kèm lệnh máy, sản lượng; có lý do + nhật ký `order_force_delete`.
- Tầng dữ liệu vẫn kiểm quyền `force_delete` (chỉ Admin), vẫn từ chối khi thiếu lý do. Quản đốc không xóa được.

## 3. Tab Kế hoạch sản xuất — giao diện mới
- 8 cột: Đơn hàng | Số lượng | Quy trình | Tiến độ công đoạn | Máy phụ trách | Ngày giao | Trạng thái | Thao tác.
- Mọi ô tự xuống dòng, **không cắt chữ, không chồng dòng** (đã kiểm tra bằng ảnh chụp ở 1440 / 1000 / 420 px). Tên khách hàng và quy cách dài vẫn hiện đủ.
- Cột Đơn hàng gom: tên khách (đậm) → quy cách → nhãn nguyên liệu + mức ưu tiên (chỉ hiện khi khác "bình thường").
- Cột Số lượng: tổng, Xong, Còn. Ngày giao có nhãn Quá hạn / Còn N ngày. Hàng chẵn tô nhạt, thanh tiêu đề dính khi cuộn.
- Từ 1180px: bảng nhiều cột; hẹp hơn: thẻ gọn có đủ thông tin.

## Kiểm thử
Cập nhật các kịch bản cũ không còn dựa vào mã đơn; thêm V54-1…V54-6 (e2e_completed52.js). Toàn bộ bộ test đạt.

## Triển khai
Chép đè thư mục, mở 2 lần hoặc Ctrl+F5 (cache `mes-v54-bo-ma-don`, tham số `?v=54.0`).
