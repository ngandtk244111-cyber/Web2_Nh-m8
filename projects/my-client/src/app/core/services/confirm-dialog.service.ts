import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tô nút xác nhận màu đỏ cho hành động "nguy hiểm" (đăng xuất, xoá...). */
  danger?: boolean;
  icon?: string;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  resolve: (ok: boolean) => void;
}

/** Hộp thoại xác nhận dùng chung — `await confirm(...)` trả về true khi người dùng đồng ý. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly state = signal<ConfirmDialogState | null>(null);

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    // Đang mở hộp thoại khác → coi như huỷ hộp thoại cũ.
    this.state()?.resolve(false);
    return new Promise<boolean>(resolve => this.state.set({ ...options, resolve }));
  }

  close(ok: boolean): void {
    const current = this.state();
    if (!current) return;
    this.state.set(null);
    current.resolve(ok);
  }
}
