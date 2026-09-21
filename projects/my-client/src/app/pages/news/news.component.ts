import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NewsService } from '../../core/services/news.service';
import { ProductService } from '../../core/services/product.service';
import { NewsArticle, ArticleCategory } from '../../core/models/news.model';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
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

  private requestedSlug: string | null = null;

  constructor(
    private newsService: NewsService,
    private productService: ProductService,
    private route: ActivatedRoute
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
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.requestedSlug = params.get('slug');
      if (this.requestedSlug) {
        const found = this.newsService.getArticleBySlug(this.requestedSlug);
        if (found) this.selectedArticle = found;
      }
    });
  }

  filterCategory(cat: ArticleCategory | 'ALL'): void {
    this.selectedCategory = cat;
    this.displayedArticles = this.newsService.getArticlesByCategory(cat);
  }

  openArticle(a: NewsArticle): void {
    this.selectedArticle = a;
  }

  getProduct(id: string): Product | undefined {
    return this.productService.getProductById(id);
  }
}
