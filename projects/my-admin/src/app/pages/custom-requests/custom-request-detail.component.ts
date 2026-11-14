import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { concatMap } from 'rxjs';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { CustomRequest, CustomRequestStatus } from '../../core/models/custom-request.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { REQUEST_FLOW, requestStatusClass, requestStatusLabel } from './request-labels';

type PreviewModel = NonNullable<CustomRequest['preview3dModelType']>;

const PREVIEW_MODELS: { value: PreviewModel; label: string }[] = [
  { value: 'moon_lamp', label: 'Đèn mặt trăng' },
  { value: 'geometric_vase', label: 'Bình hình học' },
  { value: 'abstract_sculpture', label: 'Tượng trừu tượng' },
  { value: 'desk_organizer', label: 'Khay để bàn' },
];

/** Chi tiết yêu cầu in 3D: brief + ảnh, trao đổi với khách, báo giá, cấp 3D preview. */
@Component({
  selector: 'app-custom-request-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe],
  templateUrl: './custom-request-detail.component.html',
  styleUrl: './custom-request-detail.component.css',
})
export class CustomRequestDetailComponent implements OnInit, AfterViewChecked {
  private requestService = inject(CustomRequestService);
  private adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  @ViewChild('thread') thread?: ElementRef<HTMLDivElement>;

  readonly statusLabel = requestStatusLabel;
  readonly statusClass = requestStatusClass;
  readonly flow = REQUEST_FLOW;
  readonly previewModels = PREVIEW_MODELS;

  private requestId = '';
  loaded = signal(false);
  busy = signal(false);

  readonly request = computed(() =>
    this.requestService.requests().find(r => r.id === this.requestId || r.requestCode === this.requestId) || null);

  quotePrice: number | null = null;
  quoteDays = 4;
  previewModel: PreviewModel = 'moon_lamp';
  messageDraft = '';
  zoomImage: string | null = null;
  private lastMessageCount = -1;

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id') || '';
    const r = this.request();
    if (r) this.fillForm(r);
    // Luôn tải lại để thấy tin nhắn / trạng thái mới nhất của khách.
    this.requestService.load().subscribe({
      next: () => {
        this.loaded.set(true);
        const current = this.request();
        if (current && !r) this.fillForm(current);
      },
      error: err => {
        this.loaded.set(true);
        this.toast.apiError(err, 'Không tải được yêu cầu in 3D');
      },
    });
  }

  /** Có tin mới thì cuộn khung trao đổi xuống cuối. */
  ngAfterViewChecked(): void {
    const count = this.request()?.messages?.length ?? 0;
    if (count === this.lastMessageCount || !this.thread) return;
    this.lastMessageCount = count;
    const el = this.thread.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  private fillForm(r: CustomRequest): void {
    this.quotePrice = r.quotationPrice || null;
    this.quoteDays = r.estimatedDays || 4;
    this.previewModel = r.preview3dModelType || 'moon_lamp';
  }

  get canEdit(): boolean {
    return this.adminAuth.can('custom3d.edit');
  }

  isClosed(r: CustomRequest): boolean {
    return r.status === 'REJECTED' || r.status === 'CONVERTED_TO_ORDER';
  }

  /** Bước trên dòng thời gian: đã qua / đang ở / chưa tới. */
  flowState(r: CustomRequest, step: CustomRequestStatus): 'done' | 'current' | '' {
    const current = r.status === 'IN_DISCUSSION' ? 'QUOTED' : r.status;
    const ci = this.flow.indexOf(current);
    const si = this.flow.indexOf(step);
    if (ci < 0) return '';
    return si < ci ? 'done' : si === ci ? 'current' : '';
  }

  goBack(): void {
    this.router.navigate(['/custom-requests']);
  }

  /** Báo giá: lưu giá + số ngày rồi gửi tin báo cho khách; chỉ báo thành công khi cả 2 bước đều xong. */
  submitQuotation(r: CustomRequest): void {
    const price = Number(this.quotePrice);
    const days = Number(this.quoteDays) || 4;
    if (!price || price <= 0) {
      this.toast.warning('Vui lòng nhập giá báo giá hợp lệ');
      return;
    }
    this.busy.set(true);
    this.requestService.updateStatus(r.id, 'QUOTED', price, days).pipe(
      concatMap(() => this.requestService.sendMessage(
        r.id,
        `Shop Luméa đã kiểm tra yêu cầu và gửi báo giá chính thức: ${price.toLocaleString('vi-VN')}đ. Thời gian in và xử lý hoàn thiện khoảng ${days} ngày.`,
        'SHOP_SPECIALIST'
      ))
    ).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Đã gửi báo giá ${price.toLocaleString('vi-VN')}đ cho khách`);
        this.audit.record('Yêu Cầu In 3D', 'Gửi báo giá tùy biến', `${r.requestCode}: ${price.toLocaleString('vi-VN')}đ (${days} ngày)`, 'SUCCESS');
      },
      error: err => {
        this.busy.set(false);
        this.toast.apiError(err, 'Không gửi được báo giá lên server');
      },
    });
  }

  setPreviewReady(r: CustomRequest): void {
    const model = this.previewModel;
    this.busy.set(true);
    this.requestService.updateStatus(r.id, 'PREVIEW_READY', undefined, undefined, model).pipe(
      concatMap(() => this.requestService.sendMessage(
        r.id,
        'Bản vẽ mô phỏng 3D Preview đã được tải lên! Bạn hãy xem và bấm duyệt thiết kế nhé.',
        'SHOP_SPECIALIST'
      ))
    ).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Đã cấp mô hình 3D Preview cho khách duyệt');
        this.audit.record('Yêu Cầu In 3D', 'Cấp mô hình 3D Preview', `${r.requestCode}: mô hình ${model}`, 'SUCCESS');
      },
      error: err => {
        this.busy.set(false);
        this.toast.apiError(err, 'Không cấp được 3D Preview');
      },
    });
  }

  markInDiscussion(r: CustomRequest): void {
    this.busy.set(true);
    this.requestService.updateStatus(r.id, 'IN_DISCUSSION').subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.info('Đã chuyển sang Đang trao đổi');
        this.audit.record('Yêu Cầu In 3D', 'Chuyển sang đang trao đổi', r.requestCode, 'INFO');
      },
      error: err => {
        this.busy.set(false);
        this.toast.apiError(err, 'Không cập nhật được trạng thái');
      },
    });
  }

  async reject(r: CustomRequest): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: `Huỷ yêu cầu ${r.requestCode}?`,
      message: 'Khách sẽ thấy yêu cầu đã bị huỷ và không thể đặt hàng từ yêu cầu này nữa.',
      confirmLabel: 'Huỷ yêu cầu',
      danger: true,
      icon: 'bi-x-octagon',
    });
    if (!ok) return;
    this.busy.set(true);
    this.requestService.updateStatus(r.id, 'REJECTED').subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.info(`Đã huỷ yêu cầu ${r.requestCode}`);
        this.audit.record('Yêu Cầu In 3D', 'Huỷ yêu cầu', r.requestCode, 'WARNING');
      },
      error: err => {
        this.busy.set(false);
        this.toast.apiError(err, 'Không huỷ được yêu cầu');
      },
    });
  }

  sendMessage(r: CustomRequest): void {
    const text = this.messageDraft.trim();
    if (!text || this.busy()) return;
    this.busy.set(true);
    this.requestService.sendMessage(r.id, text, 'SHOP_SPECIALIST').subscribe({
      next: () => {
        this.busy.set(false);
        this.messageDraft = '';
      },
      error: err => {
        this.busy.set(false);
        this.toast.apiError(err, 'Không gửi được tin nhắn');
      },
    });
  }

  onMessageKeydown(event: KeyboardEvent, r: CustomRequest): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage(r);
    }
  }
}
