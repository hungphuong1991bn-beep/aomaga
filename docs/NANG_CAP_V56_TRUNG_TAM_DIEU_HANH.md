# v56 — Trung tâm điều hành sản xuất (tab Kế hoạch sản xuất → Giám sát máy móc)

## Thay đổi
- **Mới** `modules/plan/command_center.js` (hàm thuần `amgCc*` + giao diện `CommandCenter`). Đăng ký trong `index.html`, `sw.js`.
- `modules/plan/plan.js`: `MonitorScreen` tab "Thẻ máy" → "Trung tâm điều hành máy"; `TVWall` hiện đủ 10 nhóm (kể cả Máy sang lô) và nhận nhóm đang chọn; hướng dẫn 6 bước chỉ hiện ở màn Kế hoạch & phân công (nhường chỗ cho máy); truyền `focusMachineId`.
- `ui/globalstyle.js`: khối CSS `.cc-*` (viết bằng class để không bị quy tắc responsive điện thoại ghi đè).
- Phiên bản `?v=56.0`, cache Service Worker `mes-v56-trung-tam-dieu-hanh`.
- Test: `docs/kiem-thu/accept56.js` (mới, 26 kiểm tra); `e2e/e2e48.js` tìm máy qua ô tìm kiếm (vì giao diện không còn nối tiếp mọi nhóm); `check_assets.js` lên v56.

## Không đổi
Cấu trúc/trường dữ liệu Firebase, mã máy, mã đơn, lịch sử, phân máy, ghi sản lượng, bắt đầu/tạm dừng/tiếp tục/kết thúc, phân quyền, đồng bộ. Mọi nút điều hành vẫn gọi đúng `openModal`/`act` và hàm `amgFlow*` cũ. Module mới **chỉ đọc** dữ liệu; kiểm thử xác nhận dữ liệu không đổi sau mọi thao tác xem.
`MachineCard` và "Danh mục máy & trạng thái" giữ nguyên.

## Quy ước đã chọn (cần chủ sản phẩm xác nhận)
1. **Mã đơn hàng**: v54 đã bỏ mã đơn khỏi giao diện nên đơn được gọi bằng *Khách hàng · Quy cách*. Ô tìm kiếm vẫn khớp mã nội bộ (ORD…), khách hàng, quy cách, nguyên liệu, người vận hành.
2. **Loại sản phẩm**: hệ thống không có trường này; hiển thị suy ra từ quy cách theo quy ước sẵn có (có "/" = dây bện; hậu tố BC/TC); không đọc được → "—".
3. **Máy sang lô** chưa gắn công đoạn nên hiện đủ nhưng chưa phân lệnh được (nút bị khóa, có chú thích) — không tự tạo công đoạn.
4. **Cảnh báo** (chỉ khi dữ liệu thật đáp ứng): máy sự cố; lệnh tạm dừng (kèm lý do, đã dừng bao lâu); máy có công đoạn chưa có lệnh (gộp theo nhóm); đơn quá hạn; đơn chưa phân máy; đơn chờ chuyển công đoạn; lệnh đã kết thúc thấp hơn 99,5% kế hoạch khi công đoạn chưa hoàn thành và không còn lệnh bù. "Dừng bất thường" = lệnh đang tạm dừng (không đặt ngưỡng tự nghĩ ra).
5. Ghi nhớ trên thiết bị (localStorage, không ghi Firebase): chế độ Lưới/Danh sách, nhóm đang xem, cách sắp xếp.

## Số lượng máy
Danh mục gốc trong source (`MACHINE_TYPES`/`genMachineSeed`) là **160 máy**: 4/64/19/5/4/10/2/33/15/4, không phải 163 (5/65/5…) như yêu cầu. Giao diện lấy số từ dữ liệu thật nên hiển thị đúng số máy đang có trong Firebase. Không tự thêm máy để cho khớp 163.
