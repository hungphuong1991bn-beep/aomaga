/* v46: OrderForm, OrderModal, OrdersPage cũ đã được thay bằng modules/orders/ordersboard.js (bản gốc nằm trong aomaga_v45.ORIGINAL.zip). Giữ lại StageMiniBars và OrderHistoryList vì orderdetail.js còn dùng. */
/* ===================== ORDERS / BOM PAGE ===================== */
function StageMiniBars({
  order
}) {
  const applicable = getApplicableStages(order);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 3
    }
  }, STAGES.filter(s => applicable.includes(s.key)).map(s => {
    const st = order.stages?.[s.key];
    const done = st?.done || 0;
    const qty = order.quantity || 0;
    const pct = qty > 0 ? clamp(done / qty * 100, 0, 100) : done > 0 ? 100 : 0;
    const active = done > 0;
    const remain = computeStageRemain(order.quantity, done) ?? st?.remain;
    return /*#__PURE__*/React.createElement("div", {
      key: s.key,
      title: `${s.label}: đã ${fmtNum(done)} / còn ${fmtNum(remain)}`,
      style: {
        width: 16,
        height: 22,
        background: COLORS.bgInset,
        borderRadius: 3,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column-reverse",
        border: `1px solid ${COLORS.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        height: `${pct}%`,
        background: active ? COLORS.copper : "transparent"
      }
    }));
  }));
}
function OrderHistoryList({
  auditLog,
  orderId
}) {
  const entries = auditLog.filter(a => a.targetId === orderId);
  if (entries.length === 0) return /*#__PURE__*/React.createElement(EmptyState, {
    icon: History,
    title: "Chưa có lịch sử chỉnh sửa",
    hint: "Mọi thay đổi với đơn hàng này sẽ được ghi lại tại đây."
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      maxHeight: 280,
      overflowY: "auto"
    }
  }, entries.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    style: {
      borderLeft: `2px solid ${COLORS.border}`,
      paddingLeft: 10,
      fontSize: FZ(13)
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.text
    }
  }, e.detail), /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.textFaint,
      fontSize: FZ(12)
    }
  }, e.user, " · ", fmtDateTime(e.ts)))));
}
