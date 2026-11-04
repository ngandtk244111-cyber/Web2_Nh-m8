import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CartItem, Coupon } from '../models/cart.model';
import { environment } from '../../../environments/environment';

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
  private pending: Partial<UserData> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;

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
    const patch = this.pending;
    this.pending = {};
    this.timer = null;
    // Server chỉ lưu productId với sản phẩm thường, không gửi cả sản phẩm cho nhẹ (giới hạn body 100KB).
    const body = patch.cart
      ? { ...patch, cart: patch.cart.map(item => item.product.id.startsWith('custom-') ? item : { ...item, product: { id: item.product.id } }) }
      : patch;
    this.http.put(BASE, body).subscribe({
      error: err => console.warn('Failed to save user data', err),
    });
  }
}
