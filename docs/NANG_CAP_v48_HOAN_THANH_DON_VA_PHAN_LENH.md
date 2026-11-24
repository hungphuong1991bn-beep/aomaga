# Nâng cấp v48 — Liên kết routing ↔ phân lệnh, thời gian/sản lượng thực tế, hoàn thành đơn & lưu trữ

Kế thừa v46/v47; không viết lại ứng dụng; **không đổi cấu trúc collection**; không xóa dữ liệu. Dữ liệu cũ đọc được như trước.

## Nguyên nhân & điểm đã sửa
| Vấn đề trong mã v47 | Sửa trong v48 |
|---|---|
| `amgFlowFinishRun` tự hoàn thành đơn (`completionMode:"auto"`) | Không còn tự hoàn thành. Chỉ trả `readyToComplete`; người có quyền bấm **HOÀN THÀNH ĐƠN** (`completionMode:"manual"`) |
| `amgFlowCompleteOrder` không kiểm tra lệnh đang mở | Đọc lại các lệnh của đơn **trong giao dịch** (`order.openRunIds` + lệnh giao diện đang thấy); còn lệnh mở → từ chối |
| Đơn cũ (chưa xác nhận quy trình) phân lệnh được theo công đoạn suy từ quy cách | Chỉ đơn `routingConfirmed` mới phân lệnh. Đơn chưa xác nhận nằm khung riêng ở Kế hoạch; sửa đơn không tích sẵn công đoạn (chỉ gợi ý, người dùng tự áp dụng) |
| Tab Đơn hàng/KPI/cảnh báo/Dashboard vẫn liệt kê/đếm đơn `completed` | `activeOrders = orders.filter(amgIsActiveOrder)` cho Đơn hàng & BOM, cảnh báo, quick-entry; KPI đếm đúng `completed`; tab Đơn hàng có thẻ đi tới Hoàn thành |
| Sửa/xóa BOM của đơn đã hoàn thành | `handleUpdateOrder` từ chối đơn completed; chi tiết đơn completed ở chế độ **chỉ đọc**; không xóa đơn completed |
| Không có đơn vị, thời gian chạy/tạm dừng/thực tế, năng suất | `order.unit` (kg\|m, mặc định kg), copy vào lệnh & lượt ghi; `amgRunTiming` tính từ timestamp + `pauses[]`; không ghi đồng hồ lên Firebase |
| Phân lệnh chỉ "đơn trước" hoặc "máy trước" | Thêm luồng **Công đoạn → Máy → Đơn** + hộp **Xác nhận bắt đầu chạy máy** |

## Ba khái niệm tách bạch
A. **Kết thúc lệnh** — giải phóng máy, lưu `endedAt`, đóng lần tạm dừng còn mở, giữ lịch sử. Không đổi trạng thái đơn/công đoạn.
B. **Hoàn thành công đoạn** — ghi `stageComplete[key]`; từ chối nếu còn lệnh mở khác của cùng công đoạn; đơn chuyển sang công đoạn kế trong routing.
C. **Hoàn thành đơn** — thủ công, quyền quản lý; thiếu SL cần lý do ≥ 5 ký tự; một giao dịch trên một tài liệu đơn; ghi `completedAt/By/Mode/Note`, `completionSummary`, `statusHistory`.

## Trường dữ liệu bổ sung (tùy chọn, tương thích ngược)
`orders`: `unit`, `openRunIds[]`, `completionSummary`, `lastCompletionSummary` · `productionRuns`: `unit`, `finalTiming{elapsedMs,pausedMs,netMs,ratePerHour}`, `pauses[].closedByFinish` · `productionEntries`: `unit`.
Firestore Rules không ràng buộc trường nên **không cần đổi Rules**.

## File thay đổi
domain/flow.js · data/flowdata.js · domain/kpi.js · domain/alerts.js · modules/app/appinner.js · modules/orders/{ordersboard,orderdetail,completed}.js · modules/plan/{plan,plan_modals}.js · modules/dashboard/dashboard.js · ui/{recordkit,globalstyle}.js · core/security.js (version 48) · index.html, sw.js (v48 — buộc thiết bị tải lại) · docs/kiem-thu/{accept,accept48,harness,e2e/e2e12,e2e/e2e48}.js

## Triển khai
Ghi đè toàn bộ thư mục lên hosting hiện tại (không có bước build). `sw.js` đã đổi tên cache `mes-v48-modular` nên trình duyệt/TV tự nhận bản mới sau 1–2 lần tải lại (Ctrl+F5 trên TV nếu cần).
Đơn đang `running` trước nâng cấp hoạt động bình thường (không có `openRunIds` → hệ thống dùng các lệnh giao diện đang thấy để kiểm tra).
Đơn cũ chưa có quy trình: vào **Kế hoạch sản xuất → khung cảnh báo → Xác nhận quy trình** (Quản đốc/Admin) để đưa vào kế hoạch.

## Kiểm thử
```
cd docs/kiem-thu
NODE_PATH=<node_modules> APP_DIR=<thư mục app> NM=<node_modules>
node accept.js ; FAKE=1 node accept.js        # 27 kịch bản nghiệp vụ x2 chế độ
node accept48.js ; FAKE=1 node accept48.js    # 18 kịch bản v48 x2 chế độ
node roles.js ; node render.js
cd e2e && node e2e12.js ; node e2e48.js ; node e2e_bad.js bad ; node e2e_bad.js deny
```
