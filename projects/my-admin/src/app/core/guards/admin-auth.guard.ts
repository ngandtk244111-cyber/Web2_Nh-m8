import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * Chặn vào dashboard nếu chưa đăng nhập — tham khảo admin-auth.guard.ts của AuraPC-main
 * (functional guard + redirect '/login'), nhưng chỉ kiểm tra signal cục bộ (không verify token
 * với server) vì Lam-a-main không dùng token cho admin, đúng mức bảo mật "tin id client gửi lên"
 * đã áp dụng xuyên suốt project.
 */
export const adminAuthGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (adminAuth.currentAdmin()) return true;

  router.navigate(['/login']);
  return false;
};
