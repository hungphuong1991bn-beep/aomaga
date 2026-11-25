# v53 — Xóa đơn ở tab Đơn hàng, kể cả đơn đang sản xuất (chỉ Admin)

## Trước đây
Đơn đã có lệnh máy hoặc sản lượng bị chặn xóa với mọi người, kể cả Admin. Xóa nhiều đơn (Chọn nhiều) chỉ chặn theo lệnh máy, không chặn theo sản lượng.

## Bây giờ
| Trường hợp | Admin | Quản đốc | Nhân viên |
|---|---|---|---|
| Đơn chưa có lệnh/sản lượng | Xóa thường (hộp xác nhận) | Xóa thường | Không có nút |
| Đơn đang sản xuất (có lệnh máy hoặc sản lượng) | **Xóa tận gốc** (hộp xác nhận mạnh) | Bị chặn, báo "chỉ Admin" | Không có nút |
| Đơn đã hoàn thành | Không xóa (phải mở lại đơn trước) | Không xóa | — |

Áp dụng cho cả nút Xóa trên dòng, nút XÓA ĐƠN trong Chi tiết đơn và Chọn nhiều → Xóa đã chọn.

### Hộp xác nhận xóa tận gốc
- Liệt kê từng đơn: số lệnh máy (bao nhiêu đang mở, trên máy nào), sản lượng đã làm, số lượt sản lượng; cộng dồn khi chọn nhiều.
- Bắt buộc nhập **lý do** (≥ 3 ký tự) và **gõ mã đơn** (nhiều đơn: gõ `XOA`) thì nút mới mở.
- Cảnh báo số phiếu kho / kiểm tra / NG / kế hoạch ngày đang tham chiếu tới đơn.

### Hệ thống xóa những gì (một lượt ghi nguyên tử cho mỗi đơn — `amgFlowForceDeleteOrder`, data/flowdata.js)
1. Đơn `orders/{id}`.
2. Mọi lệnh `productionRuns` của đơn (đang chạy / tạm dừng / đã phân / đã kết thúc / đã hủy).
3. Giải phóng khóa máy `machines/{id}.activeRunId` của các lệnh bị xóa (nếu máy còn lệnh mở của đơn khác thì khóa chuyển sang lệnh đó).
4. Mọi lượt sản lượng `productionEntries` của đơn và bản sao cùng id trong `auditLog` (để Tổng quan/Báo cáo không còn cộng sản lượng đơn đã xóa).
5. Ghi nhật ký `order_force_delete`: ai xóa, lúc nào, lý do, số lệnh/lượt sản lượng/máy giải phóng, thành phẩm lúc xóa. Dòng này không bị xóa theo.

### Không xóa
Phiếu kho (`stockMoves`), phiếu kiểm tra, phiếu NG, kế hoạch ngày... của đơn: thuộc phân hệ khác, có thể cần cho truy vết chất lượng. Chúng chỉ hiện cảnh báo "đơn không tồn tại" ở bảng Kiểm tra dữ liệu.

### Bảo vệ
- Quyền kiểm tra ở tầng dữ liệu (`amgFlowCan(user, "force_delete")` = chỉ Admin), không chỉ ẩn nút.
- Thiếu lý do thì tầng dữ liệu từ chối.
- Xóa nhiều đơn: từng đơn độc lập; đơn nào lỗi thì hộp thoại giữ lại đúng đơn đó kèm thông báo lỗi, các đơn đã xóa không bị ảnh hưởng.
- Xóa nhiều đơn bình thường (không có lệnh/sản lượng) chia lô 200 đơn mỗi lượt ghi; chặn cả đơn có sản lượng và đơn đã hoàn thành.

## Muốn cho Quản đốc cũng xóa được?
Đổi một dòng trong `amgFlowCan` (data/flowdata.js): `return amgIsRoot(user)` → `return amgIsPower(user)`, và trong `ordersboard.js` đổi `const isRoot = amgIsRoot(currentUser)` tương ứng.

## Kiểm thử
`docs/kiem-thu/e2e/e2e_orders52.js` (E2…E2m): hộp xác nhận, khóa nút, xóa lệnh/sản lượng/khóa máy, dữ liệu đơn khác còn nguyên, nhật ký, Quản đốc bị từ chối, xóa nhiều đơn. Toàn bộ bộ test đạt.

## Triển khai
Chép đè thư mục, mở 2 lần hoặc Ctrl+F5 (cache `mes-v52-2-xoadon`, tham số `?v=52.2`).
