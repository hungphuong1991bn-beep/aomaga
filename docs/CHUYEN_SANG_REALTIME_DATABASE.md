# v52 — Chuyển toàn bộ dữ liệu sang Firebase Realtime Database mới

Máy chủ dữ liệu: `https://quanlysx-9e9ad-default-rtdb.asia-southeast1.firebasedatabase.app`
(đổi tại hằng `AMG_RTDB_URL` đầu phần lớp dữ liệu trong `core/runtime.js`).

## Đã gỡ
- Cấu hình Firebase cũ (apiKey, projectId `xuong---dong---mes`…) và 3 thư viện Firebase SDK trong `index.html`, `sw.js`.
- Firestore và Firebase Authentication. `docs/firestore.rules` đã xóa.

## Cách hoạt động
- Dữ liệu nằm ở nút `/amg/<bộ sưu tập>/<mã>`; mỗi tài liệu lưu dạng `{ d: "<JSON>", t: <ms> }`.
- Đọc thời gian thực qua luồng SSE; ghi gộp thành PATCH nhiều đường dẫn (nguyên tử). Mất mạng thì xếp hàng và tự gửi lại.
- Đăng nhập bằng tài khoản băm SHA-256 trong bộ sưu tập `users` (Admin tạo ở Quản trị hệ thống).

## BẮT BUỘC làm một lần: đặt Rules
Ứng dụng không dùng Firebase Auth nên Rules phải cho phép đọc/ghi nút `amg`.
Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "amg": { ".read": true, ".write": true }
  }
}
```
Lưu ý: ai biết URL đều đọc/ghi được `amg` (kể cả mã băm mật khẩu). Chỉ nên dùng trong mạng/nhóm tin cậy.

## Triển khai
Chép đè toàn bộ thư mục lên hosting, mở 2 lần hoặc Ctrl+F5 (cache đã tăng lên v52).
Lần đầu mở khi RTDB trống, ứng dụng tự gieo dữ liệu mẫu và tài khoản `admin`.
Dữ liệu cũ trên Firestore KHÔNG được chuyển sang tự động.
