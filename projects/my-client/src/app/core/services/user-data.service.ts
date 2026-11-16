import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, shareReplay, tap } from 'rxjs';
import { CartItem, Coupon } from '../models/cart.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const BASE = `${environment.apiUrl}/me/data`;
const SAVE_DELAY_MS = 400;

export interface UserData {
  cart: CartItem[];
  favorites: string[];
  recentlyViewed: string[];
  savedCoupons: Coupon[];
}

/** Dữ liệu cá nhân lưu theo tài khoản trên MongoDB. Gom các thay đổi liên tiếp thành 1 lần ghi. */
@Injectable({ providedIn: 'root' })
export class UserDataService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private socialImport: { userId: string; request: Observable<void> } | null = null;
  private pendingOwner: string | null = null;
  private pending: Partial<UserData> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    window.addEventListener('pagehide', this.flushOnPageHide);
  }

  importSocial(): Observable<void> {
    const userId = this.auth.currentUser()?._id;
    if (!userId) return of(undefined);
    if (this.socialImport?.userId === userId) return this.socialImport.request;
    const keys = { communityLiked: 'deco3d_community_liked', communitySaved: 'deco3d_community_saved', newsLiked: 'lumea_news_comment_liked' };
    const body = Object.fromEntries(Object.entries(keys).map(([field, key]) => {
      try { const ids = JSON.parse(localStorage.getItem(key) || '[]'); return [field, Array.isArray(ids) ? ids : []]; }
      catch { return [field, []]; }
    }));
    if (!Object.values(body).some(ids => ids.length)) return of(undefined);
    const request = this.http.post(BASE + '/import-social', body).pipe(
      tap(() => { try { if (this.auth.currentUser()?._id === userId) for (const key of Object.values(keys)) localStorage.removeItem(key); } catch { /* dữ liệu đã lưu trên server */ } }),
      map(() => undefined), shareReplay({ bufferSize: 1, refCount: false })
    );
    this.socialImport = { userId, request };
    return request;
  }

  load(): Observable<UserData> {
    return this.http.get<{ success: boolean; data: UserData }>(BASE).pipe(map(res => res.data));
  }

  save(patch: Partial<UserData>): void {
    const owner = this.auth.currentUser()?._id;
    if (!owner) return;
    if (this.pendingOwner !== owner) this.discardPending();
    this.pendingOwner = owner;
    this.pending = { ...this.pending, ...patch };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /** Bỏ thay đổi chưa gửi khi đăng xuất: lúc đó token đã mất, không được ghi nhầm sang tài khoản khác. */
  discardPending(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = {};
  }

  private flush(): void {
    if (this.pendingOwner !== this.auth.currentUser()?._id) { this.discardPending(); return; }
    this.http.put(BASE, this.takePendingBody()).subscribe({
      error: err => console.warn('Failed to save user data', err),
    });
  }

  /**
   * Đóng tab ngay sau khi thêm giỏ (vd. tab Phòng 3D) thì lượt ghi đang chờ bị huỷ theo tab —
   * gửi nốt bằng fetch keepalive, trình duyệt vẫn hoàn tất request sau khi trang đã đóng.
   */
  private flushOnPageHide = (): void => {
    if (!this.timer) return;
    if (this.pendingOwner !== this.auth.currentUser()?._id) { this.discardPending(); return; }
    clearTimeout(this.timer);
    const token = this.auth.token;
    const body = this.takePendingBody();
    if (!token) return;
    fetch(BASE, {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).catch(err => console.warn('Failed to save user data', err));
  };

  private takePendingBody(): Partial<UserData> {
    const patch = this.pending;
    this.pending = {};
    this.timer = null;
    // Server chỉ lưu productId với sản phẩm thường, không gửi cả sản phẩm cho nhẹ (giới hạn body 100KB).
    return patch.cart
      ? { ...patch, cart: patch.cart.map(item => item.product.id.startsWith('custom-') ? item : { ...item, product: { id: item.product.id } as CartItem['product'] }) }
      : patch;
  }
}
