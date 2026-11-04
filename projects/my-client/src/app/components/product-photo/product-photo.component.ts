import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Ảnh sản phẩm dùng chung cho mọi thẻ sản phẩm (trừ Flash Sale): images[0] là ảnh chính, rê chuột vào thẻ
 * (phần tử cha <a>, hoặc phần tử có class .pp-hover) thì mờ dần sang images[1] kèm phóng nhẹ — một hiệu ứng
 * duy nhất trên toàn web (CSS ở styles.css, mục "Ảnh sản phẩm: đổi ảnh khi rê chuột").
 * Khung chứa quyết định kích thước; khối ảnh lấp đầy khung.
 */
@Component({
  selector: 'app-product-photo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img class="pp__img" [src]="images[0]" [alt]="alt" [attr.loading]="eager ? null : 'lazy'" draggable="false">
    <img *ngIf="images[1]" class="pp__img pp__img--alt" [src]="images[1]" alt="" aria-hidden="true" loading="lazy" draggable="false">
  `,
  host: { class: 'pp', '[style.aspect-ratio]': 'ratio' },
})
export class ProductPhotoComponent {
  @Input({ required: true }) images: string[] = [];
  @Input() alt = '';
  /** Ảnh đầu tiên trong màn hình nên tải ngay. */
  @Input() eager = false;
  /** Khi khung chứa không có tỉ lệ cố định, vd "1 / 1". */
  @Input() ratio: string | null = null;
}
