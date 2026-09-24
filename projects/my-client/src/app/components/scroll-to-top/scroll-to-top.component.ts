import { Component, HostListener, OnDestroy, signal } from '@angular/core';

/** Ngưỡng cuộn (px) để hiện nút lên đầu trang. */
const SHOW_AFTER_PX = 400;
/** Thời gian mũi tên nhấp nháy trước khi bắt đầu cuộn lên. */
const BLINK_MS = 450;

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  templateUrl: './scroll-to-top.component.html',
  styleUrl: './scroll-to-top.component.css'
})
export class ScrollToTopComponent implements OnDestroy {
  readonly visible = signal(false);
  readonly blinking = signal(false);

  private blinkTimer?: ReturnType<typeof setTimeout>;

  @HostListener('window:scroll')
  onScroll(): void {
    this.visible.set(window.scrollY > SHOW_AFTER_PX);
  }

  scrollToTop(): void {
    if (this.blinking()) return;
    this.blinking.set(true);
    this.blinkTimer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.blinking.set(false);
    }, BLINK_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.blinkTimer);
  }
}
