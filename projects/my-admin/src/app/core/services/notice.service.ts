import { Injectable, computed, inject } from '@angular/core';
import { AdminAuthService } from './admin-auth.service';
import { OrderService } from './order.service';
import { ChatService } from './chat.service';
import { CustomRequestService } from './custom-request.service';
import { ReviewService } from './review.service';
import { CommunityService } from './community.service';
import { ProductService } from './product.service';
import { WarrantyService } from './warranty.service';

/** Hàng có sẵn: ≤ 5 cái = sắp hết (đỏ), ≤ 20 cái = còn ít (vàng), trên 20 = còn nhiều (xanh). */
export const LOW_STOCK_THRESHOLD = 5;
export const MEDIUM_STOCK_THRESHOLD = 20;

export interface AdminNotice {
  label: string;
  count: number;
  /** Route mở khi bấm, kèm query lọc sẵn đúng nhóm đang đếm. */
  link: string;
  query?: Record<string, string>;
  icon: string;
}

/** Chuông thông báo trên topbar (pattern notice/ của Vita): các việc đang cần xử lý, tính từ dữ liệu thật. */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  private adminAuth = inject(AdminAuthService);
  private orders = inject(OrderService);
  private chat = inject(ChatService);
  private customRequests = inject(CustomRequestService);
  private reviews = inject(ReviewService);
  private community = inject(CommunityService);
  private products = inject(ProductService);
  private warranty = inject(WarrantyService);

  /** Tải dữ liệu nguồn theo quyền của tài khoản — gọi 1 lần khi vào layout. */
  loadSources(): void {
    const can = (rule: string) => this.adminAuth.can(rule);
    if (can('orders.view') || can('customers.view') || can('inventory.view')) this.orders.fetchAll().subscribe();
    if (can('orders.view')) this.warranty.refresh();
    if (can('customers.view')) {
      this.reviews.refresh();
      this.chat.connect();
    }
    if (can('content.view')) this.community.refresh();
  }

  readonly notices = computed<AdminNotice[]>(() => {
    const can = (rule: string) => this.adminAuth.can(rule);
    const products = this.products.products().filter(p => p.productionType === 'READY_STOCK');
    const outOfStock = products.filter(p => (p.inStock ?? 0) <= 0).length;
    const list: (AdminNotice & { perm: string })[] = [
      { perm: 'orders.view', label: 'Đơn COD chờ gọi xác nhận', count: this.orders.orders().filter(o => o.status === 'PENDING').length, link: '/orders', query: { status: 'PENDING' }, icon: 'bi-telephone' },
      { perm: 'orders.view', label: 'Khách báo đã chuyển khoản', count: this.orders.orders().filter(o => o.transferReportedAt && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED').length, link: '/orders', query: { status: 'TRANSFER' }, icon: 'bi-bank' },
      { perm: 'customers.view', label: 'Tin nhắn chưa đọc', count: this.chat.totalUnread(), link: '/messages', icon: 'bi-chat-dots' },
      { perm: 'custom3d.view', label: 'Yêu cầu in 3D chờ báo giá', count: this.customRequests.requests().filter(r => r.status === 'PENDING_REVIEW').length, link: '/custom-requests', query: { status: 'PENDING_REVIEW' }, icon: 'bi-printer' },
      { perm: 'orders.view', label: 'Yêu cầu bảo hành chờ xử lý', count: this.warranty.warranties().filter(w => w.status === 'CLAIMED').length, link: '/warranty', query: { status: 'CLAIMED' }, icon: 'bi-shield-exclamation' },
      { perm: 'customers.view', label: 'Đánh giá xấu chưa phản hồi', count: this.reviews.reviews().filter(r => r.status !== 'HIDDEN' && r.rating <= 2 && !r.reply?.text).length, link: '/reviews', icon: 'bi-star-half' },
      { perm: 'content.view', label: 'Bài cộng đồng bị chặn cần xem', count: this.community.posts().filter(p => p.status === 'REJECTED').length, link: '/community', query: { filter: 'REJECTED' }, icon: 'bi-camera' },
      { perm: 'inventory.view', label: 'Sản phẩm hết hoặc sắp hết hàng', count: products.filter(p => (p.inStock ?? 0) <= LOW_STOCK_THRESHOLD).length, link: '/inventory', query: { status: outOfStock ? 'OUT' : 'LOW' }, icon: 'bi-archive' },
    ];
    return list.filter(n => n.count > 0 && can(n.perm));
  });

  readonly total = computed(() => this.notices().reduce((sum, n) => sum + n.count, 0));
}
