import { Component, computed, effect, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FavoriteService } from '../../core/services/favorite.service';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

/** Trang Sản Phẩm Yêu Thích — danh sách sản phẩm đã bấm tim, lưu cục bộ qua FavoriteService. */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css'
})
export class FavoritesComponent {
  showRemoveSelectedConfirm = false;

  readonly selectedIds = signal<Set<string>>(new Set());
  private knownIds = new Set<string>();

  constructor(
    public favoriteService: FavoriteService,
    private productService: ProductService,
    private cartService: CartService,
    private toastService: ToastService,
    private router: Router
  ) {
    // Tự chọn sẵn sản phẩm mới được thêm vào yêu thích, giữ lựa chọn cũ khi sản phẩm còn tồn tại.
    effect(() => {
      const ids = new Set(this.favoriteProducts().map(p => p.id));
      const prev = untracked(() => this.selectedIds());
      const next = new Set<string>();
      for (const id of ids) {
        if (prev.has(id) || !this.knownIds.has(id)) next.add(id);
      }
      this.knownIds = ids;
      const changed = next.size !== prev.size || [...next].some(id => !prev.has(id));
      if (changed) this.selectedIds.set(next);
    });
  }

  readonly favoriteProducts = computed(() => {
    const ids = this.favoriteService.ids();
    return this.productService.products().filter(p => ids.has(p.id));
  });

  readonly selectedProducts = computed(() =>
    this.favoriteProducts().filter(p => this.selectedIds().has(p.id))
  );

  readonly isAllSelected = computed(() => {
    const products = this.favoriteProducts();
    return products.length > 0 && this.selectedIds().size === products.length;
  });

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelected(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.favoriteProducts().map(p => p.id)) : new Set());
  }

  removeItem(id: string): void {
    this.favoriteService.remove(id);
    const next = new Set(this.selectedIds());
    next.delete(id);
    this.selectedIds.set(next);
  }

  confirmRemoveSelected(): void {
    if (this.selectedProducts().length === 0) return;
    this.showRemoveSelectedConfirm = true;
  }

  cancelRemoveSelected(): void {
    this.showRemoveSelectedConfirm = false;
  }

  removeSelectedConfirmed(): void {
    for (const p of this.selectedProducts()) {
      this.favoriteService.remove(p.id);
    }
    this.selectedIds.set(new Set());
    this.showRemoveSelectedConfirm = false;
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
    this.toastService.success(`Đã thêm "${product.name}" vào giỏ hàng`);
  }

  addSelectedToCart(): void {
    const products = this.selectedProducts();
    if (products.length === 0) return;
    for (const p of products) this.cartService.addToCart(p, 1);
    this.toastService.success(`Đã thêm ${products.length} sản phẩm vào giỏ hàng`);
  }

  buyNowSelected(): void {
    const products = this.selectedProducts();
    if (products.length === 0) return;
    for (const p of products) this.cartService.addToCart(p, 1);

    const productIds = new Set(products.map(p => p.id));
    const cartItemIds = this.cartService.items()
      .filter(i => productIds.has(i.product.id) && !i.selectedCustomization)
      .map(i => i.id);
    this.cartService.setCheckoutSelection(cartItemIds);
    this.router.navigate(['/checkout']);
  }
}
