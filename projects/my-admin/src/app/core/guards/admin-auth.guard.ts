import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';
import { ToastService } from '../services/toast.service';


export const adminAuthGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!adminAuth.currentAdmin()) return router.createUrlTree(['/login']);
  if (adminAuth.permissions()) return true;

  return adminAuth.loadAccess().pipe(
    map(() => true),
    catchError(err => {
      if (err?.status === 401) return of(router.createUrlTree(['/login']));
      toast.error('Không tải được quyền của tài khoản từ server');
      return of(true);
    })
  );
};

/** Route con khai báo data.perm (vd 'orders.view'): không có quyền thì về Tổng quan. */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const perm = route.data['perm'] as string | undefined;
  const adminAuth = inject(AdminAuthService);
  if (!perm || adminAuth.can(perm)) return true;
  inject(ToastService).warning('Bạn không có quyền xem mục này');
  return inject(Router).createUrlTree(['/dashboard']);
};
