import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'catalog',
    loadComponent: () => import('./pages/catalog/catalog.component').then(m => m.CatalogComponent),
  },
  {
    path: 'product/:slug',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  },
  {
    path: 'customizer-3d',
    loadComponent: () => import('./pages/customizer-3d/customizer-3d.component').then(m => m.Customizer3dComponent),
  },
  {
    path: 'shop-the-room',
    loadComponent: () => import('./pages/shop-the-room/shop-the-room.component').then(m => m.ShopTheRoomComponent),
  },
  {
    path: 'custom-request',
    loadComponent: () => import('./pages/custom-request/custom-request-list/custom-request-list.component').then(m => m.CustomRequestListComponent),
  },
  {
    path: 'custom-request/new',
    loadComponent: () => import('./pages/custom-request/custom-request-new/custom-request-new.component').then(m => m.CustomRequestNewComponent),
  },
  {
    path: 'custom-request/:id',
    loadComponent: () => import('./pages/custom-request/custom-request-detail/custom-request-detail.component').then(m => m.CustomRequestDetailComponent),
  },
  {
    path: 'community',
    loadComponent: () => import('./pages/community/community.component').then(m => m.CommunityComponent),
  },
  {
    path: 'style-quiz',
    loadComponent: () => import('./pages/style-quiz/style-quiz.component').then(m => m.StyleQuizComponent),
  },
  {
    path: 'news',
    loadComponent: () => import('./pages/news/news.component').then(m => m.NewsComponent),
  },
  {
    path: 'news/:slug',
    loadComponent: () => import('./pages/news/news.component').then(m => m.NewsComponent),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
  },
  {
    path: 'favorites',
    loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesComponent),
  },
  {
    path: 'chinh-sach/:slug',
    loadComponent: () => import('./pages/policy/policy.component').then(m => m.PolicyComponent),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/cart-checkout/checkout.component').then(m => m.CheckoutComponent),
  },
  {
    path: 'checkout-momo-return',
    loadComponent: () => import('./pages/checkout-momo-return/checkout-momo-return.component').then(m => m.CheckoutMomoReturnComponent),
  },
  {
    path: 'checkout-zalopay-return',
    loadComponent: () => import('./pages/checkout-zalopay-return/checkout-zalopay-return.component').then(m => m.CheckoutZalopayReturnComponent),
  },
  {
    path: 'orders/track',
    loadComponent: () => import('./pages/order-tracking/order-tracking.component').then(m => m.OrderTrackingComponent),
  },
  {
    path: 'warranty-lookup',
    loadComponent: () => import('./pages/warranty-lookup/warranty-lookup.component').then(m => m.WarrantyLookupComponent),
  },
  {
    path: 'account',
    loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent),
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  }
];
