import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { CartItem, Coupon } from '../models/cart.model';
import { Product, SelectedCustomization } from '../models/product.model';
import { environment } from '../../../environments/environment';
import { FlashSaleService } from './flash-sale.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { LoginModalService } from './login-modal.service';
import { voucherDiscount } from './voucher.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly flashSale = inject(FlashSaleService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly loginModal = inject(LoginModalService);

  // Gom các lần thêm giỏ trong cùng một lượt xử lý (vd. "thêm tất cả") thành một thông báo duy nhất.
  private pendingAddedNames: string[] = [];

  private readonly storageKey = 'deco3d_cart';
  private readonly checkoutSelectionKey = 'deco3d_checkout_selection';

  // Signals
  private itemsSignal = signal<CartItem[]>(this.loadCart());
  private isCartOpenSignal = signal<boolean>(false);
  private appliedCouponSignal = signal<Coupon | null>(null);
  // Danh sách id sản phẩm được chọn để mang sang Checkout — null nghĩa là dùng toàn bộ giỏ hàng.
  // Chỉ dùng để LỌC hiển thị ở Checkout, không xoá sản phẩm chưa chọn khỏi giỏ.
  // Lưu tạm ở sessionStorage để không mất lựa chọn nếu người dùng reload trang Checkout.
  private checkoutSelectionSignal = signal<string[] | null>(this.loadCheckoutSelection());

  readonly items = this.itemsSignal.asReadonly();
  readonly isCartOpen = this.isCartOpenSignal.asReadonly();
  readonly appliedCoupon = this.appliedCouponSignal.asReadonly();

  readonly itemCount = computed(() => 
    this.itemsSignal().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly subtotal = computed(() => 
    this.itemsSignal().reduce((sum, item) => sum + item.totalPrice, 0)
  );

  readonly discount = computed(() => voucherDiscount(this.appliedCouponSignal(), this.subtotal()));

  readonly shippingFee = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    // Free shipping over 500k
    return sub >= 500000 ? 0 : 30000;
  });

  readonly total = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    const disc = this.discount();
    const ship = this.shippingFee();
    return Math.max(0, sub - disc + ship);
  });

  readonly hasPrintOnDemandItems = computed(() =>
    this.itemsSignal().some(item => item.product.productionType === 'PRINT_ON_DEMAND')
  );

  // ---------- Checkout selection (chỉ những sản phẩm đã tick ở Cart) ----------
  readonly checkoutItems = computed(() => {
    const sel = this.checkoutSelectionSignal();
    if (!sel) return this.itemsSignal();
    const idSet = new Set(sel);
    return this.itemsSignal().filter(item => idSet.has(item.id));
  });

  readonly checkoutItemCount = computed(() =>
    this.checkoutItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly checkoutSubtotal = computed(() =>
    this.checkoutItems().reduce((sum, item) => sum + item.totalPrice, 0)
  );

  readonly checkoutDiscount = computed(() => voucherDiscount(this.appliedCouponSignal(), this.checkoutSubtotal()));

  readonly checkoutShippingFee = computed(() => {
    const sub = this.checkoutSubtotal();
    if (sub === 0) return 0;
    return sub >= 500000 ? 0 : 30000;
  });

  readonly checkoutTotal = computed(() => {
    const sub = this.checkoutSubtotal();
    if (sub === 0) return 0;
    const disc = this.checkoutDiscount();
    const ship = this.checkoutShippingFee();
    return Math.max(0, sub - disc + ship);
  });

  /** Đánh dấu các sản phẩm sẽ mang sang Checkout — KHÔNG xoá sản phẩm còn lại khỏi giỏ. */
  setCheckoutSelection(itemIds: string[]): void {
    this.checkoutSelectionSignal.set(itemIds);
    try {
      sessionStorage.setItem(this.checkoutSelectionKey, JSON.stringify(itemIds));
    } catch (e) {
      console.warn('Failed to save checkout selection', e);
    }
  }

  clearCheckoutSelection(): void {
    this.checkoutSelectionSignal.set(null);
    try {
      sessionStorage.removeItem(this.checkoutSelectionKey);
    } catch (e) {
      console.warn('Failed to clear checkout selection', e);
    }
  }

  private loadCart(): CartItem[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load cart', e);
    }
    return [];
  }

  private saveCart(items: CartItem[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
      this.itemsSignal.set(items);
    } catch (e) {
      console.warn('Failed to save cart', e);
    }
  }

  private loadCheckoutSelection(): string[] | null {
    try {
      const stored = sessionStorage.getItem(this.checkoutSelectionKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load checkout selection', e);
    }
    return null;
  }

  // Calculate customized unit price
  calculateUnitPrice(product: Product, customization?: SelectedCustomization): number {
    const basePrice = this.flashSale.effectiveBasePrice(product);
    if (!customization) return basePrice;

    let base = basePrice;
    base += customization.color?.priceDelta || 0;
    base += customization.material?.priceDelta || 0;
    base += customization.finish?.priceDelta || 0;
    if (customization.customText?.trim() && product.customization?.textOption?.enabled) {
      base += product.customization.textOption.priceDelta;
    }
    if (customization.accessories?.length) {
      const accTotal = customization.accessories.reduce((acc, a) => acc + (a.priceDelta || 0), 0);
      base += accTotal;
    }

    const scaleMultiplier = customization.size?.priceMultiplier || 1.0;
    return Math.round(base * scaleMultiplier);
  }

  /**
   * Chỉ khách đã đăng nhập mới được thêm vào giỏ — chưa đăng nhập thì mở popup đăng nhập và trả về false.
   * Nơi thêm nhiều sản phẩm một lúc nên gọi hàm này trước vòng lặp để chỉ nhắc 1 lần.
   */
  ensureLoggedIn(): boolean {
    if (this.auth.currentUser()) return true;
    this.toast.info('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
    this.loginModal.open();
    return false;
  }

  /** Trả về false nếu không thêm được (chưa đăng nhập) — nơi gọi dừng hiệu ứng/điều hướng tiếp theo. */
  addToCart(product: Product, quantity = 1, customization?: SelectedCustomization): boolean {
    if (!this.ensureLoggedIn()) return false;
    // Hàng có sẵn (READY_STOCK) bị giới hạn theo tồn kho; hàng in theo đơn không giới hạn.
    const limited = product.productionType === 'READY_STOCK';
    if (limited && product.inStock <= 0) {
      this.toast.error(`"${product.name}" đã hết hàng.`);
      return false;
    }
    const current = [...this.itemsSignal()];
    const unitPrice = this.calculateUnitPrice(product, customization);

    // Create a fingerprint for customized items so different configs don't merge wrongly
    const configHash = customization ? JSON.stringify({
      color: customization.color.hex,
      mat: customization.material.id,
      size: customization.size.id,
      finish: customization.finish.id,
      text: customization.customText || '',
      acc: customization.accessories.map(a => a.id).sort(),
    }) : 'default';

    const existingIndex = current.findIndex(item => {
      if (item.product.id !== product.id) return false;
      const itemConfigHash = item.selectedCustomization ? JSON.stringify({
        color: item.selectedCustomization.color.hex,
        mat: item.selectedCustomization.material.id,
        size: item.selectedCustomization.size.id,
        finish: item.selectedCustomization.finish.id,
        text: item.selectedCustomization.customText || '',
        acc: item.selectedCustomization.accessories.map(a => a.id).sort(),
      }) : 'default';
      return itemConfigHash === configHash;
    });

    if (limited) {
      const alreadyInCart = current.filter(i => i.product.id === product.id).reduce((n, i) => n + i.quantity, 0);
      const room = product.inStock - alreadyInCart;
      if (room <= 0) {
        this.toast.info(`Giỏ hàng đã có tối đa số lượng còn lại của "${product.name}".`);
        return false;
      }
      quantity = Math.min(quantity, room);
    }

    if (existingIndex > -1) {
      const existing = current[existingIndex];
      const newQty = existing.quantity + quantity;
      current[existingIndex] = {
        ...existing,
        quantity: newQty,
        totalPrice: newQty * existing.unitPrice,
      };
    } else {
      const newItem: CartItem = {
        id: 'ci-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        product,
        quantity,
        selectedCustomization: customization ? JSON.parse(JSON.stringify(customization)) : undefined,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
      current.push(newItem);
    }

    this.saveCart(current);
    this.notifyAdded(product.name);
    return true;
  }

  private notifyAdded(productName: string): void {
    this.pendingAddedNames.push(productName);
    if (this.pendingAddedNames.length > 1) return;
    queueMicrotask(() => {
      const names = this.pendingAddedNames;
      this.pendingAddedNames = [];
      this.toast.cart(names.length === 1
        ? `Đã thêm "${names[0]}" vào giỏ hàng thành công.`
        : `Đã thêm ${names.length} sản phẩm vào giỏ hàng thành công.`);
    });
  }

  updateQuantity(itemId: string, newQty: number): void {
    if (newQty <= 0) {
      this.removeFromCart(itemId);
      return;
    }
    const current = this.itemsSignal().map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: newQty,
          totalPrice: newQty * item.unitPrice,
        };
      }
      return item;
    });
    this.saveCart(current);
  }

  removeFromCart(itemId: string): void {
    const updated = this.itemsSignal().filter(item => item.id !== itemId);
    this.saveCart(updated);
  }

  /** Xoá đúng các sản phẩm đã đặt hàng thành công, giữ lại sản phẩm chưa chọn trong giỏ. */
  removeItems(itemIds: string[]): void {
    const idSet = new Set(itemIds);
    const updated = this.itemsSignal().filter(item => !idSet.has(item.id));
    this.saveCart(updated);
  }

  clearCart(): void {
    this.saveCart([]);
    this.appliedCouponSignal.set(null);
  }

  // ---------- Mã giảm giá ----------
  private readonly savedCouponsKey = 'lumea_saved_coupons';
  /** Mã công khai khách từng nhập thành công — lưu lại để lần sau chọn trong danh sách, khỏi gõ lại. */
  private savedCouponsSignal = signal<Coupon[]>(this.loadSavedCoupons());
  readonly savedCoupons = this.savedCouponsSignal.asReadonly();
  /** Mã công khai đang hoạt động của shop (GET /api/coupons). */
  readonly shopCoupons = signal<Coupon[]>([]);

  /** Mã của shop còn dùng được — server bỏ sẵn các mã khách đã dùng (mỗi mã chỉ dùng 1 lần). */
  loadShopCoupons(): void {
    const userId = this.auth.currentUser()?._id;
    this.http.get<{ success: boolean; coupons: Coupon[]; usedCodes?: string[] }>(
      `${environment.apiUrl}/coupons`, { params: userId ? { userId } : {} }
    ).subscribe({
      next: res => {
        if (!res.success) return;
        this.shopCoupons.set(res.coupons);
        const used = new Set(res.usedCodes || []);
        if (used.size) {
          this.persistSavedCoupons(this.savedCouponsSignal().filter(c => !used.has(c.code)));
          if (used.has(this.appliedCouponSignal()?.code || '')) this.appliedCouponSignal.set(null);
        }
      },
      error: () => { /* không tải được thì chỉ còn mã đã lưu + voucher cá nhân */ },
    });
  }

  /**
   * Nhập tay mã giảm giá: tra mã công khai (GET /api/coupons/:code). Tìm thấy thì lưu vào danh sách mã
   * của khách để lần sau chọn lại, nhưng KHÔNG tự áp dụng — khách tự chọn trong danh sách.
   * Voucher cá nhân (đã có sẵn trong danh sách) được nhận ra qua `ownVouchers`.
   */
  addCouponCode(code: string, ownVouchers: Coupon[] = []): Observable<{ success: boolean; message: string; coupon?: Coupon }> {
    const cleanCode = code.trim().toUpperCase();
    const own = ownVouchers.find(v => v.code === cleanCode);
    if (own) return of({ success: true, message: `Mã ${cleanCode} đã có trong voucher của bạn.`, coupon: own });
    const userId = this.auth.currentUser()?._id;
    return this.http.get<{ success: boolean; coupon: Coupon }>(
      `${environment.apiUrl}/coupons/${encodeURIComponent(cleanCode)}`, { params: userId ? { userId } : {} }
    ).pipe(
      map(res => {
        const found = res.coupon;
        this.saveCoupon(found);
        return { success: true, message: `Đã lưu mã ${found.code} vào danh sách voucher.`, coupon: found };
      }),
      catchError(err => of({ success: false, message: err?.error?.error || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' }))
    );
  }

  /** Đặt đơn thành công: mã vừa dùng không dùng lại được nữa -> bỏ chọn và xoá khỏi danh sách đã lưu/của shop. */
  consumeAppliedCoupon(): void {
    const code = this.appliedCouponSignal()?.code;
    if (!code) return;
    this.appliedCouponSignal.set(null);
    this.persistSavedCoupons(this.savedCouponsSignal().filter(c => c.code !== code));
    this.shopCoupons.update(list => list.filter(c => c.code !== code));
  }

  /** Chọn 1 mã trong danh sách (null = không dùng mã). Kiểm tra giá trị đơn tối thiểu theo `subtotal`. */
  selectCoupon(coupon: Coupon | null, subtotal = this.subtotal()): { success: boolean; message: string } {
    if (!coupon) {
      this.appliedCouponSignal.set(null);
      return { success: true, message: '' };
    }
    if (subtotal < coupon.minSpend) {
      return { success: false, message: `Mã này chỉ áp dụng cho đơn hàng từ ${coupon.minSpend.toLocaleString('vi-VN')}đ trở lên.` };
    }
    this.appliedCouponSignal.set(coupon);
    return { success: true, message: `Đã áp dụng mã ${coupon.code}.` };
  }

  removeCoupon(): void {
    this.appliedCouponSignal.set(null);
  }

  removeSavedCoupon(code: string): void {
    this.persistSavedCoupons(this.savedCouponsSignal().filter(c => c.code !== code));
    if (this.appliedCouponSignal()?.code === code) this.appliedCouponSignal.set(null);
  }

  private saveCoupon(coupon: Coupon): void {
    this.persistSavedCoupons([coupon, ...this.savedCouponsSignal().filter(c => c.code !== coupon.code)]);
  }

  private persistSavedCoupons(list: Coupon[]): void {
    this.savedCouponsSignal.set(list);
    localStorage.setItem(this.savedCouponsKey, JSON.stringify(list));
  }

  private loadSavedCoupons(): Coupon[] {
    try {
      const raw = localStorage.getItem(this.savedCouponsKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  openCart(): void {
    this.isCartOpenSignal.set(true);
  }

  closeCart(): void {
    this.isCartOpenSignal.set(false);
  }

  toggleCart(): void {
    this.isCartOpenSignal.update(open => !open);
  }
}
