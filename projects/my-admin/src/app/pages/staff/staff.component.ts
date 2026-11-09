import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDataService } from '../../core/services/admin-data.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { ADMIN_ROLES, AdminRole, SUPER_ADMIN_NAME, SUPER_ADMIN_ROLE_ID, StaffRow, toStaffRow } from '../roles/roles-data';

type StaffFilter = 'ALL' | 'ACTIVE' | 'LOCKED';

const emptyForm = (code: string) => ({
  code, name: '', username: '', email: '', phone: '', department: 'Chăm Sóc Khách Hàng', role: 'Customer Care', password: '',
});

/** Nhân viên — tài khoản nội bộ, vai trò và trạng thái truy cập. Server tự ghi nhật ký các thao tác này. */
@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, MascotLoadingComponent, PagerComponent],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.css',
})
export class StaffComponent implements OnInit {
  private adminData = inject(AdminDataService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly filters: { key: StaffFilter; label: string; tone: string }[] = [
    { key: 'ALL', label: 'Tất cả nhân viên', tone: '' },
    { key: 'ACTIVE', label: 'Đang làm việc', tone: 'tone-success' },
    { key: 'LOCKED', label: 'Khoá truy cập', tone: 'tone-danger' },
  ];

  loading = signal(true);
  staff = signal<StaffRow[]>([]);
  filter = signal<StaffFilter>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 20;
  /** Đang gửi yêu cầu cho nhân viên nào (khoá nút của dòng đó). */
  busyId = signal<string | null>(null);

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.staff().filter(st =>
      (this.filter() === 'ALL' || st.status === this.filter()) &&
      (!q || st.name.toLowerCase().includes(q) || st.username.toLowerCase().includes(q) ||
        st.code.toLowerCase().includes(q) || st.department.toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  showModal = false;
  saving = false;
  form = emptyForm('');

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.adminData.getStaff().subscribe({
      next: res => {
        this.staff.set(res.staff.map(toStaffRow));
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.toast.apiError(err, 'Không tải được danh sách nhân viên');
      },
    });
  }

  count(f: StaffFilter): number {
    return f === 'ALL' ? this.staff().length : this.staff().filter(st => st.status === f).length;
  }

  setFilter(f: StaffFilter): void {
    this.filter.set(f);
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  get canCreate(): boolean {
    return this.adminAuth.can('staff.create');
  }

  get canDelete(): boolean {
    return this.adminAuth.can('staff.delete');
  }

  get canEdit(): boolean {
    return this.adminAuth.can('staff.edit');
  }

  /** Vai trò được phép gán: chỉ Super Admin mới gán được Super Admin. */
  get assignableRoles(): AdminRole[] {
    return ADMIN_ROLES.filter(r => r.id !== SUPER_ADMIN_ROLE_ID || this.adminAuth.isSuperAdmin());
  }

  isSelf(st: StaffRow): boolean {
    return st.id === this.adminAuth.adminId;
  }

  /** Không tự đổi vai trò/khoá chính mình; chỉ Super Admin được đụng tới tài khoản Super Admin. */
  canManage(st: StaffRow): boolean {
    if (!this.canEdit || this.isSelf(st)) return false;
    return st.role !== SUPER_ADMIN_NAME || this.adminAuth.isSuperAdmin();
  }

  trackById = (_: number, st: StaffRow) => st.id;

  private replace(updated: StaffRow): void {
    this.staff.update(list => list.map(s => s.id === updated.id ? updated : s));
  }

  changeRole(st: StaffRow, select: HTMLSelectElement): void {
    const role = select.value;
    if (!role || role === st.role) return;
    this.busyId.set(st.id);
    this.adminData.setStaffRole(st.id, role).subscribe({
      next: res => {
        this.busyId.set(null);
        const row = toStaffRow(res.staff);
        this.replace(row);
        this.toast.success(`Đã đổi vai trò của ${row.name} thành ${row.role}`);
      },
      error: err => {
        this.busyId.set(null);
        select.value = st.role; // trả ô chọn về vai trò cũ
        this.toast.apiError(err, 'Không đổi được vai trò nhân viên');
      },
    });
  }

  async toggleStatus(st: StaffRow): Promise<void> {
    const active = st.status !== 'ACTIVE';
    const ok = await this.confirmDialog.confirm({
      title: active ? `Mở khoá ${st.name}?` : `Khoá truy cập ${st.name}?`,
      message: active ? 'Nhân viên đăng nhập lại được ngay.' : 'Nhân viên bị đăng xuất ở lần thao tác kế tiếp và không đăng nhập được nữa.',
      confirmLabel: active ? 'Mở khoá' : 'Khoá truy cập',
      danger: !active,
      icon: active ? 'bi-unlock' : 'bi-lock',
    });
    if (!ok) return;
    this.busyId.set(st.id);
    this.adminData.setStaffActive(st.id, active).subscribe({
      next: res => {
        this.busyId.set(null);
        const row = toStaffRow(res.staff);
        this.replace(row);
        this.toast.success(active ? `Đã mở khoá ${row.name}` : `Đã khoá truy cập ${row.name}`);
      },
      error: err => {
        this.busyId.set(null);
        this.toast.apiError(err, 'Không đổi được trạng thái nhân viên');
      },
    });
  }

  /** Xoá hẳn tài khoản (khác "Khoá": khoá còn mở lại được, xoá thì mất tài khoản đăng nhập). */
  async deleteStaff(st: StaffRow): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: `Xoá tài khoản ${st.name}?`,
      message: 'Tài khoản bị xoá vĩnh viễn, không đăng nhập lại được. Nhật ký hoạt động của nhân viên này vẫn được giữ. Nếu chỉ tạm nghỉ, hãy dùng "Khoá".',
      confirmLabel: 'Xoá tài khoản',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.busyId.set(st.id);
    this.adminData.deleteStaff(st.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.staff.update(list => list.filter(x => x.id !== st.id));
        this.toast.success(`Đã xoá tài khoản ${st.name}`);
      },
      error: err => {
        this.busyId.set(null);
        this.toast.apiError(err, 'Không xoá được tài khoản nhân viên');
      },
    });
  }

  openCreate(): void {
    this.form = emptyForm('LM-EMP' + String(this.staff().length + 1).padStart(3, '0'));
    this.showModal = true;
  }

  save(): void {
    const f = this.form;
    if (!f.name.trim() || !f.username.trim()) {
      this.toast.warning('Vui lòng nhập họ tên và tên đăng nhập');
      return;
    }
    if (f.password.length < 8) {
      this.toast.warning('Mật khẩu cần ít nhất 8 ký tự');
      return;
    }
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) {
      this.toast.warning('Email không hợp lệ');
      return;
    }
    this.saving = true;
    this.adminData.createStaff({
      code: f.code.trim(), fullName: f.name.trim(), username: f.username.trim(), email: f.email.trim(),
      phone: f.phone.trim(), department: f.department.trim(), role: f.role, password: f.password,
    }).subscribe({
      next: res => {
        this.saving = false;
        this.staff.update(list => [...list, toStaffRow(res.staff)]);
        this.showModal = false;
        this.toast.success(`Đã thêm nhân viên "${res.staff.fullName}"`);
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, err?.status === 500 ? 'Tên đăng nhập có thể đã tồn tại' : 'Không tạo được nhân viên');
      },
    });
  }
}
