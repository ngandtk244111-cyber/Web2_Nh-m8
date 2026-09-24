import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { ProductStyle } from '../../core/models/product.model';
import { styleSlug } from '../../core/data/brand-styles';

interface StyleTile {
  style: ProductStyle;
  image: string;
  count: number;
  slug: string;
}

/**
 * Luméa bán trực tiếp (không phải sàn đa thương hiệu) nên không có dữ liệu "brand" thật.
 * "Thương Hiệu Ưa Thích" ở đây là các dòng phong cách (style) riêng của Luméa — dữ liệu
 * style + số lượng sản phẩm đều lấy thật từ ProductService, không hard-code brand giả.
 */
/** Ảnh không gian đại diện cho từng dòng phong cách (ảnh lifestyle, không phải ảnh từng sản phẩm). */
const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

const ALL_STYLES: { style: ProductStyle; image: string }[] = [
  { style: 'Minimalist', image: u('1567016376408-0226e4d0c1ea') },
  { style: 'Scandinavian', image: u('1616486338812-3dadae4b4ace') },
  { style: 'Vintage', image: u('1505693416388-ac5ce068fe85') },
  { style: 'Cute/Kawaii', image: u('1513694203232-719a280e022f') },
  { style: 'Modern', image: u('1600210492486-724fe5c67fb0') },
  { style: 'Retro', image: u('1618221195710-dd6b41faaea6') },
  { style: 'Japanese', image: u('1615529182904-14819c35db37') },
];

@Component({
  selector: 'app-favorite-styles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favorite-styles.component.html',
  styleUrl: './favorite-styles.component.css'
})
export class FavoriteStylesComponent {
  constructor(private productService: ProductService) {}

  readonly styleTiles = computed<StyleTile[]>(() => {
    const products = this.productService.products();
    return ALL_STYLES
      .map(s => ({ ...s, slug: styleSlug(s.style), count: products.filter(p => p.style === s.style).length }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  });
}
