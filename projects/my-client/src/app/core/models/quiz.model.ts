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
}
