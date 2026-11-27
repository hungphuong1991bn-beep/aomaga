# 6. Build thủ công (không bắt buộc — GitHub Actions đã làm tự động)
Cần Node 20+. Windows EXE chỉ nên build trên Windows; APK cần JDK 17 + Android SDK 34.
```bash
npm ci
npm run verify && npm test          # kiểm tra + kiểm thử
npm start                           # chạy thử app desktop (Electron)
npm run dist:win                    # → dist/AOMAGA-MES-Setup-x64.exe (trên Windows)
npm run android:debug               # → android/app/build/outputs/apk/debug/app-debug.apk
# Release có ký: đặt AMG_KEYSTORE_FILE, AMG_KEYSTORE_PASSWORD, AMG_KEY_ALIAS, AMG_KEY_PASSWORD rồi:
npm run android:release
```
Đổi logo: thay `icons/logo-source.png` rồi `python3 scripts/make-icons.py` (cần Pillow).
