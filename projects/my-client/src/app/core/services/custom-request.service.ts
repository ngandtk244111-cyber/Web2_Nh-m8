import { Injectable, NgZone, signal, inject } from '@angular/core';
import { io } from 'socket.io-client';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { CustomRequest, DepositPolicy, Quote } from '../models/custom-request.model';
import { Order, ShippingAddress } from '../models/order.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/custom-requests`;

export interface QuotesResponse {
  quotes: Quote[];
  policy: DepositPolicy;
  termsVersion: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomRequestService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  watch(id: string): () => void {
    const socket = this.zone.runOutsideAngular(() => io(environment.socketUrl));
    socket.on('connect', () => socket.emit('custom-request:watch', { id, userToken: this.auth.token }));
    socket.on('custom-request:updated', () => this.zone.run(() => this.refresh()));
    return () => { socket.disconnect(); };
  }

  private requestsSignal = signal<CustomRequest[]>([]);
  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.http.get<{ success: boolean; requests: CustomRequest[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.requestsSignal.set(res.requests);
      },
      error: (err) => console.warn('Failed to load custom requests', err),
    });
  }

  getRequestById(id: string): CustomRequest | undefined {
    return this.requestsSignal().find(r => r.id === id || r.requestCode === id);
  }

  private replace(request: CustomRequest): void {
    this.requestsSignal.update(list => list.map(r => r.id === request.id ? request : r));
  }

  createRequest(data: Omit<CustomRequest, 'id' | 'requestCode' | 'createdAt' | 'updatedAt' | 'messages' | 'status'>): Observable<CustomRequest> {
    return this.http.post<{ success: boolean; request: CustomRequest }>(BASE, data).pipe(
      map(res => res.request),
      tap(newRequest => this.requestsSignal.update(list => [newRequest, ...list]))
    );
  }

  sendMessage(requestId: string, text: string): Observable<CustomRequest> {
    return this.http.post<{ success: boolean; request: CustomRequest }>(
      BASE + '/' + requestId + '/messages', { text }
    ).pipe(map(res => res.request), tap(request => this.replace(request)));
  }

  // ---- Báo giá có phiên bản & đặt hàng (giá, tiền cọc do server tính từ báo giá trong DB) ----

  getQuotes(requestId: string): Observable<QuotesResponse> {
    return this.http.get<QuotesResponse & { success: boolean }>(`${BASE}/${requestId}/quotes`);
  }

  /** Chấp nhận báo giá — bắt buộc đồng ý chính sách cọc. */
  acceptQuote(requestId: string, version: number): Observable<CustomRequest> {
    return this.http.post<{ success: boolean; request: CustomRequest }>(`${BASE}/${requestId}/quotes/${version}/accept`, { agreeDepositTerms: true }).pipe(
      map(res => res.request),
      tap(r => this.replace(r))
    );
  }

  rejectQuote(requestId: string, version: number, reason: string): Observable<CustomRequest> {
    return this.http.post<{ success: boolean; request: CustomRequest }>(`${BASE}/${requestId}/quotes/${version}/reject`, { reason }).pipe(
      map(res => res.request),
      tap(r => this.replace(r))
    );
  }

  /** Tạo đơn đặt làm từ báo giá đã chấp nhận (bấm nhiều lần server vẫn chỉ tạo 1 đơn). */
  checkout(requestId: string, body: { quoteVersion: number; shippingAddress: ShippingAddress; paymentMethod: string; notes?: string }): Observable<Order> {
    return this.http.post<{ success: boolean; order: Order }>(`${BASE}/${requestId}/checkout`, { ...body, agreeDepositTerms: true }).pipe(
      map(res => res.order),
      tap(() => this.refresh())
    );
  }
}
