import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Admin } from '../models/admin.model';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'deco3d_admin';
const BASE = `${environment.apiUrl}/admin/auth`;

interface AdminLoginResponse {
  success: boolean;
  admin?: Admin;
  error?: string;
}

/**
 * Đăng nhập admin bằng username + password, KHÔNG dùng token — cùng mô hình "tin id client gửi
 * lên" mà toàn bộ Lam-a-main đang dùng cho user thường (tham khảo AuthService của my-client).
 * Sau khi login, mọi request ghi dữ liệu (product/room/custom-request/order...) tự gắn adminId
 * lấy từ đây — xem cách các service khác trong core/services/ dùng `adminAuth.currentAdmin()?._id`.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);

  readonly currentAdmin = signal<Admin | null>(null);

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const admin = JSON.parse(raw) as Admin;
        if (admin?.username) this.currentAdmin.set(admin);
      }
    } catch {
      // ignore invalid stored admin
    }
  }

  private persist(admin: Admin | null): void {
    try {
      if (admin) localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { }
  }

  login(username: string, password: string): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(`${BASE}/login`, { username, password }).pipe(
      tap(res => {
        if (res.success && res.admin) {
          this.currentAdmin.set(res.admin);
          this.persist(res.admin);
        }
      })
    );
  }

  logout(): void {
    this.currentAdmin.set(null);
    this.persist(null);
  }

  get adminId(): string {
    return this.currentAdmin()?._id || '';
  }
}
