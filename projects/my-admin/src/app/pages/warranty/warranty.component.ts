import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WarrantyService, Warranty } from '../../core/services/warranty.service';
import { OrderService } from '../../core/services/order.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { DatePickerDirective } from '../../shared/directives/date-picker.directive';
import { exportXlsx } from '../../shared/utils/export';
import { orderItemName } from '../../shared/utils/order-labels';

type WarrantyState = 'ACTIVE' | 'CLAIMED' | 'EXPIRED';
type WarrantyFilter = 'ALL' | WarrantyState;

const FILTERS: { key: WarrantyFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tổng phiếu', tone: '' },
  { key: 'ACTIVE', label: 'Còn hiệu lực', tone: 'tone-success' },
  { key: 'CLAIMED', label: 'Yêu cầu chờ xử lý', tone: 'tone-warning' },
  { key: 'EXPIRED', label: 'Hết hạn', tone: 'tone-neutral' },
];

const STATE_LABELS: Record<WarrantyState, string> = { ACTIVE: 'Còn hiệu lực', CLAIMED: 'Đang xử lý yêu cầu', EXPIRED: 'Hết hạn' };
const STATE_CLASSES: Record<WarrantyState, string> = { ACTIVE: 'status-green', CLAIMED: 'status-yellow', EXPIRED: 'status-gray' };

const emptyForm = () => ({ orderNumber: '', productName: '', customerName: '', customerPhone: '', purchasedAt: '', warrantyMonths: 12 });

/** Phiếu bảo hành theo đơn hàng và yêu cầu bảo hành khách gửi từ cửa hàng. */
@Component({
  selector: 'app-warranty',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PagerComponent, DatePickerDirective],
  templateUrl: './warranty.component.html',
  styleUrl: './warranty.component.css',
})
export class WarrantyComponent implements OnInit {
  private warrantyService = inject(WarrantyService);
  private orderService = inject(OrderService);
  private adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly filters = FILTERS;

  filter = signal<WarrantyFilter>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;

  readonly warranties = this.warrantyService.warranties;
  private readonly today = new Date();

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.warranties().filter(w =>
      (this.filter() === 'ALL' || this.state(w) === this.filter()) &&
      (!q || w.warrantyCode.toLowerCase().includes(q) || w.orderNumber.toLowerCase().includes(q) ||
        w.customerName.toLowerCase().includes(q) || w.customerPhone.includes(q) || w.productName.toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  showCreate = false;
  form = emptyForm();
  saving = false;
  formOrderFound = false;

  detail: Warranty | null = null;
  resolving: Warranty | null = null;
  resolveNote = '';

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('status') as WarrantyFilter | null;
    if (status && FILTERS.some(f => f.key === status)) this.filter.set(status);
    this.warrantyService.refresh();
    // Cần danh sách đơn để tự điền phiếu theo mã đơn.
    if (this.orderService.orders().length === 0) this.orderService.fetchAll().subscribe();
  }

  get canEdit(): boolean {
    return this.adminAuth.can('orders.edit');
  }

  /** Phiếu ACTIVE đã qua hạn vẫn lưu ACTIVE trên server đến khi khách tra cứu — tính lại theo ngày. */
  state(w: Warranty): WarrantyState {
    if (w.status === 'CLAIMED') return 'CLAIMED';
    return w.status === 'EXPIRED' || new Date(w.expiresAt) < this.today ? 'EXPIRED' : 'ACTIVE';
  }

  stateLabel(w: Warranty): string {
    return STATE_LABELS[this.state(w)];
  }

  stateClass(w: Warranty): string {
    return STATE_CLASSES[this.state(w)];
  }

  lastNote(w: Warranty): string {
    return w.claimHistory?.[w.claimHistory.length - 1]?.note || '';
  }

  count(f: WarrantyFilter): number {
    return f === 'ALL' ? this.warranties().length : this.warranties().filter(w => this.state(w) === f).length;
  }

  setFilter(f: WarrantyFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { status: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  trackByCode = (_: number, w: Warranty) => w.warrantyCode;

  // ---- Tạo phiếu ----
  openCreate(): void {
    this.form = emptyForm();
    this.formOrderFound = false;
    this.showCreate = true;
  }

  /** Nhập đúng mã đơn thì tự điền thông tin khách, sản phẩm và ngày mua (ngày giao nếu có). */
  fillFromOrder(): void {
    const code = this.form.orderNumber.trim().toUpperCase();
    const order = this.orderService.orders().find(o => o.orderNumber.toUpperCase() === code);
    this.formOrderFound = !!order;
    if (!order) return;
    this.form.orderNumber = order.orderNumber;
    this.form.productName = orderItemName(order);
    this.form.customerName = order.shippingAddress?.fullName || '';
    this.form.customerPhone = order.shippingAddress?.phone || '';
    this.form.purchasedAt = (order.deliveredAt || order.createdAt || '').slice(0, 10);
  }

  saveWarranty(): void {
    const f = this.form;
    if (!f.orderNumber.trim() || !f.productName.trim() || !f.customerName.trim() || !f.customerPhone.trim()) {
      this.toast.warning('Vui lòng nhập đủ mã đơn, sản phẩm, tên và SĐT khách');
      return;
    }
    const months = Number(f.warrantyMonths);
    if (!Number.isInteger(months) || months <= 0) {
      this.toast.warning('Thời hạn bảo hành phải là số tháng nguyên dương');
      return;
    }
    this.saving = true;
    this.warrantyService.create({
      orderNumber: f.orderNumber.trim(),
      productName: f.productName.trim(),
      customerName: f.customerName.trim(),
      customerPhone: f.customerPhone.trim(),
      purchasedAt: f.purchasedAt || undefined,
      warrantyMonths: months,
    }).subscribe({
      next: w => {
        this.saving = false;
        this.showCreate = false;
        this.toast.success(`Đã tạo phiếu bảo hành ${w.warrantyCode}`);
        this.audit.record('Bảo Hành', 'Tạo phiếu bảo hành', `${w.warrantyCode} - đơn ${w.orderNumber}`, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không tạo được phiếu bảo hành');
      },
    });
  }

  // ---- Đóng yêu cầu ----
  openResolve(w: Warranty): void {
    this.detail = null;
    this.resolving = w;
    this.resolveNote = 'Đã xử lý yêu cầu bảo hành';
  }

  confirmResolve(): void {
    const w = this.resolving;
    const note = this.resolveNote.trim();
    if (!w || !note) return;
    this.saving = true;
    this.warrantyService.resolve(w.warrantyCode, note).subscribe({
      next: () => {
        this.saving = false;
        this.resolving = null;
        this.toast.success(`Đã đóng yêu cầu của phiếu ${w.warrantyCode}`);
        this.audit.record('Bảo Hành', 'Đóng yêu cầu bảo hành', `${w.warrantyCode}: ${note}`, 'INFO');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không đóng được yêu cầu');
      },
    });
  }

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có phiếu nào để xuất');
      return;
    }
    const d = (v: string) => (v ? new Date(v).toLocaleDateString('vi-VN') : '');
    exportXlsx('lumea_bao_hanh',
      ['Mã phiếu', 'Mã đơn', 'Sản phẩm', 'Khách hàng', 'SĐT', 'Ngày mua', 'Số tháng', 'Hết hạn', 'Trạng thái', 'Ghi chú gần nhất'],
      rows.map(w => [w.warrantyCode, w.orderNumber, w.productName, w.customerName, w.customerPhone, d(w.purchasedAt),
        w.warrantyMonths, d(w.expiresAt), this.stateLabel(w), this.lastNote(w)]),
      'Bảo hành');
    this.toast.success(`Đã xuất ${rows.length} phiếu ra file Excel`);
  }
}
