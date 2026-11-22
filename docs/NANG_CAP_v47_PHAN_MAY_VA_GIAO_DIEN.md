# AOMAGA v47 — Sửa logic phân máy/đồng bộ trạng thái + giao diện Đơn hàng & Kế hoạch

## 1. Báo cáo nguyên nhân (trung thực)
Trên mã nguồn v46 cung cấp, luồng chuẩn (phân đơn → KT-01 → bắt đầu → ghi sản lượng → kết thúc) chạy ĐÚNG trong mô phỏng Firestore đầy đủ; **không tái hiện được nguyên văn triệu chứng "KT-01 trống / vẫn CHƯA PHÂN LỆNH"** bằng dữ liệu sạch. Đã tìm và sửa các lỗi tiềm ẩn có thể gây đúng triệu chứng trên dữ liệu/môi trường thật:
1. Lệnh (productionRuns) cũ thiếu `productionStatus` hoặc dùng `startTime/endTime` → bị coi là không mở → đơn "chưa phân", máy "trống". Nay chuẩn hóa (`amgNormalizeRun`).
2. Lệnh thiếu `orderId/machineId/stageKey` bị tính lẫn lộn. Nay bị loại khỏi tính toán, KHÔNG tự gán máy, hiện trong bảng "Kiểm tra dữ liệu lệnh".
3. Đơn phân loại theo "công đoạn đầu chưa xong" thay vì công đoạn đang có lệnh mở → sai khi có nhiều công đoạn. Nay dùng `amgWorkingStage`.
4. Thẻ máy không phân biệt MÁY TRỐNG / ĐÃ PHÂN MÁY / ĐANG CHẠY; phân máy tự bắt đầu chạy mặc định. Nay mặc định chỉ "ĐÃ PHÂN MÁY", bắt đầu chạy là bước riêng.
5. Bấm nhiều lần/hai người cùng phân: nay kiểm tra lại trong transaction (trùng đơn+công đoạn+máy → trả về lệnh cũ; máy đang giữ lệnh khác → từ chối).
6. Listener `productionRuns` nuốt lỗi (`() => {}`): nếu Firestore Security Rules chặn đọc `productionRuns`, giao diện im lặng trống. Nay hiện thông báo lỗi. **Kiểm tra rules: `productionRuns`, `productionEntries` phải cho đọc/ghi** (xem docs/firestore.rules).
7. Khóa máy (`activeRunId`) mất/lệch: có nút "Khóa lại" trong bảng kiểm tra.
8. Xóa đơn đang có lệnh bị chặn (không mất lịch sử).

## 2. File đã sửa
domain/flow.js, data/flowdata.js, modules/plan/plan.js, modules/plan/plan_modals.js, modules/app/appinner.js, modules/orders/ordersboard.js, ui/grid.js (mới), ui/globalstyle.js, index.html, sw.js, core/security.js (v47). Tests: docs/kiem-thu/fakefs.js, harness.js, accept.js, e2e/*.

## 3. Logic sau sửa
Một lệnh = (orderId, stageKey, machineId) lưu ở `productionRuns`; trạng thái assigned/running/paused/completed/cancelled. Mọi màn hình (Kế hoạch, thẻ máy, TV, Đơn hàng) cùng suy ra từ danh sách lệnh qua `amgPlanBucket/amgMachineCardState`. Máy: tối đa 1 lệnh mở (khóa `activeRunId` trong transaction). Nhật ký auditLog ghi thời gian/người/trạng thái từ→đến. Không có collection/field mới bắt buộc.

## 4. Kiểm thử (chạy trên toàn bộ ứng dụng, Firestore giả lập có transaction)
- accept.js: 27/27 đạt (cả chế độ FAKE và localStorage).
- e2e/e2e12.js (12 tình huống qua giao diện): tạo đơn, phân KT-01, không còn "chưa phân", thẻ KT-01 ĐÃ PHÂN MÁY, bắt đầu → ĐANG CHẠY, tải lại, tạm dừng/tiếp tục, đơn thứ hai máy khác không lẫn, bấm 3 lần = 1 lệnh, ghi sản lượng, kết thúc → chuyển Kéo tinh, máy giải phóng, lịch sử giữ — đạt hết.
- e2e/e2e_bad.js bad: lệnh cũ, lệnh thiếu machineId, giữ dữ liệu; e2e_bad.js deny: Rules chặn đọc → báo lỗi.
Chạy: `cd docs/kiem-thu/e2e && node e2e12.js` (cần react, react-dom, jsdom, xlsx trong node_modules).
Giới hạn: "tải lại/thiết bị khác" mô phỏng bằng gắn lại màn hình + listener mới trên cùng kho Firestore giả; cần xác nhận lại trên Firebase thật.

## 5. Triển khai & kiểm tra dữ liệu thật
1. Sao lưu Firestore (export). 2. Deploy toàn bộ thư mục (cache v47 tự làm mới; mở 2 lần hoặc Ctrl+F5).
3. Vào Kế hoạch: nếu có banner đỏ → sửa Security Rules cho productionRuns/productionEntries.
4. Mở "Kiểm tra dữ liệu lệnh": xử lý từng cảnh báo (không tự động xóa).
5. Phân thử 1 đơn thật vào KT-01 → kiểm tra trên điện thoại/máy khác: đơn ĐÃ PHÂN MÁY, thẻ KT-01 có đơn → Bắt đầu chạy → ĐANG CHẠY.
6. Nếu triệu chứng cũ còn: gửi nội dung banner/bảng kiểm tra và 1 bản ghi productionRuns của KT-01.
