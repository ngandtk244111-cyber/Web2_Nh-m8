import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartFlyService {
  /** Bay ảnh sản phẩm từ vị trí `sourceEl` tới icon giỏ hàng trên header, rồi "bump" icon giỏ hàng. */
  flyToCart(imageUrl: string, sourceEl: HTMLElement): void {
    const cartIcon = document.getElementById('cart-icon-btn');
    if (!cartIcon || typeof document === 'undefined') return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const clone = document.createElement('img');
    clone.src = imageUrl;
    clone.className = 'fly-to-cart-clone';
    clone.style.left = `${sourceRect.left}px`;
    clone.style.top = `${sourceRect.top}px`;
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    clone.style.opacity = '1';
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clone.style.left = `${cartRect.left + cartRect.width / 2 - 14}px`;
        clone.style.top = `${cartRect.top + cartRect.height / 2 - 14}px`;
        clone.style.width = '28px';
        clone.style.height = '28px';
        clone.style.opacity = '0.4';
        clone.style.borderRadius = '999px';
      });
    });

    setTimeout(() => {
      clone.remove();
      cartIcon.classList.add('cart-bump');
      setTimeout(() => cartIcon.classList.remove('cart-bump'), 500);
    }, 700);
  }
}
