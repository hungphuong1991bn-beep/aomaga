# Triển khai & hoàn tác (v45)

## Trước khi triển khai
1. Trang Quản trị → Sao lưu toàn bộ dữ liệu (tải file JSON, giữ lại).
2. Giữ nguyên bản v44 (thư mục aomaga_backup_v44) để hoàn tác.

## Triển khai
1. Chép toàn bộ thư mục v45 lên hosting hiện tại, ghi đè (không đụng Firebase, không đổi cấu hình).
2. Mở ứng dụng, tải lại cứng (Ctrl+F5) một lần để Service Worker nhận bản mới (đã đổi tham số ?v=45 và danh sách cache).
3. Đăng nhập admin, kiểm tra: đơn hàng cũ còn nguyên, nhập sản lượng thử một lượt, mở từng mục menu mới.

## Hoàn tác (không mất dữ liệu)
- Chép lại bản v44 lên hosting, tải lại cứng. Dữ liệu cũ không bị ảnh hưởng. Các collection mới (lots, inspections, ncr…) vẫn nằm trong Firestore, bản v44 không đọc đến; khi lên lại v45 sẽ hiện lại.
- Trường mới trên đơn hàng (deliveryDate, bom, deliveries) bị bản v44 bỏ qua nhưng không bị xóa.

## Danh sách kiểm tra sau triển khai
- Đăng nhập được cả 11 tài khoản; mỗi vai trò thấy đúng menu.
- Thử: tạo lô → lập phiếu IQC NG → có phiếu NG, lô chuyển Cách ly → đóng phiếu NG bằng tài khoản có quyền phê duyệt.
- Kiểm tra trên điện thoại và màn TV.
