import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { ProductCategory } from '../../core/models/product.model';
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
import { ParallaxDirective } from '../../shared/directives/parallax.directive';

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
    ScrollRevealDirective,
    ParallaxDirective
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  customizableProducts: any[] = [];
  readyStockProducts: any[] = [];
  activeRoom: any;
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
    private newsService: NewsService
  ) {
    // Dữ liệu giờ nạp bất đồng bộ từ backend — dùng effect() để tự cập nhật khi signal đổi,
    // thay vì chỉ đọc 1 lần lúc ngOnInit (lúc đó dữ liệu có thể chưa kịp tải về).
    effect(() => {
      const products = this.productService.products();
      this.customizableProducts = this.productService.customizableProducts().slice(0, 10);
      this.readyStockProducts = this.productService.readyStockProducts().slice(0, 10);
    });
    effect(() => {
      this.activeRoom = this.roomService.getActiveRoom();
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

  openAiAssistant(): void {
    this.aiService.openModal();
  }
}
