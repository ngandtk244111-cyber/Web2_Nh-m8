import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { CoinClaimResult, CoinGameKey, CoinGamePlayResult, CoinRewardReason, CoinRewardsState, CoinTransaction } from '../models/coin.model';

const BASE = `${environment.apiUrl}/coins`;

@Injectable({ providedIn: 'root' })
export class CoinService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  readonly balance = signal<number>(0);
  readonly transactions = signal<CoinTransaction[]>([]);
  /** Trạng thái trang /xu (điểm danh, lượt chơi còn lại...) — null khi chưa đăng nhập/chưa tải. */
  readonly rewards = signal<CoinRewardsState | null>(null);

  constructor() {
    effect(() => {
      if (this.authService.currentUser()) {
        this.refresh();
      } else {
        this.balance.set(0);
        this.transactions.set([]);
        this.rewards.set(null);
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

  // ===== Trang "Ưu đãi Luméa Xu" — mọi mức thưởng do server quyết định =====

  private requireUserId(): string {
    const userId = this.authService.currentUser()?._id;
    if (!userId) throw new Error('Vui lòng đăng nhập để nhận xu.');
    return userId;
  }

  /** Lỗi từ server (409 đã nhận, 429 hết lượt...) mang sẵn thông điệp tiếng Việt trong error.error. */
  private errorMessage(err: any): string {
    return err?.error?.error || err?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
  }

  loadRewards(): void {
    const userId = this.authService.currentUser()?._id;
    if (!userId) return;
    this.http.get<{ success: boolean } & CoinRewardsState>(`${BASE}/rewards`, { params: { userId } }).subscribe({
      next: (res) => {
        if (res.success) this.rewards.set(res);
      },
      error: () => { /* giữ trạng thái cũ */ },
    });
  }

  private async post<T extends { coins: number }>(url: string, body: Record<string, unknown> = {}): Promise<T> {
    const userId = this.requireUserId();
    try {
      const res = await firstValueFrom(this.http.post<T>(url, { userId, ...body }));
      this.balance.set(res.coins);
      return res;
    } catch (err) {
      throw new Error(this.errorMessage(err));
    } finally {
      // Đồng bộ lại lịch sử + lượt còn lại, kể cả khi server từ chối (VD đã nhận ở tab khác).
      this.refresh();
      this.loadRewards();
    }
  }

  checkIn(): Promise<{ amount: number; coins: number; streakDay: number }> {
    return this.post(`${BASE}/checkin`);
  }

  claimBrowse(): Promise<{ amount: number; coins: number }> {
    return this.post(`${BASE}/browse`);
  }

  playGame(game: CoinGameKey, result: { moves?: number; seconds?: number } = {}): Promise<CoinGamePlayResult> {
    return this.post<CoinGamePlayResult>(`${BASE}/games/${game.toLowerCase()}/play`, result);
  }
}
