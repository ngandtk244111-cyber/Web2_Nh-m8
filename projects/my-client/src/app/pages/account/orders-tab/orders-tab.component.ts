import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService, invoiceUrl } from '../../../core/services/order.service';
import { Order, OrderStatus, RETURN_REASONS, RETURN_WINDOW_DAYS } from '../../../core/models/order.model';
import { ToastService } from '../../../core/services/toast.service';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { AuthService } from '../../../core/services/auth.service';

type StatusTab = 'ALL' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-account-orders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, AppIconComponent],
  templateUrl: './orders-tab.component.html',
  styleUrl: './orders-tab.component.css'
})
export class OrdersTabComponent implements OnInit {
  orders: Order[] = [];
  loading = false;
  searchQuery = '';
  statusTab: StatusTab = 'ALL';

  readonly statusTabs: { id: StatusTab; label: string }[] = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'PROCESSING', label: 'Đang xử lý' },
    { id: 'SHIPPED', label: 'Đang giao' },
    { id: 'DELIVERED', label: 'Đã giao' },
    { id: 'CANCELLED', label: 'Đã hủy' },
  ];

  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Báo trang Tài khoản chuyển sang tab "Đổi trả". */
  @Output() openReturns = new EventEmitter<void>();

  /* ---------- Yêu cầu trả hàng ---------- */
  readonly returnReasons = RETURN_REASONS;
  returnOrder: Order | null = null;
  returnReason = '';
  returnDescription = '';
  returnExpanded = false;
  returnSubmitting = false;

  /** Hạn cuối trả hàng: 7 ngày kể từ khi giao thành công. */
  private returnDeadline(order: Order): number {
    const delivered = order.deliveredAt || order.updatedAt || order.createdAt;
    return new Date(delivered).getTime() + RETURN_WINDOW_DAYS * 86400000;
  }

  canRequestReturn(order: Order): boolean {
    return order.status === 'DELIVERED' && !order.returnRequest && this.returnDeadline(order) > Date.now();
  }

  returnDaysLeft(order: Order): number {
    return Math.max(1, Math.ceil((this.returnDeadline(order) - Date.now()) / 86400000));
  }

  returnStatusLabel(order: Order): string {
    const map = { PENDING: 'Đang xử lý', APPROVED: 'Đang hoàn', COMPLETED: 'Đã hoàn/trả', REJECTED: 'Bị từ chối' };
    return order.returnRequest ? map[order.returnRequest.status] : '';
  }

  get canSubmitReturn(): boolean {
    return !!this.returnReason && (this.returnReason !== 'Khác' || !!this.returnDescription.trim());
  }

  openReturn(order: Order, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.returnOrder = order;
    this.returnReason = '';
    this.returnDescription = '';
    this.returnExpanded = false;
  }

  closeReturn(): void {
    if (!this.returnSubmitting) this.returnOrder = null;
  }

  submitReturn(): void {
    const userId = this.authService.currentUser()?._id;
    if (!this.returnOrder || !userId || !this.canSubmitReturn || this.returnSubmitting) return;
    this.returnSubmitting = true;
    this.orderService.requestReturn(this.returnOrder.orderNumber, userId, this.returnReason, this.returnDescription.trim()).subscribe({
      next: updated => {
        this.returnSubmitting = false;
        this.returnOrder = null;
        this.orders = this.orders.map(o => o.orderNumber === updated.orderNumber ? updated : o);
        this.toast.success('Đã gửi yêu cầu trả hàng. Luméa sẽ phản hồi trong 1-2 ngày làm việc.');
      },
      error: err => {
        this.returnSubmitting = false;
        this.toast.error(err?.error?.error || 'Không gửi được yêu cầu, vui lòng thử lại');
      },
    });
  }

  goReturns(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openReturns.emit();
  }

  constructor(private orderService: OrderService) {}

  /** Thẻ đơn là 1 link tới trang theo dõi -> nút hoá đơn chặn link đó và mở PDF ở tab mới. */
  openInvoice(orderNumber: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    window.open(invoiceUrl(orderNumber, this.authService.token), '_blank', 'noopener');
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.fetchMine().subscribe(orders => {
      this.orders = orders;
      this.loading = false;
    });
  }

  setStatusTab(tab: StatusTab): void {
    this.statusTab = tab;
  }

  private matchesStatusTab(status: OrderStatus): boolean {
    if (this.statusTab === 'ALL') return true;
    if (this.statusTab === 'PROCESSING') return ['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(status);
    if (this.statusTab === 'CANCELLED') return status === 'CANCELLED' || status === 'RETURNED';
    return this.statusTab === status;
  }

  get filteredOrders(): Order[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.orders.filter(o => {
      if (!this.matchesStatusTab(o.status)) return false;
      if (!q) return true;
      return o.orderNumber.toLowerCase().includes(q) ||
        o.items.some(i => i.product.name.toLowerCase().includes(q));
    });
  }

  statusLabel(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      IN_PRODUCTION: 'Đang sản xuất',
      SHIPPED: 'Đang giao',
      DELIVERED: 'Đã giao',
      CANCELLED: 'Đã hủy',
      RETURNED: 'Giao không thành công',
    };
    return map[status] || status;
  }

  statusClass(status: OrderStatus): string {
    if (status === 'DELIVERED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (status === 'SHIPPED') return 'bg-[#5b9bf0]/15 text-[#5b9bf0] border-[#5b9bf0]/30';
    if (status === 'CANCELLED' || status === 'RETURNED') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  }
}
