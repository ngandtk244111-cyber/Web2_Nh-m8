import { Order } from '../models/order.model';

/**
 * Chính sách hoàn tiền khi huỷ đơn đã trả trước — thời hạn tính theo ngày làm việc (không tính T7, CN).
 * Giữ khớp với REFUND_POLICY ở server/utils/refund-policy.js
 */
export const REFUND_POLICY: Record<string, { days: number; channel: string }> = {
  MOMO: { days: 3, channel: 'Hoàn về ví MoMo đã dùng để thanh toán' },
  ZALOPAY: { days: 3, channel: 'Hoàn về ví ZaloPay đã dùng để thanh toán' },
  ATM: { days: 7, channel: 'Hoàn về thẻ ATM / tài khoản ngân hàng đã dùng để thanh toán' },
  BANK_TRANSFER: { days: 5, channel: 'Chuyển khoản về tài khoản ngân hàng bạn cung cấp' },
};

/** Đơn đã trả trước (hoặc đã báo chuyển khoản) thì huỷ sẽ được hoàn tiền. */
export function orderNeedsRefund(order: Order): boolean {
  return order.paymentMethod !== 'COD' && (order.paymentStatus === 'PAID' || !!order.transferReportedAt);
}
