// Luồng tiền cọc của đơn đặt làm theo báo giá (orderType CUSTOM_QUOTE) và quy tắc chặn sản xuất.
//
// Trạng thái cọc (order.depositStatus):
//   UNPAID     — chưa đủ cọc, không có giao dịch chờ đối soát (đang tính hạn trả cọc)
//   VERIFYING  — có giao dịch khách báo đang chờ nhân viên đối soát (tạm dừng xét hết hạn, SLA 48h)
//   PAID       — tổng tiền đã XÁC NHẬN >= tiền cọc -> được phép sản xuất
//   REFUND_PENDING / PARTIALLY_REFUNDED / REFUNDED — sau khi huỷ, theo luồng hoàn tiền
// Tổng đã nhận (order.depositReceived) luôn tính lại từ sổ PaymentTransaction (status CONFIRMED).
//
// Các hàm compute* / *Reason là hàm thuần (unit test được); hàm còn lại đọc/ghi DB.

const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const CustomRequest = require('../models/CustomRequest');
const { VERIFY_SLA_HOURS, AUTO_GRACE_HOURS } = require('./deposit');
const { vietQrImageUrl } = require('./payment-config');
const { buildRefund } = require('./refund-policy');

const HOUR = 3600 * 1000;
const REFUND_STATES = ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'];

const isDepositOrder = (order) => order?.orderType === 'CUSTOM_QUOTE' && order?.paymentPlan?.type === 'DEPOSIT';

/**
 * Trạng thái cọc mới sau khi sổ giao dịch thay đổi (hàm thuần).
 * input: { plan, depositStatus, received, pendingReportedAts: Date[], now }
 * trả về các field cần $set lên order.
 */
function computeDepositState({ plan, depositStatus, received, pendingReportedAts = [], now = new Date() }) {
  const set = { depositReceived: received };
  if (REFUND_STATES.includes(depositStatus)) return set; // đã vào luồng hoàn tiền: chỉ cập nhật số tiền

  if (received >= plan.depositAmount) {
    set.depositStatus = 'PAID';
    if (!plan.depositPaidAt) set['paymentPlan.depositPaidAt'] = now;
    set['paymentPlan.verifySlaAt'] = null;
    return set;
  }
  if (pendingReportedAts.length) {
    const earliest = Math.min(...pendingReportedAts.map(d => new Date(d).getTime()));
    set.depositStatus = 'VERIFYING';
    set['paymentPlan.verifySlaAt'] = new Date(earliest + VERIFY_SLA_HOURS * HOUR);
    return set;
  }
  set.depositStatus = 'UNPAID';
  set['paymentPlan.verifySlaAt'] = null;
  // Vừa đối soát xong mà bị từ chối / chưa đủ tiền: tự động cho thêm tối đa 12h để chuyển bù, 1 lần / đơn.
  if (depositStatus === 'VERIFYING' && !plan.graceUsed) {
    const graceUntil = new Date(now.getTime() + AUTO_GRACE_HOURS * HOUR);
    if (!plan.deadlineAt || new Date(plan.deadlineAt).getTime() < graceUntil.getTime()) {
      set['paymentPlan.deadlineAt'] = graceUntil;
      set['paymentPlan.graceUsed'] = true;
    }
  }
  return set;
}

/** Đơn cọc đã quá hạn trả cọc theo giờ server (hàm thuần). */
function isDepositExpired(order, now = new Date()) {
  return isDepositOrder(order)
    && order.status === 'PENDING'
    && order.depositStatus === 'UNPAID'
    && !!order.paymentPlan.deadlineAt
    && new Date(order.paymentPlan.deadlineAt).getTime() <= now.getTime();
}

/**
 * Lý do không được chuyển đơn sang sản xuất (null = được phép). Hàm thuần.
 * - Đơn đặt làm có cọc: phải xác nhận đủ cọc.
 * - Đơn thường có hàng in 3D theo quy tắc mới (paymentPolicyVersion >= 2): phải thanh toán đủ 100%.
 */
function productionBlockReason(order) {
  if (isDepositOrder(order)) {
    if (order.depositStatus !== 'PAID') {
      const left = Math.max(0, (order.paymentPlan.depositAmount || 0) - (order.depositReceived || 0));
      return `Chưa xác nhận đủ tiền cọc (còn thiếu ${left.toLocaleString('vi-VN')}đ) — chưa được bắt đầu sản xuất`;
    }
    if (order.paymentPlan.expiredWithFunds) return 'Đơn đã quá hạn cọc và đang chờ xử lý thủ công';
    return null;
  }
  if (order.hasPrintOnDemandItems && (order.paymentPolicyVersion || 1) >= 2) {
    if (order.paymentStatus !== 'PAID') return 'Đơn có hàng in 3D phải được xác nhận thanh toán đủ 100% trước khi sản xuất';
    // Giao dịch từ cổng thử (sandbox) không phải tiền thật — không cho sản xuất ở môi trường production.
    if (process.env.NODE_ENV === 'production' && String(order.paymentTransactionId || '').startsWith('SANDBOX-')) {
      return 'Thanh toán của đơn là giao dịch thử (sandbox), không phải tiền thật';
    }
  }
  return null;
}

/**
 * Tính lại trạng thái cọc từ sổ giao dịch. Gọi SAU mỗi thay đổi sổ (báo chuyển, xác nhận, từ chối).
 * Tăng ledgerRev trước rồi chỉ ghi nếu không có thay đổi nào mới hơn chen vào.
 */
async function refreshDepositState(orderNumber, now = new Date()) {
  const bumped = await Order.findOneAndUpdate(
    { orderNumber },
    { $inc: { 'paymentPlan.ledgerRev': 1 } },
    { new: true }
  );
  if (!bumped || !isDepositOrder(bumped)) return bumped;
  const rev = bumped.paymentPlan.ledgerRev;

  const txns = await PaymentTransaction.find({ orderNumber, purpose: 'DEPOSIT' }, { status: 1, receivedAmount: 1, reportedAt: 1 }).lean();
  const received = txns.filter(t => t.status === 'CONFIRMED').reduce((s, t) => s + (t.receivedAmount || 0), 0);
  const pendingReportedAts = txns.filter(t => t.status === 'REPORTED').map(t => t.reportedAt);
  const set = computeDepositState({
    plan: bumped.paymentPlan, depositStatus: bumped.depositStatus, received, pendingReportedAts, now,
  });
  // Đủ cọc và cọc đã bao gồm toàn bộ tiền phải trả (không còn phần còn lại) -> đơn coi như đã thanh toán.
  if (set.depositStatus === 'PAID' && received >= bumped.total && bumped.paymentStatus !== 'PAID') {
    set.paymentStatus = 'PAID';
  }
  const updated = await Order.findOneAndUpdate(
    { orderNumber, 'paymentPlan.ledgerRev': rev },
    { $set: set },
    { new: true }
  );
  // Có thay đổi mới hơn đã ghi trạng thái rồi -> trả bản mới nhất.
  return updated || Order.findOne({ orderNumber });
}

/**
 * Xử lý đơn cọc quá hạn: chưa nhận đồng nào -> tự huỷ; đã nhận một phần -> KHÔNG huỷ, đánh dấu
 * expiredWithFunds để nhân viên xử lý thủ công / hoàn tiền. Đang đối soát (VERIFYING) không bị đụng tới.
 * Trả về đơn sau xử lý (hoặc chính đơn đó nếu không hết hạn).
 */
async function settleDepositExpiry(order, now = new Date()) {
  if (!isDepositExpired(order, now)) return order;
  const base = {
    orderNumber: order.orderNumber,
    status: 'PENDING',
    depositStatus: 'UNPAID',
    'paymentPlan.deadlineAt': { $lte: now },
  };
  if ((order.depositReceived || 0) === 0) {
    const cancelled = await Order.findOneAndUpdate(
      { ...base, depositReceived: 0 },
      {
        $set: {
          status: 'CANCELLED',
          cancelReason: 'Tự động huỷ: quá hạn thanh toán tiền cọc',
          cancelledAt: now,
          'paymentPlan.expiredAt': now,
        },
      },
      { new: true }
    );
    if (cancelled) {
      // Yêu cầu đặt làm quay lại "đang trao đổi" để nhân viên gửi báo giá mới nếu khách vẫn muốn làm.
      await CustomRequest.updateOne(
        { id: cancelled.customRequestRef?.requestId, orderNumber: cancelled.orderNumber },
        { $set: { status: 'IN_DISCUSSION', orderNumber: null, acceptedQuoteId: null, updatedAt: now.toLocaleDateString('vi-VN') } }
      );
      return cancelled;
    }
  } else if (!order.paymentPlan.expiredWithFunds) {
    const flagged = await Order.findOneAndUpdate(
      { ...base, 'paymentPlan.expiredWithFunds': { $ne: true } },
      { $set: { 'paymentPlan.expiredWithFunds': true, 'paymentPlan.expiredAt': now } },
      { new: true }
    );
    if (flagged) return flagged;
  }
  return (await Order.findOne({ orderNumber: order.orderNumber })) || order;
}

/** Xử lý hết hạn cho 1 danh sách đơn (các trang danh sách gọi trước khi trả dữ liệu). */
async function settleExpiredInList(orders, now = new Date()) {
  const result = [];
  for (const order of orders) result.push(isDepositExpired(order, now) ? await settleDepositExpiry(order, now) : order);
  return result;
}

/** Quét định kỳ (khi server đang thức) — chỉ là bổ sung, mọi thao tác quan trọng đều tự kiểm tra hạn. */
async function sweepExpiredDeposits(now = new Date()) {
  const candidates = await Order.find({
    orderType: 'CUSTOM_QUOTE', status: 'PENDING', depositStatus: 'UNPAID', 'paymentPlan.deadlineAt': { $lte: now },
  }).limit(200);
  for (const order of candidates) await settleDepositExpiry(order, now);
  return candidates.length;
}

/** Sau khi sổ thay đổi: tính lại trạng thái; đơn đã huỷ mà vẫn có tiền về thì tạo yêu cầu hoàn tiền. */
async function afterLedgerChange(orderNumber) {
  const order = await refreshDepositState(orderNumber);
  if (order && order.status === 'CANCELLED' && (order.depositReceived || 0) > 0
    && (!order.refund || order.refund.status === 'VOID')) {
    order.refund = { ...buildRefund(order), amount: order.depositReceived, channel: 'Hoàn tiền cọc về tài khoản / ví khách đã thanh toán' };
    order.depositStatus = 'REFUND_PENDING';
    await order.save();
  }
  return order;
}

// ---------------------------------------------------------------- Trả cọc qua cổng MoMo / ZaloPay

const GATEWAY_LABELS = { MOMO: 'Ví MoMo', ATM: 'Thẻ ATM (qua MoMo)', ZALOPAY: 'ZaloPay' };

/**
 * Điều kiện mở 1 lượt trả cọc qua cổng. Trả về { error, status } hoặc { due }.
 * Số tiền = phần cọc còn thiếu, tính ở server.
 */
function depositGatewayCheck(order, now = new Date()) {
  if (!isDepositOrder(order)) return { status: 404, error: 'Không tìm thấy đơn đặt làm' };
  if (order.status !== 'PENDING') return { status: 400, error: order.status === 'CANCELLED' ? 'Đơn đã huỷ' : 'Đơn không còn chờ thanh toán cọc' };
  if (order.depositStatus === 'VERIFYING') return { status: 409, error: 'Bạn đã báo chuyển khoản, shop đang đối soát. Vui lòng chờ kết quả trước khi thanh toán thêm.' };
  if (order.depositStatus !== 'UNPAID') return { status: 400, error: 'Đơn không còn chờ thanh toán cọc' };
  if (!order.paymentPlan.deadlineAt || new Date(order.paymentPlan.deadlineAt).getTime() <= now.getTime()) {
    return { status: 400, error: 'Đã quá hạn thanh toán cọc của đơn này' };
  }
  const due = Math.max(0, order.paymentPlan.depositAmount - (order.depositReceived || 0));
  if (due <= 0) return { status: 400, error: 'Đơn đã đủ tiền cọc' };
  return { due };
}

/** Tạo dòng sổ "đang trả qua cổng" (INITIATED). */
function startGatewayDeposit({ order, gateway, gatewayRef, amount, userId, sandbox }) {
  return PaymentTransaction.create({
    orderNumber: order.orderNumber, purpose: 'DEPOSIT', status: 'INITIATED', source: 'GATEWAY',
    gateway, gatewayRef, expectedAmount: amount, sandbox: !!sandbox, reporterUserId: userId ? String(userId) : null,
    reportedAt: new Date(),
  });
}

/**
 * Cổng báo giao dịch THÀNH CÔNG (đã kiểm chữ ký ở route): tự động xác nhận khoản cọc, không cần nhân viên.
 * Idempotent: IPN và trang quay về cùng gọi vẫn chỉ cộng 1 lần (điều kiện INITIATED + unique bankTxnRef).
 * Số tiền phải khớp đúng số server đã yêu cầu cổng thu.
 * Trả về { order, txn, confirmed } hoặc null nếu gatewayRef không phải lượt trả cọc.
 */
async function confirmGatewayDeposit({ gatewayRef, amount, providerTxnId, sandbox = false }) {
  const txn = await PaymentTransaction.findOne({ gatewayRef });
  if (!txn) return null;
  if (txn.status === 'CONFIRMED') return { txn, order: await Order.findOne({ orderNumber: txn.orderNumber }), confirmed: true };
  if (Number(amount) !== txn.expectedAmount) {
    await PaymentTransaction.updateOne({ _id: txn._id, status: 'INITIATED' }, { $set: { status: 'FAILED', failReason: `Số tiền cổng báo (${amount}) không khớp số yêu cầu (${txn.expectedAmount})` } });
    console.error(`[deposit] số tiền không khớp ở ${gatewayRef}: ${amount} != ${txn.expectedAmount}`);
    return { txn, order: await Order.findOne({ orderNumber: txn.orderNumber }), confirmed: false };
  }
  let updated = null;
  try {
    updated = await PaymentTransaction.findOneAndUpdate(
      // Cho cả FAILED: khách huỷ ở trang thử rồi cổng thật vẫn báo thành công -> tiền đã về thì phải ghi nhận.
      { _id: txn._id, status: { $in: ['INITIATED', 'FAILED'] } },
      {
        $set: {
          status: 'CONFIRMED', receivedAmount: txn.expectedAmount, receivedAt: new Date(),
          bankTxnRef: PaymentTransaction.normalizeRef(`${txn.gateway}-${providerTxnId || gatewayRef}`),
          verifiedByName: `${GATEWAY_LABELS[txn.gateway] || txn.gateway} (tự động)`, verifiedAt: new Date(),
          sandbox: txn.sandbox || !!sandbox, failReason: '',
        },
      },
      { new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // mã giao dịch cổng đã được ghi nhận -> coi như đã xác nhận
  }
  const order = await afterLedgerChange(txn.orderNumber);
  return { txn: updated || txn, order, confirmed: true };
}

/** Cổng báo thất bại / khách huỷ: đánh dấu lượt trả FAILED (không đụng tới khoản đã xác nhận). */
async function failGatewayDeposit(gatewayRef, reason) {
  const txn = await PaymentTransaction.findOneAndUpdate(
    { gatewayRef, status: 'INITIATED' },
    { $set: { status: 'FAILED', failReason: String(reason || 'Giao dịch không thành công').slice(0, 200) } },
    { new: true }
  );
  return txn || PaymentTransaction.findOne({ gatewayRef });
}

/** Hướng dẫn thanh toán cọc cho khách — tính từ bản chụp trong đơn, không đọc cấu hình mới. */
function paymentInstructions(order) {
  const plan = order?.paymentPlan;
  if (!plan || plan.type !== 'DEPOSIT') return null;
  const due = Math.max(0, plan.depositAmount - (order.depositReceived || 0));
  return {
    bank: plan.bank,
    amount: due,
    depositAmount: plan.depositAmount,
    received: order.depositReceived || 0,
    transferContent: plan.transferContent,
    qrUrl: due > 0 ? vietQrImageUrl(plan.bank, due, plan.transferContent) : '',
    deadlineAt: plan.deadlineAt,
  };
}

module.exports = {
  REFUND_STATES,
  paymentInstructions,
  afterLedgerChange,
  depositGatewayCheck,
  startGatewayDeposit,
  confirmGatewayDeposit,
  failGatewayDeposit,
  isDepositOrder,
  computeDepositState,
  isDepositExpired,
  productionBlockReason,
  refreshDepositState,
  settleDepositExpiry,
  settleExpiredInList,
  sweepExpiredDeposits,
};
