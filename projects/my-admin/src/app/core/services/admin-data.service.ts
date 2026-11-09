import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const ADMIN = `${environment.apiUrl}/admin`;
const COUPONS = `${environment.apiUrl}/coupons`;
const WARRANTY = `${environment.apiUrl}/warranty`;

export type AdminConfigKey = 'categories' | 'suppliers' | 'workshops' | 'banners' | 'settings' | 'permissions';

/** Dữ liệu riêng của my-admin: cấu hình, nhật ký, nhân viên, mã giảm giá, phiếu bảo hành. */
@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private http = inject(HttpClient);

  getConfig(): Observable<{ success: boolean; config: Partial<Record<AdminConfigKey, any>> }> {
    return this.http.get<{ success: boolean; config: Partial<Record<AdminConfigKey, any>> }>(`${ADMIN}/config`);
  }

  saveConfig(key: AdminConfigKey, value: unknown): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${ADMIN}/config/${key}`, { value });
  }

  getAuditLogs(): Observable<{ success: boolean; logs: any[] }> {
    return this.http.get<{ success: boolean; logs: any[] }>(`${ADMIN}/audit`);
  }

  addAuditLog(entry: { module: string; action: string; detail: string; level: string }): Observable<{ success: boolean; log: any }> {
    return this.http.post<{ success: boolean; log: any }>(`${ADMIN}/audit`, entry);
  }

  getStaff(): Observable<{ success: boolean; staff: any[] }> {
    return this.http.get<{ success: boolean; staff: any[] }>(`${ADMIN}/staff`);
  }

  createStaff(data: Record<string, string>): Observable<{ success: boolean; staff: any }> {
    return this.http.post<{ success: boolean; staff: any }>(`${ADMIN}/staff`, data);
  }

  setStaffRole(id: string, role: string): Observable<{ success: boolean; staff: any }> {
    return this.http.patch<{ success: boolean; staff: any }>(`${ADMIN}/staff/${id}/role`, { role });
  }

  setStaffActive(id: string, active: boolean): Observable<{ success: boolean; staff: any }> {
    return this.http.patch<{ success: boolean; staff: any }>(`${ADMIN}/staff/${id}/active`, { active });
  }

  getCoupons(): Observable<{ success: boolean; coupons: any[] }> {
    return this.http.get<{ success: boolean; coupons: any[] }>(`${COUPONS}/admin`);
  }

  createCoupon(data: Record<string, unknown>): Observable<{ success: boolean; coupon: any }> {
    return this.http.post<{ success: boolean; coupon: any }>(`${COUPONS}/admin`, data);
  }

  setCouponActive(code: string, active: boolean): Observable<{ success: boolean; coupon: any }> {
    return this.http.patch<{ success: boolean; coupon: any }>(`${COUPONS}/admin/${encodeURIComponent(code)}`, { active });
  }

  getWarranties(): Observable<{ success: boolean; warranties: any[] }> {
    return this.http.get<{ success: boolean; warranties: any[] }>(`${WARRANTY}/admin`);
  }

  createWarranty(data: Record<string, unknown>): Observable<{ success: boolean; warranty: any }> {
    return this.http.post<{ success: boolean; warranty: any }>(WARRANTY, data);
  }

  resolveWarrantyClaim(code: string, note: string): Observable<{ success: boolean; warranty: any }> {
    return this.http.patch<{ success: boolean; warranty: any }>(`${WARRANTY}/admin/${encodeURIComponent(code)}/resolve`, { note });
  }

  addWarrantyNote(code: string, note: string): Observable<{ success: boolean; warranty: any }> {
    return this.http.post<{ success: boolean; warranty: any }>(`${WARRANTY}/admin/${encodeURIComponent(code)}/notes`, { note });
  }

  extendWarranty(code: string, months: number, reason: string): Observable<{ success: boolean; warranty: any }> {
    return this.http.patch<{ success: boolean; warranty: any }>(`${WARRANTY}/admin/${encodeURIComponent(code)}/extend`, { months, reason });
  }
}
