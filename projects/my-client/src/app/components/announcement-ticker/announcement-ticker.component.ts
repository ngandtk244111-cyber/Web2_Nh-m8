import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeroTickerService } from '../../core/services/hero-ticker.service';

@Component({
  selector: 'app-announcement-ticker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-ticker.component.html',
  styleUrl: './announcement-ticker.component.css'
})
export class AnnouncementTickerComponent {
  /** true khi Header ở trạng thái compact (đã scroll) — tắt marquee, hiển thị dạng tĩnh gọn. */
  @Input() compact = false;

  constructor(public tickerService: HeroTickerService, private router: Router) {}

  /** Nhân đôi danh sách để marquee chạy vòng lặp liền mạch — chỉ cần khi đang chạy marquee. */
  get displayItems() {
    return this.compact
      ? this.tickerService.items
      : [...this.tickerService.items, ...this.tickerService.items];
  }

  originalIndex(renderIndex: number): number {
    return renderIndex % this.tickerService.items.length;
  }

  /** Bấm 1 mục: đồng bộ banner trang chủ rồi mở đúng trang của mục đó (cùng link với nút CTA trên banner). */
  onItemClick(renderIndex: number): void {
    const index = this.originalIndex(renderIndex);
    this.tickerService.setActive(index);
    this.router.navigateByUrl(this.tickerService.items[index].ctaLink);
  }

  onMouseEnter(): void {
    this.tickerService.pause();
  }

  onMouseLeave(): void {
    this.tickerService.resume();
  }
}
