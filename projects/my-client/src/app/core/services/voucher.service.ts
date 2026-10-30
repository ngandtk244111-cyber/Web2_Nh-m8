import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { UserVoucher, VoucherGameKey, VoucherGamePlayResult, VoucherRewardsState } from '../models/voucher.model';
import { Coupon } from '../models/cart.model';

const BASE = `${environment.apiUrl}/vouchers`;

/** Voucher còn dùng được: chưa dùng và chưa hết hạn. */
export function isVoucherUsable(v: UserVoucher, now = Date.now()): boolean {
  return !v.usedAt && new Date(v.expiresAt).getTime() > now;
}

/** Số tiền giảm của voucher/coupon cho subtotal — 0 nếu chưa đủ điều kiện (khớp voucherDiscount ở server). */
export function voucherDiscount(
  v: { discountPercent: number; discountAmount?: number; maxDiscount: number; minSpend: number } | null,
  subtotal: number
): number {
  if (!v || subtotal < (v.minSpend || 0)) return 0;
  if (v.discountAmount) return Math.min(v.discountAmount, subtotal);
  const calc = Math.round((subtotal * (v.discountPercent || 0)) / 100);
  return v.maxDiscount ? Math.min(calc, v.maxDiscount) : calc;
}

/** Quy mã công khai của shop (Coupon) về dạng UserVoucher để hiển thị chung bằng VoucherCard. */
export function couponToVoucher(c: Coupon): UserVoucher {
  const cap = c.maxDiscount ? ` · Tối đa ${c.maxDiscount.toLocaleString('vi-VN')}đ` : '';
  return {
    _id: c.code,
    code: c.code,
    title: c.title || `Giảm ${c.discountPercent}%`,
    description: c.description || ((c.minSpend ? `Đơn từ ${c.minSpend.toLocaleString('vi-VN')}đ` : 'Mọi đơn hàng') + cap),
    discountPercent: c.discountPercent,
    discountAmount: c.discountAmount || 0,
    maxDiscount: c.maxDiscount,
    minSpend: c.minSpend,
    source: 'SHOP',
    // Mã công khai không có hạn riêng — đặt xa để thẻ hiển thị còn hiệu lực.
    expiresAt: '2099-12-31T00:00:00.000Z',
    usedAt: null,
    usedOrderNumber: null,
    createdAt: '',
  };
}

/**
 * Voucher cá nhân của khách (thay cho Xu Luméa): danh sách voucher, trò chơi nhận voucher
 * và phần thưởng hoạt động (trắc nghiệm phong cách...). Mọi mệnh giá do server quyết định.
 */
@Injectable({ providedIn: 'root' })
export class VoucherService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  readonly vouchers = signal<UserVoucher[]>([]);
  /** Lượt chơi còn lại + nhãn ô vòng quay — null khi chưa đăng nhập/chưa tải. */
  readonly rewards = signal<VoucherRewardsState | null>(null);

  readonly usable = computed(() => this.vouchers().filter(v => isVoucherUsable(v)));
  /** Voucher đã dùng hoặc đã hết hạn — hiển thị ở mục lịch sử. */
  readonly history = computed(() => this.vouchers().filter(v => !isVoucherUsable(v)));

  constructor() {
    effect(() => {
      if (this.authService.currentUser()) {
        this.refresh();
      } else {
        this.vouchers.set([]);
        this.rewards.set(null);
      }
    });
  }

  private requireUserId(): string {
    const userId = this.authService.currentUser()?._id;
    if (!userId) throw new Error('Vui lòng đăng nhập để nhận voucher.');
    return userId;
  }

  /** Lỗi từ server (409 đã nhận, 429 hết lượt...) mang sẵn thông điệp tiếng Việt trong error.error. */
  private errorMessage(err: any): string {
    return err?.error?.error || err?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
  }

  refresh(): void {
    const userId = this.authService.currentUser()?._id;
    if (!userId) return;
    this.http.get<{ success: boolean; vouchers: UserVoucher[]; birthdayVoucher?: UserVoucher }>(`${BASE}/me`, { params: { userId } }).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.vouchers.set(res.vouchers);
        if (res.birthdayVoucher) {
          this.toastService.success(`🎂 Chúc mừng sinh nhật! Luméa tặng bạn voucher ${res.birthdayVoucher.title}.`);
        }
      },
      error: () => { /* chưa đăng nhập hoặc backend không phản hồi — giữ danh sách đã biết */ },
    });
  }

  loadRewards(): void {
    const userId = this.authService.currentUser()?._id;
    if (!userId) return;
    this.http.get<{ success: boolean } & VoucherRewardsState>(`${BASE}/rewards`, { params: { userId } }).subscribe({
      next: (res) => {
        if (res.success) this.rewards.set(res);
      },
      error: () => { /* giữ trạng thái cũ */ },
    });
  }

  private async post<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
    const userId = this.requireUserId();
    try {
      return await firstValueFrom(this.http.post<T>(url, { userId, ...body }));
    } catch (err) {
      throw new Error(this.errorMessage(err));
    } finally {
      // Đồng bộ lại danh sách voucher + lượt còn lại, kể cả khi server từ chối (VD đã nhận ở tab khác).
      this.refresh();
      this.loadRewards();
    }
  }

  playGame(game: VoucherGameKey, result: { moves?: number; seconds?: number } = {}): Promise<VoucherGamePlayResult> {
    return this.post<VoucherGamePlayResult>(`${BASE}/games/${game.toLowerCase()}/play`, result);
  }

  /** Idempotent: gọi lại với cùng refId không phát thêm voucher. */
  claim(reason: 'STYLE_QUIZ', refId: string): Promise<{ success: boolean; alreadyApplied: boolean; voucher: UserVoucher | null }> {
    return this.post(`${BASE}/claim`, { reason, refId });
  }
}
