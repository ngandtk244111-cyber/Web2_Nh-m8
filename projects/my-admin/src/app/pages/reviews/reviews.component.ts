import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReviewService, AdminReview } from '../../core/services/review.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { environment } from '../../../environments/environment';

/** Ưu tiên việc cần làm: đánh giá xấu chưa phản hồi. */
export type ReviewFilter = 'NEEDS_ACTION' | 'UNREPLIED' | 'REPLIED' | 'ALL' | 'PINNED' | 'HIDDEN';

const FILTERS: { key: ReviewFilter; label: string; tone: string }[] = [
  { key: 'NEEDS_ACTION', label: 'Đánh giá xấu chưa phản hồi', tone: 'tone-danger' },
  { key: 'UNREPLIED', label: 'Chưa phản hồi', tone: 'tone-warning' },
  { key: 'REPLIED', label: 'Đã phản hồi', tone: 'tone-success' },
  { key: 'ALL', label: 'Tất cả đánh giá', tone: '' },
  { key: 'PINNED', label: 'Đang ghim', tone: 'tone-info' },
  { key: 'HIDDEN', label: 'Đã ẩn', tone: 'tone-neutral' },
];

function matchesFilter(r: AdminReview, f: ReviewFilter): boolean {
  switch (f) {
    case 'NEEDS_ACTION': return r.status !== 'HIDDEN' && r.rating <= 2 && !r.reply?.text;
    case 'UNREPLIED': return r.status !== 'HIDDEN' && !r.reply?.text;
    case 'REPLIED': return !!r.reply?.text;
    case 'PINNED': return !!r.pinned && r.status !== 'HIDDEN';
    case 'HIDDEN': return r.status === 'HIDDEN';
    default: return true;
  }
}

/** Đánh giá sản phẩm — đăng ngay không cần duyệt; nhân viên phản hồi, ghim hoặc ẩn nội dung vi phạm. */
@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.css',
})
export class ReviewsComponent implements OnInit {
  private reviewService = inject(ReviewService);
  private route = inject(ActivatedRoute);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly filters = FILTERS;
  readonly stars = [5, 4, 3, 2, 1];
  readonly hideReasons = ['Ngôn từ thô tục / xúc phạm', 'Spam hoặc quảng cáo', 'Lộ thông tin cá nhân', 'Đánh giá nhầm sản phẩm', 'Nội dung không liên quan'];
  readonly replyTemplates = [
    'Cảm ơn bạn đã tin chọn Luméa! Rất vui vì sản phẩm làm bạn hài lòng.',
    'Luméa rất tiếc về trải nghiệm chưa tốt của bạn. Bộ phận CSKH sẽ liên hệ để hỗ trợ đổi/trả ngay ạ.',
    'Cảm ơn góp ý của bạn, xưởng in 3D sẽ cải thiện ở các lô sản phẩm tiếp theo.',
  ];

  readonly reviews = this.reviewService.reviews;
  filter = signal<ReviewFilter>('NEEDS_ACTION');
  starFilter = signal<'ALL' | number>('ALL');
  search = signal('');
  page = signal(1);
  readonly pageSize = 10;

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const star = this.starFilter();
    return this.reviews().filter(r =>
      matchesFilter(r, this.filter()) &&
      (star === 'ALL' || r.rating === star) &&
      (!q || r.productName.toLowerCase().includes(q) || r.author.toLowerCase().includes(q) || (r.comment || '').toLowerCase().includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  /** Điểm trung bình & phân bố sao, chỉ tính đánh giá đang hiển thị (giống khách nhìn thấy). */
  readonly stats = computed(() => {
    const shown = this.reviews().filter(r => r.status !== 'HIDDEN');
    const total = shown.length;
    const average = total ? shown.reduce((sum, r) => sum + r.rating, 0) / total : 0;
    const byStar = this.stars.map(star => {
      const count = shown.filter(r => r.rating === star).length;
      return { star, count, percent: total ? Math.round((count / total) * 100) : 0 };
    });
    return { average, total, byStar };
  });

  replyingId: string | null = null;
  replyText = '';
  hiding: AdminReview | null = null;
  hideReason = '';
  busy = false;

  ngOnInit(): void {
    // Mở từ chuông thông báo: /reviews?filter=UNREPLIED
    const f = this.route.snapshot.queryParamMap.get('filter') as ReviewFilter | null;
    if (f && FILTERS.some(x => x.key === f)) this.filter.set(f);
    this.reviewService.refresh();
  }

  get canEdit(): boolean {
    return this.adminAuth.can('customers.edit');
  }

  count(f: ReviewFilter): number {
    return this.reviews().filter(r => matchesFilter(r, f)).length;
  }

  setFilter(f: ReviewFilter): void {
    this.filter.set(f);
    this.page.set(1);
  }

  setStar(value: string): void {
    this.starFilter.set(value === 'ALL' ? 'ALL' : Number(value));
    this.page.set(1);
  }

  key(r: AdminReview): string {
    return r.productId + ':' + r.id;
  }

  productUrl(r: AdminReview): string {
    return `${environment.clientAppUrl}/product/${r.productSlug}`;
  }

  starArray(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map(i => i <= rating);
  }

  private update(r: AdminReview, changes: Parameters<ReviewService['update']>[1], onDone: (updated: AdminReview) => void, fallback: string): void {
    this.busy = true;
    this.reviewService.update(r, changes).subscribe({
      next: updated => {
        this.busy = false;
        onDone(updated);
      },
      error: err => {
        this.busy = false;
        this.toast.apiError(err, fallback);
      },
    });
  }

  startReply(r: AdminReview): void {
    this.replyingId = this.key(r);
    this.replyText = r.reply?.text || '';
  }

  cancelReply(): void {
    this.replyingId = null;
    this.replyText = '';
  }

  saveReply(r: AdminReview): void {
    const text = this.replyText.trim();
    if (!text) {
      this.toast.warning('Nhập nội dung phản hồi');
      return;
    }
    const isEdit = !!r.reply?.text;
    this.update(r, { reply: text }, () => {
      this.cancelReply();
      this.toast.success(isEdit ? 'Đã cập nhật phản hồi' : 'Đã đăng phản hồi — khách thấy ngay dưới đánh giá');
      this.audit.record('Đánh Giá', isEdit ? 'Sửa phản hồi đánh giá' : 'Phản hồi đánh giá', `${r.author} — ${r.productName}`, 'INFO');
    }, 'Không lưu được phản hồi');
  }

  async deleteReply(r: AdminReview): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá phản hồi?',
      message: 'Phản hồi của Luméa cho đánh giá này sẽ bị xoá.',
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.update(r, { reply: '' }, () => {
      this.toast.info('Đã xoá phản hồi');
      this.audit.record('Đánh Giá', 'Xoá phản hồi đánh giá', `${r.author} — ${r.productName}`, 'WARNING');
    }, 'Không xoá được phản hồi');
  }

  togglePinned(r: AdminReview): void {
    this.update(r, { pinned: !r.pinned }, updated => {
      this.toast.info(updated.pinned ? 'Đã ghim — đánh giá hiện đầu trang sản phẩm' : 'Đã bỏ ghim');
    }, 'Không cập nhật được đánh giá');
  }

  openHide(r: AdminReview): void {
    this.hiding = r;
    this.hideReason = this.hideReasons[0];
  }

  confirmHide(): void {
    const r = this.hiding;
    const reason = this.hideReason.trim();
    if (!r || !reason) return;
    this.update(r, { status: 'HIDDEN', hiddenReason: reason }, () => {
      this.hiding = null;
      this.toast.info(`Đã ẩn đánh giá của ${r.author}`);
      this.audit.record('Đánh Giá', 'Ẩn đánh giá', `${r.author} — ${r.productName}: ${reason}`, 'WARNING');
    }, 'Không ẩn được đánh giá');
  }

  showAgain(r: AdminReview): void {
    this.update(r, { status: 'VISIBLE' }, () => {
      this.toast.success('Đánh giá đã hiển thị lại');
      this.audit.record('Đánh Giá', 'Hiện lại đánh giá', `${r.author} — ${r.productName}`, 'SUCCESS');
    }, 'Không cập nhật được đánh giá');
  }
}
