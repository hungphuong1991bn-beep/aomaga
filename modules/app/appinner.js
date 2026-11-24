/* ===================== ROOT APP ===================== */
function LoadingScreen() {
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-root",
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(GlobalStyle, null), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      color: COLORS.textDim
    }
  }, /*#__PURE__*/React.createElement(Loader2, {
    size: 26,
    className: "pulse-dot",
    style: {
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: FZ(13)
    }
  }, "Đang tải dữ liệu hệ thống...")));
}
function AppInner() {
  const data = useAppData();
  const {
    showAlert
  } = useDialog();
  const [currentUser, setCurrentUser] = useState(null);
  const extra = useExtraData(!!currentUser);
  const flow = useFlowData(!!currentUser); // v46: lệnh sản xuất (productionRuns) + lượt sản lượng (productionEntries)
  window.__AMG_USER = currentUser; // phiên hiện tại cho cổng ghi dữ liệu (core/guard.js)
  // Giao diện sáng/tối: màn hình đăng nhập luôn sáng; sau đăng nhập dùng lựa chọn đã lưu của người dùng.
  const [theme, setTheme] = useState(amgSavedTheme);
  amgApplyTheme(currentUser ? theme : "light");
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    amgSaveTheme(next);
    setTheme(next);
  }
  const [activeTab, setActiveTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const KIOSK_IDLE_MS = 5 * 60 * 1000; // 5 phút không thao tác -> vào chế độ trình chiếu
  const KIOSK_STEP_MS = 60 * 1000; // mỗi mục hiển thị 60 giây
  const KIOSK_TABS = ["dashboard", "orders", "machines", "qc", "reports", "staff"];
  const kioskPrevTab = React.useRef("dashboard");
  const kioskStepIndex = React.useRef(0);
  const activeTabRef = React.useRef(activeTab);
  const scrollRef = React.useRef(null);
  useEffect(() => {
    activeTabRef.current = activeTab;
    // Đổi tab: vùng nội dung về đầu trang (Sidebar giữ nguyên vị trí cuộn của nó)
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);
  const kioskModeRef = React.useRef(false);
  useEffect(() => {
    kioskModeRef.current = kioskMode;
  }, [kioskMode]);
  useEffect(() => {
    if (!currentUser) return;
    let idleTimer = null;
    const resetIdleTimer = () => {
      if (kioskModeRef.current) {
        // Có người thao tác trong lúc đang trình chiếu -> thoát ngay, quay lại trang trước đó
        setKioskMode(false);
        setActiveTab(kioskPrevTab.current);
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        kioskPrevTab.current = activeTabRef.current;
        kioskStepIndex.current = 0;
        setKioskMode(true);
        setActiveTab(KIOSK_TABS[0]);
      }, KIOSK_IDLE_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach(ev => window.addEventListener(ev, resetIdleTimer, {
      passive: true
    }));
    resetIdleTimer();
    return () => {
      clearTimeout(idleTimer);
      events.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [currentUser]); // eslint-disable-line
  useEffect(() => {
    if (!kioskMode) return;
    const t = setInterval(() => {
      kioskStepIndex.current = (kioskStepIndex.current + 1) % KIOSK_TABS.length;
      setActiveTab(KIOSK_TABS[kioskStepIndex.current]);
    }, KIOSK_STEP_MS);
    return () => clearInterval(t);
  }, [kioskMode]); // eslint-disable-line
  useEffect(() => {
    if (!data.ready || !currentUser) return;
    const t = setInterval(() => {
      data.refreshAll();
    }, 20000);
    return () => clearInterval(t);
  }, [data.ready, currentUser]); // eslint-disable-line

  if (!data.ready) return /*#__PURE__*/React.createElement(LoadingScreen, null);
  if (!currentUser) return /*#__PURE__*/React.createElement(LoginScreen, {
    users: data.users,
    onLogin: setCurrentUser,
    storageError: data.storageError
  });
  // v46: 3 vai trò. isRoot = Admin (lập tài khoản, phân quyền). isAdmin giữ tên cũ nhưng nay = Admin HOẶC Quản đốc
  // (toàn quyền sử dụng, trừ tài khoản/phân quyền) để mọi trang cũ nhận đúng quyền mà không phải sửa từng nơi.
  const isRoot = amgIsRoot(currentUser);
  const isAdmin = amgIsPower(currentUser);
  // Nhân viên được XEM và NHẬP (thêm/sửa) ở Nhân sự & Máy móc thiết bị,
  // nhưng KHÔNG được xoá hoặc nhập hàng loạt — các quyền đó vẫn dành riêng cho Quản trị viên.
  const canEditStaffMachines = isAdmin;                       // sửa Nhân sự: Admin, Quản đốc
  const canEditMachines = amgCan(currentUser, "s", "may");     // cập nhật trạng thái máy: cả Nhân viên
  // Alias dùng trong các handler bên dưới (đơn hàng luôn lấy từ dữ liệu mới nhất qua onSnapshot)
  const baseOrders = data.orders;
  // v48: MỘT nguồn dữ liệu đơn (data.orders, onSnapshot). Danh sách "đang hoạt động" chỉ là bộ lọc status — không xóa/nhân bản đơn.
  const activeOrders = baseOrders.filter(amgIsActiveOrder);
  function audit(type, detail, targetId, extra) {
    const id = uid("AL");
    db.collection(FS.audit).doc(id).set({
      id,
      type,
      detail,
      targetId,
      user: currentUser?.fullName || "system",
      ts: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra
    }).catch(() => {});
  }
  async function handleQuickEntry({
    orderId,
    stageKey,
    qty,
    note,
    wireType
  }) {
    // v46: ghi bằng giao dịch trên ĐÚNG MỘT đơn (trước đây ghi đè cả danh sách đơn từ dữ liệu đang hiện trên màn hình,
    // có thể xóa mất sản lượng người khác vừa nhập). Công thức sản lượng/tiến độ giữ nguyên (normalizeOrderStages).
    const order = baseOrders.find(o => o.id === orderId);
    if (!order) return;
    const isSoftFinish = stageKey === "keo_trung" && wireType === "Dây ủ mềm";
    let wireFinishPatch = null;
    if (!amgIsFlowOrder(order)) {
      if (isSoftFinish) wireFinishPatch = { wireFinish: "mềm" }; // Dây ủ mềm tại Kéo trung = thành phẩm luôn
      else if (stageKey === "keo_trung" && wireType === "Dây cứng" && !order.wireFinish) wireFinishPatch = { wireFinish: "cứng" };
    }
    await amgFlowAddStageQty({ orderId, stageKey, qty, wireFinishPatch });
    audit("production_entry", `Nhập ${fmtNum(qty)} cho công đoạn "${STAGE_MAP[stageKey].label}" — đơn ${order.customer} / ${order.spec}${note ? " · " + note : ""}${wireType ? " · " + wireType : ""}${isSoftFinish ? " (đã thành phẩm)" : ""}`, orderId, {
      stageKey,
      qty,
      materialCode: order.materialCode || "Khác",
      customer: order.customer,
      spec: order.spec,
      date: new Date().toISOString().slice(0, 10),
      wireType,
      note
    });
  }
  async function handleEditProductionEntry(entryId, newQty, newMaterialCode, newWireType, newDate) {
    const freshLog = data.auditLog;
    const entry = freshLog.find(e => e.id === entryId);
    if (!entry) return;
    if (entry.runId) { // lượt ghi từ thẻ máy: đồng bộ lệnh + đơn trong một giao dịch
      await amgFlowCorrectEntry({ entryId, newQty, mode: "edit" });
      return;
    }
    const delta = newQty - entry.qty;
    await amgSafeUpdate(FS.orders, entry.targetId, o => {
      const st = (o.stages && o.stages[entry.stageKey]) || { done: 0, remain: 0 };
      const newDone = Math.max(0, (st.done || 0) + delta);
      let updated = { ...o, stages: { ...o.stages, [entry.stageKey]: { ...st, done: newDone } } };
      if (entry.stageKey === "keo_trung" && newWireType === "Dây ủ mềm" && !amgIsFlowOrder(o)) updated.wireFinish = "mềm";
      updated = normalizeOrderStages(updated);
      return updated;
    });
    await db.collection(FS.audit).doc(entryId).set({
      qty: newQty,
      materialCode: newMaterialCode,
      wireType: newWireType,
      date: newDate,
      detail: entry.detail.replace(/^Nhập [\d.,]+/, `Nhập ${fmtNum(newQty)}`) + " (đã chỉnh sửa)"
    }, {
      merge: true
    });
    audit("production_entry_edit", `Chỉnh sửa lượt nhập: ${entry.customer} / ${entry.spec} — ${fmtNum(entry.qty)} → ${fmtNum(newQty)}`, entry.targetId);
  }
  async function handleDeleteProductionEntry(entryId) {
    const freshLog = data.auditLog;
    const entry = freshLog.find(e => e.id === entryId);
    if (!entry) return;
    if (entry.runId) {
      await amgFlowCorrectEntry({ entryId, mode: "void" });
      return;
    }
    await amgSafeUpdate(FS.orders, entry.targetId, o => {
      const st = (o.stages && o.stages[entry.stageKey]) || { done: 0, remain: 0 };
      const newDone = Math.max(0, (st.done || 0) - (entry.qty || 0));
      return normalizeOrderStages({ ...o, stages: { ...o.stages, [entry.stageKey]: { ...st, done: newDone } } });
    });
    // Lưu ý: persistAuditLog (_batch) chỉ set/merge, KHÔNG xoá — phải xoá doc trực tiếp
    await db.collection(FS.audit).doc(entryId).delete().catch(() => {});
    audit("production_entry_delete", `Xóa lượt nhập: ${entry.customer} / ${entry.spec} — ${fmtNum(entry.qty)} kg tại "${STAGE_MAP[entry.stageKey]?.label}"`, entry.targetId);
  }
  async function handleKeoTrungEntry({
    stageKey,
    qty,
    note,
    wireType,
    materialCode,
    diameter,
    customer,
    date
  }) {
    const entryDate = date || new Date().toISOString().slice(0, 10);
    let linkedOrderId = null;

    // Nếu là Dây ủ mềm + có tên khách hàng → tự động tìm đơn hàng khớp
    // (cùng khách hàng, cùng mã liệu, đã đánh dấu wireFinish="mềm") và cập nhật
    // stages.keo_trung.done + finishedDone để tiến độ đơn hàng phản ánh đúng.
    // Có tên khách hàng → sản lượng này là THÀNH PHẨM cho đơn hàng đó
    // (bất kể Dây cứng hay Dây ủ mềm) → đánh dấu wireFinish="mềm" để BOM chỉ còn Kéo trung
    // Không có tên khách hàng → Phôi cho công đoạn sau, không thay đổi BOM
    if (customer) {
      // onSnapshot keeps data.orders fresh
      const customerNorm = (customer || "").trim().toUpperCase();
      const matchOrders = baseOrders.filter(o => o.status !== "completed" && (!amgIsFlowOrder(o) || amgOrderRoute(o).includes("keo_trung")) && (o.customer || "").trim().toUpperCase() === customerNorm && (o.materialCode || "") === materialCode && specDiameterMatches(o.spec, diameter) && (o.stages?.keo_trung?.done || 0) < (o.quantity || 0));
      if (matchOrders.length > 0) {
        // Giữ nguyên thứ tự phân bổ cũ (theo danh sách đơn), nhưng ghi bằng giao dịch từng đơn thay vì ghi đè cả danh sách
        let remaining = qty;
        const allocations = [];
        baseOrders.forEach(o => {
          if (!matchOrders.some(m => m.id === o.id) || remaining <= 0) return;
          const st = o.stages?.keo_trung || { done: 0, remain: 0 };
          const addQty = Math.min(remaining, Math.max(0, (o.quantity || 0) - (st.done || 0)));
          if (addQty <= 0) return;
          remaining -= addQty;
          allocations.push({ id: o.id, addQty, wireFinish: o.wireFinish === "cứng" ? "cứng" : "mềm", flow: amgIsFlowOrder(o) });
        });
        for (const a of allocations) {
          await amgFlowAddStageQty({ orderId: a.id, stageKey: "keo_trung", qty: a.addQty, wireFinishPatch: a.flow ? null : { wireFinish: a.wireFinish } });
          if (!linkedOrderId) linkedOrderId = a.id;
        }
      }
    }
    const newEntry = {
      id: uid("AL"),
      ts: new Date().toISOString(),
      type: "production_entry",
      stageKey,
      qty,
      materialCode,
      wireType,
      diameter: diameter || "",
      note,
      date: entryDate,
      detail: `Kéo trung: ${fmtNum(qty)} kg — Mã ${materialCode} · ĐK ${diameter || '?'}mm · ${wireType}${customer ? ' · ' + customer : ''} · ${note}`,
      user: currentUser.fullName,
      targetId: linkedOrderId,
      spec: null,
      customer: customer || null
    };
    // Lưu ý: trước đây newEntry được tạo ra nhưng KHÔNG BAO GIỜ được lưu vào audit log
    // (chỉ ghi lại các bản ghi cũ đã có sẵn) — khiến "Lịch sử nhập Kéo trung" luôn hiện 0 lượt.
    await db.collection(FS.audit).doc(newEntry.id).set({
      ...newEntry,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  async function handleAddOrder(newOrder) {
    // v46: chỉ ghi đơn mới (trước đây ghi lại toàn bộ danh sách đơn)
    await data.persistOrders([newOrder]);
    audit("order_add", `Thêm đơn hàng mới: ${newOrder.customer} / ${newOrder.spec} (SL: ${fmtNum(newOrder.quantity)}) — quy trình: ${(amgOrderRoute(newOrder) || []).map(amgStageLabel).join(" → ")}`, newOrder.id);
  }
  // v46: cập nhật đơn bằng giao dịch trên đúng đơn đó; KHÔNG bao giờ ghi đè sản lượng/trạng thái hoàn thành từ dữ liệu cũ trên màn hình.
  // Muốn sửa tay sản lượng công đoạn (quản trị) truyền opts.overrideStages = true.
  async function handleUpdateOrder(updated, opts) {
    const o2 = opts || {};
    await amgSafeUpdate(FS.orders, updated.id, cur => {
      if (cur.status === "completed") throw new Error("Đơn đã hoàn thành — chỉ xem được. Mở lại đơn ở tab Đơn hàng hoàn thành (cần quyền quản lý) trước khi sửa đơn/BOM.");
      const merged = { ...cur };
      Object.keys(updated).forEach(k => { if (AMG_ORDER_PROTECTED.indexOf(k) < 0) merged[k] = updated[k]; });
      if (o2.overrideStages && updated.stages) merged.stages = updated.stages;
      return normalizeOrderStages(merged);
    });
    audit("order_update", `Chỉnh sửa đơn hàng: ${updated.customer} / ${updated.spec}${updated.routing ? " — quy trình: " + updated.routing.map(amgStageLabel).join(" → ") : ""}`, updated.id);
  }
  async function handleDeleteOrder(id) {
    // onSnapshot keeps data.orders fresh
    // Lưu ý: persistOrders (_batch) chỉ set/merge, KHÔNG xoá — phải xoá doc trực tiếp
    const o = baseOrders.find(x => x.id === id);
    if (o && o.status === "completed") throw new Error(`Đơn ${id} đã hoàn thành — không xóa để bảo toàn lưu trữ.`);
    // Không xóa đơn đã có lệnh máy: xóa đơn sẽ để lại lệnh mồ côi giữ khóa máy và làm mất lịch sử sản xuất
    const rr = amgRunsOfOrder(flow.runs, id);
    if (rr.length) throw new Error(`Đơn ${id} đã có ${rr.length} lệnh máy (${rr.slice(0, 4).map(r => r.machineId).join(", ")}) nên không thể xóa để bảo toàn lịch sử sản xuất.`);
    await db.collection(FS.orders).doc(id).delete();
    audit("order_delete", `Xóa đơn hàng: ${o?.customer || id} / ${o?.spec || ""}`, id);
  }
  async function handleBulkDeleteOrders(ids) {
    if (!ids || ids.length === 0) return;
    const withRuns = ids.filter(id => amgRunsOfOrder(flow.runs, id).length > 0);
    if (withRuns.length) throw new Error(`${withRuns.length} đơn đã có lệnh máy (${withRuns.slice(0, 5).join(", ")}) nên không thể xóa.`);
    const removed = baseOrders.filter(o => ids.includes(o.id));
    const batch = db.batch();
    ids.forEach(id => batch.delete(db.collection(FS.orders).doc(id)));
    await batch.commit();
    const preview = removed.slice(0, 5).map(o => `${o.customer || o.id}/${o.spec || ""}`).join(", ");
    audit("order_delete", `Xóa ${ids.length} đơn hàng cùng lúc: ${preview}${removed.length > 5 ? "…" : ""}`);
  }
  function handleUpdateMachine(id, status, note) {
    const machine = data.machines.find(m => m.id === id);
    const prevStatus = machine?.status;
    const nowIso = new Date().toISOString();
    let downtimeLog = Array.isArray(machine?.downtimeLog) ? [...machine.downtimeLog] : [];
    if (prevStatus !== status) {
      // Đóng sự kiện đang mở (nếu máy trước đó không chạy)
      if (prevStatus && prevStatus !== "running") {
        const openIdx = downtimeLog.findIndex(ev => !ev.endTime);
        if (openIdx !== -1) downtimeLog[openIdx] = {
          ...downtimeLog[openIdx],
          endTime: nowIso
        };
      }
      // Mở sự kiện mới (nếu trạng thái mới không phải đang chạy)
      if (status !== "running") {
        downtimeLog.push({
          id: uid("DT"),
          status,
          statusLabel: MACHINE_STATUS[status]?.label || status,
          startTime: nowIso,
          endTime: null,
          reason: note || "",
          recordedBy: currentUser.fullName
        });
      }
    }
    db.collection(FS.machines).doc(id).update({
      status,
      note,
      downtimeLog,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.fullName
    }).catch(() => {});
    audit("machine_update", `Cập nhật máy ${id}: trạng thái → ${MACHINE_STATUS[status].label}`, id);
  }
  async function handleAddDowntimeRecord({
    machineId,
    status,
    startTime,
    endTime,
    reason
  }) {
    const machine = data.machines.find(m => m.id === machineId);
    if (!machine) return;
    const downtimeLog = Array.isArray(machine.downtimeLog) ? [...machine.downtimeLog] : [];
    downtimeLog.push({
      id: uid("DT"),
      status,
      statusLabel: MACHINE_STATUS[status]?.label || status,
      startTime,
      endTime: endTime || null,
      reason: reason || "",
      recordedBy: currentUser.fullName
    });
    await db.collection(FS.machines).doc(machineId).update({
      downtimeLog
    });
    audit("machine_update", `Ghi nhận thời gian dừng máy ${machineId} (nhập tay)`, machineId);
  }
  async function handleUpdateDowntimeRecord(machineId, recordId, patch) {
    const machine = data.machines.find(m => m.id === machineId);
    if (!machine) return;
    const downtimeLog = (machine.downtimeLog || []).map(ev => ev.id === recordId ? {
      ...ev,
      ...patch
    } : ev);
    await db.collection(FS.machines).doc(machineId).update({
      downtimeLog
    });
    audit("machine_update", `Sửa bản ghi thời gian dừng máy ${machineId}`, machineId);
  }
  async function handleDeleteDowntimeRecord(machineId, recordId) {
    const machine = data.machines.find(m => m.id === machineId);
    if (!machine) return;
    const downtimeLog = (machine.downtimeLog || []).filter(ev => ev.id !== recordId);
    await db.collection(FS.machines).doc(machineId).update({
      downtimeLog
    });
    audit("machine_update", `Xóa bản ghi thời gian dừng máy ${machineId}`, machineId);
  }
  function handleAddMachine(typeKey) {
    const type = MACHINE_TYPES.find(t => t.key === typeKey);
    if (!type) return;
    // Tự sinh số thứ tự tiếp theo dựa trên các máy cùng loại đã có (vd KTI-64 -> KTI-65)
    const existingNums = data.machines.filter(m => m.typeKey === typeKey).map(m => {
      const match = String(m.id).match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = (existingNums.length ? Math.max(...existingNums) : 0) + 1;
    const id = `${type.prefix}-${String(nextNum).padStart(2, "0")}`;
    db.collection(FS.machines).doc(id).set({
      id,
      typeKey: type.key,
      typeLabel: type.label,
      stage: type.stage,
      status: "idle",
      note: "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.fullName
    });
    audit("machine_add", `Thêm máy mới: ${id} (${type.label})`, id);
  }
  async function handleDeleteMachine(id) {
    await db.collection(FS.machines).doc(id).delete();
    audit("machine_delete", `Xóa máy: ${id}`, id);
  }
  async function handleAddScrap(rec) {
    // onSnapshot keeps data.scrap fresh
    await db.collection(FS.scrap).doc(rec.id).set({
      ...rec,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    audit("scrap_add", `Ghi nhận phế liệu ${fmtNum(rec.qty)}${rec.unit} tại công đoạn "${STAGE_MAP[rec.stage]?.label}"${rec.customer ? " — " + rec.customer : ""}`, rec.id);
  }
  async function handleDeleteScrap(id) {
    // onSnapshot keeps data.scrap fresh
    await db.collection(FS.scrap).doc(id).delete();
    audit("scrap_add", `Xóa ghi nhận phế liệu ${id}`, id);
  }
  async function handleUpdateScrap(rec) {
    // onSnapshot keeps data.scrap fresh
    await db.collection(FS.scrap).doc(rec.id).update({
      ...rec,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    audit("scrap_add", `Sửa ghi nhận phế liệu ${fmtNum(rec.qty)}${rec.unit} tại công đoạn "${STAGE_MAP[rec.stage]?.label}"${rec.customer ? " — " + rec.customer : ""}`, rec.id);
  }
  async function handleAddStaff(s) {
    // onSnapshot keeps data.staff fresh
    await db.collection(FS.staff).doc(s.id).set({
      ...s,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    audit("staff_update", `Thêm nhân viên: ${s.name} (${s.team})`, s.id);
  }
  async function handleUpdateStaff(s) {
    // onSnapshot keeps data.staff fresh
    await db.collection(FS.staff).doc(s.id).update({
      ...s,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    audit("staff_update", `Cập nhật nhân viên: ${s.name}`, s.id);
  }
  async function handleDeleteStaff(id) {
    // onSnapshot keeps data.staff fresh
    const s = data.staff.find(x => x.id === id);
    await db.collection(FS.staff).doc(id).delete();
    audit("staff_update", `Xóa nhân viên: ${s?.name || id}`, id);
  }
  async function handleImportStaff(rows, mode) {
    const batch = db.batch();
    if (mode === "replace") {
      data.staff.forEach(s => batch.delete(db.collection(FS.staff).doc(s.id)));
      rows.forEach(r => {
        const id = uid("NV");
        batch.set(db.collection(FS.staff).doc(id), {
          ...r,
          id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      audit("staff_update", `Tải lên Excel: thay thế ${rows.length} nhân viên`);
    } else {
      let added = 0,
        updated = 0;
      rows.forEach(r => {
        const ex = data.staff.find(s => s.code === r.code);
        if (ex) {
          batch.update(db.collection(FS.staff).doc(ex.id), {
            ...r,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          updated++;
        } else {
          const id = uid("NV");
          batch.set(db.collection(FS.staff).doc(id), {
            ...r,
            id
          });
          added++;
        }
      });
      await batch.commit();
      audit("staff_update", `Tải lên Excel: ${added} mới, ${updated} cập nhật`);
    }
  }
  async function handleAttendanceUpdate(dayKey, dayData) {
    if (!dayData || Object.keys(dayData).length === 0) {
      await db.collection(FS.attendance).doc(dayKey).delete();
    } else {
      await db.collection(FS.attendance).doc(dayKey).set(dayData);
    }
  }
  // v46: tài khoản thật (Firebase Auth hoặc băm cục bộ), chỉ Admin; lỗi được ném ra để biểu mẫu hiển thị
  async function handleAddUser(payload) {
    await amgCreateAccount(payload, data.users);
    audit("user_update", `Tạo tài khoản mới: ${payload.username} (${amgRoleValueLabel(payload.role)})`, payload.username);
  }
  async function handleUpdateUser(payload) {
    await amgUpdateAccount(payload, data.users);
    audit("user_update", `Cập nhật tài khoản: ${payload.username} → ${amgRoleValueLabel(payload.role)}${payload.disabled ? " (khóa)" : ""}`, payload.username);
  }
  async function handleDeleteUser(username) {
    await amgDeleteAccount(username, data.users);
    audit("user_update", `Xóa tài khoản: ${username}`, username);
  }
  async function handleResetSeedData() {
    // v45: CHỈ nhập dữ liệu mẫu vào những mục đang hoàn toàn trống.
    // Không xóa, không ghi đè bản ghi nào đang có.
    const batch = db.batch();
    const added = [];
    const fill = (label, existing, items, col) => {
      if ((existing || []).length > 0) return;
      items.forEach(it => batch.set(db.collection(col).doc(it.id), it));
      added.push(`${label}: ${items.length}`);
    };
    fill("máy móc", data.machines, genMachineSeed(), FS.machines);
    fill("đơn hàng", data.orders, SEED_ORDERS, FS.orders);
    fill("nhân sự", data.staff, SEED_STAFF, FS.staff);
    fill("phế liệu", data.scrap, SEED_SCRAP, FS.scrap);
    if (added.length === 0) {
      showAlert("Các mục đều đã có dữ liệu nên không nhập thêm gì. Dữ liệu hiện có được giữ nguyên.");
      return;
    }
    await batch.commit();
    audit("user_update", `Nhập dữ liệu mẫu vào mục trống (${added.join(", ")}). Không xóa, không ghi đè.`);
  }
  const pageTitles = {
    dashboard: "Tổng quan sản xuất",
    orders: "Đơn hàng & BOM",
    machines: "Kế hoạch sản xuất",
    completed: "Đơn hàng hoàn thành",
    downtime: "Theo dõi thời gian dừng máy",
    qc: "Chất lượng & phế liệu",
    staff: "Nhân sự",
    certificates: "Chứng nhận ISO - UL",
    reports: "Báo cáo & biểu đồ",
    ops: "Điều hành sản xuất",
    warehouse: "Kho & nguyên liệu",
    inspect: "Kiểm tra QA/QC & NG",
    maintenance: "Bảo trì & sửa chữa",
    training: "Đào tạo & tăng ca",
    docs: "Hồ sơ & tài liệu",
    reports2: "Báo cáo nâng cao",
    perms: "Phân quyền & giám sát",
    trace: "Truy xuất & toàn vẹn",
    admin: "Quản trị hệ thống"
  };
  const navMeta = amgNavMeta(activeTab);
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-root"
  }, /*#__PURE__*/React.createElement(GlobalStyle, null), /*#__PURE__*/React.createElement("div", {
    className: "mes-app-shell"
  }, mobileNavOpen && /*#__PURE__*/React.createElement("div", {
    className: "mes-sidebar-overlay",
    onClick: () => setMobileNavOpen(false)
  }), /*#__PURE__*/React.createElement(Sidebar, {
    active: activeTab,
    onChange: key => {
      setActiveTab(key);
      setMobileNavOpen(false);
    },
    role: currentUser.role,
    currentUser: currentUser,
    collapsed: collapsed,
    onToggleCollapse: () => setCollapsed(c => !c),
    mobileOpen: mobileNavOpen,
    onCloseMobile: () => setMobileNavOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "mes-main"
  }, kioskMode && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 5000,
      background: `linear-gradient(90deg, ${COLORS.copper}, ${COLORS.copperDark})`,
      color: "#fff",
      padding: "8px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      fontSize: FZ(AMG_TYPE.md),
      fontWeight: 700,
      boxShadow: "0 2px 10px rgba(0,0,0,.25)"
    }
  }, /*#__PURE__*/React.createElement(RefreshCw, {
    size: 15,
    className: "pulse-dot"
  }), "Chế độ trình chiếu tự động — ", pageTitles[activeTab], " · Chạm màn hình để thoát"), /*#__PURE__*/React.createElement(TopBar, {
    currentUser: currentUser,
    onLogout: () => setCurrentUser(null),
    pageTitle: pageTitles[activeTab],
    groupLabel: navMeta.group,
    onRefresh: data.refreshAll,
    onOpenMobileNav: () => setMobileNavOpen(true),
    theme: theme,
    onToggleTheme: toggleTheme,
    orders: activeOrders,
    machines: data.machines,
    attendance: data.attendance,
    extra: extra,
    onNavigate: setActiveTab
  }), /*#__PURE__*/React.createElement("main", {
    className: "mes-content-scroll",
    ref: scrollRef,
    id: "mes-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-content-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-page",
    key: activeTab
  }, activeTab === "dashboard" && /*#__PURE__*/React.createElement(DashboardPage, {
    currentUser: currentUser,
    attendance: data.attendance,
    onNavigate: setActiveTab,
    isAdmin: isAdmin,
    orders: data.orders,
    machines: data.machines,
    staff: data.staff,
    scrap: data.scrap,
    auditLog: data.auditLog,
    runs: flow.runs,
    entries: flow.entries,
    extra: extra,
    onQuickEntry: handleQuickEntry,
    onKeoTrungEntry: handleKeoTrungEntry,
    onEditKeoTrung: handleEditProductionEntry,
    onDeleteKeoTrung: handleDeleteProductionEntry,
    onUpdateScrap: handleUpdateScrap
  }), activeTab === "orders" && /*#__PURE__*/React.createElement(OrdersPage, {
    extra,
    runs: flow.runs,
    machines: data.machines,
    orders: activeOrders,
    completedCount: baseOrders.length - activeOrders.length,
    onNavigate: setActiveTab,
    auditLog: data.auditLog,
    isAdmin: isAdmin,
    currentUser: currentUser,
    onAdd: handleAddOrder,
    onUpdate: handleUpdateOrder,
    onDelete: handleDeleteOrder,
    onBulkDelete: handleBulkDeleteOrders,
    onRestoreSeed: handleResetSeedData
  }), activeTab === "machines" && /*#__PURE__*/React.createElement(PlanPage, {
    orders: data.orders,
    machines: data.machines,
    runs: flow.runs,
    entries: flow.entries,
    flowError: flow.error,
    auditLog: data.auditLog,
    staff: data.staff,
    currentUser: currentUser,
    isAdmin: isAdmin,
    canEdit: canEditMachines,
    onUpdateOrder: handleUpdateOrder,
    onNavigate: setActiveTab,
    onUpdateMachine: handleUpdateMachine,
    onAddMachine: handleAddMachine,
    onDeleteMachine: handleDeleteMachine,
    onRestoreSeed: handleResetSeedData
  }), activeTab === "completed" && /*#__PURE__*/React.createElement(CompletedOrdersPage, {
    orders: data.orders,
    runs: flow.runs,
    entries: flow.entries,
    auditLog: data.auditLog,
    extra: extra,
    scrap: data.scrap,
    currentUser: currentUser
  }), activeTab === "downtime" && /*#__PURE__*/React.createElement(DowntimeTrackingPage, {
    machines: data.machines,
    isAdmin: isAdmin,
    currentUser: currentUser,
    onAdd: handleAddDowntimeRecord,
    onUpdate: handleUpdateDowntimeRecord,
    onDelete: handleDeleteDowntimeRecord
  }), activeTab === "qc" && /*#__PURE__*/React.createElement(QCPage, {
    scrap: data.scrap,
    isAdmin: isAdmin,
    currentUser: currentUser,
    onAdd: handleAddScrap,
    onUpdate: handleUpdateScrap,
    onDelete: handleDeleteScrap,
    orders: data.orders,
    auditLog: data.auditLog
  }), activeTab === "staff" && /*#__PURE__*/React.createElement(StaffPage, {
    staff: data.staff,
    isAdmin: isAdmin,
    canEdit: canEditStaffMachines,
    onAdd: handleAddStaff,
    onUpdate: handleUpdateStaff,
    onDelete: handleDeleteStaff,
    onRestoreSeed: handleResetSeedData,
    onImport: handleImportStaff,
    attendance: data.attendance,
    onAttendanceUpdate: handleAttendanceUpdate
  }), activeTab === "certificates" && /*#__PURE__*/React.createElement(CertificatesPage, {
    certificates: data.certificates,
    folders: data.certFolders,
    isAdmin: isAdmin,
    currentUser: currentUser,
    onAdd: data.addCertificate,
    onDelete: data.deleteCertificate,
    onAddFolder: data.addCertFolder,
    onDeleteFolder: data.deleteCertFolder
  }), activeTab === "reports" && /*#__PURE__*/React.createElement(ReportsPage, {
    orders: data.orders,
    machines: data.machines,
    scrap: data.scrap,
    timeseries: SEED_TIMESERIES,
    auditLog: data.auditLog,
    currentUser: currentUser,
    isAdmin: isAdmin,
    onEditProductionEntry: handleEditProductionEntry,
    onDeleteProductionEntry: handleDeleteProductionEntry
  }), activeTab === "ops" && amgAllow(currentUser, "v", "dieuhanh") && /*#__PURE__*/React.createElement(OpsPage, {
    extra, orders: data.orders, machines: data.machines, staff: data.staff, auditLog: data.auditLog, currentUser
  }), activeTab === "warehouse" && amgAllow(currentUser, "v", "kho") && /*#__PURE__*/React.createElement(WarehousePage, {
    extra, orders: data.orders, auditLog: data.auditLog, currentUser
  }), activeTab === "inspect" && amgAllow(currentUser, "v", "qc") && /*#__PURE__*/React.createElement(InspectPage, {
    extra, orders: data.orders, machines: data.machines, auditLog: data.auditLog, currentUser
  }), activeTab === "maintenance" && amgAllow(currentUser, "v", "dung") && /*#__PURE__*/React.createElement(MaintenancePage, {
    extra, machines: data.machines, auditLog: data.auditLog, currentUser
  }), activeTab === "training" && amgAllow(currentUser, "v", "nhansu") && /*#__PURE__*/React.createElement(TrainingPage, {
    extra, staff: data.staff, auditLog: data.auditLog, currentUser
  }), activeTab === "docs" && amgAllow(currentUser, "v", "tailieu") && /*#__PURE__*/React.createElement(DocsPage, {
    extra, auditLog: data.auditLog, currentUser
  }), activeTab === "reports2" && amgAllow(currentUser, "v", "baocao") && /*#__PURE__*/React.createElement(ReportsPlusPage, {
    auditLog: data.auditLog, scrap: data.scrap, extra, machines: data.machines, orders: data.orders
  }), activeTab === "trace" && amgAllow(currentUser, "v", "qc") && /*#__PURE__*/React.createElement(TracePage, {
    extra, orders: data.orders, machines: data.machines, auditLog: data.auditLog, onNavigate: setActiveTab
  }), activeTab === "perms" && isRoot && /*#__PURE__*/React.createElement(PermissionsPage, {
    users: data.users, auditLog: data.auditLog
  }), activeTab === "admin" && isRoot && /*#__PURE__*/React.createElement(AdminPage, {
    users: data.users,
    auditLog: data.auditLog,
    currentUser: currentUser,
    onAddUser: handleAddUser,
    onUpdateUser: handleUpdateUser,
    onDeleteUser: handleDeleteUser,
    onResetSeedData: handleResetSeedData
  })))))));
}
