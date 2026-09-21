import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { ProductStyle } from '../../core/models/product.model';
import { AppIconComponent } from '../icon/icon.component';

interface StyleTile {
  style: ProductStyle;
  icon: string;
  count: number;
}

/**
 * Luméa bán trực tiếp (không phải sàn đa thương hiệu) nên không có dữ liệu "brand" thật.
 * "Thương Hiệu Ưa Thích" ở đây là các dòng phong cách (style) riêng của Luméa — dữ liệu
 * style + số lượng sản phẩm đều lấy thật từ ProductService, không hard-code brand giả.
 */
const ALL_STYLES: { style: ProductStyle; icon: string }[] = [
  { style: 'Minimalist', icon: 'minus' },
  { style: 'Scandinavian', icon: 'room' },
  { style: 'Vintage', icon: 'tag' },
  { style: 'Cute/Kawaii', icon: 'heart' },
  { style: 'Modern', icon: 'box' },
  { style: 'Retro', icon: 'rotate' },
  { style: 'Japanese', icon: 'sparkles' },
];

@Component({
  selector: 'app-favorite-styles',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './favorite-styles.component.html',
  styleUrl: './favorite-styles.component.css'
})
export class FavoriteStylesComponent {
  constructor(private productService: ProductService) {}

  readonly styleTiles = computed<StyleTile[]>(() => {
    const products = this.productService.products();
    return ALL_STYLES
      .map(s => ({ ...s, count: products.filter(p => p.style === s.style).length }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  });
}
