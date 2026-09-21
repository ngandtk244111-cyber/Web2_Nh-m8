import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Product, ProductCategory, ProductionType } from '../models/product.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/products`;

export interface ProductFilters {
  categoryGroup?: 'ALL' | 'FURNITURE' | 'DECOR';
  category?: ProductCategory | 'ALL';
  productionType?: ProductionType | 'ALL';
  customizableOnly?: boolean;
  searchQuery?: string;
  sortBy?: 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);

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
    this.http.get<{ success: boolean; products: Product[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.productsSignal.set(res.products);
      },
      error: (err) => console.warn('Failed to load products from backend', err),
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

    if (filters.categoryGroup && filters.categoryGroup !== 'ALL') {
      result = result.filter(p => p.categoryGroup === filters.categoryGroup);
    }

    if (filters.category && filters.category !== 'ALL') {
      result = result.filter(p => p.category === filters.category);
    }

    if (filters.productionType && filters.productionType !== 'ALL') {
      result = result.filter(p => p.productionType === filters.productionType);
    }

    if (filters.customizableOnly) {
      result = result.filter(p => p.customizable);
    }

    if (filters.sortBy) {
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
        default:
          break;
      }
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
}
