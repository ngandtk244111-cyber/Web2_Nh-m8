import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunityService } from '../../core/services/community.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { CommunityPost } from '../../core/models/community.model';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { environment } from '../../../environments/environment';

/** Bài đăng hôm nay, tất cả, đang hiển thị, bị bộ lọc tự động chặn, nhân viên đã ẩn, Staff Pick. */
export type CommunityFilter = 'TODAY' | 'ALL' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN' | 'STAFF_PICK';

const FILTERS: { key: CommunityFilter; label: string; tone: string }[] = [
  { key: 'TODAY', label: 'Đăng hôm nay', tone: 'tone-info' },
  { key: 'ALL', label: 'Tất cả bài', tone: '' },
  { key: 'PUBLISHED', label: 'Đang hiển thị', tone: 'tone-success' },
  { key: 'REJECTED', label: 'Bị chặn tự động', tone: 'tone-danger' },
  { key: 'HIDDEN', label: 'Nhân viên đã ẩn', tone: 'tone-neutral' },
  { key: 'STAFF_PICK', label: 'Staff Pick', tone: 'tone-warning' },
];

const STATUS_VIEW: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Đang hiển thị', cls: 'status-green' },
  REJECTED: { label: 'Bị chặn tự động', cls: 'status-red' },
  HIDDEN: { label: 'Đã ẩn', cls: 'status-gray' },
};

/** Kiểm duyệt Cộng đồng — bài khách đăng ở my-client (GET /community/admin, gồm cả bài bị chặn/ẩn). */
@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css',
})
export class CommunityComponent implements OnInit {
  private communityService = inject(CommunityService);
  readonly adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly filters = FILTERS;
  readonly clientAppUrl = environment.clientAppUrl;
  readonly hideReasonPresets = [
    'Ảnh không liên quan đến decor / nội thất',
    'Spam hoặc quảng cáo',
    'Ngôn từ không phù hợp',
    'Hình ảnh vi phạm bản quyền',
    'Lộ thông tin cá nhân',
  ];

  readonly posts = this.communityService.posts;
  // Mặc định xem tất cả: tab "Đăng hôm nay" thường trống, trông như trang không có bài nào.
  filter = signal<CommunityFilter>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 12;

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.posts().filter(p =>
      this.matches(p, this.filter()) &&
      (!q || p.title.toLowerCase().includes(q) || (p.caption || '').toLowerCase().includes(q) || (p.author?.name || '').toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  /** Bài đang mở hộp "Ẩn bài" để nhập lý do. */
  hidingPost: CommunityPost | null = null;
  hideReason = '';
  busyId: string | null = null;

  ngOnInit(): void {
    const f = this.route.snapshot.queryParamMap.get('filter') as CommunityFilter | null;
    if (f && FILTERS.some(x => x.key === f)) this.filter.set(f);
    this.communityService.refresh();
  }

  get canEdit(): boolean {
    return this.adminAuth.can('content.edit');
  }

  private matches(post: CommunityPost, f: CommunityFilter): boolean {
    switch (f) {
      case 'TODAY': return !!post.postedAt && new Date(post.postedAt).toDateString() === new Date().toDateString();
      case 'STAFF_PICK': return !!post.isStaffPick;
      case 'ALL': return true;
      default: return (post.status || 'PUBLISHED') === f;
    }
  }

  count(f: CommunityFilter): number {
    return this.posts().filter(p => this.matches(p, f)).length;
  }

  setFilter(f: CommunityFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { filter: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  statusView(post: CommunityPost): { label: string; cls: string } {
    return STATUS_VIEW[post.status || 'PUBLISHED'] || STATUS_VIEW['PUBLISHED'];
  }

  toggleStaffPick(post: CommunityPost): void {
    this.busyId = post.id;
    this.communityService.moderate(post.id, { isStaffPick: !post.isStaffPick }).subscribe({
      next: updated => {
        this.busyId = null;
        this.toast.info(updated.isStaffPick ? 'Đã gắn nhãn Staff Pick cho bài đăng' : 'Đã bỏ nhãn Staff Pick');
        this.audit.record('Cộng Đồng', updated.isStaffPick ? 'Gắn nhãn Staff Pick' : 'Bỏ nhãn Staff Pick', post.title, 'INFO');
      },
      error: err => {
        this.busyId = null;
        this.toast.apiError(err, 'Không cập nhật được bài đăng');
      },
    });
  }

  openHide(post: CommunityPost): void {
    this.hidingPost = post;
    this.hideReason = this.hideReasonPresets[0];
  }

  confirmHide(): void {
    const post = this.hidingPost;
    const reason = this.hideReason.trim();
    if (!post) return;
    if (!reason) {
      this.toast.warning('Nhập lý do ẩn để người đăng biết');
      return;
    }
    this.busyId = post.id;
    this.communityService.moderate(post.id, { status: 'HIDDEN', reason }).subscribe({
      next: () => {
        this.busyId = null;
        this.hidingPost = null;
        this.toast.info(`Đã ẩn bài của ${post.author?.name || 'khách hàng'} và gửi thông báo cho người đăng`);
        this.audit.record('Cộng Đồng', 'Ẩn bài đăng', `${post.title} — ${reason}`, 'WARNING');
      },
      error: err => {
        this.busyId = null;
        this.toast.apiError(err, 'Không ẩn được bài đăng');
      },
    });
  }

  /** Hiển thị lại bài đã ẩn, hoặc duyệt bài bị bộ lọc tự động chặn nhầm. */
  publish(post: CommunityPost): void {
    const wasRejected = post.status === 'REJECTED';
    this.busyId = post.id;
    this.communityService.moderate(post.id, { status: 'PUBLISHED' }).subscribe({
      next: () => {
        this.busyId = null;
        this.toast.success(wasRejected ? 'Đã duyệt bài — bài hiện đã hiển thị trên Cộng đồng' : 'Đã hiển thị lại bài đăng');
        this.audit.record('Cộng Đồng', wasRejected ? 'Duyệt bài bị chặn tự động' : 'Hiển thị lại bài đăng', post.title, 'SUCCESS');
      },
      error: err => {
        this.busyId = null;
        this.toast.apiError(err, 'Không cập nhật được bài đăng');
      },
    });
  }

  async remove(post: CommunityPost): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá vĩnh viễn bài đăng?',
      message: `"${post.title}" — thao tác này không hoàn tác được.`,
      confirmLabel: 'Xoá vĩnh viễn',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.communityService.delete(post.id).subscribe({
      next: () => {
        this.toast.info('Đã xoá bài đăng');
        this.audit.record('Cộng Đồng', 'Xoá bài đăng', post.title, 'WARNING');
      },
      error: err => this.toast.apiError(err, 'Không xoá được bài đăng'),
    });
  }
}
