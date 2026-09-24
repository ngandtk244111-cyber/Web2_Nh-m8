import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { NewsService } from '../../core/services/news.service';
import { CommunityService } from '../../core/services/community.service';
import { RoomService } from '../../core/services/room.service';
import { Product, ProductStyle } from '../../core/models/product.model';
import { BRAND_HASHTAGS, BRAND_TAGLINES, styleFromSlug } from '../../core/data/brand-styles';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

interface BannerSlide {
  image: string;
  title: string;
  sub: string;
  link: string;
}

/** Banner chiến dịch dùng lại asset hero có sẵn; link chỉ tới route đang tồn tại. */
const BANNERS: BannerSlide[] = [
  { image: 'assets/hero-banner/hero-deal-today.png', title: 'Flash Sale Giá Tốt', sub: 'Deal decor nhỏ, giảm đến 40% mỗi ngày', link: '/flash-sale' },
  { image: 'assets/hero-banner/hero-room-3d.png', title: 'Phòng Mẫu 3D', sub: 'Xoay không gian và mua món đồ bạn thích', link: '/shop-the-room' },
  { image: 'assets/hero-banner/hero-print-3d.png', title: 'In 3D Theo Yêu Cầu', sub: 'Tùy biến màu sắc, chất liệu, kích thước', link: '/customizer-3d' },
  { image: 'assets/hero-banner/hero-ai-assistant.png', title: 'AI Gợi Ý Decor', sub: 'Mô tả ý tưởng, nhận concept ngay', link: '/custom-request/new' },
  { image: 'assets/hero-banner/hero-freeship.png', title: 'Miễn Phí Vận Chuyển', sub: 'Cho đơn hàng từ 500.000₫', link: '/catalog' },
];

@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [CommonModule, RouterLink, VndPipe],
  templateUrl: './brand.component.html',
  styleUrl: './brand.component.css'
})
export class BrandComponent {
  readonly banners = BANNERS;
  readonly bannerIndex = signal(0);

  private readonly styleSignal = signal<ProductStyle | undefined>(undefined);
  readonly style = this.styleSignal.asReadonly();
  readonly tagline = computed(() => (this.style() ? BRAND_TAGLINES[this.style()!] : ''));
  readonly hashtag = computed(() => (this.style() ? BRAND_HASHTAGS[this.style()!] : ''));

  constructor(
    route: ActivatedRoute,
    private productService: ProductService,
    private newsService: NewsService,
    private communityService: CommunityService,
    private roomService: RoomService
  ) {
    route.paramMap.subscribe(p => this.styleSignal.set(styleFromSlug(p.get('style'))));
  }

  /**
   * Sản phẩm của dòng phong cách này lên trước; dữ liệu còn ít nên các hàng được bù thêm sản phẩm
   * khác của Luméa cho đủ hàng (sản phẩm thuộc đúng dòng luôn xếp đầu).
   */
  private readonly pool = computed<Product[]>(() => {
    const all = this.productService.products();
    const style = this.style();
    const own = all.filter(p => p.style === style);
    return [...own, ...all.filter(p => p.style !== style)];
  });

  readonly categoryTiles = computed(() => {
    const seen = new Set<string>();
    const tiles: { label: string; category: string; image: string }[] = [];
    for (const p of this.pool()) {
      if (seen.has(p.category)) continue;
      seen.add(p.category);
      tiles.push({ label: p.categoryName, category: p.category, image: p.images[0] });
    }
    return tiles.slice(0, 16);
  });

  readonly articles = computed(() => this.newsService.articles());
  readonly featuredArticles = computed(() => this.articles().slice(0, 6));
  readonly blogArticles = computed(() => this.articles().slice(0, 3));

  readonly posts = computed(() => {
    const tag = this.hashtag();
    const all = this.communityService.posts();
    const tagged = all.filter(p => p.tags.some(t => t.toLowerCase() === tag));
    return [...tagged, ...all.filter(p => !tagged.includes(p))].slice(0, 10);
  });

  readonly rooms = computed(() => this.roomService.rooms());

  readonly saleProducts = computed(() =>
    this.pool().filter(p => !!p.originalPrice && p.originalPrice > p.basePrice).slice(0, 12)
  );

  readonly newProducts = computed(() => [...this.pool()].reverse().slice(0, 12));

  stars(rating: number): boolean[] {
    return [0, 1, 2, 3, 4].map(i => i < Math.round(rating));
  }

  scrollRow(row: HTMLElement, dir: 1 | -1): void {
    row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: 'smooth' });
  }

  private bannerStep(track: HTMLElement): number {
    const first = track.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 16 : track.clientWidth;
  }

  onBannerScroll(track: HTMLElement): void {
    this.bannerIndex.set(Math.round(track.scrollLeft / this.bannerStep(track)));
  }

  goBanner(track: HTMLElement, index: number): void {
    const n = this.banners.length;
    const i = ((index % n) + n) % n;
    track.scrollTo({ left: i * this.bannerStep(track), behavior: 'smooth' });
  }
}
