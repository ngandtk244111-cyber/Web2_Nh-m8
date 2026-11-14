import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppIconComponent } from '../../components/icon/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { OrderService, invoiceUrl } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';

@Component({
  selector: 'app-checkout-zalopay-return',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './checkout-zalopay-return.component.html',
  styleUrl: './checkout-zalopay-return.component.css'
})
export class CheckoutZalopayReturnComponent implements OnInit {
  isSuccess = false;
  /** Đơn chưa thanh toán, chưa huỷ/giao -> cho quay lại chọn phương thức khác. */
  canSwitch = false;
  /** Đang hỏi server trạng thái thanh toán thật của đơn. */
  checking = true;
  orderNumber = '';
  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);

  /** Hoá đơn PDF của đơn vừa thanh toán (mở ở tab mới). */
  invoiceLink(): string {
    return invoiceUrl(this.orderNumber, this.authService.token);
  }

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const params = { ...this.route.snapshot.queryParams } as Record<string, string>;
    // ZaloPay thật không trả mã đơn của shop trên redirect -> server xác minh checksum và tìm đơn theo
    // apptransid (đồng thời ghi nhận thanh toán vì callback không về được localhost). Cổng thử gửi kèm orderId.
    if (params['checksum']) {
      this.paymentService.verifyZaloPayReturn(params).subscribe({
        next: res => {
          this.orderNumber = res.orderNumber || '';
          this.loadStatus();
        },
        error: () => {
          this.checking = false;
        },
      });
      return;
    }
    this.orderNumber = params['orderId'] || '';
    this.loadStatus();
  }

  private loadStatus(): void {
    if (!this.orderNumber) {
      this.checking = false;
      return;
    }
    this.orderService.getOrderByNumber(this.orderNumber).subscribe(order => {
      this.checking = false;
      this.isSuccess = order?.paymentStatus === 'PAID';
      this.canSwitch = !!order && !this.isSuccess && ['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(order.status);
    });
  }
}
