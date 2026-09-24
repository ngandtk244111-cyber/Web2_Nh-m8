import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { Product, ProductCategory, ProductionType } from '../models/product.model';
import { environment } from '../../../environments/environment';
import { DEV_MOCK_PRODUCTS } from '../data/product-detail.mock';
import { MascotService } from './mascot.service';

const BASE = `${environment.apiUrl}/products`;

export type PriceRangeKey = 'under100' | '100to300' | '300to500' | 'over500';

export const PRICE_RANGES: { key: PriceRangeKey; label: string; min: number; max: number | null }[] = [
  { key: 'under100', label: 'Dưới 100.000đ', min: 0, max: 100000 },
  { key: '100to300', label: '100.000đ - 300.000đ', min: 100000, max: 300000 },
  { key: '300to500', label: '300.000đ - 500.000đ', min: 300000, max: 500000 },
  { key: 'over500', label: 'Trên 500.000đ', min: 500000, max: null },
];

/** Tag suy ra từ cấu hình customization thật của sản phẩm — không phải field lưu riêng. */
export type CustomizationTag = 'color' | 'text' | 'accessory' | 'custom_design';

export const CUSTOMIZATION_OPTIONS: { key: CustomizationTag; label: string }[] = [
  { key: 'color', label: 'Đổi màu' },
  { key: 'text', label: 'Thêm chữ/tên' },
  { key: 'accessory', label: 'Thêm phụ kiện' },
  { key: 'custom_design', label: 'Thiết kế theo yêu cầu' },
];

export type SortKey = 'bestseller' | 'newest' | 'price-asc' | 'price-desc' | 'rating';

export interface ProductFilters {
  categories: ProductCategory[];
  priceRanges: PriceRangeKey[];
  styles: string[];
  colors: string[];
  materials: string[];
  sizes: string[];
  customizations: CustomizationTag[];
  searchQuery: string;
  sortBy: SortKey;
  productionType?: ProductionType | 'ALL';
}

export function createEmptyFilters(): ProductFilters {
  return {
    categories: [],
    priceRanges: [],
    styles: [],
    colors: [],
    materials: [],
    sizes: [],
    customizations: [],
    searchQuery: '',
    sortBy: 'bestseller',
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private mascotService = inject(MascotService);

  // State signal — nạp từ backend thật (MongoDB), không còn localStorage/mock.
  private productsSignal = signal<Product[]>([]);

  // Public readonly signals
  readonly products = this.productsSignal.asReadonly();

  readonly customizableProducts = computed(() =>
    this.productsSignal().filter(p => p.customizable)
  );

  readonly printOnDemandProducts = computed(() =>
    this.productsSignal().filter(p => p.productionType === 'PRINT_ON_DEMAND')
  );

  readonly readyStockProducts = computed(() =>
    this.productsSignal().filter(p => p.productionType === 'READY_STOCK')
  );

  readonly furnitureProducts = computed(() =>
    this.productsSignal().filter(p => p.categoryGroup === 'FURNITURE')
  );

  readonly decorProducts = computed(() =>
    this.productsSignal().filter(p => p.categoryGroup === 'DECOR')
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    // TẠM THỜI: dùng mock để test UI khi chưa có data MongoDB (clone để không mutate hằng số mock).
    if (environment.useMockProducts) {
      this.productsSignal.set(structuredClone(DEV_MOCK_PRODUCTS));
      return;
    }
    this.mascotService.beginLoading();
    this.http.get<{ success: boolean; products: Product[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.productsSignal.set(res.products);
        this.mascotService.endLoading();
      },
      error: (err) => {
        console.warn('Failed to load products from backend', err);
        // Không tải được danh sách sản phẩm = lỗi hệ thống thật -> angry (dùng tiết chế).
        this.mascotService.endLoading('angry');
      },
    });
  }

  getProductById(id: string): Product | undefined {
    return this.productsSignal().find(p => p.id === id);
  }

  getProductBySlug(slug: string): Product | undefined {
    return this.productsSignal().find(p => p.slug === slug);
  }

  getRelatedProducts(product: Product, limit = 4): Product[] {
    return this.productsSignal()
      .filter(p => p.id !== product.id && (p.category === product.category || p.categoryGroup === product.categoryGroup))
      .slice(0, limit);
  }

  /** Suy ra tag tùy chỉnh thật từ cấu hình customization của sản phẩm (không lưu field riêng). */
  getCustomizationTags(p: Product): CustomizationTag[] {
    const tags: CustomizationTag[] = [];
    if (p.customization?.colors?.length) tags.push('color');
    if (p.customization?.textOption?.enabled) tags.push('text');
    if (p.customization?.accessories?.length) tags.push('accessory');
    if (p.customizable && p.productionType === 'PRINT_ON_DEMAND') tags.push('custom_design');
    return tags;
  }

  filterProducts(filters: ProductFilters): Product[] {
    let result = [...this.productsSignal()];

    if (filters.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
      );
    }

    if (filters.categories?.length) {
      result = result.filter(p => filters.categories.includes(p.category));
    }

    if (filters.priceRanges?.length) {
      result = result.filter(p => filters.priceRanges.some(key => {
        const range = PRICE_RANGES.find(r => r.key === key);
        if (!range) return false;
        return p.basePrice >= range.min && (range.max === null || p.basePrice < range.max);
      }));
    }

    if (filters.styles?.length) {
      result = result.filter(p => !!p.style && filters.styles.includes(p.style));
    }

    if (filters.colors?.length) {
      result = result.filter(p => !!p.color && filters.colors.includes(p.color));
    }

    if (filters.materials?.length) {
      result = result.filter(p => !!p.printMaterial && filters.materials.includes(p.printMaterial));
    }

    if (filters.sizes?.length) {
      result = result.filter(p => !!p.sizeCategory && filters.sizes.includes(p.sizeCategory));
    }

    if (filters.customizations?.length) {
      result = result.filter(p => {
        const tags = this.getCustomizationTags(p);
        return filters.customizations.some(c => tags.includes(c));
      });
    }

    if (filters.productionType && filters.productionType !== 'ALL') {
      result = result.filter(p => p.productionType === filters.productionType);
    }

    switch (filters.sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'price-desc':
        result.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case 'bestseller':
        // Chưa có field lượt bán thật — dùng reviewCount (dữ liệu thật) làm proxy độ phổ biến.
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      default:
        break;
    }

    return result;
  }

  // Admin Actions — gọi backend thật, tự refresh cache cục bộ khi thành công.
  addProduct(product: Omit<Product, 'id'>): Observable<{ success: boolean; product: Product }> {
    return this.http.post<{ success: boolean; product: Product }>(BASE, product).pipe(
      tap(() => this.refresh())
    );
  }

  updateProduct(id: string, updates: Partial<Product>): Observable<{ success: boolean; product: Product }> {
    return this.http.put<{ success: boolean; product: Product }>(`${BASE}/${id}`, updates).pipe(
      tap(() => this.refresh())
    );
  }

  deleteProduct(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${BASE}/${id}`).pipe(
      tap(() => this.refresh())
    );
  }

  /** Gửi đánh giá thật lên backend (lưu vào Product.reviews), không còn chỉ mutate cục bộ. */
  submitReview(productId: string, payload: {
    userId?: string;
    author: string;
    rating: number;
    comment: string;
    images?: string[];
  }): Observable<{ success: boolean; product: Product; review: Product['reviews'][number] }> {
    if (environment.useMockProducts) {
      const product = this.getProductById(productId)!;
      const review: Product['reviews'][number] = {
        id: `mock-rev-${Date.now()}`,
        author: payload.author,
        avatar: '',
        rating: payload.rating,
        date: new Date().toLocaleDateString('vi-VN'),
        comment: payload.comment,
        verifiedPurchase: false,
        images: payload.images,
      };
      return of({ success: true, product, review });
    }
    return this.http.post<{ success: boolean; product: Product; review: Product['reviews'][number] }>(
      `${BASE}/${productId}/reviews`,
      payload
    );
  }
}
