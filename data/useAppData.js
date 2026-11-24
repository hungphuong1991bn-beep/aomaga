/* ===================== APP DATA HOOK ===================== */
function useAppData() {
  const [ready, setReady] = React.useState(false);
  const [users, setUsers] = React.useState([]);
  const [orders, setOrders] = React.useState([]);
  const [machines, setMachines] = React.useState([]);
  const [staff, setStaff] = React.useState([]);
  const [scrap, setScrap] = React.useState([]);
  const [auditLog, setAuditLog] = React.useState([]);
  const [attendance, setAttendance] = React.useState({});
  const [certificates, setCertificates] = React.useState([]);
  const [certFolders, setCertFolders] = React.useState([]);
  const [storageError] = React.useState(false);
  // Lần chạy offline đầu tiên (localStorage trống) → gieo dữ liệu mẫu gốc,
  // để app không hiện trống trơn khi chưa cấu hình Firebase.
  const seedIfEmptyOffline = React.useCallback(async () => {
    if (!window.__isOfflineDb) return;
    // Kiểm tra một lần xem collection có trống không (an toàn nếu onSnapshot gọi callback đồng bộ)
    const isEmpty = col => new Promise(resolve => {
      let unsub, done = false;
      unsub = amgSnapDedup(db.collection(col), s => {
        if (done) return;
        done = true;
        resolve(s.docs.length === 0);
        if (unsub) unsub(); else Promise.resolve().then(() => unsub && unsub());
      }, () => resolve(true));
    });
    const batch = db.batch();
    let touched = false;
    if (await isEmpty(FS.orders)) { SEED_ORDERS.forEach(o => { batch.set(db.collection(FS.orders).doc(o.id), o); touched = true; }); }
    if (await isEmpty(FS.machines)) { genMachineSeed().forEach(m => { batch.set(db.collection(FS.machines).doc(m.id), m); touched = true; }); }
    if (await isEmpty(FS.staff)) { SEED_STAFF.forEach(s => { batch.set(db.collection(FS.staff).doc(s.id), s); touched = true; }); }
    if (await isEmpty(FS.scrap)) { SEED_SCRAP.forEach(s => { batch.set(db.collection(FS.scrap).doc(s.id), s); touched = true; }); }
    if (await isEmpty(FS.users)) {
      DEFAULT_USERS.forEach(u => { const { pwHash, ...profile } = u; batch.set(db.collection(FS.users).doc(u.username), profile); touched = true; });
    }
    if (touched) await batch.commit();
  }, []);

  React.useEffect(() => {
    let n = 0;
    const total = 8;
    const done = () => {
      n++;
      if (n >= total) setReady(true);
    };
    let cancelled = false;
    let unsubs = [];
    seedIfEmptyOffline().finally(() => {
      if (cancelled) return;
      unsubs = [amgSnapDedup(db.collection(FS.orders), s => {
      // Sắp xếp phía client (không dùng orderBy("createdAt") của Firestore) vì
      // Firestore sẽ ÂM THẦM LOẠI BỎ khỏi kết quả bất kỳ document nào thiếu đúng
      // trường đang orderBy — mà _batch()/persistOrders chỉ ghi "updatedAt", không
      // ghi "createdAt", nên đơn hàng mới thêm sẽ biến mất hoàn toàn khỏi danh sách.
      const list = s.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || a.orderDate || 0).getTime();
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || b.orderDate || 0).getTime();
        return tb - ta;
      });
      setOrders(list);
      done();
    }, () => done()), amgSnapDedup(db.collection(FS.staff), s => {
      // Tương tự: không dùng orderBy("team") vì Firestore sẽ loại bỏ nhân sự
      // thiếu trường "team" khỏi kết quả — sắp xếp phía client thay vào đó.
      const list = s.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      list.sort((a, b) => (a.team || "").localeCompare(b.team || ""));
      setStaff(list);
      done();
    }, () => done()), amgSnapDedup(db.collection(FS.machines), s => {
      setMachines(s.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
      done();
    }, () => done()), amgSnapDedup(db.collection(FS.scrap).orderBy("date", "desc"), s => {
      setScrap(s.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
      done();
    }, () => done()), amgSnapDedup((window.__isOfflineDb ? db.collection(FS.audit) : db.collection(FS.audit).where("ts", ">=", firebase.firestore.Timestamp.fromDate(amgWindowStart()))).orderBy("ts", "desc"), s => {
      // Giữ lại đúng 365 ngày gần nhất (không giới hạn số lượng bản ghi trong khoảng đó)
      const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const list = s.docs.map(d => ({
        ...d.data(),
        id: d.id
      })).filter(a => {
        const t = a.ts && typeof a.ts.toMillis === "function" ? a.ts.toMillis() : new Date(a.ts || 0).getTime();
        return isNaN(t) || t >= cutoff; // giữ lại cả bản ghi chưa có ts hợp lệ (tránh mất dữ liệu cũ vì lỗi định dạng)
      });
      setAuditLog(list);
      done();
    }, () => done()), amgSnapDedup(db.collection(FS.users), s => {
      setUsers(s.docs.map(d => ({
        id: d.id,
        uid: d.id,
        ...d.data()
      })));
      done();
    }, () => done()), amgSnapDedup(db.collection(FS.attendance), s => {
      const a = {};
      s.docs.forEach(d => {
        a[d.id] = d.data();
      });
      setAttendance(a);
      done();
    }, () => done()), amgSnapDedup(db.collection(FS.certificates), s => {
      const all = s.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Tài liệu đặc biệt "_folders_meta" lưu danh sách thư mục — tách riêng, không hiện như 1 chứng chỉ
      const metaDoc = all.find(d => d.id === "_folders_meta");
      setCertFolders(metaDoc && Array.isArray(metaDoc.folders) ? metaDoc.folders : []);
      const list = all.filter(d => d.id !== "_folders_meta");
      list.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
      setCertificates(list);
      done();
    }, () => done())];
    });
    return () => { cancelled = true; unsubs.forEach(u => u()); };
  }, []);

  // persist* = batch-write arrays → Firestore (giữ API compat với toàn bộ handlers)
  const _batch = async (col, arr) => {
    const batch = db.batch();
    arr.forEach(item => {
      const ref = db.collection(col).doc(item.id);
      batch.set(ref, {
        ...item,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {
        merge: true
      });
    });
    return batch.commit();
  };
  const persistOrders = React.useCallback(arr => _batch(FS.orders, arr), []);
  const persistStaff = React.useCallback(arr => _batch(FS.staff, arr), []);
  const persistMachines = React.useCallback(arr => _batch(FS.machines, arr), []);
  const persistScrap = React.useCallback(arr => _batch(FS.scrap, arr), []);
  const persistUsers = React.useCallback(arr => _batch(FS.users, arr.map(u => ({
    ...u,
    id: u.uid || u.username || u.id
  }))), []);
  const persistAuditLog = React.useCallback(async arr => {
    const batch = db.batch();
    arr.slice(0, 20).forEach(e => {
      const ref = db.collection(FS.audit).doc(e.id);
      batch.set(ref, {
        ...e,
        ts: e.ts || firebase.firestore.FieldValue.serverTimestamp()
      }, {
        merge: true
      });
    });
    return batch.commit();
  }, []);
  const persistAttendance = React.useCallback(async obj => {
    const batch = db.batch();
    Object.entries(obj).forEach(([date, data]) => {
      const ref = db.collection(FS.attendance).doc(date);
      if (data && Object.keys(data).length > 0) batch.set(ref, data);else batch.delete(ref);
    });
    return batch.commit();
  }, []);
  const pushAudit = React.useCallback(async entry => {
    await db.collection(FS.audit).add({
      ...entry,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
  }, []);
  const addCertificate = React.useCallback(async cert => {
    const id = cert.id || ("cert_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
    await db.collection(FS.certificates).doc(id).set({
      ...cert,
      id,
      uploadedAt: cert.uploadedAt || new Date().toISOString()
    });
  }, []);
  const deleteCertificate = React.useCallback(async id => {
    await db.collection(FS.certificates).doc(id).delete();
  }, []);
  const addCertFolder = React.useCallback(async (name, color) => {
    const id = "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const next = [...certFolders, {
      id,
      name,
      color
    }];
    await db.collection(FS.certificates).doc("_folders_meta").set({
      folders: next
    });
    return id;
  }, [certFolders]);
  const deleteCertFolder = React.useCallback(async id => {
    const next = certFolders.filter(f => f.id !== id);
    await db.collection(FS.certificates).doc("_folders_meta").set({
      folders: next
    });
    // Các chứng chỉ đang thuộc thư mục bị xoá -> chuyển về "Chưa phân loại"
    const affected = certificates.filter(c => c.folderId === id);
    const batch = db.batch();
    affected.forEach(c => {
      batch.update(db.collection(FS.certificates).doc(c.id), {
        folderId: null
      });
    });
    if (affected.length) await batch.commit();
  }, [certFolders, certificates]);
  const refreshAll = React.useCallback(() => {}, []); // no-op: onSnapshot handles it

  return {
    ready,
    storageError,
    users,
    orders,
    machines,
    staff,
    scrap,
    auditLog,
    attendance,
    certificates,
    certFolders,
    persistUsers,
    persistOrders,
    persistMachines,
    persistStaff,
    persistScrap,
    persistAuditLog,
    persistAttendance,
    addCertificate,
    deleteCertificate,
    addCertFolder,
    deleteCertFolder,
    pushAudit,
    refreshAll
  };
}

