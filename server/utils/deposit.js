// Quy định đặt cọc đơn COD giá trị lớn (nội thất cồng kềnh, giao xa — tránh bom hàng):
// đơn COD từ 5.000.000đ phải chuyển khoản cọc trước 30% (làm tròn nghìn), phần còn lại trả khi nhận.
// Đơn nhỏ hơn vẫn COD 100% như cũ. my-client (core/data/deposit-policy.ts) và chatbot dùng cùng số này.
const DEPOSIT_THRESHOLD = 5000000;
const DEPOSIT_RATE = 0.3;

/** Số tiền cọc bắt buộc của đơn COD (0 nếu không phải cọc). */
function depositFor(total, paymentMethod) {
  if (paymentMethod !== 'COD' || !(total >= DEPOSIT_THRESHOLD)) return 0;
  return Math.round((total * DEPOSIT_RATE) / 1000) * 1000;
}

/** Đơn còn chờ khách chuyển cọc (chưa được nhân viên xác nhận đã nhận cọc). */
function awaitingDeposit(order) {
  return (order.depositAmount || 0) > 0 && !order.depositPaidAt;
}

module.exports = { DEPOSIT_THRESHOLD, DEPOSIT_RATE, depositFor, awaitingDeposit };
