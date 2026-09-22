import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ProductCardComponent } from '../product-card/product-card.component';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-recently-viewed-section',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, AppIconComponent],
  templateUrl: './recently-viewed-section.component.html',
  styleUrl: './recently-viewed-section.component.css'
})
export class RecentlyViewedSectionComponent {
  @Input() excludeProductId?: string;

  // Carousel cuộn ngang (tham khảo cùng pattern ElementRef + scrollBy của decor-deals.component.ts)
  // thay cho grid cũ — grid bị dư 1 thẻ lẻ dòng dưới khi số sản phẩm không chia hết cho 4 cột.
  @ViewChild('track') track?: ElementRef<HTMLElement>;

  constructor(public recentlyViewedService: RecentlyViewedService) {}

  get displayProducts() {
    return this.recentlyViewedService.products().filter(p => p.id !== this.excludeProductId);
  }

  scrollPrev(): void {
    this.track?.nativeElement.scrollBy({ left: -560, behavior: 'smooth' });
  }

  scrollNext(): void {
    this.track?.nativeElement.scrollBy({ left: 560, behavior: 'smooth' });
  }
}
