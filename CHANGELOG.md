# Nhật ký thay đổi AOMAGA MES

Quy ước: mỗi phiên bản là một mục `## [X.Y.Z] - YYYY-MM-DD` với các phần **Chức năng mới / Thay đổi / Lỗi đã sửa**.
Khi phát hành: thêm mục mới lên đầu, rồi tạo tag `vX.Y.Z` (xem docs/deployment/04-phat-hanh-phien-ban-moi.md).

## [1.1.0] - Chưa phát hành (nâng cấp Web v57)
### Chức năng mới
- Tổng quan thành Trung tâm điều hành sản xuất: lời chào theo tên đăng nhập, 10 KPI, tiến độ theo công đoạn, điều hành theo nhóm máy, đơn hàng cần chú ý, biểu đồ hiệu suất (ngày/tuần/tháng/khoảng ngày), cảnh báo và hoạt động gần đây — xem docs/NANG_CAP_V57_TONG_QUAN_TRUNG_TAM_DIEU_HANH.md.
### Nhân sự — giai đoạn 1 (v58)
- Mới: tab "Tổng quan nhân sự" (12 KPI tính từ dữ liệu thật, lọc ngày/tháng/năm, tổ, ca, nhấn KPI xem danh sách), danh sách nhân viên (bảng/thẻ, tìm không dấu, lọc, sắp xếp, tùy chỉnh cột, phân trang, xuất Excel theo bộ lọc), hồ sơ chi tiết dạng drawer (Cá nhân, Công việc, Chấm công, Đào tạo, Lịch sử), biểu mẫu thêm/sửa có kiểm tra dữ liệu và xác nhận trước khi lưu.
- Dữ liệu: chỉ THÊM trường tùy chọn cho nhân viên (phone, email, gender, birthDate, address, position, joinDate, contractType, managerId, avatar); không đổi field/collection/mã cũ.
- Quyền: thông tin cá nhân chỉ hiện cho tài khoản được sửa Nhân sự; tab Lịch sử chỉ cho người có quyền sửa.
- Tệp: modules/hr/hr_people.js (mới), hr.js (gỡ StaffPage cũ), appinner.js (truyền extra/auditLog/currentUser), index.html, sw.js (cache v58), docs/kiem-thu/check_assets.js.

### Nhân sự — giai đoạn 2 (v58): Điểm danh – Chấm công
- Mới: màn "Điểm danh trong ngày" (9 KPI nhấn để lọc, chọn ngày/tổ/ca, tìm kiếm, phân trang, thẻ cảm ứng trên điện thoại, điền nhanh Ca Ngày/Ca Đêm có xác nhận), chi tiết giờ vào/ra + ghi chú, "Báo cáo chấm công" theo ngày/tuần/tháng, theo nhân viên/tổ/ca, xuất Excel theo bộ lọc.
- Dữ liệu: giữ nguyên attendance/{ngày}/{staffId}; chỉ thêm 3 trường tùy chọn note, timeIn, timeOut. Mỗi nhân viên đúng một mục/ngày nên không trùng bản ghi.
- Ghi dữ liệu: đọc-sửa-ghi có điều kiện (ETag) nên hai người điểm danh hai tổ cùng ngày không ghi đè nhau; mọi thay đổi ghi nhật ký (attendance_update). Không đổi cách tính công.
- Lỗi đã sửa (ở giao diện điểm danh mới): ngày mặc định không còn lấy theo giờ UTC (trước 7h sáng hiện nhầm hôm qua); khoảng tuần/tháng không còn lệch 1 ngày ở múi giờ +7. Mã cũ AttendanceSection vẫn còn trong hr.js (dự phòng).
- Tệp: modules/hr/hr_attendance.js (mới), hr_people.js, appinner.js (handleAttendanceMutate), index.html, sw.js.

### Nhân sự — giai đoạn 3 (v58): Nâng cấp Điểm danh – Chấm công và Lịch làm việc
- Điểm danh trong ngày (thiết kế lại): 10 thẻ KPI (tổng nhân viên kèm số người có ca theo lịch, đã/chưa điểm danh, chờ xác nhận, có mặt, đi muộn, về sớm, nghỉ phép, nghỉ không phép, đang tăng ca); bảng STT – Mã NV – Họ tên – Phòng ban/Tổ – Bộ phận – Ca làm – Giờ vào – Giờ ra – Tổng thời gian – Trạng thái – Ghi chú; lọc theo ngày, phòng ban/tổ, bộ phận, ca, tìm kiếm; chuyển nhanh Tất cả / Chưa điểm danh / Đã điểm danh / Chờ xác nhận; điểm danh nhanh bằng 1 chạm, hộp chi tiết sửa trạng thái + giờ + ghi chú; nút “Điền theo lịch làm việc”; xuất Excel theo bộ lọc.
- Trạng thái suy ra từ các cờ đã có, không thêm quy tắc tính công: “Chưa điểm danh” = chưa có cờ/giờ/ghi chú; “Chờ xác nhận” = đã có giờ hoặc ghi chú nhưng chưa chọn trạng thái.
- Báo cáo chấm công: thêm cột Chờ xác nhận, nhóm theo Bộ phận; đổi tên cột theo yêu cầu (Ngày công, Số lần đi muộn/về sớm).
- Lịch làm việc (mới, tab “Lịch làm việc”): chế độ Ngày / Tuần / Tháng; màu + chữ + chú giải (Ca ngày, Ca đêm, Nghỉ phép, Nghỉ lễ, Đổi ca, Tăng ca); phân công theo người / cả tổ / danh sách đang lọc theo khoảng ngày; đổi ca giữa hai người; bố trí nghỉ; sao chép lịch tuần trước; xác nhận lịch; xem lịch từng người; bấm vào ca xem/sửa chi tiết; xuất Excel; có xác nhận trước mọi thay đổi ảnh hưởng lịch.
- Cảnh báo (chỉ khi đủ dữ liệu): chưa xếp ca, mâu thuẫn với điểm danh/tăng ca, thiếu nhân lực (chỉ khi đã cài mức tối thiểu), lịch chưa xác nhận, thay đổi chưa thông báo, tăng ca chưa duyệt.
- Dữ liệu: collection mới `schedule/{ngày}` (+ `schedule/_settings`), chỉ thêm; attendance/staff/overtime giữ nguyên. Ghi có điều kiện (ETag) + nhật ký `schedule_update`; quyền: Admin/Quản đốc hoặc người có quyền sửa Nhân sự; đã thêm vào sao lưu.
- Tệp: modules/hr/hr_schedule.js (mới), hr_attendance.js, hr_people.js, appinner.js (mutateDayDoc dùng chung), core/policy.js, core/runtime.js, core/backup.js, index.html, sw.js (cache gd3).

### Đồng bộ đa thiết bị an toàn dữ liệu (v59)
- Ghi theo từng trường + so sánh 3 chiều khi gửi: hai người sửa hai trường khác nhau không còn ghi đè nhau (kể cả khi offline); cùng một trường → báo xung đột, KHÔNG ghi đè âm thầm; mỗi xung đột có dòng nhật ký `sync_conflict`.
- Hàng đợi offline có mã/người/thiết bị/thời điểm; thao tác máy chủ từ chối (400) được GIỮ LẠI (xem/gửi lại/bỏ) thay vì bị bỏ mất; thêm độ lệch ngẫu nhiên khi thử lại.
- `amgSafeUpdate` dùng ghi có điều kiện (ETag) thay vì "đọc rồi ghi tuần tự" (trước đây có thể mất cập nhật khi hai thiết bị cùng sửa).
- Sửa đơn: chỉ ghi các trường người dùng thực sự sửa; báo xung đột nếu người khác cũng đổi trường đó từ lúc mở biểu mẫu.
- Không còn tự gieo đơn hàng/nhân sự/phế liệu MẪU vào máy chủ dùng chung; khởi tạo (danh mục máy, tài khoản admin đầu tiên) chỉ khi đã xác nhận từ máy chủ và thiết bị chưa có bản lưu.
- Chỉ báo đồng bộ ở header bấm được: chi tiết hàng đợi, xung đột, thao tác bị từ chối, "Đồng bộ lại ngay"; thêm trạng thái "Cần kiểm tra n xung đột".
- Dữ liệu: chỉ THÊM trường dấu vết `v`, `by`, `dev` cạnh `d`/`t`. Tệp: xem docs/NANG_CAP_V59_DONG_BO_AN_TOAN.md (gồm giới hạn còn tồn tại và hướng dẫn kiểm tra thực tế).

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
