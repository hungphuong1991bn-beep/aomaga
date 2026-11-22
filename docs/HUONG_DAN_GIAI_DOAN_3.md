# AOMAGA MES v45 – Giai đoạn 3: nền tảng

## Đã làm
1. Tách `app.js` (13.967 dòng) thành 35 tệp theo chức năng, tải theo thứ tự trong `index.html`. Kết quả tính toán (công đoạn áp dụng, tiến độ, còn lại) trên 37 đơn hàng trùng khớp bản v44.
2. Vá: hai nút "Khôi phục dữ liệu mẫu" không còn xóa/ghi đè (chỉ nhập vào mục đang trống); máy mới nạp có trạng thái "Chưa xác định" thay vì trạng thái bịa; bỏ mật khẩu dạng chữ khỏi mã (còn băm SHA-256 cho đăng nhập dự phòng); nút điền nhanh chỉ điền tên đăng nhập.
3. Cổng ghi dữ liệu (`core/guard.js` + `core/policy.js`): mọi set/update/delete/add, kể cả batch, được kiểm tra quyền; bị từ chối thì không ghi và có dòng nhật ký.
4. Ánh xạ 11 tài khoản không đổi: admin → Quản trị viên; to.qdoc → Quản đốc; to.qc → QA/QC; to.kho → Kho; to.codien → Cơ điện; 6 tổ sản xuất → Tổ trưởng.
5. Nền tảng khóa phiên bản (`amgSafeUpdate`), sao lưu JSON (trang Quản trị), Service Worker mạng-trước và thanh "Có phiên bản mới".

## Triển khai
- Chép toàn bộ thư mục `aomaga_v45` đè lên hosting. Trước đó vào Quản trị > Tải tệp sao lưu.
- Quay lại: chép lại thư mục v44.
- Người dùng đang mở bản cũ sẽ thấy bản mới ở lần mở thứ hai.

## Chưa làm được (cần quyền Firebase Console)
- `docs/firestore.rules` mới là bản soạn sẵn. KHÔNG dán trước khi: (a) xác nhận cách đăng nhập thực tế (mục dưới), (b) thử trong Rules Playground. Dán sai sẽ khóa cả xưởng.
- Cho tới khi áp dụng rules, quyền chỉ được kiểm ở trình duyệt.

## Phát hiện cần anh/chị xác nhận
- Đăng nhập: sau khi Firebase Auth báo thành công, mã gọi `snap.exists()` trong khi Firebase v10 `exists` là thuộc tính, nên rất có thể mọi người đang vào bằng đường dự phòng (11 tài khoản mặc định). Vì vậy `AMG_CONFIG.legacyLogin` phải để `true`; đặt `false` sẽ khóa cả xưởng.
- Tài khoản tạo mới ở trang Quản trị chỉ lưu trong Firestore (kèm mật khẩu dạng chữ), không tạo trong Firebase Auth và không có trong đường đăng nhập dự phòng, nên có thể chưa đăng nhập được. Cần anh/chị kiểm tra thực tế.
- Lượt nhập sản lượng đang lưu chung trong `auditLog` (dữ liệu nghiệp vụ lẫn nhật ký). Sẽ tách ở Giai đoạn 4-5.
- Khóa phiên bản chưa gắn vào từng tab; làm dần ở Giai đoạn 4.

---
# Giai đoạn 4 (đợt 1): giao diện và dashboard theo vai trò

## Đã làm
- Bộ màu navy + đỏ AOMAGA; chế độ sáng/tối (nút mặt trăng/mặt trời ở thanh tiêu đề, lưu theo trình duyệt; màn hình đăng nhập luôn sáng).
- Thanh tiêu đề: tên, chức vụ, tổ, ca hiện tại, chuông cảnh báo (bấm để chuyển tới trang liên quan).
- Dashboard theo vai trò (domain/kpi.js, modules/dashboard/roleoverview.js): Giám đốc, Quản đốc, Tổ trưởng, Nhân viên; kỳ Ngày/Tuần/Tháng/Năm. Quản trị viên có nút "xem như" để duyệt từng vai trò. Thay cho 4 thẻ cũ.
- Máy chưa xác nhận trạng thái hiển thị "chưa xác định", không còn tính là chạy/hỏng.

## Cần xác nhận
- Giờ ca: đang đặt tạm Ca Ngày 06:00-18:00, còn lại là Ca Đêm (core/security.js, AMG_CONFIG.shifts). Ứng dụng hiện chỉ có Ca Ngày / Ca Đêm.
- Đơn hàng chưa có trường "ngày giao" nên chỉ số "sắp đến hạn" hiện là "—". Sẽ có khi bổ sung trường này ở tab Thông tin chung của đơn hàng.
- Chất lượng đạt/NG chưa có dữ liệu vì chưa có phân hệ QA/QC.
- Tài khoản theo tổ dùng chung nên "Nhân viên" cũng thấy phạm vi của tổ; số liệu cá nhân tính theo tên người nhập.
- Dữ liệu mẫu phế liệu (SEED_SCRAP) dùng ngày tương đối so với hôm nay nên luôn trông như mới. Chỉ ảnh hưởng khi nạp mẫu vào mục trống.
