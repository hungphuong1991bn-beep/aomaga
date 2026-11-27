# 3. Cài đặt trên Android

Yêu cầu Android 5.1 (API 22) trở lên.

1. Mở trang **Releases** của GitHub trên điện thoại → tải `AOMAGA-MES-Android.apk`.
   (Nếu Release ghi *bản thử nghiệm ký debug* thì file tên `AOMAGA-MES-Android-DEBUG.apk` — chỉ để thử, không dùng làm bản chính thức.)
2. Mở file đã tải. Lần đầu Android hỏi **"Cho phép cài đặt ứng dụng từ nguồn này"** → bật cho trình duyệt/Files đang dùng → **Cài đặt**.
3. Mở **AOMAGA MES**, đăng nhập.

## Dùng
- **Nút Quay lại**: đóng hộp thoại đang mở; nếu không còn hộp thoại thì **thu nhỏ ứng dụng** (không thoát, dữ liệu đang nhập giữ nguyên).
- **Xuất Excel / sao lưu / tải báo cáo**: ứng dụng ghi tệp vào bộ nhớ tạm rồi mở hộp thoại **Chia sẻ/Lưu** của Android → chọn *Lưu vào Tệp*, Drive, Zalo, Gmail, hoặc mở bằng Excel.
- Mất mạng: hiện thanh "Mất kết nối…", thay đổi chờ gửi và tự gửi lại khi có mạng.

## Cập nhật
Tải APK phiên bản mới và cài **đè** (giữ nguyên dữ liệu). Chỉ đè được khi **cùng khoá ký** — vì vậy phải giữ keystore cố định (tài liệu 04). Bản debug và bản release có khoá khác nhau, phải gỡ bản này mới cài bản kia.
