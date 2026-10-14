import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';

/** Chờ một nhịp sau khi vào trang để hero kịp hiện trước khi popup che lên. */
const OPEN_DELAY_MS = 1200;
const CLOSE_ANIMATION_MS = 250;
/** Chỉ hiện 1 lần mỗi phiên trình duyệt. */
const SEEN_KEY = 'lumea_poster_popup_seen';

@Component({
  selector: 'app-poster-popup',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './poster-popup.component.html',
  styleUrl: './poster-popup.component.css'
})
export class PosterPopupComponent implements OnInit, OnDestroy {
  readonly image = 'assets/campaign/popup-poster.jpg';
  readonly link = '/catalog';

  readonly visible = signal(false);
  readonly closing = signal(false);

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.hasSeen()) return;
    this.openTimer = setTimeout(() => {
      this.visible.set(true);
      document.body.style.overflow = 'hidden';
      this.markSeen();
    }, OPEN_DELAY_MS);
  }

  ngOnDestroy(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.visible()) document.body.style.overflow = '';
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
