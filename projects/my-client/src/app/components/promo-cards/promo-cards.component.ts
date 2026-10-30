import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface PromoPoster {
  image: string;
  alt: string;
  link: string;
  queryParams?: Record<string, string>;
}

/** Hàng poster khuyến mãi ngay dưới hero banner trang chủ — bấm cả poster để vào trang tương ứng. */
@Component({
  selector: 'app-promo-cards',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './promo-cards.component.html',
  styleUrl: './promo-cards.component.css'
})
export class PromoCardsComponent {
  readonly posters: PromoPoster[] = [
    { image: 'assets/promo-cards/xa-kho.jpg', alt: 'Xả kho giá sốc — nhà xinh khỏi lo giá', link: '/catalog', queryParams: { sale: '1' } },
    { image: 'assets/promo-cards/deal-thang-11.jpg', alt: 'Tháng 11 — Deal xịn mỗi ngày, nhà xinh quá', link: '/flash-sale' },
    { image: 'assets/promo-cards/phong-3d.jpg', alt: 'Khám phá Phòng 3D — giảm ngay đến 40%', link: '/shop-the-room' },
  ];
}
