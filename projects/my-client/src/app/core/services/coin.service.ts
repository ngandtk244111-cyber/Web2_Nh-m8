import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { CoinClaimResult, CoinRewardReason, CoinTransaction } from '../models/coin.model';

const BASE = `${environment.apiUrl}/coins`;

@Injectable({ providedIn: 'root' })
export class CoinService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  readonly balance = signal<number>(0);
  readonly transactions = signal<CoinTransaction[]>([]);

  constructor() {
    effect(() => {
      if (this.authService.currentUser()) {
        this.refresh();
      } else {
        this.balance.set(0);
        this.transactions.set([]);
      }
    });
  }

  refresh(): void {
    const userId = this.authService.currentUser()?._id;
    if (!userId) return;
    this.http.get<{ success: boolean; coins: number; transactions: CoinTransaction[]; birthdayReward?: { amount: number } }>(`${BASE}/me`, { params: { userId } }).subscribe({
      next: (res) => {
        if (res.success) {
          this.balance.set(res.coins);
          this.transactions.set(res.transactions);
          if (res.birthdayReward) {
            this.toastService.success(`🎂 Chúc mừng sinh nhật! Luméa tặng bạn ${res.birthdayReward.amount} xu.`);
          }
        }
      },
      error: () => { /* không đăng nhập hoặc backend không phản hồi — giữ số dư đã biết gần nhất */ },
    });
  }

  /** Idempotent: gọi lại nhiều lần với cùng refId sẽ không cộng xu thêm lần thứ hai. */
  async claim(reason: CoinRewardReason, refId: string): Promise<CoinClaimResult> {
    const userId = this.authService.currentUser()?._id;
    if (!userId) throw new Error('Vui lòng đăng nhập để nhận xu.');
    const res = await firstValueFrom(this.http.post<CoinClaimResult>(`${BASE}/claim`, { userId, reason, refId }));
    this.balance.set(res.coins);
    this.refresh();
    return res;
  }
}
