import { Injectable, computed, signal } from '@angular/core';

export type FlashSlotStatus = 'live' | 'upcoming' | 'ended';

export interface FlashSlot {
  /** 0/1/2 = hôm nay / ngày mai / ngày kia — khớp Product.flashSaleSlot. */
  index: 0 | 1 | 2;
  start: number;
  end: number;
  status: FlashSlotStatus;
}

export interface CountdownParts {
  h: string;
  m: string;
  s: string;
  done: boolean;
}

/** Khung giờ Flash Sale cố định mỗi ngày (giờ trình duyệt) — cùng quy ước với DecorDealsComponent. */
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 22;

/**
 * Trạng thái khung Flash Sale + đồng hồ dùng chung cho trang Flash Sale.
 * Đồng hồ chỉ chạy khi có ít nhất 1 màn hình gọi acquire() (release() khi rời trang).
 */
@Injectable({ providedIn: 'root' })
export class FlashSaleService {
  private readonly nowSignal = signal(Date.now());
  readonly now = this.nowSignal.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private refs = 0;

  readonly slots = computed<FlashSlot[]>(() => {
    const now = this.nowSignal();
    const d = new Date(now);
    return ([0, 1, 2] as const).map(index => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + index, SLOT_START_HOUR).getTime();
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + index, SLOT_END_HOUR).getTime();
      const status: FlashSlotStatus = now < start ? 'upcoming' : now >= end ? 'ended' : 'live';
      return { index, start, end, status };
    });
  });

  readonly liveSlot = computed(() => this.slots().find(s => s.status === 'live') ?? null);
  readonly nextSlot = computed(() => this.slots().find(s => s.status === 'upcoming') ?? null);

  acquire(): void {
    this.refs++;
    if (!this.timer) {
      this.nowSignal.set(Date.now());
      this.timer = setInterval(() => this.nowSignal.set(Date.now()), 1000);
    }
  }

  release(): void {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Đếm ngược tới mốc `target` (ms). Không bao giờ trả số âm — về 0 thì done = true. */
  countdown(target: number): CountdownParts {
    const left = Math.max(0, target - this.nowSignal());
    const totalSec = Math.floor(left / 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      h: pad(Math.floor(totalSec / 3600)),
      m: pad(Math.floor((totalSec % 3600) / 60)),
      s: pad(totalSec % 60),
      done: left <= 0,
    };
  }
}
