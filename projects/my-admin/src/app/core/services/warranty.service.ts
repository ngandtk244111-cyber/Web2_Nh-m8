import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { AdminDataService } from './admin-data.service';

export interface Warranty {
  warrantyCode: string;
  orderNumber: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  warrantyMonths: number;
  status: 'ACTIVE' | 'CLAIMED' | 'EXPIRED';
  purchasedAt: string;
  /** Virtual của server/models/Warranty.js: purchasedAt + warrantyMonths. */
  expiresAt: string;
  createdAt?: string;
  /** Lần lượt: ghi chú khách gửi yêu cầu, ghi chú nhân viên đóng yêu cầu... */
  claimHistory?: { note: string; createdAt: string }[];
  /** Ghi chú nội bộ của nhân viên + nhật ký gia hạn — khách không thấy. */
  adminNotes?: { note: string; author?: string; createdAt: string }[];
}

/** Phiếu bảo hành — dùng chung cho trang Bảo hành và chuông thông báo. */
@Injectable({ providedIn: 'root' })
export class WarrantyService {
  private adminData = inject(AdminDataService);
  readonly warranties = signal<Warranty[]>([]);

  refresh(): void {
    this.adminData.getWarranties().subscribe({
      next: res => this.warranties.set(res.warranties || []),
      error: err => console.warn('Không tải được phiếu bảo hành', err),
    });
  }

  create(data: Record<string, unknown>): Observable<Warranty> {
    return this.adminData.createWarranty(data).pipe(
      map(res => res.warranty as Warranty),
      tap(w => this.warranties.update(list => [w, ...list]))
    );
  }

  resolve(code: string, note: string): Observable<Warranty> {
    return this.replaceWith(code, this.adminData.resolveWarrantyClaim(code, note));
  }

  addNote(code: string, note: string): Observable<Warranty> {
    return this.replaceWith(code, this.adminData.addWarrantyNote(code, note));
  }

  extend(code: string, months: number, reason: string): Observable<Warranty> {
    return this.replaceWith(code, this.adminData.extendWarranty(code, months, reason));
  }

  /** Thay phiếu trong danh sách bằng bản server vừa trả về. */
  private replaceWith(code: string, req: Observable<{ warranty: any }>): Observable<Warranty> {
    return req.pipe(
      map(res => res.warranty as Warranty),
      tap(w => this.warranties.update(list => list.map(x => x.warrantyCode === code ? w : x)))
    );
  }
}
