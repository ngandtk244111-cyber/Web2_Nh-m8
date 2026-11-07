import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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
  private pending: Partial<UserData> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    window.addEventListener('pagehide', this.flushOnPageHide);
  }

  load(): Observable<UserData> {
    return this.http.get<{ success: boolean; data: UserData }>(BASE).pipe(map(res => res.data));
  }

  save(patch: Partial<UserData>): void {
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
