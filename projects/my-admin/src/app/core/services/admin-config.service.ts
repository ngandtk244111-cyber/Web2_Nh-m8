import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AdminConfigKey, AdminDataService } from './admin-data.service';

/** Cấu hình admin lưu trên server (GET/PUT /admin/config): danh mục, nhà cung cấp, banner, cài đặt, phân quyền. */
@Injectable({ providedIn: 'root' })
export class AdminConfigService {
  private adminData = inject(AdminDataService);

  /** null = chưa tải xong; key nào chưa lưu lần nào thì không có trong object. */
  readonly config = signal<Partial<Record<AdminConfigKey, any>> | null>(null);
  private loading = false;

  /** Tải 1 lần; force = true để tải lại (vd sau khi lưu lỗi). */
  load(force = false): void {
    if (this.loading || (this.config() && !force)) return;
    this.loading = true;
    this.adminData.getConfig().subscribe({
      next: ({ config }) => {
        this.loading = false;
        this.config.set(config || {});
      },
      error: err => {
        this.loading = false;
        if (!this.config()) this.config.set({});
        console.warn('Không tải được cấu hình', err);
      },
    });
  }

  get<T>(key: AdminConfigKey): T | undefined {
    return this.config()?.[key] as T | undefined;
  }

  /** Lưu lên server; chỉ cập nhật bản trong máy khi server xác nhận. */
  save(key: AdminConfigKey, value: unknown): Observable<{ success: boolean }> {
    return this.adminData.saveConfig(key, value).pipe(
      tap(() => this.config.update(c => ({ ...(c || {}), [key]: value })))
    );
  }
}
