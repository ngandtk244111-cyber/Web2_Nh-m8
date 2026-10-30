import { Product, SelectedCustomization } from './product.model';

export interface CartItem {
  id: string; // Unique cart item ID (allows same product with different customizations)
  product: Product;
  quantity: number;
  selectedCustomization?: SelectedCustomization;
  unitPrice: number;
  totalPrice: number;
}

/** Mã giảm giá đang áp dụng: mã công khai của shop (Coupon) hoặc voucher cá nhân (UserVoucher). */
export interface Coupon {
  code: string;
  description: string;
  discountPercent: number;
  /** Voucher giảm thẳng số tiền (chỉ voucher cá nhân) — có thì bỏ qua discountPercent. */
  discountAmount?: number;
  maxDiscount: number;
  minSpend: number;
  /** Tên ngắn hiển thị, vd "Giảm 20.000đ". */
  title?: string;
}
