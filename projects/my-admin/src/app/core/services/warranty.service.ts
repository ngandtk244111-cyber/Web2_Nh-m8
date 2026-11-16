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
  /** CLAIMED = khách vừa gửi yêu cầu, chờ tiếp nhận; PROCESSING = shop đã tiếp nhận, đang xử lý. */
  status: 'ACTIVE' | 'CLAIMED' | 'PROCESSING' | 'EXPIRED';
  purchasedAt: string;
  /** Virtual của server/models/Warranty.js: purchasedAt + warrantyMonths. */
  expiresAt: string;
  createdAt?: string;
  /** Lần lượt: khách gửi yêu cầu (kèm ảnh), shop tiếp nhận, shop đóng yêu cầu (kèm kết quả)... */
  claimHistory?: { note: string; createdAt: string; by?: 'CUSTOMER' | 'STAFF' | null; images?: string[]; result?: ClaimResult | null }[];
  /** Ghi chú nội bộ của nhân viên + nhật ký gia hạn — khách không thấy. */
  adminNotes?: { note: string; author?: string; createdAt: string }[];
}

export type ClaimResult = 'REPAIR' | 'REPRINT' | 'REPLACE' | 'REJECTED';

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

  /** Cấp phiếu cho các món (itemIds) của 1 đơn đã giao — server lấy thông tin khách/sản phẩm từ đơn. */
  issueForOrder(orderNumber: string, itemIds: string[], warrantyMonths: number): Observable<Warranty[]> {
    return this.adminData.createWarranty({ orderNumber, itemIds, warrantyMonths }).pipe(
      map(res => (res.warranties || [res.warranty]) as Warranty[]),
      tap(list => this.warranties.update(cur => [...list, ...cur]))
    );
  }

  /** Tiếp nhận yêu cầu (đã liên hệ khách) -> Đang xử lý. */
  process(code: string, note: string): Observable<Warranty> {
    return this.replaceWith(code, this.adminData.processWarrantyClaim(code, note));
  }

  resolve(code: string, result: ClaimResult, note: string): Observable<Warranty> {
    return this.replaceWith(code, this.adminData.resolveWarrantyClaim(code, result, note));
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
