/* ===================== KHUNG BẢNG THÍCH ỨNG + PHÂN TRANG (v47) =====================
   Dùng cho tab Đơn hàng và Kế hoạch sản xuất. Mục tiêu: KHÔNG cuộn ngang ở mọi cỡ màn hình.
   - Đo bề rộng thật của khung chứa (clientWidth, cùng hệ đơn vị với bố cục kể cả khi giao diện được phóng 130%).
   - Đủ rộng  → một dòng/đơn theo lưới cột (CSS Grid, cột tự co giãn).
   - Hẹp hơn → mỗi đơn là một "thẻ dòng" gọn 2–4 dòng (flex-wrap), vẫn đủ mọi thông tin.
   - Danh sách dài → phân trang (không nhốt người dùng trong khung cuộn nhỏ). */
const AMG_WIDE_MIN = 1120;
function useBoxWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  const useIso = typeof window !== "undefined" && window.document ? React.useLayoutEffect : useEffect;
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.round(el.clientWidth || 0));
    read();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(read); ro.observe(el); }
    window.addEventListener("resize", read);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", read); };
  }, []);
  return [ref, w];
}
// w = 0: chưa đo được (môi trường không có layout) → coi như màn rộng
function amgIsWide(w) { return !w || w >= AMG_WIDE_MIN; }

const AMG_PAGE_SIZES = [20, 50, 100];
function amgPaginate(list, page, pageSize) {
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const from = (p - 1) * pageSize;
  return { items: list.slice(from, from + pageSize), pages, page: p, from, to: Math.min(list.length, from + pageSize) };
}
function amgPageButtons(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const arr = [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  arr.forEach((n, i) => { if (i > 0 && n - arr[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}
function Pager({ total, page, pageSize, onPage, onSize, sizes }) {
  const pg = amgPaginate({ length: total, slice: () => [] }, page, pageSize);
  const btn = (label, target, disabled, active, key) => rkh("button", { key: key || label, type: "button", disabled, onClick: () => onPage(target), className: "amg-pg" + (active ? " amg-pg--on" : "") }, label);
  return rkh("div", { className: "mes-no-print amg-pager" },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim } }, total === 0 ? "Không có dòng nào" : `Hiển thị ${pg.from + 1}–${pg.to} / ${total}`),
    rkh("div", { style: { display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" } },
      btn("‹", pg.page - 1, pg.page <= 1, false, "prev"),
      amgPageButtons(pg.page, pg.pages).map((n, i) => (n === "…" ? rkh("span", { key: "e" + i, style: { color: COLORS.textFaint, padding: "0 2px" } }, "…") : btn(String(n), n, false, n === pg.page, "p" + n))),
      btn("›", pg.page + 1, pg.page >= pg.pages, false, "next")),
    rkh("label", { style: { fontSize: FZ(13), color: COLORS.textDim, display: "flex", alignItems: "center", gap: 6 } }, "Số dòng/trang",
      rkh("select", { className: "mes-input", style: { width: "auto", padding: "5px 8px" }, value: pageSize, onChange: e => onSize(Number(e.target.value)) }, (sizes || AMG_PAGE_SIZES).map(n => rkh("option", { key: n, value: n }, n)))));
}
// Văn bản dài: cắt gọn tối đa n dòng, rê chuột xem đủ nội dung (title) — không phá bố cục
function Clamp({ text, lines = 2, style, mono }) {
  const t = text === null || text === undefined || text === "" ? "—" : String(text);
  return rkh("div", { title: t === "—" ? undefined : t, className: "amg-clamp" + (mono ? " mes-mono" : ""), style: Object.assign({ WebkitLineClamp: lines }, style || {}) }, t);
}
// Cặp "nhãn nhỏ + giá trị" dùng trong thẻ dòng
function KV({ label, children, style }) {
  return rkh("div", { style: Object.assign({ minWidth: 0 }, style || {}) },
    rkh("div", { className: "amg-kv-l" }, label), rkh("div", { className: "amg-kv-v" }, children));
}
