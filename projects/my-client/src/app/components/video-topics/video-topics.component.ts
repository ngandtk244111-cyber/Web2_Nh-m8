import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export interface VideoTopic {
  icon: string;
  title: string;
  description: string;
  link?: string;
  ctaLabel: string;
  poster: string;
  /**
   * Dự án chưa có asset video thật (không có pipeline lưu trữ/publish video) — để trống
   * cho tới khi có file thật. Cơ chế IntersectionObserver bên dưới vẫn hoạt động đúng:
   * chỉ chủ đề đang hiển thị mới được play() khi videoUrl tồn tại, các chủ đề khác pause().
   */
  videoUrl?: string;
}

const TOPICS: VideoTopic[] = [
  {
    icon: 'truck',
    title: 'Giao Hàng Hỏa Tốc',
    description: 'Giao nội thành trong 24h, đóng gói chống va đập cẩn thận cho từng món decor.',
    link: '/orders/track',
    ctaLabel: 'Tra cứu đơn hàng',
    poster: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=800&q=70',
  },
  {
    icon: 'shield',
    title: 'Bảo Hành 12 Tháng',
    description: 'Bảo hành kỹ thuật cho mọi sản phẩm in 3D — an tâm sử dụng lâu dài.',
    link: '/warranty-lookup',
    ctaLabel: 'Tra cứu bảo hành',
    poster: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=70',
  },
  {
    icon: 'sliders',
    title: 'Tùy Biến 3D',
    description: 'Đổi màu, chất liệu, kích thước và khắc tên riêng ngay trên trình xem 3D.',
    link: '/customizer-3d',
    ctaLabel: 'Vào trình tùy biến',
    poster: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=800&q=70',
  },
  {
    icon: 'sparkles',
    title: 'Thiết Kế Theo Yêu Cầu',
    description: 'AI & kỹ sư tư vấn dựng concept riêng theo đúng ý tưởng của bạn.',
    link: '/custom-request',
    ctaLabel: 'Gửi yêu cầu thiết kế',
    poster: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=800&q=70',
  },
  {
    icon: 'eye',
    title: 'Xem Trước Không Gian 3D',
    description: 'Dạo quanh phòng mẫu 360° được Luméa phối sẵn trước khi quyết định mua.',
    link: '/shop-the-room',
    ctaLabel: 'Khám phá Shop The Room',
    poster: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=70',
  },
  {
    icon: 'box',
    title: '100% Nhựa PLA Sinh Học',
    description: 'Vật liệu in 3D an toàn, thân thiện môi trường cho mọi sản phẩm Luméa.',
    ctaLabel: 'Tìm hiểu thêm',
    link: '/catalog',
    poster: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=70',
  },
];

@Component({
  selector: 'app-video-topics',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './video-topics.component.html',
  styleUrl: './video-topics.component.css'
})
export class VideoTopicsComponent implements AfterViewInit, OnDestroy {
  readonly topics = TOPICS;
  activeIndex = 0;
  private loadedIndices = new Set<number>();

  @ViewChildren('topicCard') topicCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('topicVideo') topicVideos!: QueryList<ElementRef<HTMLVideoElement>>;

  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => this.onIntersect(entries),
      { threshold: [0, 0.6, 1] }
    );
    this.topicCards.forEach(card => this.observer!.observe(card.nativeElement));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const index = Number((entry.target as HTMLElement).dataset['index']);
      const video = this.topicVideos.get(index)?.nativeElement;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        this.activeIndex = index;
        this.loadedIndices.add(index); // lazy-load: chỉ gắn src khi chủ đề thực sự lọt vào view
        if (video && this.topics[index].videoUrl) {
          video.play().catch(() => {});
        }
      } else if (video) {
        video.pause();
      }
    }
  }

  isLoaded(index: number): boolean {
    return this.loadedIndices.has(index);
  }
}
