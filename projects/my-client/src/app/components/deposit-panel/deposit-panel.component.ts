import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Order } from '../../core/models/order.model';
import { DepositInfo, DepositTransaction, OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

type GatewayMethod = 'momo' | 'atm' | 'zalopay';

const STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chờ thanh toán cọc',
  VERIFYING: 'Shop đang đối soát',
  PAID: 'Đã đủ cọc',
  REFUND_PENDING: 'Đang hoàn tiền cọc',
  PARTIALLY_REFUNDED: 'Đã hoàn một phần',
  REFUNDED: 'Đã hoàn tiền cọc',
};

/**
 * Khung "Thanh toán cọc" của đơn đặt làm theo báo giá (trang đơn hàng của khách).
 * Cách chính: trả qua MoMo / thẻ ATM / ZaloPay — cổng báo thành công là đơn tự chuyển "Đã đủ cọc",
 * không cần nhân viên. Dự phòng: chuyển khoản VietQR rồi báo shop để đối soát.
 * Mọi số tiền lấy từ server (phần cọc còn thiếu), không tính ở trình duyệt.
 */
@Component({
  selector: 'app-deposit-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './deposit-panel.component.html',
  styleUrl: './deposit-panel.component.css',
})
export class DepositPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) order!: Order;
  @Output() changed = new EventEmitter<Order>();

  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  info: DepositInfo | null = null;
  loading = false;
  paying: GatewayMethod | null = null;
  showBank = false;
  reportAmount: number | null = null;
  reportNote = '';
  reporting = false;
  now = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Lần tải gần nhất ứng với trạng thái nào của đơn — đơn đổi (realtime) thì tải lại sổ giao dịch. */
  private loadedKey = '';

  get loggedIn(): boolean {
    return !!this.authService.currentUser();
  }

  ngOnInit(): void {
    this.timer = setInterval(() => (this.now = Date.now()), 30000);
  }

  ngOnChanges(): void {
    const key = `${this.order?.orderNumber}|${this.order?.depositStatus}|${this.order?.depositReceived}|${this.order?.status}`;
    if (key !== this.loadedKey && this.loggedIn) {
      this.loadedKey = key;
      this.load();
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private load(): void {
    this.loading = true;
    this.orderService.getDeposit(this.order.orderNumber).subscribe({
      next: info => {
        this.loading = false;
        this.info = info;
        if (this.reportAmount === null) this.reportAmount = info.payment?.amount || null;
        const o = info.order;
        if (o.depositStatus !== this.order.depositStatus || o.depositReceived !== this.order.depositReceived || o.status !== this.order.status) {
          this.loadedKey = `${o.orderNumber}|${o.depositStatus}|${o.depositReceived}|${o.status}`;
          this.changed.emit(o);
        }
      },
      error: () => (this.loading = false),
    });
  }

  get plan() {
    return this.order.paymentPlan;
  }

  get statusLabel(): string {
    return STATUS_LABELS[this.order.depositStatus || 'UNPAID'] || '';
  }

  get due(): number {
    return Math.max(0, (this.plan?.depositAmount || 0) - (this.order.depositReceived || 0));
  }

  /** Còn được trả cọc: đơn chờ cọc, chưa quá hạn (server vẫn kiểm tra lại theo giờ server). */
  get canPay(): boolean {
    return this.order.status === 'PENDING' && this.order.depositStatus === 'UNPAID' && this.due > 0 && this.msLeft > 0;
  }

  get msLeft(): number {
    const d = this.plan?.deadlineAt ? new Date(this.plan.deadlineAt).getTime() : 0;
    return d - this.now;
  }

  get timeLeftLabel(): string {
    const ms = this.msLeft;
    if (ms <= 0) return 'Đã quá hạn';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút`;
  }

  /** Các lần thanh toán đáng hiển thị (bỏ lượt mở cổng rồi bỏ dở). */
  get history(): DepositTransaction[] {
    return (this.info?.transactions || []).filter(t => t.status !== 'INITIATED');
  }

  txnLabel(t: DepositTransaction): string {
    if (t.source === 'GATEWAY') return { MOMO: 'Ví MoMo', ATM: 'Thẻ ATM', ZALOPAY: 'ZaloPay' }[t.gateway || 'MOMO'] || 'Cổng thanh toán';
    return t.source === 'STAFF' ? 'Shop ghi nhận chuyển khoản' : 'Bạn báo chuyển khoản';
  }

  txnAmount(t: DepositTransaction): number {
    return t.receivedAmount ?? t.expectedAmount ?? t.reportedAmount ?? 0;
  }

  txnStatus(t: DepositTransaction): string {
    return { CONFIRMED: 'Đã nhận', REPORTED: 'Chờ đối soát', REJECTED: 'Không khớp', FAILED: 'Không thành công', INITIATED: '' }[t.status];
  }

  pay(method: GatewayMethod): void {
    if (!this.canPay || this.paying) return;
    this.paying = method;
    this.paymentService.createDepositPayment(this.order.orderNumber, method).subscribe({
      next: res => {
        const url = res.payUrl || res.orderUrl;
        if (url) {
          window.location.href = url;
          return;
        }
        this.paying = null;
        this.toast.error(res.error || 'Không mở được cổng thanh toán');
      },
      error: err => {
        this.paying = null;
        this.toast.error(err?.error?.error || 'Không mở được cổng thanh toán, vui lòng thử lại');
        this.load();
      },
    });
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.toast.success('Đã sao chép'), () => undefined);
  }

  report(): void {
    const amount = Number(this.reportAmount);
    if (!Number.isInteger(amount) || amount <= 0 || this.reporting) {
      this.toast.error('Vui lòng nhập số tiền bạn đã chuyển');
      return;
    }
    this.reporting = true;
    this.orderService.reportDepositTransfer(this.order.orderNumber, amount, this.reportNote.trim()).subscribe({
      next: order => {
        this.reporting = false;
        this.reportNote = '';
        this.toast.success('Đã gửi. Shop sẽ đối soát sao kê và xác nhận cho bạn.');
        this.changed.emit(order);
      },
      error: err => {
        this.reporting = false;
        this.toast.error(err?.error?.error || 'Không gửi được, vui lòng thử lại');
      },
    });
  }
}
