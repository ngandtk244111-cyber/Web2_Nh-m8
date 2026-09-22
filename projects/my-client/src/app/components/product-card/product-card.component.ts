import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { CartFlyService } from '../../core/services/cart-fly.service';
import { ToastService } from '../../core/services/toast.service';
import { QuickViewService } from '../../core/services/quick-view.service';
import { FavoriteService } from '../../core/services/favorite.service';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  /** 'grid' (mặc định, card đứng) hoặc 'list' (card ngang — dùng ở trang Tất cả sản phẩm khi bật chế độ danh sách). */
  @Input() layout: 'grid' | 'list' = 'grid';
  @ViewChild('cardImg') cardImg?: ElementRef<HTMLImageElement>;

  constructor(
    private cartService: CartService,
    private cartFlyService: CartFlyService,
    private toastService: ToastService,
    public quickViewService: QuickViewService,
    public favoriteService: FavoriteService
  ) {}

  quickAddToCart(): void {
    this.cartService.addToCart(this.product, 1);
    if (this.cardImg) {
      this.cartFlyService.flyToCart(this.product.images[0], this.cardImg.nativeElement);
    }
    this.toastService.success(`Đã thêm "${this.product.name}" vào giỏ hàng`);
  }

  toggleFavorite(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const wasFavorite = this.favoriteService.isFavorite(this.product.id);
    this.favoriteService.toggle(this.product.id);
    this.toastService.success(
      wasFavorite ? `Đã bỏ "${this.product.name}" khỏi yêu thích` : `Đã thêm "${this.product.name}" vào yêu thích`
    );
  }

  openQuickView(): void {
    this.quickViewService.open(this.product);
  }
}
