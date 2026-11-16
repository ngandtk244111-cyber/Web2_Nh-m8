import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WarrantyService, Warranty, ClaimResult } from '../../core/services/warranty.service';
import { OrderService } from '../../core/services/order.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { exportXlsx } from '../../shared/utils/export';
import { Order } from '../../core/models/order.model';
import { CartItem } from '../../core/models/cart.model';
import { environment } from '../../../environments/environment';

type WarrantyState = 'ACTIVE' | 'CLAIMED' | 'PROCESSING' | 'EXPIRED';
type WarrantyFilter = 'ALL' | WarrantyState;

const FILTERS: { key: WarrantyFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tổng phiếu', tone: '' },
  { key: 'ACTIVE', label: 'Còn hiệu lực', tone: 'tone-success' },
  { key: 'CLAIMED', label: 'Yêu cầu chờ tiếp nhận', tone: 'tone-warning' },
  { key: 'PROCESSING', label: 'Đang xử lý', tone: 'tone-info' },
  { key: 'EXPIRED', label: 'Hết hạn', tone: 'tone-neutral' },
];

const STATE_LABELS: Record<WarrantyState, string> = { ACTIVE: 'Còn hiệu lực', CLAIMED: 'Chờ tiếp nhận', PROCESSING: 'Đang xử lý', EXPIRED: 'Hết hạn' };
const STATE_CLASSES: Record<WarrantyState, string> = { ACTIVE: 'status-green', CLAIMED: 'status-yellow', PROCESSING: 'status-blue', EXPIRED: 'status-gray' };

/** Kết quả khi đóng yêu cầu — khớp phạm vi trong Chính sách bảo hành. */
export const CLAIM_RESULTS: { key: ClaimResult; label: string }[] = [
  { key: 'REPAIR', label: 'Sửa chữa' },
  { key: 'REPRINT', label: 'In lại' },
  { key: 'REPLACE', label: 'Đổi mới' },
  { key: 'REJECTED', label: 'Không bảo hành' },
];
/** Lý do không bảo hành (Chính sách bảo hành mục 2). */
const REJECT_REASONS = [
  'Hư hỏng do va đập, rơi vỡ',
  'Tiếp xúc nhiệt độ cao hoặc hoá chất',
  'Đã tự ý sửa chữa, thay đổi sản phẩm',
  'Hư hỏng do vận chuyển — xử lý theo Chính sách đổi trả',
];

const emptyForm = () => ({ orderNumber: '', warrantyMonths: 12 });

/** Phiếu bảo hành theo đơn hàng và yêu cầu bảo hành khách gửi từ cửa hàng. */
@Component({
  selector: 'app-warranty',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PagerComponent],
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
  private destroyRef = inject(DestroyRef);

  readonly filters = FILTERS;
  readonly claimResults = CLAIM_RESULTS;
  readonly rejectReasons = REJECT_REASONS;
  /** Ảnh khách gửi lưu dạng /api/products/images/<id> — ghép với địa chỉ server. */
  readonly apiOrigin = environment.apiUrl.replace(/\/api$/, '');

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
  /** Đơn tìm được theo mã nhập vào; formError = lý do không cấp được (không có đơn / chưa giao). */
  formOrder: Order | null = null;
  formError = '';
  /** id các món được chọn để cấp phiếu. */
  selectedItems = new Set<string>();

  detail: Warranty | null = null;
  resolving: Warranty | null = null;
  resolveResult: ClaimResult = 'REPAIR';
  resolveNote = '';
  processing: Warranty | null = null;
  processNote = '';

  // Trong popup chi tiết
  noteDraft = '';
  extendMonths = 6;
  extendReason = '';
  readonly extendOptions = [1, 3, 6, 12, 24];

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const status = params.get('status') as WarrantyFilter;
      this.filter.set(FILTERS.some(f => f.key === status) ? status : 'ALL');
      this.page.set(1);
    });
    this.warrantyService.refresh();
    // Cần danh sách đơn để tự điền phiếu theo mã đơn.
    if (this.orderService.orders().length === 0) this.orderService.fetchAll().subscribe();
  }

  get canEdit(): boolean {
    return this.adminAuth.can('orders.edit');
  }

  /** Phiếu ACTIVE đã qua hạn vẫn lưu ACTIVE trên server đến khi khách tra cứu — tính lại theo ngày. */
  state(w: Warranty): WarrantyState {
    if (w.status === 'CLAIMED' || w.status === 'PROCESSING') return w.status;
    return w.status === 'EXPIRED' || new Date(w.expiresAt) < this.today ? 'EXPIRED' : 'ACTIVE';
  }

  stateLabel(w: Warranty): string {
    return STATE_LABELS[this.state(w)];
  }

  stateClass(w: Warranty): string {
    return STATE_CLASSES[this.state(w)];
  }

  /** Lần khách gửi yêu cầu gần nhất (dòng cũ chưa ghi người viết thì lấy dòng cuối). */
  lastClaim(w: Warranty) {
    const history = w.claimHistory || [];
    return [...history].reverse().find(h => h.by === 'CUSTOMER') || history[history.length - 1];
  }

  lastNote(w: Warranty): string {
    return this.lastClaim(w)?.note || '';
  }

  resultLabel(result?: ClaimResult | null): string {
    return CLAIM_RESULTS.find(r => r.key === result)?.label || '';
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

  // ---- Popup chi tiết ----
  openDetail(w: Warranty): void {
    this.detail = w;
    this.noteDraft = '';
    this.extendMonths = 6;
    this.extendReason = '';
  }

  /** Số ngày còn bảo hành (âm = đã hết hạn bấy nhiêu ngày). */
  daysLeft(w: Warranty): number {
    const DAY = 24 * 3600 * 1000;
    return Math.ceil((new Date(w.expiresAt).getTime() - this.today.getTime()) / DAY);
  }

  /** Phần trăm thời hạn bảo hành đã dùng — vẽ thanh tiến độ. */
  usedPercent(w: Warranty): number {
    const start = new Date(w.purchasedAt).getTime();
    const end = new Date(w.expiresAt).getTime();
    if (!(end > start)) return 100;
    return Math.min(100, Math.max(0, Math.round(((this.today.getTime() - start) / (end - start)) * 100)));
  }

  orderOf(w: Warranty): Order | undefined {
    return this.orderService.orders().find(o => o.orderNumber === w.orderNumber);
  }

  /** Món trong đơn được ghi trên phiếu (so theo tên sản phẩm). */
  isCoveredItem(w: Warranty, item: CartItem): boolean {
    return !!item.product?.name && w.productName.toLowerCase().includes(item.product.name.toLowerCase());
  }

  addNote(): void {
    const w = this.detail;
    const note = this.noteDraft.trim();
    if (!w || !note || this.saving) return;
    this.saving = true;
    this.warrantyService.addNote(w.warrantyCode, note).subscribe({
      next: updated => {
        this.saving = false;
        this.detail = updated;
        this.noteDraft = '';
        this.toast.success('Đã thêm ghi chú');
        this.audit.record('Bảo Hành', 'Thêm ghi chú phiếu bảo hành', `${w.warrantyCode}: ${note}`, 'INFO');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không thêm được ghi chú');
      },
    });
  }

  extend(): void {
    const w = this.detail;
    const months = Number(this.extendMonths);
    if (!w || this.saving) return;
    if (!Number.isInteger(months) || months <= 0) {
      this.toast.warning('Chọn số tháng gia hạn');
      return;
    }
    this.saving = true;
    this.warrantyService.extend(w.warrantyCode, months, this.extendReason.trim()).subscribe({
      next: updated => {
        this.saving = false;
        this.detail = updated;
        this.extendReason = '';
        this.toast.success(`Đã gia hạn phiếu ${w.warrantyCode} thêm ${months} tháng`);
        this.audit.record('Bảo Hành', 'Gia hạn phiếu bảo hành', `${w.warrantyCode}: +${months} tháng`, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không gia hạn được phiếu');
      },
    });
  }

  // ---- Cấp phiếu từ đơn ----
  openCreate(): void {
    this.form = emptyForm();
    this.formOrder = null;
    this.formError = '';
    this.selectedItems = new Set();
    this.showCreate = true;
  }

  /** Tìm đơn theo mã: chỉ đơn đã giao mới cấp phiếu; tự chọn sẵn các món chưa có phiếu. */
  findOrder(): void {
    const code = this.form.orderNumber.trim().toUpperCase();
    this.formOrder = null;
    this.selectedItems = new Set();
    this.formError = '';
    if (!code) return;
    const order = this.orderService.orders().find(o => o.orderNumber.toUpperCase() === code);
    if (!order) {
      this.formError = 'Không tìm thấy đơn hàng với mã này.';
      return;
    }
    this.formOrder = order;
    if (order.status !== 'DELIVERED') {
      this.formError = 'Đơn chưa giao thành công — phiếu bảo hành chỉ cấp sau khi khách đã nhận hàng.';
      return;
    }
    for (const item of order.items) if (!this.itemWarranty(item.id)) this.selectedItems.add(item.id);
    if (!this.selectedItems.size) this.formError = 'Tất cả sản phẩm trong đơn đã có phiếu bảo hành.';
  }

  /** Mã phiếu đã cấp cho món này (ghi trên đơn hoặc có trong danh sách phiếu). */
  itemWarranty(itemId: string): string {
    const item = this.formOrder?.items.find(i => i.id === itemId) as (Order['items'][number] & { warrantyCode?: string }) | undefined;
    return item?.warrantyCode
      || this.warranties().find(w => w.orderNumber === this.formOrder?.orderNumber && (w as Warranty & { itemId?: string }).itemId === itemId)?.warrantyCode
      || '';
  }

  toggleItem(itemId: string): void {
    const next = new Set(this.selectedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    this.selectedItems = next;
  }

  saveWarranty(): void {
    const order = this.formOrder;
    if (!order || order.status !== 'DELIVERED' || !this.selectedItems.size) return;
    const months = Number(this.form.warrantyMonths);
    if (!Number.isInteger(months) || months <= 0 || months > 60) {
      this.toast.warning('Thời hạn bảo hành từ 1 đến 60 tháng');
      return;
    }
    this.saving = true;
    this.warrantyService.issueForOrder(order.orderNumber, [...this.selectedItems], months).subscribe({
      next: list => {
        this.saving = false;
        this.showCreate = false;
        this.toast.success(`Đã cấp ${list.length} phiếu bảo hành cho đơn ${order.orderNumber}`);
        this.audit.record('Bảo Hành', 'Cấp phiếu bảo hành', `Đơn ${order.orderNumber}: ${list.map(w => w.warrantyCode).join(', ')}`, 'SUCCESS');
        // Đơn trong bộ nhớ chưa có mã phiếu mới -> tải lại để lần mở sau thấy đúng.
        this.orderService.fetchAll().subscribe();
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không cấp được phiếu bảo hành');
      },
    });
  }

  // ---- Tiếp nhận yêu cầu ----
  openProcess(w: Warranty): void {
    this.detail = null;
    this.processing = w;
    this.processNote = 'Luméa đã tiếp nhận yêu cầu và sẽ liên hệ với bạn qua số điện thoại đặt hàng.';
  }

  confirmProcess(): void {
    const w = this.processing;
    if (!w) return;
    this.saving = true;
    this.warrantyService.process(w.warrantyCode, this.processNote.trim()).subscribe({
      next: () => {
        this.saving = false;
        this.processing = null;
        this.toast.success(`Đã tiếp nhận yêu cầu của phiếu ${w.warrantyCode}`);
        this.audit.record('Bảo Hành', 'Tiếp nhận yêu cầu bảo hành', w.warrantyCode, 'INFO');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không tiếp nhận được yêu cầu');
      },
    });
  }

  // ---- Đóng yêu cầu ----
  openResolve(w: Warranty): void {
    this.detail = null;
    this.resolving = w;
    this.resolveResult = 'REPAIR';
    this.resolveNote = '';
  }

  confirmResolve(): void {
    const w = this.resolving;
    const note = this.resolveNote.trim();
    if (!w || (this.resolveResult === 'REJECTED' && !note)) return;
    const result = this.resolveResult;
    this.saving = true;
    this.warrantyService.resolve(w.warrantyCode, result, note).subscribe({
      next: () => {
        this.saving = false;
        this.resolving = null;
        this.toast.success(`Đã đóng yêu cầu của phiếu ${w.warrantyCode}`);
        this.audit.record('Bảo Hành', 'Đóng yêu cầu bảo hành', `${w.warrantyCode}: ${this.resultLabel(result)}${note ? ' — ' + note : ''}`, 'INFO');
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
