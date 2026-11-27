#!/usr/bin/env bash
# Chạy toàn bộ kiểm thử AOMAGA MES v52. Cần Node 18+.
# Thư viện test KHÔNG nằm trong source (không có bước build). Cài một lần ở thư mục bất kỳ ngoài project:
#   mkdir -p ~/amg-test && cd ~/amg-test && npm init -y && npm i jsdom@22 react@18.2.0 react-dom@18.2.0 xlsx@0.18.5
# Rồi: NM=~/amg-test/node_modules bash chay_tat_ca.sh
set -u
OUTDIR="${AMG_TEST_OUT:-/tmp/amg-test-out}"; mkdir -p "$OUTDIR"
HERE="$(cd "$(dirname "$0")" && pwd)"; export APP_DIR="${APP_DIR:-$(cd "$HERE/../.." && pwd)}"
export NM="${NM:?Đặt NM=<đường dẫn node_modules chứa jsdom, react, react-dom, xlsx>}"; export NODE_PATH="$NM"
total_fail=0
run(){ local dir="$1" f="$2"; ( cd "$HERE/$dir" && timeout 900 node "$f" > "$OUTDIR/amg_$f.out" 2>&1 ); local rc=$?; local line; line="$(grep -E '[0-9]+ pass, [0-9]+ fail' "$OUTDIR/amg_$f.out" | tail -1)"; [ -z "$line" ] && line="(không có dòng tổng kết)"; printf '%-22s rc=%s  %s\n' "$f" "$rc" "$line"; [ $rc -ne 0 ] && total_fail=$((total_fail+1)); }
run . check_assets.js; run . accept.js; run . accept48.js; run . accept52.js; run . accept55.js; run . accept56.js; run . accept57.js; run . roles.js
# render.js đọc bản chụp dữ liệu do accept.js ghi (/tmp/db.json) nên phải chạy sau accept.js
( cd "$HERE" && timeout 300 node render.js > $OUTDIR/amg_render.out 2>&1 ); rc=$?; printf '%-22s rc=%s  %s PASS, %s FAIL\n' render.js $rc "$(grep -c '^PASS' $OUTDIR/amg_render.out)" "$(grep -c '^FAIL' $OUTDIR/amg_render.out)"; [ $rc -ne 0 ] && total_fail=$((total_fail+1))
for f in e2e12.js e2e48.js e2e_bad.js e2e_header52.js e2e_ops52.js e2e_orders52.js e2e_completed52.js e2e_roles52.js; do run e2e "$f"; done
echo; [ $total_fail -eq 0 ] && echo "TẤT CẢ ĐẠT" || echo "CÓ $total_fail BỘ TEST LỖI"; exit $total_fail
