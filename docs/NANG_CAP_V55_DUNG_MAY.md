# v55 — Tab "Theo dõi thời gian dừng máy" đồng bộ với Kế hoạch sản xuất

## 1. Nguồn dữ liệu duy nhất
Một lần dừng máy = một phần tử trong `productionRuns/{lệnh}.pauses[]` (nút **Tạm dừng / Tiếp tục** ở Kế hoạch sản xuất). Tab Theo dõi **không lưu bản sao**: mỗi lần dữ liệu đổi (realtime), danh sách sự kiện được dựng lại bằng `amgDtBuildEvents` (domain/downtime.js). Vì vậy:
- Tạo / sửa / tiếp tục / hủy ở Kế hoạch → tab Theo dõi đổi theo ngay, mọi thiết bị.
- Không thể trùng bản ghi, không có vòng lặp đồng bộ, không cần nhập lại.
- Mã sự kiện xác định: `DM-<mã lệnh>-<số thứ tự lần dừng>` (ví dụ `DM-ABC123-2`).
- Nguồn thứ hai (giữ dữ liệu cũ): `machines[].downtimeLog` (đổi trạng thái máy hỏng/bảo trì). Phần trùng thời gian với tạm dừng lệnh của cùng máy bị trừ để không tính hai lần; trạng thái "Tạm nghỉ/Chưa xác định" không tính là dừng máy.

## 2. Sổ lịch sử `downtimeEvents/{mã sự kiện}`
Chỉ phục vụ truy xuất (không phải nguồn số liệu). Ghi **trong cùng giao dịch** với Tạm dừng / Tiếp tục / Kết thúc lệnh / Sửa / Hủy / Xóa đơn: người tạo, thời điểm, người cập nhật, danh sách thay đổi (trước → sau, lý do), trạng thái hoạt động/đã hủy, ảnh chụp đơn & máy. Xóa đơn (Admin) → lệnh mất nhưng lịch sử dừng máy còn, đánh dấu "Nguồn đã xóa". Sự kiện phát sinh **trước v55** hiển thị bình thường nhưng chưa có lịch sử chỉnh sửa (nhật ký hệ thống vẫn có lần tạm dừng/tiếp tục).

## 3. Sửa / hủy tại Kế hoạch sản xuất (mới)
Chi tiết lệnh → "Lịch sử tạm dừng": nút **Sửa** (nguyên nhân, giờ bắt đầu/kết thúc, bắt buộc lý do) và **Hủy** (soft-cancel, bắt buộc lý do, không hủy lần đang mở). Kiểm tra: kết thúc sau bắt đầu, không trước giờ chạy lệnh, không vượt giờ kết thúc lệnh, không chồng lần dừng khác, không ở tương lai. Lần dừng đã hủy không tính vào đồng hồ sản xuất (`amgRunTiming`).

## 4. Giao diện tab Theo dõi
Bộ lọc kỳ (hôm nay/tuần/tháng/30 ngày/tất cả/tùy chọn) + máy/ca/nhóm nguyên nhân/loại dừng/đơn/nguồn/tìm kiếm · 6 thẻ KPI · dải "đang dừng ngay bây giờ" · cảnh báo · 4 biểu đồ (theo máy, theo nguyên nhân, giữa các ca, xu hướng ngày/tháng) · Top 5 máy · Top nguyên nhân · OEE & độ tin cậy theo máy · bảng sự kiện (bấm dòng → chi tiết nguồn, lịch sử, nút mở lệnh máy gốc / đơn) · chế độ TV · xuất Excel/PDF 7 loại báo cáo.

## 5. Phân loại nguyên nhân
Đọc chữ nhân viên đã ghi (có/không dấu), **không sửa chữ gốc**: Sự cố thiết bị, Mất điện (→ *Sự cố*); Chuyển đổi quy cách, Bảo trì sửa chữa (→ *Có kế hoạch*); Chờ nguyên liệu, Chờ khuôn, Chờ lệnh, Thiếu nhân lực, Nguyên nhân khác (→ *Chờ/khác*). Bảng từ khóa: `AMG_DT_CATS`.

## 6. OEE / MTTR / MTBF — chỉ tính khi đủ dữ liệu
- Thời gian sản xuất kế hoạch = thời gian lệnh máy đã chạy trong kỳ; vận hành = kế hoạch − tạm dừng; **Availability** = vận hành / kế hoạch.
- **MTTR** = tổng thời gian sửa / số sự cố đã đóng; **MTBF** = thời gian vận hành / số sự cố. Chỉ tính cho *Sự cố* (thiết bị, mất điện); dừng có kế hoạch và dừng chờ không bị coi là hỏng.
- Thiếu đầu vào → hiện "Chưa đủ dữ liệu" kèm lý do.
- **OEE chưa tính được**: hệ thống chưa lưu tốc độ chuẩn của máy/quy cách (Performance). Để có OEE cần bổ sung dữ liệu này — không suy diễn.

## 7. Cảnh báo & ngưỡng
Dừng vượt ngưỡng/lần · nhiều lần/ngày · nguyên nhân lặp · tăng bất thường so kỳ liền trước (khi chọn kỳ cụ thể) · hiệu suất thấp (Availability < ngưỡng). Admin/Quản đốc đặt ngưỡng chung và theo từng máy (nút "Cài ngưỡng theo máy"; lưu `downtimeSettings/thresholds`). **Giá trị mặc định ban đầu** (chỉnh được): 60 phút/lần, 3 lần/ngày, Availability ≥ 80%, lặp ≥ 3 lần, tăng ≥ 50% và ≥ 30 phút.

## 8. Tệp thay đổi
Mới: `domain/downtime.js`, `data/downtimedata.js`, `modules/downtime/downtime_mes.js`, `docs/kiem-thu/accept55.js`.
Sửa: `data/flowdata.js` (ghi sổ trong Tạm dừng/Tiếp tục/Kết thúc/Xóa đơn; lưu `resumedBy`), `domain/flow.js` (bỏ qua lần dừng đã hủy), `core/policy.js` (quyền 2 collection mới), `modules/plan/plan.js` & `plan_modals.js` (Sửa/Hủy, truy xuất ngược), `modules/downtime/downtime.js` (bỏ form nhập tay, giữ hộp sửa bản ghi Thẻ máy cũ), `modules/app/appinner.js`, `index.html`, `sw.js` (v55), `docs/kiem-thu/check_assets.js`, `chay_tat_ca.sh`.

## 9. Triển khai
Cần cho phép đọc/ghi 2 collection mới `downtimeEvents`, `downtimeSettings` trong Rules của cơ sở dữ liệu (cùng kiểu với `productionRuns`). Nếu chưa, tab vẫn hiển thị số liệu từ Kế hoạch và báo "thiếu lịch sử/ngưỡng"; riêng thao tác Tạm dừng/Tiếp tục sẽ **lỗi nếu Rules chặn ghi sổ** vì chung giao dịch — hãy cập nhật Rules trước khi đưa bản này lên.
Mở khóa phiên bản: người dùng bấm "Tải lại" khi thanh thông báo cập nhật hiện ra.
