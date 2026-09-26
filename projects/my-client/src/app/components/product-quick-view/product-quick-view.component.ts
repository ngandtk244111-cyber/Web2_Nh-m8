import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuickViewService } from '../../core/services/quick-view.service';
import { CartService } from '../../core/services/cart.service';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-product-quick-view',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './product-quick-view.component.html',
  styleUrl: './product-quick-view.component.css'
})
export class ProductQuickViewComponent {
  quantity = 1;

  constructor(
    public quickViewService: QuickViewService,
    private cartService: CartService
  ) {
    // Mỗi lần mở sản phẩm khác thì đặt lại số lượng về 1.
    effect(() => {
      this.quickViewService.activeProduct();
      this.quantity = 1;
    });
  }

  get maxQty(): number {
    return Math.max(0, this.quickViewService.activeProduct()?.inStock ?? 0);
  }

  get discountPercent(): number | null {
    const p = this.quickViewService.activeProduct();
    if (!p?.originalPrice || p.originalPrice <= p.basePrice) return null;
    return Math.round(((p.originalPrice - p.basePrice) / p.originalPrice) * 100);
  }

  changeQty(delta: number): void {
    this.quantity = Math.min(Math.max(1, this.quantity + delta), Math.max(1, this.maxQty));
  }

  onOverlayClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.quickViewService.close();
  }

  addToCart(): void {
    const product = this.quickViewService.activeProduct();
    if (!product) return;
    if (product.inStock <= 0) return;
    this.cartService.addToCart(product, Math.min(this.quantity, product.inStock));
    this.quickViewService.close();
  }
}
