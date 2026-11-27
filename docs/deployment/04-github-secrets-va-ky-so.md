# 4. GitHub Secrets và ký số

Vào repo → **Settings → Secrets and variables → Actions → New repository secret**. Không bao giờ commit keystore/mật khẩu vào repo (`npm run verify` sẽ chặn).

## 4.1 Android — ký APK Release (bắt buộc cho bản phát hành chính thức)
Tạo keystore **một lần duy nhất**, trên máy có JDK (`keytool`):
```bash
keytool -genkeypair -v -keystore aomaga-release.jks -alias aomaga -keyalg RSA -keysize 2048 -validity 10000
# Linux/macOS:   base64 -w0 aomaga-release.jks > aomaga-release.jks.b64
# Windows PS:    [Convert]::ToBase64String([IO.File]::ReadAllBytes("aomaga-release.jks")) | Set-Content aomaga-release.jks.b64
```
| Secret | Giá trị |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | nội dung file `.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | mật khẩu keystore |
| `ANDROID_KEY_ALIAS` | `aomaga` (alias đã đặt) |
| `ANDROID_KEY_PASSWORD` | mật khẩu khoá (thường trùng mật khẩu keystore) |

**Sao lưu file `.jks` và mật khẩu ở nơi an toàn (ngoài GitHub).** Mất keystore = không thể cập nhật app đã cài trên máy người dùng (phải gỡ và cài lại bản mới). Sau khi nhập Secrets, xoá file `.jks`/`.b64` khỏi máy dùng chung.
Chưa nhập Secrets → workflow vẫn chạy nhưng build **APK debug thử nghiệm** (`AOMAGA-MES-Android-DEBUG.apk`) kèm cảnh báo.

## 4.2 Windows — ký số bộ cài (khuyến nghị, hết cảnh báo SmartScreen)
Cần chứng thư Code Signing (mua từ CA; chứng thư EV sẽ hết cảnh báo SmartScreen ngay, chứng thư thường cần thời gian tích luỹ uy tín).
| Secret | Giá trị |
|---|---|
| `CSC_LINK` | file `.pfx` mã hoá base64 (hoặc URL tải) |
| `CSC_KEY_PASSWORD` | mật khẩu của `.pfx` |

Không có 2 Secret này → bộ cài **không ký** (vẫn dùng được, nhưng SmartScreen cảnh báo). Workflow ghi cảnh báo này vào log; không tuyên bố đã xác minh khi chưa ký.
