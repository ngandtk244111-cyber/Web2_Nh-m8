import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { exportXlsx } from '../../shared/utils/export';
import { CustomerFilter, CustomerSummary, buildCustomers, customerSuccessRate, matchesCustomerFilter, successRateClass } from './customer-summary';

const FILTERS: { key: CustomerFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tổng khách hàng', tone: '' },
  { key: 'LOYAL', label: 'Khách quen (≥ 2 đơn nhận)', tone: 'tone-success' },
  { key: 'NEW', label: 'Khách mới (1 đơn)', tone: 'tone-info' },
  { key: 'RISK', label: 'Từng giao thất bại', tone: 'tone-danger' },
  { key: 'ACCOUNT', label: 'Có tài khoản', tone: 'tone-neutral' },
];

/** Danh sách khách hàng — theo customermanage của Vita, dữ liệu gom từ đơn hàng thật. */
@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, MascotLoadingComponent, PagerComponent],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.css',
})
export class CustomerListComponent implements OnInit {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly filters = FILTERS;
  readonly successRate = customerSuccessRate;
  readonly rateClass = successRateClass;

  loading = signal(true);
  filter = signal<CustomerFilter>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;

  readonly customers = computed(() => buildCustomers(this.orderService.orders()));

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.customers().filter(c =>
      matchesCustomerFilter(c, this.filter()) &&
      (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    const f = this.route.snapshot.queryParamMap.get('filter') as CustomerFilter | null;
    if (f && FILTERS.some(x => x.key === f)) this.filter.set(f);
    this.reload();
  }

  reload(): void {
    this.loading.set(this.orderService.orders().length === 0);
    this.orderService.fetchAll().subscribe(() => this.loading.set(false));
  }

  count(f: CustomerFilter): number {
    return this.customers().filter(c => matchesCustomerFilter(c, f)).length;
  }

  setFilter(f: CustomerFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { filter: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  trackByPhone = (_: number, c: CustomerSummary) => c.phone;

  openCustomer(c: CustomerSummary): void {
    this.router.navigate(['/customers', c.phone]);
  }

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có khách hàng nào để xuất');
      return;
    }
    exportXlsx('lumea_khach_hang',
      ['Khách hàng', 'SĐT', 'Email', 'Khu vực', 'Tài khoản', 'Số đơn', 'Nhận thành công', 'Đã huỷ', 'Hoàn hàng', 'Tỉ lệ nhận (%)', 'Đã chi', 'Đơn gần nhất'],
      rows.map(c => [c.name, c.phone, c.email, c.city, c.hasAccount ? 'Có' : 'Không', c.orders.length, c.deliveredCount,
        c.cancelledCount, c.returnedCount, this.successRate(c) ?? '', c.totalSpend, new Date(c.lastOrderAt).toLocaleDateString('vi-VN')]),
      'Khách hàng');
    this.toast.success(`Đã xuất ${rows.length} khách hàng ra file Excel`);
  }
}
