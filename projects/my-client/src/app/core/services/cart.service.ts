import { Injectable, signal, computed, inject } from '@angular/core';
import { CartItem, Coupon } from '../models/cart.model';
import { Product, SelectedCustomization } from '../models/product.model';
import { MOCK_COUPONS } from '../data/mock-data';
import { FlashSaleService } from './flash-sale.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly flashSale = inject(FlashSaleService);
  private readonly toast = inject(ToastService);

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

  readonly discount = computed(() => {
    const coupon = this.appliedCouponSignal();
    const sub = this.subtotal();
    if (!coupon || sub < coupon.minSpend) return 0;
    const calc = (sub * coupon.discountPercent) / 100;
    return Math.min(calc, coupon.maxDiscount);
  });

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

  readonly checkoutDiscount = computed(() => {
    const coupon = this.appliedCouponSignal();
    const sub = this.checkoutSubtotal();
    if (!coupon || sub < coupon.minSpend) return 0;
    const calc = (sub * coupon.discountPercent) / 100;
    return Math.min(calc, coupon.maxDiscount);
  });

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

  addToCart(product: Product, quantity = 1, customization?: SelectedCustomization): void {
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
    this.openCart();
    this.notifyAdded(product.name);
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

  applyCoupon(code: string): { success: boolean; message: string } {
    const cleanCode = code.trim().toUpperCase();
    const found = MOCK_COUPONS.find(c => c.code === cleanCode);
    if (!found) {
      return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' };
    }
    if (this.subtotal() < found.minSpend) {
      return { 
        success: false, 
        message: `Mã này chỉ áp dụng cho đơn hàng từ ${found.minSpend.toLocaleString('vi-VN')}đ trở lên.` 
      };
    }
    this.appliedCouponSignal.set(found);
    return { success: true, message: `Áp dụng thành công mã ${found.code}!` };
  }

  removeCoupon(): void {
    this.appliedCouponSignal.set(null);
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
