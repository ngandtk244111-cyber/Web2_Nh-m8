import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomRequest, DepositPolicy, Quote } from '../../core/models/custom-request.model';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { AuthService } from '../../core/services/auth.service';
import { AddressService } from '../../core/services/address.service';
import { ToastService } from '../../core/services/toast.service';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

const STATUS_LABELS: Record<string, string> = {
  SENT: 'Chờ bạn phản hồi',
  ACCEPTED: 'Bạn đã chấp nhận',
  REJECTED: 'Bạn đã từ chối',
  EXPIRED: 'Đã hết hạn',
  SUPERSEDED: 'Đã có phiên bản mới',
};

/**
 * Báo giá đặt làm phía khách: xem báo giá có phiên bản (hạng mục, chiết khấu, tiền cọc, hạn hiệu lực),
 * chấp nhận (bắt buộc đồng ý chính sách cọc) / từ chối, rồi đặt hàng ngay trong trang.
 * Giá và tiền cọc do server tính từ báo giá — trang chỉ hiển thị, không gửi số tiền lên.
 */
@Component({
  selector: 'app-quote-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './quote-panel.component.html',
  styleUrl: './quote-panel.component.css',
})
export class QuotePanelComponent implements OnChanges {
  @Input({ required: true }) request!: CustomRequest;
  @Output() requestChanged = new EventEmitter<CustomRequest>();

  private readonly service = inject(CustomRequestService);
  private readonly authService = inject(AuthService);
  readonly addressService = inject(AddressService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  quotes: Quote[] = [];
  policy: DepositPolicy | null = null;
  loading = false;
  agree = false;
  busy = false;
  showReject = false;
  rejectReason = '';
  showOld = false;

  shipping = { fullName: '', phone: '', email: '', street: '', district: '', city: '', notes: '' };
  balanceMethod: 'COD' | 'BANK_TRANSFER' = 'COD';
  notes = '';
  private loadedKey = '';

  ngOnChanges(): void {
    const key = `${this.request?.id}|${this.request?.status}|${this.request?.currentQuoteVersion}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    this.prefillShipping();
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.service.getQuotes(this.request.id).subscribe({
      next: res => {
        this.loading = false;
        this.quotes = res.quotes || [];
        this.policy = res.policy;
      },
      error: () => (this.loading = false),
    });
  }

  private prefillShipping(): void {
    if (this.shipping.fullName) return;
    const user = this.authService.currentUser() as { fullName?: string; phone?: string; email?: string } | null;
    this.shipping.fullName = this.request.customerName || user?.fullName || '';
    this.shipping.phone = this.request.customerPhone || user?.phone || '';
    this.shipping.email = this.request.customerEmail || user?.email || '';
    const saved = this.addressService.addresses();
    const def = saved.find(a => a.isDefault) || saved[0];
    if (def) this.useAddress(def._id);
  }

  useAddress(id: string): void {
    const a = this.addressService.addresses().find(x => x._id === id);
    if (!a) return;
    Object.assign(this.shipping, {
      fullName: a.fullName, phone: a.phone, street: [a.address, a.ward].filter(Boolean).join(', '), district: a.district, city: a.city,
    });
  }

  /** Báo giá hiện hành = phiên bản mới nhất khách nhìn thấy. */
  get current(): Quote | null {
    return this.quotes[0] || null;
  }

  get olderQuotes(): Quote[] {
    return this.quotes.slice(1);
  }

  get loggedIn(): boolean {
    return !!this.authService.currentUser();
  }

  get isExpired(): boolean {
    const q = this.current;
    return !!q?.validUntil && new Date(q.validUntil).getTime() <= Date.now();
  }

  get canRespond(): boolean {
    return this.current?.status === 'SENT' && !this.isExpired && this.current.version === this.request.currentQuoteVersion;
  }

  get canCheckout(): boolean {
    return this.current?.status === 'ACCEPTED' && this.request.status === 'APPROVED' && !this.isExpired;
  }

  statusLabel(q: Quote): string {
    if (q.status === 'SENT' && q.validUntil && new Date(q.validUntil).getTime() <= Date.now()) return STATUS_LABELS['EXPIRED'];
    return STATUS_LABELS[q.status] || q.status;
  }

  accept(): void {
    const q = this.current;
    if (!q || !this.agree || this.busy) return;
    this.busy = true;
    this.service.acceptQuote(this.request.id, q.version).subscribe({
      next: r => {
        this.busy = false;
        this.toast.success('Đã chấp nhận báo giá. Vui lòng điền thông tin nhận hàng để đặt đơn.');
        this.requestChanged.emit(r);
      },
      error: err => {
        this.busy = false;
        this.toast.error(err?.error?.error || 'Không chấp nhận được báo giá');
        this.load();
      },
    });
  }

  reject(): void {
    const q = this.current;
    if (!q || this.busy) return;
    this.busy = true;
    this.service.rejectQuote(this.request.id, q.version, this.rejectReason.trim()).subscribe({
      next: r => {
        this.busy = false;
        this.showReject = false;
        this.toast.success('Đã gửi phản hồi. Shop sẽ trao đổi thêm và gửi báo giá mới nếu cần.');
        this.requestChanged.emit(r);
      },
      error: err => {
        this.busy = false;
        this.toast.error(err?.error?.error || 'Không gửi được phản hồi');
      },
    });
  }

  get shippingValid(): boolean {
    const s = this.shipping;
    return !!s.fullName.trim() && /^(0|\+84)\d{9,10}$/.test(s.phone.replace(/[\s.]/g, '')) && !!s.street.trim() && !!s.district.trim() && !!s.city.trim();
  }

  checkout(): void {
    const q = this.current;
    if (!q || !this.canCheckout || !this.shippingValid || this.busy) return;
    this.busy = true;
    this.service.checkout(this.request.id, {
      quoteVersion: q.version,
      balanceMethod: this.balanceMethod,
      notes: this.notes.trim(),
      shippingAddress: { ...this.shipping, phone: this.shipping.phone.replace(/[\s.]/g, '') },
    }).subscribe({
      next: order => {
        this.busy = false;
        this.toast.success(`Đã tạo đơn ${order.orderNumber}. Vui lòng thanh toán cọc để shop bắt đầu sản xuất.`);
        this.router.navigate(['/orders/track'], { queryParams: { orderNumber: order.orderNumber } });
      },
      error: err => {
        this.busy = false;
        this.toast.error(err?.error?.error || 'Không đặt được đơn, vui lòng thử lại');
      },
    });
  }
}
