/* ===================== NHÂN SỰ · GIAI ĐOẠN 2 (v58): ĐIỂM DANH – CHẤM CÔNG =====================
   Giữ nguyên mô hình dữ liệu: attendance/{yyyy-mm-dd} = { [staffId]: { caNgay, caDem, daoCa, nghiPhep, nghiKhongPhep, diLamMuon, veSom } }.
   - Mỗi nhân viên đúng MỘT mục trong ngày → không thể có bản ghi trùng.
   - Chỉ THÊM 3 trường tùy chọn vào mục của nhân viên: note, timeIn, timeOut (các module khác chỉ đọc các cờ trạng thái nên không bị ảnh hưởng).
   - Ghi qua onMutate (đọc-sửa-ghi có điều kiện, không ghi đè điểm danh của người khác cùng ngày) và có nhật ký thao tác.
   - Không áp quy tắc tính công mới: "ngày đi làm" = số ngày có cờ Ca Ngày / Ca Đêm / Đảo Ca; giờ làm chỉ tính khi có cả giờ vào và giờ ra. */

const AMG_AT_PRESENT = ["caNgay", "caDem", "daoCa"];
const AMG_AT_STATUS_KEYS = ["caNgay", "caDem", "daoCa", "nghiPhep", "nghiKhongPhep", "diLamMuon", "veSom"];

function amgAtDays(from, to) { const out = []; let d = from; for (let i = 0; i < 400 && d <= to; i++) { out.push(d); d = amgHrAddDays(d, 1); } return out; }
function amgAtWeek(key) { const dow = new Date(key + "T00:00:00").getDay(); const mon = amgHrAddDays(key, dow === 0 ? -6 : 1 - dow); return [mon, amgHrAddDays(mon, 6)]; }
function amgAtRange(mode, key) { return mode === "week" ? amgAtWeek(key) : amgHrRange(mode === "month" ? "month" : "day", key); }
function amgAtMinutes(f) {
  if (!f || !f.timeIn || !f.timeOut) return null;
  const p = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t)); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  const a = p(f.timeIn), b = p(f.timeOut); if (isNaN(a) || isNaN(b)) return null;
  let d = b - a; if (d < 0) d += 1440; return d;
}
function amgAtHoursText(min) { return min === null || min === undefined ? "—" : (Math.round(min / 6) / 10) + " giờ"; }
function amgAtHasStatus(f) { return !!f && AMG_AT_STATUS_KEYS.some(k => f[k]); }
function amgAtIsPresent(f) { return !!f && AMG_AT_PRESENT.some(k => f[k]); }

// Tổng hợp cho từng nhân viên trong khoảng ngày (chỉ đếm cờ đã ghi)
function amgAtReport(staff, attendance, overtime, from, to) {
  const days = Object.keys(attendance || {}).filter(d => d >= from && d <= to);
  const ot = {};
  (overtime || []).forEach(o => { if (o.status === "da_duyet" && o.date >= from && o.date <= to) ot[o.staffId] = (ot[o.staffId] || 0) + (Number(o.hours) || 0); });
  return staff.map(s => {
    const r = { s, work: 0, leave: 0, absent: 0, late: 0, early: 0, pending: 0, minutes: 0, hasTime: false, ot: Math.round((ot[s.id] || 0) * 10) / 10 };
    days.forEach(d => {
      const f = (attendance[d] || {})[s.id]; if (!f) return;
      if (amgAtIsPresent(f)) r.work++;
      if (f.nghiPhep) r.leave++;
      if (f.nghiKhongPhep) r.absent++;
      if (f.diLamMuon) r.late++;
      if (f.veSom) r.early++;
      if (!amgAtHasStatus(f) && (f.timeIn || f.timeOut || f.note)) r.pending++;
      const m = amgAtMinutes(f); if (m !== null) { r.minutes += m; r.hasTime = true; }
    });
    return r;
  });
}

(function amgAtInjectStyle() {
  if (typeof document === "undefined" || document.getElementById("amg-at-style")) return;
  const st = document.createElement("style"); st.id = "amg-at-style";
  st.textContent = `
.at-flags{display:flex;gap:6px;flex-wrap:wrap;}
.at-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:6px 10px;font-size:var(--fs-sm);font-weight:600;cursor:pointer;font-family:inherit;border:1px solid var(--at-c);background:transparent;color:var(--at-c);min-height:34px;}
.at-chip[aria-pressed="true"]{background:var(--at-c);color:#fff;}
.at-chip:disabled{opacity:.55;cursor:not-allowed;}
.at-card{background:var(--c-panel);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0;}
.at-seg{display:inline-flex;border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;}
.at-seg button{border:none;background:var(--c-panel);color:var(--c-dim);padding:7px 14px;font-weight:600;font-size:var(--fs-sm);cursor:pointer;font-family:inherit;}
.at-seg button[aria-pressed="true"]{background:var(--c-navy);color:#fff;}
.at-banner{background:var(--c-inset);border:1px solid var(--c-border);border-radius:var(--r-md);padding:8px 12px;margin-bottom:12px;font-size:var(--fs-sm);color:var(--c-dim);}
`;
  document.head.appendChild(st);
})();

function AtStatusBadges({ f }) {
  const on = ATTENDANCE_STATUSES.filter(a => f && f[a.key]);
  if (!on.length) return rkh(Badge, { color: COLORS.textFaint }, "Chưa điểm danh");
  return rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, on.map(a => rkh(Badge, { key: a.key, color: a.color }, a.label)));
}
function AtDetailModal({ s, flags, date, canMark, onClose, onSave }) {
  const [fl, setFl] = useState(() => { const o = {}; AMG_AT_STATUS_KEYS.forEach(k => { if (flags && flags[k]) o[k] = true; }); return o; });
  const flip = k => setFl(p => { const n = Object.assign({}, p); if (n[k]) delete n[k]; else { n[k] = true; if (k === "caNgay") delete n.caDem; if (k === "caDem") delete n.caNgay; } return n; });
  const [note, setNote] = useState((flags && flags.note) || "");
  const [tin, setTin] = useState((flags && flags.timeIn) || "");
  const [tout, setTout] = useState((flags && flags.timeOut) || "");
  const [err, setErr] = useState("");
  const submit = async () => {
    if (note.length > 200) return setErr("Ghi chú tối đa 200 ký tự");
    if ((tin && !tout) || (!tin && tout)) return setErr("Nhập đủ cả giờ vào và giờ ra, hoặc để trống cả hai");
    try { await onSave({ note: note.trim(), timeIn: tin, timeOut: tout, flags: fl }); onClose(); } catch (e) { setErr(e.message || "Không lưu được"); }
  };
  const mins = amgAtMinutes({ timeIn: tin, timeOut: tout });
  return rkh(Modal, { title: `Chi tiết điểm danh — ${s.name}`, onClose, width: 460 },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, `${s.code || "—"} · ${amgFmtDate(date)}`),
    rkh("div", { className: "hr-form" },
      rkh(Field, { label: "Giờ vào" }, rkh("input", { className: "mes-input", type: "time", value: tin, onChange: e => setTin(e.target.value) })),
      rkh(Field, { label: "Giờ ra" }, rkh("input", { className: "mes-input", type: "time", value: tout, onChange: e => setTout(e.target.value) }))),
    rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, marginBottom: 8 } }, "Tổng thời gian: " + amgAtHoursText(mins) + " (giờ ra nhỏ hơn giờ vào được hiểu là qua nửa đêm)"),
    rkh(Field, { label: "Ghi chú" }, rkh("textarea", { className: "mes-input", rows: 3, maxLength: 200, value: note, onChange: e => setNote(e.target.value) })),
    err && rkh("div", { className: "hr-err", role: "alert" }, err),
    rkh(Button, { variant: "primary", onClick: submit, style: { width: "100%", justifyContent: "center", marginTop: 10 } }, "Lưu"));
}

function AtBox({ on, a, s, disabled, onToggle }) {
  return rkh("button", { type: "button", disabled, "aria-pressed": on, "aria-label": `${s.name}: ${a.label}`, title: a.label, onClick: () => onToggle(!on),
    style: { width: 28, height: 28, borderRadius: 7, border: `1px solid ${on ? a.color : a.color + "66"}`, background: on ? a.color : a.color + "0d", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .55 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 } },
    on && rkh("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, rkh("path", { d: "M3 8.5L6.2 11.5L13 4.5", stroke: "#fff", strokeWidth: 2.3, strokeLinecap: "round", strokeLinejoin: "round" })));
}

/* ---------- Trạng thái điểm danh (suy ra từ các cờ có sẵn, KHÔNG thêm quy tắc tính công) ----------
   Chưa điểm danh : không có cờ trạng thái, không có giờ/ghi chú.
   Chờ xác nhận   : đã có giờ vào/ra hoặc ghi chú nhưng chưa chọn trạng thái (cần người có quyền chọn trạng thái cuối cùng).
   Còn lại        : theo đúng cờ đã ghi (Có mặt = Ca Ngày/Ca Đêm/Đảo Ca; Đi muộn, Về sớm, Nghỉ phép, Nghỉ không phép). */
const AMG_AT_ST = {
  absent: { label: "Nghỉ không phép", color: "#DC2626" }, leave: { label: "Nghỉ phép", color: "#15803D" }, late: { label: "Đi muộn", color: "#EA580C" },
  early: { label: "Về sớm", color: "#7C3AED" }, present: { label: "Có mặt", color: "#16A34A" }, pending: { label: "Chờ xác nhận", color: "#0369A1" }, none: { label: "Chưa điểm danh", color: "#64748B" }
};
function amgAtStatusKeys(f) {
  if (!f || !amgAtHasStatus(f)) return f && (f.timeIn || f.timeOut || f.note) ? ["pending"] : ["none"];
  const k = [];
  if (f.nghiKhongPhep) k.push("absent"); if (f.nghiPhep) k.push("leave");
  if (amgAtIsPresent(f)) k.push("present"); if (f.diLamMuon) k.push("late"); if (f.veSom) k.push("early");
  return k;
}
function AtStatusPills({ f }) {
  return rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, amgAtStatusKeys(f).map(k => rkh(Badge, { key: k, color: AMG_AT_ST[k].color }, AMG_AT_ST[k].label)));
}

/* ---------- Thao tác điểm danh trong ngày ---------- */
function HrAtDay({ staff, attendance, extra, sched, canMark, onMutate }) {
  const { askConfirm, showAlert } = useDialog();
  const [date, setDate] = useState(amgTodayKey());
  const [team, setTeam] = useState("all");
  const [position, setPosition] = useState("all");
  const [shift, setShift] = useState("all");
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [detail, setDetail] = useState(null);
  const [boxRef, boxW] = useBoxWidth();
  const day = attendance[date] || {};
  const sdays = (sched && sched.days) || {}; const sset = (sched && sched.settings) || {};
  const plan = typeof amgScDayHasPlan === "function" && amgScDayHasPlan(sdays, date);
  const schedOf = sid => (plan ? amgScEntry(sdays, date, sid) : null);
  const shiftOf = s => { const e = schedOf(s.id); return e && AMG_SC_TYPES[e.shift] ? AMG_SC_TYPES[e.shift].label : (s.shift || ""); };
  const otSet = useMemo(() => new Set((extra.overtime || []).filter(o => o.status === "da_duyet" && String(o.date).slice(0, 10) === date).map(o => o.staffId)), [extra, date]);
  const pool = useMemo(() => {
    const nq = amgHrNorm(q);
    return staff.filter(s => (s.status !== "Đã nghỉ" || day[s.id]) && (team === "all" || s.team === team) && (position === "all" || (s.position || "") === position) && (shift === "all" || shiftOf(s) === shift) && (!nq || amgHrNorm((s.code || "") + " " + (s.name || "")).includes(nq)))
      .sort((a, b) => (TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team)) || (amgHrNameKey(a.name) < amgHrNameKey(b.name) ? -1 : 1));
  }, [staff, day, team, position, shift, q, sched, date]);
  const c = { total: pool.length, scheduled: 0, marked: 0, unmarked: 0, pending: 0, present: 0, late: 0, early: 0, leave: 0, absent: 0, ot: 0 };
  pool.forEach(s => { const f = day[s.id]; const e = schedOf(s.id); if (e && AMG_SC_TYPES[e.shift].work) c.scheduled++; const k = amgAtStatusKeys(f); if (amgAtHasStatus(f)) c.marked++; else if (k[0] === "pending") c.pending++; else c.unmarked++; if (amgAtIsPresent(f)) c.present++; if (f && f.diLamMuon) c.late++; if (f && f.veSom) c.early++; if (f && f.nghiPhep) c.leave++; if (f && f.nghiKhongPhep) c.absent++; if (otSet.has(s.id)) c.ot++; });
  const kpis = [
    { key: "all", label: plan ? "Tổng nhân viên" : "Tổng nhân viên", value: c.total, sub: plan ? `${c.scheduled} người có ca làm theo lịch` : "Chưa lập lịch làm việc ngày này", icon: Users, color: COLORS.blue },
    { key: "marked", label: "Đã điểm danh", value: c.marked, sub: `${c.total ? Math.round(c.marked * 100 / c.total) : 0}% sĩ số`, icon: ClipboardCheck, color: COLORS.green },
    { key: "unmarked", label: "Chưa điểm danh", value: c.unmarked, sub: "Chưa có trạng thái, giờ hay ghi chú", icon: AlertTriangle, color: c.unmarked ? COLORS.amber : COLORS.textFaint },
    { key: "pending", label: "Chờ xác nhận", value: c.pending, sub: "Có giờ/ghi chú, chưa chọn trạng thái", icon: ClockIcon, color: c.pending ? "#0369A1" : COLORS.textFaint },
    { key: "present", label: "Có mặt", value: c.present, sub: "Ca Ngày / Ca Đêm / Đảo Ca", icon: CheckCircle2, color: COLORS.green },
    { key: "late", label: "Đi muộn", value: c.late, icon: ClockIcon, color: COLORS.orange },
    { key: "early", label: "Về sớm", value: c.early, icon: RunFastIcon, color: COLORS.violet },
    { key: "leave", label: "Nghỉ phép", value: c.leave, icon: CalendarDays, color: COLORS.amber },
    { key: "absent", label: "Nghỉ không phép", value: c.absent, icon: X, color: COLORS.red },
    { key: "ot", label: "Đang tăng ca", value: c.ot, sub: "Đăng ký đã duyệt", icon: MoonIcon, color: COLORS.blue }
  ];
  const match = (s, key) => { const f = day[s.id]; const k = amgAtStatusKeys(f)[0];
    return key === "all" ? true : key === "marked" ? amgAtHasStatus(f) : key === "unmarked" ? k === "none" : key === "pending" ? k === "pending" : key === "present" ? amgAtIsPresent(f) : key === "late" ? !!(f && f.diLamMuon) : key === "early" ? !!(f && f.veSom) : key === "leave" ? !!(f && f.nghiPhep) : key === "absent" ? !!(f && f.nghiKhongPhep) : otSet.has(s.id); };
  const rows = pool.filter(s => match(s, flt));
  useEffect(() => { setPage(1); }, [date, team, position, shift, q, flt, pageSize]);
  const pg = amgPaginate(rows, page, pageSize);
  const wide = !boxW || boxW >= 1000;
  const past = date < amgTodayKey();
  const fltLabel = (kpis.find(k => k.key === flt) || {}).label;
  const run = async (fn, summary) => { try { await onMutate(date, fn, summary); } catch (e) { await showAlert((e && e.message) || "Không lưu được điểm danh. Vui lòng thử lại."); } };
  const upd = (sid, edit) => d => { const cur = Object.assign({}, d[sid] || {}); edit(cur); if (Object.keys(cur).length) d[sid] = cur; else delete d[sid]; return d; };
  const toggle = (s, a, val) => run(upd(s.id, cur => { if (a.key === "caNgay" && val) delete cur.caDem; if (a.key === "caDem" && val) delete cur.caNgay; if (val) cur[a.key] = true; else delete cur[a.key]; }), `Điểm danh ${s.name} (${s.code || s.id}): ${a.label} → ${val ? "có" : "bỏ"}`);
  const bulk = async key => {
    const a = ATTENDANCE_STATUSES.find(x => x.key === key);
    const targets = rows.filter(s => !(day[s.id] && (day[s.id].caNgay || day[s.id].caDem || day[s.id].nghiPhep || day[s.id].nghiKhongPhep)));
    if (!targets.length) { await showAlert("Không có ai chưa có ca (và chưa ghi nghỉ) trong danh sách đang lọc."); return; }
    if (!(await askConfirm(`Đặt “${a.label}” cho ${targets.length} người chưa có ca ngày ${amgFmtDate(date)}?\nNgười đã có ca hoặc đã ghi nghỉ sẽ không bị thay đổi.`, { confirmLabel: "Xác nhận" }))) return;
    run(d => { targets.forEach(s => { const cur = Object.assign({}, d[s.id] || {}); cur[key] = true; d[s.id] = cur; }); return d; }, `Điểm danh hàng loạt ${a.label}: ${targets.length} người`);
  };
  // Tích hợp lịch làm việc: điền Ca Ngày/Ca Đêm đúng theo lịch cho người chưa có ca/nghỉ
  const fromSchedule = async () => {
    const targets = rows.filter(s => { const e = schedOf(s.id); const f = day[s.id]; return e && AMG_SC_TYPES[e.shift].work && !(f && (f.caNgay || f.caDem || f.nghiPhep || f.nghiKhongPhep)); });
    if (!targets.length) { await showAlert("Không có ai cần điền: mọi người có ca làm theo lịch trong danh sách đang lọc đều đã có ca hoặc ghi nghỉ."); return; }
    if (!(await askConfirm(`Điền ca theo lịch làm việc cho ${targets.length} người ngày ${amgFmtDate(date)}?\nLịch “Ca ngày” → Ca Ngày, “Ca đêm” → Ca Đêm. Người đã có ca hoặc đã ghi nghỉ không bị thay đổi.`, { confirmLabel: "Điền theo lịch" }))) return;
    run(d => { targets.forEach(s => { const cur = Object.assign({}, d[s.id] || {}); cur[schedOf(s.id).shift === "dem" ? "caDem" : "caNgay"] = true; d[s.id] = cur; }); return d; }, `Điền điểm danh theo lịch làm việc: ${targets.length} người`);
  };
  const sel = (v, set, all, opts, label) => rkh("select", { className: "mes-input", "aria-label": label, value: v, onChange: e => set(e.target.value) }, rkh("option", { value: "all" }, all), opts.map(o => rkh("option", { key: o[0], value: o[0] }, o[1])));
  const teams = amgHrTeamOptions(staff).filter(t => staff.some(s => s.team === t)).map(t => [t, "Tổ " + t]);
  const shifts = [...new Set(["Ca ngày", "Ca đêm"].concat(amgHrUnique(staff, "shift")))].map(t => [t, t]);
  const positions = amgHrUnique(staff, "position").map(t => [t, t]);
  const quick = [ATTENDANCE_STATUSES.find(a => a.key === "caNgay"), ATTENDANCE_STATUSES.find(a => a.key === "caDem"), ATTENDANCE_STATUSES.find(a => a.key === "nghiPhep")];
  const exportXlsx = () => {
    const cols = [["STT", (r, i) => i + 1], ["Mã NV", r => r.s.code || ""], ["Họ và tên", r => r.s.name], ["Phòng ban / Tổ", r => r.s.team || ""], ["Bộ phận / chức vụ", r => r.s.position || ""], ["Ca làm", r => shiftOf(r.s)], ["Giờ vào", r => r.f.timeIn || ""], ["Giờ ra", r => r.f.timeOut || ""], ["Tổng thời gian (giờ)", r => { const m = amgAtMinutes(r.f); return m === null ? "" : Math.round(m / 6) / 10; }], ["Trạng thái", r => amgAtStatusKeys(r.f).map(k => AMG_AT_ST[k].label).join(", ")], ["Ghi chú", r => r.f.note || ""]];
    const data = rows.map((s, i) => ({ s, f: day[s.id] || {}, i }));
    amgExportExcel(`diem-danh-${date}`, cols.map(cc => ({ label: cc[0], export: r => cc[1](r, r.i) })), data, "Điểm danh");
  };
  const segs = [["all", "Tất cả", c.total], ["unmarked", "Chưa điểm danh", c.unmarked], ["marked", "Đã điểm danh", c.marked], ["pending", "Chờ xác nhận", c.pending]];
  const th = h => rkh("th", { key: h }, h);
  return rkh("div", { ref: boxRef },
    rkh("div", { className: "hr-bar mes-no-print" },
      rkh(Button, { onClick: () => setDate(amgHrAddDays(date, -1)), "aria-label": "Ngày trước" }, "‹"),
      rkh("input", { className: "mes-input", type: "date", "aria-label": "Ngày điểm danh", value: date, onChange: e => e.target.value && setDate(e.target.value) }),
      rkh(Button, { onClick: () => setDate(amgHrAddDays(date, 1)), "aria-label": "Ngày sau" }, "›"),
      rkh(Button, { onClick: () => setDate(amgTodayKey()), disabled: date === amgTodayKey() }, "Hôm nay"),
      sel(team, setTeam, "Tất cả phòng ban / tổ", teams, "Phòng ban / tổ"), sel(position, setPosition, "Tất cả bộ phận", positions, "Bộ phận"), sel(shift, setShift, "Tất cả ca", shifts, "Ca làm việc"),
      rkh("div", { className: "hr-search" }, rkh(Search, { size: 14 }), rkh("input", { className: "mes-input", placeholder: "Tìm theo mã hoặc tên...", "aria-label": "Tìm nhân viên", value: q, onChange: e => setQ(e.target.value) })),
      rkh(Button, { onClick: exportXlsx, disabled: rows.length === 0 }, rkh(Download, { size: 14 }), " Xuất Excel")),
    past && rkh("div", { className: "at-banner", role: "status" }, "Đang xem ngày đã qua — mọi thay đổi vẫn được ghi vào nhật ký thao tác."),
    !canMark && rkh("div", { className: "at-banner", role: "status" }, "Tài khoản của bạn chỉ có quyền xem điểm danh."),
    rkh("div", { className: "hr-kpis" }, kpis.map(k => rkh(StatCard, { key: k.key, icon: k.icon, label: k.label, value: k.value, sub: k.sub, accent: k.color, title: "Nhấn để lọc danh sách", onClick: () => setFlt(f => f === k.key ? "all" : k.key) }))),
    rkh("div", { className: "at-seg mes-no-print", role: "group", "aria-label": "Danh sách", style: { marginBottom: 12, flexWrap: "wrap" } }, segs.map(g => rkh("button", { key: g[0], type: "button", "aria-pressed": flt === g[0], onClick: () => setFlt(g[0]) }, `${g[1]} (${g[2]})`))),
    !["all", "marked", "unmarked", "pending"].includes(flt) && rkh("div", { className: "at-banner", role: "status" }, `Đang lọc: ${fltLabel} (${rows.length} người) `, rkh("button", { type: "button", className: "hr-chip", onClick: () => setFlt("all") }, "Bỏ lọc")),
    canMark && rkh("div", { className: "hr-bar mes-no-print" }, rkh("span", { style: { fontSize: FZ(13), color: COLORS.textDim } }, "Điền nhanh cho người chưa có ca:"), rkh(Button, { onClick: () => bulk("caNgay") }, "Ca Ngày"), rkh(Button, { onClick: () => bulk("caDem") }, "Ca Đêm"), plan && rkh(Button, { onClick: fromSchedule }, "Điền theo lịch làm việc")),
    rows.length === 0 ? rkh(EmptyState, { icon: Users, title: staff.length === 0 ? "Chưa có dữ liệu nhân sự" : "Không có nhân viên phù hợp", hint: "Thử đổi ngày, phòng ban, ca hoặc bỏ bộ lọc." }) :
    wide ? rkh("div", { className: "mes-card", style: { overflow: "hidden" } }, rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
      rkh("thead", null, rkh("tr", null, ["STT", "Mã NV", "Họ và tên", "Phòng ban / Tổ", "Bộ phận", "Ca làm", "Giờ vào", "Giờ ra", "Tổng thời gian", "Trạng thái", "Ghi chú"].map(th), canMark && rkh("th", { key: "act" }, "Ghi nhận"))),
      rkh("tbody", null, pg.items.map((s, i) => { const f = day[s.id] || {}; const mins = amgAtMinutes(f); const none = amgAtStatusKeys(f)[0] === "none"; return rkh("tr", { key: s.id },
        rkh("td", { style: { whiteSpace: "nowrap" } }, pg.from + i + 1), rkh("td", { className: "mes-mono", style: { whiteSpace: "nowrap" } }, s.code || "—"),
        rkh("td", { style: { minWidth: 160, fontWeight: 600 } }, s.name), rkh("td", { style: { whiteSpace: "nowrap" } }, s.team ? "Tổ " + s.team : "—"), rkh("td", null, s.position || "—"),
        rkh("td", { style: { whiteSpace: "nowrap" } }, shiftOf(s) || "—"), rkh("td", null, f.timeIn || "—"), rkh("td", null, f.timeOut || "—"), rkh("td", { style: { whiteSpace: "nowrap" } }, amgAtHoursText(mins)),
        rkh("td", { style: { minWidth: 130 } }, rkh(AtStatusPills, { f })), rkh("td", { style: { maxWidth: 200 } }, rkh(Clamp, { text: f.note, lines: 2 })),
        canMark && rkh("td", { style: { whiteSpace: "nowrap" } }, rkh("div", { style: { display: "flex", gap: 4, alignItems: "center" } }, none && quick.map(a => rkh("button", { key: a.key, type: "button", className: "at-chip", style: { "--at-c": a.color, minHeight: 30, padding: "3px 8px" }, "aria-pressed": false, onClick: () => toggle(s, a, true) }, a.label)), rkh(IconButton, { icon: Pencil, title: "Chi tiết: trạng thái, giờ vào/ra, ghi chú", onClick: () => setDetail(s) })))); }))))) :
    rkh("div", { style: { display: "grid", gap: 10 } }, pg.items.map(s => { const f = day[s.id] || {}; const mins = amgAtMinutes(f); return rkh("div", { key: s.id, className: "at-card" },
      rkh("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" } }, rkh("div", { style: { minWidth: 0 } }, rkh("div", { className: "hr-name" }, s.name), rkh("div", { className: "hr-sub" }, `${s.code || "—"} · ${s.team ? "Tổ " + s.team : "—"}${s.position ? " · " + s.position : ""}${shiftOf(s) ? " · " + shiftOf(s) : ""}`)), canMark && rkh(IconButton, { icon: Pencil, title: "Chi tiết: trạng thái, giờ vào/ra, ghi chú", onClick: () => setDetail(s) })),
      rkh(AtStatusPills, { f }),
      canMark && rkh("div", { className: "at-flags" }, ATTENDANCE_STATUSES.map(a => rkh("button", { key: a.key, type: "button", className: "at-chip", style: { "--at-c": a.color }, "aria-pressed": !!f[a.key], onClick: () => toggle(s, a, !f[a.key]) }, a.label))),
      (f.timeIn || f.note) && rkh("div", { className: "hr-sub", style: { whiteSpace: "normal" } }, [f.timeIn && `${f.timeIn}–${f.timeOut || "…"} (${amgAtHoursText(mins)})`, f.note].filter(Boolean).join(" · "))); })),
    rows.length > 0 && rkh(Pager, { total: rows.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }),
    detail && rkh(AtDetailModal, { s: detail, flags: day[detail.id], date, canMark, onClose: () => setDetail(null),
      onSave: v => onMutate(date, upd(detail.id, cur => { ["note", "timeIn", "timeOut"].forEach(k => { if (v[k]) cur[k] = v[k]; else delete cur[k]; }); AMG_AT_STATUS_KEYS.forEach(k => { if (v.flags && v.flags[k]) cur[k] = true; else delete cur[k]; }); }), `Cập nhật điểm danh ${detail.name} (${detail.code || detail.id})`) }));
}

/* ---------- Báo cáo chấm công ---------- */
function HrAtReport({ staff, attendance, extra }) {
  const [mode, setMode] = useState("month");
  const [key, setKey] = useState(amgTodayKey());
  const [group, setGroup] = useState("staff");
  const [team, setTeam] = useState("all");
  const [shift, setShift] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [boxRef, boxW] = useBoxWidth();
  const [from, to] = amgAtRange(mode, key);
  const list = useMemo(() => { const nq = amgHrNorm(q); return staff.filter(s => (team === "all" || s.team === team) && (shift === "all" || (s.shift || "") === shift) && (!nq || amgHrNorm((s.code || "") + " " + (s.name || "")).includes(nq))); }, [staff, team, shift, q]);
  const rep = useMemo(() => amgAtReport(list, attendance, extra.overtime || [], from, to), [list, attendance, extra, from, to]);
  const daysWithData = Object.keys(attendance || {}).filter(d => d >= from && d <= to && Object.keys(attendance[d] || {}).length).length;
  const sum = rep.reduce((a, r) => ({ work: a.work + r.work, leave: a.leave + r.leave, absent: a.absent + r.absent, late: a.late + r.late, early: a.early + r.early, pending: a.pending + r.pending, minutes: a.minutes + r.minutes, hasTime: a.hasTime || r.hasTime, ot: a.ot + r.ot }), { work: 0, leave: 0, absent: 0, late: 0, early: 0, pending: 0, minutes: 0, hasTime: false, ot: 0 });
  let rows;
  if (group === "staff") rows = rep.slice().sort((a, b) => (TEAMS.indexOf(a.s.team) - TEAMS.indexOf(b.s.team)) || (amgHrNameKey(a.s.name) < amgHrNameKey(b.s.name) ? -1 : 1)).map(r => Object.assign({ id: r.s.id, label: r.s.name, code: r.s.code, team: r.s.team }, r));
  else { const m = {}; rep.forEach(r => { const k = group === "team" ? (r.s.team ? "Tổ " + r.s.team : "Chưa phân tổ") : group === "position" ? (r.s.position || "Chưa có bộ phận/chức vụ") : (r.s.shift || "Chưa có ca"); const g = m[k] = m[k] || { id: k, label: k, count: 0, work: 0, leave: 0, absent: 0, late: 0, early: 0, pending: 0, minutes: 0, hasTime: false, ot: 0 }; g.count++; ["work", "leave", "absent", "late", "early", "pending", "minutes", "ot"].forEach(f => { g[f] += r[f]; }); g.hasTime = g.hasTime || r.hasTime; }); rows = Object.values(m); }
  useEffect(() => { setPage(1); }, [mode, key, group, team, shift, q, pageSize]);
  const pg = amgPaginate(rows, page, pageSize);
  const wide = amgIsWide(boxW);
  const hrs = r => r.hasTime ? amgAtHoursText(r.minutes) : "—";
  const COLS = [["Ngày công", r => r.work], ["Nghỉ phép", r => r.leave], ["Nghỉ không phép", r => r.absent], ["Tổng ngày nghỉ", r => r.leave + r.absent], ["Số lần đi muộn", r => r.late], ["Số lần về sớm", r => r.early], ["Chờ xác nhận", r => r.pending], ["Tổng giờ làm", hrs], ["Giờ tăng ca (đã duyệt)", r => r.ot]];
  const firstCols = group === "staff" ? [["Mã NV", r => r.code || "—"], ["Họ và tên", r => r.label], ["Phòng ban / Tổ", r => r.team || "—"]] : [[group === "team" ? "Phòng ban / Tổ" : group === "position" ? "Bộ phận" : "Ca", r => r.label], ["Sĩ số", r => r.count]];
  const exportXlsx = () => amgExportExcel(`bao-cao-cham-cong-${mode}-${from}`, firstCols.concat(COLS).map(c => ({ label: c[0], export: r => c[1](r) })), rows, "Chấm công");
  const sel = (v, set, all, opts, label) => rkh("select", { className: "mes-input", "aria-label": label, value: v, onChange: e => set(e.target.value) }, rkh("option", { value: "all" }, all), opts.map(o => rkh("option", { key: o, value: o }, o)));
  const periodText = from === to ? amgFmtDate(from) : `${amgFmtDate(from)} → ${amgFmtDate(to)}`;
  const tiles = [["Ngày công", sum.work, COLORS.green, CheckCircle2], ["Nghỉ phép", sum.leave, COLORS.amber, CalendarDays], ["Nghỉ không phép", sum.absent, COLORS.red, X], ["Đi muộn", sum.late, COLORS.orange, ClockIcon], ["Về sớm", sum.early, COLORS.violet, RunFastIcon], ["Giờ tăng ca", Math.round(sum.ot * 10) / 10, COLORS.blue, MoonIcon]];
  return rkh("div", { ref: boxRef },
    rkh("div", { className: "hr-bar mes-no-print" },
      rkh("div", { className: "at-seg", role: "group", "aria-label": "Kỳ báo cáo" }, [["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]].map(m => rkh("button", { key: m[0], type: "button", "aria-pressed": mode === m[0], onClick: () => setMode(m[0]) }, m[1]))),
      rkh("input", { className: "mes-input", type: "date", "aria-label": "Ngày trong kỳ", value: key, onChange: e => e.target.value && setKey(e.target.value) }),
      rkh("select", { className: "mes-input", "aria-label": "Nhóm theo", value: group, onChange: e => setGroup(e.target.value) }, rkh("option", { value: "staff" }, "Theo nhân viên"), rkh("option", { value: "team" }, "Theo phòng ban / tổ"), rkh("option", { value: "position" }, "Theo bộ phận"), rkh("option", { value: "shift" }, "Theo ca")),
      sel(team, setTeam, "Tất cả tổ", amgHrTeamOptions(staff).filter(t => staff.some(s => s.team === t)), "Tổ"), sel(shift, setShift, "Tất cả ca", amgHrUnique(staff, "shift"), "Ca làm việc"),
      rkh("div", { className: "hr-search" }, rkh(Search, { size: 14 }), rkh("input", { className: "mes-input", placeholder: "Tìm theo mã hoặc tên...", "aria-label": "Tìm nhân viên", value: q, onChange: e => setQ(e.target.value) })),
      rkh(Button, { onClick: exportXlsx, disabled: rows.length === 0 }, rkh(Download, { size: 14 }), " Xuất Excel")),
    rkh("div", { className: "at-banner", role: "status" }, `Kỳ báo cáo: ${periodText} · ${daysWithData} ngày có dữ liệu điểm danh · ${list.length} nhân viên`),
    rkh("div", { className: "hr-kpis" }, tiles.map(t => rkh(StatCard, { key: t[0], icon: t[3], label: t[0], value: t[1], accent: t[2] }))),
    rows.length === 0 ? rkh(EmptyState, { icon: Users, title: "Không có dữ liệu", hint: "Thử đổi kỳ báo cáo hoặc bộ lọc." }) :
    wide ? rkh("div", { className: "mes-card", style: { overflow: "hidden" } }, rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
      rkh("thead", null, rkh("tr", null, firstCols.concat(COLS).map(c => rkh("th", { key: c[0] }, c[0])))),
      rkh("tbody", null, pg.items.map(r => rkh("tr", { key: r.id }, firstCols.concat(COLS).map((c, i) => rkh("td", { key: c[0], className: c[0] === "Mã NV" ? "mes-mono" : undefined, style: c[0] === "Họ và tên" || c[0] === "Phòng ban / Tổ" || c[0] === "Bộ phận" || c[0] === "Ca" ? { fontWeight: 600 } : undefined }, c[1](r)))))),
      rkh("tfoot", null, rkh("tr", { style: { fontWeight: 800 } }, rkh("td", { colSpan: firstCols.length }, "Tổng cộng"), COLS.map(c => rkh("td", { key: c[0] }, c[1](Object.assign({}, sum))))))))) :
    rkh("div", { style: { display: "grid", gap: 10 } }, pg.items.map(r => rkh("div", { key: r.id, className: "at-card" },
      rkh("div", { className: "hr-name" }, r.label), group === "staff" ? rkh("div", { className: "hr-sub" }, `${r.code || "—"} · Tổ ${r.team || "—"}`) : rkh("div", { className: "hr-sub" }, `${r.count} người`),
      rkh("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 } }, COLS.map(c => rkh(KV, { key: c[0], label: c[0] }, c[1](r))))))),
    rows.length > 0 && rkh(Pager, { total: rows.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }));
}

/* ---------- Khu Điểm danh – Chấm công ---------- */
function HrAttendance({ staff, attendance, extra, currentUser, onMutate, sched }) {
  const [view, setView] = useState("day");
  const canMark = useMemo(() => typeof amgCheckWrite === "function" && !!currentUser && amgCheckWrite(currentUser, FS.attendance, "set", "x", {}).ok, [currentUser]);
  return rkh("div", null,
    rkh("div", { className: "at-seg mes-no-print", role: "group", "aria-label": "Chế độ", style: { marginBottom: 14 } }, [["day", "Điểm danh trong ngày"], ["report", "Báo cáo chấm công"]].map(v => rkh("button", { key: v[0], type: "button", "aria-pressed": view === v[0], onClick: () => setView(v[0]) }, v[1]))),
    view === "day" ? rkh(HrAtDay, { staff, attendance, extra, sched, canMark, onMutate }) : rkh(HrAtReport, { staff, attendance, extra }));
}
