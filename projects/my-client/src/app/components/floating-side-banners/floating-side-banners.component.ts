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
}

const FLOATING_SIDE_BANNERS: FloatingSideBanner[] = [
  {
    side: 'left',
    icon: 'sparkles',
    eyebrow: 'AI Thiết Kế Riêng',
    title: 'Biến Ý Tưởng Thành Concept 3D',
    ctaLabel: 'Thử ngay',
    gradient: 'linear-gradient(160deg, #1a0f05 0%, #B34213 55%, #FF6D2D 100%)',
    link: '/custom-request/new',
  },
  {
    side: 'right',
    icon: 'truck',
    eyebrow: 'Ưu Đãi Vận Chuyển',
    title: 'Miễn Phí Ship Từ 300.000đ',
    ctaLabel: 'Mua sắm ngay',
    gradient: 'linear-gradient(160deg, #051a12 0%, #1f7a4d 55%, #34b374 100%)',
    link: '/catalog',
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
}
