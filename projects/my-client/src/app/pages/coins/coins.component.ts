import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CoinService } from '../../core/services/coin.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { CoinGameKey } from '../../core/models/coin.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { XuCoinComponent } from './xu-coin/xu-coin.component';
import { LuckyWheelComponent } from './games/lucky-wheel/lucky-wheel.component';
import { MemoryGameComponent } from './games/memory-game/memory-game.component';
import { GiftBoxComponent } from './games/gift-box/gift-box.component';

type CheckinDayState = 'claimed' | 'today' | 'upcoming';

interface GameInfo {
  key: CoinGameKey;
  title: string;
  desc: string;
  reward: string;
  theme: string;
}

/** Hiển thị khi chưa đăng nhập — khớp CHECKIN_SCHEDULE ở server. */
const DEFAULT_SCHEDULE = [100, 100, 100, 100, 100, 100, 300];
const DEFAULT_WHEEL_PRIZES = [10, 50, 20, 200, 10, 100, 30, 20];
const BANNER_INTERVAL_MS = 5000;
const FEED_SIZE = 16;

const GAMES: GameInfo[] = [
  { key: 'WHEEL', title: 'Vòng Quay May Mắn', desc: 'Quay là trúng — độc đắc 200 xu mỗi lượt.', reward: '10 – 200 xu', theme: 'wheel' },
  { key: 'MEMORY', title: 'Lật Thẻ Decor', desc: 'Ghép 8 cặp món decor, càng ít lượt càng nhiều xu.', reward: '20 – 80 xu', theme: 'memory' },
  { key: 'GIFT_BOX', title: 'Hộp Quà Bí Ẩn', desc: 'Chọn 1 trong 3 hộp quà, mỗi ngày một lần.', reward: '10 – 150 xu', theme: 'gift' },
];

@Component({
  selector: 'app-coins',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppIconComponent,
    ProductCardComponent,
    XuCoinComponent,
    LuckyWheelComponent,
    MemoryGameComponent,
    GiftBoxComponent,
  ],
  templateUrl: './coins.component.html',
  styleUrl: './coins.component.css'
})
export class CoinsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('feed') feedRef?: ElementRef<HTMLElement>;
  @ViewChild('history') historyRef?: ElementRef<HTMLElement>;

  readonly games = GAMES;
  readonly activeGame = signal<CoinGameKey | null>(null);
  readonly bannerIndex = signal(0);
  readonly checkingIn = signal(false);
  readonly historyExpanded = signal(false);
  readonly feedProgress = signal(0);
  readonly feedInView = signal(false);
  readonly rewardPop = signal<{ amount: number; label: string } | null>(null);

  private browseClaiming = false;
  private bannerTimer: ReturnType<typeof setInterval> | null = null;
  private popTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isLoggedIn = computed(() => !!this.authService.currentUser());
  readonly rewards = computed(() => this.coinService.rewards());

  readonly checkinDays = computed(() => {
    const r = this.rewards();
    const schedule = r?.checkin.schedule ?? DEFAULT_SCHEDULE;
    const streakDay = r?.checkin.streakDay ?? 1;
    const claimedToday = r?.checkin.claimedToday ?? false;
    return schedule.map((amount, i) => {
      const day = i + 1;
      let state: CheckinDayState = 'upcoming';
      if (day < streakDay || (day === streakDay && claimedToday)) state = 'claimed';
      else if (day === streakDay) state = 'today';
      return { day, amount, state, isToday: day === streakDay, isBig: day === schedule.length };
    });
  });

  readonly todayCheckinAmount = computed(() => {
    const today = this.checkinDays().find(d => d.isToday);
    return today?.amount ?? DEFAULT_SCHEDULE[0];
  });

  readonly claimedToday = computed(() => this.rewards()?.checkin.claimedToday ?? false);

  readonly wheelPrizes = computed(() => this.rewards()?.prizes.WHEEL ?? DEFAULT_WHEEL_PRIZES);

  /** Tổng xu nhận được trong ngày (giờ Việt Nam) — tính từ lịch sử giao dịch. */
  readonly earnedToday = computed(() => {
    const today = this.vnDateKey(new Date());
    return this.coinService.transactions()
      .filter(t => this.vnDateKey(new Date(t.createdAt)) === today)
      .reduce((sum, t) => sum + t.amount, 0);
  });

  readonly visibleHistory = computed(() => {
    const list = this.coinService.transactions();
    return this.historyExpanded() ? list : list.slice(0, 6);
  });

  readonly feedProducts = computed(() => this.productService.products().slice(0, FEED_SIZE));

  readonly browseClaimed = computed(() => this.rewards()?.browse.claimedToday ?? false);
  readonly browseAmount = computed(() => this.rewards()?.browse.amount ?? 100);

  constructor(
    public coinService: CoinService,
    public authService: AuthService,
    private loginModalService: LoginModalService,
    private productService: ProductService,
    private toastService: ToastService,
    private zone: NgZone,
  ) {
    // Tải trạng thái điểm danh/lượt chơi mỗi khi đăng nhập (kể cả đăng nhập ngay trên trang này)
    effect(() => {
      if (this.authService.currentUser()) this.coinService.loadRewards();
    });
  }

  ngAfterViewInit(): void {
    this.bannerTimer = setInterval(() => this.bannerIndex.update(i => (i + 1) % this.games.length), BANNER_INTERVAL_MS);
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
    this.onScroll();
  }

  ngOnDestroy(): void {
    if (this.bannerTimer) clearInterval(this.bannerTimer);
    if (this.popTimer) clearTimeout(this.popTimer);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeGame();
  }

  // ===== Điểm danh =====

  async checkIn(): Promise<void> {
    if (!this.requireLogin() || this.checkingIn() || this.claimedToday()) return;
    this.checkingIn.set(true);
    try {
      const res = await this.coinService.checkIn();
      this.showRewardPop(res.amount, `Điểm danh ngày ${res.streakDay}/7`);
    } catch (err: any) {
      this.toastService.error(err.message);
    } finally {
      this.checkingIn.set(false);
    }
  }

  // ===== Trò chơi =====

  playsLeft(key: CoinGameKey): number {
    return this.rewards()?.games[key]?.playsLeft ?? 0;
  }

  dailyLimit(key: CoinGameKey): number {
    return this.rewards()?.games[key]?.dailyLimit ?? (key === 'GIFT_BOX' ? 1 : 3);
  }

  openGame(key: CoinGameKey): void {
    if (!this.requireLogin()) return;
    this.activeGame.set(key);
  }

  closeGame(): void {
    this.activeGame.set(null);
  }

  gameTitle(key: CoinGameKey | null): string {
    return this.games.find(g => g.key === key)?.title ?? '';
  }

  onGameRewarded(amount: number): void {
    this.toastService.success(`+${amount} xu đã được cộng vào ví của bạn`);
  }

  setBanner(index: number): void {
    this.bannerIndex.set(index);
    // bấm chấm thì đặt lại chu kỳ tự chạy
    if (this.bannerTimer) clearInterval(this.bannerTimer);
    this.bannerTimer = setInterval(() => this.bannerIndex.update(i => (i + 1) % this.games.length), BANNER_INTERVAL_MS);
  }

  // ===== Lướt gợi ý nhận xu =====

  scrollToFeed(): void {
    this.feedRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToHistory(): void {
    if (!this.requireLogin()) return;
    this.historyRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Chạy ngoài Angular zone — chỉ vào zone khi % tiến độ thực sự đổi. */
  private readonly onScroll = () => {
    const el = this.feedRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const inView = rect.top < vh && rect.bottom > 0;
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / Math.max(rect.height, 1)));
    const rounded = Math.round(progress * 100) / 100;

    if (rounded !== this.feedProgress() || inView !== this.feedInView()) {
      this.zone.run(() => {
        this.feedProgress.set(rounded);
        this.feedInView.set(inView);
        if (rounded >= 0.98) this.claimBrowse();
      });
    }
  };

  private async claimBrowse(): Promise<void> {
    if (this.browseClaiming || this.browseClaimed() || !this.isLoggedIn() || !this.rewards()) return;
    this.browseClaiming = true;
    try {
      const res = await this.coinService.claimBrowse();
      this.showRewardPop(res.amount, 'Lướt gợi ý sản phẩm');
    } catch {
      /* đã nhận ở tab khác — loadRewards() trong service đã đồng bộ lại trạng thái */
    } finally {
      this.browseClaiming = false;
    }
  }

  // ===== Tiện ích =====

  login(): void {
    this.loginModalService.open();
  }

  private requireLogin(): boolean {
    if (this.isLoggedIn()) return true;
    this.loginModalService.open();
    return false;
  }

  private showRewardPop(amount: number, label: string): void {
    this.rewardPop.set({ amount, label });
    if (this.popTimer) clearTimeout(this.popTimer);
    this.popTimer = setTimeout(() => this.rewardPop.set(null), 2200);
  }

  private vnDateKey(date: Date): string {
    return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}
