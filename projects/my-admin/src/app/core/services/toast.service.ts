import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/** Thông báo nổi góc phải dùng chung cho mọi trang (pattern toast.service của AuraPC). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, type: ToastType = 'success', duration = 3500): void {
    const id = this.nextId++;
    this.toasts.update(list => [...list.slice(-3), { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string): void { this.show(message, 'success'); }
  info(message: string): void { this.show(message, 'info'); }
  warning(message: string): void { this.show(message, 'warning'); }
  error(message: string): void { this.show(message, 'error', 5000); }

  /** Lỗi từ HttpClient: ưu tiên câu báo lỗi server trả về. */
  apiError(err: any, fallback: string): void {
    if (err?.status === 401) return; // interceptor đã đưa về trang đăng nhập
    this.error(err?.error?.error || fallback);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
