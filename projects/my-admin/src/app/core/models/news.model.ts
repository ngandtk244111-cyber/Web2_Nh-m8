/** Chuyên mục của Luméa Living (Tin tức & Mẹo sống). */
export type ArticleCategory =
  | 'Xu hướng'
  | 'Mẹo sống'
  | 'Phong cách'
  | 'Phong thủy'
  | 'Cảm hứng'
  | '3D & Design';

/** Thứ tự hiển thị các chuyên mục ở bộ lọc (trang chủ + trang /news + admin). */
export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  'Xu hướng',
  'Mẹo sống',
  'Phong cách',
  'Phong thủy',
  'Cảm hứng',
  '3D & Design',
];

/** Chuyên mục cũ (trước khi gộp Tin tức + Mẹo sống) -> chuyên mục mới, dùng khi DB chưa migrate. */
export const LEGACY_ARTICLE_CATEGORY: Record<string, ArticleCategory> = {
  'Xu hướng Decor': 'Xu hướng',
  'Kiến thức In 3D': '3D & Design',
  'Bộ sưu tập & Room Look': 'Cảm hứng',
  'Kinh nghiệm & Hậu trường': '3D & Design',
};

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Markdown / HTML formatted
  coverImage: string;
  videoUrl?: string; // TikTok or Reel embed/video mock
  category: ArticleCategory;
  readTime: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  featured: boolean;
  tags: string[];
  taggedProductIds: string[];
  viewsCount: number;
}
