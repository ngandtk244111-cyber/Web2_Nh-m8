// Quy định đặt cọc — khớp server/utils/deposit.js (sửa một bên thì sửa cả bên kia).
// Đơn COD từ 5.000.000đ phải chuyển khoản cọc trước 30% (làm tròn nghìn), phần còn lại trả khi nhận hàng.
export const DEPOSIT_THRESHOLD = 5_000_000;
export const DEPOSIT_RATE = 0.3;

/** Số tiền cọc bắt buộc (0 nếu không phải cọc). */
export function depositFor(total: number, paymentMethod: string): number {
  if (paymentMethod !== 'COD' || !(total >= DEPOSIT_THRESHOLD)) return 0;
  return Math.round((total * DEPOSIT_RATE) / 1000) * 1000;
}
