import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';
import { environment } from '../../../environments/environment';

/** Gắn token admin vào mọi request tới API; server báo 401 thì quay về trang đăng nhập. */
export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);
  const token = adminAuth.token;
  const authedReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.endsWith('/admin/auth/login')) {
        adminAuth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
