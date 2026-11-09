import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { ToastService } from '../../core/services/toast.service';
import { CustomRequest, CustomRequestStatus } from '../../core/models/custom-request.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { requestStatusClass, requestStatusLabel } from './request-labels';

type RequestFilter = 'ALL' | CustomRequestStatus;

const FILTERS: { key: RequestFilter; label: string; tone: string }[] = [
  { key: 'ALL', label: 'Tất cả yêu cầu', tone: '' },
  { key: 'PENDING_REVIEW', label: 'Chờ xem xét', tone: 'tone-warning' },
  { key: 'QUOTED', label: 'Đã báo giá', tone: 'tone-info' },
  { key: 'IN_DISCUSSION', label: 'Đang trao đổi', tone: 'tone-info' },
  { key: 'PREVIEW_READY', label: 'Đã cấp preview', tone: 'tone-info' },
  { key: 'APPROVED', label: 'Khách đã duyệt', tone: 'tone-success' },
  { key: 'CONVERTED_TO_ORDER', label: 'Đã thành đơn', tone: 'tone-success' },
];

/** Danh sách yêu cầu in 3D riêng — brief thiết kế khách gửi chờ duyệt & báo giá. */
@Component({
  selector: 'app-custom-request-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, PagerComponent],
  templateUrl: './custom-request-list.component.html',
  styleUrl: './custom-request-list.component.css',
})
export class CustomRequestListComponent implements OnInit {
  private requestService = inject(CustomRequestService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly filters = FILTERS;
  readonly statusLabel = requestStatusLabel;
  readonly statusClass = requestStatusClass;

  filter = signal<RequestFilter>('ALL');
  search = signal('');
  page = signal(1);
  reloading = signal(false);
  readonly pageSize = 20;

  readonly requests = this.requestService.requests;

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.requests().filter(r =>
      (this.filter() === 'ALL' || r.status === this.filter()) &&
      (!q || r.requestCode.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) || (r.customerPhone || '').includes(q)));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('status') as RequestFilter | null;
    if (status && FILTERS.some(f => f.key === status)) this.filter.set(status);
    this.requestService.refresh();
  }

  /** Có phản hồi rõ ràng (icon quay + thông báo) — dữ liệu không đổi thì trước đây trông như bấm không ăn. */
  reload(): void {
    if (this.reloading()) return;
    this.reloading.set(true);
    this.requestService.load().subscribe({
      next: list => {
        this.reloading.set(false);
        this.toast.success(`Đã tải lại ${list.length} yêu cầu`);
      },
      error: err => {
        this.reloading.set(false);
        this.toast.apiError(err, 'Không tải lại được danh sách');
      },
    });
  }

  count(f: RequestFilter): number {
    return f === 'ALL' ? this.requests().length : this.requests().filter(r => r.status === f).length;
  }

  setFilter(f: RequestFilter): void {
    this.filter.set(f);
    this.page.set(1);
    this.router.navigate([], { queryParams: { status: f === 'ALL' ? null : f }, replaceUrl: true });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  trackById = (_: number, r: CustomRequest) => r.id;

  openRequest(r: CustomRequest): void {
    this.router.navigate(['/custom-requests', r.id]);
  }

  /** Tin cuối là của khách → nhân viên chưa trả lời. */
  awaitingReply(r: CustomRequest): boolean {
    const last = r.messages?.[r.messages.length - 1];
    return last?.sender === 'CUSTOMER';
  }
}
