import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Admin } from '../models/admin.model';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'deco3d_admin';
const TOKEN_KEY = 'deco3d_admin_token';
const BASE = `${environment.apiUrl}/admin/auth`;

/** Quyền theo phân hệ: permissions.orders.view... Server mới là nơi kiểm tra thật, ở đây chỉ để ẩn giao diện. */
export type AdminPermissions = Record<string, Record<string, boolean>>;

interface AdminLoginResponse {
  success: boolean;
  admin?: Admin;
  token?: string;
  error?: string;
  permissions?: AdminPermissions;
  isSuperAdmin?: boolean;
}

/**
 * Đăng nhập admin bằng username + password, server trả token có chữ ký. Token được gắn vào mọi
 * request qua core/interceptors/admin-auth.interceptor.ts; server không còn tin adminId client gửi.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);

  readonly currentAdmin = signal<Admin | null>(null);
  /** null khi chưa tải xong quyền. */
  readonly permissions = signal<AdminPermissions | null>(null);
  readonly isSuperAdmin = signal(false);
  token = '';

  constructor() {
    try {
      // Phiên cũ chưa có token coi như chưa đăng nhập.
      const raw = localStorage.getItem(STORAGE_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (raw && token) {
        const admin = JSON.parse(raw) as Admin;
        if (admin?.username) {
          this.currentAdmin.set(admin);
          this.token = token;
        }
      }
    } catch {
      // ignore invalid stored admin
    }
  }

  private persist(admin: Admin | null): void {
    try {
      if (admin) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
        localStorage.setItem(TOKEN_KEY, this.token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch { }
  }

  login(username: string, password: string): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(`${BASE}/login`, { username, password }).pipe(
      tap(res => {
        if (res.success && res.admin && res.token) {
          this.token = res.token;
          this.currentAdmin.set(res.admin);
          this.persist(res.admin);
          this.setAccess(res);
        }
      })
    );
  }

  /** Lấy lại vai trò và quyền mới nhất từ server, vì có thể đã đổi từ lần đăng nhập trước. */
  loadAccess(): Observable<AdminLoginResponse> {
    return this.http.get<AdminLoginResponse>(`${BASE}/me`).pipe(
      tap(res => {
        if (res.admin) {
          this.currentAdmin.set(res.admin);
          this.persist(res.admin);
        }
        this.setAccess(res);
      })
    );
  }

  /** rule dạng 'orders.view'. */
  can(rule: string): boolean {
    const [module, action] = rule.split('.');
    return !!this.permissions()?.[module]?.[action];
  }

  private setAccess(res: AdminLoginResponse): void {
    this.permissions.set(res.permissions || {});
    this.isSuperAdmin.set(!!res.isSuperAdmin);
  }

  changePassword(oldPassword: string, newPassword: string): Observable<{ success: boolean; token?: string; error?: string }> {
    return this.http.post<{ success: boolean; token?: string; error?: string }>(`${BASE}/change-password`, { oldPassword, newPassword }).pipe(
      tap(res => {
        if (res.success && res.token) {
          this.token = res.token;
          this.persist(this.currentAdmin());
        }
      })
    );
  }

  logout(): void {
    this.token = '';
    this.currentAdmin.set(null);
    this.permissions.set(null);
    this.isSuperAdmin.set(false);
    this.persist(null);
  }

  get adminId(): string {
    return this.currentAdmin()?._id || '';
  }
}
