import { Order } from '../../core/models/order.model';
import { isOrderFinal, normalizePhone } from '../../shared/utils/order-labels';

/** Khách hàng tổng hợp từ đơn hàng thật (gom theo SĐT) — không có hạng thành viên giả. */
export interface CustomerSummary {
  phone: string;
  name: string;
  email: string;
  city: string;
  address: string;
  hasAccount: boolean;
  orders: Order[];
  deliveredCount: number;
  returnedCount: number;
  cancelledCount: number;
  openCount: number;
  totalSpend: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export type CustomerFilter = 'ALL' | 'LOYAL' | 'NEW' | 'RISK' | 'ACCOUNT';

/** Gom đơn theo SĐT người nhận: mỗi SĐT là 1 khách, tên/email/địa chỉ lấy theo đơn gần nhất. */
export function buildCustomers(orders: Order[]): CustomerSummary[] {
  const byPhone = new Map<string, Order[]>();
  for (const o of orders) {
    const phone = normalizePhone(o.shippingAddress?.phone);
    if (!phone) continue;
    byPhone.set(phone, [...(byPhone.get(phone) || []), o]);
  }
  return [...byPhone.entries()].map(([phone, list]) => {
    const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = sorted[0];
    const delivered = list.filter(o => o.status === 'DELIVERED');
    const a = latest.shippingAddress;
    return {
      phone,
      name: a.fullName,
      email: a.email || '',
      city: a.city,
      address: [a.street, a.district, a.city].filter(Boolean).join(', '),
      hasAccount: list.some(o => !!o.userId),
      orders: sorted,
      deliveredCount: delivered.length,
      returnedCount: list.filter(o => o.status === 'RETURNED').length,
      cancelledCount: list.filter(o => o.status === 'CANCELLED').length,
      openCount: list.filter(o => !isOrderFinal(o)).length,
      totalSpend: delivered.reduce((sum, o) => sum + o.total, 0),
      firstOrderAt: sorted[sorted.length - 1].createdAt,
      lastOrderAt: latest.createdAt,
    };
  }).sort((x, y) => new Date(y.lastOrderAt).getTime() - new Date(x.lastOrderAt).getTime());
}

export function matchesCustomerFilter(c: CustomerSummary, filter: CustomerFilter): boolean {
  switch (filter) {
    case 'LOYAL': return c.deliveredCount >= 2;
    case 'NEW': return c.orders.length === 1;
    case 'RISK': return c.returnedCount > 0;
    case 'ACCOUNT': return c.hasAccount;
    default: return true;
  }
}

/** Tỉ lệ nhận hàng thành công trên các đơn đã có kết quả giao — dùng đánh giá rủi ro COD. */
export function customerSuccessRate(c: CustomerSummary): number | null {
  const finished = c.deliveredCount + c.returnedCount;
  return finished ? Math.round((c.deliveredCount / finished) * 100) : null;
}

export function successRateClass(c: CustomerSummary): string {
  const rate = customerSuccessRate(c);
  if (rate === null) return 'status-gray';
  return rate >= 80 ? 'status-green' : rate >= 50 ? 'status-yellow' : 'status-red';
}
