import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export type FloatingBannerSide = 'left' | 'right';

export interface FloatingSideBanner {
  side: FloatingBannerSide;
  icon: string;
  eyebrow: string;
  title: string;
  ctaLabel: string;
  gradient: string;
  link: string;
  image?: string;
  imageMode?: 'accent' | 'cover';
}

const FLOATING_SIDE_BANNERS: FloatingSideBanner[] = [
  {
    side: 'left',
    icon: 'sparkles',
    eyebrow: 'AI Thiết Kế Riêng',
    title: 'Biến Ý Tưởng Thành Concept 3D',
    ctaLabel: 'Thử ngay',
    gradient: 'linear-gradient(160deg, #0a1220 0%, #1B3F73 55%, #2E63B8 100%)',
    link: '/custom-request/new',
    image: 'assets/floating-banners/ai-room-3d.png',
    imageMode: 'accent',
  },
  {
    side: 'right',
    icon: 'truck',
    eyebrow: 'Ưu Đãi Vận Chuyển',
    title: 'Miễn Phí Ship Từ 300.000đ',
    ctaLabel: 'Mua sắm ngay',
    gradient: 'linear-gradient(180deg, rgba(5,26,18,0.45) 0%, rgba(5,26,18,0.8) 100%)',
    link: '/catalog',
    image: 'assets/floating-banners/rocket-freeship.png',
    imageMode: 'cover',
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

  isDismissed(side: FloatingBannerSide): boolean {
    return this.dismissedSides().has(side);
  }

  dismiss(side: FloatingBannerSide, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissedSides.update(set => new Set(set).add(side));
  }

  background(banner: FloatingSideBanner): string {
    if (banner.imageMode === 'cover' && banner.image) {
      return `${banner.gradient}, url(${banner.image})`;
    }
    return banner.gradient;
  }
}
