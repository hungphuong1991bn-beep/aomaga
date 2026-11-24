const CERT_TYPES = [{
  key: "iso9001",
  label: "ISO 9001",
  sub: "Quality",
  color: "#2563EB"
}, {
  key: "iso14001",
  label: "ISO 14001",
  sub: "Environment",
  color: "#16A34A"
}, {
  key: "iso45001",
  label: "ISO 45001",
  sub: "Safety",
  color: "#EA580C"
}, {
  key: "ul",
  label: "UL Certified",
  sub: "Certified",
  color: "#7C3AED"
}, {
  key: "other",
  label: "Khác",
  sub: "Other",
  color: "#64748B"
}];
const CERT_MAX_BYTES = 700 * 1024; // ~700KB gốc (base64 ~1.37x → dưới giới hạn 1MB/document của Firestore)
function CertificateAddModal({
  onClose,
  onAdd,
  folders
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("iso9001");
  const [folderId, setFolderId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [fileDataUri, setFileDataUri] = useState("");
  const [fileMime, setFileMime] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > CERT_MAX_BYTES) {
      setErr(`File quá lớn (${(f.size / 1024).toFixed(0)}KB). Vui lòng chọn file dưới ${(CERT_MAX_BYTES / 1024).toFixed(0)}KB (ảnh chụp/scan nên nén trước khi tải lên).`);
      setFile(null);
      setFileDataUri("");
      return;
    }
    setErr("");
    setFile(f);
    setFileMime(f.type);
    const reader = new FileReader();
    reader.onload = () => setFileDataUri(reader.result);
    reader.readAsDataURL(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  }
  async function handleSubmit() {
    if (!name.trim()) {
      setErr("Vui lòng nhập tên chứng chỉ.");
      return;
    }
    if (!fileDataUri) {
      setErr("Vui lòng chọn file chứng chỉ (ảnh hoặc PDF).");
      return;
    }
    setBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        type,
        folderId: folderId || null,
        note: note.trim(),
        fileDataUri,
        fileMime,
        fileName: file ? file.name : ""
      });
      onClose();
    } catch (e) {
      setErr("Có lỗi khi lưu chứng chỉ: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Thêm chứng chỉ",
    onClose: onClose
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Tên chứng chỉ"
  }, /*#__PURE__*/React.createElement("input", {
    className: "mes-input",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "ví dụ: Chứng nhận ISO 9001:2015"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Loại chứng chỉ"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: type,
    onChange: e => setType(e.target.value)
  }, CERT_TYPES.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.key,
    value: t.key
  }, t.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Thư mục"
  }, /*#__PURE__*/React.createElement("select", {
    className: "mes-input",
    value: folderId,
    onChange: e => setFolderId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— Không phân loại —"), (folders || []).map(f => /*#__PURE__*/React.createElement("option", {
    key: f.id,
    value: f.id
  }, f.name)))), /*#__PURE__*/React.createElement(Field, {
    label: "File chứng chỉ (ảnh hoặc PDF)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*,application/pdf",
    onChange: handleFile,
    className: "mes-input"
  }), fileDataUri && fileMime.startsWith("image/") && /*#__PURE__*/React.createElement("img", {
    src: fileDataUri,
    alt: "preview",
    style: {
      marginTop: 8,
      maxWidth: "100%",
      maxHeight: 160,
      borderRadius: 8,
      border: `1px solid ${COLORS.border}`
    }
  }), fileDataUri && fileMime === "application/pdf" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: FZ(13),
      color: COLORS.textDim
    }
  }, /*#__PURE__*/React.createElement(FileSpreadsheet, {
    size: 15
  }), file?.name)), /*#__PURE__*/React.createElement(Field, {
    label: "Ghi chú (tuỳ chọn)"
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "mes-input",
    rows: 2,
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "Ngày hiệu lực, đơn vị cấp,..."
  })), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.red,
      fontSize: FZ(13),
      marginBottom: 10
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: onClose
  }, "Huỷ"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: handleSubmit,
    disabled: busy
  }, busy ? "Đang lưu..." : "Thêm chứng chỉ")));
}
function CertificatesPage({
  certificates,
  folders,
  isAdmin,
  currentUser,
  onAdd,
  onDelete,
  onAddFolder,
  onDeleteFolder
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const FOLDER_COLORS = ["#2563EB", "#16A34A", "#EA580C", "#7C3AED", "#DB2777", "#0D9488", "#CA8A04"];
  const visibleCertificates = certificates.filter(c => {
    if (selectedFolder === "all") return true;
    if (selectedFolder === "none") return !c.folderId;
    return c.folderId === selectedFolder;
  });
  async function handleAddFolderSubmit() {
    if (!newFolderName.trim()) return;
    const color = FOLDER_COLORS[(folders || []).length % FOLDER_COLORS.length];
    await onAddFolder(newFolderName.trim(), color);
    setNewFolderName("");
    setShowAddFolder(false);
  }
  async function handleAdd(cert) {
    await onAdd({
      ...cert,
      uploadedBy: currentUser?.fullName || currentUser?.username || "—"
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: `${certificates.length} chứng chỉ`,
    title: "Chứng nhận ISO - UL",
    icon: AwardIcon,
    iconColor: "#7C3AED",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setShowAdd(true)
    }, /*#__PURE__*/React.createElement(Plus, {
      size: 14
    }), " Thêm chứng chỉ")
  }),
  /* Thanh thư mục */
  /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 18,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedFolder("all"),
    className: "mes-btn",
    style: {
      padding: "6px 14px",
      borderRadius: 999,
      border: `1px solid ${selectedFolder === "all" ? COLORS.copper : COLORS.border}`,
      background: selectedFolder === "all" ? `${COLORS.copper}18` : COLORS.bgPanel2,
      color: selectedFolder === "all" ? COLORS.copperBright : COLORS.textDim,
      fontWeight: 700,
      fontSize: FZ(13)
    }
  }, "Tất cả (", certificates.length, ")"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedFolder("none"),
    className: "mes-btn",
    style: {
      padding: "6px 14px",
      borderRadius: 999,
      border: `1px solid ${selectedFolder === "none" ? COLORS.textDim : COLORS.border}`,
      background: selectedFolder === "none" ? COLORS.bgPanel2 : COLORS.bgPanel2,
      color: COLORS.textDim,
      fontWeight: 700,
      fontSize: FZ(13)
    }
  }, "Chưa phân loại (", certificates.filter(c => !c.folderId).length, ")"), (folders || []).map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedFolder(f.id),
    className: "mes-btn",
    style: {
      padding: "6px 10px 6px 14px",
      borderRadius: selectedFolder === f.id ? "999px 0 0 999px" : 999,
      border: `1px solid ${selectedFolder === f.id ? f.color : COLORS.border}`,
      borderRight: selectedFolder === f.id ? "none" : undefined,
      background: selectedFolder === f.id ? `${f.color}18` : COLORS.bgPanel2,
      color: selectedFolder === f.id ? f.color : COLORS.textDim,
      fontWeight: 700,
      fontSize: FZ(13),
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: f.color,
      flexShrink: 0
    }
  }), f.name, " (", certificates.filter(c => c.folderId === f.id).length, ")"), isAdmin && selectedFolder === f.id && /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmDeleteFolder(f),
    title: "Xoá thư mục",
    style: {
      padding: "6px 8px",
      borderRadius: "0 999px 999px 0",
      border: `1px solid ${f.color}`,
      borderLeft: "none",
      background: `${f.color}18`,
      color: f.color,
      cursor: "pointer",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 12
  })))), isAdmin && (showAddFolder ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    className: "mes-input",
    style: {
      width: 150,
      padding: "6px 10px",
      fontSize: FZ(13)
    },
    placeholder: "Tên thư mục...",
    value: newFolderName,
    onChange: e => setNewFolderName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") handleAddFolderSubmit();
      if (e.key === "Escape") setShowAddFolder(false);
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleAddFolderSubmit,
    className: "mes-btn",
    style: {
      padding: "6px 10px",
      background: COLORS.copper,
      borderColor: COLORS.copper,
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement(CheckCircle2, {
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowAddFolder(false);
      setNewFolderName("");
    },
    className: "mes-btn",
    style: {
      padding: "6px 10px"
    }
  }, /*#__PURE__*/React.createElement(X, {
    size: 14
  }))) : /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAddFolder(true),
    className: "mes-btn",
    style: {
      padding: "6px 14px",
      borderRadius: 999,
      border: `1.5px dashed ${COLORS.borderLight}`,
      background: "transparent",
      color: COLORS.textDim,
      fontWeight: 700,
      fontSize: FZ(13),
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13
  }), " Thư mục"))), visibleCertificates.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: AwardIcon,
    title: "Chưa có chứng chỉ nào",
    hint: "Bấm \"Thêm chứng chỉ\" để tải lên chứng nhận ISO, UL của nhà máy"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
      gap: 16
    }
  }, visibleCertificates.map(c => {
    const t = CERT_TYPES.find(x => x.key === c.type) || CERT_TYPES[4];
    const folder = (folders || []).find(f => f.id === c.folderId);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      className: "mes-card",
      style: {
        padding: 0,
        overflow: "hidden",
        border: `1px solid ${t.color}55`,
        borderTop: `4px solid ${t.color}`,
        boxShadow: `0 2px 8px ${t.color}22`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 140,
        background: COLORS.bgPanel2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }
    }, c.fileMime && c.fileMime.startsWith("image/") ? /*#__PURE__*/React.createElement("img", {
      src: c.fileDataUri,
      alt: c.name,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }) : /*#__PURE__*/React.createElement(FileSpreadsheet, {
      size: 40,
      color: t.color
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 14
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      color: t.color
    }, t.label), folder && /*#__PURE__*/React.createElement(Badge, {
      color: folder.color
    }, folder.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        marginTop: 8,
        marginBottom: 4,
        fontSize: FZ(14)
      }
    }, c.name), c.note && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: FZ(12),
        color: COLORS.textDim,
        marginBottom: 6
      }
    }, c.note), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: FZ(12),
        color: COLORS.textFaint,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, c.uploadedBy, " · ", (c.uploadedAt || "").slice(0, 10)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("a", {
      href: c.fileDataUri,
      download: c.fileName || c.name,
      className: "mes-btn mes-btn-ghost",
      style: {
        padding: "4px 8px"
      }
    }, /*#__PURE__*/React.createElement(Download, {
      size: 13
    })), isAdmin && /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmDelete(c),
      className: "mes-btn mes-btn-ghost",
      style: {
        padding: "4px 8px",
        color: COLORS.red,
        borderColor: COLORS.red
      }
    }, /*#__PURE__*/React.createElement(Trash2, {
      size: 13
    }))))));
  })), showAdd && /*#__PURE__*/React.createElement(CertificateAddModal, {
    onClose: () => setShowAdd(false),
    onAdd: handleAdd,
    folders: folders
  }), confirmDeleteFolder && /*#__PURE__*/React.createElement(Modal, {
    title: "Xoá thư mục",
    onClose: () => setConfirmDeleteFolder(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, "Xoá thư mục \"", confirmDeleteFolder.name, "\"? Các chứng chỉ trong thư mục này sẽ chuyển về \"Chưa phân loại\", không bị xoá."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setConfirmDeleteFolder(null)
  }, "Huỷ"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: async () => {
      await onDeleteFolder(confirmDeleteFolder.id);
      setSelectedFolder("all");
      setConfirmDeleteFolder(null);
    }
  }, "Xoá thư mục"))), confirmDelete && /*#__PURE__*/React.createElement(Modal, {
    title: "Xoá chứng chỉ",
    onClose: () => setConfirmDelete(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, "Bạn có chắc muốn xoá chứng chỉ \"", confirmDelete.name, "\"?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setConfirmDelete(null)
  }, "Huỷ"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: () => {
      onDelete(confirmDelete.id);
      setConfirmDelete(null);
    }
  }, "Xoá"))));
}
