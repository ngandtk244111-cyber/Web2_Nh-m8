import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'deco3d_favorites';

/** Yêu thích sản phẩm — lưu cục bộ theo trình duyệt (site không bắt buộc đăng nhập để duyệt sản phẩm). */
@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly idsSignal = signal<Set<string>>(new Set(this.load()));
  readonly ids = this.idsSignal.asReadonly();

  private load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persist(ids: Set<string>): void {
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
