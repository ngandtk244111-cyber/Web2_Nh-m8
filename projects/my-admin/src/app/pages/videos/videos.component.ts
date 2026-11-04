import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { VideoService } from '../../core/services/video.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { Video } from '../../core/models/video.model';

const emptyForm = () => ({ title: '', description: '', youtubeId: '', poster: '', link: '', ctaLabel: 'Xem thêm', active: true });

/** ID YouTube từ link đầy đủ, youtu.be, shorts, embed hoặc ID trần — để xem trước; server tự kiểm tra lại. */
export function parseYoutubeId(raw: string): string | null {
  const value = raw.trim();
  const match = value.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  if (match) return match[1];
  return /^[\w-]{11}$/.test(value) ? value : null;
}

/** Video chủ đề phát ở trang chủ cửa hàng — nhân viên đăng, sắp thứ tự, bật/tắt. */
@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css',
})
export class VideosComponent implements OnInit {
  private videoService = inject(VideoService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);
  private sanitizer = inject(DomSanitizer);

  readonly sorted = computed(() => [...this.videoService.videos()].sort((a, b) => a.order - b.order));
  readonly activeCount = computed(() => this.videoService.videos().filter(v => v.active).length);

  showModal = false;
  editing: Video | null = null;
  form = emptyForm();
  saving = false;
  moving = false;

  ngOnInit(): void {
    this.videoService.refresh();
  }

  get previewId(): string | null {
    return parseYoutubeId(this.form.youtubeId);
  }

  /** Giống cửa hàng (video-topics.posterUrl): có video thì luôn hiện ảnh của YouTube, poster chỉ là dự phòng. */
  thumb(youtubeId: string): string {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  /** Ảnh YouTube không tải được (video bị xoá/riêng tư) → hiện poster dự phòng như cửa hàng. */
  onThumbError(event: Event, poster: string): void {
    const img = event.target as HTMLImageElement;
    if (poster && img.src !== poster) img.src = poster;
  }

  /** Video đang phát trong hộp xem trước. */
  playing: Video | null = null;
  private embedCache = new Map<string, SafeResourceUrl>();

  /** URL nhúng chỉ dựng từ ID 11 ký tự đã kiểm tra, nên bypass an toàn. */
  embedUrl(youtubeId: string | null, autoplay = true): SafeResourceUrl | null {
    if (!youtubeId || !/^[\w-]{11}$/.test(youtubeId)) return null;
    const key = `${youtubeId}|${autoplay ? 1 : 0}`;
    if (!this.embedCache.has(key)) {
      this.embedCache.set(key, this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=${autoplay ? 1 : 0}`));
    }
    return this.embedCache.get(key)!;
  }

  openCreate(): void {
    this.editing = null;
    this.form = emptyForm();
    this.showModal = true;
  }

  openEdit(video: Video): void {
    this.editing = video;
    this.form = {
      title: video.title,
      description: video.description || '',
      youtubeId: `https://youtu.be/${video.youtubeId}`,
      poster: video.poster || '',
      link: video.link || '',
      ctaLabel: video.ctaLabel || '',
      active: video.active,
    };
    this.showModal = true;
  }

  save(): void {
    const f = this.form;
    if (this.saving) return;
    if (!f.title.trim() || !f.youtubeId.trim()) {
      this.toast.warning('Vui lòng nhập tiêu đề và link YouTube');
      return;
    }
    if (!this.previewId) {
      this.toast.warning('Link YouTube không hợp lệ');
      return;
    }
    if (f.link.trim() && !/^\/(?!\/)|^https?:\/\//.test(f.link.trim())) {
      this.toast.warning('Link nút phải bắt đầu bằng / hoặc http(s)://');
      return;
    }
    const editing = this.editing;
    const payload = { ...f, title: f.title.trim(), youtubeId: f.youtubeId.trim(), link: f.link.trim() };
    this.saving = true;
    const request = editing ? this.videoService.update(editing.id, payload) : this.videoService.create(payload);
    request.subscribe({
      next: video => {
        this.saving = false;
        this.showModal = false;
        this.toast.success(editing ? `Đã cập nhật video "${video.title}"` : `Đã đăng video "${video.title}" lên trang chủ`);
        this.audit.record('Video', editing ? 'Sửa video' : 'Đăng video', video.title, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được video');
      },
    });
  }

  toggleActive(video: Video): void {
    this.videoService.update(video.id, { active: !video.active }).subscribe({
      next: updated => {
        this.toast.info(updated.active ? 'Video đã hiển thị trên trang chủ' : 'Đã ẩn video khỏi trang chủ');
        this.audit.record('Video', updated.active ? 'Hiện video' : 'Ẩn video', video.title, 'INFO');
      },
      error: err => this.toast.apiError(err, 'Không cập nhật được video'),
    });
  }

  /** Đổi chỗ với video liền trước/sau. Dữ liệu cũ có thể trùng order nên lấy vị trí trong danh
   *  sách đã sắp làm thứ tự mới cho cả hai video. */
  move(video: Video, direction: -1 | 1): void {
    const list = this.sorted();
    const index = list.findIndex(v => v.id === video.id);
    const other = list[index + direction];
    if (!other || this.moving) return;
    this.moving = true;
    forkJoin([
      this.videoService.update(video.id, { order: index + direction + 1 }),
      this.videoService.update(other.id, { order: index + 1 }),
    ]).subscribe({
      next: () => this.moving = false,
      error: err => {
        this.moving = false;
        this.toast.apiError(err, 'Không đổi được thứ tự video');
        this.videoService.refresh();
      },
    });
  }

  async remove(video: Video): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá video?',
      message: `"${video.title}" sẽ bị gỡ khỏi trang chủ.`,
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.videoService.delete(video.id).subscribe({
      next: () => {
        this.toast.info('Đã xoá video');
        this.audit.record('Video', 'Xoá video', video.title, 'WARNING');
      },
      error: err => this.toast.apiError(err, 'Không xoá được video'),
    });
  }
}
