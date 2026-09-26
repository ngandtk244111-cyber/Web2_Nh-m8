import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'cart';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<ToastMessage[]>([]);

  private push(message: string, type: ToastType, icon: string, durationMs: number): void {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, message, type, icon }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string, durationMs = 3000): void {
    this.push(message, 'success', 'check', durationMs);
  }

  error(message: string, durationMs = 4000): void {
    this.push(message, 'error', 'x', durationMs);
  }

  info(message: string, durationMs = 3000): void {
    this.push(message, 'info', 'sparkles', durationMs);
  }

  /** Thông báo thêm giỏ hàng — hiển thị riêng ở giữa phía trên màn hình. */
  cart(message: string, durationMs = 3000): void {
    this.push(message, 'cart', 'check', durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
