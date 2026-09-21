import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { FavoriteService } from '../../core/services/favorite.service';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductReview } from '../../core/models/product.model';
import { CommunityPost } from '../../core/models/community.model';
import { ThreeViewerComponent } from '../../components/three-viewer/three-viewer.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { RecentlyViewedSectionComponent } from '../../components/recently-viewed-section/recently-viewed-section.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ToastService } from '../../core/services/toast.service';

type ReviewFilter = 'all' | 'with-images' | '5' | '4' | 'low';

interface SpecRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ThreeViewerComponent,
    ProductCardComponent,
    RecentlyViewedSectionComponent,
    AppIconComponent,
    VndPipe
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  product: Product | undefined;
  relatedProducts: Product[] = [];
  taggedCommunityPosts: CommunityPost[] = [];

  activeView: 'photos' | '3d' = 'photos';
  selectedImage = '';
  quantity = 1;
  previewColorHex = '#FDFBF7';

  selectedColorName?: string;
  selectedSizeId?: string;
  selectedFinishId?: string;

  showReviewForm = false;
  newReviewRating = 5;
  newReviewAuthor = '';
  newReviewComment = '';
  reviewFilter: ReviewFilter = 'all';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    public recentlyViewedService: RecentlyViewedService,
    public favoriteService: FavoriteService,
    private communityService: CommunityService,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.product = this.productService.getProductBySlug(slug);
        if (this.product) {
          this.selectedImage = this.product.images[0];
          this.activeView = 'photos';
          this.relatedProducts = this.productService.getRelatedProducts(this.product, 4);
          if (this.product.customization?.colors?.[0]) {
            this.previewColorHex = this.product.customization.colors[0].hex;
            this.selectedColorName = this.product.customization.colors[0].name;
          }
          this.selectedSizeId = this.product.customization?.sizes?.[0]?.id;
          this.selectedFinishId = this.product.customization?.finishes?.[0]?.id;
          this.recentlyViewedService.recordView(this.product.id);
          this.loadTaggedCommunityPosts();
        }
      }
    });
  }

  private loadTaggedCommunityPosts(): void {
    if (!this.product) return;
    const productId = this.product.id;
    const compute = () => {
      this.taggedCommunityPosts = this.communityService.posts()
        .filter(post => post.productTags.some(t => t.productId === productId))
        .slice(0, 4);
    };
    compute();
    // posts có thể vẫn đang tải lần đầu — effect nhẹ: thử lại 1 lần khi signal có dữ liệu.
    if (this.communityService.posts().length === 0) {
      setTimeout(compute, 800);
    }
  }

  get has3D(): boolean {
    return !!this.product?.threeModelType;
  }

  get sku(): string {
    if (!this.product) return '';
    return 'SKU-' + this.product.id.slice(-8).toUpperCase();
  }

  get discountPercent(): number | null {
    if (!this.product?.originalPrice || this.product.originalPrice <= this.product.basePrice) return null;
    return Math.round(((this.product.originalPrice - this.product.basePrice) / this.product.originalPrice) * 100);
  }

  get specRows(): SpecRow[] {
    if (!this.product) return [];
    const p = this.product;
    const rows: SpecRow[] = [
      { label: 'Kích thước', value: p.dimensions },
      { label: 'Chất liệu', value: p.materialInfo },
    ];
    if (p.printTechnology) rows.push({ label: 'Công nghệ in 3D', value: p.printTechnology });
    if (p.customization?.colors?.length) {
      rows.push({ label: 'Màu sắc', value: p.customization.colors.map(c => c.name).join(', ') });
    }
    rows.push({ label: 'Trọng lượng', value: p.weight });
    if (p.productionTime) rows.push({ label: 'Thời gian sản xuất', value: p.productionTime });
    rows.push({ label: 'Tình trạng', value: p.productionType === 'READY_STOCK' ? 'Có sẵn' : 'In theo đơn (Made to Order)' });
    if (p.customization?.finishes?.length) {
      rows.push({ label: 'Hoàn thiện', value: p.customization.finishes.map(f => f.label).join(', ') });
    }
    return rows;
  }

  get filteredReviews(): ProductReview[] {
    if (!this.product) return [];
    const reviews = this.product.reviews;
    switch (this.reviewFilter) {
      case 'with-images': return reviews.filter(r => r.images && r.images.length > 0);
      case '5': return reviews.filter(r => r.rating === 5);
      case '4': return reviews.filter(r => r.rating === 4);
      case 'low': return reviews.filter(r => r.rating <= 3);
      default: return reviews;
    }
  }

  get ratingBreakdown(): { star: number; count: number; percent: number }[] {
    if (!this.product) return [];
    const total = this.product.reviews.length || 1;
    return [5, 4, 3, 2, 1].map(star => {
      const count = this.product!.reviews.filter(r => r.rating === star).length;
      return { star, count, percent: Math.round((count / total) * 100) };
    });
  }

  setReviewFilter(filter: ReviewFilter): void {
    this.reviewFilter = filter;
  }

  selectColor(colorName: string, hex: string): void {
    this.selectedColorName = colorName;
    this.previewColorHex = hex;
  }

  toggleFavorite(): void {
    if (!this.product) return;
    this.favoriteService.toggle(this.product.id);
  }

  share(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: this.product?.name, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      this.toastService.success('Đã sao chép liên kết sản phẩm');
    }
  }

  addToCart(): void {
    if (!this.product) return;
    this.cartService.addToCart(this.product, this.quantity);
    this.toastService.success(`Đã thêm "${this.product.name}" vào giỏ hàng`);
  }

  buyNow(): void {
    if (!this.product) return;
    this.cartService.addToCart(this.product, this.quantity);
    // Chỉ mang đúng sản phẩm vừa bấm "Mua ngay" sang Checkout, không kéo theo các sản phẩm khác đang có sẵn trong giỏ.
    const item = this.cartService.items().find(i => i.product.id === this.product!.id && !i.selectedCustomization);
    if (item) {
      this.cartService.setCheckoutSelection([item.id]);
    }
    this.router.navigate(['/checkout']);
  }

  submitReview(): void {
    if (!this.product || !this.newReviewAuthor || !this.newReviewComment) return;
    const product = this.product;
    const userId = this.authService.currentUser()?._id;

    this.productService.submitReview(product.id, {
      userId,
      author: this.newReviewAuthor,
      rating: this.newReviewRating,
      comment: this.newReviewComment,
    }).subscribe({
      next: (res) => {
        product.reviews.unshift(res.review);
        this.showReviewForm = false;
        this.newReviewAuthor = '';
        this.newReviewComment = '';
        this.toastService.success(
          userId ? 'Cảm ơn bạn đã đánh giá! Bạn vừa nhận thêm Xu Luméa.' : 'Cảm ơn bạn đã đánh giá sản phẩm!'
        );
      },
      error: () => {
        this.toastService.error('Không gửi được đánh giá, vui lòng thử lại.');
      },
    });
  }
}
