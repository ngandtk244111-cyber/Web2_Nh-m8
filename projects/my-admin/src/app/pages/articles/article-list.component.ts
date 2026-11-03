import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NewsService } from '../../core/services/news.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ARTICLE_CATEGORIES, ArticleCategory, NewsArticle } from '../../core/models/news.model';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { environment } from '../../../environments/environment';

/** Danh sách tin tức — theo blogmanage của Vita: thẻ thống kê, lọc chuyên mục, bảng bài viết. */
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

  ngOnInit(): void {
    this.newsService.refresh();
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
