import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoucherService } from '../../../../core/services/voucher.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AppIconComponent } from '../../../../components/icon/icon.component';

/** Hộp Quà Bí Ẩn: chọn 1 trong 3 hộp — phần thưởng do server bốc, 2 hộp còn lại chỉ hé lộ cho vui. */
@Component({
  selector: 'app-gift-box',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './gift-box.component.html',
  styleUrl: './gift-box.component.css'
})
export class GiftBoxComponent {
  @Input() playsLeft = 0;
  @Output() rewarded = new EventEmitter<string>();

  readonly boxes = [0, 1, 2];
  readonly picked = signal<number | null>(null);
  readonly opening = signal(false);
  /** Phần thưởng hiển thị trên từng hộp sau khi mở (index theo vị trí hộp). */
  readonly amounts = signal<(string | null)[]>([null, null, null]);

  constructor(private voucherService: VoucherService, private toastService: ToastService) {}

  async pick(index: number): Promise<void> {
    if (this.opening() || this.picked() !== null || this.playsLeft <= 0) return;
    this.opening.set(true);
    this.picked.set(index);

    try {
      const res = await this.voucherService.playGame('GIFT_BOX');
      const others = [...(res.otherBoxes ?? [])];
      // Chờ hoạt ảnh lắc hộp xong rồi mới mở nắp
      setTimeout(() => {
        this.amounts.set(this.boxes.map(i => (i === index ? res.label : others.shift() ?? null)));
        this.opening.set(false);
        this.playsLeft = res.playsLeft;
        this.rewarded.emit(res.voucher.title);
      }, 900);
    } catch (err: any) {
      this.opening.set(false);
      this.picked.set(null);
      this.toastService.error(err.message);
    }
  }

  isOpen(index: number): boolean {
    return this.amounts()[index] !== null;
  }
}
