import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppNotification } from '../models/notification.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/notifications`;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

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
