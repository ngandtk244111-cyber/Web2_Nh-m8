import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';

const LEGACY_KEY = 'deco3d_favorites';

/**
 * Yêu thích sản phẩm — lưu cục bộ, RIÊNG theo từng tài khoản (deco3d_favorites:<userId>); khách chưa đăng
 * nhập dùng khoá 'guest'. Đăng xuất thì danh sách trống, đăng nhập lại thì có lại đúng danh sách cũ.
 */
@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly auth = inject(AuthService);
  private owner = this.auth.currentUser()?._id || 'guest';
  private readonly idsSignal = signal<Set<string>>(new Set(this.load()));
  readonly ids = this.idsSignal.asReadonly();

  constructor() {
    effect(() => {
      const owner = this.auth.currentUser()?._id || 'guest';
      untracked(() => {
        if (owner === this.owner) return;
        this.owner = owner;
        this.idsSignal.set(new Set(this.load()));
      });
    });
  }

  private get storageKey(): string {
    return `${LEGACY_KEY}:${this.owner}`;
  }

  private load(): string[] {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && this.owner !== 'guest') {
        if (!localStorage.getItem(this.storageKey)) localStorage.setItem(this.storageKey, legacy);
        localStorage.removeItem(LEGACY_KEY);
      }
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persist(ids: Set<string>): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...ids]));
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
