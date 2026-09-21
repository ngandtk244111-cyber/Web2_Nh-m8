import { Injectable, signal, computed } from '@angular/core';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class RecentlyViewedService {
  private readonly storageKey = 'deco3d_recently_viewed';
  private readonly maxItems = 8;

  private idsSignal = signal<string[]>(this.loadIds());

  constructor(private productService: ProductService) {}

  readonly products = computed<Product[]>(() =>
    this.idsSignal()
      .map(id => this.productService.getProductById(id))
      .filter((p): p is Product => !!p)
  );

  private loadIds(): string[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load recently viewed products', e);
    }
    return [];
  }

  private saveIds(ids: string[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(ids));
      this.idsSignal.set(ids);
    } catch (e) {
      console.warn('Failed to save recently viewed products', e);
    }
  }

  recordView(productId: string): void {
    const current = this.idsSignal().filter(id => id !== productId);
    current.unshift(productId);
    this.saveIds(current.slice(0, this.maxItems));
  }

  clear(): void {
    this.saveIds([]);
  }
}
