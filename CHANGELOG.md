# Nhật ký thay đổi AOMAGA MES

Quy ước: mỗi phiên bản là một mục `## [X.Y.Z] - YYYY-MM-DD` với các phần **Chức năng mới / Thay đổi / Lỗi đã sửa**.
Khi phát hành: thêm mục mới lên đầu, rồi tạo tag `vX.Y.Z` (xem docs/deployment/04-phat-hanh-phien-ban-moi.md).

## [1.1.0] - Chưa phát hành (nâng cấp Web v57)
### Chức năng mới
- Tổng quan thành Trung tâm điều hành sản xuất: lời chào theo tên đăng nhập, 10 KPI, tiến độ theo công đoạn, điều hành theo nhóm máy, đơn hàng cần chú ý, biểu đồ hiệu suất (ngày/tuần/tháng/khoảng ngày), cảnh báo và hoạt động gần đây — xem docs/NANG_CAP_V57_TONG_QUAN_TRUNG_TAM_DIEU_HANH.md.
### Thay đổi
- Tổng quan chỉ xem/tổng hợp: gỡ 4 khu nhập liệu trùng (dữ liệu và chức năng nhập ở tab nghiệp vụ giữ nguyên).
### Lỗi đã sửa
- (không có)

## [1.0.0] - 2026-11-27
### Chức năng mới
- Ứng dụng Windows 10/11 64-bit (bộ cài AOMAGA-MES-Setup-x64.exe): cửa sổ riêng, màn hình khởi động, chọn thư mục cài, shortcut Desktop/Start Menu, tự kiểm tra cập nhật từ GitHub Releases (chỉ cài khi người dùng đóng ứng dụng hoặc chủ động chọn).
- Ứng dụng Android (APK, gói vn.aomaga.mes): tải/xuất Excel và sao lưu qua hộp thoại Chia sẻ/Lưu, nút Quay lại đóng hộp thoại rồi thu nhỏ ứng dụng.
- Tự động build và phát hành bằng GitHub Actions khi tạo tag.
- Trung tâm điều hành sản xuất (tab Kế hoạch sản xuất → Giám sát máy móc) — xem docs/NANG_CAP_V56_TRUNG_TAM_DIEU_HANH.md.
### Thay đổi
- Bản Windows/Android đóng gói sẵn thư viện React/Recharts/xlsx (không phụ thuộc CDN lúc khởi động). Bản Web/GitHub Pages không đổi.
### Lỗi đã sửa
- (không có)
