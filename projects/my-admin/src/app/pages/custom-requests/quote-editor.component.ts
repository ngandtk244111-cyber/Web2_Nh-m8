import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { CustomRequest, DepositPolicy, Quote, QuoteItem } from '../../core/models/custom-request.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp', SENT: 'Đã gửi khách', ACCEPTED: 'Khách chấp nhận', REJECTED: 'Khách từ chối',
  EXPIRED: 'Hết hạn', SUPERSEDED: 'Đã thay thế',
};
const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'status-gray', SENT: 'status-blue', ACCEPTED: 'status-green', REJECTED: 'status-red',
  EXPIRED: 'status-yellow', SUPERSEDED: 'status-gray',
};

const emptyItem = (): QuoteItem => ({ name: '', material: '', size: '', description: '', quantity: 1, unitPrice: 0, discount: 0 });

/**
 * Soạn & gửi báo giá có phiên bản cho 1 yêu cầu đặt làm (my-admin).
 * Nhập hạng mục (số lượng, đơn giá, chiết khấu), chiết khấu toàn báo giá, số ngày sản xuất, mức cọc riêng
 * (có lý do). Tổng & tiền cọc hiển thị ở đây chỉ để xem trước — server tính lại và chốt khi gửi khách.
 * Báo giá đã gửi không sửa; muốn đổi thì tạo phiên bản mới (bản cũ chuyển "Đã thay thế").
 */
@Component({
  selector: 'app-quote-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe],
  templateUrl: './quote-editor.component.html',
  styleUrl: './quote-editor.component.css',
})
export class QuoteEditorComponent implements OnChanges {
  @Input({ required: true }) request!: CustomRequest;
  @Output() changed = new EventEmitter<void>();

  private readonly service = inject(CustomRequestService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  quotes: Quote[] = [];
  policy: DepositPolicy | null = null;
  loading = false;
  busy = false;
  /** Đang mở form soạn (bản nháp có sẵn hoặc phiên bản mới). */
  editing = false;
  draftVersion: number | null = null;

  items: QuoteItem[] = [emptyItem()];
  quoteDiscount = 0;
  estimatedDays = 7;
  note = '';
  overrideOn = false;
  overrideAmount: number | null = null;
  overrideReason = '';

  private loadedKey = '';

  ngOnChanges(): void {
    const key = `${this.request?.id}|${this.request?.status}|${this.request?.currentQuoteVersion}`;
    if (key !== this.loadedKey) {
      this.loadedKey = key;
      this.load();
    }
  }

  get canEdit(): boolean {
    return this.adminAuth.can('custom3d.edit');
  }

  /** Yêu cầu đã huỷ / đã thành đơn thì không soạn báo giá mới. */
  get locked(): boolean {
    return this.request.status === 'REJECTED' || this.request.status === 'CONVERTED_TO_ORDER';
  }

  get draft(): Quote | undefined {
    return this.quotes.find(q => q.status === 'DRAFT');
  }

  get latestSent(): Quote | undefined {
    return this.quotes.find(q => q.status !== 'DRAFT');
  }

  statusLabel(s: string): string { return STATUS_LABELS[s] || s; }
  statusClass(s: string): string { return STATUS_CLASSES[s] || 'status-gray'; }

  isExpired(q: Quote): boolean {
    return q.status === 'SENT' && !!q.validUntil && new Date(q.validUntil).getTime() <= Date.now();
  }

  private load(): void {
    this.loading = true;
    this.service.getQuotes(this.request.id).subscribe({
      next: res => {
        this.loading = false;
        this.quotes = res.quotes || [];
        this.policy = res.policy;
        const d = this.draft;
        if (d) this.fillFrom(d, d.version);
        else if (!this.editing) this.draftVersion = null;
      },
      error: err => {
        this.loading = false;
        this.toast.apiError(err, 'Không tải được báo giá');
      },
    });
  }

  private fillFrom(q: Quote, draftVersion: number | null): void {
    this.items = q.items.map(i => ({ ...i }));
    this.quoteDiscount = q.quoteDiscount || 0;
    this.estimatedDays = q.estimatedDays;
    this.note = q.note || '';
    const ov = q.depositOverride || (q.deposit?.overridden ? { amount: q.deposit.amount, reason: q.deposit.overrideReason || '' } : null);
    this.overrideOn = !!ov;
    this.overrideAmount = ov?.amount ?? null;
    this.overrideReason = ov?.reason || '';
    this.draftVersion = draftVersion;
    this.editing = draftVersion !== null;
  }

  /** Mở form: phiên bản mới sao chép từ báo giá gần nhất (nếu có), hoặc điền sẵn từ brief của khách. */
  startNew(): void {
    const base = this.latestSent;
    if (base) {
      this.fillFrom(base, null);
    } else {
      const b = this.request.brief;
      this.items = [{
        ...emptyItem(),
        name: b.productType || this.request.title,
        material: (b as { printMaterial?: string }).printMaterial || '',
        size: b.size || '',
      }];
      this.quoteDiscount = 0;
      this.estimatedDays = 7;
      this.note = '';
      this.overrideOn = false;
      this.overrideAmount = null;
      this.overrideReason = '';
      this.draftVersion = null;
    }
    this.editing = true;
  }

  cancelEdit(): void {
    this.editing = false;
    this.load();
  }

  addItem(): void { this.items.push(emptyItem()); }
  removeItem(i: number): void { if (this.items.length > 1) this.items.splice(i, 1); }

  // ---- Xem trước (server tính lại khi lưu / gửi) ----
  lineTotal(i: QuoteItem): number {
    return Math.max(0, (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) - (Number(i.discount) || 0));
  }
  get subtotal(): number { return this.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0); }
  get itemDiscount(): number { return this.items.reduce((s, i) => s + (Number(i.discount) || 0), 0); }
  get total(): number { return Math.max(0, this.subtotal - this.itemDiscount - (Number(this.quoteDiscount) || 0)); }

  /** Cọc mặc định: min(tổng, làm tròn lên 1.000đ của max(tổng × %, tối thiểu)). */
  get defaultDeposit(): number {
    const p = this.policy;
    if (!p || this.total <= 0) return 0;
    const raw = Math.max(Math.ceil((this.total * p.defaultDepositRate) / 100), p.minimumDepositAmount);
    return Math.min(this.total, Math.ceil(raw / 1000) * 1000);
  }
  get previewDeposit(): number {
    return this.overrideOn && this.overrideAmount ? Number(this.overrideAmount) : this.defaultDeposit;
  }

  private input() {
    return {
      items: this.items.map(i => ({
        name: i.name.trim(), material: (i.material || '').trim(), size: (i.size || '').trim(), description: (i.description || '').trim(),
        quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount) || 0,
      })),
      quoteDiscount: Number(this.quoteDiscount) || 0,
      estimatedDays: Number(this.estimatedDays),
      note: this.note.trim(),
      depositOverride: this.overrideOn && this.overrideAmount ? { amount: Number(this.overrideAmount), reason: this.overrideReason.trim() } : null,
    };
  }

  saveDraft(thenSend = false): void {
    if (this.busy) return;
    this.busy = true;
    this.service.saveQuoteDraft(this.request.id, this.input(), this.draftVersion ?? undefined).subscribe({
      next: quote => {
        this.draftVersion = quote.version;
        if (thenSend) {
          this.send(quote.version);
          return;
        }
        this.busy = false;
        this.toast.success(`Đã lưu bản nháp báo giá phiên bản ${quote.version}`);
        this.load();
      },
      error: err => {
        this.busy = false;
        this.toast.apiError(err, 'Không lưu được báo giá');
      },
    });
  }

  async saveAndSend(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Gửi báo giá cho khách?',
      message: `Tổng ${this.total.toLocaleString('vi-VN')}đ, cọc khoảng ${this.previewDeposit.toLocaleString('vi-VN')}đ. Sau khi gửi không sửa được — muốn đổi phải tạo phiên bản mới. Báo giá đang gửi trước đó (nếu có) sẽ hết hiệu lực.`,
      confirmLabel: 'Gửi báo giá',
      icon: 'bi-send',
    });
    if (ok) this.saveDraft(true);
  }

  private send(version: number): void {
    this.service.sendQuote(this.request.id, version).subscribe({
      next: res => {
        this.busy = false;
        this.editing = false;
        this.toast.success(`Đã gửi báo giá v${res.quote.version}: ${res.quote.total.toLocaleString('vi-VN')}đ, cọc ${res.quote.deposit?.amount.toLocaleString('vi-VN')}đ`);
        this.load();
        this.changed.emit();
      },
      error: err => {
        this.busy = false;
        this.toast.apiError(err, 'Đã lưu nháp nhưng chưa gửi được báo giá');
        this.load();
      },
    });
  }
}
