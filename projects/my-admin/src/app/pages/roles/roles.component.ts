import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { AdminDataService } from '../../core/services/admin-data.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import {
  ADMIN_ROLES, PERMISSION_KEYS, PERMISSION_MODULES, PermissionKey, PermissionMatrix, SUPER_ADMIN_ROLE_ID, StaffRow, toStaffRow,
} from './roles-data';

/** Vai trò & phân quyền — ma trận quyền lưu ở server (config 'permissions'), chỉ Super Admin được sửa. */
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, MascotLoadingComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css',
})
export class RolesComponent implements OnInit {
  private configService = inject(AdminConfigService);
  private adminData = inject(AdminDataService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly roles = ADMIN_ROLES;
  readonly modules = PERMISSION_MODULES;
  readonly permKeys = PERMISSION_KEYS;

  selectedRoleId = signal(ADMIN_ROLES[1].id);
  staff = signal<StaffRow[]>([]);
  /** Ô đang lưu, dạng "module.perm" — khoá ô đó tới khi server trả lời. */
  saving = signal<string | null>(null);

  readonly matrix = computed(() => this.configService.config()?.permissions as PermissionMatrix | undefined);
  readonly loading = computed(() => !this.configService.config());
  readonly selectedRole = computed(() => this.roles.find(r => r.id === this.selectedRoleId())!);

  ngOnInit(): void {
    this.configService.load(true);
    this.adminData.getStaff().subscribe({
      next: res => this.staff.set(res.staff.map(toStaffRow)),
      error: err => this.toast.apiError(err, 'Không tải được danh sách nhân viên'),
    });
  }

  staffCount(roleName: string): number {
    return this.staff().filter(s => s.role === roleName).length;
  }

  get isSuperRole(): boolean {
    return this.selectedRoleId() === SUPER_ADMIN_ROLE_ID;
  }

  /** Chỉ Super Admin được sửa bảng quyền; riêng vai trò Super Admin luôn toàn quyền. */
  get canEdit(): boolean {
    return this.adminAuth.isSuperAdmin() && !this.isSuperRole;
  }

  has(moduleKey: string, perm: PermissionKey): boolean {
    if (this.isSuperRole) return true;
    return !!this.matrix()?.[this.selectedRoleId()]?.[moduleKey]?.[perm];
  }

  toggle(moduleKey: string, perm: PermissionKey, input: HTMLInputElement): void {
    if (!this.canEdit || this.saving()) {
      input.checked = this.has(moduleKey, perm);
      return;
    }
    const roleId = this.selectedRoleId();
    const value = input.checked;
    // Bản sao sâu để bản đang hiển thị chỉ đổi khi server lưu xong.
    const next: PermissionMatrix = JSON.parse(JSON.stringify(this.matrix() || {}));
    next[roleId] ??= {};
    next[roleId][moduleKey] ??= { view: false, create: false, edit: false, delete: false, approve: false };
    next[roleId][moduleKey][perm] = value;

    this.saving.set(`${moduleKey}.${perm}`);
    this.configService.save('permissions', next).subscribe({
      next: () => {
        this.saving.set(null);
        const role = this.selectedRole().name;
        const modName = this.modules.find(m => m.key === moduleKey)?.name || moduleKey;
        const permLabel = this.permKeys.find(p => p.key === perm)?.label || perm;
        this.toast.success(`${value ? 'Đã cấp' : 'Đã bỏ'} quyền ${permLabel} – ${modName} cho ${role}`);
        this.audit.record('Phân Quyền', 'Cập nhật phân quyền', `${role} · ${modName} · ${permLabel}: ${value ? 'bật' : 'tắt'}`, 'WARNING');
      },
      error: err => {
        this.saving.set(null);
        input.checked = !value; // trả ô về trạng thái cũ
        this.toast.apiError(err, 'Không lưu được phân quyền');
      },
    });
  }

  /** Số quyền đang bật của vai trò (hiện ở danh sách vai trò). */
  grantedCount(roleId: string): number {
    if (roleId === SUPER_ADMIN_ROLE_ID) return this.modules.length * this.permKeys.length;
    const role = this.matrix()?.[roleId] || {};
    return Object.values(role).reduce((sum, mod) => sum + Object.values(mod || {}).filter(Boolean).length, 0);
  }
}
