# Nâng cấp v46 — Đơn hàng · Kế hoạch sản xuất · Thẻ máy · Đơn hoàn thành

## 1. Trước khi triển khai (bắt buộc)
1. Giữ nguyên `aomaga_v45.zip` (bản gốc) để khôi phục mã.
2. Đăng nhập admin → Quản trị → Sao lưu dữ liệu (tải JSON). Bản v46 đã thêm 2 bộ dữ liệu mới vào sao lưu.
3. Triển khai thử trên dự án Firebase thử nghiệm, kiểm tra với 2 trình duyệt cùng lúc, rồi mới lên bản thật.
4. Khôi phục: đưa lại mã v45. Dữ liệu cũ KHÔNG bị đổi cấu trúc nên v45 đọc được; các trường mới (routing, priority, status, stageComplete, ...) được v45 bỏ qua.

## 2. Danh sách file
Mới: `domain/flow.js`, `data/flowdata.js`, `modules/orders/ordersboard.js`, `modules/orders/completed.js`, `modules/plan/plan.js`, `modules/plan/plan_modals.js`, `docs/kiem-thu/*`.
Sửa: `domain/stages.js` (getApplicableStages nhận order.routing), `domain/constants.js` (tên tab + tab mới), `modules/app/appinner.js` (nối hook/tab; ghi sản lượng và sửa đơn bằng giao dịch), `modules/orders/orders.js` (bỏ OrderForm/OrderModal/OrdersPage cũ), `modules/orders/orderdetail.js` (quy trình, ưu tiên, tab Máy & lệnh), `index.html`, `sw.js`, `core/backup.js`, `core/security.js` (phiên bản), `docs/firestore.rules` (soạn sẵn, chưa áp dụng).

## 3. Cấu trúc dữ liệu
**orders** (thêm trường tùy chọn, đơn cũ không cần migrate): `routing[]` (stage key theo thứ tự), `routingConfirmed`, `priority` (urgent|high|normal|low), `note`, `deliveryDate` (đã có), `status` ("completed"|"reopened"), `completedAt/By/Mode/Note/Short`, `stageComplete{key:{at,by,short,reason}}`, `statusHistory[]`, `productionStartedAt`. Sản lượng vẫn ở `stages[key].done`; `finishedDone` = công đoạn cuối của quy trình.
**productionRuns** (lệnh = liên kết đơn–máy–công đoạn): `orderId, machineId, stageKey, plannedQuantity, producedQuantity, assignedAt, assignedBy, productionStatus (assigned|running|paused|completed|cancelled), shift, operator, team, startedAt, endedAt, pauses[], snapshot` (snapshot chỉ ghi khi kết thúc lệnh, để lịch sử còn đọc được nếu đơn bị xóa).
**productionEntries**: từng lượt sản lượng, id = `ENT-<khóa chống trùng>`; cùng id với bản ghi `auditLog` type `production_entry` để báo cáo cũ đọc được.
**machines**: thêm `activeRunId`, `lastRunId` (khóa "một máy – một lệnh mở").
Khách hàng/quy cách/nguyên liệu KHÔNG chép vào lệnh; luôn đọc từ orders.

## 4. Kết quả kiểm thử
27/27 kịch bản logic + 17 màn hình/hộp thoại hiển thị không lỗi (xem docs/kiem-thu). Phủ 15 tình huống nghiệm thu.

## 5. Phân quyền mới (3 vai trò) và tài khoản
| Vai trò (role) | Quyền |
|---|---|
| Admin (`admin`) | Toàn quyền, kể cả lập tài khoản và phân quyền |
| Quản đốc (`manager`) | Toàn quyền sử dụng mọi chức năng (thêm/sửa/xóa, xác nhận/mở lại đơn, sửa sản lượng...), TRỪ tab Phân quyền & Quản trị hệ thống (tài khoản) |
| Nhân viên (`employee`) | XEM tất cả các tab (trừ Phân quyền/Quản trị). ĐIỀU KHIỂN Kế hoạch sản xuất (phân đơn vào máy, bắt đầu/tạm dừng/kết thúc lệnh), ghi sản lượng, nhập số liệu ở Tổng quan, cập nhật trạng thái máy. KHÔNG tạo/sửa/xóa đơn, không sửa nhân sự, không xác nhận/mở lại đơn hoàn thành |
Ma trận nằm ở `core/policy.js` (AMG_MATRIX) và hiển thị ở tab Phân quyền. Mọi giá trị role cũ/lạ tự về Nhân viên.
Tài khoản: `modules/admin/accounts.js` (+ userform.js, admin.js, login.js). Tạo tài khoản thật trong Firebase Authentication (ứng dụng phụ nên Admin không bị đăng xuất), hồ sơ ở users/{uid}; không lưu mật khẩu dạng chữ. Đăng nhập Firebase mà không có hồ sơ → bị từ chối. Cột/khối hiển thị mật khẩu đã bỏ.
Gỡ tài khoản tổ cũ (to.keo, to.unhiet, to.mathiec, to.ben, to.boc, to.sanglo, to.qc, to.kho, to.qdoc, to.codien): Quản trị hệ thống → khung màu vàng → "Sao lưu rồi gỡ". Tự tải sao lưu trước. DEFAULT_USERS và nút đăng nhập nhanh theo tổ đã bỏ; chỉ còn admin khởi tạo.
