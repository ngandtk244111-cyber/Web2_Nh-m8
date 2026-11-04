import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { Order, ReturnStatus } from '../../core/models/order.model';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';

type ReturnFilter = 'ALL' | ReturnStatus;

const FILTERS: { key: ReturnFilter; label: string; tone: string }[] = [
  { key: 'PENDING', label: 'Chờ duyệt', tone: 'tone-warning' },
  { key: 'APPROVED', label: 'Đang hoàn', tone: '' },
  { key: 'COMPLETED', label: 'Đã hoàn/trả', tone: 'tone-success' },
  { key: 'REJECTED', label: 'Từ chối', tone: 'tone-neutral' },
  { key: 'ALL', label: 'Tất cả', tone: '' },
];

const STATUS_LABELS: Record<ReturnStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đang hoàn',
  COMPLETED: 'Đã hoàn/trả',
  REJECTED: 'Từ chối',
};
const STATUS_CLASSES: Record<ReturnStatus, string> = {
  PENDING: 'status-yellow',
  APPROVED: 'status-blue',
  COMPLETED: 'status-green',
  REJECTED: 'status-red',
};

/** Yêu cầu trả hàng khách gửi trong 7 ngày sau khi nhận — duyệt, từ chối và xác nhận đã hoàn tiền. */
@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PagerComponent],
  templateUrl: './returns.component.html',
  styleUrl: './returns.component.css',
})
export class ReturnsComponent implements OnInit {
  private orderService = inject(OrderService);
  private adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly filters = FILTERS;
  readonly statusLabels = STATUS_LABELS;

  filter = signal<ReturnFilter>('PENDING');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;

  /** Đơn đang mở ô nhập lý do từ chối. */
  rejecting: string | null = null;
  rejectNote = '';
  busy: string | null = null;

  readonly returnOrders = computed(() =>
    this.orderService.orders()
      .filter(o => !!o.returnRequest)
      .sort((a, b) => +new Date(b.returnRequest!.requestedAt) - +new Date(a.returnRequest!.requestedAt))
  );

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.returnOrders().filter(o =>
      (this.filter() === 'ALL' || o.returnRequest!.status === this.filter()) &&
      (!q || o.orderNumber.toLowerCase().includes(q) || o.shippingAddress.fullName.toLowerCase().includes(q) ||
        o.shippingAddress.phone.includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    this.orderService.fetchAll().subscribe();
  }

  get canApprove(): boolean {
    return this.adminAuth.can('orders.approve');
  }

  count(f: ReturnFilter): number {
    return f === 'ALL' ? this.returnOrders().length : this.returnOrders().filter(o => o.returnRequest!.status === f).length;
  }

  setFilter(f: ReturnFilter): void {
    this.filter.set(f);
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  statusClass(status: ReturnStatus): string {
    return STATUS_CLASSES[status];
  }

  dateLabel(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  trackByNumber = (_: number, o: Order) => o.orderNumber;

  review(o: Order, action: 'approve' | 'reject' | 'complete'): void {
    const note = action === 'reject' ? this.rejectNote.trim() : '';
    if (action === 'reject' && !note) {
      this.toast.warning('Vui lòng nhập lý do từ chối');
      return;
    }
    const messages = {
      approve: `Đã duyệt trả hàng đơn ${o.orderNumber} — tiến hành nhận hàng & hoàn tiền`,
      reject: `Đã từ chối yêu cầu trả hàng đơn ${o.orderNumber}`,
      complete: `Đã xác nhận hoàn tiền đơn ${o.orderNumber}`,
    };
    this.busy = o.orderNumber;
    this.orderService.reviewReturn(o.orderNumber, action, note).subscribe({
      next: () => {
        this.busy = null;
        this.rejecting = null;
        this.rejectNote = '';
        this.toast.success(messages[action]);
        this.audit.record('Đổi Trả', messages[action], `Đơn ${o.orderNumber}`, 'SUCCESS');
      },
      error: err => {
        this.busy = null;
        this.toast.error(err?.error?.error || 'Không cập nhật được yêu cầu trả hàng');
      },
    });
  }
}
