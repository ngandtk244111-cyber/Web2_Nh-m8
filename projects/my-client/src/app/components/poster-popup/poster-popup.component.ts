import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

export interface PopupPoster {
  image: string;
  alt: string;
  link: string;
  queryParams?: Record<string, string>;
}

/** Chờ một nhịp sau khi vào trang để trang kịp hiện trước khi popup che lên. */
const OPEN_DELAY_MS = 1200;
const CLOSE_ANIMATION_MS = 250;
const AUTO_SLIDE_MS = 4000;
/** Chỉ hiện 1 lần mỗi phiên trình duyệt. */
const SEEN_KEY = 'lumea_poster_popup_seen';

/** Popup thông báo ưu đãi khi vừa vào web: lật qua các poster (tự chuyển, có mũi tên + chấm), bấm poster để mở trang. */
@Component({
  selector: 'app-poster-popup',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './poster-popup.component.html',
  styleUrl: './poster-popup.component.css'
})
export class PosterPopupComponent implements OnInit, OnDestroy {
  readonly posters: PopupPoster[] = [
    { image: 'assets/promo-cards/xa-kho.jpg', alt: 'Xả kho giá sốc — nhà xinh khỏi lo giá', link: '/catalog', queryParams: { sale: '1' } },
    { image: 'assets/promo-cards/deal-thang-11.jpg', alt: 'Tháng 11 — Deal xịn mỗi ngày, nhà xinh quá', link: '/flash-sale' },
    { image: 'assets/promo-cards/phong-3d.jpg', alt: 'Khám phá Phòng 3D — giảm ngay đến 40%', link: '/shop-the-room' },
    { image: 'assets/promo-cards/tham-quan-phong-3d.jpg', alt: 'Tham quan phòng 3D — ngắm trước, mua sau, chạm vào món đồ để mua', link: '/shop-the-room' },
  ];

  readonly visible = signal(false);
  readonly closing = signal(false);
  readonly active = signal(0);

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private slideTimer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private touchX: number | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (this.hasSeen()) return;
    this.openTimer = setTimeout(() => {
      this.visible.set(true);
      document.body.style.overflow = 'hidden';
      this.markSeen();
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        this.slideTimer = setInterval(() => {
          if (!this.paused && !document.hidden) this.step(1);
        }, AUTO_SLIDE_MS);
      }
    }, OPEN_DELAY_MS);
  }

  ngOnDestroy(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.stopSlides();
    if (this.visible()) document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) this.close();
  }

  @HostListener('document:keydown.arrowleft')
  onPrev(): void {
    if (this.visible()) this.step(-1);
  }

  @HostListener('document:keydown.arrowright')
  onNext(): void {
    if (this.visible()) this.step(1);
  }

  step(dir: number): void {
    const n = this.posters.length;
    this.active.set((this.active() + dir + n) % n);
  }

  go(i: number): void {
    this.active.set(i);
  }

  pause(on: boolean): void {
    this.paused = on;
  }

  open(p: PopupPoster): void {
    this.close();
    this.router.navigate([p.link], { queryParams: p.queryParams });
  }

  onTouchStart(e: TouchEvent): void {
    this.touchX = e.touches[0].clientX;
    this.paused = true;
  }

  onTouchEnd(e: TouchEvent): void {
    if (this.touchX !== null) {
      const dx = e.changedTouches[0].clientX - this.touchX;
      if (Math.abs(dx) > 40) this.step(dx < 0 ? 1 : -1);
    }
    this.touchX = null;
    this.paused = false;
  }

  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.stopSlides();
    this.closeTimer = setTimeout(() => {
      this.visible.set(false);
      this.closing.set(false);
      document.body.style.overflow = '';
    }, CLOSE_ANIMATION_MS);
  }

  private stopSlides(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
    this.slideTimer = null;
  }

  private hasSeen(): boolean {
    try {
      return sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }

  private markSeen(): void {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* bỏ qua khi trình duyệt chặn storage */
    }
  }
}
