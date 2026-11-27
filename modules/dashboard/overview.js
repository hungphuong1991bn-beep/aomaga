/* ===================== TỔNG QUAN – TRUNG TÂM ĐIỀU HÀNH SẢN XUẤT (v57) =====================
   CHỈ XEM · TỔNG HỢP · PHÂN TÍCH · ĐIỀU HÀNH. Không có ô nhập số liệu nghiệp vụ nào ở đây; mọi số lấy tự động từ các tab
   nghiệp vụ qua domain/overview.js (hàm thuần, dữ liệu thật). Nhấn vào bất kỳ chỉ tiêu nào để mở đúng tab/đúng bản ghi.
   Bố cục dùng CLASS (.ov-*) trong ui/globalstyle.js — không dùng style inline cho bố cục nên không bị quy tắc điện thoại ghi đè. */

const OV_TONE = t => COLORS[t] || COLORS.textFaint;
const ovLS = {
  get(k, d) { try { const v = localStorage.getItem("amg_ov_" + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("amg_ov_" + k, String(v)); } catch (e) { /* chế độ riêng tư: bỏ qua */ } }
};
// Icon bổ sung (bộ icon gốc không có Play/Pause/Hourglass)
const OvPlayIcon = ({ size = 18, color }) => React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color || "currentColor", "aria-hidden": true }, React.createElement("path", { d: "M8 5.5v13l11-6.5z" }));
const OvPauseIcon = ({ size = 18, color }) => React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color || "currentColor", "aria-hidden": true }, React.createElement("rect", { x: 6.5, y: 5, width: 4, height: 14, rx: 1 }), React.createElement("rect", { x: 13.5, y: 5, width: 4, height: 14, rx: 1 }));
const OvHourglassIcon = ({ size = 18, color }) => React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color || "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, React.createElement("path", { d: "M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" }));
function ovIcon(name) {
  const map = { Play: OvPlayIcon, Pause: OvPauseIcon, Hourglass: OvHourglassIcon };
  if (map[name]) return map[name];
  try { const f = (new Function("return typeof " + name + " === 'function' ? " + name + " : null"))(); if (f) return f; } catch (e) { /* bỏ qua */ }
  return CircleDot;
}
const ovPct = v => (v === null || v === undefined || Number.isNaN(v) ? "—" : (Math.round(v * 10) / 10).toLocaleString("vi-VN") + "%");
const ovAgo = (ms, nowMs) => {
  const s = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return Math.floor(s / 60) + " phút trước";
  if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
  return Math.floor(s / 86400) + " ngày trước";
};

/* Đồng hồ thời gian thực: tự cập nhật từng giây trong CHÍNH nó (không dựng lại cả trang) */
function OvClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const p = n => String(n).padStart(2, "0"), h = React.createElement;
  return h("div", { className: "ov-clock" },
    h("div", { className: "ov-clock-d" }, h(CalendarDays, { size: 14 }), `${AMG_OV_WD[now.getDay()] === "CN" ? "Chủ nhật" : "Thứ " + (now.getDay() + 1)}, ${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`),
    h("div", { className: "ov-clock-t mes-mono", "data-testid": "ov-clock" }, `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`));
}

/* Thẻ có thể thu gọn (ghi nhớ trên thiết bị) */
function OvCard({ id, title, icon: Icon, note, action, children, flush, className }) {
  const h = React.createElement;
  const [closed, setClosed] = useState(() => ovLS.get("c_" + id, "0") === "1");
  const toggle = () => { setClosed(c => { ovLS.set("c_" + id, c ? "0" : "1"); return !c; }); };
  return h("section", { className: "mes-card ov-card " + (className || ""), "data-ov": id, "data-collapsed": closed ? "1" : "0" },
    h("div", { className: "ov-card-h" },
      h("div", { className: "ov-card-t" }, Icon ? h(Icon, { size: 17 }) : null, h("span", null, title), note ? h("span", { className: "ov-card-n" }, note) : null),
      h("div", { className: "ov-card-a" }, !closed && action ? action : null,
        h("button", { type: "button", className: "ov-fold", onClick: toggle, "aria-expanded": !closed, "aria-label": (closed ? "Mở rộng " : "Thu gọn ") + title, title: closed ? "Mở rộng" : "Thu gọn" }, closed ? h(ChevronDown, { size: 16 }) : h(ChevronUp, { size: 16 })))),
    closed ? null : h("div", { className: "ov-card-b" + (flush ? " ov-card-b--flush" : "") }, children));
}
const ovEmpty = txt => React.createElement("div", { className: "ov-empty" }, txt);
function OvBar({ pct, tone, thin }) {
  const v = pct === null || pct === undefined ? 0 : Math.max(0, Math.min(100, pct));
  return React.createElement("div", { className: "ov-pbar" + (thin ? " ov-pbar--thin" : ""), role: "progressbar", "aria-valuenow": Math.round(v), "aria-valuemin": 0, "aria-valuemax": 100 },
    React.createElement("i", { style: { width: v + "%", background: OV_TONE(tone) } }));
}

/* ---------- 1. Lời chào ---------- */
function OvBanner({ user, ov, onRefresh, refreshing }) {
  const h = React.createElement;
  const roleKey = amgRoleOf(user), role = AMG_ROLES[roleKey] || "";
  const unit = amgIsPower(user) ? "" : user.team ? `Tổ ${user.team}` : "";
  const name = String(user.fullName || user.username || "").trim() || "bạn";
  const shift = amgCurrentShift(ov.now);
  return h("section", { className: "ov-banner", "aria-label": "Lời chào" },
    h("div", { className: "ov-banner-l" },
      h("div", { className: "ov-greet" }, `${amgOvGreeting(ov.now)}!`),
      h("h1", { className: "ov-hello mes-display", "data-testid": "ov-hello" }, `Xin chào, ${name}!`),
      h("div", { className: "ov-desc" }, "Chào mừng bạn đến với Trung tâm điều hành sản xuất AOMAGA MES."),
      h("div", { className: "ov-tags" },
        h("span", { className: "ov-tag", "data-testid": "ov-role" }, [role, unit].filter(Boolean).join(" · ") || "Tài khoản"),
        h("span", { className: "ov-tag" }, `${shift.label} · ${shift.range}`),
        h("span", { className: "ov-tag" }, ov.scope.power ? "Toàn nhà máy" : "Theo quyền được cấp"))),
    h("div", { className: "ov-banner-r" },
      h(OvClock, null),
      h("div", { className: "ov-banner-act" },
        h(SyncBadge, null),
        h("button", { type: "button", className: "ov-refresh", onClick: onRefresh, "aria-busy": refreshing ? "true" : "false", "aria-label": "Làm mới dữ liệu", title: "Nối lại luồng dữ liệu, gửi thay đổi đang chờ và tính lại số liệu" },
          h(RefreshCw, { size: 15, className: refreshing ? "ov-spin" : "" }), "Làm mới"))));
}

/* ---------- 2. KPI ---------- */
function OvKpiCard({ k, go, enabled }) {
  const h = React.createElement, c = OV_TONE(k.tone), Ic = ovIcon(k.icon), empty = k.value === null || k.value === undefined;
  const body = [
    h("div", { key: "t", className: "ov-kpi-top" }, h("span", { className: "ov-kpi-ic", style: { background: c + "1F", color: c } }, h(Ic, { size: 20, color: c })), h("span", { className: "ov-kpi-l" }, k.label)),
    h("div", { key: "v", className: "ov-kpi-v" + (empty ? " ov-kpi-v--empty" : ""), style: { color: empty ? undefined : c } }, empty ? "Chưa có dữ liệu" : (typeof k.value === "number" ? fmtNum(k.value) : k.value), k.unit && !empty ? h("small", null, " " + k.unit) : null),
    k.pct !== null && k.pct !== undefined ? h("div", { key: "b", className: "ov-kpi-bar" }, h(OvBar, { pct: k.pct, tone: k.tone, thin: true })) : null,
    k.sub ? h("div", { key: "s", className: "ov-kpi-s" }, k.delta ? h("b", { className: "ov-delta" }, "↑ " + k.delta + " ") : null, k.delta ? k.sub.replace(/^\+\d+\s*/, "") : k.sub) : null
  ];
  const props = { className: "ov-kpi", "data-kpi": k.key, title: k.source ? "Nguồn dữ liệu: " + k.source : undefined, style: { borderTopColor: c, background: `linear-gradient(180deg, ${c}0F, transparent 70%), var(--c-panel)` } };
  return enabled ? h("button", Object.assign({ type: "button", onClick: () => go(k.target), "aria-label": k.label + ": " + (empty ? "chưa có dữ liệu" : k.value) + ". Nhấn để mở." }, props), body) : h("div", props, body);
}

/* ---------- 3. Tiến độ theo công đoạn ---------- */
const OV_ST = { late: ["Chậm", "red"], warn: ["Cần theo dõi", "amber"], ok: ["Đúng tiến độ", "green"], none: ["Chưa có kế hoạch", "textFaint"] };
function OvStageTable({ ov, go, can }) {
  const h = React.createElement, rows = ov.stageRows;
  const active = rows.some(r => r.units.length || r.machines.total || r.orders);
  const units = (r, f) => r.units.length ? r.units.map(u => h("div", { key: u, className: "ov-unit-line" }, `${fmtNum(f(r.byUnit[u]))} ${u}`)) : "—";
  return h(OvCard, { id: "stages", title: "Tiến độ sản xuất theo công đoạn", icon: BarChart3, note: "Đơn đang mở", flush: true,
    action: can.orders ? h("button", { type: "button", className: "ov-link", onClick: () => go({ tab: "orders", focus: null }) }, "Xem chi tiết ", h(ArrowRight, { size: 13 })) : null },
    !active ? ovEmpty("Chưa có đơn đang mở hoặc máy thuộc công đoạn.") : h("div", { className: "ov-stbl", role: "table", "aria-label": "Tiến độ theo công đoạn" },
      h("div", { className: "ov-strow ov-strow--h", role: "row" }, ["Công đoạn", "Đơn hàng", "Máy chạy", "Máy chờ", "Kế hoạch", "Thực tế", "Còn lại", "Hoàn thành"].map(t => h("div", { key: t, role: "columnheader" }, t))),
      rows.map(r => {
        const st = OV_ST[r.status], tone = st[1], main = r.mainUnit ? r.byUnit[r.mainUnit] : null;
        return h("button", { key: r.key, type: "button", className: "ov-strow ov-strow--" + r.status, "data-stage": r.key, role: "row", onClick: () => go({ tab: "orders", focus: { stage: r.key } }), title: `Mở các đơn có công đoạn ${r.label}` },
          h("div", { className: "ov-st-name", "data-l": "Công đoạn" }, h("i", { className: "ov-dot", style: { background: r.color } }), h("b", null, r.label), r.status === "late" || r.status === "warn" ? h("span", { className: "ov-chip ov-chip--" + tone }, r.status === "late" ? "⚠ Chậm" : "Theo dõi") : null),
          h("div", { "data-l": "Đơn hàng" }, r.orders),
          h("div", { "data-l": "Máy chạy", className: "ov-ok" }, r.machines.total ? r.machines.running : "—"),
          h("div", { "data-l": "Máy chờ" }, r.machines.total ? [r.machines.waiting, r.machines.stopped ? h("small", { key: "s", className: "ov-muted" }, ` (+${r.machines.stopped} dừng)`) : null] : "—"),
          h("div", { "data-l": "Kế hoạch" }, units(r, x => x.plan)),
          h("div", { "data-l": "Thực tế" }, units(r, x => x.done)),
          h("div", { "data-l": "Còn lại" }, units(r, x => Math.max(0, Math.round((x.plan - x.done) * 100) / 100))),
          h("div", { "data-l": "Hoàn thành", className: "ov-st-pct" }, main ? [h(OvBar, { key: "b", pct: main.pct, tone }), h("span", { key: "p", className: "ov-pct", style: { color: OV_TONE(tone) } }, ovPct(main.pct)), r.units.length > 1 ? h("small", { key: "o", className: "ov-muted" }, r.units.filter(u => u !== r.mainUnit).map(u => `${ovPct(r.byUnit[u].pct)} ${u}`).join(" · ")) : null] : h("span", { className: "ov-muted" }, "—")));
      }),
      h("div", { className: "ov-legend" }, h("span", null, h("i", { style: { background: COLORS.green } }), "Đúng tiến độ"), h("span", null, h("i", { style: { background: COLORS.amber } }), "Có đơn sắp đến hạn/nguy cơ chậm chưa xong công đoạn"), h("span", null, h("i", { style: { background: COLORS.red } }), "Có đơn đã trễ hạn chưa xong công đoạn"), h("span", null, "kg và m tính riêng, không cộng lẫn"))));
}

/* ---------- 4. Điều hành máy móc ---------- */
function OvRing({ pct, size = 48, tone }) {
  const t = 6, r = (size - t) / 2, C = 2 * Math.PI * r, v = pct === null ? 0 : Math.max(0, Math.min(100, pct)), c = OV_TONE(tone || (v >= 80 ? "green" : v >= 50 ? "amber" : "red"));
  return React.createElement("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, className: "ov-ring", role: "img", "aria-label": "Tỷ lệ hoạt động " + ovPct(pct) },
    React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--c-border)", strokeWidth: t }),
    pct === null ? null : React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: c, strokeWidth: t, strokeLinecap: "round", strokeDasharray: `${C * v / 100} ${C}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }),
    React.createElement("text", { x: "50%", y: "50%", textAnchor: "middle", dominantBaseline: "central", fontSize: size * 0.26, fontWeight: 800, fill: "var(--c-text)" }, pct === null ? "—" : Math.round(v) + "%"));
}
const OV_MST = { running: ["Đang chạy", "green"], assigned: ["Chờ chạy", "blue"], paused: ["Tạm dừng", "amber"], idle: ["Rảnh", "textFaint"], maintenance: ["Bảo trì", "violet"], broken: ["Hỏng/dừng", "red"] };
function OvMachines({ ov, go, can }) {
  const h = React.createElement;
  const [open, setOpen] = useState(null);
  const [fl, setFl] = useState("all");
  const g = ov.groups.find(x => x.key === open) || null;
  const total = ov.counts.machines.total;
  const pickGroup = k => { setOpen(o => (o === k ? null : k)); setFl("all"); };
  const list = g ? g.list.filter(m => fl === "all" || m.bucket === fl) : [];
  return h(OvCard, { id: "machines", title: `Điều hành máy móc (${ov.groups.filter(x => x.total > 0).length} nhóm – ${total} máy)`, icon: Cog, flush: true,
    action: h("button", { type: "button", className: "ov-link", onClick: () => go({ tab: "machines", focus: { screen: "monitor" }, groupKey: "all" }) }, "Xem chi tiết ", h(ArrowRight, { size: 13 })) },
    total === 0 ? ovEmpty("Chưa có dữ liệu máy móc.") : h("div", null,
      h("div", { className: "ov-mgrid" }, ov.groups.map(x => h("button", { key: x.key, type: "button", className: "ov-mg" + (open === x.key ? " ov-mg--on" : "") + (x.flags.length ? " ov-mg--warn" : ""), "data-group": x.key, "aria-expanded": open === x.key, onClick: () => pickGroup(x.key), title: `Xem danh sách ${x.total} máy của nhóm ${x.label}`, style: { borderLeftColor: x.color } },
        h("div", { className: "ov-mg-main" },
          h("div", { className: "ov-mg-n" }, x.label.replace(/^Máy\s+/, "Máy ")),
          h("div", { className: "ov-mg-c" }, h("b", null, x.total), " máy"),
          h("div", { className: "ov-mg-s" }, h("span", { className: "ov-ok" }, "● ", x.running, " chạy"), h("span", { className: "ov-wait" }, "● ", x.waiting, " chờ"), h("span", { className: "ov-stop" }, "● ", x.stopped, " dừng"))),
        h(OvRing, { pct: x.rate }),
        x.flags.length ? h("div", { className: "ov-mg-flag" }, "⚠ " + x.flags.join(" · ")) : null))),
      g ? h("div", { className: "ov-mdetail", "data-testid": "ov-mdetail" },
        h("div", { className: "ov-mdetail-h" },
          h("b", null, `${g.label} — ${g.total} máy`),
          h("div", { className: "ov-mdetail-f" },
            [["all", `Tất cả (${g.total})`], ["running", `Chạy (${g.running})`], ["waiting", `Chờ (${g.waiting})`], ["stopped", `Dừng (${g.stopped})`]].map(([k, l]) => h("button", { key: k, type: "button", className: "ov-pill", "aria-pressed": fl === k, onClick: () => setFl(k) }, l)),
            h("button", { type: "button", className: "ov-link", onClick: () => go({ tab: "machines", focus: { screen: "monitor" }, groupKey: g.key }) }, "Mở nhóm trong Giám sát máy móc ", h(ArrowRight, { size: 13 })))),
        list.length === 0 ? ovEmpty("Không có máy nào ở trạng thái này.") : h("div", { className: "ov-mlist" }, list.map(m => {
          const meta = OV_MST[m.unknown ? "idle" : m.state] || OV_MST.idle, c = OV_TONE(meta[1]);
          return h("button", { key: m.id, type: "button", className: "ov-mi", "data-machine": m.id, onClick: () => go({ tab: "machines", focus: { screen: "monitor", machineId: m.id, history: m.id }, groupKey: g.key }), title: `Mở chi tiết máy ${m.id}`, style: { borderLeftColor: c } },
            h("div", { className: "ov-mi-t" }, h("b", { className: "mes-mono" }, m.id), h("span", { style: { color: c } }, m.unknown ? "Chưa xác nhận" : meta[0])),
            h("div", { className: "ov-mi-d" }, m.order ? m.order : (m.note || "Chưa có lệnh sản xuất")),
            m.order ? h("div", { className: "ov-mi-d" }, [m.stageLabel, m.pct !== null ? m.pct + "%" : "", m.operator].filter(Boolean).join(" · ")) : null);
        }))) : h("div", { className: "ov-hint" }, "Nhấn vào một nhóm máy để xem danh sách máy; nhấn một máy để mở chi tiết máy đó.")));
}

/* ---------- 5. Đơn hàng cần chú ý ---------- */
const OV_TABS = [["overdue", "Trễ hạn", "red", i => i.overdue], ["soon", "Sắp đến hạn", "amber", i => i.dueSoon && !i.overdue], ["producing", "Đang sản xuất", "blue", i => i.producing], ["unassigned", "Chưa bố trí", "textDim", i => i.unassigned], ["risk", "Nguy cơ chậm tiến độ", "violet", i => i.risk]];
const OV_SORTS = { due: "Hạn giao", pct: "Tiến độ", remain: "Còn lại", customer: "Khách hàng", qty: "Số lượng đặt" };
function ovCmp(key, dir) {
  const na = v => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
  const val = { due: i => i.days, pct: i => i.pct, remain: i => i.remain, qty: i => i.qty, customer: i => (i.customer || "").toLowerCase() }[key] || (i => i.days);
  return (a, b) => { const x = val(a), y = val(b); if (na(x) && na(y)) return 0; if (na(x)) return 1; if (na(y)) return -1; return (typeof x === "string" ? x.localeCompare(y, "vi") : x - y) * dir; };
}
function OvOrders({ ov, go, can }) {
  const h = React.createElement, cnt = ov.attention.counts;
  const first = OV_TABS.find(t => cnt[t[0]] > 0);
  const [tab, setTab] = useState(() => (first ? first[0] : "overdue"));
  const [q, setQ] = useState(""), [stage, setStage] = useState("all"), [cust, setCust] = useState("all");
  const [sort, setSort] = useState({ key: "due", dir: 1 }), [limit, setLimit] = useState(12);
  const def = OV_TABS.find(t => t[0] === tab) || OV_TABS[0];
  const t = q.trim().toLowerCase();
  const rows = useMemo(() => ov.orderItems.filter(def[3]).filter(i => (stage === "all" || i.stageKey === stage) && (cust === "all" || (i.customer || "Chưa rõ") === cust)
    && (!t || [i.customer, i.spec, i.stageLabel, i.machines.join(" "), i.statusLabel].join(" ").toLowerCase().indexOf(t) > -1)).sort(ovCmp(sort.key, sort.dir)), [ov, tab, q, stage, cust, sort]);
  const setS = k => setSort(s => (s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: 1 }));
  const th = (k, l) => h("div", { key: l, role: "columnheader" }, k ? h("button", { type: "button", className: "ov-th", onClick: () => setS(k), "aria-label": "Sắp xếp theo " + l }, l, sort.key === k ? (sort.dir > 0 ? " ▲" : " ▼") : "") : l);
  return h(OvCard, { id: "orders", title: "Đơn hàng cần chú ý", icon: AlertCircle, note: `${ov.counts.open} đơn đang mở`, flush: true,
    action: h("button", { type: "button", className: "ov-link", onClick: () => go({ tab: "orders", focus: null }) }, "Xem tất cả ", h(ArrowRight, { size: 13 })) },
    h("div", { className: "ov-otabs", role: "tablist" }, OV_TABS.map(([k, l, tone]) => h("button", { key: k, type: "button", role: "tab", "aria-selected": tab === k, className: "ov-otab", "data-tab": k, onClick: () => { setTab(k); setLimit(12); }, style: tab === k ? { borderColor: OV_TONE(tone), color: OV_TONE(tone), background: OV_TONE(tone) + "14" } : undefined }, `${l} (${cnt[k]})`))),
    h("div", { className: "ov-ofilters" },
      h("div", { className: "ov-search" }, h(Search, { size: 15 }), h("input", { type: "search", className: "mes-input", placeholder: "Tìm khách hàng, quy cách, máy, công đoạn…", value: q, onChange: e => { setQ(e.target.value); setLimit(12); }, "aria-label": "Tìm trong danh sách đơn hàng" })),
      h("select", { className: "mes-input", value: stage, onChange: e => setStage(e.target.value), "aria-label": "Lọc theo công đoạn hiện tại" }, h("option", { value: "all" }, "Mọi công đoạn"), STAGES.map(s => h("option", { key: s.key, value: s.key }, s.label))),
      h("select", { className: "mes-input", value: cust, onChange: e => setCust(e.target.value), "aria-label": "Lọc theo khách hàng" }, h("option", { value: "all" }, "Mọi khách hàng"), ov.attention.customers.map(c => h("option", { key: c, value: c }, c))),
      h("select", { className: "mes-input", value: sort.key, onChange: e => setSort(s => ({ key: e.target.value, dir: s.dir })), "aria-label": "Sắp xếp theo" }, Object.entries(OV_SORTS).map(([k, l]) => h("option", { key: k, value: k }, "Sắp xếp: " + l))),
      h("button", { type: "button", className: "ov-pill", onClick: () => setSort(s => ({ key: s.key, dir: -s.dir })), "aria-label": "Đổi chiều sắp xếp" }, sort.dir > 0 ? "Tăng dần ▲" : "Giảm dần ▼")),
    rows.length === 0 ? ovEmpty(ov.counts.open === 0 ? "Hiện không có đơn hàng nào đang mở." : "Không có đơn nào khớp bộ lọc này.") : h("div", { className: "ov-otbl", role: "table", "aria-label": "Đơn hàng cần chú ý" },
      h("div", { className: "ov-orow ov-orow--h", role: "row" }, th("customer", "Khách hàng / Quy cách"), th("qty", "SL đặt"), th(null, "Đã thực hiện"), th("remain", "Còn lại"), th(null, "Công đoạn"), th(null, "Máy"), th("due", "Giao hàng"), th(null, "Trạng thái"), th("pct", "Tiến độ")),
      rows.slice(0, limit).map(i => {
        const tone = i.tone, due = i.deliveryDate ? i.deliveryDate.split("-").reverse().join("/") : "—";
        return h("button", { key: i.id, type: "button", className: "ov-orow ov-orow--" + i.statusKey, role: "row", "data-order": i.id, onClick: () => go({ tab: "orders", focus: { orderId: i.id } }), title: "Mở chi tiết đơn hàng" },
          h("div", { className: "ov-o-name", "data-l": "Khách hàng" }, h("b", null, i.customer || "—"), h("small", null, i.spec || "Chưa có quy cách")),
          h("div", { "data-l": "SL đặt" }, i.qty === null ? "—" : `${fmtNum(i.qty)} ${i.unit}`),
          h("div", { "data-l": "Đã thực hiện" }, `${fmtNum(i.done)} ${i.unit}`),
          h("div", { "data-l": "Còn lại" }, i.remain === null ? "—" : `${fmtNum(i.remain)} ${i.unit}`),
          h("div", { "data-l": "Công đoạn" }, i.stageLabel || h("span", { className: "ov-muted" }, "—")),
          h("div", { "data-l": "Máy", className: "mes-mono" }, i.machines.length ? i.machines.join(", ") : h("span", { className: "ov-muted" }, "—")),
          h("div", { "data-l": "Giao hàng" }, due, i.days !== null ? h("small", { style: { color: i.overdue ? COLORS.red : i.dueSoon ? COLORS.amber : undefined } }, i.days < 0 ? `Trễ ${-i.days} ngày` : i.days === 0 ? "Hôm nay" : `Còn ${i.days} ngày`) : null),
          h("div", { "data-l": "Trạng thái" }, h("span", { className: "ov-chip", style: { color: OV_TONE(tone), background: OV_TONE(tone) + "1A", borderColor: OV_TONE(tone) + "55" } }, i.statusLabel)),
          h("div", { "data-l": "Tiến độ", className: "ov-o-pct" }, i.pct === null ? h("span", { className: "ov-muted" }, "—") : [h(OvBar, { key: "b", pct: i.pct, tone: i.pct >= 100 ? "green" : i.overdue ? "red" : "blue" }), h("span", { key: "p", className: "ov-pct" }, ovPct(i.pct))]));
      }),
      h("div", { className: "ov-more" }, h("span", { className: "ov-muted" }, `Hiển thị ${Math.min(limit, rows.length)} / ${rows.length} đơn`), rows.length > limit ? h("button", { type: "button", className: "ov-pill", onClick: () => setLimit(l => l + 12) }, "Hiện thêm 12 đơn") : null)));
}

/* ---------- 6. Hiệu suất sản xuất (biểu đồ từ dữ liệu thật) ---------- */
function ovNiceMax(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
function OvBars({ buckets, unit, color, label }) {
  const h = React.createElement, vals = buckets.map(b => b[unit] || 0), max = Math.max(0, ...vals);
  if (!(max > 0)) return ovEmpty("Chưa có sản lượng thành phẩm " + unit + " trong kỳ này.");
  const top = ovNiceMax(max), step = buckets.length > 20 ? 3 : buckets.length > 12 ? 2 : 1;
  return h("div", { className: "ov-chart", role: "img", "aria-label": `${label}: ${buckets.map(b => `${b.label} ${fmtNum(b[unit] || 0)} ${unit}`).join(", ")}` },
    h("div", { className: "ov-chart-y" }, [top, top / 2, 0].map(t => h("span", { key: t }, fmtNum(t))), h("em", null, unit)),
    h("div", { className: "ov-chart-plot" },
      h("div", { className: "ov-chart-grid" }, [0, 1, 2].map(i => h("i", { key: i }))),
      h("div", { className: "ov-bars", style: { gridTemplateColumns: `repeat(${buckets.length},minmax(0,1fr))` } }, buckets.map((b, idx) => h("div", { key: b.key, className: "ov-bcol", title: `${b.label}${b.sub ? " " + b.sub : ""}: ${fmtNum(b[unit] || 0)} ${unit}` },
        h("span", { className: "ov-bv" }, buckets.length <= 10 && b[unit] ? fmtNum(b[unit]) : ""),
        h("div", { className: "ov-btrack" }, h("i", { style: { height: Math.max(b[unit] > 0 ? 2 : 0, (b[unit] || 0) / top * 100) + "%", background: color } })),
        h("span", { className: "ov-bl" }, idx % step === 0 ? b.label : ""),
        h("span", { className: "ov-bs" }, idx % step === 0 && b.sub ? b.sub : ""))))));
}
function OvHBars({ rows, unit, tone2 }) {
  const h = React.createElement;
  const max = Math.max(0, ...rows.map(r => Math.max(r.a || 0, r.b || 0)));
  if (!(max > 0)) return ovEmpty("Chưa có dữ liệu " + unit + " để vẽ biểu đồ.");
  return h("div", { className: "ov-hbars" }, rows.map(r => h("div", { key: r.key, className: "ov-hb" },
    h("div", { className: "ov-hb-l" }, h("i", { className: "ov-dot", style: { background: r.color } }), r.label),
    h("div", { className: "ov-hb-bars" },
      r.a !== undefined && r.a !== null ? h("div", { className: "ov-hb-row", title: `${r.aLabel}: ${fmtNum(r.a)} ${unit}` }, h("div", { className: "ov-hb-t" }, h("i", { style: { width: (r.a / max * 100) + "%", background: "var(--c-border2)" } })), h("span", null, fmtNum(r.a))) : null,
      r.b !== undefined && r.b !== null ? h("div", { className: "ov-hb-row", title: `${r.bLabel}: ${fmtNum(r.b)} ${unit}` }, h("div", { className: "ov-hb-t" }, h("i", { style: { width: (r.b / max * 100) + "%", background: r.color } })), h("span", null, fmtNum(r.b))) : null))));
}
function OvDonut({ segs, size = 132, thick = 18, center, sub }) {
  const h = React.createElement, total = segs.reduce((s, x) => s + x.n, 0), r = (size - thick) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return h("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, className: "ov-donut", role: "img", "aria-label": segs.map(s => `${s.label}: ${s.n}`).join(", ") },
    h("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--c-border)", strokeWidth: thick }),
    total > 0 ? segs.filter(s => s.n > 0).map(s => { const len = C * s.n / total, el = h("circle", { key: s.label, cx: size / 2, cy: size / 2, r, fill: "none", stroke: OV_TONE(s.tone), strokeWidth: thick, strokeDasharray: `${len} ${C - len}`, strokeDashoffset: -acc, transform: `rotate(-90 ${size / 2} ${size / 2})` }); acc += len; return el; }) : null,
    h("text", { x: "50%", y: sub ? "46%" : "50%", textAnchor: "middle", dominantBaseline: "central", fontSize: size * 0.19, fontWeight: 800, fill: "var(--c-text)" }, center),
    sub ? h("text", { x: "50%", y: "63%", textAnchor: "middle", dominantBaseline: "central", fontSize: size * 0.085, fill: "var(--c-faint)" }, sub) : null);
}
const OvLegend = ({ segs }) => React.createElement("ul", { className: "ov-lg" }, segs.map(s => React.createElement("li", { key: s.label }, React.createElement("i", { style: { background: OV_TONE(s.tone) } }), React.createElement("span", null, s.label), React.createElement("b", null, fmtNum(s.n)))));
function OvPerformance({ ov, period, setPeriod, from, to, setFrom, setTo }) {
  const h = React.createElement, C = ov.charts, out = C.output;
  const has = u => out.total[u] > 0 || out.buckets.some(b => b[u] > 0) || C.stageOutput.some(s => s.out[u] > 0) || C.planVsActual.some(s => s.units.indexOf(u) > -1);
  const avail = ["kg", "m"].filter(has), [unitSel, setUnit] = useState("kg"), unit = avail.indexOf(unitSel) > -1 ? unitSel : (avail[0] || "kg");
  const seg = (items, cur, set, label) => h("div", { className: "dx-seg", role: "group", "aria-label": label }, Object.entries(items).map(([k, v]) => h("button", { key: k, type: "button", onClick: () => set(k), "aria-pressed": cur === k }, v)));
  const r = out.range, fmtD = k => k.split("-").reverse().join("/");
  const today = ov.todayKey;
  const pva = C.planVsActual.filter(s => s.byUnit[unit]).map(s => ({ key: s.key, label: s.label, color: s.color, a: s.byUnit[unit].plan, aLabel: "Kế hoạch", b: s.byUnit[unit].done, bLabel: "Thực tế" }));
  const so = C.stageOutput.filter(s => s.out[unit] > 0).map(s => ({ key: s.key, label: s.label, color: s.color, b: s.out[unit], bLabel: "Sản lượng" }));
  const cr = C.orderProgress.completionRate;
  return h(OvCard, { id: "perf", title: "Hiệu suất sản xuất", icon: TrendingUp, note: `${fmtD(r.from)}${r.from === r.to ? "" : " – " + fmtD(r.to)}`,
    action: h("div", { className: "ov-filters" }, seg(AMG_OV_PERIODS, period, setPeriod, "Kỳ báo cáo"), avail.length > 1 ? seg({ kg: "kg", m: "m" }, unit, setUnit, "Đơn vị") : null) },
    period === "custom" ? h("div", { className: "ov-range" },
      h("label", null, "Từ ngày", h("input", { type: "date", className: "mes-input", value: from, max: to || today, onChange: e => setFrom(e.target.value), "aria-label": "Từ ngày" })),
      h("label", null, "Đến ngày", h("input", { type: "date", className: "mes-input", value: to, min: from, max: today, onChange: e => setTo(e.target.value), "aria-label": "Đến ngày" })),
      r.clamped ? h("span", { className: "ov-muted" }, `Tối đa ${AMG_OV_MAX_SPAN_DAYS} ngày — đã tự rút gọn về ${fmtD(r.from)} – ${fmtD(r.to)}`) : null) : null,
    h("div", { className: "ov-perf" },
      h("div", { className: "ov-pc ov-pc--wide" }, h("div", { className: "ov-pc-t" }, `Sản lượng thành phẩm theo ${out.bucketLabel} `, h("small", null, `(${unit}) · tổng kỳ: ${amgFmtUnits(out.total)}`)),
        h(OvBars, { buckets: out.buckets, unit, color: COLORS.blue, label: "Sản lượng theo " + out.bucketLabel }),
        h("div", { className: "ov-note" }, "Thành phẩm = sản lượng ghi tại công đoạn cuối của quy trình mỗi đơn (nhật ký sản lượng). kg và m không cộng lẫn.")),
      h("div", { className: "ov-pc" }, h("div", { className: "ov-pc-t" }, "Kế hoạch so với thực tế ", h("small", null, `(${unit}, đơn đang mở)`)),
        pva.length ? [h("div", { key: "lg", className: "ov-lg2" }, h("span", null, h("i", { style: { background: "var(--c-border2)" } }), "Kế hoạch (số lượng đặt)"), h("span", null, h("i", { style: { background: COLORS.blue } }), "Thực tế (đã làm)")), h(OvHBars, { key: "b", rows: pva, unit })] : ovEmpty("Chưa có đơn đang mở theo " + unit + ".")),
      h("div", { className: "ov-pc" }, h("div", { className: "ov-pc-t" }, "Tiến độ hoàn thành đơn hàng"),
        C.orderProgress.total === 0 ? ovEmpty("Chưa có đơn hàng.") : h("div", { className: "ov-donutbox" }, h(OvDonut, { segs: [{ label: "Đã hoàn thành", n: C.orderProgress.completed, tone: "green" }, { label: "Đang mở", n: C.orderProgress.open, tone: "blue" }], center: cr === null ? "—" : ovPct(cr), sub: "đơn đã hoàn thành" }),
          h(OvLegend, { segs: [{ label: "Đã hoàn thành", n: C.orderProgress.completed, tone: "green" }].concat(C.orderProgress.buckets.map(b => ({ label: "Đang mở · " + b.label, n: b.n, tone: b.tone }))) }))),
      h("div", { className: "ov-pc" }, h("div", { className: "ov-pc-t" }, "Tình trạng máy móc ", h("small", null, `(${ov.counts.machines.total} máy)`)),
        ov.counts.machines.total === 0 ? ovEmpty("Chưa có dữ liệu máy.") : h("div", { className: "ov-donutbox" }, h(OvDonut, { segs: C.machineStatus, center: ov.counts.machines.total ? ovPct(ov.counts.machines.running / ov.counts.machines.total * 100) : "—", sub: "đang chạy" }), h(OvLegend, { segs: C.machineStatus.filter(s => s.n > 0) }))),
      h("div", { className: "ov-pc" }, h("div", { className: "ov-pc-t" }, "Sản lượng theo công đoạn ", h("small", null, `(${unit}, ${PERIOD_LABEL(period)})`)),
        so.length ? h(OvHBars, { rows: so, unit }) : ovEmpty("Chưa có sản lượng " + unit + " ghi nhận trong kỳ này."))));
}
const PERIOD_LABEL = p => (AMG_OV_PERIODS[p] || "kỳ").toLowerCase();

/* ---------- 7. Cảnh báo & 8. Hoạt động ---------- */
const OV_LV = { err: "red", warn: "amber", info: "blue" };
function OvAlerts({ ov, go, canGo }) {
  const h = React.createElement, [all, setAll] = useState(false), list = all ? ov.alerts : ov.alerts.slice(0, 8);
  const hi = ov.alerts.filter(a => a.level === "err").length;
  return h(OvCard, { id: "alerts", title: "Cảnh báo & việc cần xử lý", icon: AlertCircle, note: hi ? `${hi} mức cao` : "", flush: true, className: "ov-card--alerts",
    action: h("span", { className: "ov-badge", style: { background: ov.alerts.length ? COLORS.red : COLORS.green }, "data-testid": "ov-alert-count" }, ov.alerts.length) },
    ov.alerts.length === 0 ? ovEmpty("Không có cảnh báo từ dữ liệu hiện có.") : h("div", { className: "ov-alist" },
      list.map(a => {
        const clickable = a.target && canGo(a.target), c = OV_TONE(OV_LV[a.level]);
        const body = [h("span", { key: "d", className: "ov-adot", style: { background: c } }),
          h("span", { key: "b", className: "ov-abody" }, h("span", { className: "ov-at" }, a.title), a.detail ? h("span", { className: "ov-ad" }, a.detail) : null,
            h("span", { className: "ov-am" }, h("span", { className: "ov-chip", style: { color: c, background: c + "1A", borderColor: c + "55" } }, "Ưu tiên " + a.priority.toLowerCase()), h("span", { className: "ov-muted" }, a.at ? (typeof a.at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.at) ? "Hạn giao " + a.at.split("-").reverse().join("/") : fmtDateTime(a.at)) : "Đang diễn ra"))),
          clickable ? h("span", { key: "g", className: "ov-ago" }, "Xử lý →") : null];
        return clickable ? h("button", { key: a.id, type: "button", className: "ov-alert", "data-alert": a.id, "data-kind": a.kind, onClick: () => go(a.target) }, body) : h("div", { key: a.id, className: "ov-alert ov-alert--static", "data-alert": a.id, "data-kind": a.kind }, body);
      }),
      ov.alerts.length > 8 ? h("div", { className: "ov-more" }, h("button", { type: "button", className: "ov-pill", onClick: () => setAll(v => !v) }, all ? "Thu gọn" : `Xem tất cả ${ov.alerts.length} cảnh báo`)) : null));
}
function OvActivity({ ov, go, canGo }) {
  const h = React.createElement, [n, setN] = useState(10), list = ov.activity.slice(0, n);
  return h(OvCard, { id: "activity", title: "Hoạt động gần đây", icon: History, note: ov.activity.length ? `${ov.activity.length} sự kiện` : "", flush: true },
    ov.activity.length === 0 ? ovEmpty("Chưa có hoạt động nào được ghi nhận trong phạm vi bạn được xem.") : h("div", { className: "ov-alist" },
      list.map(e => {
        const clickable = e.target && canGo(e.target), c = OV_TONE(e.tone);
        const body = [h("span", { key: "d", className: "ov-adot", style: { background: c } }), h("span", { key: "b", className: "ov-abody" }, h("span", { className: "ov-at" }, e.title), e.detail ? h("span", { className: "ov-ad" }, e.detail) : null, h("span", { className: "ov-am" }, h("span", { className: "ov-muted" }, [e.user, fmtDateTime(e.at)].filter(Boolean).join(" · ")))), h("span", { key: "t", className: "ov-ago" }, ovAgo(e.at, ov.nowMs))];
        return clickable ? h("button", { key: e.id, type: "button", className: "ov-alert", "data-act": e.kind, onClick: () => go(e.target) }, body) : h("div", { key: e.id, className: "ov-alert ov-alert--static", "data-act": e.kind }, body);
      }),
      ov.activity.length > n ? h("div", { className: "ov-more" }, h("button", { type: "button", className: "ov-pill", onClick: () => setN(x => x + 10) }, "Xem thêm")) : null));
}

/* ---------- Trang ---------- */
function ProductionOverview({ currentUser, orders, machines, staff, scrap, attendance, auditLog, runs, extra, onNavigate, onNavigateFocus }) {
  const h = React.createElement;
  const [period, setPeriodRaw] = useState(() => { const p = ovLS.get("period", "month"); return AMG_OV_PERIODS[p] ? p : "month"; });
  const today = amgTodayKey(new Date());
  const [from, setFrom] = useState(() => amgOvAddDays(today, -6)), [to, setTo] = useState(today);
  const [nonce, setNonce] = useState(0), [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [sync, setSync] = useState(() => Object.assign({}, window.__rtdbStatus || {}));
  const setPeriod = p => { setPeriodRaw(p); ovLS.set("period", p); };
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!window.__rtdbSubscribe) return undefined; setSync(Object.assign({}, window.__rtdbStatus)); return window.__rtdbSubscribe(x => setSync(Object.assign({}, x))); }, []);
  const allowed = useMemo(() => amgNavVisible(currentUser, currentUser.role).map(n => n.key), [currentUser]);
  const syncKey = amgSyncView(sync, Date.now()).key + ":" + (sync.pending || 0);
  const ov = useMemo(() => amgOvCompute({ orders: orders || [], machines: machines || [], staff: staff || [], scrap: scrap || [], attendance: attendance || {}, auditLog: auditLog || [], runs: runs || [], extra: extra || {} }, currentUser,
    { now: new Date(), period, from, to, syncState: sync }), [orders, machines, staff, scrap, attendance, auditLog, runs, extra, currentUser, period, from, to, tick, nonce, syncKey]);
  const canGo = t => !!t && allowed.indexOf(t.tab) > -1;
  const go = t => {
    if (!t || !canGo(t)) return;
    if (t.groupKey) amgCcSetPref("group", t.groupKey);
    if (onNavigateFocus) onNavigateFocus(t.tab, t.focus || null); else if (onNavigate) onNavigate(t.tab);
  };
  const refresh = () => { try { if (window.__rtdbResync) window.__rtdbResync(); } catch (e) { /* bỏ qua */ } setRefreshing(true); setNonce(n => n + 1); setTimeout(() => setRefreshing(false), 800); };
  const can = ov.can;
  return h("div", { className: "ov-page", "data-testid": "ov-page" },
    h(OvBanner, { user: currentUser, ov, onRefresh: refresh, refreshing }),
    ov.kpis.length ? h("div", { className: "ov-kpis", role: "list" }, ov.kpis.map(k => h(OvKpiCard, { key: k.key, k, go, enabled: canGo(k.target) }))) : ovEmpty("Tài khoản chưa được cấp quyền xem phân hệ nào có số liệu tổng quan."),
    (can.orders || can.plan || can.machines) && h("div", { className: "ov-grid ov-grid--stage" },
      (can.orders || can.plan) && h(OvStageTable, { ov, go, can }),
      can.machines && h(OvMachines, { ov, go, can })),
    can.orders && h(OvOrders, { ov, go, can }),
    (can.orders || can.plan || can.machines) && h(OvPerformance, { ov, period, setPeriod, from, to, setFrom, setTo }),
    h("div", { className: "ov-grid ov-grid--2" }, h(OvAlerts, { ov, go, canGo }), h(OvActivity, { ov, go, canGo })),
    ov.hidden.length ? h("div", { className: "ov-note ov-note--lock" }, h(Lock, { size: 15 }), "Một số phần của Tổng quan đang ẩn vì tài khoản chưa được cấp quyền xem: " + ov.hidden.join(", ") + ". Liên hệ Quản trị viên nếu cần mở thêm.") : null,
    h("div", { className: "ov-foot" }, h(ShieldCheck, { size: 16 }), h("span", null, "Tổng quan chỉ xem, tổng hợp và điều hành — số liệu tự lấy từ các tab nghiệp vụ. Cập nhật số liệu tại Đơn hàng, Kế hoạch SX và Điều hành.")));
}
