# 1. Tổng quan kiến trúc

## Một mã nguồn, ba nền tảng
```
index.html + core/ data/ domain/ modules/ ui/ assets/   ← mã nguồn nghiệp vụ (KHÔNG đổi, dùng chung)
        │
        ├── GitHub Pages ........ phục vụ trực tiếp các file trên (Web + PWA + Service Worker)
        ├── scripts/prepare-www.js → www/   (bản sao đã "đóng gói": thư viện CDN → vendor/, bỏ Service Worker, thêm CSP + cầu nối native)
        │        ├── electron/ + electron-builder → AOMAGA-MES-Setup-x64.exe   (Windows)
        │        └── Capacitor (android/)         → AOMAGA-MES-Android.apk     (Android)
```
`www/` là thư mục sinh ra (không commit). File gốc của bản Web **không bị sửa** nên GitHub Pages không bị ảnh hưởng.

## Dữ liệu và đồng bộ
- Cả ba nền tảng chạy **cùng một đoạn mã dữ liệu** (`core/runtime.js`) và cùng Firebase Realtime Database hiện tại (REST + SSE). Không có database thứ hai, không đổi cấu trúc, không nhân bản dữ liệu.
- Ghi sản lượng trên máy tính → luồng SSE đẩy tới điện thoại quản đốc theo đúng cơ chế hiện tại.
- **Mất mạng**: app hiện thanh thông báo "Mất kết nối…" (có sẵn trong runtime.js). Thay đổi được xếp hàng trong localStorage và tự gửi lại khi có mạng; hàng đợi gửi theo từng lô nguyên tử nên không ghi trùng. App **không** báo "thành công" giả.
- Mỗi thiết bị có bộ nhớ đệm riêng (localStorage). Windows: `%APPDATA%\AOMAGA MES\`. Android: bộ nhớ riêng của ứng dụng. Cả hai giữ nguyên khi cập nhật phiên bản.
- Android tắt `allowBackup` để bộ nhớ đệm/hàng đợi chưa gửi không bị khôi phục sang máy khác (tránh gửi trùng).

## Bảo mật
- APK/EXE **không chứa** tài khoản quản trị, private key hay Firebase Admin SDK. Địa chỉ Realtime Database là địa chỉ công khai sẵn có trong `core/runtime.js` (giống bản Web).
- Electron: `contextIsolation`, `sandbox`, không `nodeIntegration`, chặn điều hướng ra ngoài, từ chối mọi quyền thiết bị, CSP chỉ cho phép kết nối tới `*.firebasedatabase.app`.
- Android: chỉ quyền `INTERNET`, chặn HTTP không mã hoá, không backup.
- Khoá ký Android và chứng thư Windows chỉ nằm trong **GitHub Secrets** (xem tài liệu 04).
- Cổng `npm run verify` quét repo tìm keystore/khoá riêng/token trước mỗi build.

> **Lưu ý về Firebase (có từ trước, không thuộc phạm vi thay đổi này):** ứng dụng gọi thẳng REST của Realtime Database và tự quản lý tài khoản (băm SHA-256 trong bộ sưu tập `users`), nên quy tắc (Rules) của database phải cho phép đọc/ghi từ client. Nên rà soát Rules và cân nhắc dùng Firebase Authentication trong một đợt nâng cấp riêng.

## Giới hạn đã biết
| Hạng mục | Trạng thái |
|---|---|
| Thông báo đẩy (push) trên Android | **Chưa có.** Cần hạ tầng FCM (google-services.json + máy chủ gửi). Chưa làm vì chưa có hạ tầng. |
| In / xuất PDF (`window.print`) trên Android | WebView không hỗ trợ. Dùng "Xuất Excel" hoặc in từ Windows/Web. |
| Tự cập nhật Android | Không có. Cài APK mới đè lên (phải cùng khoá ký). |
| Tự cập nhật Windows | Chỉ hoạt động khi repo/Releases **công khai** (repo riêng tư cần token, không nhúng token vào bộ cài). |
| Font Inter / IBM Plex Mono | Vẫn tải từ Google Fonts; mất mạng thì dùng font hệ thống (giao diện vẫn dùng được). |
| Máy sang lô | Chưa gắn công đoạn trong hệ thống nên chưa phân lệnh được (đặc điểm của dữ liệu hiện tại). |
