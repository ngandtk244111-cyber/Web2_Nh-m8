import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus, ProductionStep } from '../../core/models/order.model';
import { ToastService } from '../../core/services/toast.service';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

/** Mức tiến triển của trạng thái đơn — dùng cho thanh tiến trình tổng quát. */
const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  PENDING: 0,
  CONFIRMED: 1,
  IN_PRODUCTION: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './order-tracking.component.html',
  styleUrl: './order-tracking.component.css'
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  searchCode = '';
  currentOrder: Order | undefined;
  isSearching = false;
  notFound = false;

  /** Thời điểm nhận bản cập nhật gần nhất (lúc tra cứu hoặc do server đẩy về). */
  lastUpdatedAt: Date | null = null;
  /** Bật trong chốc lát khi có cập nhật trực tiếp để làm nổi thẻ trạng thái. */
  justUpdated = false;
  private watchSub: Subscription | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  pipelineSteps: { key: ProductionStep; label: string }[] = [
    { key: 'FILE_PREPARATION', label: '1. Slicing file' },
    { key: '3D_PRINTING', label: '2. Đang in 3D' },
    { key: 'POST_PROCESSING', label: '3. Xử lý bề mặt' },
    { key: 'ASSEMBLY_TESTING', label: '4. Kiểm tra điện' },
    { key: 'PACKAGING', label: '5. Đóng hộp' },
    { key: 'DISPATCHED', label: '6. Đang giao' },
  ];

  constructor(
    public orderService: OrderService,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnDestroy(): void {
    this.stopWatching();
    if (this.flashTimer) clearTimeout(this.flashTimer);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['orderNumber'];
      if (code) {
        this.searchCode = code;
        this.searchOrder();
      }
    });
  }

  searchOrder(): void {
    const code = this.searchCode.trim();
    if (!code) return;

    this.isSearching = true;
    this.notFound = false;
    this.stopWatching();
    this.orderService.getOrderByNumber(code).subscribe(order => {
      this.isSearching = false;
      this.currentOrder = order || undefined;
      this.notFound = !order;
      if (order) {
        this.lastUpdatedAt = new Date();
        this.startWatching(order.orderNumber);
      }
    });
  }

  /** Theo dõi trực tiếp đơn đang xem: nhân viên cập nhật là trang tự đổi, không cần tải lại. */
  private startWatching(orderNumber: string): void {
    this.watchSub = this.orderService.watchOrder(orderNumber).subscribe(updated => {
      const prev = this.currentOrder;
      this.currentOrder = updated;
      this.lastUpdatedAt = new Date();
      this.flash();
      if (prev && prev.status !== updated.status) {
        this.toastService.info('Đơn ' + updated.orderNumber + ': ' + this.getStatusLabel(updated.status), 5000);
      } else if (updated.productionProgress && prev?.productionProgress?.currentStep !== updated.productionProgress.currentStep) {
        this.toastService.info('Đơn ' + updated.orderNumber + ': ' + updated.productionProgress.stepTitle, 5000);
      }
    });
  }

  private stopWatching(): void {
    this.watchSub?.unsubscribe();
    this.watchSub = null;
  }

  private flash(): void {
    this.justUpdated = true;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => (this.justUpdated = false), 2200);
  }

  /** Đơn đã kết thúc (giao xong / huỷ / hoàn) — không còn gì để theo dõi thêm. */
  get isFinal(): boolean {
    const st = this.currentOrder?.status;
    return st === 'DELIVERED' || st === 'CANCELLED' || st === 'RETURNED';
  }

  /** Các mốc tổng quát của đơn; bước sản xuất chỉ có khi đơn có hàng in 3D theo yêu cầu. */
  get statusSteps(): { label: string; reached: boolean; current: boolean }[] {
    const order = this.currentOrder;
    if (!order) return [];
    const rank = STATUS_RANK[order.status] ?? -1;
    const steps = [
      { label: 'Đặt hàng', rank: 0 },
      { label: 'Đã xác nhận', rank: 1 },
      ...(order.hasPrintOnDemandItems ? [{ label: 'Đang sản xuất', rank: 2 }] : []),
      { label: 'Đang giao', rank: 3 },
      { label: 'Đã giao', rank: 4 },
    ];
    const lastReached = steps.filter(st => rank >= st.rank).pop();
    return steps.map(st => ({ label: st.label, reached: rank >= st.rank, current: st === lastReached }));
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'Chờ Luméa gọi xác nhận';
      case 'IN_PRODUCTION': return 'Đang in 3D & sản xuất';
      case 'CONFIRMED': return 'Đã xác nhận, chờ giao';
      case 'CANCELLED': return 'Đơn đã huỷ';
      case 'RETURNED': return 'Giao không thành công';
      case 'SHIPPED': return 'Đang giao hàng';
      case 'DELIVERED': return 'Giao hàng thành công';
      default: return status;
    }
  }

  isStepReached(stepKey: ProductionStep): boolean {
    if (!this.currentOrder?.productionProgress) return false;
    const orderIndex = this.pipelineSteps.findIndex(s => s.key === this.currentOrder!.productionProgress!.currentStep);
    const stepIndex = this.pipelineSteps.findIndex(s => s.key === stepKey);
    return stepIndex <= orderIndex;
  }
}
