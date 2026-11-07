import { Product, ProductCategory } from '../../core/models/product.model';

export interface ProductCategoryOption {
  value: ProductCategory;
  label: string;
  group: 'FURNITURE' | 'DECOR';
  section: string;
}

/** Khớp ProductCategory của my-client (cây danh mục: core/data/catalog-taxonomy.ts bên my-client). */
export const PRODUCT_CATEGORY_OPTIONS: ProductCategoryOption[] = [
  { value: 'sofa', label: 'Sofa', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'bed', label: 'Giường', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'table', label: 'Bàn', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'side_table', label: 'Bàn Phụ & Side Table', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'chair', label: 'Ghế', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'stool', label: 'Ghế Đôn & Ghế Phụ', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'cabinet', label: 'Tủ', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'bookshelf', label: 'Kệ Sách & Kệ Treo Tường', group: 'FURNITURE', section: 'Nội thất' },
  { value: 'desk_lamp', label: 'Đèn Bàn', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
  { value: 'night_lamp', label: 'Đèn Ngủ', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
  { value: 'pendant_lamp', label: 'Đèn Trang Trí (thả/cây)', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
  { value: 'lamp', label: 'Đèn Decor', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
  { value: 'vase', label: 'Bình Hoa & Lọ Decor', group: 'DECOR', section: 'Decor' },
  { value: 'candle_holder', label: 'Đế Nến', group: 'DECOR', section: 'Decor' },
  { value: 'clock', label: 'Đồng Hồ Decor', group: 'DECOR', section: 'Decor' },
  { value: 'sculpture', label: 'Tượng & Figure', group: 'DECOR', section: 'Decor' },
  { value: 'plant_pot', label: 'Chậu Cây', group: 'DECOR', section: 'Decor' },
  { value: 'frame', label: 'Khung Ảnh', group: 'DECOR', section: 'Decor' },
  { value: 'mirror', label: 'Gương Trang Trí', group: 'DECOR', section: 'Decor' },
  { value: 'organizer', label: 'Khay & Hộp Đựng', group: 'FURNITURE', section: 'Đồ dùng & phụ kiện' },
  { value: 'tray', label: 'Khay Decor', group: 'DECOR', section: 'Đồ dùng & phụ kiện' },
  { value: 'bookend', label: 'Giá Đỡ & Bookend', group: 'DECOR', section: 'Đồ dùng & phụ kiện' },
  { value: 'household', label: 'Đồ Dùng Gia Đình', group: 'DECOR', section: 'Đồ dùng & phụ kiện' },
];

/** Danh mục chia theo nhóm lớn — dùng cho <optgroup>. */
export const PRODUCT_CATEGORY_SECTIONS: { section: string; options: ProductCategoryOption[] }[] =
  [...new Set(PRODUCT_CATEGORY_OPTIONS.map(o => o.section))].map(section => ({
    section,
    options: PRODUCT_CATEGORY_OPTIONS.filter(o => o.section === section),
  }));

export function categorySectionOf(category: string): string | undefined {
  return PRODUCT_CATEGORY_OPTIONS.find(o => o.value === category)?.section;
}

export const THREE_MODEL_TYPES: { value: NonNullable<Product['threeModelType']>; label: string }[] = [
  { value: 'moon_lamp', label: 'Đèn mặt trăng' },
  { value: 'geometric_vase', label: 'Bình hình học' },
  { value: 'desk_organizer', label: 'Khay để bàn' },
  { value: 'cube_stool', label: 'Ghế đôn khối' },
  { value: 'wall_shelf', label: 'Kệ treo tường' },
  { value: 'abstract_sculpture', label: 'Tượng trừu tượng' },
];

/** Nhãn badge hiển thị trên thẻ sản phẩm bên my-client. Rỗng = không gắn nhãn. */
export const PRODUCT_BADGE_OPTIONS: string[] = [
  'Mới',
  'Bán chạy',
  'Giảm giá',
  'Thanh lý',
  'Có Sẵn Giao Nhanh',
  'In 3D Độc Bản',
  'In 3D Theo Yêu Cầu',
];

export function productionTypeLabel(type: string): string {
  return type === 'PRINT_ON_DEMAND' ? 'In 3D theo yêu cầu' : 'Hàng có sẵn';
}
