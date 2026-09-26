export type CategoryGroup = 'FURNITURE' | 'DECOR';

/**
 * Loại vật thể thật của sản phẩm (lưu ở DB). Cây danh mục hiển thị cho người dùng
 * (Nội thất › Sofa, Ánh sáng › Đèn ngủ...) nằm ở core/data/catalog-taxonomy.ts và map về các giá trị này.
 */
export type FurnitureCategory =
  | 'sofa'          // Sofa / ghế băng
  | 'bed'           // Giường
  | 'table'         // Bàn ăn / bàn trà / bàn làm việc
  | 'side_table'    // Bàn phụ / side table
  | 'chair'         // Ghế ăn / ghế làm việc / armchair
  | 'stool'         // Ghế đôn
  | 'cabinet'       // Tủ quần áo / tủ kệ / tủ giày
  | 'bookshelf'     // Kệ sách / Kệ treo tường
  | 'lamp'          // Đèn (dữ liệu cũ, chưa phân loại chi tiết)
  | 'desk_lamp'     // Đèn bàn
  | 'night_lamp'    // Đèn ngủ
  | 'pendant_lamp'  // Đèn thả / đèn cây trang trí
  | 'organizer';    // Khay bàn, Hộp đựng, Organizer để bàn

export type DecorCategory =
  | 'plant_pot'     // Chậu cây
  | 'vase'          // Bình hoa / Lọ decor
  | 'sculpture'     // Tượng trang trí / Figure / Mô hình
  | 'clock'         // Đồng hồ để bàn
  | 'frame'         // Khung ảnh
  | 'candle_holder' // Đế nến
  | 'tray'          // Đĩa hoặc khay decor
  | 'bookend';      // Giá đỡ sách / Bookend

export type ProductCategory = FurnitureCategory | DecorCategory;

/** Không gian sống phù hợp — dùng chung cho menu, filter, product detail. */
export type SpaceKey = 'phong-khach' | 'phong-ngu' | 'phong-lam-viec' | 'phong-hoc' | 'goc-chill';

export type ProductionType = 'READY_STOCK' | 'PRINT_ON_DEMAND';

export type ProductStyle = 'Minimalist' | 'Scandinavian' | 'Vintage' | 'Cute/Kawaii' | 'Modern' | 'Retro' | 'Japanese';

export type ProductColor = 'Trắng' | 'Đen' | 'Xám' | 'Be' | 'Pastel' | 'Xanh' | 'Hồng';

export type PrintMaterial = 'PLA' | 'PETG' | 'Resin' | 'Wood PLA' | 'Nhựa tái chế';

export type SizeCategory = 'Mini' | 'Nhỏ' | 'Trung bình' | 'Lớn' | 'Theo yêu cầu';

export interface ColorOption {
  name: string;
  hex: string;
  priceDelta: number;
}

export interface MaterialOption {
  id: string;
  name: string;
  description: string;
  priceDelta: number;
  roughness: number;
  metalness: number;
}

export interface SizeOption {
  id: string;
  label: string;
  scale: number;
  priceMultiplier: number;
  dimensions: string;
}

export interface FinishOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface AccessoryOption {
  id: string;
  name: string;
  priceDelta: number;
  defaultSelected?: boolean;
}

export interface CustomizationConfig {
  colors: ColorOption[];
  materials: MaterialOption[];
  sizes: SizeOption[];
  finishes: FinishOption[];
  textOption: {
    enabled: boolean;
    maxChars: number;
    priceDelta: number;
  };
  accessories: AccessoryOption[];
}

export interface SelectedCustomization {
  color: ColorOption;
  material: MaterialOption;
  size: SizeOption;
  finish: FinishOption;
  customText?: string;
  accessories: AccessoryOption[];
}

export interface ProductReview {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  comment: string;
  verifiedPurchase: boolean;
  images?: string[];
  /** Phản hồi công khai của nhân viên Luméa (soạn ở my-admin). */
  reply?: { text: string; date: string } | null;
  /** Nhân viên ghim đánh giá hay lên đầu danh sách. */
  pinned?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: ProductCategory;
  categoryName: string;
  categoryGroup: CategoryGroup;
  productionType: ProductionType;
  customizable: boolean;
  basePrice: number;
  originalPrice?: number;
  description: string;
  story?: string;
  rating: number;
  reviewCount: number;
  inStock: number;
  images: string[];
  badge?: string;
  dimensions: string;
  materialInfo: string;
  weight: string;
  features: string[];
  reviews: ProductReview[];
  customization?: CustomizationConfig;
  /**
   * Vừa là "có 3D hay không" (has3D = !!threeModelType) vừa là khoá để ThreeViewer tự tìm file
   * assets/models/<threeModelType>.glb thật — có thì load thật, chưa có thì fallback dựng bằng
   * code (xem product-scenes.ts). Không cần field model3D riêng vì cơ chế này đã tồn tại sẵn.
   */
  threeModelType?: 'moon_lamp' | 'geometric_vase' | 'desk_organizer' | 'cube_stool' | 'wall_shelf' | 'abstract_sculpture';
  /** Thời gian sản xuất dự kiến — chỉ có ý nghĩa với PRINT_ON_DEMAND. */
  productionTime?: string;
  /** Công nghệ in 3D thật của sản phẩm (vd: "FDM 0.16mm, PLA") — chỉ có ý nghĩa với PRINT_ON_DEMAND. */
  printTechnology?: string;
  /** 0/1/2 = thuộc khung Flash Sale hôm nay/ngày mai/ngày kia; null/undefined = không thuộc Flash Sale. */
  flashSaleSlot?: 0 | 1 | 2 | null;
  /** Thuộc tính lọc cho trang Tất cả sản phẩm — độc lập với category (loại vật thể). */
  style?: ProductStyle;
  color?: ProductColor;
  printMaterial?: PrintMaterial;
  sizeCategory?: SizeCategory;
  /** Không gian phù hợp. Không có thì suy ra mặc định theo category (xem spacesOf trong catalog-taxonomy.ts). */
  spaces?: SpaceKey[];
  /** Trả về sẵn từ Mongoose timestamps — dùng cho sắp xếp "Mới nhất". */
  createdAt?: string;
}
