import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../icon/icon.component';

type SlotIndex = 0 | 1 | 2;
type SlotStatus = 'Sắp diễn ra' | 'Đang diễn ra' | 'Đã kết thúc';

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

  constructor(private productService: ProductService, private router: Router) {}

  ngOnInit(): void {
    this.tickTimer = setInterval(() => this.now.set(new Date()), 1000);
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

  goToProduct(p: Product, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/product', p.slug]);
  }

  scrollPrev(): void {
    this.dealsTrack?.nativeElement.scrollBy({ left: -400, behavior: 'smooth' });
  }

  scrollNext(): void {
    this.dealsTrack?.nativeElement.scrollBy({ left: 400, behavior: 'smooth' });
  }
}
