import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { PaymentService } from '../../core/services/payment.service';
import { Order } from '../../core/models/order.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

export type PaymentMethodId = 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'CARD' | 'VNPAY' | 'ATM';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  icon: string;
  /** Badge màu thương hiệu (MoMo/ZaloPay) thay cho app-icon khi có. */
  badge?: { text: string; bg: string; color: string };
  /** false = chưa có backend thật, chỉ dựng UI, không cho chọn/đặt hàng. */
  supported: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'COD', label: 'Thanh toán khi nhận hàng (COD)', description: 'Kiểm tra sản phẩm tận tay rồi thanh toán tiền mặt cho bưu tá.', icon: 'cash', supported: true },
  { id: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng / QR', description: 'Quét mã VietQR qua app ngân hàng bất kỳ, xác nhận nhanh, không mất phí.', icon: 'qr-code', supported: true },
  { id: 'MOMO', label: 'Ví MoMo', description: 'Chuyển sang cổng thanh toán MoMo.', badge: { text: 'M', bg: '#AE2070', color: '#ffffff' }, icon: 'credit-card', supported: true },
  { id: 'ZALOPAY', label: 'Ví ZaloPay', description: 'Chuyển sang cổng thanh toán ZaloPay.', badge: { text: 'Z', bg: '#0068FF', color: '#ffffff' }, icon: 'credit-card', supported: true },
  { id: 'CARD', label: 'Thẻ quốc tế Visa / Mastercard', description: 'Sắp ra mắt — Luméa chưa tích hợp cổng thanh toán thẻ quốc tế.', icon: 'credit-card', supported: false },
  { id: 'VNPAY', label: 'Cổng VNPay', description: 'Sắp ra mắt — Luméa chưa tích hợp VNPay.', icon: 'bank', supported: false },
  { id: 'ATM', label: 'Thẻ ATM nội địa / NAPAS', description: 'Sắp ra mắt — Luméa chưa tích hợp thanh toán ATM nội địa.', icon: 'credit-card', supported: false },
];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent implements OnInit {
  shipping = {
    fullName: '',
    phone: '',
    email: '',
    street: '',
    district: '',
    city: '',
    notes: '',
  };

  errors: Record<string, string> = {};
  readonly paymentMethods = PAYMENT_METHODS;
  paymentMethod: PaymentMethodId = 'COD';

  showBankQrModal = false;
  showOrderSuccess = false;
  createdOrder: Order | null = null;

  constructor(
    public cartService: CartService,
    private orderService: OrderService,
    private customRequestService: CustomRequestService,
    private paymentService: PaymentService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  clearError(field: string): void {
    if (this.errors[field]) {
      delete this.errors[field];
    }
  }

  selectPaymentMethod(method: PaymentMethodOption): void {
    if (!method.supported) return;
    this.paymentMethod = method.id;
  }

  validateShipping(): boolean {
    this.errors = {};

    if (!this.shipping.fullName.trim()) {
      this.errors['fullName'] = 'Vui lòng nhập họ và tên người nhận';
    } else if (this.shipping.fullName.trim().length < 2) {
      this.errors['fullName'] = 'Họ tên quá ngắn';
    }

    if (!this.shipping.phone.trim()) {
      this.errors['phone'] = 'Vui lòng nhập số điện thoại nhận hàng';
    } else if (!/^[0-9+ ]{9,13}$/.test(this.shipping.phone.trim())) {
      this.errors['phone'] = 'Số điện thoại không hợp lệ';
    }

    if (!this.shipping.email.trim()) {
      this.errors['email'] = 'Vui lòng nhập email để nhận tiến độ đơn';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.shipping.email.trim())) {
      this.errors['email'] = 'Địa chỉ email không đúng định dạng';
    }

    if (!this.shipping.city.trim()) {
      this.errors['city'] = 'Vui lòng nhập Tỉnh / Thành phố';
    }

    if (!this.shipping.district.trim()) {
      this.errors['district'] = 'Vui lòng nhập Quận / Huyện';
    }

    if (!this.shipping.street.trim()) {
      this.errors['street'] = 'Vui lòng nhập địa chỉ cụ thể';
    }

    return Object.keys(this.errors).length === 0;
  }

  placingOrder = false;
  placeOrderError = '';

  placeOrder(): void {
    if (this.cartService.checkoutItems().length === 0 || this.placingOrder) return;

    const method = this.paymentMethods.find(m => m.id === this.paymentMethod);
    if (!method?.supported) {
      this.placeOrderError = 'Phương thức thanh toán này chưa được hỗ trợ, vui lòng chọn phương thức khác.';
      return;
    }

    if (!this.validateShipping()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const items = [...this.cartService.checkoutItems()];
    this.placingOrder = true;
    this.placeOrderError = '';

    this.orderService.createOrder({
      items,
      shippingAddress: { ...this.shipping },
      // Đã guard "method.supported" ở trên nên tại đây paymentMethod chắc chắn là 1 trong 4 giá trị backend hỗ trợ.
      paymentMethod: this.paymentMethod as 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY',
      subtotal: this.cartService.checkoutSubtotal(),
      discount: this.cartService.checkoutDiscount(),
      shippingFee: this.cartService.checkoutShippingFee(),
      total: this.cartService.checkoutTotal(),
      notes: this.shipping.notes,
    }).subscribe({
      next: (newOrder) => {
        this.placingOrder = false;

        // Check if any items belong to a custom request, and convert to order
        items.forEach(item => {
          if (item.product.id.startsWith('custom-')) {
            const requestId = item.product.id.replace('custom-', '');
            this.customRequestService.markRequestConvertedToOrder(requestId);
          }
        });

        this.createdOrder = newOrder;
        // Chỉ xoá đúng các sản phẩm vừa đặt hàng — sản phẩm chưa chọn vẫn còn trong giỏ.
        this.cartService.removeItems(items.map(i => i.id));
        this.cartService.clearCheckoutSelection();

        if (this.paymentMethod === 'BANK_TRANSFER') {
          this.showBankQrModal = true;
        } else if (this.paymentMethod === 'MOMO') {
          this.redirectToMomo(newOrder.orderNumber);
        } else if (this.paymentMethod === 'ZALOPAY') {
          this.redirectToZaloPay(newOrder.orderNumber);
        } else {
          this.showOrderSuccess = true;
        }
      },
      error: (err) => {
        this.placingOrder = false;
        this.placeOrderError = 'Không tạo được đơn hàng, vui lòng thử lại. (' + (err?.message || 'lỗi kết nối') + ')';
      },
    });
  }

  private redirectToMomo(orderNumber: string): void {
    this.paymentService.createMomoPayment(orderNumber).subscribe({
      next: (res) => {
        if (res.success && res.payUrl) {
          window.location.href = res.payUrl;
        } else {
          this.placeOrderError = res.error || 'Không tạo được yêu cầu thanh toán MoMo';
        }
      },
      error: () => {
        this.placeOrderError = 'Không kết nối được tới cổng thanh toán MoMo';
      },
    });
  }

  private redirectToZaloPay(orderNumber: string): void {
    this.paymentService.createZaloPayPayment(orderNumber).subscribe({
      next: (res) => {
        if (res.success && res.orderUrl) {
          window.location.href = res.orderUrl;
        } else {
          this.placeOrderError = res.error || 'Không tạo được yêu cầu thanh toán ZaloPay';
        }
      },
      error: () => {
        this.placeOrderError = 'Không kết nối được tới cổng thanh toán ZaloPay';
      },
    });
  }

  getVietQrUrl(order: Order): string {
    const desc = encodeURIComponent(order.orderNumber);
    return `https://img.vietqr.io/image/MB-0988123456-compact2.png?amount=${order.total}&addInfo=${desc}&accountName=LUMÉA%20STUDIO`;
  }

  confirmBankTransferPaid(): void {
    if (this.createdOrder) {
      this.orderService.confirmPayment(this.createdOrder.orderNumber).subscribe(() => {
        this.router.navigate(['/orders/track'], { queryParams: { orderNumber: this.createdOrder!.orderNumber } });
      });
    }
  }

  navigateToTracking(): void {
    if (this.createdOrder) {
      this.router.navigate(['/orders/track'], { queryParams: { orderNumber: this.createdOrder.orderNumber } });
    }
  }

  closeOrderSuccess(): void {
    this.showOrderSuccess = false;
  }

  continueShoppingAfterOrder(): void {
    this.showOrderSuccess = false;
    this.router.navigate(['/catalog']);
  }
}
