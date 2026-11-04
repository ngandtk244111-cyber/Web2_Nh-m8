/** Các vị trí poster/banner cố định của my-client. Mỗi vị trí luôn tồn tại: admin chỉ thay ảnh và sửa nội dung. */
export type BannerFieldKey =
  | 'title' | 'subtitle' | 'eyebrow' | 'ctaText' | 'ctaLink' | 'code' | 'videoUrl' | 'line1' | 'line2' | 'tickerLabel';

export interface BannerField {
  key: BannerFieldKey;
  label: string;
}

export interface BannerSlot {
  id: string;
  group: string;
  name: string;
  /** Rộng / cao của khung ảnh ở my-client; không có nghĩa là vị trí không dùng ảnh. */
  imageRatio?: number;
  imageHint?: string;
  canToggle?: boolean;
  fields: BannerField[];
  /** Nội dung gốc đang viết trong my-client. */
  defaults: Partial<Record<BannerFieldKey | 'imageUrl', string>>;
}

const F = {
  title: { key: 'title', label: 'Tiêu đề' },
  description: { key: 'subtitle', label: 'Mô tả' },
  eyebrow: { key: 'eyebrow', label: 'Dòng chữ nhỏ phía trên' },
  badge: { key: 'eyebrow', label: 'Nhãn' },
  cta: { key: 'ctaText', label: 'Chữ trên nút' },
  link: { key: 'ctaLink', label: 'Nút dẫn tới trang' },
  code: { key: 'code', label: 'Mã ưu đãi' },
  video: { key: 'videoUrl', label: 'URL video (link trực tiếp .mp4)' },
  alt: { key: 'title', label: 'Mô tả ảnh (cho trình đọc màn hình)' },
} satisfies Record<string, BannerField>;

const HERO_FIELDS: BannerField[] = [
  { key: 'line1', label: 'Chữ lớn dòng 1' },
  { key: 'line2', label: 'Chữ lớn dòng 2' },
  { key: 'tickerLabel', label: 'Chữ chạy ở header' },
  { key: 'title', label: 'Tiêu đề (cho SEO, không hiện trên ảnh)' },
  { key: 'subtitle', label: 'Mô tả (cho SEO, không hiện trên ảnh)' },
  F.cta,
];
const HERO_RATIO = 2;
const HERO_HINT = 'Ảnh nằm ở nửa phải banner. Trên điện thoại ảnh có thể bị cắt thêm.';
const HERO_GROUP = 'Trang chủ — Hero';
const PROMO_RATIO = 720 / 1168;
const PROMO_GROUP = 'Trang chủ — Poster khuyến mãi';
const SIDE_RATIO = 116 / 356;
const SIDE_GROUP = 'Mọi trang — Banner dọc hai bên';
const GRID_GROUP = 'Trang chủ — Banner ưu đãi';
const BRAND_RATIO = 2;
const BRAND_GROUP = 'Trang Thương hiệu — Slider';
const BRAND_FIELDS: BannerField[] = [F.title, F.description, F.link];
const OTHER_GROUP = 'Trang khác';

export const BANNER_SLOTS: BannerSlot[] = [
  {
    id: 'popup-home', group: 'Popup', name: 'Popup trang chủ', imageRatio: 4 / 5, canToggle: true,
    fields: [F.alt, F.link],
    defaults: { imageUrl: 'assets/campaign/popup-poster.jpg', title: 'Minimalist Furniture — Luméa', ctaLink: '/catalog' },
  },
  {
    id: 'hero-room-3d', group: HERO_GROUP, name: 'Slide Phòng 3D', imageRatio: HERO_RATIO, imageHint: HERO_HINT,
    fields: [...HERO_FIELDS, F.link],
    defaults: {
      imageUrl: 'assets/hero-banner/hero-room-3d.png', line1: 'PHÒNG 3D', line2: 'XOAY 360°', tickerLabel: 'Khám phá Phòng 3D',
      title: 'Khám Phá Phòng 3D Trực Quan',
      subtitle: 'Dạo quanh không gian sống 360° trước khi quyết định mua — xem đúng món đồ decor nằm ở đâu trong căn phòng thật.',
      ctaText: 'Khám phá ngay', ctaLink: '/shop-the-room',
    },
  },
  {
    id: 'hero-print-3d', group: HERO_GROUP, name: 'Slide In 3D', imageRatio: HERO_RATIO, imageHint: HERO_HINT,
    fields: [...HERO_FIELDS, F.link],
    defaults: {
      imageUrl: 'assets/hero-banner/hero-print-3d.png', line1: 'IN 3D', line2: 'THEO Ý BẠN', tickerLabel: 'In 3D theo yêu cầu',
      title: 'In 3D Theo Yêu Cầu — Độc Bản Của Riêng Bạn',
      subtitle: 'Từ ý tưởng tới sản phẩm hoàn thiện, tùy biến màu sắc, chất liệu và khắc tên cá nhân hóa 100%.',
      ctaText: 'Tùy biến ngay', ctaLink: '/customizer-3d',
    },
  },
  {
    id: 'hero-freeship', group: HERO_GROUP, name: 'Slide Freeship', imageRatio: HERO_RATIO, imageHint: HERO_HINT,
    fields: [...HERO_FIELDS, F.link],
    defaults: {
      imageUrl: 'assets/hero-banner/hero-freeship.png', line1: 'FREESHIP', line2: 'TỪ 500K', tickerLabel: 'Freeship từ 500K',
      title: 'Miễn Phí Vận Chuyển Từ 500.000đ',
      subtitle: 'Giao hàng nhanh toàn quốc cho mọi đơn hàng nội thất & decor, đóng gói chống va đập cẩn thận.',
      ctaText: 'Mua sắm ngay', ctaLink: '/catalog',
    },
  },
  {
    // Nút trên slide này mở Trợ lý AI nên không có link trên banner; link chỉ dùng cho mục chữ chạy ở header.
    id: 'hero-ai-assistant', group: HERO_GROUP, name: 'Slide Trợ lý AI', imageRatio: HERO_RATIO, imageHint: HERO_HINT,
    fields: [...HERO_FIELDS, { key: 'ctaLink', label: 'Link khi bấm chữ chạy ở header (nút trên slide luôn mở Trợ lý AI)' }],
    defaults: {
      imageUrl: 'assets/hero-banner/hero-ai-assistant.png', line1: 'GỢI Ý DECOR', line2: 'SIÊU NHANH', tickerLabel: 'AI Gợi Ý Decor',
      title: 'Trợ Lý AI Gợi Ý Ý Tưởng Decor',
      subtitle: 'Mô tả không gian mơ ước của bạn, AI giúp gợi ý sản phẩm và phong cách phù hợp trong vài giây.',
      ctaText: 'Thử ngay', ctaLink: '/style-quiz',
    },
  },
  {
    id: 'hero-deal-today', group: HERO_GROUP, name: 'Slide Ưu đãi hôm nay', imageRatio: HERO_RATIO, imageHint: HERO_HINT,
    fields: [...HERO_FIELDS, F.link],
    defaults: {
      imageUrl: 'assets/hero-banner/hero-deal-today.png', line1: 'ƯU ĐÃI', line2: 'HÔM NAY', tickerLabel: 'Ưu đãi hôm nay',
      title: 'Ưu Đãi Hôm Nay Dành Cho Bạn',
      subtitle: 'Khám phá các sản phẩm nổi bật với mức giá tốt nhất, cập nhật mỗi ngày.',
      ctaText: 'Xem ưu đãi', ctaLink: '/flash-sale',
    },
  },
  {
    id: 'promo-xa-kho', group: PROMO_GROUP, name: 'Poster Xả kho', imageRatio: PROMO_RATIO, fields: [F.alt, F.link],
    defaults: { imageUrl: 'assets/promo-cards/xa-kho.jpg', title: 'Xả kho giá sốc — nhà xinh khỏi lo giá', ctaLink: '/catalog?sale=1' },
  },
  {
    id: 'promo-deal-thang', group: PROMO_GROUP, name: 'Poster Deal tháng', imageRatio: PROMO_RATIO, fields: [F.alt, F.link],
    defaults: { imageUrl: 'assets/promo-cards/deal-thang-11.jpg', title: 'Tháng 11 — Deal xịn mỗi ngày, nhà xinh quá', ctaLink: '/flash-sale' },
  },
  {
    id: 'promo-phong-3d', group: PROMO_GROUP, name: 'Poster Phòng 3D', imageRatio: PROMO_RATIO, fields: [F.alt, F.link],
    defaults: { imageUrl: 'assets/promo-cards/phong-3d.jpg', title: 'Khám phá Phòng 3D — giảm ngay đến 40%', ctaLink: '/shop-the-room' },
  },
  {
    id: 'side-left', group: SIDE_GROUP, name: 'Banner bên trái', imageRatio: SIDE_RATIO, canToggle: true,
    imageHint: 'Chỉ hiện trên desktop, chiều cao khung đổi nhẹ theo màn hình.',
    fields: [F.badge, F.title, F.cta, F.link],
    defaults: { imageUrl: 'assets/floating-banners/side-decor-shelf.jpg', eyebrow: 'AI Thiết Kế', title: 'Decor Theo Ý Bạn', ctaText: 'Thử ngay', ctaLink: '/custom-request/new' },
  },
  {
    id: 'side-right', group: SIDE_GROUP, name: 'Banner bên phải', imageRatio: SIDE_RATIO, canToggle: true,
    imageHint: 'Chỉ hiện trên desktop, chiều cao khung đổi nhẹ theo màn hình.',
    fields: [F.badge, F.title, F.cta, F.link],
    defaults: { imageUrl: 'assets/floating-banners/side-pendant-lamps.jpg', eyebrow: 'Freeship', title: 'Đèn Decor Từ 300K', ctaText: 'Mua ngay', ctaLink: '/catalog' },
  },
  {
    id: 'grid-room', group: GRID_GROUP, name: 'Banner Phòng 3D', imageRatio: 1498 / 1050,
    imageHint: 'Khung chỉ hiện phần giữa ảnh, khoảng 14% phía trên và phía dưới sẽ bị che.',
    fields: [F.eyebrow, F.title, F.description, F.cta, F.link],
    defaults: {
      imageUrl: 'assets/promo-banner/room-3d-collection.png', eyebrow: 'Bộ Sưu Tập Phòng 3D', title: 'Dạo Quanh Không Gian Mẫu',
      subtitle: 'Khám phá phòng khách, phòng ngủ được Luméa phối sẵn theo 360°', ctaText: 'Khám phá ngay', ctaLink: '/shop-the-room',
    },
  },
  {
    id: 'grid-member', group: GRID_GROUP, name: 'Banner Ưu đãi thành viên', imageRatio: 290 / 436,
    imageHint: 'Ảnh đứng trong vòng tròn, nên dùng PNG nền trong suốt.',
    fields: [F.eyebrow, F.title, F.description, F.code, F.cta, F.link],
    defaults: {
      imageUrl: 'assets/mascot/lumea-mascot.png', eyebrow: 'Ưu Đãi Thành Viên Mới', title: 'Giảm 10% Đơn Đầu Tiên',
      subtitle: 'Áp dụng cho đơn hàng từ 200.000đ', code: 'LUMÉANEW', ctaText: 'Nhận ưu đãi', ctaLink: '/voucher',
    },
  },
  {
    id: 'grid-wide', group: GRID_GROUP, name: 'Banner ngang có video',
    fields: [F.eyebrow, F.title, F.description, F.cta, F.link, F.video],
    defaults: {
      eyebrow: 'Cá Nhân Hóa Trực Quan', title: 'Tùy Biến Sản Phẩm In 3D Theo Ý Bạn',
      subtitle: 'Đổi màu sắc, chất liệu, kích thước và khắc tên riêng ngay trên trình xem 3D',
      ctaText: 'Bắt đầu tùy biến', ctaLink: '/customizer-3d', videoUrl: 'assets/promo-banner/sofa-intro.mp4',
    },
  },
  {
    id: 'brand-flash-sale', group: BRAND_GROUP, name: 'Slide Flash Sale', imageRatio: BRAND_RATIO, fields: BRAND_FIELDS,
    defaults: { imageUrl: 'assets/hero-banner/hero-deal-today.png', title: 'Flash Sale Giá Tốt', subtitle: 'Deal decor nhỏ, giảm đến 40% mỗi ngày', ctaLink: '/flash-sale' },
  },
  {
    id: 'brand-room-3d', group: BRAND_GROUP, name: 'Slide Phòng Mẫu 3D', imageRatio: BRAND_RATIO, fields: BRAND_FIELDS,
    defaults: { imageUrl: 'assets/hero-banner/hero-room-3d.png', title: 'Phòng Mẫu 3D', subtitle: 'Xoay không gian và mua món đồ bạn thích', ctaLink: '/shop-the-room' },
  },
  {
    id: 'brand-print-3d', group: BRAND_GROUP, name: 'Slide In 3D', imageRatio: BRAND_RATIO, fields: BRAND_FIELDS,
    defaults: { imageUrl: 'assets/hero-banner/hero-print-3d.png', title: 'In 3D Theo Yêu Cầu', subtitle: 'Tùy biến màu sắc, chất liệu, kích thước', ctaLink: '/customizer-3d' },
  },
  {
    id: 'brand-ai', group: BRAND_GROUP, name: 'Slide AI Gợi Ý', imageRatio: BRAND_RATIO, fields: BRAND_FIELDS,
    defaults: { imageUrl: 'assets/hero-banner/hero-ai-assistant.png', title: 'AI Gợi Ý Decor', subtitle: 'Mô tả ý tưởng, nhận concept ngay', ctaLink: '/custom-request/new' },
  },
  {
    id: 'brand-freeship', group: BRAND_GROUP, name: 'Slide Miễn phí vận chuyển', imageRatio: BRAND_RATIO, fields: BRAND_FIELDS,
    defaults: { imageUrl: 'assets/hero-banner/hero-freeship.png', title: 'Miễn Phí Vận Chuyển', subtitle: 'Cho đơn hàng từ 500.000₫', ctaLink: '/catalog' },
  },
  {
    id: 'flash-sale-hero', group: OTHER_GROUP, name: 'Ảnh hero trang Flash Sale', imageRatio: 4 / 3, fields: [],
    defaults: { imageUrl: 'assets/hero-banner/hero-deal-today.png' },
  },
  {
    id: 'coordinate-banner', group: OTHER_GROUP, name: 'Ảnh banner trang Phối đồ', imageRatio: 3, fields: [],
    defaults: { imageUrl: 'assets/hero-banner/hero-room-3d.png' },
  },
];

export const BANNER_GROUPS: { name: string; slots: BannerSlot[] }[] =
  [...new Set(BANNER_SLOTS.map(s => s.group))].map(name => ({ name, slots: BANNER_SLOTS.filter(s => s.group === name) }));
