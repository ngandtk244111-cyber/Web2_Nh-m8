import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { Order } from '../../core/models/order.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { DatePickerDirective } from '../../shared/directives/date-picker.directive';
import { exportXlsx } from '../../shared/utils/export';
import {
  orderDateLabel, orderItemName, orderItemQuantity, orderStatusClass, orderStatusLabel,
  paymentMethodLabel, paymentStatusClass, paymentStatusLabel,
} from '../../shared/utils/order-labels';

/** Nhóm của thẻ thống kê; TRANSFER = khách báo đã chuyển khoản, CLOSED = huỷ + hoàn hàng. */
export type OrderFilter = 'ALL' | 'PENDING' | 'TRANSFER' | 'CONFIRMED' | 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED' | 'CLOSED';

const FILTERS: { key: OrderFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tổng đơn hàng', tone: '' },
  { key: 'PENDING', label: 'Chờ gọi xác nhận', tone: 'tone-warning' },
  { key: 'TRANSFER', label: 'Khách báo đã CK', tone: 'tone-info' },
  { key: 'CONFIRMED', label: 'Chờ giao', tone: 'tone-info' },
  { key: 'IN_PRODUCTION', label: 'Đang in 3D', tone: 'tone-warning' },
  { key: 'SHIPPED', label: 'Đang giao', tone: 'tone-info' },
  { key: 'DELIVERED', label: 'Hoàn thành', tone: 'tone-success' },
  { key: 'CLOSED', label: 'Huỷ / hoàn hàng', tone: 'tone-danger' },
];

function matchesFilter(o: Order, f: OrderFilter): boolean {
  switch (f) {
    case 'ALL': return true;
    case 'TRANSFER': return !!o.transferReportedAt && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED';
    case 'CLOSED': return o.status === 'CANCELLED' || o.status === 'RETURNED';
    default: return o.status === f;
  }
}

/** Danh sách đơn hàng — theo ordermanage của Vita: thẻ thống kê lọc nhanh, thanh lọc, bảng bấm vào xem chi tiết. */
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, MascotLoadingComponent, PagerComponent, DatePickerDirective],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css',
})
export class OrderListComponent implements OnInit {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly filters = FILTERS;
  readonly statusLabel = orderStatusLabel;
  readonly statusClass = orderStatusClass;
  readonly payLabel = paymentStatusLabel;
  readonly payClass = paymentStatusClass;
  readonly methodLabel = paymentMethodLabel;
  readonly dateLabel = orderDateLabel;
  readonly itemName = orderItemName;
  readonly itemQty = orderItemQuantity;

  loading = signal(true);
  filter = signal<OrderFilter>('ALL');
  search = signal('');
  method = signal('ALL');
  fromDate = signal('');
  toDate = signal('');
  page = signal(1);
  readonly pageSize = 20;

  readonly orders = this.orderService.orders;

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const method = this.method();
    const from = this.fromDate() ? new Date(this.fromDate() + 'T00:00:00').getTime() : null;
    const to = this.toDate() ? new Date(this.toDate() + 'T23:59:59').getTime() : null;
    return this.orders().filter(o => {
      const time = new Date(o.createdAt).getTime();
      return matchesFilter(o, this.filter()) &&
        (method === 'ALL' || o.paymentMethod === method) &&
        (from === null || time >= from) &&
        (to === null || time <= to) &&
        (!q || o.orderNumber.toLowerCase().includes(q) ||
          (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
          (o.shippingAddress?.phone || '').includes(q));
    });
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    // Thẻ thông báo / dashboard mở trang kèm ?status=PENDING
    const status = this.route.snapshot.queryParamMap.get('status') as OrderFilter | null;
    if (status && FILTERS.some(f => f.key === status)) this.filter.set(status);
    this.reload();
  }

  reload(): void {
    this.loading.set(this.orders().length === 0);
    this.orderService.fetchAll().subscribe(() => this.loading.set(false));
  }

  count(f: OrderFilter): number {
    return this.orders().filter(o => matchesFilter(o, f)).length;
  }

  setFilter(f: OrderFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { status: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  get activeExtraFilters(): number {
    return (this.method() !== 'ALL' ? 1 : 0) + (this.fromDate() ? 1 : 0) + (this.toDate() ? 1 : 0);
  }

  clearFilters(): void {
    this.method.set('ALL');
    this.fromDate.set('');
    this.toDate.set('');
    this.search.set('');
    this.page.set(1);
  }

  trackByNumber = (_: number, o: Order) => o.orderNumber;

  openOrder(o: Order): void {
    this.router.navigate(['/orders', o.orderNumber]);
  }

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có đơn nào để xuất');
      return;
    }
    exportXlsx('lumea_don_hang',
      ['Mã đơn', 'Ngày đặt', 'Khách hàng', 'SĐT', 'Tỉnh/TP', 'Sản phẩm', 'Số lượng', 'Tổng tiền', 'Thanh toán', 'Trạng thái thanh toán', 'Trạng thái đơn'],
      rows.map(o => [o.orderNumber, this.dateLabel(o), o.shippingAddress?.fullName, o.shippingAddress?.phone, o.shippingAddress?.city,
        this.itemName(o), this.itemQty(o), o.total, this.methodLabel(o.paymentMethod), this.payLabel(o), this.statusLabel(o.status)]),
      'Đơn hàng');
    this.toast.success(`Đã xuất ${rows.length} đơn ra file Excel`);
  }
}
