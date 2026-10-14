// Sản phẩm bổ sung ngoài bộ mock gốc (product-detail.generated.js). Mô tả dài, câu chuyện, đánh giá
// được product-content.js gộp thêm như các sản phẩm khác.
const IMG = 'assets/products/ban-lam-viec-sv1400';

const EXTRA_PRODUCTS = [
  {
    // Ảnh render từ chính mô hình 3D (file AT120.max của Luméa, bàn SV1400HL) — xem CREDITS.md.
    id: 'prod-28',
    name: 'Bàn Làm Việc Gỗ Sồi Có Hộc 1m4',
    slug: 'ban-lam-viec-go-soi-co-hoc-1m4',
    category: 'table',
    categoryName: 'Bàn',
    categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK',
    customizable: false,
    basePrice: 2690000,
    originalPrice: 3190000,
    description: 'Bàn làm việc 1m4 mặt gỗ sồi, hộc liền bên phải gồm 1 ngăn kéo và 1 tủ cánh có khoá, vách yếm che chân kín đáo — gọn gàng cho văn phòng lẫn góc làm việc tại nhà.',
    story: '',
    rating: 5,
    reviewCount: 0,
    inStock: 18,
    images: [`${IMG}/ban-sv1400-front.jpg`, `${IMG}/ban-sv1400-side.jpg`, `${IMG}/ban-sv1400-top.jpg`],
    badge: 'Mới',
    dimensions: 'Rộng 140cm x Sâu 70cm x Cao 75cm',
    materialInfo: 'MDF chống ẩm phủ melamine vân gỗ sồi, tay nắm nhựa ABS, chân đệm chỉnh cao',
    weight: '46kg',
    features: ['Hộc liền 1 ngăn kéo + 1 tủ cánh', 'Lỗ luồn dây điện trên mặt bàn', 'Chân đệm chỉnh được độ cao'],
    reviews: [],
    customization: {
      colors: [
        { name: 'Gỗ sồi sáng', hex: '#D9A86C', priceDelta: 0 },
        { name: 'Gỗ óc chó', hex: '#5C3A21', priceDelta: 0 },
        { name: 'Trắng tinh', hex: '#EDEDEA', priceDelta: 0 },
      ],
      materials: [],
      sizes: [],
      finishes: [],
      textOption: { enabled: false, maxChars: 0, priceDelta: 0 },
      accessories: [],
    },
    style: 'Minimalist',
    color: 'Be',
    sizeCategory: 'Lớn',
    spaces: ['phong-lam-viec', 'phong-hoc'],
    flashSaleSlot: null,
  },
];

module.exports = { EXTRA_PRODUCTS };
