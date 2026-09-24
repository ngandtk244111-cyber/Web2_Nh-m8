import { Component, OnDestroy, OnInit, computed, effect, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { QuickViewService } from '../../core/services/quick-view.service';
import { ToastService } from '../../core/services/toast.service';
import { MascotService } from '../../core/services/mascot.service';
import { FlashSaleService, FlashSlot, FlashSlotStatus } from '../../core/services/flash-sale.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

type TabKey = 'live' | 'upcoming' | 'low' | 'all';
type StockState = 'plenty' | 'hot' | 'low' | 'soldout';

interface DealVM {
  product: Product;
  slot: FlashSlot;
  discount: number;
  left: number;
  soldPct: number;
  state: StockState;
}

interface NavLink {
  label: string;
  link: string;
  queryParams?: Record<string, string>;
}

interface RoomCard {
  key: string;
  title: string;
  image: string;
  link: string;
  queryParams?: Record<string, string>;
  /** Danh mục sản phẩm dùng để đếm số deal của phòng (Product chưa có field "room"). */
  categories: string[];
  size: 'large' | 'small';
}

/** Điều hướng bằng đúng route/query đang có: /catalog?category=…, /shop-the-room, /customizer-3d. */
const CATEGORY_LINKS: NavLink[] = [
  { label: 'Decor bàn', link: '/catalog', queryParams: { category: 'tray' } },
  { label: 'Decor phòng', link: '/shop-the-room' },
  { label: 'Đèn', link: '/catalog', queryParams: { category: 'lamp' } },
  { label: 'Mô hình', link: '/catalog', queryParams: { category: 'sculpture' } },
  { label: 'Phụ kiện', link: '/catalog', queryParams: { category: 'organizer' } },
  { label: '3D Custom', link: '/customizer-3d' },
];

const ROOMS: RoomCard[] = [
  {
    key: 'desk', title: 'Desk Setup', size: 'large',
    image: 'https://images.unsplash.com/photo-1486946255434-2466348c2166?auto=format&fit=crop&w=1200&q=80',
    link: '/catalog', queryParams: { category: 'organizer' },
    categories: ['organizer', 'tray', 'lamp', 'clock'],
  },
  {
    key: 'bedroom', title: 'Bedroom', size: 'small',
    image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=900&q=80',
    link: '/catalog', queryParams: { category: 'lamp' },
    categories: ['lamp', 'plant_pot', 'candle_holder', 'clock'],
  },
  {
    key: 'living', title: 'Living Room', size: 'small',
    image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80',
    link: '/shop-the-room',
    categories: ['vase', 'frame', 'side_table', 'stool', 'sculpture'],
  },
  {
    key: 'study', title: 'Study Corner', size: 'large',
    image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1200&q=80',
    link: '/catalog', queryParams: { category: 'bookshelf' },
    categories: ['bookshelf', 'organizer', 'sculpture', 'plant_pot'],
  },
];

const DISCOVER: (NavLink & { image: string })[] = [
  { label: 'Decor bàn học', image: 'decor-ban', link: '/catalog', queryParams: { category: 'organizer' } },
  { label: 'Decor phòng ngủ', image: 'khong-gian', link: '/catalog', queryParams: { category: 'lamp' } },
  { label: 'Miniature', image: 'tuong-mo-hinh', link: '/catalog', queryParams: { category: 'sculpture' } },
  { label: 'Đèn', image: 'den-chieu-sang', link: '/catalog', queryParams: { category: 'lamp' } },
  { label: 'Cây & chậu', image: 'chau-cay', link: '/catalog', queryParams: { category: 'plant_pot' } },
  { label: '3D Custom', image: '3d-custom', link: '/customizer-3d' },
];

@Component({
  selector: 'app-flash-sale',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe, ScrollRevealDirective],
  templateUrl: './flash-sale.component.html',
  styleUrl: './flash-sale.component.css'
})
export class FlashSaleComponent implements OnInit, OnDestroy {
  readonly categoryLinks = CATEGORY_LINKS;
  readonly discover = DISCOVER;

  readonly userTab = signal<TabKey | null>(null);
  readonly bestDealMode = signal(false);

  constructor(
    public flash: FlashSaleService,
    private productService: ProductService,
    private cartService: CartService,
    private quickViewService: QuickViewService,
    private toastService: ToastService,
    private mascotService: MascotService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    // Khung đã đặt nhắc vừa chuyển "sắp diễn ra" -> "đang diễn ra" lúc người dùng còn ở trang → báo ngay.
    effect(() => {
      const slots = this.flash.slots();
      untracked(() => {
        for (const s of slots) {
          const key = this.notificationService.flashSaleKey(new Date(s.start));
          if (this.prevStatus.get(key) === 'upcoming' && s.status === 'live'
              && this.notificationService.isFlashSaleReminded(key)) {
            this.notificationService.announceFlashSaleStarted();
            this.mascotService.react('surprised', 3200);
          }
          this.prevStatus.set(key, s.status);
        }
      });
    });
  }

  private prevStatus = new Map<string, FlashSlotStatus>();
  get reminderBusy() { return this.notificationService.reminderBusy; }

  ngOnInit(): void {
    this.flash.acquire();
  }

  ngOnDestroy(): void {
    this.flash.release();
  }

  // ---------- Dữ liệu deal (render 100% từ ProductService: flashSaleSlot + originalPrice + inStock) ----------

  /**
   * FALLBACK: model chưa có field "đã bán"/"tổng kho". Ước lượng số đã bán ≈ reviewCount
   * (số đánh giá) và tổng kho ≈ reviewCount + inStock → % đã bán. Khi backend có field sold
   * thật thì chỉ cần thay công thức ở đây.
   */
  private stateOf(p: Product): { soldPct: number; state: StockState } {
    if (p.inStock <= 0) return { soldPct: 100, state: 'soldout' };
    const soldPct = Math.min(99, Math.round((p.reviewCount / (p.reviewCount + p.inStock)) * 100));
    if (p.inStock <= 10 || soldPct >= 88) return { soldPct, state: 'low' };
    if (soldPct >= 60) return { soldPct, state: 'hot' };
    return { soldPct, state: 'plenty' };
  }

  readonly deals = computed<DealVM[]>(() => {
    const slots = this.flash.slots();
    return this.productService.products()
      .filter(p => p.flashSaleSlot != null && !!p.originalPrice && p.originalPrice > p.basePrice)
      .map(p => {
        const slot = slots[p.flashSaleSlot as number];
        const { soldPct, state } = this.stateOf(p);
        return {
          product: p,
          slot,
          discount: Math.round(((p.originalPrice! - p.basePrice) / p.originalPrice!) * 100),
          left: Math.max(0, p.inStock),
          soldPct,
          state,
        };
      });
  });

  readonly activeDeals = computed(() =>
    this.deals().filter(d => d.slot.status !== 'ended')
      .sort((a, b) => (a.slot.status === 'live' ? 0 : 1) - (b.slot.status === 'live' ? 0 : 1) || a.slot.index - b.slot.index)
  );

  readonly liveDeals = computed(() => this.activeDeals().filter(d => d.slot.status === 'live'));
  readonly upcomingDeals = computed(() => this.activeDeals().filter(d => d.slot.status === 'upcoming'));
  readonly lowDeals = computed(() => this.activeDeals().filter(d => d.state === 'low'));

  readonly maxDiscount = computed(() => this.activeDeals().reduce((m, d) => Math.max(m, d.discount), 0));

  readonly tab = computed<TabKey>(() =>
    this.userTab() ?? (this.liveDeals().length > 0 ? 'live' : 'upcoming')
  );

  readonly visibleDeals = computed<DealVM[]>(() => {
    let list: DealVM[];
    switch (this.tab()) {
      case 'live': list = this.liveDeals(); break;
      case 'upcoming': list = this.upcomingDeals(); break;
      case 'low': list = this.lowDeals(); break;
      default: list = this.activeDeals();
    }
    return this.bestDealMode() ? [...list].sort((a, b) => b.discount - a.discount) : list;
  });

  readonly tabs = computed(() => [
    { key: 'live' as TabKey, label: 'Đang diễn ra', count: this.liveDeals().length },
    { key: 'upcoming' as TabKey, label: 'Sắp diễn ra', count: this.upcomingDeals().length },
    { key: 'low' as TabKey, label: 'Sắp hết', count: this.lowDeals().length },
    { key: 'all' as TabKey, label: 'Tất cả deal', count: this.activeDeals().length },
  ]);

  /** Hero/countdown: đang có khung live thì đếm tới lúc kết thúc, không thì đếm tới khung kế tiếp. */
  readonly heroState = computed(() => {
    const live = this.flash.liveSlot();
    if (live) return { kind: 'live' as const, target: live.end };
    const next = this.flash.nextSlot();
    const todayEnded = this.flash.slots()[0].status === 'ended';
    return next ? { kind: 'next' as const, target: next.start, todayEnded } : null;
  });

  readonly almostSoldOut = computed(() =>
    this.activeDeals()
      .filter(d => d.state === 'low' || (d.state === 'hot' && d.soldPct >= 75))
      .sort((a, b) => b.soldPct - a.soldPct)
      .slice(0, 8)
  );

  readonly featured = computed<DealVM | null>(() => {
    const pool = this.activeDeals().filter(d => d.state !== 'soldout');
    const live = pool.filter(d => d.slot.status === 'live');
    const list = live.length ? live : pool;
    return list.length ? [...list].sort((a, b) => b.discount - a.discount)[0] : null;
  });

  readonly nextSlots = computed(() =>
    this.flash.slots().filter(s => s.status === 'upcoming').map(slot => {
      const products = this.deals().filter(d => d.slot.index === slot.index).map(d => d.product);
      return {
        slot,
        count: products.length,
        thumbs: products.slice(0, 3).map(p => p.images[0]),
        categories: [...new Set(products.map(p => p.categoryName))].slice(0, 3),
      };
    })
  );

  readonly rooms = computed(() =>
    ROOMS.map(r => ({
      ...r,
      dealCount: this.activeDeals().filter(d => r.categories.includes(d.product.category)).length,
    }))
  );

  // ---------- Tương tác ----------

  setTab(key: TabKey): void {
    this.userTab.set(key);
    this.bestDealMode.set(false);
  }

  bestDeal(): void {
    this.userTab.set('all');
    this.bestDealMode.set(true);
    this.scrollTo('fs-deals');
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Nhắc hẹn: deal chưa diễn ra không cho xem/mua, chỉ được "Nhận thông báo" ----------

  isReminded(slot: FlashSlot): boolean {
    return this.notificationService.isFlashSaleReminded(this.notificationService.flashSaleKey(new Date(slot.start)));
  }

  toggleReminder(slot: FlashSlot, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.notificationService.toggleFlashSaleReminder(new Date(slot.start), new Date(slot.end));
  }

  canBuy(d: DealVM): boolean {
    return d.slot.status === 'live' && d.state !== 'soldout';
  }

  private qtyInCart(productId: string): number {
    return this.cartService.items()
      .filter(i => i.product.id === productId && !i.selectedCustomization)
      .reduce((s, i) => s + i.quantity, 0);
  }

  addToCart(d: DealVM): void {
    if (!this.canBuy(d)) return;
    // CartService chưa chặn theo tồn kho → chặn ở UI: tổng trong giỏ không vượt inStock.
    if (this.qtyInCart(d.product.id) >= d.product.inStock) {
      this.toastService.info(`Bạn đã có tối đa số lượng còn lại của "${d.product.name}" trong giỏ`);
      return;
    }
    this.cartService.addToCart(d.product, 1);
    this.toastService.success(`Đã thêm "${d.product.name}" vào giỏ hàng`);
    this.mascotService.react('happy');
  }

  buyNow(d: DealVM): void {
    if (!this.canBuy(d)) return;
    if (this.qtyInCart(d.product.id) < d.product.inStock) {
      this.cartService.addToCart(d.product, 1);
    }
    const item = this.cartService.items().find(i => i.product.id === d.product.id && !i.selectedCustomization);
    if (item) this.cartService.setCheckoutSelection([item.id]);
    this.router.navigate(['/checkout']);
  }

  quickView(d: DealVM): void {
    this.quickViewService.open(d.product);
  }

  stateLabel(d: DealVM): string {
    switch (d.state) {
      case 'soldout': return 'Sold out';
      case 'low': return 'Sắp hết';
      case 'hot': return 'Đang được săn';
      default: return 'Còn nhiều';
    }
  }

  trackDeal(_: number, d: DealVM): string {
    return d.product.id;
  }
}
