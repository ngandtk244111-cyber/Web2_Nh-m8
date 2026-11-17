import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomRequest, DepositPolicy, Quote } from '../../core/models/custom-request.model';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { AuthService } from '../../core/services/auth.service';
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

/** Báo giá đặt làm phía khách */
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
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  quotes: Quote[] = [];
  policy: DepositPolicy | null = null;
  loading = false;
  error = '';
  agree = false;
  busy = false;
  showReject = false;
  rejectReason = '';
  showOld = false;

  private loadedKey = '';

  ngOnChanges(): void {
    const key = `${this.request?.id}|${this.request?.status}|${this.request?.currentQuoteVersion}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.service.getQuotes(this.request.id).subscribe({
      next: res => {
        this.loading = false;
        this.quotes = res.quotes || [];
        this.policy = res.policy;
      },
      error: () => { this.loading = false; this.error = 'Không tải được báo giá. Vui lòng thử lại.'; },
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
    return this.current?.status === 'ACCEPTED' && (this.request.status === 'APPROVED' || this.request.status === 'PREVIEW_READY') && !this.isExpired;
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
        this.toast.success('Đã chấp nhận báo giá. Vui lòng hoàn tất thông tin nhận hàng và thanh toán cọc.');
        this.requestChanged.emit(r);
        this.goToCheckout(q);
      },
      error: err => {
        this.busy = false;
        this.toast.error(err?.error?.error || 'Không chấp nhận được báo giá');
        this.load();
      },
    });
  }

  /** Mang báo giá sang trang thanh toán chung (/checkout) như hàng trong giỏ — truyền qua state, URL giữ nguyên. */
  goToCheckout(q: Quote): void {
    this.router.navigate(['/checkout'], { state: { quoteCheckout: { requestId: this.request.id, version: q.version } } });
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
}
