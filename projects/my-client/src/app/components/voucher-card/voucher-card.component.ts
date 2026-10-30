import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../icon/icon.component';
import { ToastService } from '../../core/services/toast.service';
import { isVoucherUsable } from '../../core/services/voucher.service';
import { UserVoucher } from '../../core/models/voucher.model';

/**
 * Thẻ voucher kiểu vé (giống ví voucher của sàn TMĐT). Mặc định có nút sao chép mã;
 * truyền [selectable]="true" để thành ô chọn voucher trong giỏ hàng.
 */
@Component({
  selector: 'app-voucher-card',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './voucher-card.component.html',
  styleUrl: './voucher-card.component.css'
})
export class VoucherCardComponent {
  @Input({ required: true }) voucher!: UserVoucher;
  @Input() selectable = false;
  @Input() selected = false;
  /** Lý do chưa áp dụng được (vd chưa đủ giá trị đơn tối thiểu) — có thì làm mờ thẻ. */
  @Input() disabledReason: string | null = null;
  @Output() pick = new EventEmitter<UserVoucher>();

  constructor(private toast: ToastService) {}

  get usable(): boolean {
    return isVoucherUsable(this.voucher);
  }

  get statusLabel(): string | null {
    if (this.voucher.usedAt) return this.voucher.usedOrderNumber ? `Đã dùng · ${this.voucher.usedOrderNumber}` : 'Đã dùng';
    if (!this.usable) return 'Hết hạn';
    return null;
  }

  onClick(): void {
    if (this.selectable && this.usable && !this.disabledReason) this.pick.emit(this.voucher);
  }

  copy(event: Event): void {
    event.stopPropagation();
    navigator.clipboard?.writeText(this.voucher.code).then(
      () => this.toast.success(`Đã sao chép mã ${this.voucher.code}`),
      () => this.toast.info(`Mã voucher: ${this.voucher.code}`)
    );
  }
}
