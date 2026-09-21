import { Component, computed, effect, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CoinService } from '../../core/services/coin.service';
import { AuthService } from '../../core/services/auth.service';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

const FREE_SHIPPING_THRESHOLD = 500_000;
const DEFAULT_SHIPPING_FEE = 30_000;

/**
 * Trang Giỏ Hàng riêng (route /cart) — cùng logic chọn sản phẩm/voucher/xu với CartDrawerComponent,
 * chỉ khác là hiển thị dạng trang đầy đủ thay vì drawer trượt ra. Icon giỏ hàng ở Header điều hướng
 * thẳng tới đây thay vì mở drawer.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent {
  couponCodeInput = '';
  couponMessage = '';
  couponSuccess = false;
  showCouponInput = false;

  readonly selectedIds = signal<Set<string>>(new Set());
  readonly useCoins = signal(false);
  private knownIds = new Set<string>();

  constructor(
    public cartService: CartService,
    public coinService: CoinService,
    public authService: AuthService,
    private router: Router
  ) {
    // Đồng bộ selection theo giỏ hàng thật: giữ lựa chọn cũ, tự chọn sẵn sản phẩm mới thêm vào.
    // Đọc selectedIds() bằng untracked() để effect này KHÔNG phụ thuộc vào chính signal nó ghi ra
    // (nếu không, mỗi lần .set() tạo Set mới sẽ tự kích hoạt lại effect này vô hạn lần).
    effect(() => {
      const items = this.cartService.items();
      const ids = new Set(items.map(i => i.id));
      const prev = untracked(() => this.selectedIds());
      const next = new Set<string>();
      for (const id of ids) {
        if (prev.has(id) || !this.knownIds.has(id)) next.add(id);
      }
      this.knownIds = ids;
      const changed = next.size !== prev.size || [...next].some(id => !prev.has(id));
      if (changed) {
        this.selectedIds.set(next);
      }
    });
  }

  readonly selectedItems = computed(() =>
    this.cartService.items().filter(i => this.selectedIds().has(i.id))
  );

  readonly isAllSelected = computed(() => {
    const items = this.cartService.items();
    return items.length > 0 && this.selectedIds().size === items.length;
  });

  readonly selectedItemCount = computed(() => this.selectedItems().length);

  readonly selectedQuantityCount = computed(() =>
    this.selectedItems().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly selectedSubtotal = computed(() =>
    this.selectedItems().reduce((sum, i) => sum + i.totalPrice, 0)
  );

  readonly selectedCouponDiscount = computed(() => {
    const coupon = this.cartService.appliedCoupon();
    const sub = this.selectedSubtotal();
    if (!coupon || sub < coupon.minSpend) return 0;
    return Math.min((sub * coupon.discountPercent) / 100, coupon.maxDiscount);
  });

  readonly coinBalance = computed(() => this.coinService.balance());

  readonly coinDiscount = computed(() => {
    if (!this.authService.currentUser() || !this.useCoins()) return 0;
    const remaining = Math.max(0, this.selectedSubtotal() - this.selectedCouponDiscount());
    return Math.min(this.coinBalance(), remaining);
  });

  readonly selectedShippingFee = computed(() => {
    if (this.selectedSubtotal() === 0) return 0;
    return this.selectedSubtotal() >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
  });

  readonly selectedFinalAmount = computed(() =>
    Math.max(0, this.selectedSubtotal() - this.selectedCouponDiscount() - this.coinDiscount())
  );

  readonly selectedTotal = computed(() => this.selectedFinalAmount() + this.selectedShippingFee());

  isItemSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleItemSelected(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.cartService.items().map(i => i.id)) : new Set());
  }

  toggleUseCoins(checked: boolean): void {
    if (!this.authService.currentUser()) return;
    this.useCoins.set(checked);
  }

  removeItem(itemId: string): void {
    this.cartService.removeFromCart(itemId);
    const next = new Set(this.selectedIds());
    next.delete(itemId);
    this.selectedIds.set(next);
  }

  applyCoupon(): void {
    if (!this.couponCodeInput.trim()) return;
    const res = this.cartService.applyCoupon(this.couponCodeInput);
    this.couponSuccess = res.success;
    this.couponMessage = res.message;
    if (res.success) {
      this.couponCodeInput = '';
      this.showCouponInput = false;
    }
  }

  /** Chỉ mang các sản phẩm ĐÃ CHỌN sang thanh toán — sản phẩm chưa chọn vẫn được giữ nguyên trong giỏ. */
  proceedToCheckout(): void {
    const selected = this.selectedItems();
    if (selected.length === 0) return;
    this.cartService.setCheckoutSelection(selected.map(i => i.id));
    this.router.navigate(['/checkout']);
  }

  goToCatalog(): void {
    this.router.navigate(['/catalog']);
  }
}
