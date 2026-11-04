import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { UserDataService } from './user-data.service';

const STORAGE_KEY = 'deco3d_favorites';

/**
 * Yêu thích sản phẩm — đăng nhập thì lưu trên MongoDB theo tài khoản. Chưa đăng nhập thì lưu tạm trên
 * trình duyệt (site không bắt buộc đăng nhập để duyệt sản phẩm) và gộp vào tài khoản khi đăng nhập.
 */
@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);
  private readonly idsSignal = signal<Set<string>>(new Set());
  readonly ids = this.idsSignal.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser()?._id;
      untracked(() => (userId ? this.syncFromAccount() : this.idsSignal.set(new Set(this.load()))));
    });
  }

  private syncFromAccount(): void {
    const guestIds = this.load();
    this.idsSignal.set(new Set(guestIds));
    this.userData.load().subscribe({
      next: data => {
        const merged = new Set([...data.favorites, ...this.idsSignal()]);
        this.idsSignal.set(merged);
        if (merged.size !== data.favorites.length) this.userData.save({ favorites: [...merged] });
        this.clearLocal();
      },
      error: err => console.warn('Failed to load favorites', err),
    });
  }

  private load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private clearLocal(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }

  private persist(ids: Set<string>): void {
    if (this.auth.currentUser()) {
      this.userData.save({ favorites: [...ids] });
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
  }

  isFavorite(productId: string): boolean {
    return this.idsSignal().has(productId);
  }

  toggle(productId: string): void {
    const next = new Set(this.idsSignal());
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    this.idsSignal.set(next);
    this.persist(next);
  }

  remove(productId: string): void {
    if (!this.idsSignal().has(productId)) return;
    const next = new Set(this.idsSignal());
    next.delete(productId);
    this.idsSignal.set(next);
    this.persist(next);
  }

  clear(): void {
    this.idsSignal.set(new Set());
    this.persist(new Set());
  }
}
