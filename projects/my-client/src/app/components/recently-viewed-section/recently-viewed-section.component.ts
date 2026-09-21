import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { ProductCardComponent } from '../product-card/product-card.component';

@Component({
  selector: 'app-recently-viewed-section',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './recently-viewed-section.component.html',
  styleUrl: './recently-viewed-section.component.css'
})
export class RecentlyViewedSectionComponent {
  @Input() excludeProductId?: string;

  constructor(public recentlyViewedService: RecentlyViewedService) {}

  get displayProducts() {
    return this.recentlyViewedService.products().filter(p => p.id !== this.excludeProductId);
  }
}
