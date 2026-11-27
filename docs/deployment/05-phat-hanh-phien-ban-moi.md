# 5. Phát hành phiên bản mới

1. Sửa code, đẩy lên nhánh chính (CI `ci.yml` tự chạy kiểm thử).
2. Mở `CHANGELOG.md`, thêm mục lên đầu: `## [1.0.1] - 2026-12-05` với **Chức năng mới / Thay đổi / Lỗi đã sửa**.
3. Tạo tag và đẩy lên:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
   (hoặc GitHub → Releases → *Draft a new release* → tạo tag `v1.0.1`).
4. Tab **Actions → "Build & Phát hành"** tự chạy: kiểm tra → kiểm thử → build EXE (Windows runner) + APK (Ubuntu runner) → kiểm tra file đầu ra → tạo Release → tải lên:
   `AOMAGA-MES-Setup-x64.exe`, `AOMAGA-MES-Setup-x64.exe.blockmap`, `latest.yml` (cho tự cập nhật), `AOMAGA-MES-Android.apk`.
   Nội dung Release (số phiên bản, ngày, thay đổi, lỗi đã sửa, link tải EXE/APK) sinh từ `CHANGELOG.md`.
5. Người dùng Windows nhận bản mới tự động (hỏi trước khi cài). Android: tải APK mới cài đè.

Quy tắc đặt số: `vMAJOR.MINOR.PATCH` — sửa lỗi nhỏ tăng PATCH, thêm chức năng tăng MINOR, thay đổi lớn tăng MAJOR. Số phiên bản Android (`versionCode`) tự tính = MAJOR·1.000.000 + MINOR·1.000 + PATCH nên luôn tăng.
Tag sai định dạng hoặc thiếu mục CHANGELOG → workflow dừng ngay, không tạo Release.
**Thử build không phát hành:** Actions → Build & Phát hành → *Run workflow* (file nằm ở mục Artifacts, không tạo Release).
**Lần phát hành đầu tiên**: chạy thử bằng *Run workflow* trước để xác nhận Windows/Android build được trên GitHub, rồi mới tạo tag `v1.0.0`.
