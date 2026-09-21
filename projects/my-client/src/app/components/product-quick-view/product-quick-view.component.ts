import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuickViewService } from '../../core/services/quick-view.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
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
  constructor(
    public quickViewService: QuickViewService,
    private cartService: CartService,
    private toastService: ToastService
  ) {}

  onOverlayClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.quickViewService.close();
  }

  addToCart(): void {
    const product = this.quickViewService.activeProduct();
    if (!product) return;
    this.cartService.addToCart(product, 1);
    this.toastService.success(`Đã thêm "${product.name}" vào giỏ hàng`);
    this.quickViewService.close();
  }
}
