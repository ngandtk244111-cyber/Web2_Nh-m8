import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService, invoiceUrl } from '../../core/services/order.service';
import { Order, OrderStatus, ProductionStep, RefundBank } from '../../core/models/order.model';
import { REFUND_POLICY, orderNeedsRefund } from '../../core/data/refund-policy';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { CANCEL_REASONS, CANCEL_REASON_OTHER } from '../../core/data/cancel-reasons';
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
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './order-tracking.component.html',
  styleUrl: './order-tracking.component.css'
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  searchCode = '';
  searchPhone = '';
  currentOrder: Order | undefined;
  isSearching = false;
  notFound = false;
  /** Mở từ link (sau khi đặt hàng / từ tài khoản) thì chỉ hiện chi tiết đơn, ẩn ô tra cứu. */
  openedFromLink = false;

  // Huỷ đơn: hộp thoại chọn lý do (giống Shopee)
  cancelOpen = false;
  readonly cancelReasons = CANCEL_REASONS;
  readonly cancelReasonOther = CANCEL_REASON_OTHER;
  cancelReason = '';
  cancelDetail = '';
  cancelling = false;
  /** Tài khoản nhận tiền hoàn — chỉ hỏi khi huỷ đơn đã chuyển khoản ngân hàng. */
  refundBank: RefundBank = { bankName: '', bankAccount: '', accountHolder: '' };

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
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  ngOnDestroy(): void {
    this.stopWatching();
    if (this.flashTimer) clearTimeout(this.flashTimer);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['orderNumber'];
      if (code) {
        this.openedFromLink = true;
        this.searchCode = code;
        this.searchOrder();
      }
    });
  }

  searchOrder(): void {
    const code = this.searchCode.trim().toUpperCase();
    if (!code) return;

    this.isSearching = true;
    this.notFound = false;
    this.stopWatching();
    this.orderService.getOrderByNumber(code, this.searchPhone.trim()).subscribe(order => {
      this.isSearching = false;
      this.currentOrder = order || undefined;
      this.notFound = !order;
      if (order) {
        this.lastUpdatedAt = new Date();
        this.startWatching(order.orderNumber);
      } else {
        // Mở từ link nhưng không phải chủ đơn: hiện lại ô tra cứu để nhập SĐT nhận hàng.
        this.openedFromLink = false;
      }
    });
  }

  /** Theo dõi trực tiếp đơn đang xem: nhân viên cập nhật là trang tự đổi, không cần tải lại. */
  private startWatching(orderNumber: string): void {
    this.watchSub = this.orderService.watchOrder(orderNumber, this.searchPhone.trim()).subscribe(updated => {
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

  private get isOwner(): boolean {
    const user = this.authService.currentUser();
    return !!this.currentOrder && !!user && this.currentOrder.userId === user._id;
  }

  /** Chủ đơn tự huỷ được khi Luméa chưa xác nhận đơn; đơn đã trả trước thì được hoàn tiền. */
  get canCancel(): boolean {
    return this.isOwner && this.currentOrder!.status === 'PENDING';
  }

  /** Đơn đã xác nhận, đang chuẩn bị/đóng gói — không tự huỷ được nữa. */
  get cancelLocked(): boolean {
    return this.isOwner && (this.currentOrder!.status === 'CONFIRMED' || this.currentOrder!.status === 'IN_PRODUCTION');
  }

  /** Huỷ đơn này sẽ được hoàn tiền (đã trả trước) — kèm chính sách hoàn theo phương thức thanh toán. */
  get refundInfo(): { days: number; channel: string } | null {
    const order = this.currentOrder;
    if (!order || !orderNeedsRefund(order)) return null;
    return REFUND_POLICY[order.paymentMethod] || { days: 7, channel: 'Hoàn về phương thức đã thanh toán' };
  }

  get needsRefundBank(): boolean {
    return !!this.refundInfo && this.currentOrder?.paymentMethod === 'BANK_TRANSFER';
  }

  get refundBankValid(): boolean {
    const b = this.refundBank;
    return !!b.bankName.trim() && !!b.accountHolder.trim() && /^\d{6,20}$/.test(b.bankAccount.replace(/\s/g, ''));
  }

  refundStatusLabel(status: string): string {
    return status === 'COMPLETED' ? 'Đã hoàn tiền' : status === 'VOID' ? 'Không phát sinh hoàn tiền' : 'Đang xử lý hoàn tiền';
  }

  /** Hoá đơn PDF: server chỉ cho chủ đơn xem đơn của tài khoản (đơn khách vãng lai thì ai có mã cũng xem được). */
  get canViewInvoice(): boolean {
    const order = this.currentOrder;
    if (!order || order.status === 'CANCELLED') return false;
    return !order.userId || order.userId === this.authService.currentUser()?._id;
  }

  openInvoice(): void {
    if (!this.currentOrder) return;
    window.open(invoiceUrl(this.currentOrder.orderNumber, this.authService.token), '_blank', 'noopener');
  }

  openCancel(): void {
    this.cancelReason = '';
    this.cancelDetail = '';
    this.refundBank = { bankName: '', bankAccount: '', accountHolder: '' };
    this.cancelOpen = true;
  }

  closeCancel(): void {
    if (!this.cancelling) this.cancelOpen = false;
  }

  confirmCancel(): void {
    const order = this.currentOrder;
    const userId = this.authService.currentUser()?._id;
    if (!order || !userId || !this.cancelReason || this.cancelling) return;
    if (this.needsRefundBank && !this.refundBankValid) return;
    this.cancelling = true;
    const bank = this.needsRefundBank ? this.refundBank : undefined;
    this.orderService.cancelOrder(order.orderNumber, userId, this.cancelReason, this.cancelDetail, bank).subscribe({
      next: updated => {
        this.currentOrder = updated;
        this.cancelling = false;
        this.cancelOpen = false;
        this.toastService.success(updated.refund
          ? `Đã huỷ đơn ${updated.orderNumber}. Luméa sẽ hoàn tiền cho bạn theo chính sách hoàn tiền.`
          : `Đã huỷ đơn ${updated.orderNumber}.`, 5000);
      },
      error: err => {
        this.cancelling = false;
        this.toastService.error(err?.error?.error || 'Không huỷ được đơn, vui lòng thử lại.', 6000);
      },
    });
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
      case 'PENDING': return 'Chờ Luméa xác nhận';
      case 'IN_PRODUCTION': return 'Đang in 3D & sản xuất';
      case 'CONFIRMED': return 'Đã xác nhận, đang chuẩn bị hàng';
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
