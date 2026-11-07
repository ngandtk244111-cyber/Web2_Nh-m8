// Chính sách hoàn tiền khi huỷ đơn đã trả trước (chuyển khoản, ví, thẻ ATM). COD chưa thu tiền nên không cần hoàn.
// Giữ khớp với REFUND_POLICY ở projects/my-client/src/app/core/data/refund-policy.ts
const REFUND_POLICY = {
  MOMO: { days: 3, channel: 'Hoàn về ví MoMo đã dùng để thanh toán' },
  ZALOPAY: { days: 3, channel: 'Hoàn về ví ZaloPay đã dùng để thanh toán' },
  ATM: { days: 7, channel: 'Hoàn về thẻ ATM / tài khoản ngân hàng đã dùng để thanh toán' },
  BANK_TRANSFER: { days: 5, channel: 'Chuyển khoản về tài khoản ngân hàng khách cung cấp' },
};

/** Đơn đã trả trước (hoặc khách đã báo chuyển khoản) thì huỷ phải hoàn tiền. */
function needsRefund(order) {
  return order.paymentMethod !== 'COD' && (order.paymentStatus === 'PAID' || !!order.transferReportedAt);
}

/** Cộng số ngày làm việc (bỏ thứ Bảy, Chủ nhật). */
function addBusinessDays(from, days) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * Tạo yêu cầu hoàn tiền cho đơn vừa huỷ. Chuyển khoản ngân hàng cần tài khoản nhận của khách
 * (khách nhập lúc huỷ; admin huỷ thì để trống, nhân viên liên hệ khách lấy thông tin).
 */
function buildRefund(order, bank = {}) {
  const policy = REFUND_POLICY[order.paymentMethod] || { days: 7, channel: 'Hoàn về phương thức đã thanh toán' };
  const now = new Date();
  return {
    status: 'PENDING',
    amount: order.total,
    channel: policy.channel,
    bankName: String(bank.bankName || '').trim(),
    bankAccount: String(bank.bankAccount || '').trim(),
    accountHolder: String(bank.accountHolder || '').trim().toUpperCase(),
    requestedAt: now,
    dueAt: addBusinessDays(now, policy.days),
  };
}

module.exports = { REFUND_POLICY, needsRefund, buildRefund };
