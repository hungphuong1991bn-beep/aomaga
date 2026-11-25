# AOMAGA MES V52 — Hoàn thành đơn một bước, Điều hành sản xuất, Global Header

Phiên bản: **V52.1** (cache Service Worker `mes-v52-1-workflow`, mọi script dùng `?v=52.1`).
Phát triển trực tiếp trên source v51; không đổi công nghệ (React UMD + JavaScript, không có bước build), không đổi tên
collection / document ID, không xóa dữ liệu đơn hàng, BOM, `productionRuns`, `productionEntries`, nhật ký.

## 0. Điều cần biết trước (khác với mô tả ban đầu)

1. **Lớp dữ liệu là Firebase Realtime Database, không phải Firestore.** `core/runtime.js` là lớp tương thích kiểu Firestore chạy trên REST + SSE
   (mỗi document lưu `{d: JSON, t}` dưới `amg/<collection>/<id>`). "onSnapshot" ở đây là lớp tương thích đọc từ **một** luồng SSE duy nhất.
   Lớp này **không có `runTransaction`**, nên trước V52 mọi "giao dịch" thực chất là ghi tuần tự, không chống được hai thiết bị ghi đồng thời.
2. Zip nhận được đã mang nhãn `mes-v52-modular` / `?v=52`. V52.1 đổi tên cache và tham số `?v=` để chắc chắn mọi trình duyệt/TV tải bản mới.
3. Mô hình vai trò hiện có chỉ gồm **3 vai: Admin, Quản đốc, Nhân viên** (`core/policy.js`). QC, Kho, nhân viên sản xuất đều là "Nhân viên"
   với quyền theo ma trận phân hệ. V52 giữ nguyên mô hình này, không thêm vai.

## 1. Các file đã sửa / thêm

Mã nguồn đã sửa: `core/runtime.js`, `core/guard.js`, `data/flowdata.js`, `domain/flow.js`, `index.html`, `sw.js`, `ui/layout.js`, `ui/globalstyle.js`,
`modules/app/appinner.js`, `modules/orders/ordersboard.js`, `modules/orders/orderdetail.js`, `modules/orders/completed.js`,
`modules/plan/plan.js`, `modules/plan/plan_modals.js`, `modules/records/pages_ops_maint.js`, `modules/hr/hr.js`.

Mã nguồn thêm mới: `domain/search.js` (tìm kiếm toàn hệ thống + trạng thái đồng bộ), `domain/opslive.js` (tính toán Điều hành),
`modules/ops/opsboard.js` (bảng điều khiển Điều hành).

Kiểm thử: `docs/kiem-thu/fakertdb.js` (giả lập Realtime Database nhiều thiết bị, có ETag), `accept52.js`, `check_assets.js`, `chay_tat_ca.sh`,
`e2e/e2e_header52.js`, `e2e_ops52.js`, `e2e_orders52.js`, `e2e_completed52.js`, `e2e_roles52.js`; đã chỉnh `harness.js`, `accept.js`, `render.js`, `e2e/e2e48.js`.

## 2. Nghiệp vụ đã thay đổi

### 2.1 Hoàn thành đơn — một bước, không chờ xác nhận
- **Bỏ** khung "Chờ xác nhận hoàn thành đơn" ở tab Đơn hàng hoàn thành và bỏ hộp xác nhận tự mở sau khi kết thúc lệnh cuối.
- Nhóm hiển thị `stage_done` đổi nhãn thành **"Đủ công đoạn — sẵn sàng hoàn thành đơn"**. Đây chỉ là nhóm hiển thị, **không phải trạng thái lưu**.
- Nút **HOÀN THÀNH ĐƠN** có ở: hàng kế hoạch, chi tiết đơn trong Kế hoạch sản xuất, và bảng "Theo dõi đơn hàng" trong Điều hành sản xuất.
- Bấm một lần: kiểm tra điều kiện rồi chuyển `status = "completed"` ngay. Chỉ khi **thiếu số lượng** mới hiện hộp nhập lý do (≥ 5 ký tự), vì quy định hiện hành bắt buộc.
- Kết thúc lệnh máy ≠ hoàn thành công đoạn ≠ hoàn thành đơn: kết thúc lệnh **không bao giờ** tự hoàn thành đơn.
- Ghi: `completedAt`, `completedBy`, `completionSource` (`plan` / `dieuhanh`), `completionSummary` (thành phẩm, số lượng đặt, thiếu hay đủ, **danh sách máy, số lượng lệnh**),
  `statusHistory`, và một dòng nhật ký `order_complete`.
- Điều kiện kiểm tra theo thứ tự: đơn tồn tại và chưa hoàn thành → không còn lệnh máy mở → đủ công đoạn bắt buộc → đủ sản lượng (hoặc có lý do) → đúng quyền.
- Đơn rời ngay các danh sách đang hoạt động (Đơn hàng, Kế hoạch, Điều hành) và xuất hiện ở tab Đơn hàng hoàn thành. Thông báo thành công có nút
  "Mở chi tiết đơn đã hoàn thành". Không xóa lệnh, sản lượng, BOM, lịch sử chất lượng.
- Hàm dùng chung `amgCompleteOrderOneStep` (blocked / need_reason / done / duplicate) để Kế hoạch và Điều hành cùng một logic.
- **Mở lại đơn** giữ nguyên: bắt buộc lý do, ghi `statusHistory` + nhật ký, giữ toàn bộ lệnh và sản lượng.

### 2.2 Chống hoàn thành trùng giữa nhiều thiết bị (ghi có điều kiện)
- Thêm `window.__db.casDoc(col, id, mutator)`: đọc document **và ETag từ máy chủ**, chạy `mutator`, ghi bằng `PUT` kèm `if-match`.
  Có người ghi xen vào → máy chủ trả 412 → đọc lại, chạy lại `mutator` (tối đa 5 lần).
- Hoàn thành đơn và mở lại đơn chỉ đổi **một document** (`orders/{id}`) nên đảm bảo nguyên tử. Hai thiết bị cùng bấm: một bên thắng, bên kia nhận `duplicate`,
  `completedAt/completedBy` không bị ghi đè, lịch sử và nhật ký không nhân đôi.
- `casDoc` đi qua cổng quyền `guard.js` như `set/update/delete` (gọi thẳng `casDoc` từ console vẫn bị từ chối và ghi `permission_denied`).
- **Tự lùi (fallback):** nếu trình duyệt không đọc được ETag (máy chủ không công khai header qua CORS), hệ thống lùi về đường giao dịch cũ và nhớ lại
  trong phiên (`window.__amgNoCas`). Nghiệp vụ vẫn chạy nhưng chống ghi đồng thời **yếu hơn** (như v51).
- Giới hạn: các thao tác khác (phân lệnh, ghi sản lượng...) vẫn là ghi thường theo kiểu "ghi sau thắng". Chỉ hoàn thành và mở lại đơn là ghi có điều kiện.

## 3. Cách tra cứu đơn hoàn thành
Tab **Đơn hàng hoàn thành** là kho lưu trữ chỉ đọc.
- Danh sách: STT, mã đơn, khách hàng, quy cách, nguyên liệu, SL đặt, thành phẩm, **tỷ lệ HT**, ngày nhận, ngày giao, ngày hoàn thành, thời gian SX, **máy tham gia**,
  **người hoàn thành**, trạng thái (đủ SL / thiếu SL).
- Tìm kiếm không phân biệt hoa thường và dấu tiếng Việt; lọc theo khách hàng, thời gian hoàn thành, công đoạn, **máy**, **trạng thái**.
- Chi tiết: công đoạn, **lịch sử máy từng lượt** (máy, người vận hành, ca, bắt đầu, kết thúc, chạy thực, tạm dừng, SL kế hoạch/thực tế — không gộp lượt),
  lịch sử sản lượng, BOM/định mức/vật tư đã xuất, chất lượng, NG/phế, lịch sử đơn.
- Xuất Excel (danh sách và chi tiết), in báo cáo hoàn thành đơn. Nút **Mở lại** ở dòng đơn (chỉ Admin/Quản đốc).

## 4. Các phân hệ khác trong V52
- **Đơn hàng:** thêm cột Công đoạn hiện tại, Máy đang SX, Còn lại; sắp xếp (bấm tiêu đề cột hoặc ô "Sắp xếp"); Excel thêm cột còn lại/tiến độ/công đoạn/máy.
  Dưới 1260 px tự chuyển sang thẻ dòng đủ thông tin. Chi tiết đơn có thanh nút: CHỈNH SỬA ĐƠN, XÓA ĐƠN, LẬP KẾ HOẠCH SẢN XUẤT, PHÂN MÁY, XEM LỊCH SỬ;
  các tab máy/lệnh, công đoạn, lịch sử sản xuất (từ `productionEntries`), BOM (đã xuất/còn thiếu) được bổ sung.
  Xóa đơn vẫn bị chặn khi đơn đã có lệnh/sản lượng hoặc đã hoàn thành. LẬP KẾ HOẠCH / PHÂN MÁY mở đúng phân hệ và tự chọn đơn.
- **Kế hoạch sản xuất:** thêm người vận hành, ca, "xong / còn" ở mức đơn. Phần điều tiết (phân máy, chạy, tạm dừng, tiếp tục, kết thúc lệnh, hoàn thành công đoạn) giữ nguyên.
- **Điều hành sản xuất:** tab mới **Giám sát sản xuất** — KPI nhà máy, thẻ từng máy (đồng hồ chạy tính từ mốc thời gian đã lưu, **không ghi Firebase**), bảng đơn đang sản xuất,
  cảnh báo, thao tác nhanh, chế độ TV. Nội dung cũ chuyển sang tab "Kế hoạch ngày & nhật ký". Mọi chỉ số lấy từ dữ liệu thật, không có dữ liệu mẫu;
  sản lượng cộng theo từng đơn vị (kg và m không cộng lẫn). Định nghĩa chỉ số ghi ở đầu `domain/opslive.js`.
- **Global Header** (`ui/layout.js`, dùng chung mọi tab): nút thu gọn Sidebar, tên nhóm/tab, **tìm kiếm toàn hệ thống** (Ctrl/⌘+K, ESC đóng, ↑↓ Enter),
  **đồng hồ** giờ:phút:giây + thứ/ngày/tháng/năm + ca, **trạng thái đồng bộ thật**, thông báo, sáng/tối, nút đồng bộ, tài khoản, đăng xuất. Responsive (thu gọn dần, không tràn ngang).
- **Tìm kiếm:** chỉ mục dựng từ dữ liệu đã có trong bộ nhớ (không thêm lượt đọc Firebase), gồm các nhóm thuộc tab người dùng được xem. Mở đúng bản ghi với:
  đơn (chi tiết), đơn hoàn thành (chi tiết), khách hàng / vật liệu / quy cách (lọc sẵn ở tab Đơn hàng), máy / lệnh (Giám sát máy, lọc sẵn), nhân sự (lọc sẵn).
  **Phiếu chất lượng và hồ sơ tài liệu chỉ mở đúng tab, chưa mở đúng bản ghi** (các trang đó chưa có ô tìm kiếm nhận từ khóa từ ngoài).

## 5. Cơ chế đồng bộ
- **Một** luồng SSE cho toàn ứng dụng; mỗi collection đăng ký đúng một lần (`useAppData`, `useExtraData`, `useFlowData`). Chuyển tab không gọi thêm lượt đọc.
- Trạng thái hiển thị lấy từ `window.__rtdbStatus` (kết nối SSE, hàng đợi ghi, lỗi đọc/ghi), **không** từ việc giao diện vừa vẽ:
  Đang kết nối · Đã kết nối · Đang đồng bộ (n) · Đã đồng bộ · Vừa nhận cập nhật · Mất kết nối (n chờ gửi) · Có lỗi đồng bộ (kèm lý do ở tooltip).
- "Vừa nhận cập nhật" chỉ bật khi dữ liệu **đến từ thiết bị khác** (bản ghi do chính máy này ghi bị bỏ qua), tự tắt sau 4 giây. Không cần F5, không nhân đôi bản ghi.
- Sửa hai lỗi của lớp dữ liệu phát hiện khi kiểm thử: nhãn kẹt "Mất kết nối" sau khi có mạng lại; nút "Đồng bộ" giờ nối lại luồng và gửi ngay hàng đợi (`__rtdbResync`).
- Thông báo thành công/lỗi ở Kế hoạch: sửa lỗi hẹn giờ thông báo cũ xóa nhầm thông báo mới.

## 6. Cách chạy kiểm thử
Source không có bước build nên thư viện test không nằm trong source. Cài một lần ngoài project:

```
mkdir -p ~/amg-test && cd ~/amg-test && npm init -y && npm i jsdom@22 react@18.2.0 react-dom@18.2.0 xlsx@0.18.5
cd <thư mục source>/docs/kiem-thu && NM=~/amg-test/node_modules bash chay_tat_ca.sh
```

## 7. Kết quả kiểm thử (chạy trên bộ giả lập Realtime Database)

| Bộ test | Kết quả |
|---|---|
| `check_assets.js` (index.html ↔ sw.js ↔ đĩa, cú pháp, manifest) | 8 / 8 |
| `accept.js` | 27 / 27 |
| `accept48.js` | 18 / 18 |
| `accept52.js` (hoàn thành một bước, hai thiết bị, ETag 412, mất mạng, không ETag, quyền, Điều hành, tìm kiếm) | 20 / 20 |
| `roles.js` | 10 / 10 |
| `render.js` | 16 / 16, 0 lỗi console |
| `e2e12.js`, `e2e_bad.js` | 28 và 4, không lỗi |
| `e2e48.js` (bước 10–11 cập nhật theo luồng mới) | 43 / 43 |
| `e2e_header52.js` | 35 / 35 |
| `e2e_ops52.js` | 27 / 27 |
| `e2e_orders52.js` | 27 / 27 |
| `e2e_completed52.js` | 27 / 27 |
| `e2e_roles52.js` | 5 / 5 |

Không xóa test cũ nào. Các chỉnh sửa trong test cũ: harness và `render.js` chuyển từ giả lập Firestore/offline sang giả lập Realtime Database
(đúng lớp dữ liệu thật); `e2e48.js` bước 10–11 kiểm tra hành vi V52 thay cho hành vi cũ (tự mở hộp xác nhận), bỏ các đơn mẫu do app tự gieo khi CSDL trống,
dùng máy chủ giả lập dùng chung; `accept48.js` test 11 vẫn kiểm tra trường `awaiting` (giữ lại trong `flow.js`, giao diện không còn dùng).

Ánh xạ danh sách kiểm thử bắt buộc: 1–11 (đơn, kế hoạch, phân máy, chạy, tạm dừng, sản lượng, kết thúc lệnh, hoàn thành công đoạn) trong `accept*.js`, `e2e12/e2e48`;
12–17 trong `accept52` (1–5), `e2e48` (10–10d, 17), `e2e_ops52` (C1–C4), `e2e_completed52` (H, K, F5); 18 `accept52` (6); 19 `e2e_completed52` (O); 20 `e2e_header52` (Q);
21 (C); 22 (S, R); 23 `e2e_roles52`, `accept52` (10, 18); 24 `accept52` (13, dữ liệu kiểu v51).

## 8. Giới hạn và rủi ro còn lại — cần bạn kiểm tra trên hệ thống thật
1. **Chưa thử trên Firebase thật.** `casDoc` dựa trên ETag/`if-match` của REST API Realtime Database theo hiểu biết của tôi, chỉ chạy được trên bộ giả lập.
   Cần thử: (a) trình duyệt có đọc được header `ETag` không (nếu không, hệ thống tự lùi về đường dự phòng — xem mục 2.2; kiểm tra console có dòng
   `[AMG] Không có ETag`); (b) Security Rules có cho phép `PUT` vào `amg/<collection>/<id>` (hiện lớp dữ liệu chỉ `PATCH` ở gốc `amg`).
2. **Giao diện chưa được xem bằng mắt.** Kiểm thử chạy trong jsdom (không có bố cục thật): kích thước cột, ngưỡng 1260 px, header responsive, chế độ TV chưa được kiểm tra trực quan.
   Cần xem trên PC, màn hình TV nhà xưởng và điện thoại.
3. Chống ghi đồng thời chỉ áp dụng cho hoàn thành/mở lại đơn (xem 2.2). Phân lệnh/ghi sản lượng vẫn "ghi sau thắng".
4. Cảnh báo điều hành dùng các ngưỡng cố định (chạy ≥ 2 giờ chưa ghi sản lượng, tạm dừng ≥ 60 phút, lệnh mở > 24 giờ, nguy cơ chậm: tụt ≥ 15 điểm so với tiến độ thời gian
   trong 14 ngày). "Thiếu vật tư" chỉ báo khi đơn đã có dữ liệu xuất kho. Cần điều chỉnh ngưỡng theo thực tế nhà máy (hằng số đầu `domain/opslive.js`).
5. Tìm kiếm: phiếu chất lượng và hồ sơ tài liệu chưa mở đúng bản ghi (xem mục 4). Chỉ mục không gồm dữ liệu chưa tải (collection chưa đăng ký).
6. Chưa kiểm thử với dữ liệu thật lớn (hàng nghìn đơn). Chỉ mục tìm kiếm dựng lại khi dữ liệu đổi; nếu chậm cần giới hạn theo thời gian.
7. Mô hình 3 vai trò giữ nguyên; không có vai QC/Kho riêng. Nếu cần tách quyền QC/Kho cần thay đổi ma trận trong `core/policy.js`.

## 9. Triển khai và hoàn tác
Ghi đè toàn bộ thư mục lên hosting hiện tại (không có bước build). Service Worker đổi cache nên trình duyệt/TV nhận bản mới sau 1–2 lần tải lại
(thanh thông báo "Tải lại"). Hoàn tác: ghi đè lại bản v51/v52 cũ; dữ liệu không bị đổi cấu trúc nên hai bản dùng chung dữ liệu được
(đơn đã hoàn thành ở V52 có thêm trường `completionSource` và `completionSummary.machines/runCount` mà bản cũ bỏ qua an toàn).
