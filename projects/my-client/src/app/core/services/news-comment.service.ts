import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { NewsComment } from '../models/news.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/news`;
// Đã thích ý kiến nào là trạng thái cục bộ theo trình duyệt (giống like bài Cộng đồng),
// server chỉ giữ số đếm likesCount.
const LIKED_KEY = 'lumea_news_comment_liked';

@Injectable({
  providedIn: 'root'
})
export class NewsCommentService {
  private http = inject(HttpClient);
  private likedIds = new Set<string>(this.loadLiked());

  private loadLiked(): string[] {
    try {
      const stored = localStorage.getItem(LIKED_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
  }

  private persistLiked(): void {
    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify([...this.likedIds]));
    } catch { /* ignore */ }
  }

  private withLocalFlag(c: NewsComment): NewsComment {
    return { ...c, isLiked: this.likedIds.has(c.id) };
  }

  list(articleId: string): Observable<NewsComment[]> {
    return this.http
      .get<{ success: boolean; comments: NewsComment[] }>(`${BASE}/${articleId}/comments`)
      .pipe(map(res => (res.success ? res.comments.map(c => this.withLocalFlag(c)) : [])));
  }

  add(articleId: string, userId: string, text: string, parentId: string | null = null): Observable<NewsComment> {
    return this.http
      .post<{ success: boolean; comment: NewsComment }>(`${BASE}/${articleId}/comments`, { userId, text, parentId })
      .pipe(map(res => this.withLocalFlag(res.comment)));
  }

  /** Đảo trạng thái thích; trả về ý kiến đã cập nhật số đếm từ server. */
  toggleLike(comment: NewsComment): Observable<NewsComment> {
    const action = this.likedIds.has(comment.id) ? 'unlike' : 'like';
    return this.http
      .post<{ success: boolean; comment: NewsComment }>(`${BASE}/comments/${comment.id}/${action}`, {})
      .pipe(
        // Chỉ ghi nhận trạng thái thích khi server đã cập nhật số đếm thành công.
        tap(() => {
          if (action === 'like') this.likedIds.add(comment.id);
          else this.likedIds.delete(comment.id);
          this.persistLiked();
        }),
        map(res => this.withLocalFlag(res.comment))
      );
  }
}
