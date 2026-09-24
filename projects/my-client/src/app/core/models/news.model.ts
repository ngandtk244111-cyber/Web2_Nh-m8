export type ArticleCategory =
  | 'Xu hướng Decor'
  | 'Kiến thức In 3D'
  | 'Bộ sưu tập & Room Look'
  | 'Kinh nghiệm & Hậu trường';

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

/** Ý kiến bạn đọc dưới bài Tin tức — parentId khác null là câu trả lời (lồng 1 cấp). */
export interface NewsComment {
  id: string;
  articleId: string;
  parentId: string | null;
  authorName: string;
  text: string;
  likesCount: number;
  createdAt: string; // ISO date
  isLiked?: boolean;
}
