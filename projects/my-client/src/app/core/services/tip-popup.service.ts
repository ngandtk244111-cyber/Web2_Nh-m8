import { Injectable, signal } from '@angular/core';

/** Trạng thái popup "Có thể bạn chưa biết?" — tách service để nơi khác (nếu cần) có thể phối hợp sau này. */
@Injectable({ providedIn: 'root' })
export class TipPopupService {
  readonly dismissed = signal(false);

  dismiss(): void {
    this.dismissed.set(true);
  }
}
