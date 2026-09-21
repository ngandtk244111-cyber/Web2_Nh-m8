import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  constructor(public tickerService: HeroTickerService) {}

  /** Nhân đôi danh sách để marquee chạy vòng lặp liền mạch — chỉ cần khi đang chạy marquee. */
  get displayItems() {
    return this.compact
      ? this.tickerService.items
      : [...this.tickerService.items, ...this.tickerService.items];
  }

  originalIndex(renderIndex: number): number {
    return renderIndex % this.tickerService.items.length;
  }

  onItemClick(renderIndex: number): void {
    this.tickerService.setActive(this.originalIndex(renderIndex));
  }

  onMouseEnter(): void {
    this.tickerService.pause();
  }

  onMouseLeave(): void {
    this.tickerService.resume();
  }
}
