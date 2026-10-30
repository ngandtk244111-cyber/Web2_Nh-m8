import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export type FloatingBannerSide = 'left' | 'right';

export interface FloatingSideBanner {
  side: FloatingBannerSide;
  badge: string;
  title: string;
  ctaLabel: string;
  link: string;
  image: string;
}

const FLOATING_SIDE_BANNERS: FloatingSideBanner[] = [
  {
    side: 'left',
    badge: 'AI Thiết Kế',
    title: 'Decor Theo Ý Bạn',
    ctaLabel: 'Thử ngay',
    link: '/custom-request/new',
    image: 'assets/floating-banners/side-decor-shelf.jpg',
  },
  {
    side: 'right',
    badge: 'Freeship',
    title: 'Đèn Decor Từ 300K',
    ctaLabel: 'Mua ngay',
    link: '/catalog',
    image: 'assets/floating-banners/side-pendant-lamps.jpg',
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
  readonly banners = FLOATING_SIDE_BANNERS;
  private readonly dismissedSides = signal<Set<FloatingBannerSide>>(new Set());

  constructor() {
    // Gắn body.fsb-left / body.fsb-right khi banner bên đó đang hiện -> styles.css co nội dung chính
    // lại chừa chỗ cho banner (khỏi đè nội dung, không cần màn hình ≥1600px mới thấy banner).
    effect(() => {
      const dismissed = this.dismissedSides();
      for (const side of ['left', 'right'] as const) {
        document.body.classList.toggle(`fsb-${side}`, !dismissed.has(side));
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
