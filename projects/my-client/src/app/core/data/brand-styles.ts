import { ProductStyle } from '../models/product.model';

/**
 * Luméa bán trực tiếp (không đa thương hiệu) nên "Thương Hiệu Ưa Thích" là các dòng phong cách riêng.
 * File này giữ quy ước slug + hashtag cộng đồng dùng chung cho trang thương hiệu và mục ở trang chủ.
 */
export const BRAND_STYLES: ProductStyle[] = [
  'Minimalist', 'Scandinavian', 'Vintage', 'Cute/Kawaii', 'Modern', 'Retro', 'Japanese',
];

export const BRAND_TAGLINES: Record<ProductStyle, string> = {
  'Minimalist': 'Dòng decor tối giản cho những góc nhỏ gọn gàng',
  'Scandinavian': 'Dòng decor Bắc Âu ấm áp, gỗ sáng và màu trung tính',
  'Vintage': 'Dòng decor hoài cổ với chất liệu và tông màu ấm',
  'Cute/Kawaii': 'Dòng decor dễ thương, nhỏ xinh cho bàn học và phòng ngủ',
  'Modern': 'Dòng decor hiện đại, đường nét gọn và chất liệu bền',
  'Retro': 'Dòng decor retro đầy cá tính cho không gian sống',
  'Japanese': 'Dòng decor Nhật Bản thanh tĩnh, mộc và tinh tế',
};

/** Hashtag cộng đồng tương ứng từng dòng phong cách (để lọc bài đăng "được gắn thẻ"). */
export const BRAND_HASHTAGS: Record<ProductStyle, string> = {
  'Minimalist': '#minimalist',
  'Scandinavian': '#scandinavian',
  'Vintage': '#vintage',
  'Cute/Kawaii': '#kawaii',
  'Modern': '#modern',
  'Retro': '#retro',
  'Japanese': '#japandi',
};

export function styleSlug(style: ProductStyle): string {
  return style.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

export function styleFromSlug(slug: string | null | undefined): ProductStyle | undefined {
  return BRAND_STYLES.find(s => styleSlug(s) === slug);
}
