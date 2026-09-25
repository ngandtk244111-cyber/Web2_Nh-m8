import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export interface PromoGridBanner {
  /** photo: ảnh phủ kín + chữ đè dưới đáy; mascot: khối đỏ đô, chữ bên trái, mascot tròn bên phải. */
  layout: 'photo' | 'mascot';
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  image: string;
  /** Mã ưu đãi hiển thị dạng vé (chỉ layout mascot). */
  code?: string;
}

export interface PromoWideBanner {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  /** Video minh hoạ bên phải, tự phát/loop/tắt tiếng. */
  video: { mp4: string; webm?: string };
  /** Màu mẫu hiển thị trên khung minh hoạ trình tuỳ biến. */
  swatches: string[];
  engraving: string;
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
      layout: 'photo',
      icon: 'room',
      eyebrow: 'Bộ Sưu Tập Phòng 3D',
      title: 'Dạo Quanh Không Gian Mẫu',
      description: 'Khám phá phòng khách, phòng ngủ được Luméa phối sẵn theo 360°',
      ctaLabel: 'Khám phá ngay',
      link: '/shop-the-room',
      image: 'assets/promo-banner/room-3d-collection.png',
    },
    {
      layout: 'mascot',
      icon: 'tag',
      eyebrow: 'Ưu Đãi Thành Viên Mới',
      title: 'Giảm 10% Đơn Đầu Tiên',
      description: 'Áp dụng cho đơn hàng từ 200.000đ',
      ctaLabel: 'Nhận ưu đãi',
      link: '/catalog',
      image: 'assets/mascot/goh-mascot.png',
      code: 'LUMÉANEW',
    },
  ];

  readonly wideBanner: PromoWideBanner = {
    eyebrow: 'Cá Nhân Hóa Trực Quan',
    title: 'Tùy Biến Sản Phẩm In 3D Theo Ý Bạn',
    description: 'Đổi màu sắc, chất liệu, kích thước và khắc tên riêng ngay trên trình xem 3D',
    ctaLabel: 'Bắt đầu tùy biến',
    link: '/customizer-3d',
    // TODO: đây là video placeholder (CC0, nguồn MDN) — thay bằng video quay/dựng thật của Luméa khi có.
    video: {
      mp4: 'assets/promo-banner/customizer-placeholder.mp4',
      webm: 'assets/promo-banner/customizer-placeholder.webm',
    },
    swatches: ['#F3E3D9', '#CD818E', '#A3152D', '#2B2B2B'],
    engraving: 'LUMÉA',
  };
}
