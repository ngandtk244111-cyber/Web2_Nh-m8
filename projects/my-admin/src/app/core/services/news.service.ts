import { Injectable, signal, inject } from '@angular/core';
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

  refresh(): void {
    this.http.get<{ success: boolean; articles: NewsArticle[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.articlesSignal.set(res.articles);
      },
      error: (err) => console.warn('Failed to load news articles', err),
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
}
