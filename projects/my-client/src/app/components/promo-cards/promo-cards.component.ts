import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
import { BannerOverrides, BannerService } from '../../core/services/banner.service';

export interface PromoPoster {
  id: string;
  image: string;
  alt: string;
  link: string;
  queryParams?: Record<string, string>;
}

/** Poster ưu đãi — dùng ở popup khi vào web (PosterPopupComponent) và carousel bên dưới. */
export const PROMO_POSTERS: PromoPoster[] = [
  { id: 'promo-xa-kho', image: 'assets/promo-cards/xa-kho.jpg', alt: 'Xả kho giá sốc — nhà xinh khỏi lo giá', link: '/catalog', queryParams: { sale: '1' } },
  { id: 'promo-deal-thang', image: 'assets/promo-cards/deal-thang-11.jpg', alt: 'Tháng 11 — Deal xịn mỗi ngày, nhà xinh quá', link: '/flash-sale' },
  { id: 'promo-phong-3d', image: 'assets/promo-cards/phong-3d.jpg', alt: 'Khám phá Phòng 3D — giảm ngay đến 40%', link: '/shop-the-room' },
  { id: 'promo-tham-quan', image: 'assets/promo-cards/tham-quan-phong-3d.jpg', alt: 'Tham quan phòng 3D — ngắm trước, mua sau, chạm vào món đồ để mua', link: '/shop-the-room' },
];

/** Ghép poster gốc với phần admin đã sửa (ảnh, tiêu đề, link). */
export function mergePosters(overrides: BannerOverrides, banners: BannerService): PromoPoster[] {
  return PROMO_POSTERS.map(poster => {
    const o = overrides[poster.id];
    if (!o) return poster;
    return {
      ...poster,
      image: o.imageUrl || poster.image,
      alt: o.title || poster.alt,
      ...(o.ctaLink ? { queryParams: undefined, ...banners.splitLink(o.ctaLink) } : {}),
    };
  });
}

/**
 * Carousel poster khuyến mãi: poster giữa nổi lên (to, rõ), hai bên lùi ra sau và mờ hơn, tự chuyển sau
 * vài giây. Bấm poster bên cạnh để đưa nó vào giữa, bấm poster giữa để mở trang.
 */
@Component({
  selector: 'app-promo-cards',
  standalone: true,
  imports: [CommonModule, AppIconComponent, ScrollRevealDirective],
  templateUrl: './promo-cards.component.html',
  styleUrl: './promo-cards.component.css'
})
export class PromoCardsComponent implements OnInit, OnDestroy {
  private bannerService = inject(BannerService);
  private readonly mergedPosters = computed(() => mergePosters(this.bannerService.overrides(), this.bannerService));

  get posters(): PromoPoster[] {
    return this.mergedPosters();
  }

  readonly active = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private touchX: number | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.timer = setInterval(() => {
        if (!this.paused && !document.hidden) this.step(1);
      }, 4000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Vị trí của poster so với poster giữa: 0 = giữa, ±1 = hai bên, 2 = nằm khuất phía sau. */
  offset(i: number): number {
    const n = this.posters.length;
    let d = (i - this.active() + n) % n;
    if (d > n / 2) d -= n;
    return d;
  }

  isHidden(i: number): boolean {
    return Math.abs(this.offset(i)) > 1;
  }

  step(dir: number): void {
    const n = this.posters.length;
    this.active.set((this.active() + dir + n) % n);
  }

  go(i: number): void {
    this.active.set(i);
  }

  /** Bấm poster bên cạnh: đưa vào giữa; bấm poster giữa: mở trang ưu đãi. */
  open(i: number): void {
    if (i !== this.active()) {
      this.go(i);
      return;
    }
    const p = this.posters[i];
    this.router.navigate([p.link], { queryParams: p.queryParams });
  }

  pause(on: boolean): void {
    this.paused = on;
  }

  onTouchStart(e: TouchEvent): void {
    this.touchX = e.touches[0].clientX;
    this.paused = true;
  }

  onTouchEnd(e: TouchEvent): void {
    if (this.touchX !== null) {
      const dx = e.changedTouches[0].clientX - this.touchX;
      if (Math.abs(dx) > 40) this.step(dx < 0 ? 1 : -1);
    }
    this.touchX = null;
    this.paused = false;
  }
}
