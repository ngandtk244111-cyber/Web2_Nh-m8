import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuillModule } from 'ngx-quill';
import { NewsService } from '../../core/services/news.service';
import { ProductService } from '../../core/services/product.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ARTICLE_CATEGORIES, ArticleCategory, NewsArticle } from '../../core/models/news.model';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { htmlToMarkdown, markdownToHtml } from './article-content';

/** Chỉ các định dạng trang Tin tức của my-client hiển thị được: tiêu đề, in đậm, gạch đầu dòng. */
const EDITOR_MODULES = {
  toolbar: [[{ header: 3 }], ['bold'], [{ list: 'bullet' }], ['clean']],
};

const emptyForm = () => ({
  title: '',
  category: 'Xu hướng' as ArticleCategory,
  excerpt: '',
  contentHtml: '',
  coverImage: '',
  videoUrl: '',
  readTime: '5 phút đọc',
  authorName: 'Luméa Editorial',
  authorRole: 'Biên tập viên Luméa',
  tags: '',
  featured: false,
});

/** Soạn / sửa bài tin tức — theo blogdetail của Vita: cột trái nội dung, cột phải ảnh bìa & thông tin. */
@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QuillModule, MascotLoadingComponent],
  templateUrl: './article-form.component.html',
  styleUrl: './article-form.component.css',
})
export class ArticleFormComponent implements OnInit {
  private newsService = inject(NewsService);
  private productService = inject(ProductService);
  readonly adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly categories = ARTICLE_CATEGORIES;
  readonly editorModules = EDITOR_MODULES;

  articleId: string | null = null;
  editing: NewsArticle | null = null;
  loading = signal(false);
  notFound = signal(false);
  saving = false;
  uploading = false;
  form = emptyForm();

  ngOnInit(): void {
    this.articleId = this.route.snapshot.paramMap.get('id');
    if (!this.articleId) {
      this.form.authorName = this.adminAuth.currentAdmin()?.fullName || 'Luméa Editorial';
      return;
    }
    const found = this.newsService.articles().find(a => a.id === this.articleId);
    if (found) {
      this.fill(found);
      return;
    }
    // Mở thẳng URL sửa bài: chờ tải danh sách rồi tìm bài.
    this.loading.set(true);
    this.newsService.refresh();
  }

  constructor() {
    effect(() => {
      if (!this.loading() || !this.newsService.loaded()) return;
      const article = this.newsService.articles().find(a => a.id === this.articleId);
      untracked(() => {
        this.loading.set(false);
        if (article) this.fill(article);
        else this.notFound.set(true);
      });
    });
  }

  get isEdit(): boolean {
    return !!this.articleId;
  }

  get canSave(): boolean {
    return this.adminAuth.can(this.isEdit ? 'content.edit' : 'content.create');
  }

  private fill(a: NewsArticle): void {
    this.editing = a;
    this.form = {
      title: a.title,
      category: a.category,
      excerpt: a.excerpt || '',
      contentHtml: markdownToHtml(a.content || ''),
      coverImage: a.coverImage || '',
      videoUrl: a.videoUrl || '',
      readTime: a.readTime || '',
      authorName: a.author?.name || '',
      authorRole: a.author?.role || '',
      tags: (a.tags || []).join(', '),
      featured: !!a.featured,
    };
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading = true;
    this.productService.uploadImage(file).subscribe({
      next: url => {
        this.form.coverImage = url;
        this.uploading = false;
      },
      error: err => {
        this.uploading = false;
        this.toast.apiError(err, 'Không tải được ảnh lên server');
      },
    });
  }

  /** Ước lượng thời gian đọc ~200 từ/phút. */
  estimateReadTime(): void {
    const words = htmlToMarkdown(this.form.contentHtml).split(/\s+/).filter(Boolean).length;
    this.form.readTime = `${Math.max(1, Math.round(words / 200))} phút đọc`;
  }

  goBack(): void {
    this.router.navigate(['/articles']);
  }

  save(): void {
    const f = this.form;
    if (this.saving || !this.canSave) return;
    const content = htmlToMarkdown(f.contentHtml);
    if (!f.title.trim() || !content.trim()) {
      this.toast.warning('Vui lòng nhập tiêu đề và nội dung bài viết');
      return;
    }
    if (f.videoUrl.trim() && !/^https?:\/\//.test(f.videoUrl.trim())) {
      this.toast.warning('Link video phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    const editing = this.editing;
    const payload = {
      title: f.title.trim(),
      category: f.category,
      excerpt: f.excerpt.trim(),
      content,
      coverImage: f.coverImage.trim(),
      videoUrl: f.videoUrl.trim() || undefined,
      readTime: f.readTime.trim(),
      featured: f.featured,
      tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
      author: {
        name: f.authorName.trim() || 'Luméa Editorial',
        role: f.authorRole.trim(),
        avatar: editing?.author?.avatar || '',
      },
    };
    this.saving = true;
    const request = editing ? this.newsService.update(editing.id, payload) : this.newsService.create(payload);
    request.subscribe({
      next: art => {
        this.saving = false;
        this.toast.success(editing ? `Đã cập nhật bài "${art.title}"` : `Đã đăng bài "${art.title}" lên trang Tin tức`);
        this.audit.record('Tin Tức', editing ? 'Sửa bài viết' : 'Đăng bài viết', art.title, 'SUCCESS');
        this.router.navigate(['/articles']);
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được bài viết');
      },
    });
  }
}
