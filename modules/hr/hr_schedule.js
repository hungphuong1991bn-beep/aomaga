/* ===================== NHÂN SỰ · GIAI ĐOẠN 3 (v58): LỊCH LÀM VIỆC =====================
   Dữ liệu MỚI, chỉ thêm (không đổi attendance/staff/overtime):
     schedule/{yyyy-mm-dd} = { [staffId]: { shift, start?, end?, note?, swapFrom?, confirmed, changed?, notified?, by, at } }
     schedule/_settings    = { ngay:{from,to}, dem:{from,to}, minPerGroup? }   (do người dùng cài, không có số mặc định bịa)
   - Mỗi nhân viên đúng MỘT mục/ngày → không thể có hai ca trùng trong cùng một ngày.
   - shift: ngay | dem | nghi_phep | nghi_le. Hệ thống hiện chỉ có Ca ngày / Ca đêm nên không tạo thêm "ca sáng/chiều".
   - Giờ bắt đầu/kết thúc: lấy từ mục lịch, nếu trống thì lấy từ cài đặt giờ ca (mặc định theo AMG_CONFIG.shifts: 06:00–18:00).
   - Ghi qua onMutate (đọc-sửa-ghi có điều kiện, có nhật ký). Cảnh báo chỉ tính khi đủ dữ liệu để xác định. */

const AMG_SC_TYPES = {
  ngay: { label: "Ca ngày", short: "Ngày", color: "#2563EB", work: true },
  dem: { label: "Ca đêm", short: "Đêm", color: "#7C3AED", work: true },
  nghi_phep: { label: "Nghỉ phép", short: "Phép", color: "#15803D", work: false },
  nghi_le: { label: "Nghỉ lễ", short: "Lễ", color: "#0E7490", work: false }
};
const AMG_SC_SWAP_COLOR = "#B45309";
const AMG_SC_OT_COLOR = "#C2410C";
const AMG_SC_DAYNAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const AMG_SC_KEY = /^\d{4}-\d{2}-\d{2}$/;

function amgScDefaults() {
  const d = (typeof AMG_CONFIG !== "undefined" && AMG_CONFIG.shifts && AMG_CONFIG.shifts.ngay) || { from: "06:00", to: "18:00" };
  return { ngay: { from: d.from, to: d.to }, dem: { from: d.to, to: d.from } };
}
function amgScHours(settings, type) {
  const def = amgScDefaults(); const s = (settings && settings[type]) || {};
  return type === "ngay" || type === "dem" ? { from: s.from || def[type].from, to: s.to || def[type].to } : null;
}
function amgScShow(entry, settings) {
  if (!entry) return null;
  const t = AMG_SC_TYPES[entry.shift]; if (!t) return null;
  const h = amgScHours(settings, entry.shift);
  return { type: entry.shift, meta: t, start: entry.start || (h && h.from) || "", end: entry.end || (h && h.to) || "" };
}
function amgScDayKeys(days) { return Object.keys(days || {}).filter(k => AMG_SC_KEY.test(k)); }
function amgScEntry(days, date, sid) { const d = days && days[date]; return d && d[sid] ? d[sid] : null; }
function amgScDayHasPlan(days, date) { const d = days && days[date]; return !!d && Object.keys(d).length > 0; }
function amgScStatusOf(e) { return !e ? "Chưa xếp ca" : e.changed && !e.notified ? "Đã đổi – chưa thông báo" : e.confirmed ? "Đã xác nhận" : "Chưa xác nhận"; }
function amgScClean(o) { const r = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined && o[k] !== "" && o[k] !== null) r[k] = o[k]; }); return r; }
// Tạo mục lịch mới từ mục cũ: nếu mục cũ đã xác nhận mà bị sửa → đánh dấu "đã đổi, chưa thông báo"
function amgScMake(prev, patch, who, now) {
  const e = amgScClean(Object.assign({}, patch, { confirmed: false, by: who, at: now }));
  if (prev) {
    const diff = prev.shift !== e.shift || (prev.start || "") !== (e.start || "") || (prev.end || "") !== (e.end || "");
    if (prev.shift !== e.shift) e.swapFrom = prev.shift;
    if (prev.confirmed && diff) { e.changed = true; e.notified = false; }
    else if (prev.confirmed) { e.confirmed = true; if (prev.changed) { e.changed = prev.changed; e.notified = prev.notified; } }
    else if (prev.changed) { e.changed = prev.changed; e.notified = prev.notified; }
  }
  return amgScClean(e);
}
function amgScPool(staff, f) {
  const nq = amgHrNorm(f.q || "");
  return staff.filter(s => s.status !== "Đã nghỉ" && (!f.team || f.team === "all" || s.team === f.team) && (!f.position || f.position === "all" || (s.position || "") === f.position) && (!f.person || f.person === "all" || s.id === f.person) && (!nq || amgHrNorm((s.code || "") + " " + (s.name || "")).includes(nq)))
    .sort((a, b) => (TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team)) || (amgHrNameKey(a.name) < amgHrNameKey(b.name) ? -1 : 1));
}
function amgScOtMap(overtime, from, to) {
  const m = {};
  (overtime || []).forEach(o => { const d = String(o.date || "").slice(0, 10); if (d >= from && d <= to && o.status !== "tu_choi") { const k = d + "|" + o.staffId; (m[k] = m[k] || []).push(o); } });
  return m;
}
function amgScMonthGrid(key) {
  const first = key.slice(0, 8) + "01"; const [mon] = amgAtWeek(first); const last = amgHrMonthEnd(first); const [, end] = amgAtWeek(last);
  return { first, last, cells: amgAtDays(mon, end) };
}

/* ---------- Cảnh báo (chỉ khi đủ dữ liệu) ---------- */
function amgScAlerts({ pool, days, attendance, overtime, settings, from, to }) {
  const ids = new Set(pool.map(s => s.id)); const byId = {}; pool.forEach(s => { byId[s.id] = s; });
  const dates = amgAtDays(from, to); const out = { unassigned: [], conflict: [], short: [], unconfirmed: [], unnotified: [], otPending: [] };
  const min = Number(settings && settings.minPerGroup) || 0; const used = {};
  dates.forEach(d => { const day = days[d] || {}; Object.keys(day).forEach(sid => { const e = day[sid]; if (byId[sid] && AMG_SC_TYPES[e.shift] && AMG_SC_TYPES[e.shift].work) used[(byId[sid].team || "") + "|" + e.shift] = true; }); });
  dates.forEach(d => {
    const day = days[d] || {}; const plan = amgScDayHasPlan(days, d); const att = (attendance || {})[d] || {};
    pool.forEach(s => {
      const e = day[s.id]; const f = att[s.id];
      if (plan && !e) out.unassigned.push({ date: d, s, note: "Chưa có ca/nghỉ trong lịch ngày này" });
      if (e) {
        const w = AMG_SC_TYPES[e.shift] && AMG_SC_TYPES[e.shift].work;
        if (w && f && (f.nghiPhep || f.nghiKhongPhep)) out.conflict.push({ date: d, s, note: "Xếp ca làm nhưng điểm danh ghi nghỉ" });
        if (!w && f && amgAtIsPresent(f)) out.conflict.push({ date: d, s, note: "Xếp nghỉ nhưng điểm danh ghi có mặt" });
        if (!e.confirmed) out.unconfirmed.push({ date: d, s, note: "Lịch chưa xác nhận" });
        if (e.changed && !e.notified) out.unnotified.push({ date: d, s, note: "Lịch đã thay đổi, chưa đánh dấu đã thông báo" });
      }
    });
    if (min > 0 && plan) {
      const cnt = {}; pool.forEach(s => { const e = day[s.id]; if (e && AMG_SC_TYPES[e.shift] && AMG_SC_TYPES[e.shift].work) { const k = (s.team || "") + "|" + e.shift; cnt[k] = (cnt[k] || 0) + 1; } });
      Object.keys(used).forEach(k => { if ((cnt[k] || 0) < min) { const [team, sh] = k.split("|"); out.short.push({ date: d, s: { id: k, name: (team ? "Tổ " + team : "Chưa phân tổ") + " · " + AMG_SC_TYPES[sh].label, code: "" }, note: `${cnt[k] || 0}/${min} người` }); } });
    }
  });
  (overtime || []).forEach(o => { const d = String(o.date || "").slice(0, 10); if (o.status === "cho_duyet" && d >= from && d <= to && ids.has(o.staffId)) out.otPending.push({ date: d, s: byId[o.staffId], note: `${o.hours || "?"} giờ — chờ duyệt` }); });
  (overtime || []).forEach(o => { const d = String(o.date || "").slice(0, 10); const e = amgScEntry(days, d, o.staffId); if (e && !AMG_SC_TYPES[e.shift].work && o.status !== "tu_choi" && ids.has(o.staffId) && d >= from && d <= to) out.conflict.push({ date: d, s: byId[o.staffId], note: "Có đăng ký tăng ca vào ngày được xếp nghỉ" }); });
  return out;
}

/* ---------- Dữ liệu: đăng ký theo dõi schedule (chỉ khi đang mở tab cần) ---------- */
function useHrSchedule(enabled) {
  const [st, setSt] = useState({ days: {}, settings: {}, ready: false });
  useEffect(() => {
    if (!enabled || typeof db === "undefined" || !db) return;
    let unsub = null;
    try {
      unsub = amgSnapDedup(db.collection(FS.schedule), s => {
        const days = {}; let settings = {};
        s.docs.forEach(d => { if (d.id === "_settings") settings = d.data() || {}; else if (AMG_SC_KEY.test(d.id)) days[d.id] = d.data(); });
        setSt({ days, settings, ready: true });
      }, () => setSt(p => Object.assign({}, p, { ready: true })));
    } catch (e) {}
    return () => { try { unsub && unsub(); } catch (e) {} };
  }, [enabled]);
  return st;
}

(function amgScInjectStyle() {
  if (typeof document === "undefined" || document.getElementById("amg-sc-style")) return;
  const st = document.createElement("style"); st.id = "amg-sc-style";
  st.textContent = `
.sc-leg{display:flex;flex-wrap:wrap;gap:6px 12px;margin-bottom:12px;font-size:var(--fs-xs);color:var(--c-dim);align-items:center;}
.sc-leg span{display:inline-flex;align-items:center;gap:5px;}
.sc-dot{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;font-size:11px;font-weight:800;color:#fff;background:var(--sc-c);}
.sc-cell{display:flex;flex-direction:column;align-items:center;gap:2px;border-radius:8px;border:1px solid var(--sc-c,var(--c-border));background:transparent;color:var(--sc-c,var(--c-faint));padding:4px 6px;min-width:58px;min-height:44px;cursor:pointer;font-family:inherit;font-size:var(--fs-xs);font-weight:700;line-height:1.2;}
.sc-cell:hover{background:var(--c-inset);}
.sc-cell small{font-weight:600;font-size:10px;color:var(--c-dim);}
.sc-empty{border-style:dashed;color:var(--c-faint);font-weight:500;}
.sc-week{border-collapse:separate;border-spacing:0;width:100%;min-width:780px;}
.sc-week th,.sc-week td{padding:6px 5px;border-bottom:1px solid var(--c-border);text-align:center;vertical-align:middle;}
.sc-week th:first-child,.sc-week td:first-child{text-align:left;position:sticky;left:0;background:var(--c-panel);z-index:1;min-width:150px;}
.sc-today{background:var(--c-inset);}
.sc-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;}
.sc-mh{font-size:var(--fs-xs);font-weight:700;color:var(--c-faint);text-align:center;padding:4px 0;}
.sc-day{display:flex;flex-direction:column;gap:3px;align-items:stretch;text-align:left;min-height:84px;padding:6px;border:1px solid var(--c-border);border-radius:8px;background:var(--c-panel);cursor:pointer;font-family:inherit;color:inherit;min-width:0;}
.sc-day:hover{border-color:var(--c-border2);background:var(--c-inset);}
.sc-day[data-out="1"]{opacity:.45;}
.sc-day[data-today="1"]{border-color:var(--c-navy);box-shadow:0 0 0 1px var(--c-navy);}
.sc-day b{font-size:var(--fs-sm);}
.sc-cnt{font-size:10px;font-weight:700;display:flex;gap:4px;align-items:center;white-space:nowrap;overflow:hidden;}
.sc-alert{border:1px solid var(--c-border);border-left:4px solid var(--sc-c);border-radius:var(--r-md);background:var(--c-panel);padding:8px 12px;margin-bottom:8px;}
.sc-alert summary{cursor:pointer;font-weight:700;font-size:var(--fs-sm);}
.sc-alert ul{margin:8px 0 0;padding-left:18px;font-size:var(--fs-xs);color:var(--c-dim);}
@media (max-width:640px){.sc-day{min-height:62px;padding:4px;}.sc-cnt{font-size:9px;}}
`;
  document.head.appendChild(st);
})();

function ScBadge({ type, small }) {
  const t = AMG_SC_TYPES[type]; if (!t) return rkh(Badge, { color: COLORS.textFaint }, "Chưa xếp ca");
  return rkh(Badge, { color: t.color }, small ? t.short : t.label);
}
function ScLegend() {
  return rkh("div", { className: "sc-leg", role: "list", "aria-label": "Chú giải màu" },
    Object.keys(AMG_SC_TYPES).map(k => rkh("span", { key: k, role: "listitem" }, rkh("i", { className: "sc-dot", style: { "--sc-c": AMG_SC_TYPES[k].color }, "aria-hidden": true }, AMG_SC_TYPES[k].short[0]), AMG_SC_TYPES[k].label)),
    rkh("span", { role: "listitem" }, rkh("i", { className: "sc-dot", style: { "--sc-c": AMG_SC_SWAP_COLOR }, "aria-hidden": true }, "ĐC"), "Đổi ca"),
    rkh("span", { role: "listitem" }, rkh("i", { className: "sc-dot", style: { "--sc-c": AMG_SC_OT_COLOR }, "aria-hidden": true }, "TC"), "Tăng ca"),
    rkh("span", { role: "listitem" }, rkh("i", { className: "sc-dot", style: { "--sc-c": COLORS.textFaint }, "aria-hidden": true }, "—"), "Chưa xếp ca"));
}

/* ---------- Ô ca (tuần / người) ---------- */
function ScCell({ e, settings, ot, onClick, label }) {
  const sh = amgScShow(e, settings); const otx = ot && ot.length ? ot : null;
  const color = sh ? sh.meta.color : COLORS.textFaint;
  return rkh("button", { type: "button", className: "sc-cell" + (sh ? "" : " sc-empty"), style: { "--sc-c": color }, onClick, "aria-label": label },
    rkh("span", null, sh ? sh.meta.short : "—"),
    sh && sh.meta.work && rkh("small", null, `${sh.start}–${sh.end}`),
    (e && e.swapFrom || otx || (e && !e.confirmed)) && rkh("small", { style: { display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" } },
      e && e.swapFrom && rkh("span", { style: { color: AMG_SC_SWAP_COLOR } }, "ĐC"),
      otx && rkh("span", { style: { color: AMG_SC_OT_COLOR } }, "TC" + (otx.some(o => o.status === "cho_duyet") ? "?" : "")),
      e && !e.confirmed && rkh("span", { title: "Chưa xác nhận" }, "○")));
}

/* ---------- Chi tiết / chỉnh một ca ---------- */
function ScDetailModal({ s, date, entry, settings, ot, attendanceFlags, canEdit, onClose, onSave, onDelete, onViewPerson }) {
  const [shift, setShift] = useState(entry ? entry.shift : "ngay");
  const h0 = amgScHours(settings, shift);
  const [start, setStart] = useState(entry && entry.start || "");
  const [end, setEnd] = useState(entry && entry.end || "");
  const [note, setNote] = useState(entry && entry.note || "");
  const [err, setErr] = useState("");
  const work = AMG_SC_TYPES[shift].work;
  const submit = async () => {
    if (note.length > 200) return setErr("Ghi chú tối đa 200 ký tự");
    if (work && ((start && !end) || (!start && end))) return setErr("Nhập đủ cả giờ bắt đầu và giờ kết thúc, hoặc để trống để dùng giờ ca mặc định");
    try { await onSave({ shift, start: work ? start : "", end: work ? end : "", note: note.trim() }); onClose(); } catch (e) { setErr(e.message || "Không lưu được"); }
  };
  const sh = amgScShow(entry, settings);
  return rkh(Modal, { title: `Chi tiết lịch — ${s.name}`, onClose, width: 480 },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, `${s.code || "—"} · ${s.team ? "Tổ " + s.team : "—"}${s.position ? " · " + s.position : ""} · ${amgFmtDate(date)}`),
    rkh(HrDL, { rows: [["Ca làm", sh ? sh.meta.label : "Chưa xếp ca"], ["Giờ", sh && sh.meta.work ? `${sh.start} – ${sh.end}` : "—"], ["Trạng thái lịch", amgScStatusOf(entry)], ["Đổi ca", entry && entry.swapFrom ? "Từ " + (AMG_SC_TYPES[entry.swapFrom] || {}).label : "Không"],
      ["Tăng ca", ot && ot.length ? ot.map(o => `${o.hours} giờ (${o.status === "da_duyet" ? "đã duyệt" : "chờ duyệt"})`).join(", ") : "Không"], ["Điểm danh", attendanceFlags && amgAtHasStatus(attendanceFlags) ? ATTENDANCE_STATUSES.filter(a => attendanceFlags[a.key]).map(a => a.label).join(", ") : "Chưa điểm danh"]] }),
    entry && entry.note && !canEdit && rkh("div", { className: "hr-sub", style: { whiteSpace: "normal", marginTop: 8 } }, "Ghi chú: " + entry.note),
    canEdit && rkh("div", { style: { marginTop: 14, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 } },
      rkh(Field, { label: "Ca / nghỉ" }, rkh("select", { className: "mes-input", value: shift, onChange: e => { setShift(e.target.value); setStart(""); setEnd(""); } }, Object.keys(AMG_SC_TYPES).map(k => rkh("option", { key: k, value: k }, AMG_SC_TYPES[k].label)))),
      work && rkh("div", { className: "hr-form" },
        rkh(Field, { label: "Giờ bắt đầu" }, rkh("input", { className: "mes-input", type: "time", value: start, placeholder: h0 && h0.from, onChange: e => setStart(e.target.value) })),
        rkh(Field, { label: "Giờ kết thúc" }, rkh("input", { className: "mes-input", type: "time", value: end, onChange: e => setEnd(e.target.value) }))),
      work && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, margin: "-6px 0 8px" } }, `Để trống = giờ ca mặc định (${h0.from} – ${h0.to})`),
      rkh(Field, { label: "Ghi chú" }, rkh("textarea", { className: "mes-input", rows: 2, maxLength: 200, value: note, onChange: e => setNote(e.target.value) })),
      err && rkh("div", { className: "hr-err", role: "alert" }, err),
      rkh("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        rkh(Button, { variant: "primary", onClick: submit }, entry ? "Lưu thay đổi" : "Xếp ca"),
        entry && rkh(Button, { variant: "danger", onClick: async () => { try { await onDelete(); onClose(); } catch (e) { setErr(e.message || "Không xóa được"); } } }, "Xóa lịch"))),
    rkh("div", { style: { marginTop: 10 } }, rkh(Button, { onClick: () => { onViewPerson(s.id); onClose(); } }, "Xem lịch cả tuần của người này")));
}

/* ---------- Phân công ca (một người / cả tổ / đang lọc, theo khoảng ngày) ---------- */
function ScAssignModal({ pool, allStaff, defaultDate, settings, existing, onClose, onSubmit }) {
  const [mode, setMode] = useState("filtered");
  const [sid, setSid] = useState(pool[0] ? pool[0].id : "");
  const teams = amgHrTeamOptions(allStaff).filter(t => allStaff.some(s => s.team === t && s.status !== "Đã nghỉ"));
  const [team, setTeam] = useState(teams[0] || "");
  const [from, setFrom] = useState(defaultDate); const [to, setTo] = useState(defaultDate);
  const [skipSun, setSkipSun] = useState(false);
  const [shift, setShift] = useState("ngay"); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const work = AMG_SC_TYPES[shift].work; const h0 = amgScHours(settings, shift);
  const targets = mode === "one" ? allStaff.filter(s => s.id === sid) : mode === "team" ? allStaff.filter(s => s.status !== "Đã nghỉ" && s.team === team) : pool;
  const dates = from && to && from <= to ? amgAtDays(from, to).filter(d => !(skipSun && new Date(d + "T00:00:00").getDay() === 0)) : [];
  const overwrite = targets.reduce((n, s) => n + dates.filter(d => existing(d, s.id)).length, 0);
  const submit = () => {
    if (!targets.length) return setErr("Chưa có nhân viên nào được chọn");
    if (!dates.length) return setErr("Khoảng ngày không hợp lệ (ngày bắt đầu phải trước hoặc bằng ngày kết thúc, tối đa 400 ngày)");
    if (work && ((start && !end) || (!start && end))) return setErr("Nhập đủ cả giờ bắt đầu và giờ kết thúc, hoặc để trống");
    if (note.length > 200) return setErr("Ghi chú tối đa 200 ký tự");
    onSubmit({ targets, dates, shift, start: work ? start : "", end: work ? end : "", note: note.trim(), overwrite }).then(() => onClose()).catch(e => setErr(e && e.message || "Không lưu được"));
  };
  return rkh(Modal, { title: "Phân công ca làm việc", onClose, width: 520 },
    rkh(Field, { label: "Áp dụng cho" }, rkh("select", { className: "mes-input", value: mode, onChange: e => setMode(e.target.value) },
      rkh("option", { value: "filtered" }, `Tất cả nhân viên đang lọc (${pool.length} người)`), rkh("option", { value: "team" }, "Cả một tổ / phòng ban"), rkh("option", { value: "one" }, "Một nhân viên"))),
    mode === "team" && rkh(Field, { label: "Tổ / phòng ban" }, rkh("select", { className: "mes-input", value: team, onChange: e => setTeam(e.target.value) }, teams.map(t => rkh("option", { key: t, value: t }, "Tổ " + t)))),
    mode === "one" && rkh(Field, { label: "Nhân viên" }, rkh("select", { className: "mes-input", value: sid, onChange: e => setSid(e.target.value) }, allStaff.filter(s => s.status !== "Đã nghỉ").map(s => rkh("option", { key: s.id, value: s.id }, `${s.code || "—"} · ${s.name}`)))),
    rkh("div", { className: "hr-form" },
      rkh(Field, { label: "Từ ngày" }, rkh("input", { className: "mes-input", type: "date", value: from, onChange: e => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); } })),
      rkh(Field, { label: "Đến ngày" }, rkh("input", { className: "mes-input", type: "date", value: to, min: from, onChange: e => setTo(e.target.value) }))),
    rkh("label", { style: { display: "flex", gap: 8, alignItems: "center", fontSize: FZ(13), marginBottom: 12 } }, rkh("input", { type: "checkbox", checked: skipSun, onChange: e => setSkipSun(e.target.checked) }), "Bỏ qua Chủ nhật"),
    rkh(Field, { label: "Ca / nghỉ" }, rkh("select", { className: "mes-input", value: shift, onChange: e => setShift(e.target.value) }, Object.keys(AMG_SC_TYPES).map(k => rkh("option", { key: k, value: k }, AMG_SC_TYPES[k].label)))),
    work && rkh("div", { className: "hr-form" },
      rkh(Field, { label: "Giờ bắt đầu (tùy chọn)" }, rkh("input", { className: "mes-input", type: "time", value: start, onChange: e => setStart(e.target.value) })),
      rkh(Field, { label: "Giờ kết thúc (tùy chọn)" }, rkh("input", { className: "mes-input", type: "time", value: end, onChange: e => setEnd(e.target.value) }))),
    work && rkh("div", { style: { fontSize: FZ(12), color: COLORS.textFaint, margin: "-6px 0 8px" } }, `Để trống = giờ ca mặc định (${h0.from} – ${h0.to})`),
    rkh(Field, { label: "Ghi chú" }, rkh("input", { className: "mes-input", maxLength: 200, value: note, onChange: e => setNote(e.target.value) })),
    rkh("div", { className: "at-banner", role: "status" }, `${targets.length} người × ${dates.length} ngày = ${targets.length * dates.length} lượt` + (overwrite ? ` · ${overwrite} lượt đã có lịch sẽ bị thay` : "")),
    err && rkh("div", { className: "hr-err", role: "alert" }, err),
    rkh(Button, { variant: "primary", onClick: submit, style: { width: "100%", justifyContent: "center", marginTop: 6 } }, "Xem lại và lưu"));
}

/* ---------- Đổi ca giữa hai người trong một ngày ---------- */
function ScSwapModal({ pool, defaultDate, days, onClose, onSubmit }) {
  const [date, setDate] = useState(defaultDate); const [a, setA] = useState(""); const [b, setB] = useState(""); const [err, setErr] = useState("");
  const opts = pool.filter(s => amgScEntry(days, date, s.id));
  const submit = () => {
    if (!a || !b) return setErr("Chọn đủ hai nhân viên");
    if (a === b) return setErr("Hai nhân viên phải khác nhau");
    onSubmit({ date, a: pool.find(s => s.id === a), b: pool.find(s => s.id === b) }).then(() => onClose()).catch(e => setErr(e && e.message || "Không lưu được"));
  };
  const sel = (v, set, label) => rkh(Field, { label }, rkh("select", { className: "mes-input", value: v, onChange: e => set(e.target.value) }, rkh("option", { value: "" }, "— Chọn —"), opts.map(s => { const e = amgScEntry(days, date, s.id); return rkh("option", { key: s.id, value: s.id }, `${s.name} (${s.code || "—"}) · ${AMG_SC_TYPES[e.shift].label}`); })));
  return rkh(Modal, { title: "Đổi ca giữa hai nhân viên", onClose, width: 460 },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, "Chỉ chọn được những người đã có ca/nghỉ trong ngày này. Hai mục lịch sẽ được hoán đổi cho nhau."),
    rkh(Field, { label: "Ngày" }, rkh("input", { className: "mes-input", type: "date", value: date, onChange: e => { setDate(e.target.value); setA(""); setB(""); } })),
    sel(a, setA, "Nhân viên thứ nhất"), sel(b, setB, "Nhân viên thứ hai"),
    opts.length < 2 && rkh("div", { className: "hr-sub", style: { whiteSpace: "normal" } }, "Ngày này chưa có đủ hai người được xếp lịch trong danh sách đang lọc."),
    err && rkh("div", { className: "hr-err", role: "alert" }, err),
    rkh(Button, { variant: "primary", onClick: submit, style: { width: "100%", justifyContent: "center", marginTop: 8 } }, "Xem lại và đổi ca"));
}

/* ---------- Cài đặt giờ ca và nhân lực tối thiểu ---------- */
function ScSettingsModal({ settings, onClose, onSave }) {
  const def = amgScDefaults();
  const [v, setV] = useState({ ngayFrom: amgScHours(settings, "ngay").from, ngayTo: amgScHours(settings, "ngay").to, demFrom: amgScHours(settings, "dem").from, demTo: amgScHours(settings, "dem").to, min: settings && settings.minPerGroup ? String(settings.minPerGroup) : "" });
  const [err, setErr] = useState("");
  const set = (k, x) => setV(p => Object.assign({}, p, { [k]: x }));
  const submit = () => {
    if (v.min && (!/^\d+$/.test(v.min) || Number(v.min) > 500)) return setErr("Nhân lực tối thiểu phải là số nguyên từ 1 đến 500 (hoặc để trống để tắt cảnh báo thiếu nhân lực)");
    onSave({ ngay: { from: v.ngayFrom, to: v.ngayTo }, dem: { from: v.demFrom, to: v.demTo }, minPerGroup: v.min ? Number(v.min) : null }).then(() => onClose()).catch(e => setErr(e && e.message || "Không lưu được"));
  };
  const t = (k, label) => rkh(Field, { label }, rkh("input", { className: "mes-input", type: "time", value: v[k], onChange: e => set(k, e.target.value) }));
  return rkh(Modal, { title: "Cài đặt lịch làm việc", onClose, width: 480 },
    rkh("div", { style: { fontSize: FZ(13), color: COLORS.textDim, marginBottom: 10 } }, `Giờ ca mặc định dùng khi mục lịch không ghi giờ riêng. Giá trị ban đầu lấy theo cấu hình hiện có (${def.ngay.from}–${def.ngay.to}).`),
    rkh("div", { className: "hr-form" }, t("ngayFrom", "Ca ngày — bắt đầu"), t("ngayTo", "Ca ngày — kết thúc"), t("demFrom", "Ca đêm — bắt đầu"), t("demTo", "Ca đêm — kết thúc")),
    rkh(Field, { label: "Nhân lực tối thiểu mỗi tổ mỗi ca (để trống = tắt cảnh báo thiếu nhân lực)" }, rkh("input", { className: "mes-input", inputMode: "numeric", value: v.min, onChange: e => set("min", e.target.value) })),
    err && rkh("div", { className: "hr-err", role: "alert" }, err),
    rkh(Button, { variant: "primary", onClick: submit, style: { width: "100%", justifyContent: "center" } }, "Lưu cài đặt"));
}

/* ---------- Cảnh báo ---------- */
function ScAlertPanel({ alerts, canEdit, onConfirm, onNotify, onJump }) {
  const defs = [
    ["unassigned", "Nhân viên chưa được xếp ca", COLORS.amber], ["conflict", "Lịch trùng / mâu thuẫn với điểm danh hoặc tăng ca", COLORS.red], ["short", "Thiếu nhân lực theo lịch", COLORS.red],
    ["unconfirmed", "Lịch chưa được xác nhận", COLORS.amber], ["unnotified", "Thay đổi lịch chưa được thông báo", COLORS.orange], ["otPending", "Lịch tăng ca chưa được duyệt", COLORS.blue]];
  const on = defs.filter(d => alerts[d[0]].length);
  if (!on.length) return rkh("div", { className: "at-banner", role: "status" }, "Không có cảnh báo lịch làm việc trong kỳ đang xem (cảnh báo chỉ tính khi đủ dữ liệu).");
  return rkh("div", { className: "mes-no-print" }, on.map(([k, title, color]) => rkh("details", { key: k, className: "sc-alert", style: { "--sc-c": color } },
    rkh("summary", null, `${title}: ${alerts[k].length}`),
    rkh("ul", null, alerts[k].slice(0, 8).map((it, i) => rkh("li", { key: i }, rkh("button", { type: "button", className: "hr-chip", onClick: () => onJump(it.date) }, amgFmtDate(it.date)), ` ${it.s.name}${it.s.code ? " (" + it.s.code + ")" : ""} — ${it.note}`)), alerts[k].length > 8 && rkh("li", null, `… và ${alerts[k].length - 8} mục nữa`)),
    canEdit && k === "unconfirmed" && rkh(Button, { onClick: onConfirm, style: { marginTop: 8 } }, "Xác nhận các lịch này"),
    canEdit && k === "unnotified" && rkh(Button, { onClick: onNotify, style: { marginTop: 8 } }, "Đánh dấu đã thông báo"))));
}

/* ---------- Màn hình Lịch làm việc ---------- */
function HrSchedule({ staff, attendance, extra, sched, currentUser, onMutate }) {
  const { askConfirm, showAlert } = useDialog();
  const days = sched.days, settings = sched.settings;
  const canEdit = useMemo(() => typeof amgCheckWrite === "function" && !!currentUser && amgCheckWrite(currentUser, FS.schedule, "set", "x", {}).ok, [currentUser]);
  const [view, setView] = useState("week");
  const [date, setDate] = useState(amgTodayKey());
  const [team, setTeam] = useState("all"); const [position, setPosition] = useState("all"); const [shiftF, setShiftF] = useState("all"); const [person, setPerson] = useState("all"); const [q, setQ] = useState("");
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(50);
  const [modal, setModal] = useState(null);
  const [boxRef, boxW] = useBoxWidth();
  const today = amgTodayKey();
  const who = (currentUser && (currentUser.fullName || currentUser.username)) || "";
  const range = view === "day" ? [date, date] : view === "week" ? amgAtWeek(date) : (() => { const g = amgScMonthGrid(date); return [g.first, g.last]; })();
  const [from, to] = range;
  const basePool = useMemo(() => amgScPool(staff, { team, position, q }), [staff, team, position, q]);
  const pool = useMemo(() => person === "all" ? basePool : basePool.filter(s => s.id === person), [basePool, person]);
  const ot = useMemo(() => amgScOtMap(extra.overtime || [], from, to), [extra, from, to]);
  const shown = useMemo(() => shiftF === "all" ? pool : pool.filter(s => { if (view !== "day") return true; const e = amgScEntry(days, date, s.id); return shiftF === "none" ? !e : shiftF === "off" ? !!e && !AMG_SC_TYPES[e.shift].work : !!e && e.shift === shiftF; }), [pool, shiftF, days, date, view]);
  const alerts = useMemo(() => amgScAlerts({ pool, days, attendance, overtime: extra.overtime || [], settings, from, to }), [pool, days, attendance, extra, settings, from, to]);
  useEffect(() => { setPage(1); }, [view, date, team, position, shiftF, person, q, pageSize]);
  const wide = amgIsWide(boxW) || (boxW || 0) >= 760;
  const step = n => setDate(view === "day" ? amgHrAddDays(date, n) : view === "week" ? amgHrAddDays(date, 7 * n) : (() => { const d = new Date(date + "T00:00:00"); d.setDate(1); d.setMonth(d.getMonth() + n); return amgTodayKey(d); })());
  const periodText = view === "day" ? amgFmtDate(date) : view === "week" ? `${amgFmtDate(from)} → ${amgFmtDate(to)}` : `Tháng ${Number(date.slice(5, 7))}/${date.slice(0, 4)}`;
  const run = async (fn) => { try { await fn(); } catch (e) { await showAlert((e && e.message) || "Không lưu được lịch làm việc. Vui lòng thử lại."); throw e; } };
  const mutateDay = (d, fn, summary) => onMutate(d, fn, summary);
  const saveOne = (s, d, patch) => run(() => mutateDay(d, cur => { cur[s.id] = amgScMake(cur[s.id], patch, who, new Date().toISOString()); return cur; }, `Lịch làm việc ${s.name} (${s.code || s.id}): ${AMG_SC_TYPES[patch.shift].label}`));
  const deleteOne = async (s, d) => { if (!(await askConfirm(`Xóa lịch của ${s.name} ngày ${amgFmtDate(d)}?`, { danger: true, confirmLabel: "Xóa lịch" }))) throw new Error("Đã hủy"); await run(() => mutateDay(d, cur => { delete cur[s.id]; return cur; }, `Xóa lịch làm việc ${s.name} (${s.code || s.id})`)); };
  const saveOneConfirmed = async (s, d, entry, patch) => {
    const changes = entry && (entry.shift !== patch.shift || (entry.start || "") !== (patch.start || "") || (entry.end || "") !== (patch.end || ""));
    if (changes && entry.confirmed && !(await askConfirm(`Lịch này đã được xác nhận. Đổi sang “${AMG_SC_TYPES[patch.shift].label}” sẽ đánh dấu là thay đổi chưa thông báo.\nTiếp tục lưu?`, { confirmLabel: "Lưu thay đổi" }))) throw new Error("Đã hủy");
    await saveOne(s, d, patch);
  };
  const assign = async ({ targets, dates, shift, start, end, note, overwrite }) => {
    const msg = `Phân công “${AMG_SC_TYPES[shift].label}” cho ${targets.length} người, ${dates.length} ngày (${amgFmtDate(dates[0])}${dates.length > 1 ? " → " + amgFmtDate(dates[dates.length - 1]) : ""}).` + (overwrite ? `\n${overwrite} lượt đã có lịch sẽ bị thay (lịch đã xác nhận sẽ thành “đã đổi, chưa thông báo”).` : "") + "\nLịch mới ở trạng thái chưa xác nhận. Tiếp tục?";
    if (!(await askConfirm(msg, { confirmLabel: "Lưu lịch" }))) throw new Error("Đã hủy");
    const now = new Date().toISOString();
    await run(async () => { for (const d of dates) await mutateDay(d, cur => { targets.forEach(s => { cur[s.id] = amgScMake(cur[s.id], { shift, start, end, note }, who, now); }); return cur; }, `Phân công ${AMG_SC_TYPES[shift].label}: ${targets.length} người`); });
  };
  const swap = async ({ date: d, a, b }) => {
    const ea = amgScEntry(days, d, a.id), eb = amgScEntry(days, d, b.id);
    if (!ea || !eb) throw new Error("Cả hai nhân viên phải có lịch trong ngày này");
    if (!(await askConfirm(`Đổi ca ngày ${amgFmtDate(d)}:\n• ${a.name}: ${AMG_SC_TYPES[ea.shift].label} → ${AMG_SC_TYPES[eb.shift].label}\n• ${b.name}: ${AMG_SC_TYPES[eb.shift].label} → ${AMG_SC_TYPES[ea.shift].label}\nTiếp tục?`, { confirmLabel: "Đổi ca" }))) throw new Error("Đã hủy");
    const now = new Date().toISOString(); const pick = e => ({ shift: e.shift, start: e.start, end: e.end, note: e.note });
    await run(() => mutateDay(d, cur => { const x = cur[a.id], y = cur[b.id]; if (!x || !y) throw new Error("Lịch vừa được người khác thay đổi, hãy thử lại"); cur[a.id] = amgScMake(x, pick(y), who, now); cur[b.id] = amgScMake(y, pick(x), who, now); return cur; }, `Đổi ca ${a.name} ↔ ${b.name}`));
  };
  const copyPrev = async () => {
    const [mon] = amgAtWeek(date); const dates = amgAtDays(mon, amgHrAddDays(mon, 6)); let add = 0, skip = 0, none = 0;
    dates.forEach(d => { const src = amgHrAddDays(d, -7); pool.forEach(s => { const e = amgScEntry(days, src, s.id); if (!e) none++; else if (amgScEntry(days, d, s.id)) skip++; else add++; }); });
    if (!add) { await showAlert(skip ? "Không có gì để sao chép: tuần này đã có lịch cho mọi người có lịch tuần trước." : "Tuần trước chưa có lịch cho nhân viên đang lọc nên không có gì để sao chép."); return; }
    if (!(await askConfirm(`Sao chép lịch tuần ${amgFmtDate(amgHrAddDays(mon, -7))} → tuần ${amgFmtDate(mon)} cho ${pool.length} người đang lọc.\n• Thêm mới: ${add} lượt\n• Giữ nguyên (đã có lịch): ${skip} lượt\nLịch sao chép ở trạng thái chưa xác nhận. Tiếp tục?`, { confirmLabel: "Sao chép" }))) return;
    const now = new Date().toISOString();
    try { await run(async () => { for (const d of dates) { const src = amgHrAddDays(d, -7); const todo = pool.filter(s => amgScEntry(days, src, s.id) && !amgScEntry(days, d, s.id)); if (!todo.length) continue; await mutateDay(d, cur => { todo.forEach(s => { if (cur[s.id]) return; const e = amgScEntry(days, src, s.id); cur[s.id] = amgScClean({ shift: e.shift, start: e.start, end: e.end, note: e.note, confirmed: false, by: who, at: now }); }); return cur; }, `Sao chép lịch tuần trước: ${todo.length} người`); } }); } catch (e) { /* đã báo */ }
  };
  const bulkFlag = async (items, patch, text, label) => {
    const byDate = {}; items.forEach(it => { (byDate[it.date] = byDate[it.date] || []).push(it.s.id); });
    if (!(await askConfirm(`${text} (${items.length} mục)?`, { confirmLabel: label }))) return;
    try { await run(async () => { for (const d of Object.keys(byDate)) await mutateDay(d, cur => { byDate[d].forEach(id => { if (cur[id]) cur[id] = amgScClean(Object.assign({}, cur[id], patch)); }); return cur; }, `${label}: ${byDate[d].length} người`); }); } catch (e) { /* đã báo */ }
  };
  const saveSettings = v => run(() => onMutate("_settings", () => amgScClean({ ngay: v.ngay, dem: v.dem, minPerGroup: v.minPerGroup }), "Cài đặt lịch làm việc"));
  const openCell = (s, d) => setModal({ type: "detail", s, d });
  const sel = (v, set, all, opts, label) => rkh("select", { className: "mes-input", "aria-label": label, value: v, onChange: e => set(e.target.value) }, rkh("option", { value: "all" }, all), opts.map(o => rkh("option", { key: o[0], value: o[0] }, o[1])));
  const teams = amgHrTeamOptions(staff).filter(t => staff.some(s => s.team === t)).map(t => [t, "Tổ " + t]);
  const positions = amgHrUnique(staff, "position").map(p => [p, p]);
  const exportXlsx = () => {
    const rows = []; amgAtDays(from, to).forEach(d => pool.forEach(s => { const e = amgScEntry(days, d, s.id); if (e) rows.push({ d, s, e }); }));
    const cols = [["Ngày", r => amgFmtDate(r.d)], ["Mã NV", r => r.s.code || ""], ["Họ và tên", r => r.s.name], ["Phòng ban / Tổ", r => r.s.team || ""], ["Bộ phận / chức vụ", r => r.s.position || ""], ["Ca làm", r => AMG_SC_TYPES[r.e.shift].label], ["Giờ bắt đầu", r => (amgScShow(r.e, settings) || {}).start || ""], ["Giờ kết thúc", r => (amgScShow(r.e, settings) || {}).end || ""], ["Trạng thái lịch", r => amgScStatusOf(r.e)], ["Đổi ca", r => r.e.swapFrom ? "Từ " + AMG_SC_TYPES[r.e.swapFrom].label : ""], ["Ghi chú", r => r.e.note || ""]];
    amgExportExcel(`lich-lam-viec-${view}-${from}`, cols.map(c => ({ label: c[0], export: c[1] })), rows, "Lịch làm việc");
  };
  const pg = amgPaginate(shown, page, pageSize);
  const hasData = amgScDayKeys(days).length > 0;

  /* --- chế độ ngày --- */
  const dayView = () => {
    const rows = pg.items;
    const cnt = { ngay: 0, dem: 0, off: 0, none: 0 }; pool.forEach(s => { const e = amgScEntry(days, date, s.id); if (!e) cnt.none++; else if (e.shift === "ngay") cnt.ngay++; else if (e.shift === "dem") cnt.dem++; else cnt.off++; });
    const tiles = [["Ca ngày", cnt.ngay, AMG_SC_TYPES.ngay.color, "ngay"], ["Ca đêm", cnt.dem, AMG_SC_TYPES.dem.color, "dem"], ["Nghỉ (phép / lễ)", cnt.off, AMG_SC_TYPES.nghi_phep.color, "off"], ["Chưa xếp ca", cnt.none, COLORS.amber, "none"]];
    return rkh("div", null,
      rkh("div", { className: "hr-kpis" }, tiles.map(t => rkh(StatCard, { key: t[0], icon: CalendarDays, label: t[0], value: t[1], accent: t[2], onClick: () => setShiftF(f => f === t[3] ? "all" : t[3]), title: "Nhấn để lọc" }))),
      rows.length === 0 ? rkh(EmptyState, { icon: CalendarDays, title: "Không có nhân viên phù hợp", hint: "Thử đổi bộ lọc." }) :
      wide ? rkh("div", { className: "mes-card", style: { overflow: "hidden" } }, rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "mes-table" },
        rkh("thead", null, rkh("tr", null, ["STT", "Nhân viên", "Phòng ban / Tổ", "Bộ phận", "Ca làm", "Bắt đầu", "Kết thúc", "Trạng thái lịch", "Ghi chú"].map(h => rkh("th", { key: h }, h)))),
        rkh("tbody", null, rows.map((s, i) => { const e = amgScEntry(days, date, s.id); const sh = amgScShow(e, settings); const o = ot[date + "|" + s.id]; return rkh("tr", { key: s.id, onClick: () => openCell(s, date), style: { cursor: "pointer" } },
          rkh("td", null, pg.from + i + 1), rkh("td", { style: { minWidth: 160 } }, rkh("div", { style: { fontWeight: 600 } }, s.name), rkh("div", { className: "hr-sub" }, s.code || "—")),
          rkh("td", null, s.team ? "Tổ " + s.team : "—"), rkh("td", null, s.position || "—"),
          rkh("td", null, rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, rkh(ScBadge, { type: e && e.shift }), e && e.swapFrom && rkh(Badge, { color: AMG_SC_SWAP_COLOR }, "Đổi ca"), o && rkh(Badge, { color: AMG_SC_OT_COLOR }, "Tăng ca" + (o.some(x => x.status === "cho_duyet") ? " (chờ duyệt)" : "")))),
          rkh("td", null, sh && sh.meta.work ? sh.start : "—"), rkh("td", null, sh && sh.meta.work ? sh.end : "—"), rkh("td", null, amgScStatusOf(e)), rkh("td", { style: { maxWidth: 220 } }, rkh(Clamp, { text: e && e.note, lines: 2 }))); }))))) :
      rkh("div", { style: { display: "grid", gap: 10 } }, rows.map(s => { const e = amgScEntry(days, date, s.id); const sh = amgScShow(e, settings); const o = ot[date + "|" + s.id]; return rkh("button", { key: s.id, type: "button", className: "at-card", onClick: () => openCell(s, date), style: { textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" } },
        rkh("div", { className: "hr-name" }, s.name), rkh("div", { className: "hr-sub" }, `${s.code || "—"} · ${s.team ? "Tổ " + s.team : "—"}${s.position ? " · " + s.position : ""}`),
        rkh("div", { style: { display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" } }, rkh(ScBadge, { type: e && e.shift }), sh && sh.meta.work && rkh("span", { className: "hr-sub" }, `${sh.start}–${sh.end}`), e && e.swapFrom && rkh(Badge, { color: AMG_SC_SWAP_COLOR }, "Đổi ca"), o && rkh(Badge, { color: AMG_SC_OT_COLOR }, "Tăng ca")),
        rkh("div", { className: "hr-sub" }, amgScStatusOf(e) + (e && e.note ? " · " + e.note : ""))); })),
      rows.length > 0 && rkh(Pager, { total: shown.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }));
  };
  /* --- chế độ tuần --- */
  const weekView = () => {
    const wd = amgAtDays(from, to);
    return rkh("div", null,
      shown.length === 0 ? rkh(EmptyState, { icon: CalendarDays, title: "Không có nhân viên phù hợp", hint: "Thử đổi bộ lọc." }) :
      rkh("div", { className: "mes-card", style: { overflow: "hidden" } }, rkh("div", { className: "mes-scroll-x" }, rkh("table", { className: "sc-week" },
        rkh("thead", null, rkh("tr", null, rkh("th", null, "Nhân viên"), wd.map((d, i) => rkh("th", { key: d, className: d === today ? "sc-today" : undefined }, rkh("div", null, AMG_SC_DAYNAMES[i]), rkh("div", { className: "hr-sub" }, d.slice(8) + "/" + d.slice(5, 7)))))),
        rkh("tbody", null, pg.items.map(s => rkh("tr", { key: s.id },
          rkh("td", null, rkh("div", { className: "hr-name", style: { maxWidth: 170 } }, s.name), rkh("div", { className: "hr-sub" }, `${s.code || "—"}${s.team ? " · Tổ " + s.team : ""}${s.position ? " · " + s.position : ""}`)),
          wd.map(d => rkh("td", { key: d, className: d === today ? "sc-today" : undefined }, rkh(ScCell, { e: amgScEntry(days, d, s.id), settings, ot: ot[d + "|" + s.id], onClick: () => openCell(s, d), label: `${s.name}, ${amgFmtDate(d)}: ${(amgScEntry(days, d, s.id) ? AMG_SC_TYPES[amgScEntry(days, d, s.id).shift].label : "chưa xếp ca")}` }))))))))),
      shown.length > 0 && rkh(Pager, { total: shown.length, page: pg.page, pageSize, onPage: setPage, onSize: setPageSize }));
  };
  /* --- chế độ tháng --- */
  const monthView = () => {
    const g = amgScMonthGrid(date); const one = person !== "all" && pool[0];
    return rkh("div", { className: "sc-month", role: "grid", "aria-label": "Lịch tháng" },
      AMG_SC_DAYNAMES.map(n => rkh("div", { key: n, className: "sc-mh", role: "columnheader" }, n)),
      g.cells.map(d => {
        const inM = d >= g.first && d <= g.last; const c = { ngay: 0, dem: 0, off: 0, none: 0 }; const plan = amgScDayHasPlan(days, d);
        let mine = null; if (one) mine = amgScEntry(days, d, pool[0].id);
        else pool.forEach(s => { const e = amgScEntry(days, d, s.id); if (e) { if (e.shift === "ngay") c.ngay++; else if (e.shift === "dem") c.dem++; else c.off++; } else if (plan) c.none++; });
        const tc = Object.keys(ot).filter(k => k.slice(0, 10) === d).length;
        return rkh("button", { key: d, type: "button", className: "sc-day", "data-out": inM ? "0" : "1", "data-today": d === today ? "1" : "0", role: "gridcell", "aria-label": `${amgFmtDate(d)}`, onClick: () => { setDate(d); setView("day"); } },
          rkh("b", null, Number(d.slice(8))),
          one ? rkh("div", { className: "sc-cnt", style: { color: mine ? AMG_SC_TYPES[mine.shift].color : COLORS.textFaint } }, mine ? AMG_SC_TYPES[mine.shift].short : "—") :
          plan ? rkh("div", null, rkh("div", { className: "sc-cnt", style: { color: AMG_SC_TYPES.ngay.color } }, "Ngày " + c.ngay), rkh("div", { className: "sc-cnt", style: { color: AMG_SC_TYPES.dem.color } }, "Đêm " + c.dem), (c.off > 0 || c.none > 0) && rkh("div", { className: "sc-cnt", style: { color: COLORS.textDim } }, (c.off ? "Nghỉ " + c.off : "") + (c.none ? (c.off ? " · " : "") + "Thiếu " + c.none : ""))) : rkh("div", { className: "sc-cnt", style: { color: COLORS.textFaint } }, "—"),
          tc > 0 && rkh("div", { className: "sc-cnt", style: { color: AMG_SC_OT_COLOR } }, "TC " + tc));
      }));
  };

  const m = modal;
  const personOpts = basePool.map(s => [s.id, `${s.name}${s.code ? " (" + s.code + ")" : ""}`]);
  return rkh("div", { ref: boxRef },
    rkh("div", { className: "hr-bar mes-no-print" },
      rkh("div", { className: "at-seg", role: "group", "aria-label": "Chế độ xem lịch" }, [["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]].map(v => rkh("button", { key: v[0], type: "button", "aria-pressed": view === v[0], onClick: () => setView(v[0]) }, v[1]))),
      rkh(Button, { onClick: () => step(-1), "aria-label": "Kỳ trước" }, "‹"),
      rkh("input", { className: "mes-input", type: "date", "aria-label": "Ngày", value: date, onChange: e => e.target.value && setDate(e.target.value) }),
      rkh(Button, { onClick: () => step(1), "aria-label": "Kỳ sau" }, "›"),
      rkh(Button, { onClick: () => setDate(today) }, "Hôm nay"),
      rkh("strong", { style: { fontSize: FZ(14) } }, periodText)),
    rkh("div", { className: "hr-bar mes-no-print" },
      sel(team, setTeam, "Tất cả phòng ban / tổ", teams, "Phòng ban / tổ"), sel(position, setPosition, "Tất cả bộ phận", positions, "Bộ phận"),
      view === "day" && rkh("select", { className: "mes-input", "aria-label": "Ca làm", value: shiftF, onChange: e => setShiftF(e.target.value) }, rkh("option", { value: "all" }, "Tất cả ca"), Object.keys(AMG_SC_TYPES).map(k => rkh("option", { key: k, value: k }, AMG_SC_TYPES[k].label)), rkh("option", { value: "off" }, "Nghỉ (phép / lễ)"), rkh("option", { value: "none" }, "Chưa xếp ca")),
      sel(person, setPerson, "Tất cả nhân viên", personOpts, "Xem lịch từng người"),
      rkh("div", { className: "hr-search" }, rkh(Search, { size: 14 }), rkh("input", { className: "mes-input", placeholder: "Tìm theo mã hoặc tên...", "aria-label": "Tìm nhân viên", value: q, onChange: e => setQ(e.target.value) }))),
    canEdit ? rkh("div", { className: "hr-bar mes-no-print" },
      rkh(Button, { variant: "primary", onClick: () => setModal({ type: "assign" }) }, rkh(Plus, { size: 14 }), " Phân công ca"),
      rkh(Button, { onClick: () => setModal({ type: "swap" }) }, "Đổi ca"),
      rkh(Button, { onClick: copyPrev }, "Sao chép lịch tuần trước"),
      rkh(Button, { onClick: () => setModal({ type: "settings" }) }, "Cài đặt giờ ca"),
      rkh(Button, { onClick: exportXlsx }, rkh(Download, { size: 14 }), " Xuất Excel")) :
      rkh("div", { className: "hr-bar mes-no-print" }, rkh("div", { className: "at-banner", style: { margin: 0, flex: 1 }, role: "status" }, "Tài khoản của bạn chỉ có quyền xem lịch làm việc."), rkh(Button, { onClick: exportXlsx }, rkh(Download, { size: 14 }), " Xuất Excel")),
    !sched.ready && rkh("div", { className: "at-banner", role: "status" }, "Đang tải lịch làm việc…"),
    sched.ready && !hasData && rkh("div", { className: "at-banner", role: "status" }, "Chưa có lịch làm việc nào được lập." + (canEdit ? " Bấm “Phân công ca” để bắt đầu." : "")),
    rkh(ScLegend, null),
    rkh(ScAlertPanel, { alerts, canEdit, onJump: d => { setDate(d); setView("day"); }, onConfirm: () => bulkFlag(alerts.unconfirmed, { confirmed: true }, "Xác nhận lịch làm việc", "Xác nhận lịch"), onNotify: () => bulkFlag(alerts.unnotified, { notified: true }, "Đánh dấu đã thông báo các thay đổi lịch", "Đánh dấu đã thông báo") }),
    view === "day" ? dayView() : view === "week" ? weekView() : monthView(),
    m && m.type === "detail" && rkh(ScDetailModal, { s: m.s, date: m.d, entry: amgScEntry(days, m.d, m.s.id), settings, ot: ot[m.d + "|" + m.s.id], attendanceFlags: ((attendance || {})[m.d] || {})[m.s.id], canEdit, onClose: () => setModal(null),
      onSave: patch => saveOneConfirmed(m.s, m.d, amgScEntry(days, m.d, m.s.id), patch), onDelete: () => deleteOne(m.s, m.d), onViewPerson: id => { setPerson(id); setView("week"); setDate(m.d); } }),
    m && m.type === "assign" && rkh(ScAssignModal, { pool, allStaff: staff, defaultDate: date, settings, existing: (d, id) => !!amgScEntry(days, d, id), onClose: () => setModal(null), onSubmit: assign }),
    m && m.type === "swap" && rkh(ScSwapModal, { pool: basePool, defaultDate: date, days, onClose: () => setModal(null), onSubmit: swap }),
    m && m.type === "settings" && rkh(ScSettingsModal, { settings, onClose: () => setModal(null), onSave: saveSettings }));
}
