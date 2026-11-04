import { Component, ElementRef, HostListener, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { VoucherCardComponent } from '../voucher-card/voucher-card.component';
import { CartService } from '../../core/services/cart.service';
import { VoucherService, couponToVoucher, isVoucherUsable } from '../../core/services/voucher.service';
import { UserVoucher } from '../../core/models/voucher.model';
import { Coupon } from '../../core/models/cart.model';

/**
 * Ô chọn voucher dùng chung cho Giỏ hàng và Thanh toán: voucher cá nhân + mã đã lưu + mã của shop,
 * nhập tay mã mới, bấm để chọn / bấm lại để bỏ chọn. Kiểm tra đơn tối thiểu theo `subtotal` truyền vào.
 */
@Component({
  selector: 'app-voucher-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VoucherCardComponent],
  templateUrl: './voucher-picker.component.html',
  styleUrl: './voucher-picker.component.css',
})
export class VoucherPickerComponent {
  readonly cartService = inject(CartService);
  private readonly voucherService = inject(VoucherService);

  private readonly subtotalSignal = signal(0);
  /** Tạm tính của các món sẽ thanh toán — dùng để xét điều kiện đơn tối thiểu. */
  @Input({ required: true }) set subtotal(value: number) {
    this.subtotalSignal.set(value || 0);
  }
  /** Mở sẵn danh sách (vd ở trang thanh toán). */
  @Input() set startOpen(value: boolean) {
    this.open = value;
  }

  open = false;
  codeInput = '';
  message = '';
  success = false;

  /** Voucher cá nhân còn hạn + mã khách đã lưu + mã công khai của shop (bỏ trùng mã). */
  readonly options = computed<UserVoucher[]>(() => {
    const own = this.voucherService.usable();
    const seen = new Set(own.map(v => v.code));
    const extra: UserVoucher[] = [];
    for (const c of [...this.cartService.savedCoupons(), ...this.cartService.shopCoupons()]) {
      if (seen.has(c.code)) continue;
      seen.add(c.code);
      extra.push(couponToVoucher(c));
    }
    return [...own, ...extra].filter(v => isVoucherUsable(v));
  });

  constructor() {
    this.cartService.loadShopCoupons();
  }

  private readonly host = inject(ElementRef<HTMLElement>);

  /** Bấm ra ngoài ô voucher thì thu danh sách lại. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // composedPath: đúng cả khi phần tử vừa bấm bị vẽ lại (đã rời DOM) sau khi chọn voucher.
    if (this.open && !event.composedPath().includes(this.host.nativeElement)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }

  /** Lý do chưa chọn được voucher (hiện ngay trên thẻ); null = chọn được. */
  disabledReason(v: UserVoucher): string | null {
    const sub = this.subtotalSignal();
    if (sub < v.minSpend) {
      const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ';
      return `Chưa đạt đơn tối thiểu ${vnd(v.minSpend)}, mua thêm ${vnd(v.minSpend - sub)}`;
    }
    return null;
  }

  /** Bấm vào voucher chưa đủ điều kiện: nhắc lại lý do ở dòng thông báo. */
  showBlocked(reason: string): void {
    this.success = false;
    this.message = reason;
  }

  isSelected(v: UserVoucher): boolean {
    return this.cartService.appliedCoupon()?.code === v.code;
  }

  /** Bấm vào voucher đang chọn thì bỏ chọn (khách không muốn dùng mã). */
  toggle(v: UserVoucher): void {
    if (!isVoucherUsable(v)) return;
    const res = this.isSelected(v)
      ? this.cartService.selectCoupon(null)
      : this.cartService.selectCoupon(
          { code: v.code, title: v.title, description: v.description, discountPercent: v.discountPercent, discountAmount: v.discountAmount, maxDiscount: v.maxDiscount, minSpend: v.minSpend },
          this.subtotalSignal()
        );
    this.success = res.success;
    this.message = res.message;
  }

  /** Nhập tay mã: hợp lệ thì lưu vào danh sách (lần sau khỏi nhập lại), khách tự bấm chọn để áp dụng. */
  addCode(): void {
    if (!this.codeInput.trim()) return;
    const own = this.voucherService.usable().map(v => ({ ...v } as Coupon));
    this.cartService.addCouponCode(this.codeInput, own).subscribe(res => {
      this.success = res.success;
      this.message = res.message;
      if (res.success) this.codeInput = '';
    });
  }
}
