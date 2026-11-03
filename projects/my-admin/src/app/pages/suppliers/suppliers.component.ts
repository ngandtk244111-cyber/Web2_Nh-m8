import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { exportXlsx } from '../../shared/utils/export';
import { DEFAULT_SUPPLIERS, Supplier } from './supplier-defaults';

type SupplierFilter = 'ALL' | 'ACTIVE' | 'PAUSED';

/** Nhà cung cấp & xưởng đối tác — lưu ở cấu hình 'suppliers' trên server, hiện trên bản đồ Dashboard. */
@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css',
})
export class SuppliersComponent implements OnInit {
  private config = inject(AdminConfigService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly suppliers = computed<Supplier[]>(() => this.config.get<Supplier[]>('suppliers') || DEFAULT_SUPPLIERS);
  readonly loading = computed(() => this.config.config() === null);

  filter = signal<SupplierFilter>('ALL');
  search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.suppliers().filter(s =>
      (this.filter() === 'ALL' || (this.filter() === 'ACTIVE') === !!s.active) &&
      (!q || [s.code, s.name, s.contact, s.phone, s.category, s.address].some(v => (v || '').toLowerCase().includes(q))));
  });

  showModal = false;
  editing: Supplier | null = null;
  form: Omit<Supplier, 'id'> = this.emptyForm();
  saving = signal(false);

  ngOnInit(): void {
    this.config.load();
  }

  get canCreate(): boolean { return this.adminAuth.can('inventory.create'); }
  get canEdit(): boolean { return this.adminAuth.can('inventory.edit'); }

  count(f: SupplierFilter): number {
    return this.suppliers().filter(s => f === 'ALL' || (f === 'ACTIVE') === !!s.active).length;
  }

  private emptyForm(): Omit<Supplier, 'id'> {
    return { code: '', name: '', contact: '', phone: '', email: '', address: '', category: '', rating: 5, active: true };
  }

  openAdd(): void {
    this.editing = null;
    this.form = { ...this.emptyForm(), code: 'NCC-' + (this.suppliers().length + 1) };
    this.showModal = true;
  }

  openEdit(s: Supplier): void {
    this.editing = s;
    const { id, ...rest } = s;
    this.form = { ...rest };
    this.showModal = true;
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) {
      this.toast.warning('Vui lòng nhập tên nhà cung cấp');
      return;
    }
    if (!this.form.address.trim()) {
      this.toast.warning('Vui lòng nhập địa chỉ xưởng (dùng để hiện trên bản đồ)');
      return;
    }
    const rating = Math.min(5, Math.max(0, Number(this.form.rating) || 0));
    const entry = { ...this.form, name, rating };
    const isEdit = !!this.editing;
    const next = isEdit
      ? this.suppliers().map(s => s.id === this.editing!.id ? { ...s, ...entry } : s)
      : [...this.suppliers(), { id: 'sup-' + Date.now(), ...entry }];
    this.persist(next, () => {
      this.showModal = false;
      this.toast.success(isEdit ? `Đã cập nhật nhà cung cấp "${name}"` : `Đã thêm nhà cung cấp "${name}"`);
      this.audit.record('Nhà Cung Cấp', isEdit ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp', name, isEdit ? 'INFO' : 'SUCCESS');
    });
  }

  toggleActive(s: Supplier): void {
    const active = !s.active;
    this.persist(this.suppliers().map(x => x.id === s.id ? { ...x, active } : x), () => {
      this.toast.info(`${s.name}: ${active ? 'đang hợp tác' : 'tạm ngưng'}`);
      this.audit.record('Nhà Cung Cấp', 'Đổi trạng thái nhà cung cấp', `${s.name} -> ${active ? 'ACTIVE' : 'PAUSED'}`, 'INFO');
    });
  }

  /** Chỉ báo thành công khi server đã lưu; lỗi thì tải lại bản đang lưu trên server. */
  private persist(list: Supplier[], onSaved: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.config.save('suppliers', list).subscribe({
      next: () => {
        this.saving.set(false);
        onSaved();
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Không lưu được nhà cung cấp lên server');
        this.config.load(true);
      },
    });
  }

  exportExcel(): void {
    exportXlsx('lumea_nha_cung_cap',
      ['Mã', 'Tên', 'Người liên hệ', 'SĐT', 'Email', 'Địa chỉ', 'Vật tư chính', 'Đánh giá', 'Trạng thái'],
      this.filtered().map(s => [s.code, s.name, s.contact, s.phone, s.email, s.address, s.category, s.rating, s.active ? 'Đang hợp tác' : 'Tạm ngưng']),
      'Nhà cung cấp');
    this.toast.success(`Đã xuất ${this.filtered().length} nhà cung cấp ra file Excel`);
  }
}
