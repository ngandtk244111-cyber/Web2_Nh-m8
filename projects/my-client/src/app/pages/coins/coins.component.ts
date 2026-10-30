import { AfterViewInit, Component, HostListener, OnDestroy, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VoucherService, couponToVoucher } from '../../core/services/voucher.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { ToastService } from '../../core/services/toast.service';
import { VoucherGameKey } from '../../core/models/voucher.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VoucherCardComponent } from '../../components/voucher-card/voucher-card.component';
import { LuckyWheelComponent } from './games/lucky-wheel/lucky-wheel.component';
import { MemoryGameComponent } from './games/memory-game/memory-game.component';
import { GiftBoxComponent } from './games/gift-box/gift-box.component';

interface GameInfo {
  key: VoucherGameKey;
  title: string;
  desc: string;
  reward: string;
  theme: string;
}

/** Hiển thị khi chưa đăng nhập — khớp WHEEL_PRIZES ở server/routes/voucherRoutes.js. */
const DEFAULT_WHEEL_PRIZES = ['10K', '5%', '20K', '15%', '10K', '50K', '8%', '100K'];
const BANNER_INTERVAL_MS = 5000;

const GAMES: GameInfo[] = [
  { key: 'MEMORY', title: 'Lật Thẻ Nhận Voucher', desc: 'Ghép 8 cặp món decor, càng ít lượt voucher càng lớn.', reward: 'Giảm 10K – 10%', theme: 'memory' },
  { key: 'WHEEL', title: 'Vòng Quay May Mắn', desc: 'Quay là trúng voucher — độc đắc giảm 100K.', reward: 'Giảm 10K – 100K', theme: 'wheel' },
  { key: 'GIFT_BOX', title: 'Hộp Quà Bí Ẩn', desc: 'Chọn 1 trong 3 hộp quà, bên trong là voucher giảm giá.', reward: 'Giảm 10K – 10%', theme: 'gift' },
];

/**
 * Trang "Voucher Luméa" (route /voucher, /xu cũ tự chuyển hướng): thay cho Túi Xu. Khách thỉnh thoảng mới vào
 * web nội thất nên không cần điểm danh/tích xu hằng ngày — chỉ giữ trò chơi nhận voucher dùng ngay.
 */
@Component({
  selector: 'app-coins',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppIconComponent,
    VoucherCardComponent,
    LuckyWheelComponent,
    MemoryGameComponent,
    GiftBoxComponent,
  ],
  templateUrl: './coins.component.html',
  styleUrl: './coins.component.css'
})
export class CoinsComponent implements AfterViewInit, OnDestroy {
  readonly games = GAMES;
  readonly activeGame = signal<VoucherGameKey | null>(null);
  readonly bannerIndex = signal(0);

  private bannerTimer: ReturnType<typeof setInterval> | null = null;

  readonly isLoggedIn = computed(() => !!this.authService.currentUser());
  readonly rewards = computed(() => this.voucherService.rewards());
  readonly wheelPrizes = computed(() => this.rewards()?.prizes.WHEEL ?? DEFAULT_WHEEL_PRIZES);
  /** Mã công khai của shop (vd ưu đãi thành viên mới) — ai cũng dùng được. */
  readonly shopVouchers = computed(() => this.cartService.shopCoupons().map(couponToVoucher));

  constructor(
    public voucherService: VoucherService,
    public authService: AuthService,
    private loginModalService: LoginModalService,
    private toastService: ToastService,
    private cartService: CartService,
  ) {
    this.cartService.loadShopCoupons();
    // Tải lượt chơi mỗi khi đăng nhập (kể cả đăng nhập ngay trên trang này)
    effect(() => {
      if (this.authService.currentUser()) {
        this.voucherService.loadRewards();
        this.voucherService.refresh();
      }
    });
  }

  ngAfterViewInit(): void {
    this.startBannerTimer();
  }

  ngOnDestroy(): void {
    if (this.bannerTimer) clearInterval(this.bannerTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeGame();
  }

  playsLeft(key: VoucherGameKey): number {
    return this.rewards()?.games[key]?.playsLeft ?? 0;
  }

  dailyLimit(key: VoucherGameKey): number {
    return this.rewards()?.games[key]?.dailyLimit ?? 1;
  }

  openGame(key: VoucherGameKey): void {
    if (!this.isLoggedIn()) {
      this.loginModalService.open();
      return;
    }
    this.activeGame.set(key);
  }

  closeGame(): void {
    this.activeGame.set(null);
  }

  gameTitle(key: VoucherGameKey | null): string {
    return this.games.find(g => g.key === key)?.title ?? '';
  }

  onGameRewarded(title: string): void {
    this.toastService.success(`Đã lưu voucher "${title}" vào tài khoản — dùng ngay ở giỏ hàng nhé!`);
  }

  setBanner(index: number): void {
    this.bannerIndex.set(index);
    this.startBannerTimer();
  }

  login(): void {
    this.loginModalService.open();
  }

  private startBannerTimer(): void {
    if (this.bannerTimer) clearInterval(this.bannerTimer);
    this.bannerTimer = setInterval(() => this.bannerIndex.update(i => (i + 1) % this.games.length), BANNER_INTERVAL_MS);
  }
}
