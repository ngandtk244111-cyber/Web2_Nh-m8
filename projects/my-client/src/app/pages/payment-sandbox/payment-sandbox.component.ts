import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { Order } from '../../core/models/order.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

type SandboxMethod = 'momo' | 'atm' | 'zalopay';

const METHOD_LABELS: Record<SandboxMethod, string> = {
  momo: 'Ví MoMo',
  atm: 'Thẻ ATM nội địa',
  zalopay: 'ZaloPay',
};

/**
 * Cổng thanh toán thử (chỉ bật khi chạy dev): server chuyển khách tới đây khi cổng MoMo/ZaloPay
 * sandbox từ chối giao dịch, để vẫn đi hết luồng thanh toán -> trang kết quả -> hoá đơn.
 * Không thu tiền thật; bấm xác nhận thì server đánh dấu đơn "Đã thanh toán".
 */
@Component({
  selector: 'app-payment-sandbox',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './payment-sandbox.component.html',
  styleUrl: './payment-sandbox.component.css',
})
export class PaymentSandboxComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);

  order: Order | null = null;
  method: SandboxMethod = 'momo';
  loading = true;
  busy = false;
  error = '';

  /** Ô vuông trang trí giả mã QR. */
  readonly qrCells = Array.from({ length: 49 }, (_, i) => (i * 7 + (i % 5)) % 3 !== 0);

  /** Thẻ ATM thử điền sẵn — chỉ để mô phỏng bước nhập thẻ. */
  card = { number: '9704 0000 0000 0018', name: 'NGUYEN VAN A', issued: '03/07', otp: '' };

  /** Lượt trả cọc đơn đặt làm (server tạo, gắn vào URL) — có thì thanh toán phần cọc thay vì cả đơn. */
  depositRef = '';

  get methodLabel(): string {
    return METHOD_LABELS[this.method];
  }

  /** Phần cọc còn thiếu (server cũng tự tính lại khi xác nhận). */
  get depositDue(): number {
    const o = this.order;
    return o ? Math.max(0, (o.paymentPlan?.depositAmount || 0) - (o.depositReceived || 0)) : 0;
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const m = params.get('method') as SandboxMethod;
    if (m && m in METHOD_LABELS) this.method = m;
    const orderNumber = params.get('orderNumber') || '';
    this.depositRef = params.get('deposit') || '';
    this.orderService.getOrderByNumber(orderNumber).subscribe(order => {
      this.loading = false;
      if (!order) {
        this.error = 'Không tìm thấy đơn hàng cần thanh toán.';
        return;
      }
      this.order = order;
      if (this.depositRef ? order.depositStatus === 'PAID' : order.paymentStatus === 'PAID') this.goResult(true);
      else if (order.status === 'CANCELLED') this.error = 'Đơn hàng này đã bị huỷ.';
    });
  }

  get canPay(): boolean {
    return this.method !== 'atm' || /^\d{6}$/.test(this.card.otp.trim());
  }

  pay(): void {
    this.submit('pay');
  }

  cancel(): void {
    this.submit('cancel');
  }

  private submit(action: 'pay' | 'cancel'): void {
    if (!this.order || this.busy || (action === 'pay' && !this.canPay)) return;
    this.busy = true;
    this.error = '';
    this.paymentService.confirmSandbox(this.order.orderNumber, action, this.depositRef || undefined).subscribe({
      next: res => {
        this.busy = false;
        this.goResult(!!res.paid);
      },
      error: err => {
        this.busy = false;
        this.error = err?.error?.error || 'Không xử lý được giao dịch, vui lòng thử lại.';
      },
    });
  }

  /** Quay về trang thanh toán để đổi phương thức cho đơn này (đơn giữ nguyên, chưa thanh toán). */
  switchMethod(): void {
    if (!this.order) return;
    // Trả cọc: quay về trang đơn hàng để chọn cổng khác / chuyển khoản.
    if (this.depositRef) {
      this.paymentService.confirmSandbox(this.order.orderNumber, 'cancel', this.depositRef).subscribe({ error: () => undefined });
      this.router.navigate(['/orders/track'], { queryParams: { orderNumber: this.order.orderNumber }, replaceUrl: true });
      return;
    }
    this.router.navigate(['/checkout'], { queryParams: { doiPhuongThuc: this.order.orderNumber }, replaceUrl: true });
  }

  /** Về trang kết quả như khi cổng thật redirect về shop (kèm sandbox=1 để trang kết quả đọc trạng thái từ server). */
  private goResult(paid: boolean): void {
    const orderNumber = this.order!.orderNumber;
    if (this.method === 'zalopay') {
      this.router.navigate(['/checkout-zalopay-return'], { queryParams: { sandbox: 1, orderId: orderNumber, status: paid ? 1 : -49 }, replaceUrl: true });
    } else {
      this.router.navigate(['/checkout-momo-return'], {
        queryParams: { sandbox: 1, orderId: orderNumber, resultCode: paid ? 0 : 1006, message: paid ? '' : 'Bạn đã huỷ giao dịch.' },
        replaceUrl: true,
      });
    }
  }
}
