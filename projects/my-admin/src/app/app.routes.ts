import { Routes } from '@angular/router';
import { adminAuthGuard, permissionGuard } from './core/guards/admin-auth.guard';

/** Mỗi chức năng là 1 route riêng trong layout (như app.routes của Vita); data.perm khớp quyền server. */
export const routes: Routes = [
  {
    path: 'login',
    data: { title: 'Đăng nhập' },
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [adminAuthGuard],
    canActivateChild: [permissionGuard],
    loadComponent: () => import('./layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard', data: { title: 'Tổng quan' },
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // Đơn hàng & sản xuất
      {
        path: 'orders', data: { title: 'Đơn hàng', perm: 'orders.view' },
        loadComponent: () => import('./pages/orders/order-list.component').then(m => m.OrderListComponent),
      },
      {
        path: 'orders/:orderNumber', data: { title: 'Chi tiết đơn hàng', perm: 'orders.view' },
        loadComponent: () => import('./pages/orders/order-detail.component').then(m => m.OrderDetailComponent),
      },
      {
        path: 'custom-requests', data: { title: 'Yêu cầu in 3D', perm: 'custom3d.view' },
        loadComponent: () => import('./pages/custom-requests/custom-request-list.component').then(m => m.CustomRequestListComponent),
      },
      {
        path: 'custom-requests/:id', data: { title: 'Chi tiết yêu cầu in 3D', perm: 'custom3d.view' },
        loadComponent: () => import('./pages/custom-requests/custom-request-detail.component').then(m => m.CustomRequestDetailComponent),
      },
      {
        path: 'returns', data: { title: 'Đổi trả & hoàn tiền', perm: 'orders.view' },
        loadComponent: () => import('./pages/returns/returns.component').then(m => m.ReturnsComponent),
      },
      {
        path: 'warranty', data: { title: 'Bảo hành', perm: 'orders.view' },
        loadComponent: () => import('./pages/warranty/warranty.component').then(m => m.WarrantyComponent),
      },

      // Sản phẩm & kho
      {
        path: 'products', data: { title: 'Sản phẩm', perm: 'products.view' },
        loadComponent: () => import('./pages/products/product-list.component').then(m => m.ProductListComponent),
      },
      {
        path: 'products/create', data: { title: 'Thêm sản phẩm', perm: 'products.create' },
        loadComponent: () => import('./pages/products/product-form.component').then(m => m.ProductFormComponent),
      },
      {
        path: 'products/edit/:id', data: { title: 'Sửa sản phẩm', perm: 'products.view' },
        loadComponent: () => import('./pages/products/product-form.component').then(m => m.ProductFormComponent),
      },
      {
        path: 'categories', data: { title: 'Danh mục', perm: 'products.view' },
        loadComponent: () => import('./pages/categories/categories.component').then(m => m.CategoriesComponent),
      },
      {
        path: 'inventory', data: { title: 'Tồn kho', perm: 'inventory.view' },
        loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
      },
      {
        path: 'workshops', data: { title: 'Xưởng sản xuất', perm: 'inventory.view' },
        loadComponent: () => import('./pages/workshops/workshops.component').then(m => m.WorkshopsComponent),
      },
      // Link cũ (bookmark) của trang Nhà cung cấp.
      { path: 'suppliers', redirectTo: 'workshops', pathMatch: 'full' },

      // Khách hàng & CSKH
      {
        path: 'customers', data: { title: 'Khách hàng', perm: 'customers.view' },
        loadComponent: () => import('./pages/customers/customer-list.component').then(m => m.CustomerListComponent),
      },
      {
        path: 'customers/:phone', data: { title: 'Chi tiết khách hàng', perm: 'customers.view' },
        loadComponent: () => import('./pages/customers/customer-detail.component').then(m => m.CustomerDetailComponent),
      },
      {
        path: 'messages', data: { title: 'Tin nhắn hỗ trợ', perm: 'customers.view' },
        loadComponent: () => import('./pages/messages/messages.component').then(m => m.MessagesComponent),
      },
      {
        path: 'reviews', data: { title: 'Đánh giá', perm: 'customers.view' },
        loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
      },

      // Marketing & nội dung
      {
        path: 'promotions', data: { title: 'Khuyến mãi', perm: 'marketing.view' },
        loadComponent: () => import('./pages/promotions/promotions.component').then(m => m.PromotionsComponent),
      },
      {
        path: 'banners', data: { title: 'Banner trang chủ', perm: 'marketing.view' },
        loadComponent: () => import('./pages/banners/banners.component').then(m => m.BannersComponent),
      },
      {
        path: 'articles', data: { title: 'Tin tức', perm: 'content.view' },
        loadComponent: () => import('./pages/articles/article-list.component').then(m => m.ArticleListComponent),
      },
      {
        path: 'articles/create', data: { title: 'Viết bài', perm: 'content.create' },
        loadComponent: () => import('./pages/articles/article-form.component').then(m => m.ArticleFormComponent),
      },
      {
        path: 'articles/edit/:id', data: { title: 'Sửa bài viết', perm: 'content.view' },
        loadComponent: () => import('./pages/articles/article-form.component').then(m => m.ArticleFormComponent),
      },
      {
        path: 'videos', data: { title: 'Video', perm: 'content.view' },
        loadComponent: () => import('./pages/videos/videos.component').then(m => m.VideosComponent),
      },
      {
        path: 'style-quiz', data: { title: 'Trắc nghiệm phong cách', perm: 'content.view' },
        loadComponent: () => import('./pages/style-quiz/style-quiz.component').then(m => m.StyleQuizComponent),
      },
      {
        path: 'community', data: { title: 'Cộng đồng', perm: 'content.view' },
        loadComponent: () => import('./pages/community/community.component').then(m => m.CommunityComponent),
      },
      {
        path: 'rooms', data: { title: 'Phòng mẫu 3D', perm: 'content.view' },
        loadComponent: () => import('./pages/rooms/rooms.component').then(m => m.RoomsComponent),
      },

      // Hệ thống
      {
        path: 'staff', data: { title: 'Nhân viên', perm: 'staff.view' },
        loadComponent: () => import('./pages/staff/staff.component').then(m => m.StaffComponent),
      },
      {
        path: 'roles', data: { title: 'Phân quyền', perm: 'staff.view' },
        loadComponent: () => import('./pages/roles/roles.component').then(m => m.RolesComponent),
      },
      {
        path: 'settings', data: { title: 'Cài đặt', perm: 'settings.view' },
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'audit-log', data: { title: 'Nhật ký hoạt động', perm: 'settings.view' },
        loadComponent: () => import('./pages/audit-log/audit-log.component').then(m => m.AuditLogComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
