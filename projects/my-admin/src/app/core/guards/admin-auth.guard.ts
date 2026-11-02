import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * Chặn vào dashboard nếu chưa đăng nhập — tham khảo admin-auth.guard.ts của AuraPC-main
 * (functional guard + redirect '/login'). Token do server kiểm tra ở mỗi request; hết hạn thì
 * admin-auth.interceptor.ts đưa về trang đăng nhập.
 */
export const adminAuthGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (adminAuth.currentAdmin()) return true;

  router.navigate(['/login']);
  return false;
};
