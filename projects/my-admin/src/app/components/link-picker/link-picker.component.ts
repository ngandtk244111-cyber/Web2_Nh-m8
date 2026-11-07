import { Component, computed, forwardRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { environment } from '../../../environments/environment';

/** Trang có sẵn của my-client (projects/my-client/src/app/app.routes.ts). */
export const CLIENT_PAGES: { link: string; label: string }[] = [
  { link: '/', label: 'Trang chủ' },
  { link: '/catalog', label: 'Tất cả sản phẩm' },
  { link: '/catalog?sale=1', label: 'Sản phẩm đang giảm giá' },
  { link: '/flash-sale', label: 'Flash sale' },
  { link: '/shop-the-room', label: 'Shop The Room (phòng mẫu 360°)' },
  { link: '/customizer-3d', label: 'Tự thiết kế 3D' },
  { link: '/custom-request/new', label: 'Gửi yêu cầu in 3D riêng' },
  { link: '/style-quiz', label: 'Trắc nghiệm phong cách' },
  { link: '/community', label: 'Cộng đồng' },
  { link: '/news', label: 'Tin tức' },
  { link: '/voucher', label: 'Kho voucher' },
  { link: '/ve-lumea', label: 'Về Luméa' },
  { link: '/warranty-lookup', label: 'Tra cứu bảo hành' },
  { link: '/orders/track', label: 'Tra cứu đơn hàng' },
];

type Mode = 'page' | 'product' | 'custom';

/**
 * Chọn trang đích cho nút trên banner: chọn từ danh sách trang có sẵn, tìm 1 sản phẩm,
 * hoặc tự nhập đường dẫn. Giá trị (ngModel) vẫn là chuỗi đường dẫn như "/flash-sale".
 */
@Component({
  selector: 'app-link-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => LinkPickerComponent), multi: true }],
  templateUrl: './link-picker.component.html',
  styleUrl: './link-picker.component.css',
})
export class LinkPickerComponent implements ControlValueAccessor {
  private productService = inject(ProductService);

  readonly pages = CLIENT_PAGES;
  readonly value = signal('');
  readonly mode = signal<Mode>('page');
  readonly productQuery = signal('');
  disabled = false;

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  readonly selectedProduct = computed(() => {
    const slug = this.value().match(/^\/product\/([^/?#]+)/)?.[1];
    return slug ? this.productService.products().find(p => p.slug === slug) || null : null;
  });

  readonly productResults = computed(() => {
    const q = this.productQuery().toLowerCase().trim();
    if (!q) return [];
    return this.productService.products().filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  });

  /** Đường dẫn bắt đầu bằng 1 dấu / (không phải // sang web khác). */
  get isValid(): boolean {
    return /^\/(?!\/)/.test(this.value());
  }

  get previewUrl(): string {
    return environment.clientAppUrl + this.value();
  }

  writeValue(v: string | null): void {
    const link = (v || '').trim();
    this.value.set(link);
    // Link cũ đã lưu: khớp trang có sẵn thì chọn trang đó, link sản phẩm thì sang mục sản phẩm, còn lại là tự nhập.
    this.mode.set(this.pages.some(p => p.link === link) ? 'page' : link.startsWith('/product/') ? 'product' : link ? 'custom' : 'page');
  }

  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  private emit(v: string): void {
    this.value.set(v);
    this.onChange(v);
  }

  onSelect(choice: string): void {
    if (choice === '__product') {
      this.mode.set('product');
      if (!this.value().startsWith('/product/')) this.emit('');
    } else if (choice === '__custom') {
      this.mode.set('custom');
    } else {
      this.mode.set('page');
      this.emit(choice);
    }
  }

  /** Giá trị đang chọn trong ô thả xuống. */
  get selectValue(): string {
    if (this.mode() === 'product') return '__product';
    if (this.mode() === 'custom') return '__custom';
    return this.value();
  }

  pickProduct(p: Product): void {
    this.emit(`/product/${p.slug}`);
    this.productQuery.set('');
  }

  onCustomInput(v: string): void {
    this.emit(v.trim());
  }
}
