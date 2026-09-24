import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';

/** 'stagger': đặt trên lưới/hàng — các phần tử con hiện lần lượt, ảnh bên trong "in" dần từ dưới lên
 *  theo từng lớp như máy in 3D (CSS trong styles.css). */
export type ScrollRevealVariant = 'up' | 'left' | 'right' | 'scale' | 'stagger';

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
      el.style.transitionDelay = `${this.revealDelay}ms`;
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
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
