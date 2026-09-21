import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export interface PromoCard {
  icon: string;
  title: string;
  subtitle: string;
  link: string;
}

@Component({
  selector: 'app-promo-cards',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './promo-cards.component.html',
  styleUrl: './promo-cards.component.css'
})
export class PromoCardsComponent {
  readonly cards: PromoCard[] = [
    { icon: 'sparkles', title: 'Trắc Nghiệm Phong Cách', subtitle: 'Làm quiz, nhận ngay 30 xu', link: '/style-quiz' },
    { icon: 'room', title: 'Bộ Sưu Tập Phòng 3D', subtitle: 'Khám phá không gian mẫu 360°', link: '/shop-the-room' },
    { icon: 'sliders', title: 'Tùy Biến Sản Phẩm', subtitle: 'Cá nhân hóa màu sắc, khắc tên', link: '/customizer-3d' },
    { icon: 'shield', title: 'Bảo Hành 12 Tháng', subtitle: 'Yên tâm sử dụng lâu dài', link: '/warranty-lookup' },
  ];
}
