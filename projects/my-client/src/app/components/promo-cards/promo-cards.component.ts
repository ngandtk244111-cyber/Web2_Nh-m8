import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
import { BannerService } from '../../core/services/banner.service';

export interface PromoPoster {
  id: string;
  image: string;
  alt: string;
  link: string;
  queryParams?: Record<string, string>;
}

const POSTERS: PromoPoster[] = [
  { id: 'promo-xa-kho', image: 'assets/promo-cards/xa-kho.jpg', alt: 'Xả kho giá sốc — nhà xinh khỏi lo giá', link: '/catalog', queryParams: { sale: '1' } },
  { id: 'promo-deal-thang', image: 'assets/promo-cards/deal-thang-11.jpg', alt: 'Tháng 11 — Deal xịn mỗi ngày, nhà xinh quá', link: '/flash-sale' },
  { id: 'promo-phong-3d', image: 'assets/promo-cards/phong-3d.jpg', alt: 'Khám phá Phòng 3D — giảm ngay đến 40%', link: '/shop-the-room' },
];

/** Hàng poster khuyến mãi ngay dưới hero banner trang chủ — bấm cả poster để vào trang tương ứng. */
@Component({
  selector: 'app-promo-cards',
  standalone: true,
  imports: [CommonModule, RouterLink, ScrollRevealDirective],
  templateUrl: './promo-cards.component.html',
  styleUrl: './promo-cards.component.css'
})
export class PromoCardsComponent {
  private bannerService = inject(BannerService);

  private readonly mergedPosters = computed<PromoPoster[]>(() => {
    const overrides = this.bannerService.overrides();
    return POSTERS.map(poster => {
      const o = overrides[poster.id];
      if (!o) return poster;
      return {
        ...poster,
        image: o.imageUrl || poster.image,
        alt: o.title || poster.alt,
        ...(o.ctaLink ? { queryParams: undefined, ...this.bannerService.splitLink(o.ctaLink) } : {}),
      };
    });
  });

  get posters(): PromoPoster[] {
    return this.mergedPosters();
  }
}
