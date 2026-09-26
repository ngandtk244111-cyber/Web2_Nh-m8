import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { Product, ProductCategory, ProductionType, SpaceKey } from '../models/product.model';
import { environment } from '../../../environments/environment';
import { DEV_MOCK_PRODUCTS } from '../data/product-detail.mock';
import { MascotService } from './mascot.service';
import { FlashSaleService } from './flash-sale.service';
import {
  findDepartment,
  findSubcategory,
  departmentMatches,
  subcategoryMatches,
  subcategoriesOf,
  departmentOf,
  spacesOf,
  materialGroupsOf,
  has3DModel,
  normalizeText,
  searchableText,
} from '../data/catalog-taxonomy';

const BASE = `${environment.apiUrl}/products`;

export type PriceRangeKey = 'under100' | '100to300' | '300to500' | '500to2m' | 'over2m';

export const PRICE_RANGES: { key: PriceRangeKey; label: string; min: number; max: number | null }[] = [
  { key: 'under100', label: 'Dưới 100.000đ', min: 0, max: 100000 },
  { key: '100to300', label: '100.000đ - 300.000đ', min: 100000, max: 300000 },
  { key: '300to500', label: '300.000đ - 500.000đ', min: 300000, max: 500000 },
  { key: '500to2m', label: '500.000đ - 2.000.000đ', min: 500000, max: 2000000 },
  { key: 'over2m', label: 'Trên 2.000.000đ', min: 2000000, max: null },
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
  /** Lọc thẳng theo ProductCategory thật (giữ cho các nơi cũ). */
  categories: ProductCategory[];
  /** Nhóm lớn (Nội thất, Đèn & ánh sáng...) — key trong CATALOG_DEPARTMENTS. */
  departments: string[];
  /** Danh mục con (Sofa, Đèn ngủ...) — key trong CATALOG_DEPARTMENTS[].subcategories. */
  subcategories: string[];
  spaces: SpaceKey[];
  /** Nhóm chất liệu (Gỗ, Kim loại...) — key trong MATERIAL_GROUPS. */
  materialGroups: string[];
  has3D?: boolean;
  customizableOnly?: boolean;
  onSale?: boolean;
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
    departments: [],
    subcategories: [],
    spaces: [],
    materialGroups: [],
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
  private flashSale = inject(FlashSaleService);

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

  /** Gợi ý liên quan: cùng danh mục con > cùng nhóm lớn > cùng không gian sống. */
  getRelatedProducts(product: Product, limit = 4): Product[] {
    const subKeys = new Set(subcategoriesOf(product).map(s => s.key));
    const deptKey = departmentOf(product)?.key;
    const spaces = new Set(spacesOf(product));
    const score = (p: Product): number => {
      if (p.category === product.category || subcategoriesOf(p).some(s => subKeys.has(s.key))) return 3;
      if (deptKey && departmentOf(p)?.key === deptKey) return 2;
      if (spacesOf(p).some(sp => spaces.has(sp))) return 1;
      return 0;
    };
    return this.productsSignal()
      .filter(p => p.id !== product.id)
      .map(p => ({ p, s: score(p) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.p);
  }

  /** Giá đang áp dụng (tính cả Flash Sale chưa tới giờ) — dùng chung cho card, filter giá, badge Sale. */
  currentPrice(p: Product): number {
    return this.flashSale.effectiveBasePrice(p);
  }

  /** % giảm giá thực tế đang áp dụng, 0 nếu không giảm. */
  discountPercent(p: Product): number {
    const price = this.currentPrice(p);
    if (!p.originalPrice || p.originalPrice <= price) return 0;
    return Math.round((1 - price / p.originalPrice) * 100);
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
      // Không dấu + hiểu danh mục mới/không gian/phong cách: "giuong", "phong khach", "sofa"...
      const terms = normalizeText(filters.searchQuery).split(/\s+/).filter(Boolean);
      result = result.filter(p => {
        const text = searchableText(p);
        return terms.every(t => text.includes(t));
      });
    }

    if (filters.categories?.length) {
      result = result.filter(p => filters.categories.includes(p.category));
    }

    // Nhóm lớn + danh mục con: danh mục con đã chọn thì thu hẹp trong nhóm lớn tương ứng.
    if (filters.subcategories?.length) {
      const subs = filters.subcategories.map(k => findSubcategory(k)?.sub).filter(s => !!s);
      result = result.filter(p => subs.some(sub => subcategoryMatches(sub!, p)));
    } else if (filters.departments?.length) {
      const depts = filters.departments.map(k => findDepartment(k)).filter(d => !!d);
      result = result.filter(p => depts.some(d => departmentMatches(d!, p)));
    }

    if (filters.spaces?.length) {
      result = result.filter(p => spacesOf(p).some(sp => filters.spaces.includes(sp)));
    }

    if (filters.materialGroups?.length) {
      result = result.filter(p => materialGroupsOf(p).some(g => filters.materialGroups.includes(g)));
    }

    if (filters.has3D) {
      result = result.filter(p => has3DModel(p));
    }

    if (filters.customizableOnly) {
      result = result.filter(p => p.customizable);
    }

    if (filters.onSale) {
      result = result.filter(p => this.discountPercent(p) > 0);
    }

    if (filters.priceRanges?.length) {
      result = result.filter(p => filters.priceRanges.some(key => {
        const range = PRICE_RANGES.find(r => r.key === key);
        if (!range) return false;
        const price = this.currentPrice(p);
        return price >= range.min && (range.max === null || price < range.max);
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
        result.sort((a, b) => this.currentPrice(a) - this.currentPrice(b));
        break;
      case 'price-desc':
        result.sort((a, b) => this.currentPrice(b) - this.currentPrice(a));
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
