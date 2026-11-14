import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CreatePaymentResponse {
  success: boolean;
  payUrl?: string;
  orderUrl?: string;
  error?: string;
}

export interface VerifyReturnResponse {
  success: boolean;
  paid?: boolean;
  orderNumber?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  createMomoPayment(orderNumber: string, paymentMethod: 'momo' | 'atm' = 'momo'): Observable<CreatePaymentResponse> {
    return this.http.post<CreatePaymentResponse>(`${this.baseUrl}/momo/create`, { orderNumber, paymentMethod });
  }

  createZaloPayPayment(orderNumber: string): Observable<CreatePaymentResponse> {
    return this.http.post<CreatePaymentResponse>(`${this.baseUrl}/zalopay/create`, { orderNumber });
  }

  /** Xác minh chữ ký MoMo trên URL quay về rồi ghi nhận thanh toán (callback không về được localhost). */
  verifyMomoReturn(params: Record<string, string>): Observable<VerifyReturnResponse> {
    return this.http.post<VerifyReturnResponse>(`${this.baseUrl}/momo/verify-return`, params);
  }

  /** Xác minh checksum ZaloPay trên URL quay về; server trả kèm mã đơn của shop. */
  verifyZaloPayReturn(params: Record<string, string>): Observable<VerifyReturnResponse> {
    return this.http.post<VerifyReturnResponse>(`${this.baseUrl}/zalopay/verify-return`, params);
  }

  /** Cổng thanh toán thử (chạy dev): xác nhận đã thanh toán hoặc huỷ giao dịch. */
  confirmSandbox(orderNumber: string, action: 'pay' | 'cancel'): Observable<VerifyReturnResponse> {
    return this.http.post<VerifyReturnResponse>(`${this.baseUrl}/sandbox/confirm`, { orderNumber, action });
  }
}
