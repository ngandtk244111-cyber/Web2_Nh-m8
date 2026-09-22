import { Injectable, signal } from '@angular/core';

export interface HeroTickerItem {
  id: string;
  /** Nội dung hiển thị trên ticker chạy ngang ở header. */
  tickerLabel: string;
  /** Nội dung hero banner tương ứng, hiển thị ngay dưới ticker ở trang chủ. */
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaLink: string;
  icon: string;
  gradient: string;
  image: string;
}

const AUTOPLAY_INTERVAL_MS = 4500;

/**
 * State dùng chung giữa AnnouncementTickerComponent (trong header, mọi trang) và
 * HeroBannerComponent (trang chủ) — 1 timer duy nhất điều khiển "item đang active" để
 * ticker và hero banner luôn đồng bộ với nhau (bấm ticker đổi banner, banner tự chuyển
 * theo thời gian thì ticker cũng highlight đúng item).
 */
@Injectable({ providedIn: 'root' })
export class HeroTickerService {
  readonly items: HeroTickerItem[] = [
    {
      id: 'room-3d',
      tickerLabel: 'Khám phá Phòng 3D',
      title: 'Khám Phá Phòng 3D Trực Quan',
      subtitle: 'Dạo quanh không gian sống 360° trước khi quyết định mua — xem đúng món đồ decor nằm ở đâu trong căn phòng thật.',
      ctaLabel: 'Khám phá ngay',
      ctaLink: '/shop-the-room',
      icon: 'room',
      gradient: 'linear-gradient(135deg, rgba(26,26,26,0.75) 0%, rgba(46,99,184,0.55) 140%)',
      image: 'assets/hero-banner/hero-room-3d.png',
    },
    {
      id: 'print-3d',
      tickerLabel: 'In 3D theo yêu cầu',
      title: 'In 3D Theo Yêu Cầu — Độc Bản Của Riêng Bạn',
      subtitle: 'Từ ý tưởng tới sản phẩm hoàn thiện, tùy biến màu sắc, chất liệu và khắc tên cá nhân hóa 100%.',
      ctaLabel: 'Tùy biến ngay',
      ctaLink: '/customizer-3d',
      icon: 'cube',
      gradient: 'linear-gradient(135deg, rgba(26,26,26,0.75) 0%, rgba(32,85,175,0.55) 140%)',
      image: 'assets/hero-banner/hero-print-3d.png',
    },
    {
      id: 'freeship',
      tickerLabel: 'Freeship từ 500K',
      title: 'Miễn Phí Vận Chuyển Từ 500.000đ',
      subtitle: 'Giao hàng nhanh toàn quốc cho mọi đơn hàng nội thất & decor, đóng gói chống va đập cẩn thận.',
      ctaLabel: 'Mua sắm ngay',
      ctaLink: '/catalog',
      icon: 'truck',
      gradient: 'linear-gradient(135deg, rgba(26,26,26,0.75) 0%, rgba(31,122,77,0.55) 140%)',
      image: 'assets/hero-banner/hero-freeship.png',
    },
    {
      id: 'ai-assistant',
      tickerLabel: 'AI Gợi Ý Decor',
      title: 'Trợ Lý AI Gợi Ý Ý Tưởng Decor',
      subtitle: 'Mô tả không gian mơ ước của bạn, AI giúp gợi ý sản phẩm và phong cách phù hợp trong vài giây.',
      ctaLabel: 'Thử ngay',
      ctaLink: '/style-quiz',
      icon: 'sparkles',
      gradient: 'linear-gradient(135deg, rgba(26,26,26,0.75) 0%, rgba(46,99,184,0.55) 140%)',
      image: 'assets/hero-banner/hero-ai-assistant.png',
    },
    {
      id: 'deal-today',
      tickerLabel: 'Ưu đãi hôm nay',
      title: 'Ưu Đãi Hôm Nay Dành Cho Bạn',
      subtitle: 'Khám phá các sản phẩm nổi bật với mức giá tốt nhất, cập nhật mỗi ngày.',
      ctaLabel: 'Xem ưu đãi',
      ctaLink: '/catalog',
      icon: 'tag',
      gradient: 'linear-gradient(135deg, rgba(26,26,26,0.75) 0%, rgba(169,198,234,0.55) 140%)',
      image: 'assets/hero-banner/hero-deal-today.png',
    },
  ];

  readonly activeIndex = signal(0);
  readonly isPaused = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startAutoplay();
  }

  private startAutoplay(): void {
    this.stopAutoplay();
    this.timer = setInterval(() => {
      if (this.isPaused()) return;
      this.activeIndex.update(i => (i + 1) % this.items.length);
    }, AUTOPLAY_INTERVAL_MS);
  }

  private stopAutoplay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Người dùng bấm chọn trực tiếp (ticker hoặc indicator) — đặt lại chu kỳ tự động từ đầu. */
  setActive(index: number): void {
    this.activeIndex.set(((index % this.items.length) + this.items.length) % this.items.length);
    this.startAutoplay();
  }

  pause(): void {
    this.isPaused.set(true);
  }

  resume(): void {
    this.isPaused.set(false);
  }
}
