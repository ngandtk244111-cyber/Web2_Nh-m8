import { Product, SelectedCustomization } from './product.model';

export interface CartItem {
  id: string; // Unique cart item ID (allows same product with different customizations)
  product: Product;
  quantity: number;
  selectedCustomization?: SelectedCustomization;
  unitPrice: number;
  totalPrice: number;
}

export interface Coupon {
  code: string;
  description: string;
  discountPercent: number;
  maxDiscount: number;
  minSpend: number;
}
