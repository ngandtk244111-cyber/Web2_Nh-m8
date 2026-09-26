import { Product, ProductCategory, SpaceKey } from '../models/product.model';

/**
 * CÂY DANH MỤC DÙNG CHUNG của Luméa (Nội thất + Decor + 3D Custom).
 *
 * Nguồn sự thật duy nhất cho: mega menu (header), sidebar filter (catalog), breadcrumb/thông tin
 * (product detail), danh mục trang chủ, footer, search. Mỗi danh mục con map về các
 * ProductCategory thật đang lưu ở DB — không tạo hệ thống category song song.
 */

export type DepartmentKey = 'noi-that' | 'anh-sang' | 'decor' | 'do-dung';

export interface CatalogSubcategory {
  /** Slug dùng trên URL: /catalog?cat=<key> */
  key: string;
  label: string;
  categories: ProductCategory[];
  /**
   * Dữ liệu cũ chưa phân loại chi tiết (vd. mọi loại đèn đều là 'lamp'): khớp thêm khi
   * category nằm trong danh sách và tên sản phẩm chứa một trong các từ khoá.
   */
  legacy?: { categories: ProductCategory[]; keywords: string[] };
  /** Ảnh đại diện — dùng cho thẻ trong mega menu, dải danh mục ở trang sản phẩm, trang chủ. */
  image: string;
}

export interface CatalogDepartment {
  key: DepartmentKey;
  label: string;
  description: string;
  image: string;
  subcategories: CatalogSubcategory[];
}

export interface CatalogSpace {
  key: SpaceKey;
  label: string;
  image: string;
}

export interface CatalogLink {
  label: string;
  link: string;
  queryParams?: Record<string, string>;
  image?: string;
}

const img = (id: string, w = 480) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
/** Minh hoạ 3D tông kem có sẵn trong assets (cùng bộ với trang chủ). */
const art = (name: string) => `assets/categories/${name}.png`;

export const CATALOG_DEPARTMENTS: CatalogDepartment[] = [
  {
    key: 'noi-that',
    label: 'Nội thất',
    description: 'Sofa, giường, bàn ghế, tủ kệ cho không gian sống trọn vẹn.',
    image: img('1618220179428-22790b461013'),
    subcategories: [
      { key: 'sofa', label: 'Sofa', categories: ['sofa'], image: img('1555041469-a586c61ea9bc') },
      { key: 'giuong', label: 'Giường', categories: ['bed'], image: img('1505693416388-ac5ce068fe85') },
      { key: 'ban', label: 'Bàn', categories: ['table', 'side_table'], image: img('1577140917170-285929fb55b7') },
      { key: 'ghe', label: 'Ghế', categories: ['chair', 'stool'], image: img('1598300042247-d088f8ab3a91') },
      { key: 'tu', label: 'Tủ', categories: ['cabinet'], image: img('1558997519-83ea9252edf8') },
      { key: 'ke', label: 'Kệ', categories: ['bookshelf'], image: img('1594620302200-9a762244a156') },
    ],
  },
  {
    key: 'anh-sang',
    label: 'Đèn & ánh sáng',
    description: 'Đèn bàn, đèn ngủ, đèn thả và đèn decor tạo điểm nhấn.',
    image: img('1507473885765-e6ed057f782c'),
    subcategories: [
      { key: 'den-ban', label: 'Đèn bàn', image: img('1507473885765-e6ed057f782c'), categories: ['desk_lamp'], legacy: { categories: ['lamp'], keywords: ['đèn bàn', 'desk'] } },
      { key: 'den-ngu', label: 'Đèn ngủ', image: img('1543198126-a8ad8e47fb22'), categories: ['night_lamp'], legacy: { categories: ['lamp'], keywords: ['đèn ngủ', 'night', 'moon', 'mặt trăng'] } },
      { key: 'den-trang-tri', label: 'Đèn trang trí', image: img('1513506003901-1e6a229e2d15'), categories: ['pendant_lamp'], legacy: { categories: ['lamp'], keywords: ['thả', 'treo', 'pendant', 'đèn cây', 'trang trí'] } },
      { key: 'den-decor', label: 'Đèn decor', image: img('1615529182904-14819c35db37'), categories: [], legacy: { categories: ['lamp'], keywords: ['decor', '3d', 'mặt trăng', 'moon', 'nghệ thuật'] } },
    ],
  },
  {
    key: 'decor',
    label: 'Decor',
    description: 'Bình hoa, tượng, chậu cây, khung ảnh — hoàn thiện cá tính cho căn phòng.',
    image: img('1513519245088-0e12902e5a38'),
    subcategories: [
      { key: 'do-trang-tri', label: 'Đồ trang trí', image: art('phong-cach'), categories: ['vase', 'candle_holder', 'clock'] },
      { key: 'tuong-figure', label: 'Tượng & figure', image: art('tuong-mo-hinh'), categories: ['sculpture'] },
      { key: 'chau-cay', label: 'Chậu cây', image: art('chau-cay'), categories: ['plant_pot'] },
      { key: 'khung-anh', label: 'Khung ảnh', image: img('1543487945-139a97f387d5'), categories: ['frame'] },
    ],
  },
  {
    key: 'do-dung',
    label: 'Đồ dùng & phụ kiện',
    description: 'Khay, hộp đựng, giá đỡ — phụ kiện decor gọn gàng cho bàn làm việc.',
    image: img('1524758631624-e2822e304c36'),
    subcategories: [
      { key: 'khay-hop-dung', label: 'Khay & hộp đựng', image: art('phu-kien'), categories: ['organizer', 'tray'] },
      { key: 'gia-do', label: 'Giá đỡ & bookend', image: art('decor-ban'), categories: ['bookend'] },
    ],
  },
];

export const CATALOG_SPACES: CatalogSpace[] = [
  { key: 'phong-khach', label: 'Phòng khách', image: img('1618220179428-22790b461013') },
  { key: 'phong-ngu', label: 'Phòng ngủ', image: img('1615874959474-d609969a20ed') },
  { key: 'phong-lam-viec', label: 'Phòng làm việc', image: img('1611269154421-4e27233ac5c7') },
  { key: 'phong-hoc', label: 'Phòng học', image: img('1449247709967-d4461a6a6103') },
  { key: 'goc-chill', label: 'Góc chill', image: img('1586023492125-27b2c045efd7') },
];

/** Không gian mặc định theo loại vật thể — dùng khi sản phẩm chưa khai báo Product.spaces. */
const DEFAULT_SPACES: Record<ProductCategory, SpaceKey[]> = {
  sofa: ['phong-khach', 'goc-chill'],
  bed: ['phong-ngu'],
  table: ['phong-khach', 'phong-lam-viec'],
  side_table: ['phong-khach', 'phong-ngu', 'goc-chill'],
  chair: ['phong-lam-viec', 'phong-hoc', 'phong-khach'],
  stool: ['phong-khach', 'goc-chill'],
  cabinet: ['phong-ngu', 'phong-khach'],
  bookshelf: ['phong-lam-viec', 'phong-hoc', 'phong-khach'],
  lamp: ['phong-ngu', 'phong-lam-viec', 'goc-chill'],
  desk_lamp: ['phong-lam-viec', 'phong-hoc'],
  night_lamp: ['phong-ngu', 'goc-chill'],
  pendant_lamp: ['phong-khach', 'goc-chill'],
  organizer: ['phong-lam-viec', 'phong-hoc'],
  plant_pot: ['phong-khach', 'phong-lam-viec', 'goc-chill'],
  vase: ['phong-khach', 'goc-chill'],
  sculpture: ['phong-khach', 'phong-lam-viec', 'goc-chill'],
  clock: ['phong-lam-viec', 'phong-khach'],
  frame: ['phong-khach', 'phong-ngu'],
  candle_holder: ['phong-ngu', 'goc-chill'],
  tray: ['phong-khach', 'phong-lam-viec'],
  bookend: ['phong-hoc', 'phong-lam-viec'],
};

/** Nhóm chất liệu hiển thị cho người dùng — suy ra từ materialInfo/printMaterial thật của sản phẩm. */
export const MATERIAL_GROUPS: { key: string; label: string; keywords: string[] }[] = [
  { key: 'go', label: 'Gỗ', keywords: ['gỗ', 'wood', 'plywood', 'veneer', 'sồi', 'óc chó', 'tần bì', 'thông'] },
  { key: 'vai-da', label: 'Vải, nệm & da', keywords: ['vải', 'nệm', 'bouclé', 'boucle', 'linen', 'nỉ', 'da thật', 'da pu', 'bọc da'] },
  { key: 'kim-loai', label: 'Kim loại', keywords: ['kim loại', 'thép', 'nhôm', 'đồng thau', 'brass', 'sắt', 'inox'] },
  { key: 'gom-su', label: 'Gốm & sứ', keywords: ['gốm', 'sứ', 'ceramic'] },
  { key: 'da-xi-mang', label: 'Đá & xi măng', keywords: ['xi măng', 'bê tông', 'đá tự nhiên', 'đá cẩm thạch', 'marble', 'terrazzo'] },
  { key: 'kinh', label: 'Kính & thuỷ tinh', keywords: ['kính', 'thủy tinh', 'thuỷ tinh'] },
  { key: 'nhua-in-3d', label: 'Nhựa in 3D (PLA/PETG/Resin)', keywords: ['pla', 'petg', 'resin', 'nhựa'] },
];

/** Nhánh 3D & Custom trong mega menu — chỉ trỏ tới route/filter có thật. */
export const THREE_D_CUSTOM_LINKS: CatalogLink[] = [
  { label: 'Sản phẩm in 3D', link: '/catalog', queryParams: { print: '1' }, image: art('3d-custom') },
  { label: 'Sản phẩm có thể tùy biến', link: '/catalog', queryParams: { custom: '1' }, image: img('1581783342308-f792dbdd27c5') },
  { label: 'Chọn màu & chất liệu', link: '/customizer-3d', image: img('1584589167171-541ce45f1eea') },
  { label: 'Xem sản phẩm 3D', link: '/catalog', queryParams: { has3d: '1' }, image: 'assets/floating-banners/ai-room-3d.png' },
  { label: 'Space Builder', link: '/shop-the-room', image: 'assets/promo-banner/room-3d-collection.png' },
  { label: 'Thiết kế riêng', link: '/custom-request', image: 'assets/hero-banner/hero-ai-assistant.png' },
];

export const DEAL_LINKS: CatalogLink[] = [
  { label: 'Flash Sale', link: '/flash-sale', image: 'assets/decor-deals/flash-sale-hero.jpg' },
  { label: 'Deal hôm nay', link: '/flash-sale', image: 'assets/hero-banner/hero-deal-today.png' },
  { label: 'Sản phẩm giảm giá', link: '/catalog', queryParams: { sale: '1' }, image: img('1607083206869-4c7672e72a8a') },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Chuẩn hoá để so khớp không dấu: "Giường" ~ "giuong". */
export function normalizeText(s: string | undefined | null): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Khớp nguyên từ, giữ dấu — tránh "sứ" khớp nhầm trong "sức khỏe", "thả" trong "thanh". */
function containsWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${escaped}(?=[^\\p{L}]|$)`, 'u').test(text);
}

const ALL_SUBCATEGORIES = CATALOG_DEPARTMENTS.flatMap(d => d.subcategories.map(sub => ({ dept: d, sub })));

export function findDepartment(key: string | null | undefined): CatalogDepartment | undefined {
  return CATALOG_DEPARTMENTS.find(d => d.key === key);
}

export function findSubcategory(key: string | null | undefined): { dept: CatalogDepartment; sub: CatalogSubcategory } | undefined {
  return ALL_SUBCATEGORIES.find(x => x.sub.key === key);
}

export function findSpace(key: string | null | undefined): CatalogSpace | undefined {
  return CATALOG_SPACES.find(s => s.key === key);
}

export function subcategoryMatches(sub: CatalogSubcategory, p: Product): boolean {
  if (sub.categories.includes(p.category)) return true;
  if (sub.legacy?.categories.includes(p.category)) {
    const name = (p.name || '').toLowerCase();
    return sub.legacy.keywords.some(k => containsWord(name, k));
  }
  return false;
}

/** Sản phẩm thuộc nhóm lớn khi category của nó nằm trong bất kỳ danh mục con nào (kể cả dữ liệu cũ). */
export function departmentMatches(dept: CatalogDepartment, p: Product): boolean {
  return dept.subcategories.some(sub => sub.categories.includes(p.category) || !!sub.legacy?.categories.includes(p.category));
}

export function departmentOf(p: Product): CatalogDepartment | undefined {
  return CATALOG_DEPARTMENTS.find(d => departmentMatches(d, p));
}

export function subcategoriesOf(p: Product): CatalogSubcategory[] {
  return ALL_SUBCATEGORIES.filter(x => subcategoryMatches(x.sub, p)).map(x => x.sub);
}

export function spacesOf(p: Product): SpaceKey[] {
  if (p.spaces?.length) return p.spaces;
  // Dữ liệu cũ (vd. 'lamp' chung chung): lấy không gian theo danh mục con đã khớp qua từ khoá
  // (đèn thả → phòng khách, đèn bàn → phòng làm việc...).
  const refined = ALL_SUBCATEGORIES.find(x => x.sub.legacy?.categories.includes(p.category) && x.sub.categories.length && subcategoryMatches(x.sub, p));
  if (refined) return DEFAULT_SPACES[refined.sub.categories[0]] ?? [];
  return DEFAULT_SPACES[p.category] ?? [];
}

export function materialGroupsOf(p: Product): string[] {
  const text = `${p.materialInfo || ''} ${p.printMaterial || ''}`.toLowerCase();
  return MATERIAL_GROUPS.filter(g => g.keywords.some(k => containsWord(text, k))).map(g => g.key);
}

export function has3DModel(p: Product): boolean {
  return !!p.threeModelType;
}

/** Văn bản dùng cho tìm kiếm: tên + mô tả + danh mục (cũ & mới) + không gian + phong cách + chất liệu. */
export function searchableText(p: Product): string {
  const dept = departmentOf(p);
  const parts = [
    p.name,
    p.description,
    p.categoryName,
    dept?.label,
    ...subcategoriesOf(p).map(s => s.label),
    ...spacesOf(p).map(k => findSpace(k)?.label),
    p.style,
    p.color,
    p.materialInfo,
    p.customizable ? 'tùy biến custom' : '',
    p.threeModelType ? '3d xem 3d mô hình 3d' : '',
    p.productionType === 'PRINT_ON_DEMAND' ? 'in 3d theo yêu cầu' : '',
  ];
  return normalizeText(parts.filter(Boolean).join(' '));
}

/**
 * Link cũ /catalog?category=<ProductCategory> (brand page, product detail cũ, bookmark...):
 * chọn các danh mục con chứa category đó; nếu chỉ khớp qua dữ liệu cũ (vd. 'lamp') thì chọn cả nhóm lớn.
 */
export function selectionForLegacyCategory(category: string): { dept?: DepartmentKey; subs: string[] } {
  const subs = ALL_SUBCATEGORIES.filter(x => x.sub.categories.includes(category as ProductCategory)).map(x => x.sub.key);
  if (subs.length) return { subs };
  const dept = CATALOG_DEPARTMENTS.find(d => d.subcategories.some(s => s.legacy?.categories.includes(category as ProductCategory)));
  return { dept: dept?.key, subs: [] };
}

export function departmentLink(dept: CatalogDepartment): CatalogLink {
  return { label: dept.label, link: '/catalog', queryParams: { dept: dept.key } };
}

export function subcategoryLink(sub: CatalogSubcategory): CatalogLink {
  return { label: sub.label, link: '/catalog', queryParams: { cat: sub.key } };
}

export function spaceLink(space: CatalogSpace): CatalogLink {
  return { label: space.label, link: '/catalog', queryParams: { space: space.key } };
}
