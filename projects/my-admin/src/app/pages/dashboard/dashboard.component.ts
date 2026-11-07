import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import * as XLSX from 'xlsx';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { ToastService } from '../../core/services/toast.service';
import { LOW_STOCK_THRESHOLD } from '../../core/services/notice.service';
import { Order, OrderStatus, ProductionStep } from '../../core/models/order.model';
import { CustomRequestStatus } from '../../core/models/custom-request.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { DatePickerDirective } from '../../shared/directives/date-picker.directive';
import { LumeaMapComponent, MapSupplier } from '../../components/lumea-map/lumea-map.component';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import {
  ORDER_STATUS_LABELS, isRevenueOrder, orderItemName, orderStatusClass, orderStatusLabel,
  paymentMethodLabel, paymentStatusClass, paymentStatusLabel,
} from '../../shared/utils/order-labels';
import { DEFAULT_SHOWROOM_ADDRESS, Workshop, specialtyLabels } from '../../core/data/workshops';

Chart.register(...registerables);

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_BARS = 31;
const MAX_WEEKLY_DAYS = 186;

export type SalesRange = 7 | 30 | 90 | 'custom';

interface SalesBar {
  label: string;
  fullLabel: string;
  amount: number;
  orders: number;
}

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#B16C22',
  CONFIRMED: '#49718A',
  IN_PRODUCTION: '#806D98',
  SHIPPED: '#426994',
  DELIVERED: '#568066',
  CANCELLED: '#9AA19C',
  RETURNED: '#B44B50',
};

const REQUEST_STATUS_LABELS: Record<CustomRequestStatus, string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  QUOTED: 'Đã báo giá',
  IN_DISCUSSION: 'Đang trao đổi',
  PREVIEW_READY: 'Có bản preview',
  APPROVED: 'Khách đã duyệt',
  CONVERTED_TO_ORDER: 'Đã thành đơn',
  REJECTED: 'Đã huỷ',
};

const PALETTE = ['#A3152D', '#49718A', '#B16C22', '#568066', '#806D98', '#BB7882', '#9AA19C'];

/** Tổng quan — theo home/ của Vita: biểu đồ doanh thu + cột số liệu, hàng biểu đồ tròn, bản đồ, đơn gần đây. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, DatePickerDirective, LumeaMapComponent, MascotLoadingComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private customRequestService = inject(CustomRequestService);
  readonly adminAuth = inject(AdminAuthService);
  private config = inject(AdminConfigService);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly threshold = LOW_STOCK_THRESHOLD;
  readonly statusLabel = orderStatusLabel;
  readonly statusClass = orderStatusClass;
  readonly payLabel = paymentStatusLabel;
  readonly payClass = paymentStatusClass;
  readonly itemName = orderItemName;
  readonly today = new Date();
  /** "Thứ Bảy, 08/11/2026" — hiện ở góc phải tiêu đề. */
  readonly todayLabel = this.today.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  loading = signal(true);
  exportMenuOpen = false;

  salesRange = signal<SalesRange>(7);
  salesFrom = signal('');
  salesTo = signal('');

  private revenueCanvas = viewChild<ElementRef<HTMLCanvasElement>>('revenueChart');
  private statusCanvas = viewChild<ElementRef<HTMLCanvasElement>>('statusChart');
  private paymentCanvas = viewChild<ElementRef<HTMLCanvasElement>>('paymentChart');
  private requestCanvas = viewChild<ElementRef<HTMLCanvasElement>>('requestChart');
  private charts = new Map<string, Chart>();

  readonly orders = this.orderService.orders;
  readonly products = this.productService.products;
  readonly requests = this.customRequestService.requests;

  get canSeeSales(): boolean { return this.adminAuth.can('orders.view'); }
  can(rule: string): boolean { return this.adminAuth.can(rule); }

  get adminName(): string {
    const a = this.adminAuth.currentAdmin();
    return a?.fullName || a?.username || '';
  }

  /** Xưởng sản xuất hiện trên bản đồ (cấu hình 'workshops'). */
  readonly suppliers = computed<MapSupplier[]>(() => (this.config.get<Workshop[]>('workshops') || []).map(w => ({
    name: w.name, address: w.address, category: specialtyLabels(w), contact: w.contact, phone: w.phone, active: w.active,
  })));
  readonly showroomAddress = computed(() => this.config.get<{ showroomAddress?: string }>('settings')?.showroomAddress || DEFAULT_SHOWROOM_ADDRESS);

  // ---------- Số liệu ----------
  readonly revenueOrders = computed(() => this.orders().filter(isRevenueOrder));
  readonly totalRevenue = computed(() => this.revenueOrders().reduce((s, o) => s + o.total, 0));
  readonly podOrdersCount = computed(() => this.orders().filter(o => o.hasPrintOnDemandItems).length);
  readonly pendingRequests = computed(() => this.requests().filter(r => r.status === 'PENDING_REVIEW').length);
  readonly recentOrders = computed(() => this.orders().slice(0, 6));

  readonly stockAlerts = computed(() => {
    const ready = this.products().filter(p => p.productionType === 'READY_STOCK');
    return {
      out: ready.filter(p => (p.inStock ?? 0) <= 0),
      low: ready.filter(p => (p.inStock ?? 0) > 0 && p.inStock <= LOW_STOCK_THRESHOLD),
    };
  });

  /** Doanh thu tháng này so với cả tháng trước. */
  readonly monthRevenue = computed(() => {
    const now = this.today;
    const sumMonth = (year: number, month: number) => this.revenueOrders()
      .filter(o => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, o) => sum + o.total, 0);
    const current = sumMonth(now.getFullYear(), now.getMonth());
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = sumMonth(prev.getFullYear(), prev.getMonth());
    return { current, previous, changePct: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null };
  });

  /** Số đơn đang ở từng bước của xưởng in 3D. */
  readonly printQueue = computed(() => {
    const inProduction = this.orders().filter(o => o.status === 'IN_PRODUCTION');
    const count = (steps: ProductionStep[]) => inProduction.filter(o => steps.includes(o.productionProgress?.currentStep as ProductionStep)).length;
    return [
      { label: 'Chuẩn bị file & slicing', hint: 'Kiểm tra file, xuất G-code', icon: 'bi-file-earmark-code', count: count(['FILE_PREPARATION']) + inProduction.filter(o => !o.productionProgress?.currentStep).length },
      { label: 'Đang chạy máy in', hint: 'Máy FDM/SLA đang in', icon: 'bi-printer', count: count(['3D_PRINTING']) },
      { label: 'Xử lý bề mặt', hint: 'Chà nhám, phủ satin', icon: 'bi-brush', count: count(['POST_PROCESSING', 'ASSEMBLY_TESTING']) },
      { label: 'Đóng gói, chờ giao', hint: 'Kiểm tra chất lượng & tem', icon: 'bi-box-seam', count: count(['PACKAGING']) },
    ];
  });

  // ---------- Khoảng thời gian biểu đồ doanh số ----------
  private parseDate(value: string): Date | null {
    const [y, m, d] = value.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  }

  readonly salesPeriod = computed<{ start: Date; end: Date } | null>(() => {
    const range = this.salesRange();
    if (range === 'custom') {
      const start = this.parseDate(this.salesFrom());
      const end = this.parseDate(this.salesTo());
      return start && end && start <= end ? { start, end } : null;
    }
    const end = new Date(this.today);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (range - 1));
    return { start, end };
  });

  /** Khoảng dài thì gộp cột theo tuần/tháng để biểu đồ vẫn đọc được. */
  readonly salesUnit = computed<'day' | 'week' | 'month'>(() => {
    const p = this.salesPeriod();
    if (!p) return 'day';
    const days = Math.round((p.end.getTime() - p.start.getTime()) / DAY_MS) + 1;
    return days <= MAX_DAILY_BARS ? 'day' : days <= MAX_WEEKLY_DAYS ? 'week' : 'month';
  });

  readonly salesRangeLabel = computed(() => {
    const p = this.salesPeriod();
    if (!p) return 'Chọn khoảng ngày hợp lệ';
    const f = (d: Date) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${f(p.start)} – ${f(p.end)}`;
  });

  readonly salesBars = computed<SalesBar[]>(() => {
    const p = this.salesPeriod();
    if (!p) return [];
    const unit = this.salesUnit();
    const endTime = p.end.getTime() + DAY_MS;
    const orders = this.revenueOrders();
    const rows: SalesBar[] = [];
    let start = new Date(p.start);
    while (start.getTime() < endTime) {
      const next = unit === 'month'
        ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + (unit === 'week' ? 7 : 1));
      const stop = Math.min(next.getTime(), endTime);
      const list = orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= start.getTime() && t < stop;
      });
      const dm = start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      rows.push({
        label: unit === 'month' ? `T${start.getMonth() + 1}/${start.getFullYear()}` : dm,
        fullLabel: unit === 'month' ? `Tháng ${start.getMonth() + 1}/${start.getFullYear()}` : unit === 'week' ? `Tuần từ ${dm}` : start.toLocaleDateString('vi-VN'),
        amount: list.reduce((s, o) => s + o.total, 0),
        orders: list.length,
      });
      start = next;
    }
    return rows;
  });

  readonly salesTotal = computed(() => this.salesBars().reduce((s, b) => s + b.amount, 0));
  readonly salesOrders = computed(() => this.salesBars().reduce((s, b) => s + b.orders, 0));
  readonly salesPeak = computed(() => {
    const bars = this.salesBars();
    const max = Math.max(0, ...bars.map(b => b.amount));
    return max > 0 ? bars.find(b => b.amount === max)! : null;
  });

  // ---------- Dữ liệu biểu đồ tròn ----------
  readonly statusSlices = computed(() => (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[])
    .map(s => ({ label: ORDER_STATUS_LABELS[s], value: this.orders().filter(o => o.status === s).length, color: ORDER_STATUS_COLORS[s] }))
    .filter(s => s.value > 0));

  readonly paymentSlices = computed(() => {
    const counts = new Map<string, number>();
    for (const o of this.orders()) counts.set(o.paymentMethod, (counts.get(o.paymentMethod) || 0) + 1);
    return [...counts.entries()].map(([m, value], i) => ({ label: paymentMethodLabel(m), value, color: PALETTE[i % PALETTE.length] }));
  });

  readonly requestSlices = computed(() => (Object.keys(REQUEST_STATUS_LABELS) as CustomRequestStatus[])
    .map((s, i) => ({ label: REQUEST_STATUS_LABELS[s], value: this.requests().filter(r => r.status === s).length, color: PALETTE[i % PALETTE.length] }))
    .filter(s => s.value > 0));

  constructor() {
    effect(() => this.renderRevenueChart(this.revenueCanvas(), this.salesBars(), this.salesUnit()));
    effect(() => this.renderDoughnut('status', this.statusCanvas(), this.statusSlices()));
    effect(() => this.renderDoughnut('payment', this.paymentCanvas(), this.paymentSlices()));
    effect(() => this.renderDoughnut('request', this.requestCanvas(), this.requestSlices()));
  }

  ngOnInit(): void {
    this.config.load();
    this.productService.refresh();
    if (this.can('custom3d.view')) this.customRequestService.refresh();
    if (this.canSeeSales) {
      this.loading.set(this.orders().length === 0);
      this.orderService.fetchAll().subscribe(() => this.loading.set(false));
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
    this.charts.clear();
  }

  // ---------- Biểu đồ ----------
  /** Biểu đồ đường kiểu AuraPC: doanh thu (vùng tô, trục trái) + số đơn (đường, trục phải). */
  private renderRevenueChart(canvas: ElementRef<HTMLCanvasElement> | undefined, bars: SalesBar[], _unit: string): void {
    if (!canvas) return;
    const existing = this.charts.get('revenue');
    if (existing) {
      existing.data.labels = bars.map(b => b.label);
      existing.data.datasets[0].data = bars.map(b => b.amount);
      existing.data.datasets[1].data = bars.map(b => b.orders);
      existing.update();
      return;
    }
    const revenueColor = '#A3152D';
    const ordersColor = '#292522';
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: bars.map(b => b.label),
        datasets: [
          {
            label: 'Doanh thu',
            data: bars.map(b => b.amount),
            borderColor: revenueColor,
            backgroundColor: 'rgba(163, 21, 45, 0.10)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: revenueColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y',
            order: 2,
          },
          {
            label: 'Số đơn',
            data: bars.map(b => b.orders),
            borderColor: ordersColor,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: ordersColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => this.salesBars()[items[0].dataIndex]?.fullLabel || '',
              label: item => item.datasetIndex === 0
                ? `Doanh thu: ${Number(item.parsed.y || 0).toLocaleString('vi-VN')}đ`
                : `Số đơn: ${item.parsed.y || 0}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, color: '#7A6F67' } },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: '#E4E7E4' },
            ticks: { color: '#7A6F67', callback: v => this.shortMoney(Number(v)) },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: '#7A6F67', precision: 0 },
          },
        },
      },
    };
    this.charts.set('revenue', new Chart(canvas.nativeElement, config));
  }

  private renderDoughnut(key: string, canvas: ElementRef<HTMLCanvasElement> | undefined, slices: { label: string; value: number; color: string }[]): void {
    if (!canvas) return;
    const existing = this.charts.get(key);
    if (existing) {
      existing.data.labels = slices.map(s => s.label);
      existing.data.datasets[0].data = slices.map(s => s.value);
      (existing.data.datasets[0] as any).backgroundColor = slices.map(s => s.color);
      existing.update();
      return;
    }
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: slices.map(s => s.label),
        datasets: [{ data: slices.map(s => s.value), backgroundColor: slices.map(s => s.color), borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, color: '#3C332D' } } },
      },
    };
    this.charts.set(key, new Chart(canvas.nativeElement, config));
  }

  private shortMoney(v: number): string {
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'tr';
    if (v >= 1000) return Math.round(v / 1000) + 'k';
    return String(v);
  }

  // ---------- Điều hướng ----------
  setRange(range: SalesRange): void {
    if (range === 'custom' && !this.salesFrom()) {
      const p = this.salesPeriod();
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (p) {
        this.salesFrom.set(iso(p.start));
        this.salesTo.set(iso(p.end));
      }
    }
    this.salesRange.set(range);
  }

  openStat(card: 'revenue' | 'orders' | 'requests' | 'stock'): void {
    switch (card) {
      case 'revenue':
      case 'orders':
        if (this.can('orders.view')) this.router.navigate(['/orders']);
        break;
      case 'requests':
        if (this.can('custom3d.view')) this.router.navigate(['/custom-requests'], { queryParams: { status: 'PENDING_REVIEW' } });
        break;
      case 'stock':
        // Hết hàng gấp hơn sắp hết → mở nhóm hết hàng trước nếu có
        if (this.can('inventory.view')) this.router.navigate(['/inventory'], { queryParams: { status: this.stockAlerts().out.length ? 'OUT' : 'LOW' } });
        break;
    }
  }

  openOrder(o: Order): void {
    this.router.navigate(['/orders', o.orderNumber]);
  }

  // ---------- Xuất báo cáo ----------
  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.exportMenuOpen = !this.exportMenuOpen;
  }

  @HostListener('document:click')
  closeExportMenu(): void {
    this.exportMenuOpen = false;
  }

  private get summaryRows(): (string | number)[][] {
    const m = this.monthRevenue();
    const alerts = this.stockAlerts();
    return [
      ['Tổng doanh thu (không tính huỷ/hoàn)', this.totalRevenue()],
      ['Doanh thu tháng này', m.current],
      ['Doanh thu tháng trước', m.previous],
      ['Thay đổi so với tháng trước (%)', m.changePct ?? '—'],
      ['Tổng số đơn', this.orders().length],
      ['Đơn có công đoạn in 3D', this.podOrdersCount()],
      ['Brief in 3D chờ duyệt', this.pendingRequests()],
      ['Sản phẩm hết hàng', alerts.out.length],
      [`Sản phẩm sắp hết (≤ ${LOW_STOCK_THRESHOLD})`, alerts.low.length],
    ];
  }

  exportReport(type: 'xlsx' | 'pdf'): void {
    this.exportMenuOpen = false;
    if (type === 'xlsx') this.exportExcel();
    else this.exportPdf();
  }

  private exportExcel(): void {
    const book = XLSX.utils.book_new();
    const sheet = (rows: (string | number)[][], name: string, widths: number[]) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = widths.map(wch => ({ wch }));
      XLSX.utils.book_append_sheet(book, ws, name);
    };
    sheet([['Chỉ số', 'Giá trị'], ...this.summaryRows], 'Tổng quan', [42, 18]);
    sheet([['Thời gian', 'Doanh số (đ)', 'Số đơn'], ...this.salesBars().map(b => [b.fullLabel, b.amount, b.orders])], 'Doanh số', [24, 16, 10]);
    sheet([['Trạng thái', 'Số đơn'], ...this.statusSlices().map(s => [s.label, s.value])], 'Trạng thái đơn', [24, 10]);
    sheet([['Mã SP', 'Sản phẩm', 'Tồn kho'], ...[...this.stockAlerts().out, ...this.stockAlerts().low].map(p => [p.id, p.name, p.inStock ?? 0])], 'Cảnh báo kho', [20, 48, 10]);
    XLSX.writeFile(book, `lumea_tong_quan_${new Date().toISOString().slice(0, 10)}.xlsx`);
    this.toast.success('Đã xuất báo cáo Excel');
  }

  private async exportPdf(): Promise<void> {
    try {
      const pdfMakeModule: any = await import('pdfmake/build/pdfmake');
      const fontsModule: any = await import('pdfmake/build/vfs_fonts');
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const fonts = fontsModule.default || fontsModule;
      pdfMake.vfs = fonts.vfs || fonts.pdfMake?.vfs || fonts;
      const money = (v: number) => v.toLocaleString('vi-VN') + 'đ';
      const table = (headers: string[], rows: (string | number)[][], widths: (string | number)[]) => ({
        table: {
          headerRows: 1,
          widths,
          body: [headers.map(h => ({ text: h, bold: true, color: '#fff', fillColor: '#A3152D' })), ...rows.map(r => r.map(c => String(c)))],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 4, 0, 14],
      });
      const doc = {
        pageMargins: [36, 40, 36, 40],
        defaultStyle: { fontSize: 10 },
        content: [
          { text: 'LUMÉA — BÁO CÁO TỔNG QUAN', fontSize: 16, bold: true, color: '#A3152D' },
          { text: `Xuất lúc ${new Date().toLocaleString('vi-VN')} · Biểu đồ doanh số: ${this.salesRangeLabel()}`, color: '#7A6F67', margin: [0, 2, 0, 14] },
          { text: 'Chỉ số chính', bold: true, fontSize: 12 },
          table(['Chỉ số', 'Giá trị'], this.summaryRows.map(([k, v]) => [k, typeof v === 'number' && String(k).toLowerCase().includes('doanh thu') ? money(v) : v]), ['*', 120]),
          { text: `Doanh số theo ${this.salesUnit() === 'day' ? 'ngày' : this.salesUnit() === 'week' ? 'tuần' : 'tháng'}`, bold: true, fontSize: 12 },
          table(['Thời gian', 'Doanh số', 'Số đơn'], this.salesBars().map(b => [b.fullLabel, money(b.amount), b.orders]), ['*', 120, 60]),
          { text: 'Đơn hàng theo trạng thái', bold: true, fontSize: 12 },
          table(['Trạng thái', 'Số đơn'], this.statusSlices().map(s => [s.label, s.value]), ['*', 60]),
        ],
      };
      pdfMake.createPdf(doc).download(`lumea_tong_quan_${new Date().toISOString().slice(0, 10)}.pdf`);
      this.toast.success('Đã xuất báo cáo PDF');
    } catch (err) {
      console.error('Xuất PDF lỗi', err);
      this.toast.error('Không xuất được file PDF');
    }
  }
}
