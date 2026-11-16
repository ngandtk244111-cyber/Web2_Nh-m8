import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NewsService, unrepliedRoots } from '../../core/services/news.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ARTICLE_CATEGORIES, ArticleCategory, NewsArticle } from '../../core/models/news.model';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { environment } from '../../../environments/environment';


@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PagerComponent],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.css',
})
export class ArticleListComponent implements OnInit {
  private newsService = inject(NewsService);
  readonly adminAuth = inject(AdminAuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly categories = ARTICLE_CATEGORIES;
  readonly clientAppUrl = environment.clientAppUrl;
  readonly articles = this.newsService.articles;

  category = signal<ArticleCategory | 'ALL'>('ALL');
  featuredOnly = signal(false);
  search = signal('');
  page = signal(1);
  readonly pageSize = 15;

  readonly totalViews = computed(() => this.articles().reduce((sum, a) => sum + (a.viewsCount || 0), 0));
  readonly featuredCount = computed(() => this.articles().filter(a => a.featured).length);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.articles().filter(a =>
      (this.category() === 'ALL' || a.category === this.category()) &&
      (!this.featuredOnly() || a.featured) &&
      (!q || a.title.toLowerCase().includes(q) || (a.author?.name || '').toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q))));
  });

  readonly visible = computed(() => pageSlice(this.filtered(), this.page(), this.pageSize));

  /** Số ý kiến của khách (không tính trả lời) và số chưa được shop trả lời, theo từng bài. */
  readonly commentStats = computed(() => {
    const comments = this.newsService.comments();
    const unreplied = new Set(unrepliedRoots(comments).map(c => c.id));
    const stats = new Map<string, { total: number; unreplied: number }>();
    for (const c of comments) {
      if (c.parentId || c.isStaff) continue;
      const s = stats.get(c.articleId) || { total: 0, unreplied: 0 };
      s.total++;
      if (unreplied.has(c.id)) s.unreplied++;
      stats.set(c.articleId, s);
    }
    return stats;
  });

  ngOnInit(): void {
    this.newsService.refresh();
    this.newsService.refreshComments();
  }

  categoryCount(c: ArticleCategory): number {
    return this.articles().filter(a => a.category === c).length;
  }

  setCategory(c: ArticleCategory | 'ALL'): void {
    this.category.set(c);
    this.page.set(1);
  }

  showFeatured(on: boolean): void {
    this.featuredOnly.set(on);
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  edit(a: NewsArticle): void {
    this.router.navigate(['/articles/edit', a.id]);
  }

  toggleFeatured(a: NewsArticle): void {
    this.newsService.update(a.id, { featured: !a.featured }).subscribe({
      next: updated => {
        this.toast.info(updated.featured ? 'Đã đặt làm bài nổi bật' : 'Đã bỏ nổi bật');
        this.audit.record('Tin Tức', updated.featured ? 'Đặt bài nổi bật' : 'Bỏ bài nổi bật', a.title, 'INFO');
      },
      error: err => this.toast.apiError(err, 'Không cập nhật được bài viết'),
    });
  }

  async remove(a: NewsArticle): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá bài viết?',
      message: `"${a.title}" và toàn bộ ý kiến bạn đọc của bài sẽ bị xoá.`,
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.newsService.delete(a.id).subscribe({
      next: () => {
        this.toast.info('Đã xoá bài viết');
        this.audit.record('Tin Tức', 'Xoá bài viết', a.title, 'WARNING');
      },
      error: err => this.toast.apiError(err, 'Không xoá được bài viết'),
    });
  }
}
