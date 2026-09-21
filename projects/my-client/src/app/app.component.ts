import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { CartDrawerComponent } from './components/cart-drawer/cart-drawer.component';
import { AiModalComponent } from './components/ai-modal/ai-modal.component';
import { LoginModalComponent } from './components/login-modal/login-modal.component';
import { SupportChatWidgetComponent } from './components/support-chat-widget/support-chat-widget.component';
import { ToastComponent } from './components/toast/toast.component';
import { ProductQuickViewComponent } from './components/product-quick-view/product-quick-view.component';
import { FloatingSideBannersComponent } from './components/floating-side-banners/floating-side-banners.component';
import { FloatingMascotComponent } from './components/floating-mascot/floating-mascot.component';
import { FloatingCoinWidgetComponent } from './components/floating-coin-widget/floating-coin-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    CartDrawerComponent,
    AiModalComponent,
    LoginModalComponent,
    SupportChatWidgetComponent,
    ToastComponent,
    ProductQuickViewComponent,
    FloatingSideBannersComponent,
    FloatingMascotComponent,
    FloatingCoinWidgetComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Luméa - Nền Tảng TMĐT Decor & In 3D Độc Bản';

  /** Hiệu ứng chuyển trang: fade-out ngắn khi bắt đầu điều hướng, fade-in khi route mới sẵn sàng. */
  readonly routeLeaving = signal(false);

  constructor(router: Router) {
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.routeLeaving.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        setTimeout(() => this.routeLeaving.set(false), 120);
      }
    });
  }
}
