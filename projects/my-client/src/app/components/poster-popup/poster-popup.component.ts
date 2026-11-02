import { Component, DestroyRef, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { timeout } from 'rxjs';
import { AppIconComponent } from '../icon/icon.component';
import { BannerService } from '../../core/services/banner.service';

interface PopupBanner {
  title: string;
  imageUrl: string;
  link: string;
}

/** Chờ một nhịp sau khi vào trang để hero kịp hiện trước khi popup che lên. */
const OPEN_DELAY_MS = 1200;
const CLOSE_ANIMATION_MS = 250;
/** Server chậm thì không để popup bật lên muộn lúc khách đã đọc trang. */
const LOAD_TIMEOUT_MS = 5000;
/** Lưu ảnh đã xem trong phiên trình duyệt: cùng ảnh chỉ hiện 1 lần, admin đổi ảnh thì hiện lại. */
const SEEN_KEY = 'lumea_poster_popup_seen';
/** Dùng khi admin chưa tạo popup hoặc không gọi được server. */
const DEFAULT_POPUP: PopupBanner = {
  title: 'Minimalist Furniture — Luméa',
  imageUrl: 'assets/campaign/popup-poster.jpg',
  link: '/catalog',
};

@Component({
  selector: 'app-poster-popup',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './poster-popup.component.html',
  styleUrl: './poster-popup.component.css'
})
export class PosterPopupComponent implements OnInit, OnDestroy {
  private bannerService = inject(BannerService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly popup = signal<PopupBanner>(DEFAULT_POPUP);

  readonly visible = signal(false);
  readonly closing = signal(false);

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.bannerService.loaded$
      .pipe(timeout(LOAD_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: banners => {
          const o = banners['popup-home'];
          if (o?.active === false) return;
          this.scheduleOpen({
            title: o?.title || DEFAULT_POPUP.title,
            imageUrl: o?.imageUrl || DEFAULT_POPUP.imageUrl,
            link: o?.ctaLink || DEFAULT_POPUP.link,
          });
        },
        error: () => this.scheduleOpen(DEFAULT_POPUP),
      });
  }

  ngOnDestroy(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.visible()) document.body.style.overflow = '';
  }

  private scheduleOpen(popup: PopupBanner): void {
    if (this.hasSeen(popup.imageUrl)) return;
    this.popup.set(popup);
    this.openTimer = setTimeout(() => {
      this.visible.set(true);
      document.body.style.overflow = 'hidden';
      this.markSeen(popup.imageUrl);
    }, OPEN_DELAY_MS);
  }

  /** navigateByUrl thay vì routerLink để link admin nhập có thể kèm query (vd. /catalog?style=Modern). */
  openLink(event: Event): void {
    event.preventDefault();
    this.close();
    this.router.navigateByUrl(this.popup().link);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) this.close();
  }

  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.closeTimer = setTimeout(() => {
      this.visible.set(false);
      this.closing.set(false);
      document.body.style.overflow = '';
    }, CLOSE_ANIMATION_MS);
  }

  private hasSeen(imageUrl: string): boolean {
    try {
      return sessionStorage.getItem(SEEN_KEY) === imageUrl;
    } catch {
      return false;
    }
  }

  private markSeen(imageUrl: string): void {
    try {
      sessionStorage.setItem(SEEN_KEY, imageUrl);
    } catch {
      /* bỏ qua khi trình duyệt chặn storage */
    }
  }
}
