import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsCommentService } from '../../../core/services/news-comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoginModalService } from '../../../core/services/login-modal.service';
import { ToastService } from '../../../core/services/toast.service';
import { NewsComment } from '../../../core/models/news.model';
import { AppIconComponent } from '../../../components/icon/icon.component';

type CommentSort = 'top' | 'newest';

interface CommentThread {
  comment: NewsComment;
  replies: NewsComment[];
}

const INITIAL_VISIBLE = 5;
const LOAD_MORE_STEP = 5;
export const COMMENT_MAX_LENGTH = 1000;

/** Mục "Ý kiến" dưới bài Tin tức (kiểu báo điện tử): gửi ý kiến, sắp xếp, thích, trả lời 1 cấp. */
@Component({
  selector: 'app-news-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './news-comments.component.html',
  styleUrl: './news-comments.component.css'
})
export class NewsCommentsComponent implements OnChanges {
  @Input({ required: true }) articleId!: string;

  private readonly now = signal(Date.now());
  private readonly destroyRef = inject(DestroyRef);
  readonly maxLength = COMMENT_MAX_LENGTH;
  readonly sortTabs: { key: CommentSort; label: string }[] = [
    { key: 'top', label: 'Quan tâm nhất' },
    { key: 'newest', label: 'Mới nhất' },
  ];

  comments: NewsComment[] = [];
  loading = false;
  private loadId = 0;
  sortBy: CommentSort = 'top';
  visibleCount = INITIAL_VISIBLE;

  draft = '';
  composerFocused = false;
  submitting = false;

  /** id ý kiến gốc đang mở ô trả lời. */
  replyingTo: string | null = null;
  replyDraft = '';

  constructor(
    private commentService: NewsCommentService,
    private authService: AuthService,
    private loginModalService: LoginModalService,
    private toast: ToastService
  ) {
    effect(() => { this.authService.currentUser(); untracked(() => { if (this.articleId) this.load(); }); });
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['articleId'] && this.articleId) this.load();
  }

  private load(): void {
    const requestId = ++this.loadId;
    const owner = this.authService.currentUser()?._id;
    this.loading = true;
    this.comments = [];
    this.visibleCount = INITIAL_VISIBLE;
    this.replyingTo = null;
    this.commentService.list(this.articleId).subscribe({
      next: (list) => {
        if (requestId !== this.loadId || owner !== this.authService.currentUser()?._id) return;
        this.comments = list;
        this.loading = false;
      },
      error: () => { if (requestId === this.loadId) this.loading = false; },
    });
  }

  get totalCount(): number {
    return this.comments.length;
  }

  /** Ý kiến gốc kèm câu trả lời (trả lời luôn xếp cũ → mới như một cuộc hội thoại). */
  get threads(): CommentThread[] {
    const roots = this.comments.filter(c => !c.parentId);
    const byTime = (a: NewsComment, b: NewsComment) => +new Date(b.createdAt) - +new Date(a.createdAt);
    roots.sort(this.sortBy === 'top'
      ? (a, b) => (b.likesCount + this.replyCount(b.id)) - (a.likesCount + this.replyCount(a.id)) || byTime(a, b)
      : byTime);
    return roots.map(comment => ({
      comment,
      replies: this.comments
        .filter(c => c.parentId === comment.id)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    }));
  }

  get visibleThreads(): CommentThread[] {
    return this.threads.slice(0, this.visibleCount);
  }

  get hasMore(): boolean {
    return this.visibleCount < this.threads.length;
  }

  private replyCount(id: string): number {
    return this.comments.filter(c => c.parentId === id).length;
  }

  setSort(key: CommentSort): void {
    this.sortBy = key;
    this.visibleCount = INITIAL_VISIBLE;
  }

  loadMore(): void {
    this.visibleCount += LOAD_MORE_STEP;
  }

  initial(name: string): string {
    return (name.trim()[0] || '?').toUpperCase();
  }

  relativeTime(value: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value || 'Không rõ thời gian';
    const now = this.now();
    const minutes = Math.floor(Math.max(0, now - date.getTime()) / 60_000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return minutes + ' phút trước';
    if (minutes < 1440) return Math.floor(minutes / 60) + ' giờ trước';
    const zone = 'Asia/Ho_Chi_Minh';
    const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: zone });
    const time = date.toLocaleTimeString('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    if (day(date) === day(new Date(now - 86_400_000))) return 'Hôm qua lúc ' + time;
    const year = date.toLocaleDateString('en', { timeZone: zone, year: 'numeric' });
    const sameYear = year === new Date(now).toLocaleDateString('en', { timeZone: zone, year: 'numeric' });
    return date.toLocaleDateString('vi-VN', { timeZone: zone, day: 'numeric', month: 'long', ...(!sameYear ? { year: 'numeric' } as const : {}) }) + ' lúc ' + time;
  }

  postDate(value?: string): string {
    const date = value ? new Date(value) : null;
    return date && !isNaN(date.getTime())
      ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) + ' (GMT+7)'
      : 'Bình luận cũ chưa lưu ngày giờ gốc';
  }

  /** Gửi ý kiến yêu cầu đăng nhập — trả về userId hoặc mở modal đăng nhập. */
  private requireUser(): string | null {
    const user = this.authService.currentUser();
    if (!user) {
      this.loginModalService.open();
      return null;
    }
    return user._id;
  }

  onComposerFocus(): void {
    this.composerFocused = true;
  }

  submit(): void {
    const text = this.draft.trim();
    if (!text || this.submitting) return;
    const userId = this.requireUser();
    if (!userId) return;
    this.post(userId, text, null, () => {
      this.draft = '';
      this.composerFocused = false;
      this.sortBy = 'newest';
    });
  }

  toggleReply(root: NewsComment): void {
    if (this.replyingTo === root.id) {
      this.replyingTo = null;
      return;
    }
    if (!this.requireUser()) return;
    this.replyingTo = root.id;
    this.replyDraft = '';
  }

  submitReply(root: NewsComment): void {
    const text = this.replyDraft.trim();
    if (!text || this.submitting) return;
    const userId = this.requireUser();
    if (!userId) return;
    this.post(userId, text, root.id, () => {
      this.replyDraft = '';
      this.replyingTo = null;
    });
  }

  private post(userId: string, text: string, parentId: string | null, done: () => void): void {
    this.submitting = true;
    this.commentService.add(this.articleId, userId, text, parentId).subscribe({
      next: (comment) => {
        this.comments = [comment, ...this.comments];
        this.submitting = false;
        done();
        this.toast.success('Đã gửi ý kiến của bạn');
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(err?.error?.error || 'Không gửi được ý kiến, vui lòng thử lại');
      },
    });
  }

  toggleLike(comment: NewsComment): void {
    // Cập nhật ngay trên giao diện, rồi đồng bộ số đếm thật từ server.
    const liked = !comment.isLiked;
    this.replace({ ...comment, isLiked: liked, likesCount: Math.max(0, comment.likesCount + (liked ? 1 : -1)) });
    this.commentService.toggleLike(comment).subscribe({
      next: (updated) => this.replace(updated),
      error: () => this.replace(comment),
    });
  }

  private replace(updated: NewsComment): void {
    this.comments = this.comments.map(c => (c.id === updated.id ? updated : c));
  }
}
