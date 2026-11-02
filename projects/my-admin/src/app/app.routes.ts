import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/guards/admin-auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  // Mỗi tab có URL riêng (/orders, /products...) để tải lại trang không về Dashboard.
  {
    path: ':tab',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./pages/dashboard/admin.component').then(m => m.AdminComponent),
  },
  { path: '**', redirectTo: '' },
];
