import { Injectable, signal, computed, effect, inject, untracked } from '@angular/core';
import { Product } from '../models/product.model';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { UserDataService } from './user-data.service';

@Injectable({
  providedIn: 'root'
})
export class RecentlyViewedService {
  private readonly storageKey = 'deco3d_recently_viewed';
  private readonly maxItems = 8;

  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);
  private idsSignal = signal<string[]>([]);

  // Đăng nhập thì lưu trên MongoDB theo tài khoản; chưa đăng nhập lưu tạm trên trình duyệt rồi gộp khi đăng nhập.
  constructor(private productService: ProductService) {
    effect(() => {
      const userId = this.auth.currentUser()?._id;
      untracked(() => (userId ? this.syncFromAccount() : this.idsSignal.set(this.loadIds())));
    });
  }

  private syncFromAccount(): void {
    this.idsSignal.set(this.loadIds());
    this.userData.load().subscribe({
      next: data => {
        const merged = [...new Set([...this.idsSignal(), ...data.recentlyViewed])].slice(0, this.maxItems);
        this.idsSignal.set(merged);
        if (merged.join() !== data.recentlyViewed.join()) this.userData.save({ recentlyViewed: merged });
        try {
          localStorage.removeItem(this.storageKey);
        } catch { /* ignore */ }
      },
      error: err => console.warn('Failed to load recently viewed products', err),
    });
  }

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
    if (this.auth.currentUser()) {
      this.idsSignal.set(ids);
      this.userData.save({ recentlyViewed: ids });
      return;
    }
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
