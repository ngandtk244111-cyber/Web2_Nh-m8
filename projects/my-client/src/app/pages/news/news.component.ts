import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { NewsService } from '../../core/services/news.service';
import { ProductService } from '../../core/services/product.service';
import { NewsArticle, ArticleCategory } from '../../core/models/news.model';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ToastService } from '../../core/services/toast.service';
import { NewsCommentsComponent } from './news-comments/news-comments.component';

interface TextRun {
  text: string;
  bold: boolean;
}

/** Khối nội dung đã tách từ markdown đơn giản của bài viết (### tiêu đề, - gạch đầu dòng, **đậm**). */
interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list';
  runs?: TextRun[];
  items?: TextRun[][];
}

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe, NewsCommentsComponent],
  templateUrl: './news.component.html',
  styleUrl: './news.component.css'
})
export class NewsComponent implements OnInit {
  articles: NewsArticle[] = [];
  displayedArticles: NewsArticle[] = [];
  selectedArticle: NewsArticle | null = null;
  selectedCategory: ArticleCategory | 'ALL' = 'ALL';

  categories: ArticleCategory[] = [
    'Xu hướng Decor',
    'Kiến thức In 3D',
    'Bộ sưu tập & Room Look',
    'Kinh nghiệm & Hậu trường',
  ];

  requestedSlug: string | null = null;

  /** Nội dung bài đang xem, đã tách sẵn thành khối để render bằng template (không dùng innerHTML). */
  contentBlocks: ContentBlock[] = [];
  private parsedFor: string | null = null;

  constructor(
    private newsService: NewsService,
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService
  ) {
    // Bài viết giờ nạp bất đồng bộ từ backend — effect() tự đồng bộ danh sách hiển thị + bài
    // đang xem lại mỗi khi signal đổi, thay vì chỉ đọc 1 lần lúc ngOnInit.
    effect(() => {
      this.articles = this.newsService.articles();
      this.displayedArticles = this.newsService.getArticlesByCategory(this.selectedCategory);
      if (this.requestedSlug) {
        const found = this.newsService.getArticleBySlug(this.requestedSlug);
        if (found) this.selectedArticle = found;
      }
      this.syncContent();
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.requestedSlug = params.get('slug');
      if (this.requestedSlug) {
        const found = this.newsService.getArticleBySlug(this.requestedSlug);
        this.selectedArticle = found ?? null;
        if (found) window.scrollTo({ top: 0 });
      } else {
        this.selectedArticle = null;
      }
      this.syncContent();
    });
  }

  private syncContent(): void {
    const a = this.selectedArticle;
    if (!a) {
      this.contentBlocks = [];
      this.parsedFor = null;
      return;
    }
    if (this.parsedFor === a.id) return;
    this.parsedFor = a.id;
    this.contentBlocks = this.parseContent(a.content);
  }

  private runs(text: string): TextRun[] {
    return text.split('**').map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter(r => r.text !== '');
  }

  private parseContent(content: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    let para: string[] = [];
    let list: TextRun[][] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ type: 'paragraph', runs: this.runs(para.join(' ')) });
      para = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ type: 'list', items: list });
      list = [];
    };
    for (const raw of (content || '').split('\n')) {
      const line = raw.trim();
      if (!line) { flushPara(); flushList(); continue; }
      if (line.startsWith('### ')) {
        flushPara(); flushList();
        blocks.push({ type: 'heading', runs: this.runs(line.slice(4)) });
      } else if (line.startsWith('- ')) {
        flushPara();
        list.push(this.runs(line.slice(2)));
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara(); flushList();
    return blocks;
  }

  /** Bài xem nhiều (cột phải) — loại bài đang xem, xếp theo lượt xem. */
  get otherArticles(): NewsArticle[] {
    return this.articles
      .filter(a => a.id !== this.selectedArticle?.id)
      .sort((a, b) => b.viewsCount - a.viewsCount)
      .slice(0, 5);
  }

  /** "Cùng chuyên mục" dưới mục Ý kiến — cùng danh mục với bài đang xem. */
  get sameCategoryArticles(): NewsArticle[] {
    const art = this.selectedArticle;
    if (!art) return [];
    return this.articles.filter(a => a.id !== art.id && a.category === art.category).slice(0, 4);
  }

  shareArticle(a: NewsArticle): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: a.title, text: a.excerpt, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(
      () => this.toast.success('Đã sao chép liên kết bài viết'),
      () => {}
    );
  }

  get taggedProducts(): Product[] {
    return (this.selectedArticle?.taggedProductIds ?? [])
      .map(id => this.getProduct(id))
      .filter((p): p is Product => !!p);
  }

  filterCategory(cat: ArticleCategory | 'ALL'): void {
    this.selectedCategory = cat;
    this.displayedArticles = this.newsService.getArticlesByCategory(cat);
  }

  openArticle(a: NewsArticle): void {
    this.router.navigate(['/news', a.slug]);
  }

  getProduct(id: string): Product | undefined {
    return this.productService.getProductById(id);
  }
}
