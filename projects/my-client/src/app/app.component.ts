import { Component, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { CartDrawerComponent } from './components/cart-drawer/cart-drawer.component';
import { AiModalComponent } from './components/ai-modal/ai-modal.component';
import { LoginModalComponent } from './components/login-modal/login-modal.component';
import { SupportChatWidgetComponent } from './components/support-chat-widget/support-chat-widget.component';
import { ToastComponent } from './components/toast/toast.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ProductQuickViewComponent } from './components/product-quick-view/product-quick-view.component';
import { FloatingSideBannersComponent } from './components/floating-side-banners/floating-side-banners.component';
import { FloatingMascotComponent } from './components/floating-mascot/floating-mascot.component';
import { FloatingCoinWidgetComponent } from './components/floating-coin-widget/floating-coin-widget.component';
import { ScrollToTopComponent } from './components/scroll-to-top/scroll-to-top.component';

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
    ConfirmDialogComponent,
    ProductQuickViewComponent,
    FloatingSideBannersComponent,
    FloatingMascotComponent,
    FloatingCoinWidgetComponent,
    ScrollToTopComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Luméa - Nội Thất, Decor & 3D Custom';

  /** Hiệu ứng chuyển trang: fade-out ngắn khi bắt đầu điều hướng, fade-in khi route mới sẵn sàng. */
  readonly routeLeaving = signal(false);

  /** Route có data.bare (phòng xem 3D mở ở tab riêng): ẩn header, footer và các widget nổi. */
  readonly bare = signal(false);

  constructor(router: Router) {
    router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.bare.set(this.isBareRoute(router.routerState.snapshot.root));
      }
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

  private isBareRoute(route: ActivatedRouteSnapshot): boolean {
    let r: ActivatedRouteSnapshot | null = route;
    while (r) {
      if (r.data?.['bare']) return true;
      r = r.firstChild;
    }
    return false;
  }
}
