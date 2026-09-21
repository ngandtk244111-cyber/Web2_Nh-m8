import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export interface PromoGridBanner {
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  gradient: string;
  link: string;
}

@Component({
  selector: 'app-promo-banner-grid',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './promo-banner-grid.component.html',
  styleUrl: './promo-banner-grid.component.css'
})
export class PromoBannerGridComponent {
  readonly squareBanners: PromoGridBanner[] = [
    {
      icon: 'room',
      eyebrow: 'Bộ Sưu Tập Phòng 3D',
      title: 'Dạo Quanh Không Gian Mẫu',
      description: 'Khám phá phòng khách, phòng ngủ được Luméa phối sẵn theo 360°',
      ctaLabel: 'Khám phá ngay',
      gradient: 'linear-gradient(150deg, #0c1a2e 0%, #163a6e 60%, #2055AF 100%)',
      link: '/shop-the-room',
    },
    {
      icon: 'tag',
      eyebrow: 'Ưu Đãi Thành Viên Mới',
      title: 'Giảm 10% Đơn Đầu Tiên',
      description: 'Nhập mã LUMÉANEW — áp dụng đơn từ 200.000đ',
      ctaLabel: 'Nhận ưu đãi',
      gradient: 'linear-gradient(150deg, #2a1608 0%, #B34213 60%, #FF6D2D 100%)',
      link: '/catalog',
    },
  ];

  readonly wideBanner: PromoGridBanner = {
    icon: 'sliders',
    eyebrow: 'Cá Nhân Hóa Trực Quan',
    title: 'Tùy Biến Sản Phẩm In 3D Theo Ý Bạn',
    description: 'Đổi màu sắc, chất liệu, kích thước và khắc tên riêng ngay trên trình xem 3D',
    ctaLabel: 'Bắt đầu tùy biến',
    gradient: 'linear-gradient(100deg, #050505 0%, #151515 45%, #3a1f0e 100%)',
    link: '/customizer-3d',
  };
}
