import { Order, OrderStatus, ProductionStep } from '../../core/models/order.model';

/** Nhãn + màu trạng thái đơn dùng chung cho danh sách, chi tiết, dashboard, khách hàng. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Chờ giao',
  IN_PRODUCTION: 'Đang in 3D',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  RETURNED: 'Hoàn hàng',
};

const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: 'status-yellow',
  CONFIRMED: 'status-blue',
  IN_PRODUCTION: 'status-purple',
  SHIPPED: 'status-blue',
  DELIVERED: 'status-green',
  CANCELLED: 'status-gray',
  RETURNED: 'status-red',
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function orderStatusClass(status: OrderStatus): string {
  return ORDER_STATUS_CLASSES[status] || 'status-gray';
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = { COD: 'COD', BANK_TRANSFER: 'Chuyển khoản', MOMO: 'MoMo', ZALOPAY: 'ZaloPay', VNPAY: 'VNPay', ATM: 'Thẻ ATM' };
  return labels[method] || method;
}

/** Nhãn thanh toán: đã trả / thất bại / khách báo đã chuyển khoản / chưa trả. */
export function paymentStatusLabel(o: Order): string {
  if (o.refund?.status === 'PENDING') return 'Chờ hoàn tiền';
  if (o.paymentStatus === 'REFUNDED') return 'Đã hoàn tiền';
  if (o.paymentStatus === 'PAID') return 'Đã thanh toán';
  if (o.paymentStatus === 'FAILED') return 'Thanh toán lỗi';
  if (o.status === 'CANCELLED' || o.status === 'RETURNED') return 'Không thu';
  if (o.paymentMethod === 'COD' && o.status === 'DELIVERED') return 'Chờ đối soát COD';
  if (o.transferReportedAt) return 'Khách báo đã CK';
  return o.paymentMethod === 'COD' ? 'Thu khi giao' : 'Chưa thanh toán';
}

export function paymentStatusClass(o: Order): string {
  if (o.refund?.status === 'PENDING') return 'status-red';
  if (o.paymentStatus === 'REFUNDED') return 'status-gray';
  if (o.paymentStatus === 'PAID') return 'status-green';
  if (o.paymentStatus === 'FAILED') return 'status-red';
  if (o.status === 'CANCELLED' || o.status === 'RETURNED') return 'status-gray';
  if (o.transferReportedAt || (o.paymentMethod === 'COD' && o.status === 'DELIVERED')) return 'status-blue';
  return 'status-yellow';
}

/** Ngày đặt dễ đọc — backend có sẵn createdAtLabel ("25/09/2026 18:34"). */
export function orderDateLabel(o: Order): string {
  if (o.createdAtLabel) return o.createdAtLabel;
  const d = new Date(o.createdAt);
  return isNaN(d.getTime()) ? o.createdAt : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function isOrderFinal(o: Order): boolean {
  return o.status === 'DELIVERED' || o.status === 'CANCELLED' || o.status === 'RETURNED';
}

/** Đơn tính doanh thu: bỏ đơn huỷ và đơn giao thất bại. */
export function isRevenueOrder(o: Order): boolean {
  return o.status !== 'CANCELLED' && o.status !== 'RETURNED';
}

export function orderItemName(o: Order): string {
  const first = o.items?.[0]?.product?.name || 'Sản phẩm Luméa';
  const more = (o.items?.length || 0) - 1;
  return more > 0 ? `${first} +${more} sản phẩm` : first;
}

export function orderItemQuantity(o: Order): number {
  return (o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
}

const STEP_ORDER: ProductionStep[] = ['FILE_PREPARATION', '3D_PRINTING', 'POST_PROCESSING', 'ASSEMBLY_TESTING', 'PACKAGING', 'DISPATCHED'];

/** Bước sản xuất đã đạt tới (để tô các bước đã xong). */
export function isProductionStepDone(o: Order, step: ProductionStep): boolean {
  const current = o.productionProgress?.currentStep;
  return !!current && STEP_ORDER.indexOf(current) >= STEP_ORDER.indexOf(step);
}

/** Đơn COD còn chờ gọi xác nhận (khớp server/utils/cod-policy.js: COD nhỏ không cần gọi). */
export function needsPhoneConfirm(o: Order): boolean {
  return o.paymentMethod === 'COD' && o.phoneConfirmRequired !== false && !o.phoneConfirmedAt;
}

/** Đơn đã sẵn sàng tạo vận đơn: (COD) đã gọi xác nhận, và đơn in 3D đã tới bước Đóng gói. */
export function canShip(o: Order): boolean {
  if (needsPhoneConfirm(o)) return false;
  if (o.status === 'CONFIRMED') return true;
  return o.status === 'IN_PRODUCTION' && isProductionStepDone(o, 'PACKAGING');
}

export function normalizePhone(phone: string | undefined | null): string {
  return (phone || '').replace(/\s+/g, '');
}

export function slugify(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function nowLabel(): string {
  const now = new Date();
  return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
