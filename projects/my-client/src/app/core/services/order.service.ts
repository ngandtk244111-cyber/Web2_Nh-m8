import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, of } from 'rxjs';
import { io, Socket } from 'socket.io-client';
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

export interface InvoiceRequest {
  requested: boolean;
  type: 'personal' | 'company';
  email: string;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
}

/** Link hoá đơn PDF của đơn (mở trong trình duyệt; download=true để tải file). Thẻ <a>/tab mới không gửi
 *  header Authorization nên token đăng nhập đi kèm qua ?token=. */
export function invoiceUrl(orderNumber: string, token?: string | null, download = false): string {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (download) params.set('download', '1');
  const q = params.toString();
  return `${environment.apiUrl}/orders/${encodeURIComponent(orderNumber)}/invoice${q ? '?' + q : ''}`;
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

  // ---------- Theo dõi trực tiếp (socket.io, cùng server với chat hỗ trợ) ----------
  private socket: Socket | null = null;
  private watcherCount = 0;
  private readonly liveConnectedSignal = signal(false);
  /** true khi kết nối realtime đang hoạt động — trang Tra cứu đơn hiển thị trạng thái "Trực tiếp". */
  readonly liveConnected = this.liveConnectedSignal.asReadonly();

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

  /** Tra cứu 1 đơn theo mã đơn: chủ tài khoản xem được ngay, người khác cần đúng SĐT nhận hàng. */
  getOrderByNumber(orderNumber: string, phone = ''): Observable<Order | null> {
    const params: Record<string, string> = phone ? { phone } : {};
    return this.http.get<OrderApiResponse>(`${this.baseUrl}/by-number/${encodeURIComponent(orderNumber)}`, { params }).pipe(
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
    /** Yêu cầu xuất hoá đơn điện tử (cá nhân / công ty). */
    invoice?: InvoiceRequest | null;
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

  confirmPayment(orderNumber: string, phone: string): Observable<Order> {
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/confirm-payment`, { phone }).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  /** Khách tự huỷ đơn của mình (chỉ khi đơn chưa sản xuất/giao). Lỗi trả về thông điệp tiếng Việt từ server. */
  cancelOrder(orderNumber: string, userId: string, reason: string, detail = ''): Observable<Order> {
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/cancel`, { userId, reason, detail }).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  /** Đổi phương thức thanh toán của đơn chưa trả tiền (giữ nguyên đơn, giá và mã giảm giá). */
  changePaymentMethod(orderNumber: string, paymentMethod: string): Observable<Order> {
    const userId = this.authService.currentUser()?._id;
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/payment-method`, { paymentMethod, userId }).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  /** Gửi yêu cầu trả hàng / hoàn tiền cho đơn đã giao. */
  requestReturn(orderNumber: string, userId: string, reason: string, description = ''): Observable<Order> {
    return this.http.post<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/return-request`, { userId, reason, description }).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  /** Huỷ yêu cầu trả hàng (chỉ khi shop chưa duyệt). */
  cancelReturn(orderNumber: string, userId: string): Observable<Order> {
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/return-request/cancel`, { userId }).pipe(
      map(res => this.normalize(res.order!)),
      tap(order => this.replaceInSignal(order))
    );
  }

  /** Khách xác nhận đã nhận lại tiền hoàn -> hoàn tất đổi trả. */
  confirmReturnReceived(orderNumber: string, userId: string): Observable<Order> {
    return this.http.patch<OrderApiResponse>(`${this.baseUrl}/${encodeURIComponent(orderNumber)}/return-request/received`, { userId }).pipe(
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

  /**
   * Theo dõi trực tiếp 1 đơn: phát bản mới nhất mỗi khi nhân viên cập nhật (xác nhận, sản xuất,
   * giao hàng, thanh toán...). Khi mất kết nối rồi nối lại sẽ tự tải lại đơn để không lỡ thay đổi.
   * Huỷ subscribe = rời phòng theo dõi; hết người theo dõi thì đóng socket.
   */
  watchOrder(orderNumber: string, phone = ''): Observable<Order> {
    return new Observable<Order>(subscriber => {
      const socket = this.acquireSocket();
      const join = () => socket.emit('order:watch', { orderNumber, phone, userToken: this.authService.token });
      const onUpdate = (order: Order & { _id?: string }) => {
        if (order?.orderNumber === orderNumber) subscriber.next(this.normalize(order));
      };
      let firstConnect = true;
      const onConnect = () => {
        join();
        // Lần kết nối lại: đồng bộ các thay đổi có thể đã lỡ trong lúc mất mạng.
        if (!firstConnect) {
          this.getOrderByNumber(orderNumber, phone).subscribe(order => order && subscriber.next(order));
        }
        firstConnect = false;
      };

      socket.on('order:updated', onUpdate);
      socket.on('connect', onConnect);
      if (socket.connected) onConnect();

      return () => {
        socket.emit('order:unwatch', orderNumber);
        socket.off('order:updated', onUpdate);
        socket.off('connect', onConnect);
        this.releaseSocket();
      };
    });
  }

  private acquireSocket(): Socket {
    this.watcherCount++;
    if (!this.socket) {
      this.socket = io(environment.socketUrl);
      this.socket.on('connect', () => this.liveConnectedSignal.set(true));
      this.socket.on('disconnect', () => this.liveConnectedSignal.set(false));
    }
    return this.socket;
  }

  private releaseSocket(): void {
    this.watcherCount = Math.max(0, this.watcherCount - 1);
    if (this.watcherCount === 0 && this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.liveConnectedSignal.set(false);
    }
  }

  private replaceInSignal(updated: Order): void {
    this.ordersSignal.update(list => list.map(o => o.orderNumber === updated.orderNumber ? updated : o));
  }
}
