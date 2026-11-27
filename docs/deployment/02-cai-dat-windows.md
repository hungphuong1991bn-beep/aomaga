# 2. Cài đặt trên Windows 10/11 (64-bit)

1. Vào GitHub → **Releases** → phiên bản mới nhất → tải `AOMAGA-MES-Setup-x64.exe`.
2. Chạy file. Nếu hiện **"Windows đã bảo vệ PC của bạn"** (SmartScreen): bộ cài chưa ký số → bấm **Thông tin thêm → Vẫn chạy**. Cảnh báo này sẽ mất khi công ty mua chứng thư số (tài liệu 04). Không có nghĩa là file bị lỗi, nhưng chỉ tải từ trang Releases chính thức.
3. Chọn thư mục cài đặt (mặc định trong hồ sơ người dùng, không cần quyền Administrator), tick tạo shortcut Desktop/Start Menu.
4. Mở **AOMAGA MES** → màn hình khởi động → đăng nhập như bản Web.

## Dùng hằng ngày
- **F11**: toàn màn hình. Phóng to/thu nhỏ cửa sổ bằng nút thường; menu (nhấn **Alt**): Xem → Phóng to/Thu nhỏ chữ.
- Xuất Excel: hiện hộp thoại Lưu (mặc định thư mục Tài liệu), sau đó có nút **Mở tệp / Mở thư mục**.
- Đóng cửa sổ khi còn thay đổi chưa gửi hoặc đang mở hộp thoại nhập liệu → app **hỏi lại**, không đóng đột ngột.

## Cập nhật
- App tự kiểm tra sau khi mở 20 giây và mỗi 4 giờ, tải ngầm bản mới. Khi tải xong sẽ hỏi: **"Cài khi tôi đóng ứng dụng"** (mặc định) hoặc "Khởi động lại và cài ngay" (có cảnh báo nếu đang nhập liệu). Không bao giờ tự khởi động lại.
- Kiểm tra thủ công: Alt → Trợ giúp → Kiểm tra cập nhật. Dữ liệu người dùng được giữ nguyên.

## Gỡ cài đặt / cài lại
Settings → Apps → AOMAGA MES → Gỡ. Dữ liệu cục bộ trong `%APPDATA%\AOMAGA MES\` **được giữ lại** (dữ liệu chính nằm trên Firebase). Muốn xoá sạch: xoá thư mục đó.
Nhật ký: `%APPDATA%\AOMAGA MES\logs\main.log` (Trợ giúp → Mở thư mục nhật ký).
