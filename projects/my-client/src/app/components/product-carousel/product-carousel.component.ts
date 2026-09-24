import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-product-carousel',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, AppIconComponent],
  templateUrl: './product-carousel.component.html',
  styleUrl: './product-carousel.component.css'
})
export class ProductCarouselComponent {
  @Input() products: any[] = [];
  @ViewChild('track') track?: ElementRef<HTMLElement>;

  scroll(dir: 1 | -1): void {
    const el = this.track?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }
}
