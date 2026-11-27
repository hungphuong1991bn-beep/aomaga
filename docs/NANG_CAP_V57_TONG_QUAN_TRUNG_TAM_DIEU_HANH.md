# v57 — Tổng quan: Trung tâm điều hành sản xuất (Production Command Center)

Tab **Tổng quan** nay chỉ **xem · tổng hợp · phân tích · điều hành**. Không còn nơi nhập liệu nghiệp vụ lần thứ hai.

## Tệp thay đổi
| Tệp | Nội dung |
|---|---|
| `domain/overview.js` (mới) | Hàm thuần `amgOvCompute`: toàn bộ số liệu Tổng quan, chỉ ĐỌC dữ liệu, tái dùng `amgComputeExecutive`, `amgPlanBucket`, `amgOrderLifecycle`, `amgMachineCardState`, `amgCcAlerts` nên khớp các tab nghiệp vụ |
| `modules/dashboard/overview.js` (mới) | Giao diện `ProductionOverview` (lời chào, KPI, công đoạn, máy, đơn cần chú ý, biểu đồ, cảnh báo, hoạt động) |
| `modules/dashboard/dashboard.js` | `DashboardPage` chỉ còn render `ProductionOverview` (`StatCard` giữ nguyên vì Chất lượng/recordkit dùng) |
| `modules/app/appinner.js` | Truyền `onNavigateFocus` cho `DashboardPage` |
| `modules/orders/ordersboard.js`, `modules/plan/plan.js`, `modules/plan/command_center.js` | Chỉ **thêm** khả năng nhận bộ lọc ban đầu (`status`, `stage`) để KPI/công đoạn mở đúng tab đã lọc sẵn |
| `ui/globalstyle.js` | Khối CSS `.ov-*` (class, sáng/tối, mobile/TV) |
| `index.html`, `sw.js`, `docs/kiem-thu/check_assets.js` | Đăng ký 2 script mới; `?v=57.0`; cache `mes-v57-tong-quan-trung-tam` |
| `docs/kiem-thu/accept57.js` (mới), `chay_tat_ca.sh` | 23 kiểm tra nghiệm thu |

## Đã loại bỏ khỏi Tổng quan (chỉ ngừng hiển thị, KHÔNG xóa dữ liệu/handler)
1. "Tổng quan · Sản xuất" 2. "Nhập sản lượng đã xuất xong" 3. "Công đoạn cung cấp nguyên vật liệu" 4. "Nhập sản lượng Kéo trung".
`QuickEntryForm`, `ActivityFeed`, `StageHistorySection`, `ProductionPipeline`, `KeoTrungPage` và các handler (`handleQuickEntry`, `handleKeoTrungEntry`…) vẫn còn trong source; chỉ không được dựng ở Tổng quan.

## Nguồn dữ liệu từng KPI (cũng hiện khi rê chuột vào thẻ)
| KPI | Nguồn / định nghĩa | Nhấn mở |
|---|---|---|
| Tổng đơn hàng | `orders` — mọi đơn (đang mở + hoàn thành); "+N hôm nay" theo `createdAt` | Đơn hàng |
| Đơn đang sản xuất | đơn mở đã có sản lượng hoặc lệnh chạy/tạm dừng (`amgOrderLifecycle`) | Đơn hàng (lọc Đang SX) |
| Đơn chờ sản xuất | đơn mở còn lại | Kế hoạch SX |
| Đơn hoàn thành | `status = completed`; "+N hôm nay" theo `completedAt` | Đơn đã hoàn thành |
| Đơn trễ hạn | `deliveryDate` < hôm nay, chưa hoàn thành | Đơn hàng (lọc Trễ hạn) |
| Tổng số máy / chạy / dừng-chờ | `machines` + `productionRuns` (`amgMachineCardState`). Chạy = running; **chờ** = đã phân lệnh chưa chạy + rảnh/chưa xác nhận; **dừng** = tạm dừng + bảo trì + hỏng | Giám sát máy (lọc trạng thái) |
| Tiến độ sản xuất | Σ thành phẩm ÷ Σ số lượng đặt của đơn đang mở (kg, m tách riêng) | Đơn hàng |
| Hoàn thành kế hoạch | Σ thực hiện ÷ Σ kế hoạch của **lệnh sản xuất** đang mở + lệnh kết thúc trong kỳ lọc | Kế hoạch SX |

Nguyên tắc: không có dữ liệu → "Chưa có dữ liệu" (không điền 0); kg và m không cộng lẫn; biểu đồ chỉ vẽ từ `auditLog.production_entry`, đơn đang mở và máy thật.

## Quy ước đã chọn (cần chủ sản phẩm xác nhận)
1. **Số máy lấy từ dữ liệu thật, không cố định 163.** Danh mục gốc trong source là **160 máy** (4/64/19/5/4/10/2/33/15/4), khác bảng 163 (5/65/19/5/5/…) trong yêu cầu — thiếu 1 máy Kéo trung, 1 Kéo tinh, 1 Ủ nhiệt. Không tự thêm máy cho khớp. Nếu Firebase của xưởng đã có đủ 163 máy thì Tổng quan hiện đủ 163; nếu không, hiện đúng số đang có.
2. **Mã đơn**: v54 đã bỏ mã đơn khỏi mọi giao diện nên bảng "Đơn hàng cần chú ý" dùng cột *Khách hàng / Quy cách* (không hiện mã ORD-…).
3. **"Kế hoạch so với thực tế"**: hệ thống không có kế hoạch theo từng ngày, nên biểu đồ so sánh theo **công đoạn** (kế hoạch = số lượng đặt của đơn mở; thực tế = đã làm). Biểu đồ theo ngày/ca là sản lượng thực.
4. **Bộ lọc kỳ**: Ngày (theo ca) · Tuần · Tháng · Khoảng ngày (tối đa 92 ngày; dài hơn 31 ngày gộp theo tuần).
5. **Nhấn nhóm máy** mở danh sách máy ngay tại Tổng quan; nút "Mở nhóm trong Giám sát máy móc" sang đúng nhóm; nhấn một máy mở chi tiết (lịch sử) của máy đó.
6. **Cảnh báo "Thiếu dữ liệu sản xuất"** = lệnh đang chạy từ ngày trước mà chưa ghi sản lượng; đơn mở thiếu ngày giao/số lượng. "Máy dừng bất thường" = lệnh đang tạm dừng (không đặt ngưỡng tự nghĩ ra). Cảnh báo không có sự kiện gốc ghi "Đang diễn ra".
7. **Hoạt động gần đây** chỉ gồm sự kiện có mốc thời gian thật; dòng "hoạt động quản lý" chỉ Admin/Quản đốc thấy.

## ⚠ Việc cần chủ sản phẩm quyết định
`QuickEntryForm` và `KeoTrungPage` **chỉ** được dựng ở Tổng quan trước đây. Sau khi gỡ, đường nhập **phôi Kéo trung không gắn khách hàng** (nguyên liệu chung) và ghi nhanh theo công đoạn không còn giao diện; việc ghi sản lượng theo máy ở Kế hoạch SX / Điều hành vẫn dùng bình thường. Nếu cần giữ đường nhập phôi, nên chuyển `KeoTrungPage` sang tab nghiệp vụ (không đặt lại ở Tổng quan). Việc sửa/xóa lượt nhập bằng nút bút chì ở "Hoạt động gần đây" cũ cũng không còn ở Tổng quan.

## Kiểm thử
`accept57.js` (23): số liệu, 10 nhóm máy, kỳ lọc, cảnh báo, hoạt động, dữ liệu trống/lệch, lời chào theo tên đăng nhập, **4 khu nhập liệu đã gỡ**, điều hướng từng loại, biểu đồ, thu gọn, **dữ liệu Firebase không đổi** sau mọi thao tác. Toàn bộ 16 bộ test cũ vẫn đạt; `verify-repo` 31/31.
Chưa kiểm thử: hiển thị trên trình duyệt/thiết bị thật (ảnh chụp, TV, cảm ứng) — chỉ kiểm bằng jsdom; nên mở thử trên máy tính, điện thoại và TV xưởng.

## Triển khai
Chép đè thư mục, push GitHub (Pages tự deploy; EXE/APK tự nhận bản Web mới). Mở 2 lần hoặc Ctrl+F5 (cache `mes-v57-tong-quan-trung-tam`).
