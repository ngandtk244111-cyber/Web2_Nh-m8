import { ProductCategory } from './product.model';

export type DecorStyleTag = 'minimalist' | 'scandinavian' | 'industrial' | 'bohemian';

export interface QuizOption {
  id: string;
  label: string;
  tag: DecorStyleTag;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: QuizOption[];
}

export interface StyleResult {
  tag: DecorStyleTag;
  title: string;
  description: string;
  image: string;
  suggestedCategories: ProductCategory[];
  paletteHex: string[];
  /** Dấu hiệu nhận biết phong cách. */
  traits?: string[];
  /** Bí quyết phối đồ. */
  tips?: string[];
  avoid?: string[];
  /** Product.style khớp phong cách — lọc sản phẩm gợi ý. */
  productStyles?: string[];
  /** Loại sản phẩm của bộ phối sẵn (mỗi loại 1 món). */
  comboCategories?: string[];
}
