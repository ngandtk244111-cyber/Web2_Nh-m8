import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { LOW_STOCK_THRESHOLD } from '../../core/services/notice.service';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { exportXlsx } from '../../shared/utils/export';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { WorkshopReceiptService } from '../../core/services/workshop-receipt.service';
import { Workshop, workshopFor } from '../../core/data/workshops';

type StockStatus = 'SAFE' | 'LOW' | 'OUT';
type StockFilter = 'ALL' | StockStatus;

interface InventoryItem {
  id: string;
  name: string;
  image: string;
  category: string;
  currentStock: number;
  soldCount: number;
  status: StockStatus;
  /** Xưởng phụ trách (tự gán hoặc chọn riêng) — điền sẵn khi nhập hàng từ xưởng. */
  workshopId: string;
  workshop: string;
}

const STATUS_LABELS: Record<StockStatus, string> = { SAFE: 'An toàn', LOW: 'Sắp hết', OUT: 'Hết hàng' };
const STATUS_CLASSES: Record<StockStatus, string> = { SAFE: 'status-green', LOW: 'status-yellow', OUT: 'status-red' };

/** Tồn kho hàng có sẵn: tồn = inStock, đã bán = tổng số lượng trong đơn không huỷ/hoàn. */
@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PagerComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
})
export class InventoryComponent implements OnInit {
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  readonly adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private config = inject(AdminConfigService);
  private receipts = inject(WorkshopReceiptService);

  readonly threshold = LOW_STOCK_THRESHOLD;
  readonly statusLabels = STATUS_LABELS;
  readonly statusClasses = STATUS_CLASSES;

  filter = signal<StockFilter>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;

  readonly items = computed<InventoryItem[]>(() => {
    const sold = new Map<string, number>();
    for (const order of this.orderService.orders()) {
      if (order.status === 'CANCELLED' || order.status === 'RETURNED') continue;
      for (const item of order.items || []) {
        const id = item.product?.id;
        if (id) sold.set(id, (sold.get(id) || 0) + item.quantity);
      }
    }
    const workshops = this.config.get<Workshop[]>('workshops') || [];
    return this.productService.products()
      .filter(p => p.productionType === 'READY_STOCK')
      .map(p => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0] || '',
        category: p.categoryName,
        currentStock: p.inStock ?? 0,
        soldCount: sold.get(p.id) || 0,
        workshopId: workshopFor(p, workshops)?.id || '',
        workshop: workshopFor(p, workshops)?.name || '—',
        status: (p.inStock ?? 0) <= 0 ? 'OUT' : p.inStock <= LOW_STOCK_THRESHOLD ? 'LOW' : 'SAFE',
      } as InventoryItem))
      // Hết hàng / sắp hết lên đầu để thấy việc cần nhập trước
      .sort((a, b) => a.currentStock - b.currentStock);
  });

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.items().filter(i =>
      (this.filter() === 'ALL' || i.status === this.filter()) &&
      (!q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  // Modal điều chỉnh tồn
  adjusting: InventoryItem | null = null;
  adjustMode: 'IN' | 'OUT' = 'IN';
  adjustQty = 10;
  adjustReason = '';
  /** Nhập kho: hàng xưởng giao (ghi lịch sử giao nhận) hay lý do khác (trả hàng, kiểm kê). */
  inSource: 'WORKSHOP' | 'OTHER' = 'WORKSHOP';
  adjustWorkshopId = '';
  adjustNote = '';
  saving = signal(false);
  readonly inReasons = ['Khách trả hàng nhập lại kho', 'Kiểm kê: thừa so với hệ thống'];
  readonly activeWorkshops = computed(() => (this.config.get<Workshop[]>('workshops') || []).filter(w => w.active !== false));

  /** Nhập từ xưởng gọi API kho riêng (cần quyền kho), không dùng quyền sửa sản phẩm. */
  get canReceiveFromWorkshop(): boolean {
    return this.adminAuth.can('inventory.edit');
  }

  get fromWorkshop(): boolean {
    return this.adjustMode === 'IN' && this.inSource === 'WORKSHOP';
  }
  readonly outReasons = ['Hàng lỗi / hư hỏng', 'Xuất trưng bày showroom', 'Kiểm kê: thiếu so với hệ thống', 'Xuất tặng / quà khuyến mãi'];

  ngOnInit(): void {
    // Chuông thông báo / dashboard mở kèm ?status=LOW (gồm cả hết hàng) hoặc ?status=OUT
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status === 'LOW' || status === 'OUT' || status === 'SAFE') this.filter.set(status);
    this.productService.refresh();
    if (!this.orderService.orders().length) this.orderService.fetchAll().subscribe();
    this.config.load();
  }

  get canEdit(): boolean {
    return this.adminAuth.can('inventory.edit') || this.adminAuth.can('products.edit');
  }

  count(f: StockFilter): number {
    return f === 'ALL' ? this.items().length : this.items().filter(i => i.status === f).length;
  }

  setFilter(f: StockFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { status: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  openAdjust(item: InventoryItem, mode: 'IN' | 'OUT' = 'IN'): void {
    this.adjusting = item;
    this.setMode(mode);
  }

  setMode(mode: 'IN' | 'OUT'): void {
    this.adjustMode = mode;
    this.adjustQty = mode === 'IN' ? 10 : 1;
    this.adjustReason = mode === 'IN' ? this.inReasons[0] : this.outReasons[0];
    this.inSource = this.canReceiveFromWorkshop ? 'WORKSHOP' : 'OTHER';
    this.adjustWorkshopId = this.adjusting?.workshopId || this.activeWorkshops()[0]?.id || '';
    this.adjustNote = '';
  }

  get adjustResult(): number | null {
    const qty = Number(this.adjustQty);
    if (!this.adjusting || !Number.isInteger(qty) || qty <= 0) return null;
    return this.adjusting.currentStock + (this.adjustMode === 'IN' ? qty : -qty);
  }

  submitAdjust(): void {
    const item = this.adjusting;
    if (!item || this.saving()) return;
    const qty = Number(this.adjustQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      this.toast.warning('Số lượng phải là số nguyên lớn hơn 0');
      return;
    }
    if (this.fromWorkshop) {
      this.receiveFromWorkshop(item, qty);
      return;
    }
    if (!this.adjustReason.trim()) {
      this.toast.warning('Vui lòng ghi lý do điều chỉnh');
      return;
    }
    const next = this.adjustResult!;
    if (next < 0) {
      this.toast.warning(`Tồn kho hiện chỉ còn ${item.currentStock} cái, không thể xuất ${qty} cái`);
      return;
    }
    const delta = this.adjustMode === 'IN' ? qty : -qty;
    this.saving.set(true);
    this.productService.updateProduct(item.id, { inStock: next }).subscribe({
      next: () => {
        this.saving.set(false);
        this.adjusting = null;
        this.toast.success(`Đã cập nhật tồn kho ${item.name}: ${next} cái`);
        this.audit.record('Kho Hàng', 'Điều chỉnh tồn kho', `${item.name} (${item.id}): ${delta > 0 ? '+' : ''}${delta} — ${this.adjustReason.trim()}`, 'SUCCESS');
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Không lưu được tồn kho lên server');
      },
    });
  }

  /** Hàng xưởng giao: server cộng tồn (nguyên tử) và ghi 1 dòng lịch sử giao nhận. */
  private receiveFromWorkshop(item: InventoryItem, qty: number): void {
    const workshop = this.activeWorkshops().find(w => w.id === this.adjustWorkshopId);
    if (!workshop) {
      this.toast.warning('Chọn xưởng giao hàng');
      return;
    }
    this.saving.set(true);
    this.receipts.receive({ workshopId: workshop.id, productId: item.id, qty, note: this.adjustNote.trim() }).subscribe({
      next: product => {
        this.saving.set(false);
        this.adjusting = null;
        this.productService.refresh();
        this.toast.success(`Đã nhập ${qty} ${item.name} từ ${workshop.name} — tồn kho ${product.inStock} cái`);
        this.audit.record('Kho Hàng', 'Nhập hàng từ xưởng', `${item.name} (${item.id}): +${qty} — ${workshop.name}`, 'SUCCESS');
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Không nhập được hàng từ xưởng');
      },
    });
  }

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có mặt hàng nào để xuất');
      return;
    }
    exportXlsx('lumea_ton_kho', ['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Xưởng phụ trách', 'Tồn hiện tại', 'Ngưỡng cảnh báo', 'Đã bán', 'Trạng thái'],
      rows.map(i => [i.id, i.name, i.category, i.workshop, i.currentStock, LOW_STOCK_THRESHOLD, i.soldCount, STATUS_LABELS[i.status]]), 'Tồn kho');
    this.toast.success(`Đã xuất ${rows.length} mặt hàng ra file Excel`);
  }
}
