import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrderService } from '../../../core/services/order.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Order, ReturnStatus } from '../../../core/models/order.model';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';

/** Số món hiện sẵn trên mỗi thẻ; còn lại bấm "Xem thêm". */
const PREVIEW_ITEMS = 2;

const STATUS_LABELS: Record<ReturnStatus, string> = {
  PENDING: 'Đang xử lý trả hàng/hoàn tiền',
  APPROVED: 'Đang hoàn',
  COMPLETED: 'Đã hoàn/trả',
  REJECTED: 'Từ chối hoàn/trả',
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  MOMO: 'Ví MoMo',
  ZALOPAY: 'ZaloPay',
  ATM: 'Thẻ ATM nội địa',
};

/**
 * Quản lý đổi trả (tham khảo trang Quản lý đổi trả của VitaCare):
 * danh sách đơn có yêu cầu trả hàng, chia tab theo trạng thái; nút thay đổi theo từng bước.
 * Yêu cầu được gửi từ tab "Đơn hàng" (nút "Trả hàng" ở đơn đã giao).
 */
@Component({
  selector: 'app-account-returns-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './returns-tab.component.html',
  styleUrl: './returns-tab.component.css',
})
export class ReturnsTabComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly orderService = inject(OrderService);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  readonly statusOrder: ReturnStatus[] = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'];
  readonly statusLabels = STATUS_LABELS;

  loading = false;
  readonly tab = signal<ReturnStatus>('PENDING');
  readonly search = signal('');
  private readonly orders = signal<Order[]>([]);
  private readonly expanded = signal<Set<string>>(new Set());

  readonly counts = computed(() => {
    const c: Record<ReturnStatus, number> = { PENDING: 0, APPROVED: 0, COMPLETED: 0, REJECTED: 0 };
    for (const o of this.orders()) c[o.returnRequest!.status]++;
    return c;
  });

  readonly list = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.orders().filter(o => {
      if (o.returnRequest!.status !== this.tab()) return false;
      if (!q) return true;
      return o.orderNumber.toLowerCase().includes(q) || o.items.some(i => i.product.name.toLowerCase().includes(q));
    });
  });

  /* ---------- Modal ---------- */
  detail: Order | null = null;
  confirm: { kind: 'cancel' | 'received'; order: Order } | null = null;
  busy = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.orderService.fetchMine().subscribe(orders => {
      const withReturn = orders
        .filter(o => !!o.returnRequest)
        .sort((a, b) => +new Date(b.returnRequest!.requestedAt) - +new Date(a.returnRequest!.requestedAt));
      this.orders.set(withReturn);
      this.loading = false;
      // Mở tab đầu tiên đang có yêu cầu để khách thấy ngay.
      if (!this.counts()[this.tab()]) {
        const first = this.statusOrder.find(s => this.counts()[s] > 0);
        if (first) this.tab.set(first);
      }
    });
  }

  setTab(status: ReturnStatus): void {
    this.tab.set(status);
  }

  /* ---------- Thẻ đơn ---------- */
  visibleItems(o: Order) {
    return this.expanded().has(o.orderNumber) ? o.items : o.items.slice(0, PREVIEW_ITEMS);
  }

  hasMore(o: Order): boolean {
    return o.items.length > PREVIEW_ITEMS;
  }

  isExpanded(o: Order): boolean {
    return this.expanded().has(o.orderNumber);
  }

  toggleExpand(o: Order): void {
    const next = new Set(this.expanded());
    if (next.has(o.orderNumber)) next.delete(o.orderNumber);
    else next.add(o.orderNumber);
    this.expanded.set(next);
  }

  totalQuantity(o: Order): number {
    return o.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  image(item: Order['items'][number]): string {
    return (item.product.images && item.product.images[0]) || 'assets/mascot/goh-search.png';
  }

  formatDate(value?: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${this.formatDate(value)}`;
  }

  paymentLabel(method: string): string {
    return PAYMENT_LABELS[method] || method;
  }

  /* ---------- Hành động ---------- */
  openDetail(o: Order): void {
    this.detail = o;
  }

  askCancel(o: Order): void {
    this.confirm = { kind: 'cancel', order: o };
  }

  askReceived(o: Order): void {
    this.confirm = { kind: 'received', order: o };
  }

  closeConfirm(): void {
    if (!this.busy) this.confirm = null;
  }

  runConfirm(): void {
    const userId = this.auth.currentUser()?._id;
    if (!this.confirm || !userId || this.busy) return;
    const { kind, order } = this.confirm;
    const request = kind === 'cancel'
      ? this.orderService.cancelReturn(order.orderNumber, userId)
      : this.orderService.confirmReturnReceived(order.orderNumber, userId);
    this.busy = true;
    request.subscribe({
      next: () => {
        this.busy = false;
        this.confirm = null;
        this.detail = null;
        this.toast.success(kind === 'cancel' ? 'Đã huỷ yêu cầu trả hàng' : 'Đã hoàn tất đổi trả. Cảm ơn bạn!');
        this.load();
      },
      error: err => {
        this.busy = false;
        this.toast.error(err?.error?.error || 'Không thực hiện được, vui lòng thử lại');
      },
    });
  }

  /** Mua lại toàn bộ món trong đơn: thêm vào giỏ rồi mở giỏ hàng. */
  buyAgain(o: Order): void {
    let added = 0;
    for (const item of o.items) {
      const product = this.productService.getProductById(item.product.id);
      if (product && this.cartService.addToCart(product, item.quantity)) added++;
    }
    if (added) this.router.navigate(['/cart']);
    else this.toast.error('Sản phẩm trong đơn hiện không còn bán');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm) this.closeConfirm();
    else this.detail = null;
  }
}
