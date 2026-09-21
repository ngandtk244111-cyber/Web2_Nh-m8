import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Warranty {
  _id: string;
  warrantyCode: string;
  orderNumber: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  purchasedAt: string;
  warrantyMonths: number;
  status: 'ACTIVE' | 'CLAIMED' | 'EXPIRED';
  expiresAt: string;
  claimHistory: { note: string; createdAt: string }[];
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

  submitClaim(warrantyCode: string, note: string): Observable<WarrantyApiResponse> {
    return this.http.post<WarrantyApiResponse>(`${this.baseUrl}/${encodeURIComponent(warrantyCode)}/claim`, { note });
  }
}
