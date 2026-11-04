import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDataService } from '../../core/services/admin-data.service';
import { ToastService } from '../../core/services/toast.service';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { exportXlsx } from '../../shared/utils/export';

/** Mức độ khớp AUDIT_LEVELS ở server/routes/adminRoutes.js. */
type AuditLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

interface AuditRow {
  id: string;
  timestamp: string;
  createdAt: string;
  actor: string;
  module: string;
  action: string;
  detail: string;
  ip: string;
  level: AuditLevel;
}

const LEVELS: { key: 'ALL' | AuditLevel; label: string; tone: string; cls: string }[] = [
  { key: 'ALL', label: 'Tất cả sự kiện', tone: '', cls: '' },
  { key: 'SUCCESS', label: 'Thành công', tone: 'tone-success', cls: 'status-green' },
  { key: 'INFO', label: 'Thông tin', tone: 'tone-info', cls: 'status-blue' },
  { key: 'WARNING', label: 'Cảnh báo', tone: 'tone-warning', cls: 'status-yellow' },
  { key: 'ERROR', label: 'Lỗi / nghiêm trọng', tone: 'tone-danger', cls: 'status-red' },
];

function toAuditRow(l: any): AuditRow {
  const at = new Date(l.createdAt);
  return {
    id: l._id,
    createdAt: l.createdAt,
    timestamp: isNaN(at.getTime()) ? '' : at.toLocaleDateString('vi-VN') + ' ' + at.toLocaleTimeString('vi-VN'),
    actor: l.actor || '—',
    module: l.module || '',
    action: l.action || '',
    detail: l.detail || '',
    ip: l.ip || '',
    level: l.level || 'INFO',
  };
}

/** Nhật ký hoạt động — mọi thao tác của nhân viên do server ghi lại (chỉ đọc). */
@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule, MascotLoadingComponent, PagerComponent],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent implements OnInit {
  private adminData = inject(AdminDataService);
  private toast = inject(ToastService);

  readonly levels = LEVELS;

  loading = signal(true);
  logs = signal<AuditRow[]>([]);
  level = signal<'ALL' | AuditLevel>('ALL');
  module = signal('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 25;

  readonly modules = computed(() => [...new Set(this.logs().map(l => l.module).filter(Boolean))].sort());

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.logs().filter(l =>
      (this.level() === 'ALL' || l.level === this.level()) &&
      (this.module() === 'ALL' || l.module === this.module()) &&
      (!q || l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q) || l.actor.toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.adminData.getAuditLogs().subscribe({
      next: res => {
        this.logs.set((res.logs || []).map(toAuditRow));
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.toast.apiError(err, 'Không tải được nhật ký từ server');
      },
    });
  }

  count(level: 'ALL' | AuditLevel): number {
    return level === 'ALL' ? this.logs().length : this.logs().filter(l => l.level === level).length;
  }

  levelClass(level: AuditLevel): string {
    return LEVELS.find(l => l.key === level)?.cls || 'status-gray';
  }

  levelLabel(level: AuditLevel): string {
    return LEVELS.find(l => l.key === level)?.label || level;
  }

  setLevel(level: 'ALL' | AuditLevel): void {
    this.level.set(level);
    this.page.set(1);
  }

  clearFilters(): void {
    this.level.set('ALL');
    this.module.set('ALL');
    this.search.set('');
    this.page.set(1);
  }

  trackById = (_: number, l: AuditRow) => l.id;

  exportExcel(): void {
    const rows = this.filtered();
    if (!rows.length) {
      this.toast.warning('Không có sự kiện nào để xuất');
      return;
    }
    exportXlsx('lumea_nhat_ky', ['Thời gian', 'Tài khoản', 'Phân hệ', 'Hành động', 'Chi tiết', 'IP', 'Mức độ'],
      rows.map(e => [e.timestamp, e.actor, e.module, e.action, e.detail, e.ip, this.levelLabel(e.level)]), 'Nhật ký');
    this.toast.success(`Đã xuất ${rows.length} sự kiện ra file Excel`);
  }
}
