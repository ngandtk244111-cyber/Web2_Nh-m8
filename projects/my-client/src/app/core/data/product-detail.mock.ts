import { Product, ProductReview } from '../models/product.model';
import { MOCK_PRODUCTS } from './mock-data';

/**
 * Mock data TẠM THỜI để test giao diện (đặc biệt trang chi tiết sản phẩm) khi chưa nối MongoDB.
 * Chỉ được dùng khi environment.useMockProducts = true — xem ProductService.refresh().
 * Các sản phẩm ở đây cố ý có nhiều ảnh, nhiều review (có ảnh), badge, story... để phủ hết các khối UI:
 * lưới gallery + "Xem toàn bộ ảnh", phân trang review, các hàng gợi ý cuộn ngang.
 * Khi đã có data thật: tắt cờ trong environment rồi xoá file này.
 */

const img = (id: string, w = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const AVATARS = [
  img('photo-1534528741775-53994a69daeb', 150),
  img('photo-1507003211169-0a1dd7228f2d', 150),
  img('photo-1494790108377-be9c29b29330', 150),
  img('photo-1500648767791-00dcc994a43e', 150),
  img('photo-1544005313-94ddf0286df2', 150),
  img('photo-1535713875002-d1d0cf377fde', 150),
];

const ROOM_SHOTS = [
  img('photo-1586023492125-27b2c045efd7'),
  img('photo-1616594039964-ae9021a400a0'),
  img('photo-1493663284031-b7e3aefcae8e'),
  img('photo-1502672260266-1c1ef2d93688'),
  img('photo-1513519245088-0e12902e5a38'),
  img('photo-1505873242700-f289a29e1e0f'),
  img('photo-1522444195799-478538b28823'),
];

/** Sinh danh sách review giả; `withImages` chọn review nào kèm ảnh. */
function makeReviews(prefix: string, entries: [string, number, string, string, boolean?][]): ProductReview[] {
  return entries.map(([author, rating, date, comment, withImages], i) => ({
    id: `${prefix}-rev-${i + 1}`,
    author,
    avatar: AVATARS[i % AVATARS.length],
    rating,
    date,
    comment,
    verifiedPurchase: i % 4 !== 3,
    images: withImages ? [ROOM_SHOTS[i % ROOM_SHOTS.length], ROOM_SHOTS[(i + 3) % ROOM_SHOTS.length]] : undefined,
  }));
}

const RICH_MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-walnut-side-table',
    name: 'Bàn Phụ Gỗ Óc Chó Vincent, Bo Góc Mềm',
    slug: 'ban-phu-go-oc-cho-vincent',
    category: 'side_table',
    categoryName: 'Bàn Phụ & Side Table',
    categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK',
    customizable: false,
    basePrice: 1290000,
    originalPrice: 1490000,
    description:
      'Làm từ gỗ óc chó tự nhiên, bàn phụ Vincent nổi bật với dáng thanh mảnh và các đường cong mềm mại. ' +
      'Đủ gọn để kê cạnh sofa, đầu giường hay góc đọc sách, đủ chắc để dùng hằng ngày suốt nhiều năm.',
    story:
      'Vân gỗ óc chó tự nhiên là điểm nhấn khiến ai ghé nhà cũng phải hỏi. Mỗi mặt bàn mang một đường vân, ' +
      'một mắt gỗ riêng — và càng dùng lâu, màu gỗ càng trầm ấm, đẹp hơn theo từng buổi cà phê sáng.',
    rating: 4.8,
    reviewCount: 128,
    inStock: 24,
    images: [
      img('photo-1533090161767-e6ffed986c88'),
      ROOM_SHOTS[0],
      ROOM_SHOTS[1],
      ROOM_SHOTS[2],
      ROOM_SHOTS[3],
      ROOM_SHOTS[4],
      ROOM_SHOTS[5],
    ],
    badge: 'Bán chạy',
    dimensions: 'Đường kính 45cm x Cao 52cm (bản tiêu chuẩn)',
    materialInfo: 'Gỗ óc chó Bắc Mỹ nguyên khối, hoàn thiện dầu lau gốc thực vật',
    weight: '4.2kg',
    features: [
      'Bo góc mềm mại, không cạnh sắc — an toàn cho nhà có trẻ nhỏ',
      'Thanh giằng ẩn giúp mặt bàn luôn vững, giữ trọn vẻ đẹp tự nhiên của gỗ',
      'Chân ren tháo lắp nhanh, không cần dụng cụ',
      'Hoàn thiện dầu lau gốc thực vật, không mùi',
    ],
    customization: {
      colors: [
        { name: 'Óc chó', hex: '#5C3A21', priceDelta: 0 },
        { name: 'Sồi tự nhiên', hex: '#C8A165', priceDelta: 0 },
      ],
      materials: [],
      sizes: [
        { id: 's45', label: '45cm', scale: 1, priceMultiplier: 1, dimensions: 'Ø45 x 52 cm' },
        { id: 's55', label: '55cm', scale: 1.2, priceMultiplier: 1.2, dimensions: 'Ø55 x 52 cm' },
        { id: 's65', label: '65cm', scale: 1.4, priceMultiplier: 1.4, dimensions: 'Ø65 x 55 cm' },
      ],
      finishes: [
        { id: 'oil', label: 'Dầu lau mờ', priceDelta: 0 },
        { id: 'lacquer', label: 'Phủ PU bóng nhẹ', priceDelta: 90000 },
      ],
      textOption: { enabled: false, maxChars: 0, priceDelta: 0 },
      accessories: [],
    },
    reviews: makeReviews('walnut', [
      ['Minh Anh', 5, '18/09/2026', 'Gỗ đẹp hơn cả ảnh, vân óc chó rất rõ. Đặt cạnh sofa nhìn sang hẳn phòng khách.', true],
      ['Quốc Bảo', 5, '15/09/2026', 'Giao nhanh 3 ngày, đóng gói kỹ. Lắp chân chưa tới 5 phút.'],
      ['Thu Trang', 4, '11/09/2026', 'Bàn chắc, bo góc mềm nên yên tâm cho bé. Trừ 1 sao vì màu hơi đậm hơn mình nghĩ.', true],
      ['Hoàng Nam', 5, '08/09/2026', 'Mua bản 55cm để làm bàn đầu giường, vừa khít. Rất đáng tiền.'],
      ['Ngọc Hân', 5, '02/09/2026', 'Mình đặt thêm 1 cái nữa cho phòng làm việc. Vân gỗ mỗi cái mỗi khác, rất thích.', true],
      ['Đức Huy', 3, '28/08/2026', 'Sản phẩm ổn nhưng giao trễ 1 ngày so với dự kiến.'],
      ['Lan Chi', 5, '21/08/2026', 'Bề mặt dầu lau sờ rất mịn, không có mùi sơn. 10 điểm.'],
      ['Tuấn Kiệt', 4, '15/08/2026', 'Đẹp, chắc chắn. Mong shop có thêm bản cao hơn.', true],
      ['Phương Linh', 5, '09/08/2026', 'Đã mua lần 2 để tặng mẹ, mẹ khen mãi.'],
      ['Gia Hưng', 2, '01/08/2026', 'Mặt bàn có một mắt gỗ khá lớn, shop giải thích là đặc tính gỗ tự nhiên.'],
      ['Khánh Vy', 5, '25/07/2026', 'Phối cùng thảm be nhìn y hình mẫu luôn!', true],
      ['Bảo Trâm', 5, '19/07/2026', 'Chất lượng ổn định, đường bo tinh tế, rất hài lòng.'],
      ['Thành Long', 4, '10/07/2026', 'Bàn đẹp, giá hơi cao nhưng xứng đáng.'],
    ]),
  },
  {
    id: 'mock-walnut-bookshelf',
    name: 'Kệ Sách Gỗ Óc Chó Vincent 5 Tầng',
    slug: 'ke-sach-go-oc-cho-vincent-5-tang',
    category: 'bookshelf',
    categoryName: 'Kệ Sách & Kệ Treo Tường',
    categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK',
    customizable: false,
    basePrice: 3490000,
    description: 'Kệ sách 5 tầng đồng bộ bộ sưu tập Vincent, khung gỗ óc chó chắc chắn, đợt kệ chịu lực 20kg mỗi tầng.',
    story: 'Một góc đọc sách ấm cúng bắt đầu từ một chiếc kệ đủ đẹp để bạn muốn ngồi lại lâu hơn.',
    rating: 4.7,
    reviewCount: 64,
    inStock: 6,
    images: [ROOM_SHOTS[6], ROOM_SHOTS[2], img('photo-1594026112284-02bb6f3352fe'), ROOM_SHOTS[0]],
    badge: 'Bán chạy',
    dimensions: 'Rộng 90cm x Sâu 35cm x Cao 180cm',
    materialInfo: 'Gỗ óc chó Bắc Mỹ, đợt kệ MDF phủ veneer óc chó',
    weight: '32kg',
    features: ['Mỗi tầng chịu lực 20kg', 'Kèm ke chống đổ gắn tường'],
    reviews: makeReviews('shelf', [
      ['Hải Yến', 5, '12/09/2026', 'Kệ to, chắc, lắp theo hướng dẫn khá dễ.', true],
      ['Minh Tú', 4, '30/08/2026', 'Đẹp, nhưng cần 2 người lắp.'],
    ]),
  },
  {
    id: 'mock-walnut-stool',
    name: 'Ghế Đôn Vincent Nệm Vải Bouclé',
    slug: 'ghe-don-vincent-nem-boucle',
    category: 'stool',
    categoryName: 'Ghế Đôn & Ghế Phụ',
    categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK',
    customizable: false,
    basePrice: 890000,
    originalPrice: 1050000,
    description: 'Ghế đôn chân gỗ óc chó, mặt nệm vải bouclé kem mềm mại. Dùng làm ghế phụ, ghế trang điểm hoặc để chân.',
    rating: 4.9,
    reviewCount: 41,
    inStock: 30,
    images: [img('photo-1503602642458-232111445657'), ROOM_SHOTS[4], ROOM_SHOTS[1]],
    badge: 'Giảm giá',
    dimensions: 'Đường kính 38cm x Cao 45cm',
    materialInfo: 'Chân gỗ óc chó, nệm mút D40 bọc vải bouclé',
    weight: '3.1kg',
    features: ['Vải bouclé tháo rời giặt được', 'Chân có đệm cao su chống trầy sàn'],
    reviews: makeReviews('stool', [
      ['Như Quỳnh', 5, '10/09/2026', 'Ngồi êm, vải bouclé rất sang.', true],
    ]),
  },
  {
    id: 'mock-oak-stool',
    name: 'Ghế Đôn Gỗ Sồi Ashen',
    slug: 'ghe-don-go-soi-ashen',
    category: 'stool',
    categoryName: 'Ghế Đôn & Ghế Phụ',
    categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK',
    customizable: false,
    basePrice: 690000,
    description: 'Ghế đôn gỗ sồi sáng màu, dáng tròn tối giản, hợp phong cách Japandi.',
    rating: 4.6,
    reviewCount: 22,
    inStock: 0,
    images: [ROOM_SHOTS[5], ROOM_SHOTS[3]],
    badge: 'Thanh lý',
    dimensions: 'Đường kính 35cm x Cao 44cm',
    materialInfo: 'Gỗ sồi trắng nguyên khối',
    weight: '2.6kg',
    features: ['Gỗ sồi nguyên khối', 'Hoàn thiện dầu lau mờ'],
    reviews: [],
  },
  {
    id: 'mock-oak-side-table',
    name: 'Bàn Phụ Tròn Gỗ Sồi Ashen',
    slug: 'ban-phu-tron-go-soi-ashen',
    category: 'side_table',
    categoryName: 'Bàn Phụ & Side Table',
    categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK',
    customizable: false,
    basePrice: 790000,
    originalPrice: 990000,
    description: 'Bàn phụ tròn gỗ sồi, chân trụ dày chắc chắn, mặt bàn bo tròn mềm mại.',
    rating: 4.5,
    reviewCount: 17,
    inStock: 9,
    images: [ROOM_SHOTS[1], ROOM_SHOTS[6]],
    badge: 'Thanh lý',
    dimensions: 'Đường kính 50cm x Cao 50cm',
    materialInfo: 'Gỗ sồi trắng, phủ dầu lau',
    weight: '5kg',
    features: ['Chân trụ dày vững chắc', 'Mặt bàn chống thấm nhẹ'],
    reviews: [],
  },
];

/** Sản phẩm dùng khi bật mock: bộ mock đầy đủ ở trên + 10 sản phẩm mẫu có sẵn trong mock-data.ts. */
export const DEV_MOCK_PRODUCTS: Product[] = [...RICH_MOCK_PRODUCTS, ...MOCK_PRODUCTS];
