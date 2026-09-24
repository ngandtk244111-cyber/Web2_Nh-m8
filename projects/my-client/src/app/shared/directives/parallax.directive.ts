import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';

/**
 * Parallax nhẹ theo cuộn trang: ghi độ lệch (px) vào biến CSS --py của phần tử,
 * CSS của component tự quyết định dùng --py thế nào (transform, background-position...).
 * Chạy ngoài Angular zone + requestAnimationFrame để không kích hoạt change detection mỗi lần cuộn.
 */
@Directive({
  selector: '[appParallax]',
  standalone: true,
})
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  /** Tỉ lệ lệch so với quãng cuộn — số dương: phần tử trôi chậm hơn nội dung. */
  @Input('appParallax') speed = 0.12;
  /** Giới hạn độ lệch tối đa (px) để ảnh không lộ mép. */
  @Input() parallaxMax = 40;

  private frame: number | null = null;
  private readonly onScroll = () => {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  };

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
    this.update();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }

  private update(): void {
    const el = this.el.nativeElement;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.bottom < 0 || rect.top > vh) return;

    // 0 khi tâm phần tử nằm giữa màn hình, âm/dương khi ở trên/dưới
    const offset = (rect.top + rect.height / 2 - vh / 2) * -this.speed;
    const clamped = Math.max(-this.parallaxMax, Math.min(this.parallaxMax, offset));
    el.style.setProperty('--py', `${clamped.toFixed(1)}px`);
  }
}
