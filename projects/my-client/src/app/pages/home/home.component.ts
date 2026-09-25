import { Component, OnInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { Product, ProductCategory } from '../../core/models/product.model';
import { Room } from '../../core/models/room.model';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { MascotService } from '../../core/services/mascot.service';
import { RoomService } from '../../core/services/room.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { CommunityService } from '../../core/services/community.service';
import { NewsService } from '../../core/services/news.service';
import { ProductCarouselComponent } from '../../components/product-carousel/product-carousel.component';
import { RoomViewerComponent } from '../../components/room-viewer/room-viewer.component';
import { RecentlyViewedSectionComponent } from '../../components/recently-viewed-section/recently-viewed-section.component';
import { HeroBannerComponent } from '../../components/hero-banner/hero-banner.component';
import { PromoCardsComponent } from '../../components/promo-cards/promo-cards.component';
import { PromoBannerGridComponent } from '../../components/promo-banner-grid/promo-banner-grid.component';
import { DecorDealsComponent } from '../../components/decor-deals/decor-deals.component';
import { TipPopupComponent } from '../../components/tip-popup/tip-popup.component';
import { FavoriteStylesComponent } from '../../components/favorite-styles/favorite-styles.component';
import { VideoTopicsComponent } from '../../components/video-topics/video-topics.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProductCarouselComponent,
    RoomViewerComponent,
    RecentlyViewedSectionComponent,
    HeroBannerComponent,
    PromoCardsComponent,
    PromoBannerGridComponent,
    DecorDealsComponent,
    TipPopupComponent,
    FavoriteStylesComponent,
    VideoTopicsComponent,
    AppIconComponent,
    VndPipe,
    ScrollRevealDirective
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  customizableProducts: any[] = [];
  readyStockProducts: any[] = [];
  activeRoom: Room | undefined;
  /** Các phòng hiển thị ở section Shop The Room — chỉ phòng dựng sẵn có điểm sản phẩm
   *  (phòng scan .glb nặng và chưa gắn sản phẩm để dành cho trang /shop-the-room). */
  showcaseRooms: Room[] = [];
  /** Sản phẩm trong phòng đang xem, đúng thứ tự điểm đánh dấu (số 1..N trên viewer). */
  roomProducts: { product: Product; note: string; pin: number }[] = [];
  @ViewChild(RoomViewerComponent) roomViewer?: RoomViewerComponent;
  communityPosts: any[] = [];
  newsArticles: any[] = [];
  /** "Mẹo Sống": bài viết thật thuộc chuyên mục Xu hướng Decor (tips sắp xếp/chăm sóc không gian sống). */
  lifeTipsArticles: any[] = [];

  /** Dải chữ chạy ngang giữa trang — không ghi số tiền/mốc freeship để tránh lệch với trang chính sách. */
  readonly marqueeItems = [
    'Mini 3D Printed Decor',
    'In theo yêu cầu',
    'Tuỳ biến màu sắc & kích thước',
    'Xem trước mô hình 3D',
    'Thiết kế cùng trợ lý AI',
    'Giao hàng toàn quốc',
  ];

  /** Đồng bộ 100% với các nhóm chính của Mega Menu (xem header.component.ts). */
  private readonly categoryDefs: { label: string; illustration: string; categoryId?: ProductCategory; link?: string; queryParams?: Record<string, string> }[] = [
    { label: 'Decor Bàn', illustration: 'decor-ban', categoryId: 'tray', queryParams: { category: 'tray' } },
    { label: 'Tượng & Mô Hình', illustration: 'tuong-mo-hinh', categoryId: 'sculpture', queryParams: { category: 'sculpture' } },
    { label: 'Đèn & Chiếu Sáng', illustration: 'den-chieu-sang', categoryId: 'lamp', queryParams: { category: 'lamp' } },
    { label: 'Chậu & Cây Decor', illustration: 'chau-cay', categoryId: 'plant_pot', queryParams: { category: 'plant_pot' } },
    { label: 'Phụ Kiện', illustration: 'phu-kien', categoryId: 'organizer', queryParams: { category: 'organizer' } },
    { label: 'Decor Theo Phong Cách', illustration: 'phong-cach', link: '/catalog' },
    { label: 'Decor Theo Không Gian', illustration: 'khong-gian', link: '/shop-the-room' },
    { label: '3D & Custom', illustration: '3d-custom', link: '/customizer-3d' },
  ];

  /** Thẻ danh mục dùng minh họa 3D đồng nhất (assets/categories) — điều hướng vẫn theo link/queryParams của categoryDefs. */
  readonly categories: { label: string; image: string; link?: string; queryParams?: Record<string, string> }[] =
    this.categoryDefs.map(def => ({
      label: def.label,
      image: `assets/categories/${def.illustration}.png`,
      link: def.link,
      queryParams: def.queryParams,
    }));

  constructor(
    private productService: ProductService,
    private roomService: RoomService,
    private aiService: AiAssistantService,
    private communityService: CommunityService,
    private newsService: NewsService,
    private cartService: CartService,
    private toastService: ToastService,
    private mascotService: MascotService
  ) {
    // Dữ liệu giờ nạp bất đồng bộ từ backend — dùng effect() để tự cập nhật khi signal đổi,
    // thay vì chỉ đọc 1 lần lúc ngOnInit (lúc đó dữ liệu có thể chưa kịp tải về).
    effect(() => {
      const products = this.productService.products();
      this.customizableProducts = this.productService.customizableProducts().slice(0, 10);
      this.readyStockProducts = this.productService.readyStockProducts().slice(0, 10);
    });
    effect(() => {
      this.productService.products();
      this.showcaseRooms = this.roomService.rooms().filter(r => r.roomType !== 'glb_scene' && r.hotspots.length > 0);
      if (!this.activeRoom || !this.showcaseRooms.some(r => r.id === this.activeRoom!.id)) {
        this.activeRoom = this.showcaseRooms[0] ?? this.roomService.getActiveRoom();
      }
      this.updateRoomProducts();
    });
    effect(() => {
      this.communityPosts = this.communityService.posts().slice(0, 5);
    });
    effect(() => {
      this.newsArticles = this.newsService.articles().slice(0, 5);
      this.lifeTipsArticles = this.newsService.getArticlesByCategory('Xu hướng Decor').slice(0, 3);
    });
  }

  ngOnInit(): void {}

  selectRoom(room: Room): void {
    if (room.id === this.activeRoom?.id) return;
    this.activeRoom = room;
    this.updateRoomProducts();
  }

  private updateRoomProducts(): void {
    this.roomProducts = (this.activeRoom?.hotspots ?? [])
      .map((h, i) => ({ product: this.productService.getProductById(h.productId), note: h.annotationNote, pin: i + 1 }))
      .filter((x): x is { product: Product; note: string; pin: number } => !!x.product);
  }

  /** Bỏ phần tên tiếng Anh trong ngoặc cho tab: "Góc Học Tập ... (Minimal Study Desk)" -> "Góc Học Tập ...". */
  shortRoomName(name: string): string {
    return name.replace(/\s*\(.*\)\s*$/, '');
  }

  get roomLookTotal(): number {
    return this.roomProducts.reduce((sum, x) => sum + x.product.basePrice, 0);
  }

  focusRoomProduct(productId: string): void {
    this.roomViewer?.selectHotspotByProduct(productId);
  }

  addRoomLookToCart(): void {
    if (this.roomProducts.length === 0) return;
    this.roomProducts.forEach(x => this.cartService.addToCart(x.product, 1));
    this.toastService.success(`Đã thêm ${this.roomProducts.length} sản phẩm của "${this.activeRoom?.name}" vào giỏ hàng`);
    this.mascotService.react('happy');
  }

  openAiAssistant(): void {
    this.aiService.openModal();
  }
}
