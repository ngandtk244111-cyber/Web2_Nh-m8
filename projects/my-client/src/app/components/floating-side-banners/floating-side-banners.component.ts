import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { BannerService } from '../../core/services/banner.service';

export type FloatingBannerSide = 'left' | 'right';

export interface FloatingSideBanner {
  side: FloatingBannerSide;
  badge: string;
  title: string;
  ctaLabel: string;
  link: string;
  queryParams?: Record<string, string>;
  image: string;
}

const FLOATING_SIDE_BANNERS: FloatingSideBanner[] = [
  {
    side: 'left',
    badge: 'Luméa Living',
    title: 'Tin Tức & Mẹo Sống',
    ctaLabel: 'Đọc ngay',
    link: '/news',
    image: 'assets/floating-banners/side-decor-shelf.jpg',
  },
  {
    side: 'right',
    badge: 'Thương hiệu ưa thích',
    title: 'Luméa Scandinavian',
    ctaLabel: 'Khám phá',
    link: '/thuong-hieu/scandinavian',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80',
  },
];

@Component({
  selector: 'app-floating-side-banners',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './floating-side-banners.component.html',
  styleUrl: './floating-side-banners.component.css'
})
export class FloatingSideBannersComponent {
  private bannerService = inject(BannerService);

  /** Nội dung gốc ghép với phần admin đã sửa; vị trí admin là `side-left` / `side-right`. */
  private readonly mergedBanners = computed<FloatingSideBanner[]>(() => {
    const overrides = this.bannerService.overrides();
    return FLOATING_SIDE_BANNERS.flatMap(banner => {
      const o = overrides[`side-${banner.side}`];
      if (!o) return [banner];
      if (o.active === false) return [];
      return [{
        ...banner,
        badge: o.eyebrow || banner.badge,
        title: o.title || banner.title,
        ctaLabel: o.ctaText || banner.ctaLabel,
        image: o.imageUrl || banner.image,
        ...(o.ctaLink ? this.bannerService.splitLink(o.ctaLink) : {}),
      }];
    });
  });

  get banners(): FloatingSideBanner[] {
    return this.mergedBanners();
  }

  private readonly dismissedSides = signal<Set<FloatingBannerSide>>(new Set());

  constructor() {
    // Gắn body.fsb-left / body.fsb-right khi banner bên đó đang hiện -> styles.css co nội dung chính
    // lại chừa chỗ cho banner (khỏi đè nội dung, không cần màn hình ≥1600px mới thấy banner).
    effect(() => {
      const dismissed = this.dismissedSides();
      const banners = this.mergedBanners();
      for (const side of ['left', 'right'] as const) {
        document.body.classList.toggle(`fsb-${side}`, !dismissed.has(side) && banners.some(b => b.side === side));
      }
    });
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('fsb-left', 'fsb-right'));
  }

  isDismissed(side: FloatingBannerSide): boolean {
    return this.dismissedSides().has(side);
  }

  dismiss(side: FloatingBannerSide, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissedSides.update(set => new Set(set).add(side));
  }
}
