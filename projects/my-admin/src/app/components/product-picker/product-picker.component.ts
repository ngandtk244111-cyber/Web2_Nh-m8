import { Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

const MAX_RESULTS = 40;

/** Bỏ dấu tiếng Việt để gõ "sofa goc" vẫn ra "Sofa Góc". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Ô chọn 1 sản phẩm trong danh sách lớn (hơn 1.000 món): gõ tên / mã để tìm (không phân biệt dấu),
 * lọc theo loại, hiện ảnh + giá. Dùng thay <select> dài ở form phòng mẫu 3D.
 */
@Component({
  selector: 'app-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, VndPipe],
  template: `
    <div class="pp-wrap">
      <button type="button" class="pp-trigger" (click)="toggle()" [class.pp-trigger--empty]="!selected()">
        <img *ngIf="selected()?.images?.[0]" [src]="selected()!.images[0]" alt="">
        <span class="pp-trigger__name">{{ selected()?.name || (productId ? 'Sản phẩm không còn tồn tại' : '— Chọn sản phẩm —') }}</span>
        <i class="bi bi-chevron-down"></i>
      </button>

      <div class="pp-panel" *ngIf="open()">
        <div class="pp-filters">
          <input #q class="form-control form-control-sm" placeholder="Tìm theo tên hoặc mã sản phẩm..." [ngModel]="query()" (ngModelChange)="query.set($event)" autofocus>
          <select class="form-select form-select-sm" [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="">Tất cả loại</option>
            <option *ngFor="let c of categories()" [value]="c">{{ c }}</option>
          </select>
        </div>
        <div class="pp-results">
          <button type="button" class="pp-item" *ngFor="let p of results()" [class.pp-item--active]="p.id === productId" (click)="choose(p)">
            <img [src]="p.images[0]" alt="" loading="lazy">
            <span class="pp-item__body">
              <span class="pp-item__name">{{ p.name }}</span>
              <span class="pp-item__sub">{{ p.categoryName }} · {{ p.id }}</span>
            </span>
            <span class="pp-item__price">{{ p.basePrice | vnd }}</span>
          </button>
          <div class="pp-empty" *ngIf="!results().length">Không có sản phẩm phù hợp.</div>
        </div>
        <div class="pp-foot">{{ matchCount() > results().length ? 'Hiện ' + results().length + ' / ' + matchCount() + ' kết quả — gõ thêm để thu hẹp' : matchCount() + ' kết quả' }}</div>
      </div>
    </div>
  `,
  styles: [`
    .pp-wrap { position: relative; }
    .pp-trigger { width: 100%; display: flex; align-items: center; gap: 8px; padding: 4px 10px; min-height: 31px; border: 1px solid var(--color-neutral-40, #ced4da); border-radius: 6px; background: #fff; font-size: 13px; text-align: left; }
    .pp-trigger img { width: 22px; height: 22px; border-radius: 4px; object-fit: cover; }
    .pp-trigger__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp-trigger--empty .pp-trigger__name { color: var(--color-text-tertiary); }
    .pp-panel { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; width: min(460px, 90vw); background: #fff; border: 1px solid var(--color-neutral-30); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.14); padding: 8px; }
    .pp-filters { display: grid; grid-template-columns: 1fr 150px; gap: 6px; margin-bottom: 6px; }
    .pp-results { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; }
    .pp-item { display: flex; align-items: center; gap: 8px; padding: 6px; border: 0; border-radius: 6px; background: none; text-align: left; }
    .pp-item:hover, .pp-item--active { background: var(--color-neutral-20); }
    .pp-item img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; background: #f3f3f3; flex-shrink: 0; }
    .pp-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pp-item__name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp-item__sub { font-size: 11.5px; color: var(--color-text-tertiary); }
    .pp-item__price { font-size: 12.5px; font-weight: 600; color: var(--color-primary); white-space: nowrap; }
    .pp-empty, .pp-foot { padding: 8px; font-size: 12px; color: var(--color-text-tertiary); text-align: center; }
    .pp-foot { padding: 6px 4px 0; text-align: right; }
  `],
})
export class ProductPickerComponent {
  private productService = inject(ProductService);
  private host = inject(ElementRef<HTMLElement>);

  @Input() productId = '';
  @Output() productIdChange = new EventEmitter<string>();

  open = signal(false);
  query = signal('');
  category = signal('');

  private readonly products = computed(() => [...this.productService.products()].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
  readonly categories = computed(() => [...new Set(this.products().map(p => p.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')));

  private readonly matches = computed(() => {
    const q = fold(this.query().trim());
    const cat = this.category();
    return this.products().filter(p =>
      (!cat || p.categoryName === cat) &&
      (!q || fold(p.name).includes(q) || p.id.toLowerCase().includes(q)));
  });
  readonly results = computed(() => this.matches().slice(0, MAX_RESULTS));
  readonly matchCount = computed(() => this.matches().length);

  selected(): Product | undefined {
    return this.productService.products().find(p => p.id === this.productId);
  }

  toggle(): void {
    this.open.update(v => !v);
  }

  choose(p: Product): void {
    this.productId = p.id;
    this.productIdChange.emit(p.id);
    this.open.set(false);
  }

  /** Bấm ra ngoài thì đóng bảng chọn. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
