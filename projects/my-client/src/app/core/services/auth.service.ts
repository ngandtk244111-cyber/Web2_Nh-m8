import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthApiService, AuthApiResponse } from './auth-api.service';
import { Address } from '../models/address.model';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'deco3d_user';

export interface LoggedUser {
  _id: string;
  phoneNumber: string;
  fullName: string;
  email: string;
  gender: 'male' | 'female' | 'other' | '';
  dateOfBirth: string;
  address: unknown;
  addresses: Address[];
  avatar: string;
  active: boolean;
  lastLogin: string | null;
  coins: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Đăng nhập bằng số điện thoại + mật khẩu, KHÔNG dùng JWT — tham khảo đúng cơ chế của
 * VitaCare-main: sau khi login/register thành công, server trả thẳng object user (trừ
 * password), client lưu nguyên vào localStorage và giữ trong 1 signal. Các request cần xác
 * thực sau đó tự gửi kèm `userId` (xem AddressService/CoinService/OrderService), server tin
 * tưởng thẳng giá trị này — đánh đổi để giống đúng mô hình của Vita, không còn access token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private authApi = inject(AuthApiService);

  readonly currentUser = signal<LoggedUser | null>(null);

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const user = JSON.parse(raw) as LoggedUser;
        if (user?.phoneNumber) this.currentUser.set(user);
      }
    } catch {
      // ignore invalid stored user
    }
  }

  private persistUser(user: LoggedUser | null): void {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { }
  }

  setUser(user: LoggedUser): void {
    this.currentUser.set(user);
    this.persistUser(user);
  }

  updateProfile(payload: {
    fullName?: string;
    email?: string;
    address?: unknown;
    gender?: 'male' | 'female' | 'other' | '';
    dateOfBirth?: string;
  }): Observable<AuthApiResponse> {
    const userId = this.currentUser()?._id || '';
    return this.authApi.updateProfile(userId, payload).pipe(
      tap((res: AuthApiResponse) => {
        if (res.success && res.user) this.setUser(res.user);
      })
    );
  }

  uploadAvatar(file: File): Observable<AuthApiResponse> {
    const userId = this.currentUser()?._id || '';
    return this.authApi.uploadAvatar(userId, file).pipe(
      tap((res: AuthApiResponse) => {
        if (res.success && res.user) this.setUser(res.user);
      })
    );
  }

  logout(): void {
    this.currentUser.set(null);
    this.persistUser(null);
  }

  /** Avatar backend trả về đường dẫn tương đối (vd: /uploads/avatars/x.png) — ghép với host
   *  của server (bỏ hậu tố /api khỏi apiUrl) để ra URL ảnh xem được trực tiếp. */
  getAvatarUrl(avatar: string | null | undefined): string | null {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    const base = environment.apiUrl.replace(/\/api$/, '');
    return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
  }
}
