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
  image?: string;
  /** Video nền tự phát/loop/tắt tiếng, phủ lên trên `gradient` (dùng làm fallback khi video chưa load). */
  video?: { mp4: string; webm?: string };
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
      gradient: 'linear-gradient(150deg, #0c1a2e 0%, #163a6e 60%, #A3152D 100%)',
      link: '/shop-the-room',
      image: 'assets/promo-banner/room-3d-collection.png',
    },
    {
      icon: 'tag',
      eyebrow: 'Ưu Đãi Thành Viên Mới',
      title: 'Giảm 10% Đơn Đầu Tiên',
      description: 'Nhập mã LUMÉANEW — áp dụng đơn từ 200.000đ',
      ctaLabel: 'Nhận ưu đãi',
      gradient: 'linear-gradient(150deg, #0d1a2e 0%, #E2B4BC 60%, #A3152D 100%)',
      link: '/catalog',
      image: 'assets/promo-banner/member-promo-mascot.png',
    },
  ];

  readonly wideBanner: PromoGridBanner = {
    icon: 'sliders',
    eyebrow: 'Cá Nhân Hóa Trực Quan',
    title: 'Tùy Biến Sản Phẩm In 3D Theo Ý Bạn',
    description: 'Đổi màu sắc, chất liệu, kích thước và khắc tên riêng ngay trên trình xem 3D',
    ctaLabel: 'Bắt đầu tùy biến',
    gradient: 'linear-gradient(115deg, #060a12 0%, #E2B4BC 35%, #A3152D 65%, #CD818E 130%)',
    link: '/customizer-3d',
    // TODO: đây là video placeholder (CC0, nguồn MDN) — thay bằng video quay/dựng thật của Luméa khi có.
    video: {
      mp4: 'assets/promo-banner/customizer-placeholder.mp4',
      webm: 'assets/promo-banner/customizer-placeholder.webm',
    },
  };
}
