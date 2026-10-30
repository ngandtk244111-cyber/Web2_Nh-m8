import { Component, OnDestroy, OnInit, effect, signal, untracked } from '@angular/core';
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
import { FlashSaleService, FlashSlot } from '../../core/services/flash-sale.service';
import { RoomService } from '../../core/services/room.service';
import {
  CatalogDepartment,
  CatalogLink,
  CatalogSubcategory,
  departmentLink,
  departmentOf,
  findSpace,
  has3DModel,
  spaceLink,
  spacesOf,
  subcategoriesOf,
  subcategoryLink,
} from '../../core/data/catalog-taxonomy';

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

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

/** Vuốt ngang tối thiểu (px) trên carousel để chuyển slide. */
const SWIPE_THRESHOLD = 40;
const REVIEWS_PER_PAGE = 6;

/** Trích từ trang FAQ / chính sách hiện có — không phát sinh chính sách mới.
 *  Chia nhóm theo 2 cột giống trang FAQ chính. */
const PRODUCT_FAQ: FaqCategory[] = [
  {
    title: 'Vận chuyển & Giao hàng',
    items: [
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
    ],
  },
  {
    title: 'Đổi trả & Tuỳ biến',
    items: [
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
    ],
  },
];

/** Đánh giá mẫu hiển thị khi sản phẩm chưa có đánh giá thật nào (dữ liệu demo). */
const SAMPLE_REVIEWS: ProductReview[] = [
  {
    id: 'sample-rev-1',
    author: 'Ngọc Anh',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    date: '12/10/2026',
    comment: 'Sản phẩm đẹp y hình, đóng gói rất kỹ, giao nhanh hơn dự kiến. Đặt vào phòng khách nhìn sang hẳn!',
    verifiedPurchase: true,
  },
  {
    id: 'sample-rev-2',
    author: 'Minh Quân',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    rating: 4,
    date: '05/10/2026',
    comment: 'Chất lượng hoàn thiện tốt, màu ngoài đời ấm hơn ảnh một chút nhưng vẫn rất ưng. Shop tư vấn nhiệt tình.',
    verifiedPurchase: true,
  },
  {
    id: 'sample-rev-3',
    author: 'Thu Trang',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    date: '28/09/2026',
    comment: 'Mua làm quà tân gia, bạn mình thích lắm. Sẽ quay lại mua thêm đồ decor ở Luméa.',
    verifiedPurchase: true,
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
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: Product | undefined;
  pickRows: PickRow[] = [];
  taggedCommunityPosts: CommunityPost[] = [];

  /** Carousel: các slide là toàn bộ ảnh, nếu sản phẩm có model 3D thì thêm 1 slide 3D ở cuối. */
  slideIndex = 0;
  private touchStartX: number | null = null;
  openPanel: InfoPanel | null = null;
  openFaqId: string | null = null;
  readonly faqCategories = PRODUCT_FAQ;

  quantity = 1;
  previewColorHex = '#FDFBF7';

  selectedColorName?: string;
  selectedSizeId?: string;
  selectedFinishId?: string;

  showReviewForm = false;
  /** Khách đang đăng nhập đã mua sản phẩm này chưa — chưa mua thì chỉ xem đánh giá. */
  canReview = false;
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
    private mascotService: MascotService,
    private flash: FlashSaleService,
    private roomService: RoomService
  ) {
    // Mở trực tiếp bằng link / F5: danh sách sản phẩm chưa tải xong lúc đọc slug — chờ signal có dữ liệu
    // rồi mới hiển thị (trước đây trang trống). Cùng sản phẩm chỉ cập nhật dữ liệu, không reset lựa chọn.
    effect(() => {
      const slug = this.slug();
      const found = slug ? this.productService.products().find(p => p.slug === slug) : undefined;
      untracked(() => {
        if (!found) return;
        if (found.id === this.product?.id) this.product = found;
        else this.showProduct(found);
      });
    });
  }

  /** Slug trên URL hiện tại. */
  private readonly slug = signal<string | null>(null);

  // ---------- Danh mục / không gian theo cây danh mục chung ----------

  get department(): CatalogDepartment | undefined {
    return this.product ? departmentOf(this.product) : undefined;
  }

  get subcategory(): CatalogSubcategory | undefined {
    return this.product ? subcategoriesOf(this.product)[0] : undefined;
  }

  get departmentLink(): CatalogLink | undefined {
    return this.department ? departmentLink(this.department) : undefined;
  }

  /** Link "Xem thêm": ưu tiên danh mục con, rồi nhóm lớn, cuối cùng là category cũ. */
  get categoryLink(): CatalogLink {
    if (this.subcategory) return subcategoryLink(this.subcategory);
    if (this.departmentLink) return this.departmentLink;
    return { label: this.product?.categoryName ?? '', link: '/catalog', queryParams: { category: this.product?.category ?? '' } };
  }

  get spaceLinks(): CatalogLink[] {
    if (!this.product) return [];
    return spacesOf(this.product)
      .map(k => findSpace(k))
      .filter(sp => !!sp)
      .map(sp => spaceLink(sp!));
  }

  /** Sản phẩm có mặt trong phòng mẫu 3D nào không — chỉ khi có mới hiện "Space Builder". */
  get isInShowroom(): boolean {
    const id = this.product?.id;
    return !!id && this.roomService.rooms().some(r => r.hotspots.some(h => h.productId === id));
  }

  /** Nút "Xem 3D" ở buy box: chuyển carousel tới slide 3D và cuộn lên. */
  view3D(carousel: HTMLElement): void {
    if (!this.has3D) return;
    this.goToSlide(this.galleryImages.length);
    carousel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ngOnDestroy(): void {
    this.flash.release();
  }

  ngOnInit(): void {
    this.flash.acquire();
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.slug.set(slug);
      // Đã có danh sách (điều hướng trong app) thì hiện ngay; chưa có thì effect ở constructor lo.
      const found = slug ? this.productService.getProductBySlug(slug) : undefined;
      if (found) this.showProduct(found);
      else this.product = undefined;
    });
  }

  private showProduct(product: Product): void {
    this.product = product;
    this.slideIndex = this.route.snapshot.queryParamMap.get('view') === '3d' && this.has3D
      ? this.galleryImages.length
      : 0;
    this.openPanel = null;
    this.reviewFilter = 'all';
    this.reviewPage = 1;
    this.quantity = 1;
    if (product.customization?.colors?.[0]) {
      this.previewColorHex = product.customization.colors[0].hex;
      this.selectedColorName = product.customization.colors[0].name;
    }
    this.selectedSizeId = product.customization?.sizes?.[0]?.id;
    this.selectedFinishId = product.customization?.finishes?.[0]?.id;
    this.recentlyViewedService.recordView(product.id);
    this.checkCanReview(product);
    this.buildPickRows(product);
    this.loadTaggedCommunityPosts();
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
    return !!this.product && has3DModel(this.product);
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

  /** Ưu điểm nổi bật cho khối "Vì sao bạn sẽ thích" — mỗi ưu điểm ghép 1 ảnh sản phẩm làm minh hoạ. */
  get featureHighlights(): { title: string; image: string }[] {
    if (!this.product) return [];
    const imgs = this.product.images;
    return this.product.features.slice(0, 6).map((title, i) => ({
      title,
      image: imgs[(i + 1) % imgs.length] || imgs[0],
    }));
  }

  /** Lợi ích suy ra từ dữ liệu sản phẩm (chất liệu, 3D, tuỳ biến, đánh giá...) — hiển thị dạng dải icon gọn. */
  get productPerks(): { icon: string; title: string; text: string }[] {
    const p = this.product;
    if (!p) return [];
    const perks: { icon: string; title: string; text: string }[] = [];
    if (p.materialInfo) perks.push({ icon: 'shield', title: 'Chất liệu', text: p.materialInfo });
    if (p.productionType === 'PRINT_ON_DEMAND') {
      perks.push({ icon: 'cube', title: 'In 3D theo đơn', text: p.productionTime ? `Sản xuất trong ${p.productionTime}` : 'Làm riêng cho bạn' });
    } else if (p.inStock > 0) {
      perks.push({ icon: 'truck', title: 'Có sẵn', text: 'Giao hàng nhanh toàn quốc' });
    }
    if (p.customizable) perks.push({ icon: 'sliders', title: 'Tuỳ biến', text: 'Chọn màu, chất liệu, kích thước' });
    if (p.modelUrl || p.threeModelType) perks.push({ icon: 'rotate', title: 'Xem 3D', text: 'Xoay 360° trước khi mua' });
    if (p.reviewCount > 0) perks.push({ icon: 'star', title: `${p.rating.toFixed(1)}/5 sao`, text: `Từ ${p.reviewCount} đánh giá` });
    perks.push({ icon: 'rotate', title: 'Đổi trả 7 ngày', text: 'Kiểm tra hàng trước khi nhận' });
    return perks.slice(0, 5);
  }

  /** Khung Flash Sale của sản phẩm này (null nếu không phải hàng Flash Sale). */
  get flashSlot(): FlashSlot | null {
    return this.product ? this.flash.slotFor(this.product) : null;
  }

  /** Deal Flash Sale chưa tới giờ: vẫn xem và mua được nhưng ở giá gốc, kèm thông báo deal sắp diễn ra. */
  get isFlashUpcoming(): boolean {
    return this.flashSlot?.status === 'upcoming';
  }

  /** Giá đang áp dụng: giá gốc nếu deal chưa diễn ra (hoặc đã hết), giá khuyến mãi nếu đang diễn ra. */
  get displayPrice(): number {
    return this.product ? this.flash.effectiveBasePrice(this.product) : 0;
  }

  /** Nhãn "08:00, 25 Thg 9" của mốc bắt đầu deal. */
  get flashStartLabel(): string {
    const slot = this.flashSlot;
    if (!slot) return '';
    const d = new Date(slot.start);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}, ${d.getDate()} Thg ${d.getMonth() + 1}`;
  }

  get discountPercent(): number | null {
    if (!this.product?.originalPrice || this.product.originalPrice <= this.displayPrice) return null;
    return Math.round(((this.product.originalPrice - this.displayPrice) / this.product.originalPrice) * 100);
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
    const rows: SpecRow[] = [];
    const typeLabel = [this.department?.label, this.subcategory?.label].filter(Boolean).join(' › ');
    if (typeLabel) rows.push({ label: 'Loại sản phẩm', value: typeLabel });
    if (p.dimensions) rows.push({ label: 'Kích thước', value: p.dimensions });
    rows.push({ label: 'Chất liệu', value: p.materialInfo });
    if (p.style) rows.push({ label: 'Phong cách', value: p.style });
    if (!p.customization?.colors?.length && p.color) rows.push({ label: 'Màu sắc', value: p.color });
    const spaces = this.spaceLinks.map(sp => sp.label);
    if (spaces.length) rows.push({ label: 'Không gian phù hợp', value: spaces.join(', ') });
    if (p.customizable) rows.push({ label: 'Tùy chọn custom', value: this.customOptionsLabel(p) });
    if (has3DModel(p)) rows.push({ label: 'Mô hình 3D', value: 'Có — xoay, phóng to trực tiếp trên trang' });
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

  private customOptionsLabel(p: Product): string {
    const c = p.customization;
    const opts: string[] = [];
    if (c?.colors?.length) opts.push('màu sắc');
    if (c?.materials?.length) opts.push('chất liệu');
    if (c?.sizes?.length) opts.push('kích thước');
    if (c?.finishes?.length) opts.push('hoàn thiện');
    if (c?.textOption?.enabled) opts.push('khắc chữ');
    if (c?.accessories?.length) opts.push('phụ kiện');
    return opts.length ? 'Đổi ' + opts.join(', ') : 'Theo yêu cầu';
  }

  /** Đánh giá hiển thị: đánh giá thật, hoặc vài đánh giá mẫu khi sản phẩm chưa có đánh giá nào. */
  get displayReviews(): ProductReview[] {
    if (!this.product) return [];
    return this.product.reviews.length ? this.product.reviews : SAMPLE_REVIEWS;
  }

  private checkCanReview(product: Product): void {
    this.canReview = false;
    this.showReviewForm = false;
    const userId = this.authService.currentUser()?._id;
    if (!userId) return;
    this.productService.canReview(product.id, userId).subscribe(ok => {
      if (this.product?.id === product.id) this.canReview = ok;
    });
  }

  get filteredReviews(): ProductReview[] {
    if (!this.product) return [];
    const reviews = this.displayReviews;
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
    return this.displayReviews.flatMap(r => r.images ?? []).slice(0, 8);
  }

  get ratingBreakdown(): { star: number; count: number; percent: number }[] {
    if (!this.product) return [];
    const reviews = this.displayReviews;
    const total = reviews.length || 1;
    return [5, 4, 3, 2, 1].map(star => {
      const count = reviews.filter(r => r.rating === star).length;
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
    if (this.cartService.addToCart(p, 1)) this.mascotService.react('happy');
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
    if (!this.product || this.isSoldOut) return;
    if (this.cartService.addToCart(this.product, this.quantity)) this.mascotService.react('happy');
  }

  /** Hàng có sẵn đã hết tồn kho → khoá nút mua. */
  get isSoldOut(): boolean {
    return !!this.product && this.product.productionType === 'READY_STOCK' && this.product.inStock <= 0;
  }

  /** Số lượng tối đa được chọn: theo tồn kho với hàng có sẵn. */
  get maxQuantity(): number {
    return this.product?.productionType === 'READY_STOCK' ? Math.max(this.product.inStock, 1) : 99;
  }

  buyNow(): void {
    if (!this.product || this.isSoldOut) return;
    if (!this.cartService.ensureLoggedIn()) return;
    // Đã có sẵn trong giỏ đủ tồn kho thì không thêm nữa, chỉ mang sang thanh toán.
    const inCart = this.cartService.items().some(i => i.product.id === this.product!.id && !i.selectedCustomization);
    if (!this.cartService.addToCart(this.product, this.quantity) && !inCart) return;
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
        this.toastService.success('Cảm ơn bạn đã đánh giá! Luméa tặng bạn 1 voucher giảm giá.');
        this.mascotService.endLoading('happy');
      },
      // Server trả lý do cụ thể khi đánh giá bị bộ lọc chặn (từ ngữ thô tục, spam...).
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Không gửi được đánh giá, vui lòng thử lại.', 6000);
        this.mascotService.endLoading('sad');
      },
    });
  }
}
