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

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  createMomoPayment(orderNumber: string): Observable<CreatePaymentResponse> {
    return this.http.post<CreatePaymentResponse>(`${this.baseUrl}/momo/create`, { orderNumber });
  }

  createZaloPayPayment(orderNumber: string): Observable<CreatePaymentResponse> {
    return this.http.post<CreatePaymentResponse>(`${this.baseUrl}/zalopay/create`, { orderNumber });
  }
}
