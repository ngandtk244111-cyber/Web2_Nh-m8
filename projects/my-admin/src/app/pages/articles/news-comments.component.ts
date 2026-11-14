import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminNewsComment, NewsService, unrepliedRoots } from '../../core/services/news.service';
import { ProductService } from '../../core/services/product.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { environment } from '../../../environments/environment';

type CommentFilter = 'UNREPLIED' | 'REPLIED' | 'ALL';

interface Thread {
  root: AdminNewsComment;
  replies: AdminNewsComment[];
  replied: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Bình luận của bạn đọc dưới bài Tin tức — xem theo luồng, shop trả lời (kèm ảnh). */
@Component({
  selector: 'app-news-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  templateUrl: './news-comments.component.html',
  styleUrl: './news-comments.component.css',
})
export class NewsCommentsComponent implements OnInit {
  private news = inject(NewsService);
  private products = inject(ProductService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private route = inject(ActivatedRoute);

  readonly clientAppUrl = environment.clientAppUrl;
  readonly loaded = this.news.commentsLoaded;

  filter = signal<CommentFilter>('UNREPLIED');
  search = signal('');
  articleFilter = signal('ALL');
  page = signal(1);
  readonly pageSize = 15;

  /** Luồng = ý kiến gốc của khách + các trả lời (cũ -> mới). */
  readonly threads = computed<Thread[]>(() => {
    const all = this.news.comments();
    const unreplied = new Set(unrepliedRoots(all).map(c => c.id));
    const replies = new Map<string, AdminNewsComment[]>();
    for (const c of all) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) || []), c]);
    return all
      .filter(c => !c.parentId && !c.isStaff)
      .map(root => ({
        root,
        replies: (replies.get(root.id) || []).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
        replied: !unreplied.has(root.id),
      }));
  });

  readonly articles = computed(() => {
    const map = new Map<string, string>();
    for (const t of this.threads()) map.set(t.root.articleId, t.root.articleTitle);
    return [...map].map(([id, title]) => ({ id, title }));
  });

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    const art = this.articleFilter();
    return this.threads().filter(t =>
      (f === 'ALL' || (f === 'REPLIED') === t.replied) &&
      (art === 'ALL' || t.root.articleId === art) &&
      (!q || [t.root.authorName, t.root.text, t.root.articleTitle, ...t.replies.map(r => r.text)].some(v => (v || '').toLowerCase().includes(q))));
  });
  readonly paged = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  // ---------- Cửa sổ luồng + trả lời ----------
  openId = signal<string | null>(null);
  /** Luồng đang mở (bản mới nhất — trả lời xong thì cập nhật ngay). */
  readonly current = computed(() => this.threads().find(t => t.root.id === this.openId()) || null);
  replyTarget: AdminNewsComment | null = null;
  replyText = '';
  replyImage = '';
  uploading = false;
  sending = false;

  ngOnInit(): void {
    const f = this.route.snapshot.queryParamMap.get('filter') as CommentFilter | null;
    if (f === 'UNREPLIED' || f === 'REPLIED' || f === 'ALL') this.filter.set(f);
    this.news.refreshComments();
  }

  get canReply(): boolean {
    return this.adminAuth.can('content.edit');
  }

  count(f: CommentFilter): number {
    return this.threads().filter(t => f === 'ALL' || (f === 'REPLIED') === t.replied).length;
  }

  setFilter(f: CommentFilter): void {
    this.filter.set(f);
    this.page.set(1);
  }

  open(t: Thread): void {
    this.openId.set(t.root.id);
    this.replyTarget = t.root;
    this.replyText = '';
    this.replyImage = '';
  }

  close(): void {
    this.openId.set(null);
  }

  /** Trả lời 1 câu trong luồng (vẫn nằm chung luồng ở web, gắn tên người được trả lời). */
  replyTo(c: AdminNewsComment): void {
    this.replyTarget = c;
  }

  articleLink(c: AdminNewsComment): string | null {
    return c.articleSlug ? `${this.clientAppUrl}/news/${c.articleSlug}` : null;
  }

  onPickImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.warning('Chỉ chọn được file ảnh (JPG, PNG, WEBP, GIF)');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.warning('Ảnh tối đa 5MB');
      return;
    }
    this.uploading = true;
    this.products.uploadImage(file).subscribe({
      next: url => {
        this.uploading = false;
        this.replyImage = url;
      },
      error: err => {
        this.uploading = false;
        this.toast.apiError(err, 'Không tải được ảnh lên');
      },
    });
  }

  send(t: Thread): void {
    const text = this.replyText.trim();
    if (!text && !this.replyImage) {
      this.toast.warning('Nhập nội dung hoặc chọn ảnh để trả lời');
      return;
    }
    const target = this.replyTarget || t.root;
    this.sending = true;
    this.news.replyComment(t.root.articleId, target.id, text, this.replyImage).subscribe({
      next: () => {
        this.sending = false;
        this.replyText = '';
        this.replyImage = '';
        this.replyTarget = t.root;
        this.toast.success(`Đã trả lời ${target.authorName}${target.isStaff ? '' : ' — khách sẽ nhận thông báo'}`);
        this.audit.record('Tin Tức', 'Trả lời bình luận', `${t.root.articleTitle} — ${target.authorName}`, 'SUCCESS');
      },
      error: err => {
        this.sending = false;
        this.toast.apiError(err, 'Không gửi được câu trả lời');
      },
    });
  }
}
