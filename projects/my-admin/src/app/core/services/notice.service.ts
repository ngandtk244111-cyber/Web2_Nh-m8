import { Injectable, computed, inject } from '@angular/core';
import { AdminAuthService } from './admin-auth.service';
import { OrderService } from './order.service';
import { ChatService } from './chat.service';
import { CustomRequestService } from './custom-request.service';
import { ReviewService } from './review.service';
import { CommunityService } from './community.service';
import { ProductService } from './product.service';
import { WarrantyService } from './warranty.service';
import { ToastService } from './toast.service';
import { NewsService } from './news.service';

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
  private toast = inject(ToastService);
  private news = inject(NewsService);

  constructor() {
    this.chat.customRequestChanged$.subscribe(event => {
      if (!this.adminAuth.can('custom3d.view')) return;
      this.customRequests.refresh();
      if (event.customerMessage) this.toast.info('Tin nhắn thiết kế mới · ' + event.requestCode);
    });
    // Đánh giá mới: tải lại danh sách để chuông cập nhật số, và báo ngay cho nhân viên đang mở admin.
    this.chat.newReview$.subscribe(r => {
      this.reviews.refresh();
      this.toast.info(`Đánh giá mới ${r.rating}★ của ${r.author} cho "${r.productName}"`);
    });
    // Yêu cầu bảo hành mới: cập nhật số trên chuông và báo nhân viên đang mở admin.
    this.chat.warrantyChanged$.subscribe(() => { if (this.adminAuth.can('orders.view')) this.warranty.refresh(); });
    this.chat.newWarrantyClaim$.subscribe(c => {
      if (!this.adminAuth.can('orders.view')) return;
      this.warranty.refresh();
      this.toast.info(`Yêu cầu bảo hành mới · ${c.warrantyCode} — ${c.productName} (${c.customerName})`);
    });
    // Bình luận / tim dưới bài Tin tức do shop đăng — chỉ nhân viên nội dung mới được báo.
    this.chat.newNewsComment$.subscribe(c => {
      if (!this.adminAuth.can('content.view')) return;
      this.news.refreshComments();
      this.toast.info(`${c.author} vừa bình luận bài "${c.articleTitle}": ${c.text}`);
    });
    this.chat.newsCommentLiked$.subscribe(l => {
      if (!this.adminAuth.can('content.view')) return;
      this.toast.info(`Có người vừa thích câu trả lời của shop trong bài "${l.articleTitle}" (${l.likesCount} lượt thích)`);
    });
  }

  /** Tải dữ liệu nguồn theo quyền của tài khoản — gọi 1 lần khi vào layout. */
  loadSources(): void {
    const can = (rule: string) => this.adminAuth.can(rule);
    if (can('orders.view') || can('customers.view') || can('inventory.view')) this.orders.fetchAll().subscribe();
    if (can('orders.view')) { this.warranty.refresh(); this.chat.connect(); }
    if (can('custom3d.view')) { this.customRequests.refresh(); this.chat.connect(); }
    if (can('customers.view')) {
      this.reviews.refresh();
      this.chat.connect();
    }
    if (can('content.view')) {
      this.community.refresh();
      this.news.refreshComments();
      // Cần socket để nhận báo bình luận Tin tức realtime (kể cả tài khoản không xem tin nhắn khách).
      this.chat.connect();
    }
  }

  readonly notices = computed<AdminNotice[]>(() => {
    const can = (rule: string) => this.adminAuth.can(rule);
    const products = this.products.products().filter(p => p.productionType === 'READY_STOCK');
    const outOfStock = products.filter(p => (p.inStock ?? 0) <= 0).length;
    const list: (AdminNotice & { perm: string })[] = [
      { perm: 'orders.view', label: 'Trả hàng / hoàn tiền', count: this.orders.orders().filter(o => o.returnRequest?.status === 'PENDING' || o.returnRequest?.status === 'APPROVED' || o.refund?.status === 'PENDING').length, link: '/returns', icon: 'bi-arrow-counterclockwise' },
      { perm: 'orders.view', label: 'Đơn COD chờ gọi xác nhận', count: this.orders.orders().filter(o => o.status === 'PENDING').length, link: '/orders', query: { status: 'PENDING' }, icon: 'bi-telephone' },
      { perm: 'orders.view', label: 'Đơn COD lớn chờ nhận cọc', count: this.orders.orders().filter(o => o.status === 'PENDING' && (o.depositAmount || 0) > 0 && !o.depositPaidAt).length, link: '/orders', query: { status: 'PENDING' }, icon: 'bi-piggy-bank' },
      { perm: 'orders.view', label: 'Khách báo đã chuyển khoản', count: this.orders.orders().filter(o => o.transferReportedAt && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED').length, link: '/orders', query: { status: 'TRANSFER' }, icon: 'bi-bank' },
      { perm: 'customers.view|custom3d.view', label: 'Tin nhắn chưa đọc', count: this.chat.totalUnread() + (can('custom3d.view') ? this.customRequests.unreadCount() : 0), link: '/messages', icon: 'bi-chat-dots' },
      { perm: 'custom3d.view', label: 'Yêu cầu in 3D chờ báo giá', count: this.customRequests.requests().filter(r => r.status === 'PENDING_REVIEW').length, link: '/custom-requests', query: { status: 'PENDING_REVIEW' }, icon: 'bi-printer' },
      { perm: 'orders.view', label: 'Bảo hành chờ tiếp nhận', count: this.warranty.warranties().filter(w => w.status === 'CLAIMED').length, link: '/warranty', query: { status: 'CLAIMED' }, icon: 'bi-shield-exclamation' },
      { perm: 'orders.view', label: 'Bảo hành đang xử lý', count: this.warranty.warranties().filter(w => w.status === 'PROCESSING').length, link: '/warranty', query: { status: 'PROCESSING' }, icon: 'bi-shield-check' },
      { perm: 'customers.view', label: 'Đánh giá mới chưa phản hồi', count: this.reviews.reviews().filter(r => r.status !== 'HIDDEN' && r.rating > 2 && !r.reply?.text).length, link: '/reviews', query: { filter: 'UNREPLIED' }, icon: 'bi-star' },
      { perm: 'customers.view', label: 'Đánh giá xấu chưa phản hồi', count: this.reviews.reviews().filter(r => r.status !== 'HIDDEN' && r.rating <= 2 && !r.reply?.text).length, link: '/reviews', query: { filter: 'NEEDS_ACTION' }, icon: 'bi-star-half' },
      { perm: 'content.view', label: 'Bình luận Tin tức chưa trả lời', count: this.news.unrepliedCount(), link: '/news-comments', query: { filter: 'UNREPLIED' }, icon: 'bi-chat-left-text' },
      { perm: 'content.view', label: 'Bài cộng đồng bị chặn cần xem', count: this.community.posts().filter(p => p.status === 'REJECTED').length, link: '/community', query: { filter: 'REJECTED' }, icon: 'bi-camera' },
      { perm: 'inventory.view', label: 'Sản phẩm hết hoặc sắp hết hàng', count: products.filter(p => (p.inStock ?? 0) <= LOW_STOCK_THRESHOLD).length, link: '/inventory', query: { status: outOfStock ? 'OUT' : 'LOW' }, icon: 'bi-archive' },
    ];
    return list.filter(n => n.count > 0 && can(n.perm));
  });

  readonly groups = computed(() => [
    { label: 'Bảo hành', tone: 'warranty', links: ['/warranty'] },
    { label: 'Đơn hàng & thanh toán', tone: 'orders', links: ['/orders', '/returns'] },
    { label: 'Thiết kế & tin nhắn', tone: 'design', links: ['/custom-requests', '/messages'] },
    { label: 'Đánh giá & nội dung', tone: 'content', links: ['/reviews', '/news-comments', '/community'] },
    { label: 'Kho hàng', tone: 'stock', links: ['/inventory'] },
  ].map(group => ({ ...group, items: this.notices().filter(n => group.links.includes(n.link)) })).filter(group => group.items.length));

  readonly total = computed(() => this.notices().reduce((sum, n) => sum + n.count, 0));
}
