import { Injectable, inject } from '@angular/core';
import { AdminDataService } from './admin-data.service';

/** Khớp AUDIT_LEVELS ở server/routes/adminRoutes.js. */
export type AuditLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

/** Ghi nhật ký thao tác lên server; tài khoản, IP và thời gian do server xác định. */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private adminData = inject(AdminDataService);

  record(module: string, action: string, detail: string, level: AuditLevel = 'INFO'): void {
    this.adminData.addAuditLog({ module, action, detail, level }).subscribe({
      error: err => console.warn('Không ghi được nhật ký', err),
    });
  }
}
