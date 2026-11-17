import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Ảnh sản phẩm dùng chung cho mọi thẻ sản phẩm (trừ Flash Sale) */
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
