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

  /** Cụm sản phẩm minh hoạ cho từng slide, lấy từ dữ liệu thật (có ảnh). */
  readonly picks = computed<Record<HeroPicks, Product[]>>(() => {
    const all = this.productService.products().filter(p => p.images?.length);
    const top = (list: Product[]) => [...list].sort((a, b) => b.rating - a.rating).slice(0, PICK_COUNT);
    return {
      has3d: top(all.filter(p => !!p.modelUrl || !!p.threeModelType)),
      print: top(all.filter(p => p.productionType === 'PRINT_ON_DEMAND')),
      ready: top(all.filter(p => p.productionType === 'READY_STOCK' && p.inStock > 0)),
      top: top(all),
      sale: top(all.filter(p => !!p.originalPrice && p.originalPrice > p.basePrice)),
    };
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
