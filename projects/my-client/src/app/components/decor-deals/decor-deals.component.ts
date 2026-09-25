import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../icon/icon.component';
import { MascotService } from '../../core/services/mascot.service';
import { NotificationService } from '../../core/services/notification.service';

type SlotIndex = 0 | 1 | 2;
type SlotStatus = 'Sắp diễn ra' | 'Đang diễn ra' | 'Đã kết thúc';
type StockState = 'upcoming' | 'plenty' | 'hot' | 'low' | 'soldout';

interface StockInfo {
  left: number;
  soldPct: number;
  state: StockState;
}

interface CountdownState {
  label: string;
  hours: number;
  minutes: number;
  seconds: number;
  ended: boolean;
}

/** Khung giờ Flash Sale cố định mỗi ngày (giờ Việt Nam, UTC+7 — trùng múi giờ trình duyệt của người dùng VN). */
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 22;

@Component({
  selector: 'app-decor-deals',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './decor-deals.component.html',
  styleUrl: './decor-deals.component.css'
})
export class DecorDealsComponent implements OnInit, OnDestroy {
  @ViewChild('dealsTrack') dealsTrack?: ElementRef<HTMLElement>;

  /** Tab người dùng chọn thủ công; nếu slot này đã kết thúc, displaySlot() sẽ tự trôi sang slot kế tiếp. */
  readonly activeSlot = signal<SlotIndex>(0);

  /** Tick mỗi giây — mọi computed() phụ thuộc "now" tự cập nhật realtime, kể cả ngay sau reload. */
  readonly now = signal(new Date());
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private productService: ProductService,
    private router: Router,
    private mascotService: MascotService,
    private notificationService: NotificationService
  ) {}

  /** Trạng thái lần tick trước theo khóa ngày — để bắt đúng thời điểm 1 khung chuyển Sắp diễn ra -> Đang diễn ra. */
  private prevStatusByKey = new Map<string, SlotStatus>();

  ngOnInit(): void {
    this.prevStatusByKey = this.snapshotStatuses();
    this.tickTimer = setInterval(() => {
      this.now.set(new Date());
      this.checkDealStarted();
    }, 1000);
    // Báo mascot 1 lần khi trang có Flash Sale đang diễn ra ngay lúc mount — không lặp lại mỗi giây.
    if (this.activeSlotStatus() === 'Đang diễn ra') {
      this.mascotService.react('surprised', 3200);
    }
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  private slotDateFor(index: SlotIndex, now: Date): Date {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + index);
    return d;
  }

  private statusOf(slotDate: Date, now: Date): SlotStatus {
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const slotDateOnly = slotDate.getTime();

    if (nowDateOnly < slotDateOnly) return 'Sắp diễn ra';
    if (nowDateOnly > slotDateOnly) return 'Đã kết thúc';

    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < SLOT_START_HOUR * 60) return 'Sắp diễn ra';
    if (nowMin >= SLOT_END_HOUR * 60) return 'Đã kết thúc';
    return 'Đang diễn ra';
  }

  readonly slotDates = computed<[Date, Date, Date]>(() => {
    const now = this.now();
    return [this.slotDateFor(0, now), this.slotDateFor(1, now), this.slotDateFor(2, now)];
  });

  readonly slotLabels = computed<[string, string, string]>(() =>
    this.slotDates().map(d => `${SLOT_START_HOUR}:00 - ${SLOT_END_HOUR}:00, ${d.getDate()}/${d.getMonth() + 1}`) as [string, string, string]
  );

  readonly slotStatuses = computed<[SlotStatus, SlotStatus, SlotStatus]>(() => {
    const now = this.now();
    return this.slotDates().map(d => this.statusOf(d, now)) as [SlotStatus, SlotStatus, SlotStatus];
  });

  /** Slot thật sự hiển thị: giống activeSlot, trừ khi slot đó đã kết thúc -> tự trôi sang slot kế tiếp chưa kết thúc. */
  readonly displaySlot = computed<SlotIndex>(() => {
    const statuses = this.slotStatuses();
    const chosen = this.activeSlot();
    if (statuses[chosen] !== 'Đã kết thúc') return chosen;
    const next = statuses.findIndex(s => s !== 'Đã kết thúc');
    return (next === -1 ? 2 : next) as SlotIndex;
  });

  readonly activeSlotStatus = computed<SlotStatus>(() => this.slotStatuses()[this.displaySlot()]);

  /** Khóa YYYY-MM-DD (giờ địa phương) của từng khung — dùng làm khóa nhắc hẹn lưu trên server. */
  readonly slotKeys = computed<[string, string, string]>(() =>
    this.slotDates().map(d => this.notificationService.flashSaleKey(d)) as [string, string, string]
  );

  /** Chỉ khi deal đang diễn ra mới hiện nút "Chọn mua"; chưa tới giờ thì hiện nút đặt nhắc (vẫn bấm vào thẻ để xem giá gốc). */
  readonly canViewProducts = computed(() => this.activeSlotStatus() === 'Đang diễn ra');

  readonly isReminded = computed(() =>
    this.notificationService.isFlashSaleReminded(this.slotKeys()[this.displaySlot()])
  );

  get reminderBusy() { return this.notificationService.reminderBusy; }

  readonly countdown = computed<CountdownState>(() => {
    const now = this.now();
    const slotDate = this.slotDates()[this.displaySlot()];
    const status = this.activeSlotStatus();

    let target: Date;
    let label: string;
    if (status === 'Sắp diễn ra') {
      target = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), SLOT_START_HOUR, 0, 0, 0);
      label = 'Bắt đầu sau';
    } else if (status === 'Đang diễn ra') {
      target = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), SLOT_END_HOUR, 0, 0, 0);
      label = 'Kết thúc sau';
    } else {
      return { label: 'Đã kết thúc', hours: 0, minutes: 0, seconds: 0, ended: true };
    }

    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) {
      return { label: 'Đã kết thúc', hours: 0, minutes: 0, seconds: 0, ended: true };
    }

    return {
      label,
      hours: Math.floor(diffMs / 3_600_000),
      minutes: Math.floor((diffMs % 3_600_000) / 60_000),
      seconds: Math.floor((diffMs % 60_000) / 1000),
      ended: false,
    };
  });

  /** Sản phẩm Flash Sale thật của đúng slot (ngày) đang hiển thị — dữ liệu backend (flashSaleSlot + originalPrice). */
  readonly dealProducts = computed<Product[]>(() => {
    const slot = this.displaySlot();
    return this.productService.products().filter(p =>
      p.flashSaleSlot === slot && !!p.originalPrice && p.originalPrice > p.basePrice
    );
  });

  setActiveSlot(index: number): void {
    this.activeSlot.set(index as SlotIndex);
    this.dealsTrack?.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
  }

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /** Khi "Sắp diễn ra": che các chữ số bằng x, giữ nguyên dấu chấm nghìn (90.000 -> xx.000). */
  private obscurePrice(value: number): string {
    const raw = Math.round(value).toString();
    const grouped: string[] = [];
    for (let i = raw.length; i > 0; i -= 3) grouped.unshift(raw.slice(Math.max(0, i - 3), i));
    const segments = grouped.join('.').split('.');
    const last = segments[segments.length - 1];
    const toX = (s: string) => 'x'.repeat(s.length);
    if (last === '000' && segments.length > 1) {
      return [...segments.slice(0, -1).map(toX), '000'].join('.');
    }
    return segments.map(toX).join('.');
  }

  priceDisplay(p: Product): string {
    if (this.activeSlotStatus() === 'Sắp diễn ra') return this.obscurePrice(p.basePrice) + 'đ';
    return p.basePrice.toLocaleString('vi-VN') + 'đ';
  }

  discountTag(p: Product): string {
    if (this.activeSlotStatus() === 'Sắp diễn ra') return 'xx%';
    if (p.originalPrice && p.originalPrice > p.basePrice) {
      const pct = Math.round(((p.originalPrice - p.basePrice) / p.originalPrice) * 100);
      return `-${pct}%`;
    }
    return '';
  }

  /**
   * Suất còn lại + % đã bán (chỉ tính khi khung giờ đang diễn ra) — cùng công thức fallback với trang /flash-sale
   * (đã bán ≈ reviewCount, tổng suất ≈ reviewCount + inStock) để 2 nơi hiển thị khớp nhau.
   */
  stockInfo(p: Product): StockInfo {
    const left = Math.max(0, p.inStock);
    // Chưa mở bán thì chưa ai mua được → luôn là "còn đủ suất", không có sắp hết / hết suất.
    if (this.activeSlotStatus() === 'Sắp diễn ra') return { left, soldPct: 0, state: 'upcoming' };
    if (left === 0) return { left, soldPct: 100, state: 'soldout' };
    const soldPct = Math.min(99, Math.round((p.reviewCount / (p.reviewCount + left)) * 100));
    if (left <= 10 || soldPct >= 88) return { left, soldPct, state: 'low' };
    if (soldPct >= 60) return { left, soldPct, state: 'hot' };
    return { left, soldPct, state: 'plenty' };
  }

  goToProduct(p: Product, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/product', p.slug]);
  }

  /** Đặt/hủy nhắc "Flash Sale bắt đầu" cho khung đang hiển thị (logic dùng chung ở NotificationService). */
  toggleReminder(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.activeSlotStatus() !== 'Sắp diễn ra') return;
    const d = this.slotDates()[this.displaySlot()];
    this.notificationService.toggleFlashSaleReminder(
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), SLOT_START_HOUR),
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), SLOT_END_HOUR)
    );
  }

  private snapshotStatuses(): Map<string, SlotStatus> {
    const keys = this.slotKeys();
    const statuses = this.slotStatuses();
    return new Map(keys.map((k, i) => [k, statuses[i]] as [string, SlotStatus]));
  }

  /** Khi 1 khung đã đặt nhắc vừa chuyển sang "Đang diễn ra" lúc người dùng còn ở trang -> báo ngay + nạp lại thông báo. */
  private checkDealStarted(): void {
    const current = this.snapshotStatuses();
    current.forEach((status, key) => {
      if (this.prevStatusByKey.get(key) === 'Sắp diễn ra' && status === 'Đang diễn ra'
          && this.notificationService.isFlashSaleReminded(key)) {
        this.notificationService.announceFlashSaleStarted();
        this.mascotService.react('surprised', 3200);
      }
    });
    this.prevStatusByKey = current;
  }

  scrollPrev(): void {
    this.dealsTrack?.nativeElement.scrollBy({ left: -400, behavior: 'smooth' });
  }

  scrollNext(): void {
    this.dealsTrack?.nativeElement.scrollBy({ left: 400, behavior: 'smooth' });
  }
}
