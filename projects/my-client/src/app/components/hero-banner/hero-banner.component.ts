import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AUTOPLAY_INTERVAL_MS, HeroPicks, HeroTickerService } from '../../core/services/hero-ticker.service';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

/** Số sản phẩm trong cụm ở giữa banner. */
const PICK_COUNT = 3;
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.css'
})
export class HeroBannerComponent {
  readonly intervalMs = AUTOPLAY_INTERVAL_MS;

  constructor(
    public tickerService: HeroTickerService,
    private aiService: AiAssistantService,
    private productService: ProductService
  ) {}

  /**
   * Cụm sản phẩm minh hoạ cho từng slide (theo thứ tự slide), lấy từ dữ liệu thật (có ảnh).
   * Mỗi sản phẩm chỉ xuất hiện ở 1 slide — kể cả khi 2 slide dùng chung nhóm (vd. 'top'), hoặc
   * các nhóm trùng nhau (sản phẩm vừa giảm giá vừa có 3D), slide sau lấy tiếp các món chưa dùng.
   */
  readonly picks = computed<Product[][]>(() => {
    const all = [...this.productService.products().filter(p => p.images?.length)].sort((a, b) => b.rating - a.rating);
    const groups: Record<HeroPicks, (p: Product) => boolean> = {
      has3d: p => !!p.modelUrl || !!p.threeModelType,
      print: p => p.productionType === 'PRINT_ON_DEMAND',
      ready: p => p.productionType === 'READY_STOCK' && p.inStock > 0,
      top: () => true,
      sale: p => !!p.originalPrice && p.originalPrice > p.basePrice,
    };
    const used = new Set<string>();
    return this.tickerService.items.map(item => {
      const list = all.filter(p => !used.has(p.id) && groups[item.art.picks](p)).slice(0, PICK_COUNT);
      list.forEach(p => used.add(p.id));
      return list;
    });
  });

  /** % giảm của sản phẩm (để gắn tem trên thẻ), null nếu không giảm. */
  discountOf(p: Product): number | null {
    if (!p.originalPrice || p.originalPrice <= p.basePrice) return null;
    return Math.round((1 - p.basePrice / p.originalPrice) * 100);
  }

  get activeItem() {
    return this.tickerService.items[this.tickerService.activeIndex()];
  }

  onCtaClick(itemId: string, ev: Event): void {
    if (itemId === 'ai-assistant') {
      ev.preventDefault();
      this.aiService.openModal();
    }
  }

  onMouseEnter(): void {
    this.tickerService.pause();
  }

  onMouseLeave(): void {
    this.tickerService.resume();
  }

  goPrev(): void {
    const total = this.tickerService.items.length;
    this.tickerService.setActive(this.tickerService.activeIndex() - 1 + total);
  }

  goNext(): void {
    this.tickerService.setActive(this.tickerService.activeIndex() + 1);
  }
}
