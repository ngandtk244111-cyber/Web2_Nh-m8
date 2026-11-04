import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDataService } from '../../core/services/admin-data.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { DatePickerDirective } from '../../shared/directives/date-picker.directive';
import { exportXlsx } from '../../shared/utils/export';

/** Mã giảm giá như server trả về (couponRoutes toAdminCoupon). */
export interface AdminCoupon {
  code: string;
  description: string;
  discountPercent: number;
  maxDiscount: number;
  minSpend: number;
  limitCount: number;
  usedCount: number;
  endDate: string | null;
  active: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  createdAt?: string;
}

type CouponFilter = 'ALL' | AdminCoupon['status'];

const FILTERS: { key: CouponFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tổng mã giảm giá', tone: '' },
  { key: 'ACTIVE', label: 'Đang chạy', tone: 'tone-success' },
  { key: 'PAUSED', label: 'Tạm ngưng', tone: 'tone-warning' },
  { key: 'EXPIRED', label: 'Hết hạn / hết lượt', tone: 'tone-neutral' },
];

const STATUS_VIEW: Record<AdminCoupon['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Đang chạy', cls: 'status-green' },
  PAUSED: { label: 'Tạm ngưng', cls: 'status-yellow' },
  EXPIRED: { label: 'Hết hạn', cls: 'status-gray' },
};

const emptyForm = () => ({ code: '', description: '', discountPercent: 10, maxDiscount: 50000, minSpend: 200000, limitCount: 500, endDate: '' });

/** Khuyến mãi & voucher — theo promotionmanage của Vita: thẻ thống kê, bảng mã, modal tạo mã. */
@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule, VndPipe, MascotLoadingComponent, PagerComponent, DatePickerDirective],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.css',
})
export class PromotionsComponent implements OnInit {
  private adminData = inject(AdminDataService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly filters = FILTERS;
  readonly statusView = STATUS_VIEW;

  loading = signal(true);
  coupons = signal<AdminCoupon[]>([]);
  filter = signal<CouponFilter>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;

  showModal = false;
  saving = false;
  form = emptyForm();

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.coupons().filter(c =>
      (this.filter() === 'ALL' || c.status === this.filter()) &&
      (!q || c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.adminData.getCoupons().subscribe({
      next: res => {
        this.coupons.set(res.coupons || []);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.toast.apiError(err, 'Không tải được danh sách mã giảm giá');
      },
    });
  }

  count(f: CouponFilter): number {
    return f === 'ALL' ? this.coupons().length : this.coupons().filter(c => c.status === f).length;
  }

  setFilter(f: CouponFilter): void {
    this.filter.set(f);
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  usagePercent(c: AdminCoupon): number {
    return c.limitCount ? Math.min(100, Math.round((c.usedCount / c.limitCount) * 100)) : 0;
  }

  openCreate(): void {
    this.form = emptyForm();
    this.showModal = true;
  }

  save(): void {
    const code = this.form.code.toUpperCase().trim();
    if (!code) {
      this.toast.warning('Vui lòng nhập mã voucher');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      this.toast.warning('Mã chỉ gồm chữ không dấu, số, gạch ngang hoặc gạch dưới');
      return;
    }
    const percent = Number(this.form.discountPercent);
    if (!(percent > 0 && percent <= 100)) {
      this.toast.warning('Phần trăm giảm phải từ 1 đến 100');
      return;
    }
    this.saving = true;
    this.adminData.createCoupon({
      code,
      description: this.form.description.trim(),
      discountPercent: percent,
      maxDiscount: Number(this.form.maxDiscount) || 0,
      minSpend: Number(this.form.minSpend) || 0,
      limitCount: Number(this.form.limitCount) || 0,
      endDate: this.form.endDate || null,
    }).subscribe({
      next: res => {
        this.saving = false;
        this.coupons.update(list => [res.coupon, ...list]);
        this.showModal = false;
        this.toast.success(`Đã tạo mã khuyến mãi "${code}"`);
        this.audit.record('Khuyến Mãi', 'Tạo voucher mới', code, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không tạo được voucher (mã có thể đã tồn tại)');
      },
    });
  }

  toggle(c: AdminCoupon): void {
    this.adminData.setCouponActive(c.code, !c.active).subscribe({
      next: res => {
        this.coupons.update(list => list.map(x => x.code === c.code ? res.coupon : x));
        this.toast.info(`Mã ${c.code} đã ${res.coupon.active ? 'bật lại' : 'tạm ngưng'}`);
        this.audit.record('Khuyến Mãi', 'Đổi trạng thái voucher', `${c.code} -> ${res.coupon.status}`, 'INFO');
      },
      error: err => this.toast.apiError(err, 'Không đổi được trạng thái voucher'),
    });
  }

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có mã nào để xuất');
      return;
    }
    exportXlsx('lumea_khuyen_mai', ['Mã', 'Mô tả', '% giảm', 'Giảm tối đa', 'Đơn tối thiểu', 'Đã dùng', 'Giới hạn', 'Hết hạn', 'Trạng thái'],
      rows.map(c => [c.code, c.description, c.discountPercent, c.maxDiscount, c.minSpend, c.usedCount, c.limitCount,
        c.endDate ? new Date(c.endDate).toLocaleDateString('vi-VN') : 'Không giới hạn', STATUS_VIEW[c.status]?.label]), 'Khuyến mãi');
    this.toast.success(`Đã xuất ${rows.length} mã ra file Excel`);
  }
}
