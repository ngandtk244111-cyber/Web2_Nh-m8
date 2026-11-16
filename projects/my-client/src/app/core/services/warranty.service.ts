import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Warranty {
  _id: string;
  warrantyCode: string;
  orderNumber: string;
  itemId?: string | null;
  productName: string;
  productImage?: string;
  customerName: string;
  customerPhone: string;
  purchasedAt: string;
  warrantyMonths: number;
  /** CLAIMED = đã gửi yêu cầu, chờ shop tiếp nhận; PROCESSING = shop đã tiếp nhận, đang xử lý. */
  status: 'ACTIVE' | 'CLAIMED' | 'PROCESSING' | 'EXPIRED';
  expiresAt: string;
  claimHistory: {
    note: string;
    createdAt: string;
    by?: 'CUSTOMER' | 'STAFF' | null;
    /** Ảnh khách gửi, dạng /api/products/images/<id>. */
    images?: string[];
    result?: 'REPAIR' | 'REPRINT' | 'REPLACE' | 'REJECTED' | null;
  }[];
}

interface WarrantyApiResponse {
  success: boolean;
  warranty?: Warranty;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WarrantyService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/warranty`;

  lookup(warrantyCode: string, phone: string): Observable<{ warranty: Warranty | null; error: string | null }> {
    return this.http.get<WarrantyApiResponse>(`${this.baseUrl}/lookup`, {
      params: { warrantyCode, phone },
    }).pipe(
      map(res => ({ warranty: res.warranty || null, error: null })),
      catchError(err => of({ warranty: null, error: err.error?.error || 'Không tìm thấy phiếu bảo hành' }))
    );
  }

  /** Gửi yêu cầu kèm ảnh tình trạng sản phẩm (multipart, tối đa 3 ảnh). */
  submitClaim(warrantyCode: string, phone: string, note: string, images: File[]): Observable<WarrantyApiResponse> {
    const body = new FormData();
    body.append('phone', phone);
    body.append('note', note);
    images.forEach(file => body.append('images', file));
    return this.http.post<WarrantyApiResponse>(`${this.baseUrl}/${encodeURIComponent(warrantyCode)}/claim`, body);
  }
}
