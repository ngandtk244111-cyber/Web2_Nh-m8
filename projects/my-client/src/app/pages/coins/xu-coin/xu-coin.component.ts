import { Component, Input } from '@angular/core';

/** Đồng Xu Luméa vàng (chữ L) — dùng chung cho trang /xu và các trò chơi nhận xu. */
@Component({
  selector: 'app-xu-coin',
  standalone: true,
  template: `<span class="xc" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.5">L</span>`,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .xc {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: radial-gradient(circle at 32% 28%, #FFF3B8 0%, #F9D35C 38%, #EBAA2C 72%, #C9861A 100%);
      box-shadow: inset 0 0 0 2px rgba(201, 134, 26, 0.55), inset 0 -2px 3px rgba(150, 90, 10, 0.35), 0 2px 5px rgba(150, 90, 10, 0.25);
      color: #A56A0E;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 1px 0 rgba(255, 243, 184, 0.9);
      user-select: none;
    }
  `],
})
export class XuCoinComponent {
  @Input() size = 24;
}
