import { Component, HostListener, OnInit, signal, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService, invoiceUrl } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
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
import QRCode from 'qrcode';
import { VoucherPickerComponent } from '../../components/voucher-picker/voucher-picker.component';

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
  imports: [VoucherPickerComponent, CommonModule, FormsModule, RouterLink, AppIconComponent, CheckoutStepsComponent, VndPipe],
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
  private readonly authService = inject(AuthService);

  /** Yêu cầu xuất hoá đơn điện tử — thông tin này được in lên hoá đơn PDF. */
  invoice = {
    requested: false,
    type: 'personal' as 'personal' | 'company',
    email: '',
    companyName: '',
    taxCode: '',
    companyAddress: '',
  };

  /** Bật hoá đơn: điền sẵn email nhận hoá đơn bằng email giao hàng (nếu có). */
  onInvoiceToggle(): void {
    if (this.invoice.requested && !this.invoice.email) this.invoice.email = this.shipping.email || '';
    if (!this.invoice.requested) {
      for (const k of ['invoiceEmail', 'invoiceCompany', 'invoiceTax', 'invoiceAddress']) delete this.errors[k];
    }
  }

  /** Kiểm tra thông tin hoá đơn; trả về false nếu còn lỗi (lỗi hiện ngay dưới từng ô). */
  private validateInvoice(): boolean {
    for (const k of ['invoiceEmail', 'invoiceCompany', 'invoiceTax', 'invoiceAddress']) delete this.errors[k];
    if (!this.invoice.requested) return true;
    const inv = this.invoice;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inv.email.trim())) this.errors['invoiceEmail'] = 'Email nhận hóa đơn không hợp lệ';
    if (inv.type === 'company') {
      if (!inv.companyName.trim()) this.errors['invoiceCompany'] = 'Vui lòng nhập tên công ty';
      if (!/^\d{10}(-\d{3})?$/.test(inv.taxCode.trim())) this.errors['invoiceTax'] = 'Mã số thuế gồm 10 chữ số';
      if (!inv.companyAddress.trim()) this.errors['invoiceAddress'] = 'Vui lòng nhập địa chỉ công ty';
    }
    return !['invoiceEmail', 'invoiceCompany', 'invoiceTax', 'invoiceAddress'].some(k => this.errors[k]);
  }

  invoiceLink(orderNumber: string): string {
    return invoiceUrl(orderNumber, this.authService.token);
  }
  readonly paymentMethods = PAYMENT_METHODS;
  paymentMethod: PaymentMethodId = 'COD';

  districts = signal<VNLocation[]>([]);

  showBankQrModal = false;
  /** Ảnh QR minh hoạ (data URL) của hộp chuyển khoản. */
  bankQrDataUrl = '';
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
    private mascotService: MascotService,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  /**
   * Bấm Back từ cổng thanh toán: trình duyệt có thể khôi phục trang cũ từ bộ nhớ đệm (bfcache) với giao diện
   * lúc rời đi -> tải lại để ngOnInit đọc ?doiPhuongThuc và mở hộp chọn phương thức khác cho đơn chưa trả tiền.
   */
  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent): void {
    if (event.persisted && this.route.snapshot.queryParamMap.has('doiPhuongThuc')) {
      window.location.reload();
    }
  }

  /** Trước khi sang cổng thanh toán: ghi mã đơn vào URL hiện tại để Back quay về đúng đơn này (chọn phương thức khác). */
  private rememberPendingOrder(orderNumber: string): void {
    this.location.replaceState('/checkout', `doiPhuongThuc=${encodeURIComponent(orderNumber)}`);
  }

  /* ---------- Đổi phương thức thanh toán cho đơn vừa đặt ---------- */
  switchOpen = false;
  switchMethod: PaymentMethodId = 'COD';
  switchBusy = false;
  switchError = '';
  /** Mở từ link "Chọn phương thức khác" (cổng thanh toán / trang kết quả) chứ không phải ngay sau khi đặt. */
  private switchFromLink = false;

  readonly switchableMethods = PAYMENT_METHODS.filter(m => m.supported);

  /** Đơn chưa trả tiền và chưa giao/huỷ thì được đổi phương thức. */
  get canSwitchMethod(): boolean {
    const o = this.createdOrder;
    return !!o && o.paymentStatus !== 'PAID' && ['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(o.status);
  }

  openSwitch(): void {
    if (!this.createdOrder) return;
    this.showBankQrModal = false;
    this.showOrderSuccess = false;
    this.switchMethod = this.createdOrder.paymentMethod as PaymentMethodId;
    this.switchError = '';
    this.switchOpen = true;
  }

  /** Đóng hộp đổi phương thức: quay lại màn hình của phương thức hiện tại. */
  closeSwitch(): void {
    if (this.switchBusy) return;
    this.switchOpen = false;
    if (this.switchFromLink) {
      this.navigateToTracking();
      return;
    }
    if (this.createdOrder?.paymentMethod === 'BANK_TRANSFER') this.showBankQrModal = true;
    else this.showOrderSuccess = true;
  }

  confirmSwitch(): void {
    const order = this.createdOrder;
    if (!order || this.switchBusy) return;
    this.switchBusy = true;
    this.switchError = '';
    this.orderService.changePaymentMethod(order.orderNumber, this.switchMethod).subscribe({
      next: updated => {
        this.switchBusy = false;
        this.switchOpen = false;
        this.switchFromLink = false;
        // Đã đổi xong: bỏ ?doiPhuongThuc khỏi URL để tải lại trang không mở lại hộp chọn
        this.location.replaceState('/checkout');
        this.createdOrder = updated;
        this.paymentMethod = updated.paymentMethod as PaymentMethodId;
        this.continuePayment(updated);
      },
      error: err => {
        this.switchBusy = false;
        this.switchError = err?.error?.error || 'Không đổi được phương thức thanh toán, vui lòng thử lại.';
      },
    });
  }

  /** Tiếp tục bước trả tiền theo phương thức hiện tại của đơn. */
  private continuePayment(order: Order): void {
    const method = order.paymentMethod;
    if (method === 'BANK_TRANSFER') {
      this.buildDemoQr(order);
      this.showBankQrModal = true;
    } else if (method === 'MOMO' || method === 'ATM') {
      this.redirectToMomo(order.orderNumber, method === 'ATM' ? 'atm' : 'momo', () => {});
    } else if (method === 'ZALOPAY') {
      this.redirectToZaloPay(order.orderNumber, () => {});
    } else {
      this.showOrderSuccess = true;
    }
  }

  /** Vào /checkout?doiPhuongThuc=<mã đơn>: mở lại đơn chưa thanh toán để chọn phương thức khác. */
  private openSwitchFromLink(orderNumber: string): void {
    this.orderService.getOrderByNumber(orderNumber).subscribe(order => {
      if (!order) return;
      this.createdOrder = order;
      this.paymentMethod = order.paymentMethod as PaymentMethodId;
      if (!this.canSwitchMethod) {
        this.navigateToTracking();
        return;
      }
      this.flow.enterFinished();
      this.switchFromLink = true;
      this.openSwitch();
    });
  }

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
    const switchOrder = this.route.snapshot.queryParamMap.get('doiPhuongThuc');
    if (switchOrder) {
      this.openSwitchFromLink(switchOrder);
      return;
    }
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

    // Email không bắt buộc — chỉ kiểm tra định dạng khi khách có nhập.
    if (this.shipping.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.shipping.email.trim())) {
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

    this.validateInvoice();
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
      invoice: this.invoice.requested ? {
        requested: true,
        type: this.invoice.type,
        email: this.invoice.email.trim(),
        companyName: this.invoice.companyName.trim(),
        taxCode: this.invoice.taxCode.trim(),
        companyAddress: this.invoice.companyAddress.trim(),
      } : null,
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
        const finish = () => {
          // Đặt hàng thành công -> tiến sang Bước 4 (Hoàn tất), khoá Stepper lại.
          this.flow.goToStep(4, { validate: () => true });
          // Chỉ xoá đúng các sản phẩm vừa đặt hàng — sản phẩm chưa chọn vẫn còn trong giỏ.
          this.cartService.removeItems(items.map(i => i.id));
          this.cartService.clearCheckoutSelection();
          // Mỗi mã chỉ dùng 1 lần: dùng xong thì xoá khỏi danh sách mã của khách.
          this.cartService.consumeAppliedCoupon();
        };

        // Ví / cổng online: chỉ dọn giỏ khi đã tạo được giao dịch. Cổng lỗi thì server huỷ đơn + trả mã,
        // khách ở lại bước thanh toán với giỏ hàng và mã giảm giá như cũ để chọn phương thức khác.
        if (this.paymentMethod === 'MOMO' || this.paymentMethod === 'ATM') {
          this.redirectToMomo(newOrder.orderNumber, this.paymentMethod === 'ATM' ? 'atm' : 'momo', finish);
          return;
        }
        if (this.paymentMethod === 'ZALOPAY') {
          this.redirectToZaloPay(newOrder.orderNumber, finish);
          return;
        }
        finish();
        if (this.paymentMethod === 'BANK_TRANSFER') {
          this.buildDemoQr(newOrder);
          this.showBankQrModal = true;
        } else {
          this.showOrderSuccess = true;
        }
      },
      error: (err) => {
        this.placingOrder = false;
        this.mascotService.endLoading('sad');
        // Lỗi mã giảm giá (đã dùng, hết hạn, chưa đủ giá trị...) thì hiện đúng thông điệp của server.
        this.placeOrderError = err?.error?.error || 'Không tạo được đơn hàng, vui lòng thử lại. (' + (err?.message || 'lỗi kết nối') + ')';
      },
    });
  }

  private redirectToMomo(orderNumber: string, method: 'momo' | 'atm', onReady: () => void): void {
    this.paymentService.createMomoPayment(orderNumber, method).subscribe({
      next: (res) => {
        if (res.success && res.payUrl) {
          onReady();
          this.rememberPendingOrder(orderNumber);
          window.location.href = res.payUrl;
        } else {
          this.onGatewayFailed(res.error || 'Không tạo được yêu cầu thanh toán MoMo');
        }
      },
      error: (err) => this.onGatewayFailed(err?.error?.error || 'Không kết nối được tới cổng thanh toán MoMo'),
    });
  }

  private redirectToZaloPay(orderNumber: string, onReady: () => void): void {
    this.paymentService.createZaloPayPayment(orderNumber).subscribe({
      next: (res) => {
        if (res.success && res.orderUrl) {
          onReady();
          this.rememberPendingOrder(orderNumber);
          window.location.href = res.orderUrl;
        } else {
          this.onGatewayFailed(res.error || 'Không tạo được yêu cầu thanh toán ZaloPay');
        }
      },
      error: (err) => this.onGatewayFailed(err?.error?.error || 'Không kết nối được tới cổng thanh toán ZaloPay'),
    });
  }

  /** Cổng thanh toán lỗi: đơn đã bị huỷ ở server, mã giảm giá được trả lại -> cho khách chọn phương thức khác. */
  private onGatewayFailed(message: string): void {
    this.createdOrder = null;
    this.placeOrderError = message;
    this.cartService.loadShopCoupons();
  }

  /**
   * Mã QR chuyển khoản chỉ là minh hoạ trong phạm vi đồ án môn học: quét bằng camera điện thoại sẽ hiện
   * thông tin đồ án và phạm vi thanh toán, không phải VietQR thật (tránh khách quét rồi chuyển tiền thật).
   */
  private buildDemoQr(order: Order): void {
    this.bankQrDataUrl = '';
    const amount = order.total.toLocaleString('vi-VN') + 'đ';
    // Giữ nội dung ngắn để mã QR thưa, camera điện thoại quét dễ.
    const text = [
      'ĐỒ ÁN MÔN HỌC WEB 2 - NHÓM 8',
      'Website Luméa: nội thất & decor 3D',
      'QR minh hoạ trong phạm vi đồ án - KHÔNG chuyển tiền thật.',
      `Đơn ${order.orderNumber} | ${amount}`,
      'Thanh toán trong đồ án: COD, chuyển khoản (giả lập), MoMo/ZaloPay (sandbox).',
    ].join('\n');
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#3a2326', light: '#ffffff' } })
      .then(url => (this.bankQrDataUrl = url))
      .catch(() => (this.bankQrDataUrl = ''));
  }

  confirmBankTransferPaid(): void {
    if (this.createdOrder) {
      this.orderService.confirmPayment(this.createdOrder.orderNumber, this.createdOrder.shippingAddress.phone).subscribe(() => {
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
