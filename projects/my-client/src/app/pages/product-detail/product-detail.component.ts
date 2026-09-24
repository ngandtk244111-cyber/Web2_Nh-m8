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
import { RecentlyViewedSectionComponent } from '../../components/recently-viewed-section/recently-viewed-section.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ToastService } from '../../core/services/toast.service';
import { MascotService } from '../../core/services/mascot.service';

type ReviewFilter = 'all' | 'with-images' | '5' | '4' | 'low';
type InfoPanel = 'dimensions' | 'details' | 'delivery' | 'care';

interface SpecRow {
  label: string;
  value: string;
}

interface PickRow {
  key: string;
  title: string;
  products: Product[];
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/** Vuốt ngang tối thiểu (px) trên carousel để chuyển slide. */
const SWIPE_THRESHOLD = 40;
const REVIEWS_PER_PAGE = 6;

/** Trích từ trang FAQ / chính sách hiện có — không phát sinh chính sách mới. */
const PRODUCT_FAQ: FaqItem[] = [
  {
    id: 'ship-time',
    question: 'Thời gian giao hàng mất bao lâu?',
    answer: 'Sản phẩm có sẵn thường được giao trong 2-4 ngày làm việc tuỳ khu vực. Với sản phẩm in theo yêu cầu, thời gian giao sẽ cộng thêm thời gian sản xuất được ghi rõ ở trên.',
  },
  {
    id: 'ship-fee',
    question: 'Phí vận chuyển được tính như thế nào?',
    answer: 'Miễn phí vận chuyển cho đơn hàng từ 500.000₫ trở lên. Đơn dưới 500.000₫ áp dụng phí đồng giá 30.000₫ toàn quốc.',
  },
  {
    id: 'return',
    question: 'Chính sách đổi trả sản phẩm áp dụng như thế nào?',
    answer: 'Sản phẩm có sẵn được đổi trả trong 7 ngày nếu lỗi sản xuất, hư hỏng khi vận chuyển hoặc giao sai mẫu. Sản phẩm in theo yêu cầu hoặc tuỳ biến 3D chỉ đổi trả khi lỗi thuộc về sản xuất.',
  },
  {
    id: 'broken',
    question: 'Sản phẩm bị nứt, vỡ khi nhận hàng thì tôi phải làm gì?',
    answer: 'Vui lòng quay video lúc mở hộp và chụp ảnh sản phẩm, sau đó liên hệ Luméa trong vòng 48 giờ kể từ khi nhận hàng. Chúng tôi sẽ in lại hoặc đổi mới sản phẩm miễn phí cho bạn.',
  },
  {
    id: 'custom',
    question: 'Sản phẩm nào có thể tuỳ biến 3D?',
    answer: 'Chỉ những sản phẩm được đánh dấu "Có thể tùy biến" mới hỗ trợ đổi màu, chất liệu, kích thước hoặc khắc tên thông qua trình tùy biến 3D.',
  },
];

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ThreeViewerComponent,
    RecentlyViewedSectionComponent,
    AppIconComponent,
    VndPipe
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  product: Product | undefined;
  pickRows: PickRow[] = [];
  taggedCommunityPosts: CommunityPost[] = [];

  /** Carousel: các slide là toàn bộ ảnh, nếu sản phẩm có model 3D thì thêm 1 slide 3D ở cuối. */
  slideIndex = 0;
  private touchStartX: number | null = null;
  openPanel: InfoPanel | null = null;
  openFaqId: string | null = null;
  readonly faqItems = PRODUCT_FAQ;

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
  reviewPage = 1;

  /** Vị trí thanh tiến trình dưới mỗi hàng sản phẩm cuộn ngang (theo key của PickRow). */
  scrollProgress: Record<string, { left: number; width: number } | undefined> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    public recentlyViewedService: RecentlyViewedService,
    public favoriteService: FavoriteService,
    private communityService: CommunityService,
    private toastService: ToastService,
    private authService: AuthService,
    private mascotService: MascotService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.product = this.productService.getProductBySlug(slug);
        if (this.product) {
          this.slideIndex = this.route.snapshot.queryParamMap.get('view') === '3d' && this.has3D
            ? this.galleryImages.length
            : 0;
          this.openPanel = null;
          this.reviewFilter = 'all';
          this.reviewPage = 1;
          this.quantity = 1;
          if (this.product.customization?.colors?.[0]) {
            this.previewColorHex = this.product.customization.colors[0].hex;
            this.selectedColorName = this.product.customization.colors[0].name;
          }
          this.selectedSizeId = this.product.customization?.sizes?.[0]?.id;
          this.selectedFinishId = this.product.customization?.finishes?.[0]?.id;
          this.recentlyViewedService.recordView(this.product.id);
          this.buildPickRows(this.product);
          this.loadTaggedCommunityPosts();
        }
      }
    });
  }

  private buildPickRows(product: Product): void {
    const others = this.productService.products().filter(p => p.id !== product.id);
    const rows: PickRow[] = [
      {
        key: 'ready',
        title: 'Sẵn sàng giao ngay cho bạn',
        products: others.filter(p => p.productionType === 'READY_STOCK' && p.inStock > 0).slice(0, 10),
      },
      {
        key: 'collection',
        title: 'Cùng bộ sưu tập',
        products: this.productService.getRelatedProducts(product, 10),
      },
      {
        key: 'bestseller',
        title: 'Được yêu thích nhất',
        products: [...others].sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating).slice(0, 10),
      },
    ];
    this.pickRows = rows.filter(r => r.products.length > 0);
    this.scrollProgress = {};
  }

  private loadTaggedCommunityPosts(): void {
    if (!this.product) return;
    const productId = this.product.id;
    const compute = () => {
      this.taggedCommunityPosts = this.communityService.posts()
        .filter(post => post.productTags.some(t => t.productId === productId))
        .slice(0, 6);
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

  get galleryImages(): string[] {
    return this.product?.images ?? [];
  }

  get slideCount(): number {
    return this.galleryImages.length + (this.has3D ? 1 : 0);
  }

  get slideIndexes(): number[] {
    return Array.from({ length: this.slideCount }, (_, i) => i);
  }

  is3DSlide(index: number): boolean {
    return this.has3D && index === this.galleryImages.length;
  }

  goToSlide(index: number): void {
    const n = this.slideCount;
    if (n === 0) return;
    this.slideIndex = ((index % n) + n) % n;
  }

  prevSlide(): void {
    this.goToSlide(this.slideIndex - 1);
  }

  nextSlide(): void {
    this.goToSlide(this.slideIndex + 1);
  }

  onCarouselTouchStart(event: TouchEvent): void {
    this.touchStartX = this.is3DSlide(this.slideIndex) ? null : event.touches[0].clientX;
  }

  onCarouselTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) this.nextSlide(); else this.prevSlide();
  }

  /** Bấm ảnh ở lưới bên dưới: đưa carousel tới đúng ảnh đó và cuộn lên carousel. */
  openInCarousel(index: number, carousel: HTMLElement): void {
    this.goToSlide(index);
    carousel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Ảnh dùng cho khối "Câu chuyện sản phẩm" — ưu tiên ảnh thứ 2 để không trùng ảnh chính. */
  get storyImage(): string {
    const imgs = this.product?.images ?? [];
    return imgs[1] || imgs[0] || '';
  }

  /** Ghép tối đa 2 điểm nổi bật với ảnh sản phẩm cho khối "Vì sao bạn sẽ thích". */
  get featureHighlights(): { title: string; image: string }[] {
    if (!this.product) return [];
    const imgs = this.product.images;
    return this.product.features.slice(0, 2).map((title, i) => ({
      title,
      image: imgs[(i + 2) % imgs.length] || imgs[0],
    }));
  }

  get discountPercent(): number | null {
    if (!this.product?.originalPrice || this.product.originalPrice <= this.product.basePrice) return null;
    return Math.round(((this.product.originalPrice - this.product.basePrice) / this.product.originalPrice) * 100);
  }

  get selectedSizeLabel(): string | undefined {
    return this.product?.customization?.sizes?.find(s => s.id === this.selectedSizeId)?.label;
  }

  get selectedFinishLabel(): string | undefined {
    return this.product?.customization?.finishes?.find(f => f.id === this.selectedFinishId)?.label;
  }

  /** Khoảng ngày nhận hàng dự kiến cho hàng có sẵn: 2-4 ngày theo Chính sách giao hàng. */
  get deliveryRange(): string | null {
    if (this.product?.productionType !== 'READY_STOCK') return null;
    const fmt = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    return `${fmt(2)} – ${fmt(4)}`;
  }

  get specRows(): SpecRow[] {
    if (!this.product) return [];
    const p = this.product;
    const rows: SpecRow[] = [
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

  get totalReviewPages(): number {
    return Math.max(1, Math.ceil(this.filteredReviews.length / REVIEWS_PER_PAGE));
  }

  get reviewPages(): number[] {
    return Array.from({ length: this.totalReviewPages }, (_, i) => i + 1);
  }

  get pagedReviews(): ProductReview[] {
    const start = (this.reviewPage - 1) * REVIEWS_PER_PAGE;
    return this.filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
  }

  /** Dải ảnh khách hàng ở đầu khối đánh giá. */
  get reviewImages(): string[] {
    if (!this.product) return [];
    return this.product.reviews.flatMap(r => r.images ?? []).slice(0, 8);
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
    this.reviewPage = 1;
  }

  goToReviewPage(page: number): void {
    if (page < 1 || page > this.totalReviewPages) return;
    this.reviewPage = page;
    document.getElementById('pd-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToReviews(): void {
    document.getElementById('pd-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  togglePanel(panel: InfoPanel): void {
    this.openPanel = this.openPanel === panel ? null : panel;
  }

  toggleFaq(id: string): void {
    this.openFaqId = this.openFaqId === id ? null : id;
  }

  selectColor(colorName: string, hex: string): void {
    this.selectedColorName = colorName;
    this.previewColorHex = hex;
  }

  onPickScroll(key: string, el: HTMLElement): void {
    const width = el.scrollWidth > 0 ? (el.clientWidth / el.scrollWidth) * 100 : 100;
    const left = el.scrollWidth > 0 ? (el.scrollLeft / el.scrollWidth) * 100 : 0;
    this.scrollProgress[key] = { left, width };
  }

  toggleFavorite(): void {
    if (!this.product) return;
    this.favoriteService.toggle(this.product.id);
  }

  togglePickFavorite(p: Product): void {
    const wasFavorite = this.favoriteService.isFavorite(p.id);
    this.favoriteService.toggle(p.id);
    this.toastService.success(wasFavorite ? `Đã bỏ "${p.name}" khỏi yêu thích` : `Đã thêm "${p.name}" vào yêu thích`);
  }

  addPickToCart(p: Product): void {
    if (p.customizable) {
      this.router.navigate(['/product', p.slug]);
      return;
    }
    this.cartService.addToCart(p, 1);
    this.toastService.success(`Đã thêm "${p.name}" vào giỏ hàng`);
    this.mascotService.react('happy');
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
    this.mascotService.react('happy');
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

    this.mascotService.beginLoading({ immediate: true });
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
        this.reviewPage = 1;
        this.toastService.success(
          userId ? 'Cảm ơn bạn đã đánh giá! Bạn vừa nhận thêm Xu Luméa.' : 'Cảm ơn bạn đã đánh giá sản phẩm!'
        );
        this.mascotService.endLoading('happy');
      },
      error: () => {
        this.toastService.error('Không gửi được đánh giá, vui lòng thử lại.');
        this.mascotService.endLoading('sad');
      },
    });
  }
}
