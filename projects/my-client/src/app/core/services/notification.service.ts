import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AppNotification } from '../models/notification.model';
import { AuthService } from './auth.service';
import { LoginModalService } from './login-modal.service';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/notifications`;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private loginModal = inject(LoginModalService);
  private toast = inject(ToastService);

  /** true trong lúc đang gọi API đặt/hủy nhắc — để khóa nút, tránh bấm đúp. */
  readonly reminderBusy = signal(false);

  private notificationsSignal = signal<AppNotification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();

  readonly unreadCount = computed(() =>
    this.notificationsSignal().filter(n => !n.read).length
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    const userId = this.authService.currentUser()?._id || '';
    this.http.get<{ success: boolean; notifications: AppNotification[] }>(BASE, { params: { userId } }).subscribe({
      next: (res) => {
        if (res.success) this.notificationsSignal.set(res.notifications);
      },
      error: (err) => console.warn('Failed to load notifications', err),
    });
  }

  /** Khóa YYYY-MM-DD (giờ địa phương) của 1 khung Flash Sale — khóa nhắc hẹn lưu trên server. */
  flashSaleKey(start: Date): string {
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`;
  }

  /**
   * Bấm "Nhận thông báo": đặt (hoặc hủy nếu đã đặt) nhắc "Flash Sale bắt đầu" cho khung `start` → `end`.
   * Chưa đăng nhập thì mở modal đăng nhập. Nhắc hẹn được lưu thành thông báo của user trên server.
   */
  toggleFlashSaleReminder(start: Date, end: Date): void {
    if (this.reminderBusy() || start.getTime() <= Date.now()) return;

    if (!this.authService.currentUser()) {
      this.toast.info('Vui lòng đăng nhập để nhận thông báo khi deal diễn ra');
      this.loginModal.open();
      return;
    }

    const key = this.flashSaleKey(start);
    const label = `${start.getHours()}:00 - ${end.getHours()}:00, ${start.getDate()}/${start.getMonth() + 1}`;
    const reminded = this.isFlashSaleReminded(key);

    this.reminderBusy.set(true);
    const request$ = reminded ? this.cancelFlashSaleReminder(key) : this.remindFlashSale(key, label, start);
    request$.subscribe({
      next: (res) => {
        this.reminderBusy.set(false);
        if (!res.success) this.toast.error(res.error || 'Không thể cập nhật nhắc hẹn, thử lại sau nhé.');
        else if (reminded) this.toast.info('Đã hủy nhắc hẹn Flash Sale');
        else this.toast.success('Đã đặt nhắc! Bạn sẽ nhận thông báo khi deal bắt đầu.');
      },
      error: (err) => {
        this.reminderBusy.set(false);
        this.toast.error(err?.error?.error || 'Không thể cập nhật nhắc hẹn, thử lại sau nhé.');
      },
    });
  }

  /** Khung đã đặt nhắc vừa chuyển sang "đang diễn ra" lúc người dùng còn ở trang → báo ngay + nạp lại thông báo. */
  announceFlashSaleStarted(): void {
    this.toast.success('⚡ Flash Sale đã bắt đầu! Vào săn deal ngay nhé.', 6000);
    // Thông báo hẹn giờ trên server hiện đúng lúc bắt đầu — nạp lại 2 lần (phòng lệch đồng hồ) để vào chuông/danh sách.
    setTimeout(() => this.refresh(), 2000);
    setTimeout(() => this.refresh(), 8000);
  }

  /** Đã đặt nhắc Flash Sale cho khung ngày `slotKey` (YYYY-MM-DD) chưa — suy ra từ thông báo xác nhận đã lưu. */
  isFlashSaleReminded(slotKey: string): boolean {
    return this.notificationsSignal().some(n => n.refKey === `flash-sale:${slotKey}`);
  }

  remindFlashSale(slotKey: string, slotLabel: string, startAt: Date): Observable<{ success: boolean; error?: string }> {
    const userId = this.authService.currentUser()?._id;
    return this.http
      .post<{ success: boolean; error?: string }>(`${BASE}/flash-sale-reminder`, {
        userId,
        slotDate: slotKey,
        slotLabel,
        startAt: startAt.toISOString(),
      })
      .pipe(tap(res => { if (res.success) this.refresh(); }));
  }

  cancelFlashSaleReminder(slotKey: string): Observable<{ success: boolean; error?: string }> {
    const userId = this.authService.currentUser()?._id || '';
    return this.http
      .delete<{ success: boolean; error?: string }>(`${BASE}/flash-sale-reminder`, { params: { userId, slotDate: slotKey } })
      .pipe(tap(res => { if (res.success) this.refresh(); }));
  }

  markAsRead(id: string): void {
    this.notificationsSignal.update(list => list.map(n => n._id === id ? { ...n, read: true } : n));
    this.http.put<{ success: boolean }>(`${BASE}/${id}/read`, {}).subscribe({
      error: () => this.refresh(),
    });
  }

  markAllAsRead(): void {
    this.notificationsSignal.update(list => list.map(n => ({ ...n, read: true })));
    const userId = this.authService.currentUser()?._id;
    this.http.put<{ success: boolean }>(`${BASE}/read-all`, userId ? { userId } : {}).subscribe({
      error: () => this.refresh(),
    });
  }
}
