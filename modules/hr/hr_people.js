/* ===================== NHÂN SỰ · GIAI ĐOẠN 1 (v58): TỔNG QUAN + DANH SÁCH + HỒ SƠ NHÂN VIÊN =====================
   Nguyên tắc: CHỈ ĐỌC dữ liệu đang có (staff, attendance, extra.training, extra.overtime, auditLog), không tự tạo dữ liệu.
   - Nhân viên chỉ THÊM các trường tùy chọn (phone, email, gender, birthDate, address, position, joinDate, contractType,
     managerId, avatar). Không đổi tên/ý nghĩa field cũ (code, name, team, shift, status), không đổi mã nhân viên.
   - Thông tin cá nhân (điện thoại, email, ngày sinh, địa chỉ) chỉ hiện cho người có quyền sửa Nhân sự.
   - Chấm công: chỉ đếm các cờ đã ghi (Ca Ngày, Ca Đêm, Đảo Ca, Nghỉ phép, Nghỉ không phép, Đi muộn, Về sớm); không áp quy tắc tính công mới.
   - Tăng ca: chỉ cộng giờ của đăng ký ở trạng thái "Đã duyệt"; không tính tiền. */

const AMG_HR_STATUS = ["Đang làm", "Nghỉ phép", "Đã nghỉ"];
const AMG_HR_GENDERS = ["Nam", "Nữ", "Khác"];
const AMG_HR_PRESENT_KEYS = ["caNgay", "caDem", "daoCa"];
const AMG_HR_COLS_KEY = "amg_hr_cols_v1";
const AMG_HR_NEW_DAYS = 30;

function amgHrNorm(s) { return String(s === null || s === undefined ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
function amgHrStatusColor(st) { return st === "Đang làm" ? COLORS.green : st === "Nghỉ phép" ? COLORS.amber : COLORS.textFaint; }
function amgHrInitials(name) { const p = String(name || "?").trim().split(/\s+/); return ((p.length > 1 ? p[p.length - 2][0] : "") + (p[p.length - 1] || "?")[0]).toUpperCase(); }
function amgHrAddDays(key, n) { const d = new Date(key + "T00:00:00"); d.setDate(d.getDate() + n); return amgTodayKey(d); }
function amgHrMonthEnd(key) { const [y, m] = key.split("-").map(Number); return amgTodayKey(new Date(y, m, 0)); }

// Khoảng ngày theo chế độ lọc: day | month | year
function amgHrRange(mode, key) {
  if (mode === "year") return [key.slice(0, 4) + "-01-01", key.slice(0, 4) + "-12-31"];
  if (mode === "month") return [key.slice(0, 7) + "-01", amgHrMonthEnd(key.slice(0, 7) + "-01")];
  return [key, key];
}
function amgHrInRange(day, from, to) { return !!day && String(day).slice(0, 10) >= from && String(day).slice(0, 10) <= to; }

// Thống kê chấm công của một nhóm nhân viên trong khoảng ngày (chỉ đếm cờ đã ghi)
function amgHrAttendanceOf(attendance, staffIds, from, to) {
  const ids = new Set(staffIds);
  const out = { present: new Set(), leave: new Set(), absent: new Set(), late: new Set(), early: new Set(), presentN: 0, leaveN: 0, absentN: 0, lateN: 0, earlyN: 0 };
  Object.keys(attendance || {}).forEach(day => {
    if (!amgHrInRange(day, from, to)) return;
    const d = attendance[day] || {};
    Object.keys(d).forEach(sid => {
      if (!ids.has(sid) || !d[sid]) return;
      const f = d[sid];
      if (AMG_HR_PRESENT_KEYS.some(k => f[k])) { out.present.add(sid); out.presentN++; }
      if (f.nghiPhep) { out.leave.add(sid); out.leaveN++; }
      if (f.nghiKhongPhep) { out.absent.add(sid); out.absentN++; }
      if (f.diLamMuon) { out.late.add(sid); out.lateN++; }
      if (f.veSom) { out.early.add(sid); out.earlyN++; }
    });
  });
  return out;
}
// Giờ tăng ca đã duyệt trong khoảng ngày
function amgHrOvertimeOf(overtime, staffIds, from, to) {
  const ids = new Set(staffIds);
  const rows = (overtime || []).filter(o => o.status === "da_duyet" && ids.has(o.staffId) && amgHrInRange(o.date, from, to));
  return { rows, who: new Set(rows.map(o => o.staffId)), hours: rows.reduce((s, o) => s + (Number(o.hours) || 0), 0) };
}
// Nhân viên cần đào tạo lại: bản ghi mới nhất của một nội dung có kết quả "Chưa đạt" hoặc đã quá hạn hiệu lực
function amgHrTrainingDue(training, staffIds, asOf) {
  const ids = new Set(staffIds), latest = {};
  (training || []).forEach(t => {
    if (!ids.has(t.staffId)) return;
    const k = t.staffId + "|" + amgHrNorm(t.title);
    if (!latest[k] || String(t.date || "") >= String(latest[k].date || "")) latest[k] = t;
  });
  const due = new Set();
  Object.keys(latest).forEach(k => { const t = latest[k]; if (t.result === "chua" || (t.expiry && t.expiry < asOf)) due.add(t.staffId); });
  return due;
}
function amgHrIsNew(s, asOf) { return !!s.joinDate && s.joinDate <= asOf && s.joinDate >= amgHrAddDays(asOf, -AMG_HR_NEW_DAYS); }

// Toàn bộ KPI tổng quan; mỗi KPI kèm danh sách mã nhân viên để mở chi tiết
function amgHrOverview({ staff, attendance, training, overtime, mode, dateKey, team, shift }) {
  const [from, to] = amgHrRange(mode, dateKey);
  const base = staff.filter(s => (team === "all" || s.team === team) && (shift === "all" || (s.shift || "") === shift));
  const ids = base.map(s => s.id);
  const at = amgHrAttendanceOf(attendance, ids, from, to);
  const ot = amgHrOvertimeOf(overtime, ids, from, to);
  const asOf = to < amgTodayKey() ? to : (from > amgTodayKey() ? from : (mode === "day" ? dateKey : amgTodayKey()));
  const due = amgHrTrainingDue(training, ids, asOf);
  const inRangeTr = (training || []).filter(t => new Set(ids).has(t.staffId) && t.kind !== "danh_gia" && amgHrInRange(t.date, from, to));
  const arr = set => [...set];
  const noJoin = base.filter(s => !s.joinDate).length;
  const unit = mode === "day" ? "người" : "người trong kỳ";
  return {
    from, to, total: base.length,
    kpis: [
      { key: "total", label: "Tổng nhân viên", value: base.length, sub: "Theo bộ lọc tổ / ca", tone: "info", ids },
      { key: "active", label: "Đang làm việc", value: base.filter(s => s.status === "Đang làm").length, sub: "Tình trạng “Đang làm”", tone: "ok", ids: base.filter(s => s.status === "Đang làm").map(s => s.id) },
      { key: "new", label: "Nhân viên mới", value: base.filter(s => amgHrIsNew(s, asOf)).length, sub: noJoin === base.length ? "Chưa có ngày vào làm" : `Vào làm trong ${AMG_HR_NEW_DAYS} ngày` + (noJoin ? ` · ${noJoin} NV chưa có ngày vào` : ""), tone: "info", ids: base.filter(s => amgHrIsNew(s, asOf)).map(s => s.id) },
      { key: "left", label: "Đã nghỉ việc", value: base.filter(s => s.status === "Đã nghỉ").length, sub: "Tình trạng “Đã nghỉ”", tone: "none", ids: base.filter(s => s.status === "Đã nghỉ").map(s => s.id) },
      { key: "leave", label: mode === "day" ? "Nghỉ phép" : "Có nghỉ phép", value: at.leave.size, sub: mode === "day" ? "Theo điểm danh ngày" : `${at.leaveN} lượt · ${unit}`, tone: "warn", ids: arr(at.leave) },
      { key: "present", label: mode === "day" ? "Có mặt" : "Có đi làm", value: at.present.size, sub: mode === "day" ? "Có ghi Ca Ngày / Ca Đêm / Đảo Ca" : `${at.presentN} lượt · ${unit}`, tone: "ok", ids: arr(at.present) },
      { key: "late", label: "Đi muộn", value: at.late.size, sub: mode === "day" ? "Theo điểm danh ngày" : `${at.lateN} lượt · ${unit}`, tone: "warn", ids: arr(at.late) },
      { key: "absent", label: "Vắng không phép", value: at.absent.size, sub: mode === "day" ? "Nghỉ không phép" : `${at.absentN} lượt · ${unit}`, tone: "err", ids: arr(at.absent) },
      { key: "ot", label: "Đang tăng ca", value: ot.who.size, sub: "Đăng ký tăng ca đã duyệt", tone: "info", ids: arr(ot.who) },
      { key: "othours", label: "Tổng giờ tăng ca", value: Math.round(ot.hours * 10) / 10, sub: "Chỉ tính đăng ký đã duyệt", tone: "info", ids: arr(ot.who) },
      { key: "train", label: "Cần đào tạo", value: due.size, sub: "Chưa đạt hoặc quá hạn hiệu lực", tone: due.size ? "warn" : "none", ids: arr(due) },
      { key: "trainN", label: "Lượt đào tạo trong kỳ", value: inRangeTr.length, sub: "Chưa có danh mục khóa học riêng", tone: "info", ids: arr(new Set(inRangeTr.map(t => t.staffId))) }
    ]
  };
}

// Tổng hợp riêng một nhân viên (tab Chấm công trong hồ sơ)
function amgHrPersonStats(attendance, overtime, sid, from, to) {
  const at = amgHrAttendanceOf(attendance, [sid], from, to);
  const ot = amgHrOvertimeOf(overtime, [sid], from, to);
  return { daysWorked: at.presentN, leave: at.leaveN, absent: at.absentN, late: at.lateN, early: at.earlyN, otHours: Math.round(ot.hours * 10) / 10, otCount: ot.rows.length };
}

/* ---------- CSS riêng của khu Nhân sự (dùng biến màu chung nên theo giao diện sáng/tối) ---------- */
(function amgHrInjectStyle() {
  if (typeof document === "undefined" || document.getElementById("amg-hr-style")) return;
  const st = document.createElement("style");
  st.id = "amg-hr-style";
  st.textContent = `
.hr-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;}
.hr-bar .mes-input{width:auto;min-width:130px;max-width:100%;}
.hr-search{position:relative;flex:1 1 240px;min-width:200px;}
.hr-search .mes-input{width:100%;padding-left:30px;}
.hr-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-faint);}
.hr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
.hr-chip{border:1px solid var(--c-border);background:var(--c-panel);color:var(--c-dim);border-radius:999px;padding:5px 12px;font-size:var(--fs-sm);font-weight:600;cursor:pointer;font-family:inherit;}
.hr-chip[aria-pressed="true"]{background:var(--c-navy);border-color:var(--c-navy);color:#fff;}
.hr-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:16px;}
.hr-av{border-radius:50%;background:var(--c-navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;overflow:hidden;}
.hr-av img{width:100%;height:100%;object-fit:cover;}
.hr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;}
.hr-card{background:var(--c-panel);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--sh-sm);text-align:left;font-family:inherit;color:inherit;cursor:pointer;min-width:0;}
.hr-card:hover{border-color:var(--c-border2);box-shadow:var(--sh-md);}
.hr-card-top{display:flex;gap:10px;align-items:center;min-width:0;}
.hr-card-top>div:last-child{min-width:0;}
.hr-name{font-weight:700;font-size:var(--fs-md);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hr-sub{font-size:var(--fs-xs);color:var(--c-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hr-row-link{background:none;border:none;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;min-width:0;}
.hr-row-link:hover .hr-name{color:var(--c-copper);}
.hr-overlay{position:fixed;inset:0;background:rgba(8,16,30,.5);z-index:1900;display:flex;justify-content:flex-end;}
.hr-drawer{width:min(580px,100vw);height:100%;background:var(--c-panel);box-shadow:var(--sh-lg);display:flex;flex-direction:column;}
.hr-drawer-h{padding:16px;border-bottom:1px solid var(--c-border);display:flex;gap:12px;align-items:center;}
.hr-drawer-b{padding:16px;overflow-y:auto;flex:1;}
.hr-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;}
.hr-dl>div{min-width:0;}
.hr-dl-l{font-size:var(--fs-xs);color:var(--c-faint);font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
.hr-dl-v{font-size:var(--fs-md);color:var(--c-text);word-break:break-word;}
.hr-form{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;}
.hr-err{color:var(--c-red);font-size:var(--fs-xs);margin-top:3px;}
.hr-list-row{display:flex;gap:10px;align-items:center;padding:9px 4px;border-bottom:1px solid var(--c-border);width:100%;background:none;border-left:none;border-right:none;border-top:none;font-family:inherit;color:inherit;text-align:left;cursor:pointer;}
.hr-list-row:hover{background:var(--c-inset);}
@media (max-width:640px){.hr-dl,.hr-form{grid-template-columns:minmax(0,1fr);}.hr-bar .mes-input{flex:1 1 140px;}.hr-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}
`;
  document.head.appendChild(st);
})();

/* ===================== THÀNH PHẦN DÙNG CHUNG ===================== */
function HrAvatar({ s, size = 40 }) {
  return rkh("div", { className: "hr-av", style: { width: size, height: size, fontSize: Math.round(size * 0.38) }, "aria-hidden": true },
    s && s.avatar ? rkh("img", { src: s.avatar, alt: "" }) : amgHrInitials(s && s.name));
}
function HrDL({ rows }) {
  return rkh("div", { className: "hr-dl" }, rows.map(r => rkh("div", { key: r[0] }, rkh("div", { className: "hr-dl-l" }, r[0]), rkh("div", { className: "hr-dl-v" }, r[1] === undefined || r[1] === null || r[1] === "" ? "—" : r[1]))));
}
function amgHrTeamOptions(staff) { const set = new Set(TEAMS); staff.forEach(s => s.team && set.add(s.team)); return [...set]; }
function amgHrUnique(staff, key) { return [...new Set(staff.map(s => s[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "vi")); }

/* ===================== TỔNG QUAN NHÂN SỰ ===================== */
const AMG_HR_KPI_ICONS = { total: Users, active: CheckCircle2, new: Sparkles, left: LogOut, leave: CalendarDays, present: ClipboardCheck, late: ClockIcon, absent: AlertTriangle, ot: MoonIcon, othours: ClockIcon, train: AwardIcon, trainN: AwardIcon };
function HrOverview({ staff, attendance, extra, onOpen }) {
  const [mode, setMode] = useState("day");
  const [dateKey, setDateKey] = useState(amgTodayKey());
  const [team, setTeam] = useState("all");
  const [shift, setShift] = useState("all");
  const [drill, setDrill] = useState(null);
  const ov = useMemo(() => amgHrOverview({ staff, attendance, training: extra.training || [], overtime: extra.overtime || [], mode, dateKey, team, shift }), [staff, attendance, extra, mode, dateKey, team, shift]);
  const dayHasData = mode !== "day" || Object.keys((attendance || {})[dateKey] || {}).length > 0;
  const TONE = { ok: COLORS.green, warn: COLORS.amber, err: COLORS.red, info: COLORS.blue, none: COLORS.textFaint };
  const byId = {}; staff.forEach(s => { byId[s.id] = s; });
  const monthVal = dateKey.slice(0, 7), yearVal = dateKey.slice(0, 4);
  return rkh("div", null,
    rkh("div", { className: "hr-bar mes-no-print" },
      rkh("select", { className: "mes-input", "aria-label": "Kỳ xem", value: mode, onChange: e => setMode(e.target.value) }, rkh("option", { value: "day" }, "Theo ngày"), rkh("option", { value: "month" }, "Theo tháng"), rkh("option", { value: "year" }, "Theo năm")),
      mode === "day" && rkh("input", { className: "mes-input", type: "date", "aria-label": "Ngày", value: dateKey, onChange: e => e.target.value && setDateKey(e.target.value) }),
      mode === "month" && rkh("input", { className: "mes-input", type: "month", "aria-label": "Tháng", value: monthVal, onChange: e => e.target.value && setDateKey(e.target.value + "-01") }),
      mode === "year" && rkh("input", { className: "mes-input", type: "number", min: 2000, max: 2100, "aria-label": "Năm", value: yearVal, onChange: e => /^\d{4}$/.test(e.target.value) && setDateKey(e.target.value + "-01-01") }),
      rkh("select", { className: "mes-input", "aria-label": "Tổ / bộ phận", value: team, onChange: e => setTeam(e.target.value) }, rkh("option", { value: "all" }, "Tất cả tổ / bộ phận"), amgHrTeamOptions(staff).map(t => rkh("option", { key: t, value: t }, "Tổ " + t))),
      rkh("select", { className: "mes-input", "aria-label": "Ca làm việc", value: shift, onChange: e => setShift(e.target.value) }, rkh("option", { value: "all" }, "Tất cả ca"), amgHrUnique(staff, "shift").map(t => rkh("option", { key: t, value: t }, t)))),
    !dayHasData && rkh("div", { role: "status", style: { background: COLORS.bgInset, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: FZ(13), color: COLORS.textDim } }, "Chưa có điểm danh cho ngày này — các chỉ số chấm công sẽ là 0 cho đến khi điểm danh."),
    staff.length === 0 ? rkh(EmptyState, { title: "Chưa có dữ liệu nhân sự", hint: "Danh sách nhân viên trống." }) :
      rkh("div", { className: "hr-kpis" }, ov.kpis.map(k => rkh(StatCard, { key: k.key, icon: AMG_HR_KPI_ICONS[k.key], label: k.label, value: k.value, sub: k.sub, accent: TONE[k.tone] || COLORS.blue, title: "Nhấn để xem danh sách", onClick: () => setDrill(k) }))),
    drill && rkh(Modal, { title: `${drill.label} — ${drill.ids.length} người`, onClose: () => setDrill(null), width: 520 },
      drill.ids.length === 0 ? rkh(EmptyState, { title: "Không có nhân viên nào", hint: "Chưa có dữ liệu phù hợp với bộ lọc hiện tại." }) :
        rkh("div", { style: { maxHeight: "60vh", overflowY: "auto" } }, drill.ids.map(id => byId[id]).filter(Boolean).map(s =>
          rkh("button", { key: s.id, type: "button", className: "hr-list-row", onClick: () => { setDrill(null); onOpen(s.id); } },
            rkh(HrAvatar, { s, size: 32 }), rkh("div", { style: { minWidth: 0, flex: 1 } }, rkh("div", { className: "hr-name" }, s.name), rkh("div", { className: "hr-sub" }, `${s.code || "—"} · Tổ ${s.team || "—"}`)),
            rkh(Badge, { color: amgHrStatusColor(s.status) }, s.status || "—"))))));
}

/* ===================== DANH SÁCH NHÂN VIÊN ===================== */
function amgHrColumns(canPrivate) {
  const all = [
    { key: "code", label: "Mã NV", always: true, val: s => s.code, mono: true },
    { key: "name", label: "Họ và tên", always: true, val: s => s.name },
    { key: "gender", label: "Giới tính", val: s => s.gender, priv: true },
    { key: "birthDate", label: "Ngày sinh", val: s => amgFmtDate(s.birthDate), priv: true },
    { key: "phone", label: "Số điện thoại", val: s => s.phone, priv: true },
    { key: "team", label: "Tổ / bộ phận", val: s => s.team ? "Tổ " + s.team : "" },
    { key: "position", label: "Chức vụ", val: s => s.position },
    { key: "joinDate", label: "Ngày vào làm", val: s => amgFmtDate(s.joinDate) },
    { key: "contractType", label: "Loại hợp đồng", val: s => s.contractType },
    { key: "shift", label: "Ca làm việc", val: s => s.shift },
    { key: "manager", label: "Quản lý trực tiếp", val: (s, byId) => (byId[s.managerId] || {}).name },
    { key: "status", label: "Trạng thái", val: s => s.status }
  ];
  return all.filter(c => canPrivate || !c.priv);
}
const AMG_HR_DEFAULT_COLS = ["code", "name", "phone", "team", "position", "shift", "status"];
function amgHrLoadCols() { try { const v = JSON.parse(localStorage.getItem(AMG_HR_COLS_KEY) || "null"); return Array.isArray(v) ? v : AMG_HR_DEFAULT_COLS; } catch (e) { return AMG_HR_DEFAULT_COLS; } }
function amgHrSaveCols(v) { try { localStorage.setItem(AMG_HR_COLS_KEY, JSON.stringify(v)); } catch (e) {} }
function amgHrNameKey(n) { const p = String(n || "").trim().split(/\s+/); return amgHrNorm(p[p.length - 1] || "") + " " + amgHrNorm(n); }

function HrDirectory({ staff, canEdit, isAdmin, canPrivate, canData, onOpen, onEdit, onDelete, initialQuery }) {
  const { askConfirm } = useDialog();
  const [q, setQ] = useState(initialQuery || "");
  const [f, setF] = useState({ team: "all", shift: "all", status: "all", position: "all", contractType: "all" });
  const [quick, setQuick] = useState("all");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [view, setView] = useState("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [cols, setCols] = useState(amgHrLoadCols);
  const [colMenu, setColMenu] = useState(false);
  const [showF, setShowF] = useState(false);
  const [boxRef, boxW] = useBoxWidth();
  const byId = useMemo(() => { const m = {}; staff.forEach(s => { m[s.id] = s; }); return m; }, [staff]);
  const allCols = amgHrColumns(canPrivate);
  const visCols = allCols.filter(c => c.always || cols.includes(c.key));
  const today = amgTodayKey();
  const rows = useMemo(() => {
    const nq = amgHrNorm(q);
    let r = staff.filter(s => {
      if (nq && !amgHrNorm([s.code, s.name, canPrivate ? s.phone : "", s.team, s.position].join(" ")).includes(nq)) return false;
      if (f.team !== "all" && s.team !== f.team) return false;
      if (f.shift !== "all" && (s.shift || "") !== f.shift) return false;
      if (f.status !== "all" && s.status !== f.status) return false;
      if (f.position !== "all" && (s.position || "") !== f.position) return false;
      if (f.contractType !== "all" && (s.contractType || "") !== f.contractType) return false;
      if (quick === "new" && !amgHrIsNew(s, today)) return false;
      if (quick === "leave" && s.status !== "Nghỉ phép") return false;
      if (quick === "left" && s.status !== "Đã nghỉ") return false;
      if (quick === "active" && s.status !== "Đang làm") return false;
      return true;
    });
    const dir = sort.dir === "desc" ? -1 : 1;
    r = r.slice().sort((a, b) => {
      let x, y;
      if (sort.key === "name") { x = amgHrNameKey(a.name); y = amgHrNameKey(b.name); }
      else if (sort.key === "joinDate") { x = a.joinDate || ""; y = b.joinDate || ""; if (!x !== !y) return !x ? 1 : -1; }
      else { x = amgHrNorm(a[sort.key]); y = amgHrNorm(b[sort.key]); }
      return x < y ? -dir : x > y ? dir : 0;
    });
    return r;
  }, [staff, q, f, quick, sort, canPrivate, today]);
  useEffect(() => { setPage(1); }, [q, f, quick, sort, pageSize]);
  const pg = amgPaginate(rows, page, pageSize);
  const wide = amgIsWide(boxW) && view === "table";
  const narrow = !!boxW && boxW < 700;
  const activeF = Object.keys(f).filter(k => f[k] !== "all").length;
  const setFilter = (k, v) => setF(o => ({ ...o, [k]: v }));
  const toggleCol = k => { const n = cols.includes(k) ? cols.filter(x => x !== k) : [...cols, k]; setCols(n); amgHrSaveCols(n); };
  const sel = (k, label, opts) => rkh("select", { key: k, className: "mes-input", "aria-label": label, value: f[k], onChange: e => setFilter(k, e.target.value) }, rkh("option", { value: "all" }, label), opts.map(o => rkh("option", { key: o, value: o }, o)));
  const cell = (c, s) => {
    const v = c.val(s, byId);
    if (c.key === "name") return rkh("button", { type: "button", className: "hr-row-link", onClick: () => onOpen(s.id) }, rkh(HrAvatar, { s, size: 32 }), rkh("span", { className: "hr-name" }, s.name));
    if (c.key === "status") return rkh(Badge, { color: amgHrStatusColor(s.status) }, s.status || "—");
    if (c.key === "code") return rkh("span", { className: "mes-mono" }, v || "—");
    return v || "—";
  };
  const exportXlsx = () => amgExportExcel("danh-sach-nhan-vien", visCols.map(c => ({ key: c.key, label: c.label, export: s => c.val(s, byId) || "" })), rows, "Nhân viên");
  const chips = [["all", "Tất cả"], ["active", "Đang làm"], ["new", "Nhân viên mới"], ["leave", "Đang nghỉ phép"], ["left", "Đã nghỉ việc"]];
  const sortKeys = [["name", "Tên"], ["code", "Mã NV"], ["joinDate", "Ngày vào làm"], ["team", "Tổ"]];
  return rkh("div", { ref: boxRef },
    rkh("div", { className: "hr-bar mes-no-print" },
      rkh("div", { className: "hr-search" }, rkh(Search, { size: 14 }), rkh("input", { className: "mes-input", placeholder: canPrivate ? "Tìm theo mã, tên, số điện thoại, tổ, chức vụ..." : "Tìm theo mã, tên, tổ, chức vụ...", "aria-label": "Tìm nhân viên", value: q, onChange: e => setQ(e.target.value) })),
      narrow && rkh(Button, { onClick: () => setShowF(o => !o), "aria-expanded": showF }, rkh(Filter, { size: 14 }), ` Bộ lọc${activeF ? " (" + activeF + ")" : ""}`),
      (!narrow || showF) && [sel("team", "Tất cả tổ", amgHrTeamOptions(staff).filter(t => staff.some(s => s.team === t))), sel("shift", "Tất cả ca", amgHrUnique(staff, "shift")),
        sel("position", "Tất cả chức vụ", amgHrUnique(staff, "position")), sel("contractType", "Tất cả hợp đồng", amgHrUnique(staff, "contractType")), sel("status", "Mọi trạng thái", AMG_HR_STATUS)]),
    rkh("div", { className: "hr-bar mes-no-print" },
      rkh("div", { className: "hr-chips", style: { margin: 0 } }, chips.map(c => rkh("button", { key: c[0], type: "button", className: "hr-chip", "aria-pressed": quick === c[0], onClick: () => setQuick(c[0]) }, c[1]))),
      rkh("div", { style: { marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", position: "relative" } },
        rkh("select", { className: "mes-input", "aria-label": "Sắp xếp theo", value: sort.key, onChange: e => setSort(o => ({ ...o, key: e.target.value })) }, sortKeys.map(k => rkh("option", { key: k[0], value: k[0] }, "Sắp xếp: " + k[1]))),
        rkh(Button, { onClick: () => setSort(o => ({ ...o, dir: o.dir === "asc" ? "desc" : "asc" })), "aria-label": "Đảo chiều sắp xếp" }, sort.dir === "asc" ? "A→Z ↑" : "Z→A ↓"),
        rkh(Button, { onClick: () => setView(v => v === "table" ? "card" : "table"), "aria-pressed": view === "card" }, view === "table" ? "Dạng thẻ" : "Dạng bảng"),
        rkh(Button, { onClick: () => setColMenu(o => !o), "aria-expanded": colMenu }, "Cột hiển thị"),
        rkh(Button, { onClick: exportXlsx, disabled: rows.length === 0 }, rkh(Download, { size: 14 }), " Xuất Excel"),
        colMenu && rkh("div", { className: "mes-card", style: { position: "absolute", right: 0, top: "100%", zIndex: 30, padding: 10, minWidth: 210, marginTop: 4 } },
          allCols.map(c => rkh("label", { key: c.key, style: { display: "flex", gap: 8, alignItems: "center", padding: "4px 2px", fontSize: FZ(13), opacity: c.always ? .6 : 1 } }, rkh("input", { type: "checkbox", checked: c.always || cols.includes(c.key), disabled: !!c.always, onChange: () => toggleCol(c.key) }), c.label)),
          rkh("button", { type: "button", className: "hr-chip", style: { marginTop: 6 }, onClick: () => { setCols(AMG_HR_DEFAULT_COLS); amgHrSaveCols(AMG_HR_DEFAULT_COLS); } }, "Về mặc định")))),
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 8 }, "aria-live": "polite" }, `${rows.length} / ${staff.length} nhân viên`),
    rows.length === 0 ? rkh(EmptyState, { icon: Users, title: staff.length === 0 ? "Chưa có dữ liệu nhân sự" : "Không tìm thấy nhân viên phù hợp", hint: staff.length === 0 ? "Danh sách nhân viên trống — có thể do dữ liệu chưa được nạp đầy đủ." : "Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm." }) :
    wide ? rkh("div", { className: "mes-card", style: { overflow: "hidden" } }, rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
      rkh("thead", null, rkh("tr", null, visCols.map(c => rkh("th", { key: c.key }, c.label)), canEdit && rkh("th", { style: { width: 80 } }, ""))),
      rkh("tbody", null, pg.items.map(s => rkh("tr", { key: s.id }, visCols.map(c => rkh("td", { key: c.key, style: c.key === "name" ? { fontWeight: 600 } : undefined }, cell(c, s))),
        canEdit && rkh("td", null, rkh("div", { style: { display: "flex", gap: 4 } }, rkh(IconButton, { icon: Pencil, title: "Sửa", onClick: () => onEdit(s) }), isAdmin && rkh(IconButton, { icon: Trash2, danger: true, title: "Xóa", onClick: async () => { if (await askConfirm(`Xóa nhân viên ${s.name}?`, { danger: true, confirmLabel: "Xóa" })) onDelete(s.id); } }))))))))) :
    rkh("div", { className: "hr-cards" }, pg.items.map(s => rkh("div", { key: s.id, className: "hr-card", role: "button", tabIndex: 0, onClick: () => onOpen(s.id), onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(s.id); } } },
      rkh("div", { className: "hr-card-top" }, rkh(HrAvatar, { s, size: 44 }), rkh("div", null, rkh("div", { className: "hr-name" }, s.name), rkh("div", { className: "hr-sub mes-mono" }, s.code || "—"))),
      rkh("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } }, rkh(Badge, { color: amgHrStatusColor(s.status) }, s.status || "—"), s.team && rkh(Badge, { color: COLORS.blue }, "Tổ " + s.team), s.shift && rkh(Badge, { color: COLORS.textDim }, s.shift)),
      rkh("div", { className: "hr-sub" }, [s.position, canPrivate && s.phone].filter(Boolean).join(" · ") || "—")))),
    rows.length > 0 && rkh(Pager, { total: rows.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }));
}

/* ===================== HỒ SƠ CHI TIẾT (drawer) ===================== */
function amgHrPrintProfile(s, mgrName, canPrivate) {
  const rows = [["Mã nhân viên", s.code], ["Họ và tên", s.name], ["Tổ / bộ phận", s.team ? "Tổ " + s.team : ""], ["Chức vụ", s.position], ["Ca làm việc", s.shift], ["Ngày vào làm", amgFmtDate(s.joinDate)], ["Loại hợp đồng", s.contractType], ["Quản lý trực tiếp", mgrName], ["Trạng thái", s.status]]
    .concat(canPrivate ? [["Giới tính", s.gender], ["Ngày sinh", amgFmtDate(s.birthDate)], ["Số điện thoại", s.phone], ["Email", s.email], ["Địa chỉ", s.address]] : []);
  amgPrintHtml("Hồ sơ nhân viên " + (s.code || s.name), `<h2>Hồ sơ nhân viên</h2><table>${rows.map(r => `<tr><th style="text-align:left;padding:4px 12px 4px 0">${amgEsc(r[0])}</th><td>${amgEsc(r[1] || "—")}</td></tr>`).join("")}</table>`);
}
function HrProfile({ s, staff, attendance, extra, auditLog, canPrivate, canData, canEdit, onClose, onEdit, onStatus }) {
  const { askConfirm } = useDialog();
  const [tab, setTab] = useState("info");
  const [month, setMonth] = useState(amgTodayKey().slice(0, 7));
  const mgr = staff.find(x => x.id === s.managerId);
  useEffect(() => { const h = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const tabs = [{ key: "info", label: "Cá nhân" }, { key: "job", label: "Công việc" }].concat(canData ? [{ key: "att", label: "Chấm công" }, { key: "train", label: "Đào tạo" }] : []).concat(canEdit ? [{ key: "hist", label: "Lịch sử" }] : []);
  const [from, to] = amgHrRange("month", month + "-01");
  const ps = amgHrPersonStats(attendance, extra.overtime || [], s.id, from, to);
  const tr = (extra.training || []).filter(t => t.staffId === s.id).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const today = amgTodayKey();
  const hist = (auditLog || []).filter(a => a.targetId === s.id).slice(0, 50);
  const tl = ts => amgFmtDateTime(ts && ts.toMillis ? ts.toMillis() : ts);
  const changeStatus = async e => {
    const v = e.target.value; if (v === s.status) return;
    if (await askConfirm(`Đổi trạng thái của ${s.name} từ “${s.status || "—"}” sang “${v}”?`, { confirmLabel: "Xác nhận đổi" })) onStatus(s, v);
  };
  const body = tab === "info" ? (canPrivate ? rkh(HrDL, { rows: [["Mã nhân viên", s.code], ["Họ và tên", s.name], ["Giới tính", s.gender], ["Ngày sinh", amgFmtDate(s.birthDate)], ["Số điện thoại", s.phone], ["Email", s.email], ["Địa chỉ", s.address]] }) :
      rkh("div", null, rkh(HrDL, { rows: [["Mã nhân viên", s.code], ["Họ và tên", s.name]] }), rkh("div", { style: { marginTop: 14, fontSize: FZ(13), color: COLORS.textDim } }, "Thông tin cá nhân (điện thoại, email, ngày sinh, địa chỉ) chỉ hiển thị cho tài khoản có quyền quản lý nhân sự."))) :
    tab === "job" ? rkh(HrDL, { rows: [["Tổ / bộ phận", s.team ? "Tổ " + s.team : ""], ["Chức vụ", s.position], ["Ngày vào làm", amgFmtDate(s.joinDate)], ["Loại hợp đồng", s.contractType], ["Ca làm việc", s.shift], ["Quản lý trực tiếp", mgr && mgr.name], ["Trạng thái", s.status]] }) :
    tab === "att" ? rkh("div", null,
      rkh("div", { className: "hr-bar" }, rkh("input", { className: "mes-input", type: "month", "aria-label": "Tháng", value: month, onChange: e => e.target.value && setMonth(e.target.value) })),
      rkh(HrDL, { rows: [["Số ngày đi làm (có ghi ca)", ps.daysWorked], ["Số ngày nghỉ phép", ps.leave], ["Nghỉ không phép", ps.absent], ["Số lần đi muộn", ps.late], ["Số lần về sớm", ps.early], ["Giờ tăng ca đã duyệt", `${ps.otHours} giờ (${ps.otCount} lần)`]] }),
      rkh("div", { style: { marginTop: 12, fontSize: FZ(12), color: COLORS.textFaint } }, "Số liệu đếm từ các cờ điểm danh đã ghi trong tháng; chưa áp dụng quy tắc tính công nào.")) :
    tab === "train" ? (tr.length === 0 ? rkh(EmptyState, { title: "Chưa có hồ sơ đào tạo", hint: "Ghi nhận ở mục Đào tạo & kỹ năng." }) :
      rkh("div", null, tr.map(t => { const exp = t.expiry && t.expiry < today; return rkh("div", { key: t.id, style: { padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` } },
        rkh("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } }, rkh("b", null, t.title || "—"), rkh(Badge, { color: t.kind === "danh_gia" ? COLORS.violet : COLORS.blue }, t.kind === "danh_gia" ? "Đánh giá" : "Đào tạo"), t.result && rkh(Badge, { color: t.result === "dat" ? COLORS.green : COLORS.red }, t.result === "dat" ? "Đạt" : "Chưa đạt"), exp && rkh(Badge, { color: COLORS.amber }, "Hết hiệu lực")),
        rkh("div", { className: "hr-sub", style: { whiteSpace: "normal", marginTop: 3 } }, [amgFmtDate(t.date), t.trainer && "Người đào tạo: " + t.trainer, t.level && "Mức " + t.level, t.expiry && "Hiệu lực đến " + amgFmtDate(t.expiry)].filter(Boolean).join(" · "))); }))) :
    (hist.length === 0 ? rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Chưa có lịch sử thao tác cho nhân viên này.") :
      rkh("div", null, hist.map(a => rkh("div", { key: a.id, style: { padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: FZ(13) } }, rkh("div", null, a.detail), rkh("div", { className: "hr-sub" }, `${a.user || ""} · ${tl(a.ts)}`)))));
  return rkh("div", { className: "hr-overlay", onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    rkh("aside", { className: "hr-drawer mes-fade-in", role: "dialog", "aria-modal": "true", "aria-label": "Hồ sơ " + s.name },
      rkh("div", { className: "hr-drawer-h" }, rkh(HrAvatar, { s, size: 56 }),
        rkh("div", { style: { minWidth: 0, flex: 1 } }, rkh("div", { className: "hr-name", style: { fontSize: FZ(18) } }, s.name), rkh("div", { className: "hr-sub mes-mono" }, s.code || "—"), rkh("div", { style: { marginTop: 4 } }, rkh(Badge, { color: amgHrStatusColor(s.status) }, s.status || "—"))),
        rkh(IconButton, { icon: X, title: "Đóng", onClick: onClose })),
      rkh("div", { className: "hr-drawer-b" },
        rkh("div", { className: "hr-bar mes-no-print" },
          canEdit && rkh(Button, { variant: "primary", onClick: () => onEdit(s) }, rkh(Pencil, { size: 14 }), " Sửa hồ sơ"),
          canEdit && rkh("select", { className: "mes-input", "aria-label": "Cập nhật trạng thái", value: s.status || "Đang làm", onChange: changeStatus }, AMG_HR_STATUS.map(v => rkh("option", { key: v, value: v }, "Trạng thái: " + v))),
          rkh(Button, { onClick: () => amgHrPrintProfile(s, mgr && mgr.name, canPrivate) }, "In hồ sơ")),
        rkh(DetailTabs, { tabs, active: tab, onChange: setTab }), body)));
}

/* ===================== BIỂU MẪU THÊM / SỬA ===================== */
const AMG_HR_FIELD_LABELS = { code: "Mã nhân viên", name: "Họ và tên", team: "Tổ", shift: "Ca làm việc", status: "Trạng thái", position: "Chức vụ", joinDate: "Ngày vào làm", contractType: "Loại hợp đồng", managerId: "Quản lý trực tiếp", gender: "Giới tính", birthDate: "Ngày sinh", phone: "Số điện thoại", email: "Email", address: "Địa chỉ", avatar: "Ảnh đại diện" };
function amgHrValidate(form, staff, isEdit) {
  const e = {};
  if (!String(form.name || "").trim()) e.name = "Nhập họ và tên";
  const code = String(form.code || "").trim();
  if (code && staff.some(x => x.id !== form.id && String(x.code || "").trim().toLowerCase() === code.toLowerCase())) e.code = "Mã nhân viên đã tồn tại";
  if (form.phone && !/^[0-9+\s.-]{9,15}$/.test(String(form.phone).trim())) e.phone = "Số điện thoại không hợp lệ";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email).trim())) e.email = "Email không hợp lệ";
  if (form.birthDate && form.birthDate > amgTodayKey()) e.birthDate = "Ngày sinh không được ở tương lai";
  if (form.managerId && form.managerId === form.id) e.managerId = "Không thể tự quản lý chính mình";
  return e;
}
function HrStaffForm({ initial, staff, canPrivate, onClose, onSave }) {
  const { askConfirm } = useDialog();
  const isEdit = !!initial.id;
  const [form, setForm] = useState(initial);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(o => ({ ...o, [k]: v }));
  const field = (k, node, wide) => rkh("div", { style: wide ? { gridColumn: "1 / -1" } : undefined, key: k }, rkh(Field, { label: AMG_HR_FIELD_LABELS[k] }, node), err[k] && rkh("div", { className: "hr-err", role: "alert" }, err[k]));
  const inp = (k, props) => rkh("input", Object.assign({ className: "mes-input", value: form[k] || "", onChange: e => set(k, e.target.value), "aria-invalid": !!err[k] }, props || {}));
  const dl = (id, list) => rkh("datalist", { id }, list.map(v => rkh("option", { key: v, value: v })));
  const pickAvatar = async e => { const file = e.target.files && e.target.files[0]; if (!file) return; try { set("avatar", await amgReadImage(file, 160, 0.7)); } catch (x) { setErr(o => ({ ...o, avatar: x.message })); } };
  const submit = async () => {
    const clean = {}; Object.keys(form).forEach(k => { const v = form[k]; if (v !== undefined) clean[k] = typeof v === "string" ? v.trim() : v; });
    const e = amgHrValidate(clean, staff, isEdit); setErr(e);
    if (Object.keys(e).length) return;
    const changed = isEdit ? Object.keys(AMG_HR_FIELD_LABELS).filter(k => (clean[k] || "") !== (initial[k] || "")) : [];
    if (isEdit && changed.length === 0) { onClose(); return; }
    const mgrName = id => (staff.find(x => x.id === id) || {}).name || "—";
    const show = (k, v) => k === "avatar" ? (v ? "(ảnh mới)" : "(xóa ảnh)") : k === "managerId" ? mgrName(v) : (v || "—");
    const msg = isEdit ? `Lưu thay đổi cho ${initial.name}?\n` + changed.map(k => `• ${AMG_HR_FIELD_LABELS[k]}: ${show(k, initial[k])} → ${show(k, clean[k])}`).join("\n") : `Thêm nhân viên ${clean.name}?`;
    if (!(await askConfirm(msg, { confirmLabel: isEdit ? "Lưu thay đổi" : "Thêm nhân viên" }))) return;
    setBusy(true);
    try { await onSave(Object.assign({}, clean, { id: clean.id || uid("NV") })); onClose(); } catch (x) { setErr({ _all: (x && x.message) || "Không lưu được, thử lại." }); setBusy(false); }
  };
  const shifts = [...new Set(["Ca ngày", "Ca đêm"].concat(amgHrUnique(staff, "shift")))];
  return rkh(Modal, { title: isEdit ? `Chỉnh sửa nhân viên — ${initial.name}` : "Thêm nhân viên mới", onClose, width: 640 },
    rkh("div", { className: "hr-form" },
      field("code", inp("code", { placeholder: "D-AMG001", readOnly: isEdit && !!initial.code, title: isEdit && initial.code ? "Mã nhân viên không đổi" : undefined })),
      field("name", inp("name", { placeholder: "Nguyễn Văn A" })),
      field("team", rkh("select", { className: "mes-input", value: form.team || "", onChange: e => set("team", e.target.value) }, amgHrTeamOptions(staff).map(t => rkh("option", { key: t, value: t }, "Tổ " + t)))),
      field("shift", rkh("select", { className: "mes-input", value: form.shift || "Ca ngày", onChange: e => set("shift", e.target.value) }, shifts.map(t => rkh("option", { key: t, value: t }, t)))),
      field("status", rkh("select", { className: "mes-input", value: form.status || "Đang làm", onChange: e => set("status", e.target.value) }, AMG_HR_STATUS.map(t => rkh("option", { key: t, value: t }, t)))),
      field("position", [inp("position", { key: "i", list: "hr-dl-pos", placeholder: "Chức vụ" }), dl("hr-dl-pos", amgHrUnique(staff, "position"))]),
      field("joinDate", inp("joinDate", { type: "date" })),
      field("contractType", [inp("contractType", { key: "i", list: "hr-dl-ct", placeholder: "Loại hợp đồng" }), dl("hr-dl-ct", amgHrUnique(staff, "contractType"))]),
      field("managerId", rkh("select", { className: "mes-input", value: form.managerId || "", onChange: e => set("managerId", e.target.value) }, rkh("option", { value: "" }, "— Không chọn —"), staff.filter(x => x.id !== form.id && x.status !== "Đã nghỉ").map(x => rkh("option", { key: x.id, value: x.id }, `${x.name}${x.code ? " (" + x.code + ")" : ""}`))), true),
      canPrivate && field("gender", rkh("select", { className: "mes-input", value: form.gender || "", onChange: e => set("gender", e.target.value) }, rkh("option", { value: "" }, "— Chưa nhập —"), AMG_HR_GENDERS.map(t => rkh("option", { key: t, value: t }, t)))),
      canPrivate && field("birthDate", inp("birthDate", { type: "date" })),
      canPrivate && field("phone", inp("phone", { type: "tel", placeholder: "09xx xxx xxx" })),
      canPrivate && field("email", inp("email", { type: "email", placeholder: "ten@congty.vn" })),
      canPrivate && field("address", inp("address"), true),
      field("avatar", rkh("div", { style: { display: "flex", gap: 10, alignItems: "center" } }, rkh(HrAvatar, { s: form, size: 48 }), rkh("input", { type: "file", accept: "image/*", onChange: pickAvatar, "aria-label": "Chọn ảnh đại diện" }), form.avatar && rkh(Button, { onClick: () => set("avatar", "") }, "Xóa ảnh")), true)),
    err._all && rkh("div", { className: "hr-err", role: "alert", style: { marginTop: 8 } }, err._all),
    rkh(Button, { variant: "primary", onClick: submit, disabled: busy, style: { width: "100%", justifyContent: "center", marginTop: 12 } }, rkh(Save, { size: 14 }), " ", isEdit ? "Lưu thay đổi" : "Thêm nhân viên"));
}

/* ===================== TRANG NHÂN SỰ (thay StaffPage cũ) ===================== */
function StaffPage({ staff, isAdmin, canEdit, onAdd, onUpdate, onDelete, onRestoreSeed, onImport, attendance, onAttendanceUpdate, onAttendanceMutate, onScheduleMutate, extra, auditLog, currentUser }) {
  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const focus = useMemo(() => amgTakeFocus("staff"), []);
  const [activeTab, setActiveTab] = useState(focus && focus.q ? "list" : "overview");
  const [profileId, setProfileId] = useState(null);
  const sched = useHrSchedule(activeTab === "attendance" || activeTab === "schedule");
  const ex = extra || {};
  const canPrivate = !!canEdit;
  const canData = !!canEdit || (!!currentUser && amgAllow(currentUser, "v", "nhansu"));
  const profile = profileId ? staff.find(s => s.id === profileId) : null;
  const saveForm = async d => { if (modal && modal.id) await onUpdate(d); else await onAdd(d); };
  const setStatus = (s, v) => onUpdate(Object.assign({}, s, { status: v }));
  const tabs = [{ key: "overview", label: "Tổng quan nhân sự" }, { key: "list", label: "Danh sách nhân viên" }, { key: "attendance", label: "Điểm danh – Chấm công" }, { key: "schedule", label: "Lịch làm việc" }];
  return rkh("div", null,
    rkh(SectionHeading, { eyebrow: `${staff.length} nhân viên`, title: "Nhân sự, Điểm danh & Lịch làm việc", icon: Users, iconColor: COLORS.violet,
      action: canEdit && rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        isAdmin && rkh(Button, { onClick: () => setShowImport(true) }, rkh(Upload, { size: 14 }), " Tải lên từ Excel"),
        rkh(Button, { variant: "primary", onClick: () => setModal({ code: "", name: "", team: TEAMS[0], shift: "Ca ngày", status: "Đang làm" }) }, rkh(Plus, { size: 14 }), " Thêm nhân viên")) }),
    rkh("div", { role: "tablist", style: { display: "flex", gap: 2, marginBottom: 18, borderBottom: `1px solid ${COLORS.border}`, overflowX: "auto" } }, tabs.map(t => rkh("button", { key: t.key, type: "button", role: "tab", "aria-selected": activeTab === t.key, onClick: () => setActiveTab(t.key),
      style: { padding: "8px 18px", fontSize: FZ(14), fontWeight: 600, border: "none", borderBottom: activeTab === t.key ? `2.5px solid ${COLORS.copper}` : "2.5px solid transparent", background: "transparent", color: activeTab === t.key ? COLORS.copperBright : COLORS.textDim, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" } }, t.label))),
    activeTab === "overview" && rkh(HrOverview, { staff, attendance: attendance || {}, extra: ex, onOpen: setProfileId }),
    activeTab === "attendance" && (onAttendanceMutate ? rkh(HrAttendance, { staff, attendance: attendance || {}, extra: ex, sched, currentUser, onMutate: onAttendanceMutate }) : rkh(AttendanceSection, { staff, attendance: attendance || {}, onUpdate: onAttendanceUpdate })),
    activeTab === "schedule" && (onScheduleMutate ? rkh(HrSchedule, { staff, attendance: attendance || {}, extra: ex, sched, currentUser, onMutate: onScheduleMutate }) : rkh(EmptyState, { title: "Chưa bật Lịch làm việc", hint: "Thiếu hàm ghi lịch trong ứng dụng." })),
    activeTab === "list" && (staff.length === 0 ?
      rkh(EmptyState, { title: "Chưa có dữ liệu nhân sự", hint: "Danh sách nhân viên trống — có thể do dữ liệu chưa được nạp đầy đủ.", action: isAdmin && rkh(Button, { variant: "primary", onClick: onRestoreSeed }, rkh(RefreshCw, { size: 14 }), " Khôi phục danh sách nhân viên mẫu (53 người)") }) :
      rkh(HrDirectory, { staff, canEdit, isAdmin, canPrivate, canData, onOpen: setProfileId, onEdit: s => setModal(s), onDelete, initialQuery: focus && focus.q ? focus.q : "" })),
    profile && rkh(HrProfile, { s: profile, staff, attendance: attendance || {}, extra: ex, auditLog, canPrivate, canData, canEdit, onClose: () => setProfileId(null), onEdit: s => setModal(s), onStatus: setStatus }),
    modal && rkh(HrStaffForm, { initial: modal, staff, canPrivate, onClose: () => setModal(null), onSave: saveForm }),
    showImport && rkh(StaffImportModal, { existingStaff: staff, onClose: () => setShowImport(false), onImport }));
}
