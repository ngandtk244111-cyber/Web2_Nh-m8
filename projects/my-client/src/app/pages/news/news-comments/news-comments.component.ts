import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
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

  readonly maxLength = COMMENT_MAX_LENGTH;
  readonly sortTabs: { key: CommentSort; label: string }[] = [
    { key: 'top', label: 'Quan tâm nhất' },
    { key: 'newest', label: 'Mới nhất' },
  ];

  comments: NewsComment[] = [];
  loading = false;
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
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['articleId'] && this.articleId) this.load();
  }

  private load(): void {
    this.loading = true;
    this.comments = [];
    this.visibleCount = INITIAL_VISIBLE;
    this.replyingTo = null;
    this.commentService.list(this.articleId).subscribe({
      next: (list) => {
        this.comments = list;
        this.loading = false;
      },
      error: () => (this.loading = false),
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

  /** Thời gian tương đối kiểu "5 phút trước"; quá 7 ngày thì hiện ngày tháng. */
  timeAgo(iso: string): string {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
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
