import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { Product } from '../../core/models/product.model';
import { LOW_STOCK_THRESHOLD } from '../../core/services/notice.service';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { exportXlsx } from '../../shared/utils/export';
import { environment } from '../../../environments/environment';
import { PRODUCT_CATEGORY_SECTIONS, productionTypeLabel } from './product-options';

export type ProductFilter = 'ALL' | 'READY' | 'POD' | 'CUSTOMIZABLE' | 'LOW';

const FILTERS: { key: ProductFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tất cả sản phẩm', tone: '' },
  { key: 'READY', label: 'Hàng có sẵn', tone: 'tone-info' },
  { key: 'POD', label: 'In 3D theo yêu cầu', tone: 'tone-warning' },
  { key: 'CUSTOMIZABLE', label: 'Cho tuỳ biến', tone: 'tone-success' },
  { key: 'LOW', label: 'Hết / sắp hết hàng', tone: 'tone-danger' },
];

function matchesFilter(p: Product, f: ProductFilter): boolean {
  switch (f) {
    case 'READY': return p.productionType === 'READY_STOCK';
    case 'POD': return p.productionType === 'PRINT_ON_DEMAND';
    case 'CUSTOMIZABLE': return !!p.customizable;
    case 'LOW': return p.productionType === 'READY_STOCK' && (p.inStock ?? 0) <= LOW_STOCK_THRESHOLD;
    default: return true;
  }
}

/** Danh sách sản phẩm — theo productmanage của Vita: thẻ thống kê lọc nhanh, lọc danh mục, bảng + thao tác từng dòng. */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, PagerComponent, MascotLoadingComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  readonly adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly filters = FILTERS;
  readonly sections = PRODUCT_CATEGORY_SECTIONS;
  readonly typeLabel = productionTypeLabel;
  readonly lowStock = LOW_STOCK_THRESHOLD;
  readonly clientAppUrl = environment.clientAppUrl;

  readonly products = this.productService.products;
  filter = signal<ProductFilter>('ALL');
  category = signal('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const cat = this.category();
    return this.products().filter(p =>
      matchesFilter(p, this.filter()) &&
      (cat === 'ALL' || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q) || (p.categoryName || '').toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    const f = this.route.snapshot.queryParamMap.get('filter') as ProductFilter | null;
    if (f && FILTERS.some(x => x.key === f)) this.filter.set(f);
    this.productService.refresh();
  }

  count(f: ProductFilter): number {
    return this.products().filter(p => matchesFilter(p, f)).length;
  }

  setFilter(f: ProductFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { filter: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  clearFilters(): void {
    this.search.set('');
    this.category.set('ALL');
    this.page.set(1);
  }

  trackById = (_: number, p: Product) => p.id;

  stockClass(p: Product): string {
    if (p.productionType !== 'READY_STOCK') return 'status-gray';
    if ((p.inStock ?? 0) <= 0) return 'status-red';
    return p.inStock <= LOW_STOCK_THRESHOLD ? 'status-yellow' : 'status-green';
  }

  openEdit(p: Product): void {
    this.router.navigate(['/products/edit', p.id]);
  }

  async remove(p: Product): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá sản phẩm?',
      message: `"${p.name}" sẽ bị gỡ khỏi cửa hàng. Thao tác này không hoàn tác được.`,
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.productService.deleteProduct(p.id).subscribe({
      next: () => {
        this.toast.info(`Đã xoá sản phẩm "${p.name}"`);
        this.audit.record('Sản Phẩm', 'Xóa sản phẩm', `Xóa ${p.name} (ID: ${p.id})`, 'WARNING');
      },
      error: err => this.toast.apiError(err, 'Không xoá được sản phẩm'),
    });
  }

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có sản phẩm nào để xuất');
      return;
    }
    exportXlsx('lumea_san_pham',
      ['Mã', 'Tên sản phẩm', 'Danh mục', 'Loại sản xuất', 'Tuỳ biến', 'Giá bán', 'Giá gốc', 'Tồn kho', 'Đánh giá', 'Số đánh giá'],
      rows.map(p => [p.id, p.name, p.categoryName, this.typeLabel(p.productionType), p.customizable ? 'Có' : 'Không',
        p.basePrice, p.originalPrice ?? '', p.inStock, p.rating, p.reviewCount]),
      'Sản phẩm');
    this.toast.success(`Đã xuất ${rows.length} sản phẩm ra file Excel`);
  }
}
