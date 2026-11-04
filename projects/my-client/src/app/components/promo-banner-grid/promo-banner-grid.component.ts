import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
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
  /** Video phủ kín banner, tự phát/loop/tắt tiếng. */
  video: { mp4: string; webm?: string };
}

@Component({
  selector: 'app-promo-banner-grid',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, ScrollRevealDirective],
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
      link: '/voucher',
      image: 'assets/mascot/goh-happy.png',
      code: 'LUMÉANEW',
    },
  ];

  readonly wideBanner: PromoWideBanner = {
    eyebrow: 'Đặt Làm Theo Yêu Cầu',
    title: 'Món Đồ Độc Bản, Làm Riêng Cho Bạn',
    description: 'Gửi ý tưởng hoặc ảnh tham khảo — đội ngũ Luméa tư vấn, báo giá và chế tác tỉ mỉ từng chi tiết',
    ctaLabel: 'Gửi yêu cầu',
    link: '/custom-request/new',
    video: {
      mp4: 'assets/promo-banner/sofa-intro.mp4',
    },
  };
}
