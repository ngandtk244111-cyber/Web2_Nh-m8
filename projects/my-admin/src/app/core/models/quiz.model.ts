export type StyleTag = 'minimalist' | 'scandinavian' | 'industrial' | 'bohemian';

export interface QuizOption {
  id: string;
  label: string;
  tag: StyleTag;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: QuizOption[];
  order: number;
  active: boolean;
}

export interface QuizResult {
  tag: StyleTag;
  title: string;
  description: string;
  image: string;
  suggestedCategories: string[];
  paletteHex: string[];
  traits?: string[];
  tips?: string[];
  avoid?: string[];
  /** Product.style khớp phong cách — lọc sản phẩm gợi ý. */
  productStyles?: string[];
  /** Loại sản phẩm của bộ phối sẵn. */
  comboCategories?: string[];
}
