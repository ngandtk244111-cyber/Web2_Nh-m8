import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NewsArticle, ArticleCategory } from '../models/news.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/news`;

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private http = inject(HttpClient);

  private articlesSignal = signal<NewsArticle[]>([]);
  readonly articles = this.articlesSignal.asReadonly();

  readonly featuredArticle = computed(() =>
    this.articlesSignal().find(a => a.featured) || this.articlesSignal()[0]
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.http.get<{ success: boolean; articles: NewsArticle[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.articlesSignal.set(res.articles);
      },
      error: (err) => console.warn('Failed to load news articles', err),
    });
  }

  getArticleBySlug(slug: string): NewsArticle | undefined {
    return this.articlesSignal().find(a => a.slug === slug);
  }

  getArticlesByCategory(category: ArticleCategory | 'ALL'): NewsArticle[] {
    if (category === 'ALL') return this.articlesSignal();
    return this.articlesSignal().filter(a => a.category === category);
  }

  // Admin methods
  createArticle(data: Omit<NewsArticle, 'id' | 'viewsCount' | 'publishedAt'>): void {
    this.http.post<{ success: boolean; article: NewsArticle }>(BASE, data).subscribe({
      next: (res) => {
        if (res.success) this.articlesSignal.update(list => [res.article, ...list]);
      },
    });
  }

  updateArticle(id: string, updates: Partial<NewsArticle>): void {
    this.http.put<{ success: boolean; article: NewsArticle }>(`${BASE}/${id}`, updates).subscribe({
      next: (res) => {
        if (res.success) this.articlesSignal.update(list => list.map(a => a.id === id ? res.article : a));
      },
    });
  }

  deleteArticle(id: string): void {
    this.http.delete<{ success: boolean }>(`${BASE}/${id}`).subscribe({
      next: (res) => {
        if (res.success) this.articlesSignal.update(list => list.filter(a => a.id !== id));
      },
    });
  }
}
