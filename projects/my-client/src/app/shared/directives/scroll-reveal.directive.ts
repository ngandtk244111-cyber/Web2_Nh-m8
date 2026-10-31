import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';

/** 'stagger': đặt trên lưới/hàng — các phần tử con hiện lần lượt, ảnh bên trong "in" dần từ dưới lên
 *  theo từng lớp như máy in 3D (CSS trong styles.css). */
/** 'rise': trồi lên chậm (~1s) kèm phóng nhẹ — dùng cho poster/banner lớn, đặt riêng từng thẻ + revealDelay. */
export type ScrollRevealVariant = 'up' | 'left' | 'right' | 'scale' | 'stagger' | 'rise';

/**
 * Thêm class reveal-* (định nghĩa trong styles.css) rồi bật .visible khi phần tử
 * lọt vào viewport — kỹ thuật IntersectionObserver tham khảo từ AuraPC-main.
 */
@Directive({
  selector: '[appScrollReveal]',
  standalone: true,
})
export class ScrollRevealDirective implements AfterViewInit, OnDestroy {
  @Input('appScrollReveal') variant: ScrollRevealVariant = 'up';
  @Input() revealDelay = 0;

  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const el = this.el.nativeElement;
    el.classList.add(`reveal-${this.variant}`);
    if (this.revealDelay > 0) {
      // 'rise' chạy bằng animation -> độ trễ qua biến CSS, không đụng transition (hover) của thẻ.
      if (this.variant === 'rise') el.style.setProperty('--rd', `${this.revealDelay}ms`);
      else el.style.transitionDelay = `${this.revealDelay}ms`;
    }

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('visible');
            this.observer?.unobserve(el);
          }
        }
      },
      // 'rise' đợi thẻ lộ ra nhiều hơn mới chạy, để người xem thấy rõ lúc nó hiện lên khi cuộn xuống.
      { threshold: this.variant === 'rise' ? 0.25 : 0.15, rootMargin: this.variant === 'rise' ? '0px 0px -80px 0px' : '0px 0px -40px 0px' }
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
