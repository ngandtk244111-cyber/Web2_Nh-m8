import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';

/** Vùng hiện toast góc phải trên (notification-toast của Vita). */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite">
      <div *ngFor="let t of toast.toasts()" class="notification-toast" [ngClass]="t.type" (click)="toast.dismiss(t.id)">
        <i class="bi" [ngClass]="icons[t.type]"></i>
        <span>{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 76px;
      right: 20px;
      z-index: 2100;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: min(420px, calc(100vw - 40px));
    }
    .notification-toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 13px 18px;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-left: 4px solid currentColor;
      font-size: 14px;
      color: var(--color-text-primary);
      cursor: pointer;
      animation: slideIn 0.2s ease-out;
    }
    .notification-toast i { font-size: 1.1rem; line-height: 1.2; }
    .notification-toast.success { border-left-color: #28a745; }
    .notification-toast.success i { color: #28a745; }
    .notification-toast.error { border-left-color: #dc3545; }
    .notification-toast.error i { color: #dc3545; }
    .notification-toast.warning { border-left-color: #f0ad00; }
    .notification-toast.warning i { color: #f0ad00; }
    .notification-toast.info { border-left-color: var(--color-info); }
    .notification-toast.info i { color: var(--color-info); }
    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  `],
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);
  readonly icons: Record<string, string> = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill',
  };
}
