import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthApiService, AuthApiResponse } from './auth-api.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { Address } from '../models/address.model';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'deco3d_user';
const TOKEN_KEY = 'deco3d_user_token';

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
 * Sau khi login/register thành công, server trả object user (trừ password) và token do server ký.
 * Client lưu cả hai vào localStorage. authInterceptor gắn token vào mọi request, server xác định
 * khách từ token. `userId` một số service còn gửi kèm chỉ để lọc phía client, server không tin giá trị đó.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private authApi = inject(AuthApiService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly currentUser = signal<LoggedUser | null>(null);
  token: string | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (raw && token) {
        const user = JSON.parse(raw) as LoggedUser;
        // Tài khoản đăng ký bằng email / Google có thể không có SĐT — chỉ cần có _id là hợp lệ.
        // Phiên lưu từ trước khi có token thì coi như chưa đăng nhập.
        if (user?._id) {
          this.token = token;
          this.currentUser.set(user);
        }
      }
    } catch {
      // ignore invalid stored user
    }
  }

  private persistUser(user: LoggedUser | null): void {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
      if (this.token) localStorage.setItem(TOKEN_KEY, this.token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { }
  }

  /** `token` có khi vừa đăng nhập; cập nhật hồ sơ thì giữ token hiện tại. */
  setUser(user: LoggedUser, token?: string): void {
    if (token) this.token = token;
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

  requestPhoneOtp(phoneNumber: string): Observable<AuthApiResponse> {
    return this.authApi.requestPhoneOtp(this.currentUser()?._id || '', phoneNumber);
  }

  /** Xác nhận OTP xong thì server trả user đã gắn SĐT -> cập nhật luôn phiên đăng nhập. */
  verifyPhone(phoneNumber: string, otp: string): Observable<AuthApiResponse> {
    return this.authApi.verifyPhone(this.currentUser()?._id || '', phoneNumber, otp).pipe(
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
    this.token = null;
    this.currentUser.set(null);
    this.persistUser(null);
  }

  /** Hỏi lại trước khi đăng xuất — trả về true nếu người dùng đã xác nhận và đã đăng xuất. */
  async confirmLogout(): Promise<boolean> {
    const ok = await this.confirmDialog.confirm({
      title: 'Bạn có chắc chắn muốn đăng xuất không?',
      message: 'Bạn sẽ cần đăng nhập lại để mua hàng, xem đơn hàng và dùng voucher.',
      confirmLabel: 'Đăng xuất',
      cancelLabel: 'Ở lại',
      danger: true,
      icon: 'log-out',
    });
    if (ok) this.logout();
    return ok;
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
