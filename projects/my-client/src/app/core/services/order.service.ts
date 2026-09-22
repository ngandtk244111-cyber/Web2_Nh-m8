import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, of } from 'rxjs';
import { Order, OrderStatus, ProductionStep, ProductionProgress, ShippingAddress } from '../models/order.model';
import { CartItem } from '../models/cart.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

interface OrderApiResponse {
  success: boolean;
  order?: Order & { _id?: string };
  error?: string;
}

interface OrdersApiResponse {
  success: boolean;
  orders?: (Order & { _id?: string })[];
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  private ordersSignal = signal<Order[]>([]);
  readonly orders = this.ordersSignal.asReadonly();

  // orderNumber là khoá tự nhiên (unique) của đơn hàng ở backend thật, dùng luôn làm `id`
  // ở phía FE để không phải sửa template/tra cứu đang dùng order.id.
  private normalize(order: Order & { _id?: string }): Order {
    return { ...order, id: order.orderNumber };
  }

  private nowLabel(): string {
    const now = new Date();
    return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  /** Nạp toàn bộ đơn hàng (dùng cho trang admin). */
  fetchAll(): Observable<Order[]> {
    return this.http.get<OrdersApiResponse>(this.baseUrl).pipe(
      map(res => (res.orders || []).map(o => this.normalize(o))),
      tap(orders => this.ordersSignal.set(orders)),
      catchError(err => {
        console.error('Failed to fetch orders', err);
        return of([]);
      })
    );
  }

  /** Tra cứu 1 đơn theo mã đơn hàng — dùng cho trang theo dõi đơn (không cần đăng nhập). */
  getOrderByNumber(orderNumber: string): Observable<Order | null> {
    return this.http.get<OrderApiResponse>(`${this.baseUrl}/by-number/${encodeURIComponent(orderNumber)}`).pipe(
      map(res => res.order ? this.normalize(res.order) : null),
      catchError(() => of(null))
    );
  }

  /** Lịch sử đơn hàng của tài khoản đang đăng nhập. */
  fetchMine(): Observable<Order[]> {
    const userId = this.authService.currentUser()?._id;
    if (!userId) return of([]);
    return this.http.get<OrdersApiResponse>(`${this.baseUrl}/mine`, { params: { userId } }).pipe(
      map(res => (res.orders || []).map(o => this.normalize(o))),
      catchError(() => of([]))
    );
  }

  createOrder(orderData: {
    items: CartItem[];
    shippingAddress: ShippingAddress;
    paymentMethod: 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'ATM';
    // subtotal/discount/shippingFee/total: chỉ để hiển thị optimistic ở FE — backend tự tính lại
    // từ giá sản phẩm THẬT trong DB + couponCode, không tin các số này từ client (xem
    // server/utils/pricing.js). couponCode dùng để backend verify lại giảm giá.
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    couponCode?: string;
    notes?: string;
  }): Observable<Order> {
    const userId = this.authService.currentUser()?._id;
    const body = userId ? { ...orderData, userId } : orderData;
    return this.http.post<OrderApiResponse>(this.baseUrl, body).pipe(
      map(res => {
        if (!res.success || !res.order) throw new Error(res.error || 'Không tạo được đơn hàng');
        return this.normalize(res.order);
      }),
      tap(order => this.ordersSignal.update(list => [order, ...list]))
    );
  }

  confirmPayment(orderNumber: string): Observable<Order> {
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/confirm-payment`, {}).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  // Admin: cập nhật trạng thái tổng quát + tiến độ sản xuất chi tiết.
  updateOrderStatus(orderNumber: string, status: OrderStatus, progress?: ProductionProgress): Observable<Order> {
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/production`, {
      status,
      productionProgress: progress,
    }).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  advanceProductionStep(orderNumber: string, nextStep: ProductionStep, stepTitle: string, percentage: number, notes: string): void {
    const progress: ProductionProgress = {
      currentStep: nextStep,
      percentage,
      stepTitle,
      notes,
      updatedAt: this.nowLabel(),
    };
    const status: OrderStatus = nextStep === 'DISPATCHED' ? 'SHIPPED' : 'IN_PRODUCTION';
    this.updateOrderStatus(orderNumber, status, progress).subscribe();
  }

  private replaceInSignal(updated: Order): void {
    this.ordersSignal.update(list => list.map(o => o.orderNumber === updated.orderNumber ? updated : o));
  }
}
