import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppIconComponent } from '../../components/icon/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { OrderService, invoiceUrl } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';

@Component({
  selector: 'app-checkout-momo-return',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './checkout-momo-return.component.html',
  styleUrl: './checkout-momo-return.component.css'
})
export class CheckoutMomoReturnComponent implements OnInit {
  isSuccess = false;
  /** Đơn chưa thanh toán, chưa huỷ/giao -> cho quay lại chọn phương thức khác. */
  canSwitch = false;
  /** Đang hỏi server trạng thái thanh toán thật của đơn. */
  checking = true;
  orderNumber = '';
  message = '';
  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(PaymentService);

  /** Hoá đơn PDF của đơn vừa thanh toán (mở ở tab mới). */
  invoiceLink(): string {
    return invoiceUrl(this.orderNumber, this.authService.currentUser()?._id);
  }

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const params = { ...this.route.snapshot.queryParams } as Record<string, string>;
    this.orderNumber = params['orderId'] || '';
    this.message = params['message'] || '';
    if (!this.orderNumber) {
      this.checking = false;
      return;
    }
    // Không tin resultCode trên URL: MoMo thật thì xác minh chữ ký rồi ghi nhận thanh toán
    // (IPN không về được localhost); cổng thử thì server đã ghi nhận sẵn. Cuối cùng đọc trạng thái đơn.
    if (params['signature']) {
      this.paymentService.verifyMomoReturn(params).subscribe({
        next: () => this.loadStatus(),
        error: () => this.loadStatus(),
      });
    } else {
      this.loadStatus();
    }
  }

  private loadStatus(): void {
    this.orderService.getOrderByNumber(this.orderNumber).subscribe(order => {
      this.checking = false;
      this.isSuccess = order?.paymentStatus === 'PAID';
      this.canSwitch = !!order && !this.isSuccess && ['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(order.status);
    });
  }
}
