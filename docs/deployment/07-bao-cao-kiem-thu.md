# 7. Báo cáo kiểm thử và vấn đề còn tồn tại

Ngày: 2026-11-27 · Phiên bản đóng gói: 1.0.0 (mã nghiệp vụ web v56).

## 7.1 ĐÃ chạy thực tế
| Hạng mục | Kết quả |
|---|---|
| Bộ kiểm thử nghiệp vụ cũ + mới (accept, accept48/52/55/56, roles, render, 8 bộ e2e) | **Tất cả đạt** (`npm test`) |
| Mã nguồn web (core/data/domain/modules/ui/index.html/sw.js/manifest) so với bản sao lưu trước khi làm | **Không đổi** (chỉ thêm file build) → GitHub Pages/PWA/Service Worker không bị ảnh hưởng |
| `npm run verify` (31 kiểm tra: cấu hình NSIS, Android, quyền, ký APK qua biến môi trường, quét bí mật, workflow, Pages) | 31/31 đạt |
| `actionlint` trên 2 workflow | Sạch lỗi (đã sửa 1 lỗi biểu thức phát hiện được) |
| Cầu nối native Android (jsdom + plugin giả lập): tải file blob, tên tệp, huỷ chia sẻ, nút Quay lại, ẩn splash, không ảnh hưởng Web/Electron | 7/7 đạt |
| Electron chạy thật (Linux, xvfb) từ thư mục và từ `app.asar` đóng gói: nạp qua `app://aomaga`, React/Recharts/xlsx từ bản đóng gói sẵn, localStorage hoạt động, không lỗi console, không lộ Node ra trang web, có CSP | Đạt |
| electron-builder đóng gói Windows (win-unpacked, `app.asar` 5 MB, `app-update.yml` sinh đúng) | Đạt tới bước tạo bộ cài |
| `cap add android` + `cap sync`: sinh được dự án Android hợp lệ, có icon/splash, cấu hình ký bằng biến môi trường | Đạt |

## 7.2 CHƯA kiểm thử được (không có trong môi trường làm việc) — cần xác nhận khi chạy GitHub Actions lần đầu
| Hạng mục | Lý do | Cách xác nhận |
|---|---|---|
| **Bộ cài `.exe` hoàn chỉnh** | Wine trong môi trường làm việc bị lỗi khi chạy stub NSIS (`free(): invalid pointer`); file 187 KB sinh ra là stub, **không dùng** | Job `windows` của GitHub Actions (runner Windows thật) tự build + kiểm tra kích thước + chữ ký |
| Cài đặt/gỡ cài đặt/cài lại trên Windows 10/11, shortcut, chọn thư mục, SmartScreen | Không có Windows | Cài thử theo tài liệu 02 trên 1 máy trước khi triển khai |
| Tự cập nhật Windows end-to-end | Cần 2 Release liên tiếp trên repo thật | Phát hành v1.0.0 rồi v1.0.1, mở app bản 1.0.0 |
| **APK** (build, cài, chạy) | Không có Android SDK/JDK đầy đủ, không truy cập được kho Google/Gradle | Job `android` (có kiểm tra `aapt`: mã gói, versionName, `apksigner`) |
| Chạy trên điện thoại thật: đăng nhập, ghi sản lượng, xuất/tải file, mạng yếu, quay lại, chạy nền, đồng bộ với máy tính | Không có thiết bị | Checklist ở 7.4 |
| Kết nối Firebase thật từ Electron/Android | Môi trường làm việc không truy cập được máy chủ Firebase | Mở app, đăng nhập, xem dữ liệu; ghi thử 1 sản lượng ở Windows, xem trên Android |
| Hiển thị thực tế trên màn hình điện thoại/TV | Không có trình duyệt thật (CSS của Trung tâm điều hành mới chỉ kiểm tra logic, chưa nhìn bằng mắt) | Xem bằng mắt trên Web/Windows/Android |

## 7.3 Vấn đề còn tồn tại / quyết định cần chủ sản phẩm
1. Thông báo đẩy Android **chưa làm** (cần FCM). 2. In/PDF trên Android không hỗ trợ. 3. Bản Windows chưa ký số (cảnh báo SmartScreen) cho tới khi có chứng thư. 4. Chưa có keystore Android → build debug thử nghiệm. 5. Tự cập nhật Windows cần repo/Releases công khai. 6. Quy tắc Firebase Database cần rà soát (xem 01). 7. Số máy trong source là 160 (không phải 163) — xem docs/NANG_CAP_V56. 8. Font Google vẫn cần mạng (có font dự phòng).

## 7.4 Checklist nghiệm thu trên thiết bị thật
**Windows:** cài EXE → mở → đăng nhập → mở các tab → Kế hoạch sản xuất/Giám sát máy → ghi sản lượng → xuất Excel (hộp thoại Lưu) → ngắt mạng (thanh "Mất kết nối") → nối lại (tự đồng bộ) → đóng khi còn dữ liệu chưa gửi (có hỏi) → gỡ → cài lại (dữ liệu cục bộ còn).
**Android:** cài APK → đăng nhập → chọn nhóm máy → ghi sản lượng → xuất Excel (hộp thoại Chia sẻ) → Quay lại (đóng hộp thoại / thu nhỏ) → chuyển app khác rồi quay lại (giữ nguyên) → bật chế độ máy bay (cảnh báo mất kết nối) → bật lại → đối chiếu dữ liệu với máy tính.
**Web:** mở GitHub Pages → PWA vẫn cài được → Service Worker không báo lỗi phiên bản.
