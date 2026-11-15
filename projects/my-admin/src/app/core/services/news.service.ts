import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { NewsArticle } from '../models/news.model';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/news`;

export type NewsArticleInput = Partial<Omit<NewsArticle, 'id' | 'viewsCount' | 'publishedAt'>>;

/** Tin tức do nhân viên soạn — hiển thị ở trang /news của my-client. */
@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);

  private articlesSignal = signal<NewsArticle[]>([]);
  readonly articles = this.articlesSignal.asReadonly();
  /** true sau lần tải đầu tiên (kể cả lỗi) — trang sửa bài dùng để báo "không tìm thấy". */
  readonly loaded = signal(false);

  refresh(): void {
    this.http.get<{ success: boolean; articles: NewsArticle[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.articlesSignal.set(res.articles);
        this.loaded.set(true);
      },
      error: (err) => {
        this.loaded.set(true);
        console.warn('Failed to load news articles', err);
      },
    });
  }

  create(data: NewsArticleInput): Observable<NewsArticle> {
    return this.http.post<{ success: boolean; article: NewsArticle }>(BASE, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.article),
      tap(article => this.articlesSignal.update(list => [article, ...list]))
    );
  }

  update(id: string, data: NewsArticleInput): Observable<NewsArticle> {
    return this.http.put<{ success: boolean; article: NewsArticle }>(`${BASE}/${id}`, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.article),
      tap(article => this.articlesSignal.update(list => list.map(a => a.id === id ? article : a)))
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${BASE}/${id}`, {
      body: { adminId: this.adminAuth.adminId },
    }).pipe(
      map(() => undefined),
      tap(() => this.articlesSignal.update(list => list.filter(a => a.id !== id)))
    );
  }

  // ---------- Bình luận của bạn đọc ----------

  private commentsSignal = signal<AdminNewsComment[]>([]);
  readonly comments = this.commentsSignal.asReadonly();
  readonly commentsLoaded = signal(false);

  /** Ý kiến gốc của khách mà shop chưa trả lời trong luồng đó. */
  readonly unrepliedCount = computed(() => unrepliedRoots(this.commentsSignal()).length);

  refreshComments(): void {
    this.http.get<{ success: boolean; comments: AdminNewsComment[] }>(`${BASE}/admin/comments`).subscribe({
      next: res => {
        if (res.success) this.commentsSignal.set(res.comments);
        this.commentsLoaded.set(true);
      },
      error: () => this.commentsLoaded.set(true),
    });
  }

  /** Shop trả lời 1 ý kiến (chữ và/hoặc ảnh). */
  replyComment(articleId: string, parentId: string, text: string, imageUrl: string): Observable<AdminNewsComment> {
    return this.http.post<{ success: boolean; comment: AdminNewsComment }>(`${BASE}/${articleId}/staff-reply`, { parentId, text, imageUrl }).pipe(
      map(res => res.comment),
      tap(comment => {
        const article = this.commentsSignal().find(c => c.articleId === articleId);
        this.commentsSignal.update(list => [{ ...comment, articleTitle: article?.articleTitle || '', articleSlug: article?.articleSlug || '' }, ...list]);
      })
    );
  }
}

/** Ý kiến bạn đọc kèm tên / slug bài viết (GET /news/admin/comments). */
export interface AdminNewsComment {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  parentId: string | null;
  authorName: string;
  text: string;
  isStaff?: boolean;
  imageUrl?: string;
  likesCount: number;
  createdAt: string;
}

/** Ý kiến gốc của khách chưa có câu trả lời nào của shop trong luồng. */
export function unrepliedRoots(comments: AdminNewsComment[]): AdminNewsComment[] {
  const repliedRoots = new Set(comments.filter(c => c.isStaff && c.parentId).map(c => c.parentId));
  return comments.filter(c => !c.parentId && !c.isStaff && !repliedRoots.has(c.id));
}
