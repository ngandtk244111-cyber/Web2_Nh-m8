import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { PaymentService } from '../../core/services/payment.service';
import { Order } from '../../core/models/order.model';
import { CheckoutFlowService } from '../../core/services/checkout-flow.service';
import { AddressService } from '../../core/services/address.service';
import { VNLocation } from '../../core/models/address.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { CheckoutStepsComponent } from '../../components/checkout-steps/checkout-steps.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotService } from '../../core/services/mascot.service';

export type PaymentMethodId = 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'CARD' | 'VNPAY' | 'ATM';
type SupportedPaymentMethodId = 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'ATM';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  icon: string;
  /** Badge màu thương hiệu thay cho app-icon khi có (dùng khi chưa có logo ảnh thật). */
  badge?: { text: string; bg: string; color: string };
  /** Logo/icon ảnh thật (PNG) hiển thị thay cho app-icon/badge khi có — ưu tiên cao nhất. */
  image?: string;
  /** false = chưa có backend thật, chỉ dựng UI, không cho chọn/đặt hàng. */
  supported: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'COD', label: 'Thanh toán khi nhận hàng (COD)', description: 'Kiểm tra sản phẩm tận tay rồi thanh toán tiền mặt cho bưu tá.', icon: 'cash', image: 'assets/payment-methods/cash.png', supported: true },
  { id: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng / QR', description: 'Quét mã VietQR qua app ngân hàng bất kỳ, xác nhận nhanh, không mất phí.', icon: 'qr-code', image: 'assets/payment-methods/bank-transfer.png', supported: true },
  { id: 'MOMO', label: 'Ví MoMo', description: 'Chuyển sang cổng thanh toán MoMo.', icon: 'credit-card', image: 'assets/payment-methods/momo.png', supported: true },
  { id: 'ZALOPAY', label: 'Ví ZaloPay', description: 'Chuyển sang cổng thanh toán ZaloPay.', icon: 'credit-card', image: 'assets/payment-methods/zalopay.png', supported: true },
  { id: 'CARD', label: 'Thẻ quốc tế Visa / Mastercard', description: 'Sắp ra mắt — Luméa chưa tích hợp cổng thanh toán thẻ quốc tế.', icon: 'credit-card', supported: false },
  { id: 'VNPAY', label: 'Cổng VNPay', description: 'Sắp ra mắt — Luméa chưa tích hợp VNPay.', icon: 'bank', supported: false },
  { id: 'ATM', label: 'Thẻ ATM nội địa / NAPAS', description: 'Thanh toán bằng thẻ ATM nội địa qua cổng MoMo.', icon: 'credit-card', image: 'assets/payment-methods/atm-card.png', supported: true },
];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, CheckoutStepsComponent, VndPipe],
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

  districts = signal<VNLocation[]>([]);

  showBankQrModal = false;
  showOrderSuccess = false;
  createdOrder: Order | null = null;

  constructor(
    public cartService: CartService,
    public flow: CheckoutFlowService,
    public addressService: AddressService,
    private orderService: OrderService,
    private customRequestService: CustomRequestService,
    private paymentService: PaymentService,
    private router: Router,
    private mascotService: MascotService
  ) {}

  onProvinceChange(): void {
    const p = this.addressService.provinces().find(x => x.name === this.shipping.city);
    this.districts.set([]);
    this.shipping.district = '';
    if (p) {
      this.addressService.getDistricts(p.code).subscribe(res => this.districts.set(res.districts || []));
    }
  }

  ngOnInit(): void {
    this.addressService.loadProvinces();
    // Phòng trường hợp còn kẹt ở Bước 4 (khoá) từ một đơn đã đặt trước đó trong cùng phiên SPA
    // nhưng lại vào /checkout theo cách khác "Tiếp tục mua sắm" (component instance mới, createdOrder rỗng) —
    // tránh màn hình trắng vì cả 2 khối bước 2/3 lẫn modal bước 4 đều không có điều kiện để hiển thị.
    if (this.flow.currentStep() === 4 && !this.createdOrder) {
      this.flow.reset();
    }
    // Chỉ nâng lên Bước 2 nếu đang thực sự ở Bước 1 (vào lần đầu từ giỏ hàng) — nếu đã ở giữa
    // luồng (Bước 2/3 do điều hướng qua lại bằng Stepper) thì giữ nguyên, không ép về lại Bước 2.
    if (this.cartService.checkoutItems().length > 0) {
      this.flow.enterCheckoutPageFromCart();
    }
  }

  /**
   * Hàm điều hướng bước DUY NHẤT dùng cho các nút "Quay lại" trong trang thanh toán.
   * Luôn hợp lệ vì chỉ dùng để lùi về một bước đã hoàn thành trước đó.
   */
  goToStep(step: 1 | 2): void {
    this.flow.goToStep(step);
    if (step === 1) {
      this.router.navigate(['/cart']);
    }
  }

  /**
   * Nút hành động chính đổi chức năng theo bước hiện tại:
   * Bước 2 -> validate thông tin nhận hàng rồi tiến sang Bước 3.
   * Bước 3 -> đặt hàng thật sự.
   */
  handlePrimaryAction(): void {
    if (this.flow.currentStep() === 2) {
      const ok = this.flow.goToStep(3, { validate: () => this.validateShipping() });
      if (!ok) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (this.flow.currentStep() === 3) {
      this.placeOrder();
    }
  }

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
      this.errors['city'] = 'Vui lòng chọn Tỉnh / Thành phố';
    }

    if (!this.shipping.district.trim()) {
      this.errors['district'] = 'Vui lòng chọn Quận / Huyện';
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
    this.mascotService.beginLoading({ immediate: true });

    this.orderService.createOrder({
      items,
      shippingAddress: { ...this.shipping },
      // Đã guard "method.supported" ở trên nên tại đây paymentMethod chắc chắn nằm trong các giá trị backend hỗ trợ.
      paymentMethod: this.paymentMethod as SupportedPaymentMethodId,
      subtotal: this.cartService.checkoutSubtotal(),
      discount: this.cartService.checkoutDiscount(),
      shippingFee: this.cartService.checkoutShippingFee(),
      total: this.cartService.checkoutTotal(),
      couponCode: this.cartService.appliedCoupon()?.code,
      notes: this.shipping.notes,
    }).subscribe({
      next: (newOrder) => {
        this.placingOrder = false;
        this.mascotService.endLoading('happy');

        // Check if any items belong to a custom request, and convert to order
        items.forEach(item => {
          if (item.product.id.startsWith('custom-')) {
            const requestId = item.product.id.replace('custom-', '');
            this.customRequestService.markRequestConvertedToOrder(requestId);
          }
        });

        this.createdOrder = newOrder;
        // Đặt hàng thành công -> tiến sang Bước 4 (Hoàn tất), khoá Stepper lại.
        this.flow.goToStep(4, { validate: () => true });
        // Chỉ xoá đúng các sản phẩm vừa đặt hàng — sản phẩm chưa chọn vẫn còn trong giỏ.
        this.cartService.removeItems(items.map(i => i.id));
        this.cartService.clearCheckoutSelection();

        if (this.paymentMethod === 'BANK_TRANSFER') {
          this.showBankQrModal = true;
        } else if (this.paymentMethod === 'MOMO' || this.paymentMethod === 'ATM') {
          this.redirectToMomo(newOrder.orderNumber, this.paymentMethod === 'ATM' ? 'atm' : 'momo');
        } else if (this.paymentMethod === 'ZALOPAY') {
          this.redirectToZaloPay(newOrder.orderNumber);
        } else {
          this.showOrderSuccess = true;
        }
      },
      error: (err) => {
        this.placingOrder = false;
        this.mascotService.endLoading('sad');
        this.placeOrderError = 'Không tạo được đơn hàng, vui lòng thử lại. (' + (err?.message || 'lỗi kết nối') + ')';
      },
    });
  }

  private redirectToMomo(orderNumber: string, method: 'momo' | 'atm' = 'momo'): void {
    this.paymentService.createMomoPayment(orderNumber, method).subscribe({
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
    // Duy nhất hành động này được phép thoát khỏi Bước 4 — trả luồng Stepper về trạng thái sạch
    // (Bước 1) để sẵn sàng cho một lượt mua hàng mới.
    this.flow.reset();
    this.router.navigate(['/catalog']);
  }
}
