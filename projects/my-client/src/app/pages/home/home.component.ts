import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { ProductCategory } from '../../core/models/product.model';
import { RoomService } from '../../core/services/room.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { CommunityService } from '../../core/services/community.service';
import { NewsService } from '../../core/services/news.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
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
    ProductCardComponent,
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
    ScrollRevealDirective
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

  /** Đồng bộ 100% với các nhóm chính của Mega Menu (xem header.component.ts). */
  private readonly categoryDefs: { label: string; categoryId?: ProductCategory; link?: string; queryParams?: Record<string, string> }[] = [
    { label: 'Decor Bàn', categoryId: 'tray', queryParams: { category: 'tray' } },
    { label: 'Tượng & Mô Hình', categoryId: 'sculpture', queryParams: { category: 'sculpture' } },
    { label: 'Đèn & Chiếu Sáng', categoryId: 'lamp', queryParams: { category: 'lamp' } },
    { label: 'Chậu & Cây Decor', categoryId: 'plant_pot', queryParams: { category: 'plant_pot' } },
    { label: 'Phụ Kiện', categoryId: 'organizer', queryParams: { category: 'organizer' } },
    { label: 'Decor Theo Phong Cách', link: '/catalog' },
    { label: 'Decor Theo Không Gian', link: '/shop-the-room' },
    { label: '3D & Custom', link: '/customizer-3d' },
  ];

  /** Ảnh lấy từ sản phẩm thật (ảnh đầu tiên của 1 sản phẩm đại diện cho danh mục) — không dùng ảnh giả. */
  categories: { label: string; image: string; link?: string; queryParams?: Record<string, string> }[] = [];

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
      this.customizableProducts = this.productService.customizableProducts().slice(0, 4);
      this.readyStockProducts = this.productService.readyStockProducts().slice(0, 4);

      if (products.length > 0) {
        const customizableSample = products.find(p => p.customizable) || products[0];
        this.categories = this.categoryDefs.map(def => {
          const sample = def.categoryId
            ? (products.find(p => p.category === def.categoryId) || products[0])
            : (def.link === '/customizer-3d' ? customizableSample : products[0]);
          return {
            label: def.label,
            image: sample.images[0],
            link: def.link,
            queryParams: def.queryParams,
          };
        });
      }
    });
    effect(() => {
      this.activeRoom = this.roomService.getActiveRoom();
    });
    effect(() => {
      this.communityPosts = this.communityService.posts().slice(0, 4);
    });
    effect(() => {
      this.newsArticles = this.newsService.articles().slice(0, 3);
      this.lifeTipsArticles = this.newsService.getArticlesByCategory('Xu hướng Decor').slice(0, 3);
    });
  }

  /** Ảnh danh mục (lấy từ ảnh sản phẩm thật) lỗi tải — ẩn đi để lộ nền gradient thay vì icon "ảnh vỡ". */
  onCategoryImageError(event: Event): void {
    (event.target as HTMLImageElement).classList.add('cat-icon__broken');
  }

  ngOnInit(): void {}

  openAiAssistant(): void {
    this.aiService.openModal();
  }
}
