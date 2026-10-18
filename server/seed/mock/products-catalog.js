// Bộ sản phẩm phủ đủ các danh mục của cây danh mục (catalog-taxonomy.ts) — mỗi danh mục con có 40–45
// sản phẩm tính cả sản phẩm cũ. Chỉ gồm hàng có sẵn (READY_STOCK), không tùy biến, không mô hình 3D:
// nhánh "Sản phẩm in 3D" / "Có thể tùy biến" giữ nguyên dữ liệu cũ.
//
// Mỗi sản phẩm dựng từ MỘT ảnh thật (Unsplash, giấy phép Unsplash) đã được xem và ghi lại kiểu dáng,
// chất liệu, màu sắc nhìn thấy trong ảnh (bảng ITEMS) — tên, mô tả, chất liệu, màu của sản phẩm lấy
// theo đúng bảng đó nên luôn khớp với ảnh. Chạy lại bao nhiêu lần cũng ra đúng cùng dữ liệu.
const img = (id, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// ---------------------------------------------------------------------------------------------
// Thành phần dùng chung
// ---------------------------------------------------------------------------------------------

// Bộ sưu tập đặt theo địa danh Việt Nam — câu chuyện ngắn dùng chung cho mọi loại sản phẩm.
const COLLECTIONS = [
  ['Đà Lạt', 'Bộ sưu tập Đà Lạt lấy cảm hứng từ những đồi thông mờ sương: tông màu dịu, đường nét mềm và cảm giác ấm áp như một buổi sáng se lạnh trên cao nguyên.'],
  ['Hội An', 'Hội An gợi những mái ngói rêu phong và ánh đèn lồng: chúng tôi giữ lại chất mộc của vật liệu và nét thủ công tỉ mỉ của phố cổ.'],
  ['Sa Pa', 'Màu sắc của Sa Pa — xanh ruộng bậc thang, trắng sương mù — được chắt lọc thành những gam trung tính dễ phối, không bao giờ lỗi mốt.'],
  ['Huế', 'Huế trầm lắng và tinh tế: đường nét thanh mảnh, tỉ lệ cân đối, đặt vào phòng nào cũng tạo cảm giác điềm tĩnh.'],
  ['Mộc Châu', 'Mộc Châu mùa hoa mận trắng là cảm hứng cho những thiết kế nhẹ nhõm, sáng sủa và gần gũi thiên nhiên.'],
  ['Phú Quốc', 'Nắng biển Phú Quốc được gói vào gam màu cát ấm và chất liệu tự nhiên — mang không khí nghỉ dưỡng về căn nhà của bạn.'],
  ['Côn Đảo', 'Côn Đảo hoang sơ và yên tĩnh: thiết kế tối giản, bề mặt mộc, để chính vật liệu kể câu chuyện của nó.'],
  ['Tam Cốc', 'Những dãy núi đá vôi Tam Cốc soi bóng xuống dòng nước là cảm hứng cho đường cong mềm mại và bề mặt mờ tự nhiên.'],
  ['Mũi Né', 'Đồi cát Mũi Né vàng óng trong nắng chiều — tông màu ấm, thong thả, khiến góc nhà trở nên dễ chịu hơn.'],
  ['Hạ Long', 'Vịnh Hạ Long với những khối đá vững chãi giữa làn nước xanh: thiết kế chắc khoẻ nhưng không nặng nề.'],
  ['Cát Bà', 'Cát Bà là rừng và biển hoà làm một — chúng tôi kết hợp gỗ, vải và gam xanh dịu để tạo nên sự cân bằng ấy.'],
  ['Tam Đảo', 'Tam Đảo quanh năm mát lạnh, mây vờn trên mái nhà: thiết kế mang cảm giác thư thái của một kỳ nghỉ cuối tuần.'],
  ['Quy Nhơn', 'Quy Nhơn yên bình với bờ biển dài và nắng nhẹ — gam màu sáng, đường nét gọn gàng, hợp nhà phố lẫn căn hộ.'],
  ['Nha Trang', 'Nha Trang trẻ trung, rộn ràng: những thiết kế vui mắt nhưng vẫn đủ tinh tế để dùng lâu dài.'],
  ['Cần Thơ', 'Chợ nổi Cần Thơ và những hàng dừa nước là cảm hứng cho chất liệu tự nhiên, gần gũi đời sống miền Tây.'],
  ['Bến Tre', 'Xứ dừa Bến Tre mộc mạc, chân chất — vật liệu tự nhiên, hoàn thiện thủ công, càng dùng càng có hồn.'],
  ['Hà Giang', 'Cao nguyên đá Hà Giang khắc nghiệt mà đẹp lạ: thiết kế mạnh mẽ, bề mặt thô ráp có chủ đích.'],
  ['Mai Châu', 'Những nếp nhà sàn Mai Châu giữa thung lũng lúa là cảm hứng cho sự ấm cúng, giản dị và bền bỉ.'],
  ['Lý Sơn', 'Đảo tỏi Lý Sơn với đá núi lửa và biển xanh ngọc: tương phản mạnh, đường nét dứt khoát.'],
  ['Phong Nha', 'Hang động Phong Nha với những khối thạch nhũ tự nhiên — mỗi thiết kế mang vẻ đẹp điêu khắc riêng.'],
  ['Ninh Bình', 'Ninh Bình cổ kính giữa núi non: tỉ lệ cân đối, màu sắc trầm ấm, hợp những không gian thích sự tĩnh lặng.'],
  ['Măng Đen', 'Măng Đen — "Đà Lạt thứ hai" — với rừng thông và hồ nước yên ả, gợi nên những thiết kế nhẹ nhàng, thư thái.'],
  ['Vũng Tàu', 'Gió biển Vũng Tàu và những buổi chiều cuối tuần thong thả là cảm hứng cho thiết kế thoải mái, dễ sống.'],
  ['Ba Vì', 'Rừng quốc gia Ba Vì xanh mát ngay cạnh phố thị — gam xanh lá, nâu gỗ và chất liệu thân thiện môi trường.'],
  ['Châu Đốc', 'Châu Đốc với rừng tràm Trà Sư mênh mang — sắc xanh trầm, chất liệu đan lát thủ công đậm chất miền sông nước.'],
  ['Pleiku', 'Phố núi Pleiku với đất đỏ bazan và đồi chè: tông màu đất ấm áp, phong cách mộc mạc mà chắc chắn.'],
  ['Đồng Văn', 'Phố cổ Đồng Văn với tường trình và mái ngói âm dương — đường nét chân phương, bền vững cùng năm tháng.'],
  ['Tuy Hòa', 'Ghềnh Đá Đĩa Tuy Hòa với những cột đá xếp đều tăm tắp — cảm hứng cho hình khối hình học gọn gàng.'],
  ['Bạch Mã', 'Đỉnh Bạch Mã mây phủ quanh năm: thiết kế thanh thoát, gam màu sáng nhẹ như sương.'],
  ['Kon Tum', 'Nhà rông Kon Tum vươn cao giữa đại ngàn — chất liệu tự nhiên, kết cấu chắc chắn, đậm hồn Tây Nguyên.'],
];

const STYLE_LINES = {
  Minimalist: 'Thiết kế tối giản, ít chi tiết thừa — dễ đặt vào mọi góc nhà mà không làm rối mắt.',
  Scandinavian: 'Tinh thần Bắc Âu sáng sủa, ấm áp: đường nét mềm và công năng đặt lên hàng đầu.',
  Vintage: 'Phong cách vintage hoài cổ — càng dùng lâu càng có hồn.',
  'Cute/Kawaii': 'Dáng tròn trịa, đáng yêu — góc nhà vui tươi hẳn lên.',
  Modern: 'Phong cách hiện đại với đường nét dứt khoát, tinh gọn.',
  Retro: 'Hơi thở retro với màu sắc nổi bật và đường cong đặc trưng.',
  Japanese: 'Tinh thần Nhật Bản tĩnh tại: chất liệu tự nhiên, tỉ lệ thấp và khoảng trống có chủ đích.',
};

const REVIEWERS = [
  'Thanh Hương', 'Quốc Việt', 'Mỹ Linh', 'Hoàng Phúc', 'Bảo Ngọc', 'Minh Khôi', 'Diệu Anh', 'Trung Hiếu',
  'Phương Thảo', 'Gia Huy', 'Ngọc Trâm', 'Đức Thịnh', 'Hải Yến', 'Tấn Phát', 'Kim Ngân', 'Anh Thư',
  'Văn Toàn', 'Lan Phương', 'Nhật Minh', 'Thùy Dung', 'Khánh Vy', 'Quang Huy', 'Thu Trang', 'Đăng Khoa',
];
const AVATARS = [
  '1534528741775-53994a69daeb', '1507003211169-0a1dd7228f2d', '1494790108377-be9c29b29330',
  '1500648767791-00dcc994a43e', '1544005313-94ddf0286df2', '1535713875002-d1d0cf377fde',
].map(id => img(id, 150));

// Đánh giá dùng chung theo nhóm: [số sao, nội dung, phản hồi của shop?]
const REVIEW_POOLS = {
  furniture: [
    [5, 'Hàng giao đúng hẹn, thợ lắp đặt nhanh và dọn dẹp sạch sẽ. Ngoài đời đẹp hơn ảnh.'],
    [5, 'Chất lượng hoàn thiện tốt, mối nối chắc chắn, không có mùi sơn. Rất đáng tiền.'],
    [4, 'Sản phẩm đẹp, chắc. Màu thực tế đậm hơn ảnh một chút nhưng vẫn hợp với phòng nhà mình.', 'Cảm ơn bạn đã góp ý! Màu vật liệu tự nhiên có thể chênh nhẹ theo ánh sáng, Luméa sẽ cập nhật thêm ảnh thực tế ạ.'],
    [5, 'Mua lần thứ hai ở Luméa, vẫn hài lòng như lần đầu. Tư vấn kích thước rất kỹ.'],
    [5, 'Đóng gói cẩn thận từng góc, giao lên tận tầng 12 không thu thêm phí.'],
    [4, 'Ổn trong tầm giá. Giao chậm hơn dự kiến 1 ngày do mưa nhưng shop có báo trước.', 'Luméa xin lỗi vì sự chậm trễ và cảm ơn bạn đã thông cảm ạ!'],
    [5, 'Phòng nhìn sang hẳn lên, khách đến nhà ai cũng hỏi mua ở đâu.'],
  ],
  light: [
    [5, 'Ánh sáng vàng ấm rất dịu, bật buổi tối thấy phòng ấm cúng hẳn.'],
    [5, 'Đóng gói kỹ, có xốp định hình nên đèn về nguyên vẹn. Cắm điện là dùng luôn.'],
    [4, 'Đèn đẹp, ánh sáng ổn. Dây nguồn hơi ngắn so với vị trí ổ cắm nhà mình.', 'Cảm ơn bạn! Shop có bán kèm dây nối 2m cùng tông màu, bạn nhắn shop để được hỗ trợ nhé.'],
    [5, 'Làm việc khuya cần đèn không chói, cái này đúng ý. Mắt đỡ mỏi hơn hẳn.'],
    [5, 'Hoàn thiện tốt, công tắc êm, không có mùi nhựa. Đáng tiền.'],
    [4, 'Đẹp và chắc chắn, mong shop có thêm bản dùng điều khiển từ xa.'],
  ],
  decor: [
    [5, 'Món đồ nhỏ mà góc kệ có điểm nhấn liền, chụp ảnh lên rất xinh.'],
    [5, 'Mua làm quà tân gia, gói quà miễn phí rất đẹp, bạn mình thích lắm.'],
    [4, 'Đẹp, đúng mô tả. Kích thước nhỏ hơn mình tưởng một chút, bạn nào mua nên xem kỹ số đo.', 'Cảm ơn bạn đã góp ý! Luméa sẽ bổ sung ảnh so sánh kích thước thực tế ạ.'],
    [5, 'Bề mặt hoàn thiện mịn, màu sắc trang nhã, hợp với phòng tông trung tính.'],
    [5, 'Giao nhanh, đóng gói chống sốc rất kỹ, không bị sứt mẻ gì.'],
    [4, 'Sản phẩm ổn, giá hợp lý. Sẽ ủng hộ shop thêm.'],
  ],
  plant: [
    [5, 'Cây về xanh tốt, chậu đẹp, có kèm hướng dẫn tưới rất chi tiết.'],
    [5, 'Đặt trên bàn làm việc nhìn dễ chịu hẳn, cây dễ chăm thật.'],
    [4, 'Cây khoẻ, chậu đẹp. Đất hơi ướt khi nhận nhưng để vài ngày là ổn.', 'Cảm ơn bạn! Cây được tưới trước khi đóng gói để giữ ẩm trong lúc vận chuyển ạ.'],
    [5, 'Mua tặng đồng nghiệp, ai cũng khen. Lỗ thoát nước dưới đáy rất tiện.'],
    [5, 'Đóng gói cẩn thận, cây không gãy lá nào. Sẽ mua thêm.'],
  ],
  desk: [
    [5, 'Bàn làm việc gọn gàng hẳn, đồ dùng nào cũng có chỗ riêng.'],
    [5, 'Chất liệu chắc, hoàn thiện đẹp, đặt lên bàn nhìn rất sang.'],
    [4, 'Dùng tốt, chỉ mong có thêm nhiều màu hơn.', 'Cảm ơn bạn! Luméa đang chuẩn bị thêm màu mới, bạn theo dõi shop để nhận thông báo nhé.'],
    [5, 'Mua 2 cái cho cả nhà, rất hài lòng.'],
    [5, 'Giao nhanh, đóng gói đẹp. Giá hợp lý so với chất lượng.'],
  ],
};

// ---------------------------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------------------------
function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Giá "đẹp" kiểu 1.290.000 / 189.000. */
function nicePrice(x) {
  if (x >= 1000000) return Math.max(100000, Math.round(x / 100000) * 100000 - 10000);
  return Math.max(10000, Math.round(x / 10000) * 10000 - 1000);
}

function viDate(daysBefore) {
  const d = new Date(Date.UTC(2026, 9, 8) - daysBefore * 24 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function reviewsFor(id, pool, h) {
  const n = h % 4; // 0–3 đánh giá
  let days = 3 + (h % 9);
  const out = [];
  for (let i = 0; i < n; i++) {
    const [rating, comment, reply] = pool[(h + i * 3) % pool.length];
    out.push({
      id: `${id}-rev-${i + 1}`,
      author: REVIEWERS[(h + i * 7) % REVIEWERS.length],
      avatar: AVATARS[(h + i) % AVATARS.length],
      rating,
      date: viDate(days),
      comment,
      verifiedPurchase: (h + i) % 6 !== 0,
      ...(reply ? { reply: { text: reply, date: viDate(Math.max(0, days - 1)) } } : {}),
    });
    days += 5 + ((h + i) % 12);
  }
  return out;
}

/** Màu ghi trong bảng ITEMS (vd "Xám Khói", "Nâu Trầm") → giá trị lọc màu của web (Product.color). */
function colorFilter(word) {
  const s = word.toLowerCase();
  if (/xanh/.test(s)) return 'Xanh';
  if (/^đen/.test(s)) return 'Đen';
  if (/hồng/.test(s)) return 'Hồng';
  if (/xám|bạc|ghi/.test(s)) return 'Xám';
  if (/trắng|ngà|sữa|trong/.test(s)) return 'Trắng';
  if (/kem|be|nâu|gỗ|vàng đồng|hổ phách|mộc|vân/.test(s)) return 'Be';
  if (/tím|pastel/.test(s)) return 'Pastel';
  return null;
}

/** "id | Kiểu | Chất liệu | Màu" mỗi dòng → [id, kiểu, chất liệu, màu]. */
const items = text => text.trim().split('\n').map(line => line.split('|').map(s => s.trim()));

// ---------------------------------------------------------------------------------------------
// Ảnh thứ 2 (hiện khi rê chuột lên thẻ sản phẩm)
// ---------------------------------------------------------------------------------------------
// Chỉ dùng ảnh chụp CHÍNH món đó ở góc khác (cùng buổi chụp, đã đối chiếu bằng mắt từng cặp).
// Món chưa có ảnh thứ 2 thật thì chỉ có 1 ảnh — thẻ sản phẩm khi rê chuột sẽ phóng nhẹ ảnh chính,
// không bao giờ hiện món khác. Tìm được ảnh thật mới thì thêm cặp "ảnh chính: ảnh thứ 2" vào đây.
const SAME_ITEM = {
  // Sofa
  '1759722665610-e13e59aa117b': '1759722665614-265fdf133b37',
  '1759722665614-265fdf133b37': '1759722665610-e13e59aa117b',
  '1759722665935-0967b4e0da93': '1759722665660-c6ce8cd19ae3',
  '1759722665660-c6ce8cd19ae3': '1759722665935-0967b4e0da93',
  '1759722668385-90006d9c7aa7': '1759722668253-1767030ad9b2',
  '1759722668253-1767030ad9b2': '1759722668385-90006d9c7aa7',
  '1759722668102-0d43a5696411': '1759722668253-1767030ad9b2',
  // Giường
  '1768946131535-b90bad125f16': '1768946131530-358c52c4c42d',
  '1768946131530-358c52c4c42d': '1768946131535-b90bad125f16',
  '1765862835319-18fb6f8caff6': '1765862835193-3c37388a409e',
  '1765862835193-3c37388a409e': '1765862835319-18fb6f8caff6',
  '1596959393202-53fcfe359b51': '1596959393217-b7a378118278',
  // Bàn
  '1602872030490-4a484a7b3ba6': '1602872030219-ad2b9a54315c',
  '1772475385529-92037713a057': '1772475385509-93fd87a2d4ba',
  '1772475385509-93fd87a2d4ba': '1772475385529-92037713a057',
  // Tủ đầu giường
  '1774578342062-cb222a06404b': '1774578342100-f779e988c83d',
  '1774578342100-f779e988c83d': '1774578342062-cb222a06404b',
  // Kệ treo tường
  '1766047125625-7d271a7238e9': '1766047125602-38a468895ffc',
  '1766047125602-38a468895ffc': '1766047125625-7d271a7238e9',
  '1766047125655-837fe02718f5': '1766047125688-49929e2fb131',
  '1766047125688-49929e2fb131': '1766047125655-837fe02718f5',
  '1766047125728-ebff5afcf314': '1766047125655-837fe02718f5',
  '1787917142802-a7deb450ad17': '1787917142865-96ef50b136e9',
  '1787917142865-96ef50b136e9': '1787917142802-a7deb450ad17',
  // Đèn bàn
  '1766411503489-c6fe7b008bd6': '1766411503488-f90eef1124bb',
  '1766411503488-f90eef1124bb': '1766411503489-c6fe7b008bd6',
  '1756474215958-f0c2a31eddc1': '1756474215990-a18a9a0521d5',
  '1769092992766-9504cdd93696': '1769092992364-3d17d2057c1b',
  '1769092992364-3d17d2057c1b': '1769092992766-9504cdd93696',
  '1774647001992-b711ae72f83d': '1774647002012-cecc8b78b2cc',
  '1774647002012-cecc8b78b2cc': '1774647001992-b711ae72f83d',
  '1774647003441-f65d9c5b4498': '1774647003273-884b87f4ca62',
  '1774647002242-b2e7c7c97bc5': '1774647002240-5441565e5976',
  '1774647003251-8784a16d5012': '1774647003273-884b87f4ca62',
  '1774647002240-5441565e5976': '1774647002242-b2e7c7c97bc5',
  '1774647003273-884b87f4ca62': '1774647003251-8784a16d5012',
  // Đèn ngủ
  '1596959393217-b7a378118278': '1596959393202-53fcfe359b51',
  // Đèn decor nấm
  '1756474215990-a18a9a0521d5': '1756474215958-f0c2a31eddc1',
  '1756474215831-4e5f8309c6bc': '1756474215958-f0c2a31eddc1',
  // Bình hoa
  '1631125915902-d8abe9225ff2': '1631125915973-e0d155a14e4e',
  '1631125915973-e0d155a14e4e': '1631125915902-d8abe9225ff2',
  '1631125916276-69bcd14e3980': '1631125915973-e0d155a14e4e',
  // Đồng hồ
  '1764933173636-f8b2019a9a52': '1764933173563-9f2e62b3828e',
  '1764933173563-9f2e62b3828e': '1764933173636-f8b2019a9a52',
  // Chậu cây
  '1616961065849-edf307a08bcb': '1616961162823-aeba510620c6',
  '1616961162823-aeba510620c6': '1616961065849-edf307a08bcb',
  // Khung tranh
  '1611651525144-42027e7f45ba': '1611651525502-68b5e15c9195',
  '1611651525502-68b5e15c9195': '1611651525144-42027e7f45ba',
  '1765137102463-95933b20b481': '1765137102474-422a4f3834e7',
  '1765137102474-422a4f3834e7': '1765137102463-95933b20b481',
  '1765137138078-80c4792c05b3': '1765137138067-89abe3f4ba71',
  '1765137138067-89abe3f4ba71': '1765137138078-80c4792c05b3',
  // Hộp đựng bút, kệ kê màn hình
  '1751107756600-fb136501dec7': '1751107756601-66fa542b0e3c',
  '1751107807635-a2ac6035e8dd': '1751107756602-dc1f003e50b5',
  '1751107756601-66fa542b0e3c': '1751107756600-fb136501dec7',
  '1751107756602-dc1f003e50b5': '1751107756601-66fa542b0e3c',
  '1641247470229-ee9868ea42ad': '1641247456466-95e68ac46d3b',
  '1641057350241-c05da7c70a9f': '1641057350183-48d58af53b12',
  // Giá đỡ
  '1629317480860-3265288e62a8': '1629317443302-7c496cca44d5',
  '1629317443302-7c496cca44d5': '1629317480860-3265288e62a8',
  '1641247494318-5a7d3a445482': '1641247494306-7e62b0333ac0',
  '1641247456497-a0f3bde00e45': '1641247456466-95e68ac46d3b',
  '1641247494306-7e62b0333ac0': '1641247494318-5a7d3a445482',
  '1675109313924-48bf0139b4a2': '1675109322863-2f4eef9fe032',
  '1675109322863-2f4eef9fe032': '1675109313924-48bf0139b4a2',
  '1780427827602-d69705948dc7': '1780427839404-9147bce7bfe9',
  '1780427839404-9147bce7bfe9': '1780427827602-d69705948dc7',
};

/** Ảnh sản phẩm: ảnh chính, kèm ảnh thứ 2 nếu có ảnh thật của chính món đó. */
const productImages = imageId => (SAME_ITEM[imageId] ? [img(imageId), img(SAME_ITEM[imageId])] : [img(imageId)]);

// Ảnh → kiểu, chất liệu, màu nhìn thấy trong ảnh (đã xem từng ảnh).
const ITEMS = {
  'sofa': items(`
1512212621149-107ffe572d2f | Sofa Văng 2 Chỗ | Da Bò | Kem
1484101403633-562f891dc89a | Sofa Văng 2 Chỗ | Vải Nỉ | Xanh Dương
1549187774-b4e9b0445b41 | Sofa Văng 2 Chỗ | Da Bò | Nâu
1782512175859-02bde5592785 | Sofa Văng 2 Chỗ | Da Microfiber | Đen
1590251024078-8a6d9f90b02d | Sofa Văng 2 Chỗ | Vải Bouclé | Xanh Rêu
1567016432779-094069958ea5 | Sofa Văng 2 Chỗ | Vải Nỉ | Đỏ
1555041469-a586c61ea9bc | Sofa Văng 2 Chỗ | Nhung Tăm | Xanh Lá
1691480152351-4b3f2c89ccff | Sofa Văng 2 Chỗ | Da Bò | Nâu Bò
1698936061086-2bf99c7b9fc5 | Sofa 3 Chỗ Tay Vuông | Vải Nỉ | Xám
1775029676739-86443af4010d | Sofa 3 Chỗ Tay Vuông | Vải Linen | Be
1776186243368-50a3ed7cd200 | Sofa 3 Chỗ Tay Vuông | Vải Bouclé | Kem
1573866926487-a1865558a9cf | Sofa 3 Chỗ Chesterfield | Da Bò | Nâu
1759722667832-48e555120458 | Sofa 3 Chỗ Tay Vuông | Vải Nỉ | Xám Ghi
1630585308572-f53438fc684f | Sofa 3 Chỗ Tay Vuông | Nhung Tăm | Xanh Ngọc
1605365070248-299a182a2ca6 | Sofa 3 Chỗ Tay Vuông | Vải Linen | Xám
1588082255003-1a93643ecf59 | Sofa 3 Chỗ Tay Vuông | Vải Nỉ | Xám Đậm
1772208392372-fc6b62e37a2b | Sofa 3 Chỗ Tay Vuông | Da Microfiber | Nâu
1758945631260-a0077e8cc873 | Sofa 3 Chỗ Tay Vuông | Da Microfiber | Xám
1759647020668-648cd90ddce4 | Sofa 3 Chỗ Tay Vuông | Nhung Tăm | Xanh Lá
1759722665610-e13e59aa117b | Sofa Góc Chữ L | Vải Linen | Xám
1759722665935-0967b4e0da93 | Sofa Góc Chữ L | Vải Nỉ | Xám
1565330502541-4937be8552e3 | Sofa Góc Chữ L | Vải Nỉ | Xám Ghi
1759722668385-90006d9c7aa7 | Sofa Góc Chữ L | Vải Linen | Xám Nhạt
1759722668253-1767030ad9b2 | Sofa Góc Chữ L | Vải Linen | Xám Khói
1759722668102-0d43a5696411 | Sofa Góc Chữ L | Vải Nỉ | Xám Đậm
1759722665614-265fdf133b37 | Sofa Góc Chữ L | Vải Linen | Xám Nhạt
1758957701419-2c6e266f7988 | Sofa Góc Chữ L | Vải Linen | Trắng
1759722665660-c6ce8cd19ae3 | Sofa Góc Chữ L | Vải Nỉ | Xám
1786886357716-9a6e0defb748 | Sofa Góc Chữ L | Vải Nỉ | Xám Khói
1778936317529-9930b680ac58 | Sofa Góc Chữ L | Vải Bouclé | Trắng
1787539386477-5324beb6eec7 | Sofa Góc Chữ L | Vải Bouclé | Trắng Kem
1550581190-9c1c48d21d6c | Sofa Góc Chữ L | Vải Nỉ | Đen
1768946131549-f03cafef7bc1 | Sofa Bed Đa Năng | Nhung Tăm | Hồng Đào
1505693070124-1cce01268b88 | Sofa Bed Đa Năng | Vải Nỉ | Nâu
1779144639439-00e6d853fd6f | Sofa Bed Đa Năng | Da Bò | Nâu
1631510390389-c1e4fb20ff31 | Sofa Đơn Thư Giãn | Vải Linen | Trắng
1759722667456-71e7bfd118b2 | Sofa Đơn Thư Giãn | Vải Bouclé | Kem
1757969704802-4d0050f038d7 | Sofa Đơn Thư Giãn | Vải Linen | Kem
1759722667490-e5fd31b8dbd5 | Sofa Đơn Thư Giãn | Vải Nỉ | Xám
1763279934323-edb3735f6a6e | Sofa Đơn Thư Giãn | Vải Linen | Be
1684165610413-2401399e0e59 | Sofa Đơn Thư Giãn | Vải Bouclé | Trắng Kem
1771924648531-94af2b79dc96 | Sofa Đơn Thư Giãn | Vải Linen | Trắng Ngà
`),
  'bed': items(`
1635594202056-9ea3b497e5c0 | Giường Ngủ 1m6 | Trắng Mờ | Trắng
1757417983938-2c2a931d41aa | Giường Ngủ 1m8 | Gỗ Óc Chó | Nâu Trầm
1560185128-e173042f79dd | Giường Ngủ 1m8 | Bọc Nệm Vải | Be
1617198998846-56e8a4c6e7b7 | Giường Ngủ 1m6 | Trắng Mờ | Trắng
1784318519037-7ee0b1668e95 | Giường Bệt Kiểu Nhật | Gỗ Óc Chó | Nâu
1688383454669-9f5cc5991778 | Giường Ngủ 1m6 | Gỗ Sồi | Gỗ Sáng
1724166655256-0ae10f1ab89a | Giường Ngủ 1m6 | Gỗ Óc Chó | Nâu Trầm
1768946131535-b90bad125f16 | Giường Bệt Kiểu Nhật | Bọc Nệm Vải | Be
1713365963723-655fa464b681 | Giường Ngủ 1m6 | Gỗ Tần Bì | Nâu
1631650120985-20791383127e | Giường Ngủ 1m6 | Khung Sắt | Đen
1759176171010-2d64aa5253c2 | Giường Ngủ 1m6 | Bọc Da | Đen
1768946131530-358c52c4c42d | Giường Bọc Nệm Đầu Cong | Bọc Nệm Vải | Kem
1714138107718-baa87d3ea624 | Giường Ngủ 1m6 | Gỗ Sồi | Gỗ Sáng
1425219366480-47fdbbe0e83b | Giường Ngủ 1m6 | Trắng Mờ | Trắng
1583535045024-e2479a694777 | Giường Đơn 1m2 | Gỗ Cao Su | Nâu
1698517486200-e89403ea2738 | Giường Ngủ 1m8 | Bọc Nệm Vải | Kem
1750420556288-d0e32a6f517b | Giường Ngủ 1m8 | Bọc Nệm Vải | Xám
1678978866819-306ed8608e7f | Giường Ngủ 1m8 | Bọc Nệm Vải | Xám Đậm
1765862835319-18fb6f8caff6 | Giường Bệt Kiểu Nhật | Bọc Nệm Vải | Xám
1766733041960-0de62f403e7b | Giường Bọc Nệm Đầu Cong | Bọc Nệm Vải | Be
1678786591418-2b107bdda369 | Giường Ngủ 1m8 | Gỗ Óc Chó | Nâu
1560449752-ac541afdd6b5 | Giường Ngủ 1m6 | Bọc Nệm Vải | Be
1688065177980-926d65bd548c | Giường Ngủ 1m6 | Gỗ Sồi | Gỗ Sáng
1630699293388-0938c397106a | Giường Ngủ 1m6 | Bọc Nệm Vải | Xám
1731336250970-dc942b5e0746 | Giường Ngủ 1m8 | Bọc Nệm Vải | Xám Xanh
1687816043131-fd1c0d01df58 | Giường Bệt Kiểu Nhật | Bọc Nệm Vải | Be
1672350562148-8bf371963340 | Giường Ngủ 1m6 | Bọc Da | Đen
1765862835193-3c37388a409e | Giường Bệt Kiểu Nhật | Gỗ Óc Chó | Nâu
1690957530220-98bacb3c1163 | Giường Bệt Kiểu Nhật | Gỗ Óc Chó | Nâu Trầm
1639813806535-b206d3dcf3b6 | Giường Đơn 1m2 | Gỗ Sồi | Gỗ Sáng
1596959393202-53fcfe359b51 | Giường Đơn 1m2 | Gỗ Tần Bì | Nâu
1505693416388-ac5ce068fe85 | Giường Ngủ 1m8 | Bọc Nệm Vải | Kem
1588046130717-0eb0c9a3ba15 | Giường Ngủ 1m6 | Bọc Nệm Vải | Trắng
1617325247661-675ab4b64ae2 | Giường Bệt Kiểu Nhật | Gỗ Sồi | Gỗ Sáng
1611892440504-42a792e24d32 | Giường Bệt Kiểu Nhật | Gỗ Óc Chó | Nâu Trầm
1616627561839-074385245ff6 | Giường Ngủ 1m6 | Gỗ Tần Bì | Gỗ Sáng
1631049307264-da0ec9d70304 | Giường Ngủ 1m8 | Bọc Nệm Vải | Xám
`),
  'table': items(`
1604578762246-41134e37f9cc | Bàn Ăn 4 Ghế | Gỗ Óc Chó | Nâu
1657524398377-567034729507 | Bàn Ăn 4 Ghế | Gỗ Sồi | Gỗ Sáng
1616486886892-ff366aa67ba4 | Bàn Ăn 6 Ghế | Gỗ Sồi | Gỗ Sáng
1602872030490-4a484a7b3ba6 | Bàn Ăn 4 Ghế | Mặt Đá | Trắng
1617806118233-18e1de247200 | Bàn Ăn 6 Ghế | Mặt Đá | Trắng
1636138388621-258a72ecb07e | Bàn Ăn 6 Ghế | Gỗ Tần Bì | Gỗ Sáng
1615066390971-03e4e1c36ddf | Bàn Ăn 6 Ghế | Gỗ Óc Chó | Nâu
1505409628601-edc9af17fda6 | Bàn Ăn 6 Ghế | Đen Nhám | Đen
1577140917170-285929fb55b7 | Bàn Ăn 4 Ghế | Gỗ Tần Bì | Nâu
1615920606214-6428b3324c74 | Bàn Ăn 4 Ghế | Gỗ Sồi | Gỗ Sáng
1594000311835-6d564e5a46b3 | Bàn Ăn 4 Ghế | Mặt Đá | Trắng
1758977404254-49c511e876f6 | Bàn Ăn 6 Ghế | Gỗ Tần Bì | Nâu
1784012980517-005c26585344 | Bàn Làm Việc | Gỗ Óc Chó | Nâu
1772475385529-92037713a057 | Bàn Học Có Giá Sách | Gỗ Sồi | Gỗ Sáng
1766431015004-315aa01141f9 | Bàn Làm Việc | Gỗ Tần Bì | Nâu
1598016677484-ad34c3fd766e | Bàn Làm Việc | Gỗ Óc Chó | Nâu
1772475385509-93fd87a2d4ba | Bàn Học Có Giá Sách | Gỗ Óc Chó | Nâu
1596025591889-5e1e35729485 | Bàn Làm Việc | Gỗ Tần Bì | Gỗ Sáng
1761323612470-b8de857169e1 | Bàn Làm Việc | Gỗ Sồi | Gỗ Sáng
1786986784084-6d4913aa5721 | Bàn Làm Việc | Gỗ Sồi | Gỗ Sáng
1611269154421-4e27233ac5c7 | Bàn Làm Việc | Gỗ Sồi | Gỗ Sáng
1597072689227-8882273e8f6a | Bàn Học Có Giá Sách | Gỗ Sồi | Gỗ Sáng
1777513538143-8525eb3943f6 | Bàn Trà Phòng Khách | Gỗ Tần Bì | Nâu
1581428982868-e410dd047a90 | Bàn Trà Phòng Khách | Gỗ Tần Bì | Gỗ Sáng
1758565811033-84d1365000c6 | Bàn Trà Phòng Khách | Gỗ Sồi | Gỗ Sáng
1647967527216-adea2f078e07 | Bàn Trà Phòng Khách | Mặt Kính | Đen
1779905697138-5a3453572b59 | Bàn Trà Phòng Khách | Gỗ Óc Chó | Nâu Trầm
1605774337664-7a846e9cdf17 | Bàn Trà Phòng Khách | Gỗ Óc Chó | Nâu
1604061986761-d9d0cc41b0d1 | Bàn Trà Phòng Khách | Đen Nhám | Nâu
`),
  'side-table': items(`
1759262151001-3f8841d02ce1 | Bàn Phụ Tròn | Đen Nhám | Đen
1611486212355-d276af4581c0 | Bộ Bàn Phụ Lồng Nhau | Gỗ Óc Chó | Nâu
1611486212557-88be5ff6f941 | Bàn Phụ Chữ C | Gỗ Sồi | Gỗ Sáng
1758915753395-a5dddea1d813 | Bàn Phụ Chân Trụ | Trắng Mờ | Kem
1765766638341-0beb9eb9926c | Bàn Phụ Chân Trụ | Đen Nhám | Đen
1610671907016-1eb6e7ab964d | Bàn Phụ Tròn | Mặt Đá | Trắng
1601000785686-c45240e25f25 | Bàn Cà Phê Mini | Đen Nhám | Đen
1669274174844-0cc2598ad868 | Tab Đầu Giường 1 Ngăn | Trắng Mờ | Trắng
1592991694176-3878d223a0f7 | Bàn Cà Phê Mini | Trắng Mờ | Trắng
1499933374294-4584851497cc | Bàn Phụ Tròn | Trắng Mờ | Trắng
1532372320572-cda25653a26d | Tab Đầu Giường 1 Ngăn | Gỗ Sồi | Gỗ Sáng
`),
  'chair': items(`
1598300042247-d088f8ab3a91 | Ghế Ăn | Bọc Vải | Xám
1506439773649-6e0eb8cfb237 | Ghế Gỗ Tựa Lưng | Gỗ Tần Bì | Gỗ Sáng
1774294067819-91abcd349372 | Ghế Ăn | Gỗ Óc Chó | Nâu
1650476524564-f94dc9669067 | Ghế Gỗ Tựa Lưng | Gỗ Tần Bì | Nâu
1640938776314-4d303f8a1380 | Ghế Ăn | Gỗ Sồi | Gỗ Sáng
1771254077475-175e329486c7 | Ghế Gỗ Tựa Lưng | Gỗ Sơn Trắng | Trắng
1699588772787-1eed3b726e0a | Ghế Ăn | Gỗ Sồi | Gỗ Sáng
1622880355742-af182a61b362 | Ghế Gỗ Tựa Lưng | Gỗ Sồi | Gỗ Sáng
1598300056393-4aac492f4344 | Ghế Ăn | Bọc Da | Nâu Trầm
1559310839-62ea9d2e37cd | Ghế Kim Loại Ban Công | Kim Loại | Xanh Lá
1617582907226-c49e2d8200d9 | Ghế Ăn | Bọc Nhung | Đỏ
1758486561455-ebd0d3ba7423 | Ghế Ăn | Mây Đan | Be
1592078615290-033ee584e267 | Ghế Ăn | Nhựa Đúc | Đen
1580480055273-228ff5388ef8 | Ghế Bành Armchair | Bọc Vải | Xám
1567538096630-e0c55bd6374c | Ghế Bành Armchair | Bọc Da | Trắng
1601366533287-5ee4c763ae4e | Ghế Bành Armchair | Bọc Nhung | Nâu
1617364852223-75f57e78dc96 | Ghế Thư Giãn Khung Uốn | Bọc Vải | Đen
1605702098590-d552a98dc93d | Ghế Bành Armchair | Bọc Da | Nâu
1586158291800-2665f07bba79 | Ghế Bành Armchair | Bọc Nhung | Hồng
1631700679578-621a258507bb | Ghế Bành Armchair | Bọc Nhung | Vàng Mù Tạt
1506332088442-9e0024864f5d | Ghế Bành Armchair | Bọc Vải | Be
1612372606404-0ab33e7187ee | Ghế Làm Việc Xoay | Bọc Da | Nâu
1711443418892-244b303a8cad | Ghế Thư Giãn Bập Bênh | Gỗ Óc Chó | Nâu Trầm
`),
  'stool': items(`
1634798245965-03669c757183 | Ghế Đôn Quầy Bar | Gỗ Sồi | Gỗ Sáng
1779278547541-370129cc09f7 | Ghế Đôn Quầy Bar | Gỗ Sồi | Gỗ Sáng
1552324190-9e86fa095c4a | Ghế Đôn Quầy Bar | Kim Loại | Đen
1540809799-5da9372c3f64 | Ghế Đôn Tròn | Gỗ Óc Chó | Nâu
1763013374216-dd0ececbd090 | Ghế Đôn Quầy Bar | Gỗ Óc Chó | Nâu Trầm
1536639240649-1f0979e7993d | Ghế Đôn Tròn | Gỗ Sơn Trắng | Trắng
1618520408841-61a1c5ee84d6 | Ghế Đôn Bọc Nệm | Bọc Bouclé | Xám
1622759660470-63d4369958ba | Ghế Đôn Tròn | Gỗ Óc Chó | Nâu
1580439527610-212eb31ce1fd | Ghế Đôn Quầy Bar | Gỗ Óc Chó | Nâu Trầm
1757862351226-61b214cb5252 | Ghế Đôn Bọc Nệm | Bọc Da | Nâu
1551907234-fb773fb08a2a | Ghế Đôn Tròn | Gỗ Sồi | Gỗ Sáng
1527121964781-9f0834203e11 | Ghế Đôn Quầy Bar | Gỗ Sơn Trắng | Trắng
1657336641332-d0bef6ada5e0 | Ghế Đôn Quầy Bar | Gỗ Óc Chó | Đen
1503602642458-232111445657 | Ghế Đôn Quầy Bar | Gỗ Sơn Trắng | Kem
`),
  'cabinet': items(`
1782730951536-d81badeca960 | Tủ Quần Áo 3 Cánh | Trắng Mờ | Trắng
1558997519-83ea9252edf8 | Tủ Quần Áo 2 Cánh | Gỗ Tần Bì | Nâu
1649361811423-a55616f7ab11 | Tủ Quần Áo Âm Tường | Gỗ Óc Chó | Nâu Trầm
1778731660303-1fa5ede75477 | Tủ Quần Áo Âm Tường | Gỗ Óc Chó | Nâu
1708397016786-8916880649b8 | Tủ Quần Áo Âm Tường | Gỗ Óc Chó | Nâu Trầm
1683181181300-44c0c991a2cf | Tủ Quần Áo Âm Tường | Trắng Mờ | Trắng
1672137233327-37b0c1049e77 | Tủ Quần Áo 3 Cánh | Cánh Kính | Xám
1579283111509-855c7eea1c49 | Tủ Ngăn Kéo Thấp | Gỗ Óc Chó | Nâu
1719035271030-c4f941639aaf | Tủ Ngăn Kéo Thấp | Gỗ Tần Bì | Nâu
1786953835509-950e265ed7c8 | Tủ Ngăn Kéo 5 Tầng | Gỗ Óc Chó | Nâu
1690310588492-fc8f92bff323 | Tủ Ngăn Kéo Thấp | Trắng Mờ | Xám
1612908317776-a3afde8232fa | Tủ Ngăn Kéo Thấp | Gỗ Tần Bì | Nâu Cam
1772567732956-08e173d62f49 | Tủ Ngăn Kéo Thấp | Sơn Màu | Đen
1683731332610-23d833f5871f | Tủ Ngăn Kéo Thấp | Sơn Màu | Hồng
1579656381254-1a60dc1ee3f4 | Tủ Ngăn Kéo Thấp | Gỗ Óc Chó | Nâu Trầm
1698953704644-6fb636c6389d | Tủ Ngăn Kéo 5 Tầng | Gỗ Óc Chó | Nâu
1603112089080-3ef8f7bb9dcf | Tủ Ngăn Kéo Thấp | Gỗ Tần Bì | Nâu
1786886382297-b3d20435bc20 | Tủ Giày Cánh Lật | Trắng Mờ | Trắng
1576325782051-6ccdcaf096a6 | Tủ Sideboard | Trắng Mờ | Trắng
1618220048045-10a6dbdf83e0 | Tủ Sideboard | Trắng Mờ | Trắng
1604762525784-e315f3f2b971 | Tủ Sideboard | Trắng Mờ | Trắng
1542487354-feaf93476caa | Kệ Tivi Thấp | Trắng Mờ | Trắng
1611484655556-9a86a0cf109b | Kệ Tivi Thấp | Trắng Mờ | Trắng
1774716925888-190de2471de2 | Kệ Tivi Thấp | Trắng Mờ | Trắng
1780042731953-15dd1b3b5f00 | Kệ Tivi Thấp | Trắng Mờ | Trắng
1593067607070-95193763e3ab | Kệ Tivi Thấp | Trắng Mờ | Trắng
1698674545316-0c93e4ef25a3 | Giá Tivi Chân Gỗ | Gỗ Sồi | Gỗ Sáng
1697457643599-77b5d074121f | Giá Tivi Chân Gỗ | Gỗ Sồi | Gỗ Sáng
1698047945367-112339b04d51 | Giá Tivi Chân Gỗ | Sơn Màu | Hồng
1698674388698-f22228a79879 | Giá Tivi Chân Gỗ | Gỗ Óc Chó | Nâu
1609799545166-347a5ba518cc | Tủ Ngăn Kéo Thấp | Sơn Màu | Đen
1713810958247-01dbd76b4a61 | Tủ Sideboard | Gỗ Óc Chó | Nâu Trầm
1721385675060-9982ec72385e | Tủ Sideboard | Gỗ Óc Chó | Nâu
1767963758785-b9def36c13e3 | Tủ Sideboard | Gỗ Sồi | Gỗ Sáng
1758974782657-e5ada4b01c3c | Tủ Sideboard | Gỗ Sồi | Gỗ Sáng
1628152371231-936cf45eb8f3 | Tủ Sideboard | Sơn Màu | Kem
1718049719548-723e863fbccf | Tủ Sideboard | Sơn Màu | Đen
1769690399048-acdcfa33cdc8 | Tủ Sideboard | Gỗ Tần Bì | Gỗ Sáng
1618219908412-a29a1bb7b86e | Tủ Sideboard | Mây Đan | Gỗ Sáng
1593194632872-3d19dab6e278 | Tủ Đầu Giường 2 Ngăn | Sơn Màu | Xanh Ngọc
1774578342062-cb222a06404b | Tủ Đầu Giường 2 Ngăn | Gỗ Óc Chó | Nâu
1774578342100-f779e988c83d | Tủ Đầu Giường 2 Ngăn | Gỗ Óc Chó | Nâu Trầm
1633945098489-6ffc53067860 | Tủ Đầu Giường 2 Ngăn | Gỗ Sồi | Gỗ Sáng
1766928714376-3263576f7b73 | Tủ Đầu Giường 2 Ngăn | Trắng Mờ | Trắng
1771287490579-afd6e8d3c09a | Tủ Đầu Giường 2 Ngăn | Gỗ Óc Chó | Nâu
`),
  'shelf': items(`
1593430980369-68efc5a5eb34 | Kệ Ô Vuông 9 Ngăn | Gỗ Sồi | Gỗ Sáng
1778088442532-2a3ed3767931 | Kệ Sách Thấp 3 Tầng | Trắng Mờ | Trắng
1543248939-4296e1fea89b | Kệ Treo Tường 3 Thanh | Trắng Mờ | Trắng
1588580000645-4562a6d2c839 | Kệ Sách Âm Tường | Gỗ Óc Chó | Nâu
1780672823738-2a8d15d79aaf | Kệ Sách Thấp 3 Tầng | Trắng Mờ | Trắng
1602722053020-af31042989d5 | Kệ Ô Vuông 9 Ngăn | Trắng Mờ | Trắng
1603058817990-2b9a9abbce86 | Kệ Sách Âm Tường | Gỗ Óc Chó | Nâu Trầm
1545696648-86c761bc5410 | Kệ Sách 5 Tầng | Trắng Mờ | Trắng
1777896067223-9990008a07d7 | Kệ Sách Âm Tường | Gỗ Óc Chó | Nâu
1719310469053-8c5c0c6803d3 | Kệ Ô Vuông 9 Ngăn | Gỗ Óc Chó | Nâu Trầm
1524578271613-d550eacf6090 | Kệ Sách 5 Tầng | Trắng Mờ | Trắng
1776754373072-b06d560d335b | Kệ Treo Tường 3 Thanh | Trắng Mờ | Trắng
1605116959031-6e2d13a2ee56 | Kệ Treo Tường 3 Thanh | Trắng Mờ | Trắng
1462392627162-2baa2b3518a8 | Kệ Sách 5 Tầng | Đen Nhám | Đen
1687950657442-3919dca651f9 | Kệ Treo Tường 3 Thanh | Gỗ Óc Chó | Nâu
1766038843994-e17d3a7357ac | Kệ Góc Tường | Gỗ Thông | Gỗ Sáng
1774953411395-d011841bd477 | Kệ Góc Tường | Đen Nhám | Đen
1676487093282-f6a47e02848f | Kệ Sách 5 Tầng | Gỗ Sồi | Gỗ Sáng
1526243741027-444d633d7365 | Kệ Sách 5 Tầng | Gỗ Óc Chó | Nâu Trầm
1601027864736-b6121f34797e | Kệ Treo Tường 3 Thanh | Gỗ Thông | Nâu
1766047125625-7d271a7238e9 | Kệ Treo Tường Khung Sắt | Đen Nhám | Đen
1781032384657-320d38787e77 | Kệ Treo Tường 3 Thanh | Gỗ Sồi | Gỗ Sáng
1766047125655-837fe02718f5 | Kệ Treo Tường Khung Sắt | Đen Nhám | Đen
1787917142802-a7deb450ad17 | Kệ Treo Tường 3 Thanh | Gỗ Sồi | Gỗ Sáng
1561997315-37b07e42290b | Kệ Treo Tường 3 Thanh | Gỗ Thông | Nâu
1766047125728-ebff5afcf314 | Kệ Treo Tường Khung Sắt | Đen Nhám | Đen
1766047125688-49929e2fb131 | Kệ Treo Tường Khung Sắt | Đen Nhám | Đen
1728033599344-bc9e33f58977 | Kệ Treo Tường 3 Thanh | Trắng Mờ | Xám
1787917142865-96ef50b136e9 | Kệ Treo Tường 3 Thanh | Gỗ Sồi | Gỗ Sáng
1787727173892-5cf4b5ba0ce8 | Kệ Treo Tường 3 Thanh | Gỗ Sồi | Gỗ Sáng
1766047125602-38a468895ffc | Kệ Treo Tường Khung Sắt | Gỗ Óc Chó | Nâu
1762983003454-c3342d74e625 | Kệ Treo Tường 3 Thanh | Trắng Mờ | Trắng
1594620302200-9a762244a156 | Kệ Ô Vuông 9 Ngăn | Gỗ Sồi | Gỗ Sáng
`),
  'desk-lamp': items(`
1519219788971-8d9797e0928e | Đèn Bàn Cần Gập | Kim Loại | Xám
1769255119650-f658d3dbc397 | Đèn Bàn Chụp Vải | Gỗ Óc Chó | Nâu
1621447980929-6638614633c8 | Đèn Bàn Mái Vòm | Kim Loại | Đỏ
1542728928-1413d1894ed1 | Đèn Bàn Mái Vòm | Đồng Thau | 
1551380701-5dd33d5b5d06 | Đèn Bàn Mái Vòm | Kim Loại | Cam Đất
1582356630861-61bb9b41f541 | Đèn Bàn Cần Gập | Kim Loại | Bạc
1619608135352-868e8313e121 | Đèn Bàn Cần Gập | Kim Loại | Trắng
1523380262778-076eb862d38f | Đèn Bàn Cần Gập | Kim Loại | Đen
1645454720244-29f8e894f662 | Đèn Bàn Mái Vòm | Kim Loại | Đen
1585597647877-6eaa01bf9a05 | Đèn Bàn Cần Gập | Kim Loại | Trắng Bạc
1507473885765-e6ed057f782c | Đèn Bàn Cần Gập | Kim Loại | Xám Ghi
1598789858997-66ad403aa8e1 | Đèn Bàn Cần Gập | Kim Loại | Đen Xám
1520341043296-d818239f86f2 | Đèn Bàn Cần Gập | Kim Loại | Đen
1773916398209-84b1a5d95763 | Đèn Bàn Thư Viện | Đồng Thau | 
1766411503489-c6fe7b008bd6 | Đèn Bàn Cần Gập | Kim Loại | Đen
1775811035108-658b4b101cdb | Đèn Bàn Cần Gập | Đồng Thau | 
1706663072668-f6f5924dc5ae | Đèn Bàn Mái Vòm | Kim Loại | Đen
1713281318582-53ec4ccb8aea | Đèn Bàn Kẹp Bàn | Kim Loại | Đen
1756474215958-f0c2a31eddc1 | Đèn Bàn Mái Vòm | Kim Loại | Vàng
1533090161767-e6ffed986c88 | Đèn Bàn Cần Gập | Kim Loại | Trắng
1534105615256-13940a56ff44 | Đèn Bàn Cần Gập | Kim Loại | Đen
1593062096033-9a26b09da705 | Đèn Bàn Cần Gập | Kim Loại | Đen Nhám
1777734583651-d0fdf3d71a8d | Đèn Bàn Chống Cận LED | Nhôm | Trắng
1769092992766-9504cdd93696 | Đèn Bàn Thư Viện | Đồng Thau | Xanh Lá
1735957386083-e793307d0723 | Đèn Bàn Thư Viện | Đồng Thau | Trắng
1774647001992-b711ae72f83d | Đèn Bàn Cần Gập | Kim Loại | Đen
1760530675794-b065f6320d7b | Đèn Bàn Mái Vòm | Kim Loại | Đỏ
1774647002012-cecc8b78b2cc | Đèn Bàn Cần Gập | Kim Loại | Đen
1774647003441-f65d9c5b4498 | Đèn Bàn Cần Gập | Kim Loại | Đen
1774647002242-b2e7c7c97bc5 | Đèn Bàn Cần Gập | Kim Loại | Đen
1774647003251-8784a16d5012 | Đèn Bàn Cần Gập | Kim Loại | Đen
1774647002240-5441565e5976 | Đèn Bàn Cần Gập | Kim Loại | Đen
1774647003273-884b87f4ca62 | Đèn Bàn Cần Gập | Kim Loại | Đen
1766411503488-f90eef1124bb | Đèn Bàn Sạc Không Dây | Nhôm | Đen
1617363020293-62faac14783d | Đèn Bàn Cần Gập | Kim Loại | Trắng
1769092992364-3d17d2057c1b | Đèn Bàn Thư Viện | Đồng Thau | Xanh Lá
`),
  'night-lamp': items(`
1585128719715-46776b56a0d1 | Đèn Ngủ Cầu Tròn | Thủy Tinh Mờ | Trắng
1612735849751-38ba2c6f4458 | Đèn Ngủ Mái Vòm | Đồng Thau | 
1570974802254-4b0ad1a755f5 | Đèn Ngủ Mái Vòm | Kim Loại | Kem
1596959393217-b7a378118278 | Đèn Ngủ Chụp Vải | Đồng Thau | 
1766431015004-6cd4c33ae158 | Đèn Ngủ Mái Vòm | Kim Loại | Đỏ
1763168421821-e7cb2efcc555 | Đèn Ngủ Để Bàn | Giấy Washi | Kem
1787669622132-fcb5d6c5953a | Đèn Ngủ Chụp Vải | Vải Lanh | Đỏ
1517991104123-1d56a6e81ed9 | Đèn Ngủ Chụp Vải | Gỗ Sồi | Trắng
1580130281320-0ef0754f2bf7 | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Trắng
1773895314378-61929a946fcc | Đèn Ngủ Để Bàn | Thủy Tinh Mờ | Trắng
1579326882518-21eaa7893b02 | Đèn Ngủ Chụp Vải | Vải Lanh | Trắng
1573676386604-78f8ed228e2b | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Đen
1565374235393-6fe32a07cc86 | Đèn Ngủ Cầu Tròn | Thủy Tinh Mờ | Trắng Sữa
1625479968313-7ed87d36e11d | Đèn Ngủ Chụp Vải | Vải Lanh | Trắng
1774556443332-de783833a656 | Đèn Ngủ Chụp Vải | Vải Lanh | Kem
1752916140847-abae939c6c59 | Đèn Ngủ Chụp Vải | Đồng Thau | Kem
1791344243879-21e8ffedaaf3 | Đèn Ngủ Cầu Tròn | Đồng Thau | 
1783149133585-6082c2ef01f6 | Đèn Ngủ Chụp Vải | Thủy Tinh Mờ | Trắng
1768538306228-45943e5a9706 | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Xanh Dương
1626711847936-14f852c7868a | Đèn Ngủ Chụp Vải | Đồng Thau | Trắng
1624878357998-491f177f2cf1 | Đèn Ngủ Để Bàn | Gốm Men Mờ | Trắng
1611668190893-5131136df0a8 | Đèn Ngủ Chụp Vải | Gỗ Óc Chó | Cam
1754606581512-222f5ea9d8c9 | Đèn Ngủ Để Bàn | Đá Muối | Cam
1589335429144-328a42be176e | Đèn Ngủ Mái Vòm | Kim Loại | Đen
1616810559347-257669714c79 | Đèn Ngủ Chụp Vải | Vải Lanh | Trắng
1667312939978-64cf31718a6e | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Kem
1771520041953-a8e5f2156f24 | Đèn Ngủ Mái Vòm | Kim Loại | Vàng
1644052023006-62045a6b0ad3 | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Trắng
1735807009262-59c7c0366042 | Đèn Ngủ Chụp Vải | Gỗ Óc Chó | Nâu
1735807026641-dc0b979564bd | Đèn Ngủ Chụp Vải | Gỗ Lũa | Xanh Navy
1751564360676-0482a3f32941 | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Kem
1648993880083-3080b2110bc0 | Đèn Ngủ Mái Vòm | Đồng Thau | 
1789798444594-cce571a40ab8 | Đèn Ngủ Để Bàn | Thủy Tinh Mờ | Hổ Phách
1522771739844-6a9f6d5f14af | Đèn Ngủ Để Bàn | Kim Loại | Đen
1685735852762-e1325a20da68 | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Kem
1455792244736-3ed96c3d7f7e | Đèn Ngủ Chụp Vải | Gốm Men Mờ | Trắng
1581309700026-48b494fd8c47 | Đèn Ngủ Chụp Vải | Kim Loại | Đen
1517862774645-dd398fbfaffa | Đèn Ngủ Để Bàn | Kim Loại | Đen
`),
  'pendant': items(`
1540932239986-30128078f3c5 | Đèn Thả Chùm Nhiều Bóng | Đồng Thau | 
1565814329452-e1efa11c5b89 | Đèn Thả Chụp Lớn | Trắng Sứ | Trắng
1513506003901-1e6a229e2d15 | Đèn Thả Bàn Ăn | Trắng Sứ | Trắng
1592622515232-6e3e2a0d3d9a | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Đen
1590003689662-0773d48b6417 | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Đen
1512418408532-5445158b1445 | Đèn Thả Chùm Nhiều Bóng | Nhôm Sơn Mờ | Đen
1568482224714-7843360d588a | Đèn Thả Chùm Nhiều Bóng | Đồng Thau | 
1604610728890-6f4b631ed081 | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Đen
1568563094147-ae8eb3a8a3c0 | Đèn Thả Chùm Nhiều Bóng | Nhôm Sơn Mờ | Nhiều Màu
1560851668-e96ae9cfe945 | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Đen
1602145461313-26c587cc0ca9 | Đèn Thả Chụp Tròn | Nhôm Sơn Mờ | Đen Trắng
1596247838521-8b2294dd2b8b | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Xanh Lá
1612736228052-80e7f381690c | Đèn Thả Chụp Tròn | Đồng Thau | Trắng
1599102510907-863ec27bdcb1 | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Đen
1614743559948-d158e36ecb4f | Đèn Thả Bàn Ăn | Nhôm Sơn Mờ | Đen
1598155038124-0ae4d7300461 | Đèn Thả Chụp Tròn | Trắng Sứ | Trắng
1627306411131-358d6d0fd2cb | Đèn Chùm Cổ Điển | Đồng Thau | 
1572955034096-233ea61a78d8 | Đèn Chùm Cổ Điển | Đồng Thau | Trắng
1588436199489-ac376a0b3884 | Đèn Chùm Pha Lê | Pha Lê | 
1568102106687-13401de952dc | Đèn Thả Chụp Tròn | Đồng Thau | Trắng
1621189321156-a9c210de0df4 | Đèn Thả Chùm Nhiều Bóng | Nhôm Sơn Mờ | Đen
1483678777699-a2340573e155 | Đèn Thả Chụp Tròn | Thủy Tinh Khói | Hổ Phách
1636368208791-17b81ed832d2 | Đèn Thả Chụp Lớn | Đồng Thau | 
1559924508-1461423083c5 | Đèn Thả Bàn Ăn | Thủy Tinh Mờ | Kem
1578678809569-1a8ead9cb802 | Đèn Thả Chụp Tròn | Mây Tre Đan | 
1553797794-4c4d2c55dbfb | Đèn Thả Chùm Nhiều Bóng | Vải Lanh | Trắng
1568482077316-1896b28e05d2 | Đèn Thả Bàn Ăn | Gỗ Sồi | Nâu
1560288847-74d32006d7d7 | Đèn Thả Chùm Nhiều Bóng | Giấy Xếp | Kem
1534659477036-c05235c62402 | Đèn Thả Chùm Nhiều Bóng | Bê Tông | Xám
1673939859210-23d8444237ff | Đèn Cây Đứng | Vải Lanh | Trắng
1675767528117-963ce219b52a | Đèn Cây Cần Câu | Trắng Sứ | Trắng
1774477178005-bff823e43be8 | Đèn Cây Cần Câu | Nhôm Sơn Mờ | Đen
1758380388531-3ce641e4b2d8 | Đèn Cây Đứng | Nhôm Sơn Mờ | Xám
1780898406363-a3858597ca6c | Đèn Cây Đứng | Gỗ Sồi | Gỗ Sáng
1742094561238-3325790b473b | Đèn Cây Đứng | Nhôm Sơn Mờ | Trắng
1708164970111-8ae9a5eed7b1 | Đèn Cây Đứng | Vải Lanh | Kem
1630578877871-1a2f9d372fd2 | Đèn Cây Đứng | Gỗ Sồi | Kem
1494438639946-1ebd1d20bf85 | Đèn Cây Cần Câu | Nhôm Sơn Mờ | Đen
1759647020559-2f91a4290ae4 | Đèn Cây Đứng | Vải Lanh | Trắng
1621177555630-b861919c864f | Đèn Cây Đứng | Nhôm Sơn Mờ | Cam
1625582709381-8350d178fdc6 | Đèn Cây Đứng | Nhôm Sơn Mờ | Đen
1720028383707-91bd36e2e25f | Đèn Cây Đứng | Vải Lanh | Kem
1624985113578-3b6af96e5eed | Đèn Cây Đứng | Vải Lanh | Trắng
`),
  'decor-lamp': items(`
1759199112433-524fbd7a4fa4 | Đèn Decor Nấm | Acrylic | Đỏ
1756474215990-a18a9a0521d5 | Đèn Decor Nấm | Kim Loại | Vàng
1786325835316-6af65bd31231 | Đèn Decor Nấm | Acrylic | Trắng
1758945630698-50766145f7c9 | Đèn Decor Nấm | Kim Loại | Vàng Đồng
1759753874998-5e0182e07af6 | Đèn Decor Nấm | Gỗ | Trắng
1756474215831-4e5f8309c6bc | Đèn Decor Nấm | Kim Loại | Vàng Chanh
1740034830826-9e03e68a7984 | Đèn Decor Nấm | Kim Loại | Cam
1753932847231-7949af383b98 | Đèn Decor Nấm | Acrylic | Trắng Sữa
1543332164-6e82f355badc | Đèn Decor Neon Chữ | Acrylic | Hồng
1507120410856-1f35574c3b45 | Đèn Decor Neon Chữ | Acrylic | Hồng Tím
1569081156361-c98e05e7f1e4 | Đèn Decor Neon Hình | Acrylic | Đỏ
1631058269796-6ea2654cc78b | Đèn Decor Neon Chữ | Acrylic | Đỏ
1496449903678-68ddcb189a24 | Đèn Decor Neon Chữ | Acrylic | Trắng
1504805572947-34fad45aed93 | Đèn Decor Neon Chữ | Acrylic | Trắng Lạnh
1554290712-e640351074bd | Đèn Decor Neon Chữ | Acrylic | Xanh Ngọc
1789989925048-ec2174c4983a | Đèn Decor Khối Cầu | Thủy Tinh Trong | 
1781441012654-bb5dced68054 | Đèn Decor Dáng Bầu | Giấy Gạo | Trắng
1764368892682-a584fb3bf149 | Đèn Decor Dung Nham | Thủy Tinh Màu | Cam
1780571189324-326018f0dfac | Đèn Decor Gợn Sóng | Gỗ | Gỗ Sáng
1538590586149-5fa9291f0de0 | Đèn Decor Kiểu Lồng | Giấy Gạo | Đỏ
1748191138225-c18a154884d0 | Đèn Decor Kiểu Lồng | Giấy Gạo | Trắng
1767627942878-4b566b84fdac | Đèn Decor Kiểu Lồng | Giấy Gạo | Trắng Ngà
1765814734773-2d5afb68b612 | Đèn Decor Kiểu Lồng | Giấy Gạo | Kem
1742982533100-0537f94b4fff | Đèn Decor Kiểu Lồng | Giấy Gạo | Đỏ Son
1543103127-5a7090371822 | Đèn Decor Kiểu Lồng | Giấy Gạo | Cam
1749815362062-33911b27ef9e | Đèn Decor Khảm Màu | Thủy Tinh Màu | Nhiều Màu
1749815362064-56c2269877d0 | Đèn Decor Khảm Màu | Thủy Tinh Màu | Sắc Màu
1771363340681-6d059f408235 | Đèn Decor Tiffany | Thủy Tinh Màu | Chuồn Chuồn
1766939366681-ececc93a482f | Đèn Decor Tiffany | Thủy Tinh Màu | Hoa Lá
1771363340669-8bedec3fd21c | Đèn Decor Tiffany | Thủy Tinh Màu | Hoa Văn
1771363340665-03b54b498e0e | Đèn Decor Tiffany | Thủy Tinh Màu | Cổ Điển
1757985567140-72f3fd2fa224 | Đèn Decor Tiffany | Thủy Tinh Màu | Xanh Ngọc
1732400048201-6ba5c3aa6843 | Đèn Decor Dầu Cổ | Thủy Tinh Trong | 
1574882225022-5f45b99d4966 | Đèn Decor Dung Nham | Thủy Tinh Màu | Xanh Dương
1763539912444-a71eb301510e | Đèn Decor Dung Nham | Thủy Tinh Màu | Đỏ Vàng
1690684090171-7988ffed11c1 | Đèn Decor Dung Nham | Thủy Tinh Màu | Tím
1581968038939-cb262c58103e | Đèn Decor Dung Nham | Thủy Tinh Màu | Đỏ
1649411138058-1559bedd4b2a | Đèn Decor Dung Nham | Thủy Tinh Màu | Cam Đào
1709177674961-49c9a36b9799 | Đèn Decor Dung Nham | Thủy Tinh Màu | Xanh Ngọc
`),
  'vase': items(`
1631125915902-d8abe9225ff2 | Bộ 3 Lọ Decor | Gốm Đất Nung | Nâu
1597696929736-6d13bed8e6a8 | Bộ 3 Lọ Decor | Gốm Bát Tràng | Be
1612196808214-b8e1d6145a8c | Bình Gốm Bụng Tròn | Gốm Bát Tràng | Trắng
1660721671073-e139688fa3cf | Bộ 3 Lọ Decor | Gốm Bát Tràng | Nhiều Màu
1677761640321-b80251be00ca | Lọ Hoa Mini | Gốm Đất Nung | Be
1784901390605-b50174168c40 | Lọ Hoa Mini | Gốm Bát Tràng | Hồng
1643569556871-91ec60671ed7 | Bình Gốm Dáng Vòng | Gốm Bát Tràng | Be
1631125915973-e0d155a14e4e | Bộ 3 Lọ Decor | Gốm Bát Tràng | Trắng
1526198049595-f32cde2a219d | Bình Hoa Dáng Cao | Gốm Bát Tràng | Xanh Dương
1526198330131-9b0bc79625e4 | Bình Hoa Dáng Cao | Gốm Bát Tràng | Đỏ
1687191883721-257d8cad5b54 | Bình Gốm Bụng Tròn | Gốm Bát Tràng | Trắng Sứ
1631125916276-69bcd14e3980 | Bộ 3 Lọ Decor | Gốm Đất Nung | Nâu Đất
1723779232101-19167d4b6e00 | Bình Hoa Miệng Loe | Gốm Vẽ Tay | Xanh Dương
1617111490936-07b47eafdcd4 | Bình Hoa Miệng Loe | Gốm Bát Tràng | Trắng
1588874133473-d6d9c9dd4f31 | Bình Hoa Dáng Cao | Gốm Bát Tràng | Trắng
1594644465539-783d6f6bb37d | Bình Gốm Bụng Tròn | Gốm Bát Tràng | Trắng Ngà
1502089418555-ebcba08cb377 | Bình Hoa Miệng Loe | Gốm Bát Tràng | Trắng Sứ
1554577621-1a3def0b656c | Lọ Hoa Mini | Gốm Men Rạn | Xám
1490312278390-ab64016e0aa9 | Lọ Hoa Mini | Gốm Bát Tràng | Trắng
1581783342308-f792dbdd27c5 | Lọ Hoa Mini | Gốm Bát Tràng | Trắng Sữa
`),
  'candle': items(`
1537948756265-406a522f1a45 | Chân Nến Cao | Đồng Thau | 
1609109522442-783c4d5aeffd | Chân Nến Cao | Kim Loại | Đen
1485364103940-e8aff191ed1e | Chân Nến Cao | Kim Loại | Bạc
1609775324322-6dafcbd21515 | Đế Nến Trụ | Đồng Thau | 
1767692965523-094a310db890 | Đế Nến Trụ | Thủy Tinh | Vân Nổi
1601747789712-3bb418a977df | Đế Nến Trụ | Đồng Thau | Vàng
1767116290804-de1237039897 | Chân Nến Cao | Kim Loại | Bạc Cổ
1672518194432-4c23cbcec1c4 | Chân Nến 5 Nhánh | Kim Loại | Bạc
1663872585222-b99f36d10223 | Chân Nến Cao | Kim Loại | Bạc Ánh
1593102032785-a956eca57454 | Đế Nến Trụ | Đồng Thau | Trắng
1565085122834-5e09b36f9f77 | Chân Nến 5 Nhánh | Kim Loại | Đen
1620678835433-37a0ecb02a9f | Chân Nến Cao | Kim Loại | Đen Nhám
1773777953425-487dfd55ec46 | Chân Nến 5 Nhánh | Đồng Thau | 
1603006905003-be475563bc59 | Đế Nến Trụ | Thủy Tinh | Trong
1602874801007-bd458bb1b8b6 | Đế Nến Trụ | Thủy Tinh | Trong Suốt
1669334388727-9a3437e12fa2 | Đế Nến Trụ | Thủy Tinh | Hổ Phách
`),
  'clock': items(`
1605791767308-46f38113f418 | Đồng Hồ Để Bàn | Gỗ | Nâu
1740928618840-32cfe6cadc7e | Đồng Hồ Để Bàn | Kim Loại | Đen
1774904721886-7b3abd03be14 | Đồng Hồ Báo Thức | Kim Loại | Cổ Điển
1764933173636-f8b2019a9a52 | Đồng Hồ Để Bàn | Gỗ | Gỗ Sáng
1718803597223-f7beeb310d3b | Đồng Hồ Để Bàn | Gỗ | Nâu Trầm
1787168295494-56b1d2ed01b7 | Đồng Hồ Để Bàn | Gỗ | Nâu
1764933173563-9f2e62b3828e | Đồng Hồ Để Bàn | Gỗ | Gỗ Sáng
1785529907878-94e26aa51d1a | Đồng Hồ Báo Thức | Nhựa | Đen
1541480601022-2308c0f02487 | Đồng Hồ Báo Thức | Kim Loại | Đen
1550534791-2677533605ab | Đồng Hồ Báo Thức | Kim Loại | Đỏ
1617299263454-3f1b584c89f3 | Đồng Hồ Báo Thức | Kim Loại | Xanh Lá
1609775436218-78e51e5e61dd | Đồng Hồ Báo Thức | Kim Loại | Đỏ Trắng
1524678714210-9917a6c619c2 | Đồng Hồ Báo Thức | Kim Loại | Bạc
1559575478-195bd74b0a57 | Đồng Hồ Báo Thức | Nhựa | Trắng
1601914757958-84916c07e4c0 | Đồng Hồ Báo Thức | Kim Loại | Bạc Trắng
1515334798407-90e6ea6624c1 | Đồng Hồ Báo Thức | Kim Loại | Bạc Ánh
1495364141860-b0d03eccd065 | Đồng Hồ Báo Thức | Kim Loại | Trắng
1415604934674-561df9abf539 | Đồng Hồ Báo Thức | Kim Loại | Xám
1563861826100-9cb868fdbe1c | Đồng Hồ Treo Tường | Kim Loại | Đen
1606674556490-c2bbb4ee05e5 | Đồng Hồ Treo Tường | Gỗ | Trắng
1765261221622-a39b437de77b | Đồng Hồ Treo Tường | Gỗ | Nâu
1590587754330-6fc06e3a9bb7 | Đồng Hồ Treo Tường | Kim Loại | Bạc
1594995846645-d58328c3ffa4 | Đồng Hồ Treo Tường | Kim Loại | Đen Trắng
1558603655-491ecfa8324f | Đồng Hồ Treo Tường | Đồng Thau | 
1609980775647-1fb1ef376268 | Đồng Hồ Treo Tường | Gỗ | Nâu Trầm
1602162786736-1575a5b1be76 | Đồng Hồ Treo Tường | Nhựa | Trắng
`),
  'sculpture': items(`
1637666505754-7416ebd70cbf | Tượng Bán Thân | Gốm Trắng | Viền Vàng
1772368871798-35ac0ebbfd5e | Tượng Đàn Voi | Gỗ Mít | Nâu
1763824372054-e7ead3f18acc | Tượng Rắn Cuộn | Gốm Trắng | Trắng
1786839832235-3eddee8fd010 | Tượng Trừu Tượng Ngọn Lửa | Đồng Đúc | Đen
1746719799204-9e5d579bf0ab | Tượng Dáng Người | Gốm Trắng | Trắng
1750175178708-78df85724724 | Tượng Bán Thân | Gốm Trắng | Trắng
1779774894130-95c744e1f7b0 | Tượng Dáng Người | Kim Loại | Bạc
1758557839522-7d6150265d39 | Tượng Trừu Tượng Vòng Xoắn | Đồng Đúc | 
1759803529014-6616e978d0ba | Khối Hình Học Decor | Kim Loại | Bạc
1770566858225-2538b45fe07c | Tượng Dáng Người | Đồng Đúc | 
1747191092806-c7da11881986 | Tượng Mặt Người Tối Giản | Gốm Đất Nung | Nâu
1693888282402-c425de8684b8 | Khối Hình Học Decor | Gốm Trắng | Trắng
1697480002448-3dbbed15fe5f | Tượng Dáng Người | Resin | Be
1751914039468-692aa79cbe1c | Tượng Mặt Người Tối Giản | Gốm Đất Nung | Nâu Đất
1788091385648-a29255b1bceb | Tượng Dáng Người | Gốm Đất Nung | Be
1769874825483-92ad32e92e25 | Khối Hình Học Decor | Gỗ Mít | Đen
1706821856764-4e85de5482d3 | Tượng Trừu Tượng Vòng Xoắn | Gốm Trắng | Trắng
1768212561364-bedf52776510 | Tượng Sóng Lượn | Thủy Tinh Màu | 
1617596223856-a17ba0eac50b | Tượng Thiên Thần | Gốm Trắng | Trắng
1745847768460-bd73b6d0fea1 | Tượng Chim | Gốm Men Bóng | Vàng
1773680585417-7bc4f12aefcc | Tượng Thú Ngồi | Gốm Vẽ Tay | 
1761408928418-b94be0bdb22f | Tượng Thú Ngồi | Gốm Vẽ Tay | Hồng
1784901394082-8c2f664ef74f | Tượng Thỏ | Resin | Nâu
1784901393067-250273368e10 | Tượng Thỏ | Resin | Hồng
1780498186714-7f6b1b66323a | Tượng Gỗ Nhân Vật | Gỗ Mít | Nâu
1773425350191-e5e697a42f69 | Tượng Thú Ngồi | Gốm Vẽ Tay | Nâu
1611650034971-11897caaf839 | Tượng Bán Thân | Gốm Trắng | Trắng Ngà
1568667936356-f5cbace71a12 | Tượng Phật Ngồi Thiền | Resin | Vàng Đồng
1694678830599-089ae58829d8 | Tượng Bán Thân | Đá Sa Thạch | Kem
1785837422151-dc928a21bcbb | Tượng Gỗ Nhân Vật | Gỗ Mít | Gỗ Sáng
1778869155609-e1c587e94dbd | Tượng Đầu Phật | Resin | Xanh Ngọc
1791278405146-937931fd0d3a | Tượng Phật Ngồi Thiền | Resin | Đen
1775537941419-08660255cadf | Chậu Tượng Bán Thân | Gốm Trắng | Trắng
1779148234993-75f9f85556b6 | Tượng Bán Thân | Gốm Trắng | Trắng Sứ
1776729883166-4abdd248ccdc | Chậu Tượng Bán Thân | Gốm Trắng | Trắng Ngà
1775830581347-874be55078b3 | Tượng Thỏ | Gốm Vẽ Tay | Trắng
1786551348882-cb2776d0e4af | Tượng Thú Ngồi | Gốm Vẽ Tay | Vàng Nâu
1760156885430-cd0bd9609ff6 | Tượng Voi Mini | Gốm Vẽ Tay | Xanh Dương
`),
  'plant': items(`
1545239705-1564e58b9e4a | Chậu Cây Bàng Singapore | Gốm Trắng | 
1694680319722-02b0f4ebd5cf | Chậu Cây Vạn Niên Thanh | Gốm Trắng | Kem
1700213040248-254e9267dd3e | Chậu Monstera | Gốm Trắng | 
1621274220348-41dc235ff439 | Chậu Sen Đá Mini | Gốm Trắng | 
1517024785852-498ab0c02de5 | Chậu Sen Đá Mini | Gốm Hoa Văn | 
1694425131928-03d64e880733 | Chậu Cây Ngọc Bích | Gốm Xanh Rêu | 
1519336056116-bc0f1771dec8 | Chậu Xương Rồng Mini | Đất Nung | 
1509223197845-458d87318791 | Chậu Sen Đá Mini | Gốm Trắng | 
1623804322653-ef9afccae982 | Chậu Sen Đá Mini | Gốm Xanh Lam | 
1578687595593-31fafb682273 | Chậu Sen Đá Mix | Gốm Trắng | 
1637149343639-4f450273ecd2 | Chậu Sen Đá Mix | Đất Nung | 
1766139435733-fbd31cba848b | Chậu Cây Môn Kiểng | Xi Măng | 
1757681745764-135e27f90ea5 | Chậu Cây Ô Liu | Gốm Trắng | 
1520412099551-62b6bafeb5bb | Chậu Cây Bonsai | Gốm Xanh Rêu | 
1762755647813-017e128a4ba0 | Chậu Monstera | Đất Nung | 
1614594975525-e45190c55d0b | Chậu Monstera | Gốm Trắng | 
1545241047-6083a3684587 | Chậu Monstera | Gốm Hồng Pastel | 
1530968464165-7a1861cbaf9f | Chậu Trầu Bà | Đất Nung | 
1567225557594-88d73e55f2cb | Chậu Cây Lưỡi Hổ | Gốm Trắng | 
1485955900006-10f4d324d411 | Chậu Sen Đá Mini | Gốm Xanh Rêu | 
1459411552884-841db9b3cc2a | Chậu Xương Rồng Mini | Đất Nung | 
1509423350716-97f9360b4e09 | Chậu Nha Đam | Gốm Trắng | 
1459156212016-c812468e2115 | Chậu Sen Đá Mix | Đất Nung | 
1509069575671-3df40ce5307c | Chậu Sen Đá Mini | Xi Măng | 
1572186192734-e82b57dc4435 | Chậu Sen Đá Mini | Gốm Hồng Pastel | 
1623667596999-48a96b93c3e1 | Chậu Nha Đam | Gốm Trắng | 
1579817193786-64c0fd7fbc16 | Chậu Sen Đá Mini | Đất Nung | 
1603764770961-28355104a9d2 | Chậu Sen Đá Mini | Đất Nung | 
1609061801093-1b7a8a574c69 | Chậu Cây Đồng Tiền | Gốm Trắng | 
1562351757-66f3589f30cf | Chậu Cây Đa Búp Đỏ | Đất Nung | 
1616961065849-edf307a08bcb | Chậu Cây Lưỡi Hổ | Gốm Trắng | 
1763195116052-fcc3f9ae30ac | Chậu Cây Dây Nhện | Đất Nung | 
1616961162823-aeba510620c6 | Chậu Cây Lưỡi Hổ | Gốm Trắng | 
1616961002389-504228edfcb7 | Chậu Cây Lưỡi Hổ | Giỏ Cói | 
1609061800916-894a886af7fa | Chậu Cây Lá Nhỏ | Gốm Trắng | 
1615766254664-ccacf4203a94 | Chậu Cây Bonsai | Gốm Hoa Văn | 
1753967825586-e9af49bcfac6 | Chậu Trầu Bà | Gốm Xanh Lam | 
1556408979-530064f3dff9 | Chậu Sen Đá Mini | Đất Nung | 
1753968099410-2f94c9be4ebe | Chậu Cây Sống Đời | Gốm Xanh Rêu | 
1673349333857-7c65fd51033a | Chậu Sen Đá Mini | Đất Nung | 
`),
  'frame': items(`
1582053628662-c65b0e0544e9 | Khung Ảnh Treo Tường A4 | Viền Gỗ Óc Chó | 
1774907432786-900e87e15cfc | Khung Tranh Cổ Điển | Viền Mạ Vàng | 
1611651525144-42027e7f45ba | Khung Ảnh Để Bàn 13x18 | Viền Đồng | 
1626846116799-ad61f874f99d | Khung Ảnh Treo Tường A4 | Viền Gỗ Sồi | 
1551373884-8a0750074df7 | Khung Ảnh Để Bàn 13x18 | Viền Trắng | 
1775909351534-c351ee89f35a | Khung Ảnh Để Bàn 13x18 | Viền Đồng | 
1634630563477-cff9c433c608 | Khung Ảnh Để Bàn 13x18 | Viền Trắng | 
1515288207449-100e125abccb | Khung Ảnh Để Bàn 13x18 | Viền Gỗ Óc Chó | 
1529254479751-faeedc59e78f | Khung Ảnh Để Bàn 13x18 | Viền Đen Mảnh | 
1766579696917-5335e0a82962 | Khung Tranh A3 | Viền Gỗ Sồi | 
1765137102463-95933b20b481 | Khung Tranh A3 | Viền Bạc | 
1680562310828-1cd535e2fd46 | Khung Tranh A3 | Viền Gỗ Óc Chó | 
1765137102474-422a4f3834e7 | Khung Tranh A3 | Viền Bạc | 
1765137138078-80c4792c05b3 | Khung Tranh Cổ Điển | Viền Bạc | 
1601360204725-a50359faad2f | Khung Tranh A3 | Viền Đen Mảnh | 
1765137138067-89abe3f4ba71 | Khung Tranh A3 | Viền Bạc | 
1560828343-a0b3d8864d1b | Khung Tranh Cổ Điển | Viền Mạ Vàng | 
1543487945-139a97f387d5 | Khung Tranh A3 | Viền Đen Mảnh | 
1601479207163-3c4dd6b0bb91 | Tranh Canvas Trừu Tượng | Canvas Căng Khung | Đen Trắng
1452457005517-a0dd81caca2a | Bộ 2 Khung Tranh | Viền Đen Mảnh | 
1646932537021-464ea1c6cb74 | Bộ Khung Gallery 7 Ô | Viền Đen Mảnh | 
1659038080639-fe3343f4b19a | Bộ Tranh Canvas Mini | Canvas Căng Khung | Hoàng Hôn
1574514120529-364d014b9a0a | Bộ 4 Khung Ảnh | Viền Đen Mảnh | 
1603460689763-cae435c723cc | Khung Tranh A3 | Viền Đen Mảnh | 
1690310588492-fc8f92bff323 | Khung Tranh A3 | Viền Gỗ Sồi | 
1513161455079-7dc1de15ef3e | Bộ 2 Khung Tranh | Viền Đen Mảnh | 
1582555172866-f73bb12a2ab3 | Bộ Khung Gallery 7 Ô | Viền Đen Mảnh | 
1771287490586-356754be24dc | Bộ 6 Khung Tranh | Viền Đen Mảnh | 
1778225242712-26889373ea6e | Bộ Khung Gallery 7 Ô | Viền Trắng | 
1758366278313-70468ec8cb2c | Bộ Khung Gallery 7 Ô | Viền Gỗ Sồi | 
1780672824152-e671d2470d78 | Khung Ảnh Treo Tường A4 | Viền Gỗ Óc Chó | 
1539975611936-f0d1221cfd16 | Khung Tranh A3 | Viền Gỗ Sồi | 
1554907984-15263bfd63bd | Bộ Khung Gallery 7 Ô | Viền Mạ Vàng | 
1757581559865-96f48eb27673 | Bộ 2 Khung Tranh | Viền Gỗ Sồi | 
1632258521940-b29d7d2ae9f5 | Khung Tranh A3 | Viền Mạ Vàng | 
1594392174535-eb4b1043dad3 | Bộ Khung Gallery 7 Ô | Viền Gỗ Sồi | 
1611651525502-68b5e15c9195 | Khung Tranh A3 | Viền Đồng | 
1676107981869-2521b9c407ad | Khung Tranh A3 | Viền Đen Mảnh | 
1602669244516-c776473355fe | Khung Tranh Cổ Điển | Viền Mạ Vàng | 
1594080049946-0cd9366e107c | Khung Ảnh Treo Tường A4 | Viền Trắng | 
1763906869528-9b471d7d416b | Khung Ảnh Treo Tường A4 | Viền Đồng | 
1513519245088-0e12902e5a38 | Bộ Khung Gallery 7 Ô | Viền Gỗ Sồi | 
`),
  'organizer': items(`
1644463589256-02679b9c0767 | Khay Bàn Làm Việc | Gỗ Sồi | Gỗ Sáng
1789691925521-a0867031b263 | Đế Sạc Đa Năng | Gỗ Óc Chó | Nâu Trầm
1639916991657-e74ba7546b28 | Hộp Đựng Bút | Bê Tông | Xám
1637162706431-f3b60962a82a | Hộp Đựng Bút | Bê Tông | Xám Đậm
1777917845221-f92884c1b61b | Kệ Tài Liệu 3 Tầng | Nhựa ABS | Trắng
1751107756600-fb136501dec7 | Hộp Đựng Bút | Gỗ Sồi | Gỗ Sáng
1751107807635-a2ac6035e8dd | Hộp Đựng Bút | Tre Ép | 
1751107756601-66fa542b0e3c | Hộp Đựng Bút | Gỗ Sồi | Vân Vòng
1751107756602-dc1f003e50b5 | Hộp Đựng Bút | Gỗ Sồi | Nâu
1767116291082-8a34a33554d9 | Hộp Đựng Bút | Kim Loại | Bạc
1664110780246-061a1bc0be84 | Hộp Đựng Bút | Thủy Tinh | 
1639917290489-4a4eb2a6aa3a | Hộp Đựng Bút | Bê Tông | Xám Nhạt
1781213983314-037deccf30a7 | Hộp Đựng Bút | Gốm | Be
1641247470229-ee9868ea42ad | Kệ Kê Màn Hình | Gỗ Sồi | Gỗ Sáng
1641057350241-c05da7c70a9f | Kệ Kê Màn Hình | Gỗ Sồi | Gỗ Sáng
`),
  'tray': items(`
1774167656563-3abd810e9d72 | Khay Tròn Decor | Gỗ Xoài | 
1746334181450-0c24379d2a13 | Đĩa Decor Trang Sức | Gốm Men Mờ | 
1746334393639-f8723da387a5 | Đĩa Decor Trang Sức | Gốm Men Mờ | Hồng
1786386729510-81e237c86975 | Khay Chữ Nhật Có Quai | Gỗ Xoài | 
1769107805527-5a30029f16cb | Khay Chữ Nhật Có Quai | Kim Loại Sơn | Đen
1524084848619-1161d3c8501a | Khay Chữ Nhật Có Quai | Gỗ Xoài | Nâu
1784901393087-988ae280ea4c | Khay Gỗ Oval | Gỗ Xoài | 
1787348889568-e58e3fc72a45 | Khay Chữ Nhật Có Quai | Gỗ Xoài | Nâu Trầm
1780664561042-3f4fe17bb7cf | Khay Tròn Decor | Gỗ Xoài | Gỗ Sáng
1783744087450-30bb151a7bf3 | Khay Oval Đựng Chìa Khoá | Gỗ Xoài | 
1566770050648-8447d2d40f1e | Khay Chữ Nhật Có Quai | Gỗ Xoài | Gỗ Sáng
1771276046000-db7d015ef334 | Khay Chữ Nhật Có Quai | Gỗ Xoài | Nâu Mật Ong
1610701596061-2ecf227e85b2 | Thớt Gỗ Phục Vụ | Gỗ Xoài | 
1578749556568-bc2c40e68b61 | Đĩa Decor Trang Sức | Gốm Men Mờ | Xanh Xám
1781255677463-3fc8595fd947 | Khay Chữ Nhật Có Quai | Kim Loại Sơn | Đen Nhám
1772459125358-e587337c4a92 | Khay Chữ Nhật Có Quai | Sơn Mài | Trắng
1765541268140-c40997e7a61b | Khay Tròn Decor | Kim Loại Sơn | Đen
1638493446293-ee3d0d537e4c | Khay Chữ Nhật Có Quai | Gỗ Xoài | Mộc
1790635915785-1f0240e2a271 | Khay Tròn Decor | Đồng Thau | 
`),
  'bookend': items(`
1612465289702-7c84b5258fde | Giá Treo Tai Nghe | Gỗ Óc Chó | Nâu
1629317480860-3265288e62a8 | Giá Treo Tai Nghe | Gỗ Sồi | Gỗ Sáng
1646771032150-6243ff3aea4d | Giá Treo Tai Nghe | Thép Sơn Đen | Đen
1629317443302-7c496cca44d5 | Giá Treo Tai Nghe | Gỗ Sồi | Mộc
1641247494318-5a7d3a445482 | Giá Treo Tai Nghe | Gỗ Sồi | Sáng Màu
1756387462027-77f122674c23 | Giá Đỡ Đồng Hồ Đeo Tay | Gỗ Óc Chó | Nâu
1561701374-7b7cf5194397 | Giá Treo Phụ Kiện | Thép Sơn Đen | Đen
1679759799183-8899c0d67b43 | Giá Đỡ Máy Tính Bảng | Nhôm Bạc | Xám
1675109313924-48bf0139b4a2 | Giá Đỡ Máy Tính Bảng | Gỗ Sồi | Nâu
1780802369931-d6eee63ea4c2 | Giá Đỡ Máy Tính Bảng | Nhôm Bạc | Xám Không Gian
1649194270405-0dfaf13cda14 | Giá Đỡ Máy Tính Bảng | Thép Sơn Đen | Đen
1675109322863-2f4eef9fe032 | Giá Đỡ Điện Thoại | Gỗ Sồi | Nâu
1579609598065-79f8e5bcfb70 | Giá Đỡ Điện Thoại | Thép Sơn Đen | Đen
1783909091141-62d17146da2d | Giá Đỡ Điện Thoại | Gỗ Sồi | Gỗ Sáng
1760443728221-0feabf5a0130 | Giá Đỡ Điện Thoại | Thép Sơn Đen | Đen Mảnh
1789499519702-756d2f8a1d7f | Giá Đỡ Điện Thoại | Thép Sơn Đen | Đen Nhám
1604665382581-3be0cdf8c877 | Giá Đỡ Điện Thoại | Nhôm Bạc | Bạc
1629317480826-910f729d1709 | Giá Đỡ Laptop | Nhôm Bạc | Bạc
1623567238235-940ff1311da7 | Giá Đỡ Laptop | Thép Sơn Đen | Đen
1629893250402-bc171e8bbe4e | Bàn Laptop Kê Giường | Gỗ Sồi | Gỗ Sáng
1788799438297-6c0bd8f493ad | Giá Đỡ Sách Đọc | Gỗ Sồi | Nâu
1763478958740-479f59cdd3c6 | Chặn Sách Hình Cầu | Đá Cẩm Thạch | Trắng
1641247456497-a0f3bde00e45 | Kệ Kê Laptop Gỗ Cong | Gỗ Sồi | Gỗ Sáng
1641247494306-7e62b0333ac0 | Kệ Kê Laptop Gỗ Cong | Gỗ Sồi | Sáng Màu
1767210338407-54b9264c326b | Giá Treo Bông Tai | Thép Sơn Đen | Đen
1780427827602-d69705948dc7 | Đế Đỡ Trang Sức | Gỗ Sồi | Vân Gỗ
1780427839404-9147bce7bfe9 | Đế Đỡ Trang Sức | Gỗ Sồi | Gỗ Sáng
1785185219165-5864bed2ec8a | Giá Treo Đồ Đứng | Gỗ Sồi | Gỗ Sáng
1587386252165-2904e4a13fd9 | Giá Treo Đồ Gắn Tường | Gỗ Sơn Trắng | Trắng
1623854156816-4c4fc355ffc7 | Giá Treo Đồ Gắn Tường | Gỗ Óc Chó | Nâu
1592178034856-845669eff0d8 | Giá Treo Đồ Gắn Tường | Gỗ Sồi | Mộc
1785013045678-634e31cf1ccf | Giá Treo Quần Áo | Thép Sơn Trắng | Trắng
1787395815945-a24f3606e2d8 | Giá Để Tạp Chí | Nhôm Bạc | Bạc
1787396177626-1b87f86c7562 | Giá Để Tạp Chí | Nhôm Bạc | Xám Bạc
1759329885322-66bf35c76aef | Giá Để Tạp Chí | Gỗ Sồi | Nâu
`),
};

/**
 * Dựng `def.count` sản phẩm, mỗi sản phẩm ứng với 1 ảnh trong ITEMS[def.prefix] (lấy rải đều khi ảnh
 * nhiều hơn số sản phẩm; nếu ít hơn thì ảnh được dùng lại với bộ sưu tập khác).
 * types:     [tên kiểu, kích thước, giá thấp, giá cao, cân nặng (kg), sizeCategory, câu mô tả]
 * materials: [tên ngắn, materialInfo, color mặc định, cụm mô tả chất liệu, hệ số giá, điểm nổi bật]
 */
function generate(def) {
  const list = ITEMS[def.prefix];
  if (!list) throw new Error(`[products-catalog] Không có ảnh cho "${def.prefix}"`);
  const typeByName = new Map(def.types.map(t => [t[0], t]));
  const matByName = new Map(def.materials.map(m => [m[0], m]));
  const names = new Set();
  const out = [];

  for (let i = 0; i < def.count; i++) {
    const [imageId, typeName, matName, colorWord] = list.length >= def.count
      ? list[Math.floor((i * list.length) / def.count)]
      : list[i % list.length];
    const type = typeByName.get(typeName);
    const mat = matByName.get(matName);
    if (!type) throw new Error(`[products-catalog] ${def.prefix}: thiếu kiểu "${typeName}"`);
    if (!mat) throw new Error(`[products-catalog] ${def.prefix}: thiếu chất liệu "${matName}"`);

    const colorLabel = colorWord && !matName.toLowerCase().includes(colorWord.toLowerCase()) ? colorWord : '';
    const base = [typeName, matName, colorLabel].filter(Boolean).join(' ');
    let name;
    for (let k = 0; ; k++) {
      const coll = COLLECTIONS[(i * 7 + k * 11 + def.offset) % COLLECTIONS.length];
      name = `${base} ${coll[0]}`;
      if (!names.has(name)) { names.add(name); var collection = coll; break; }
      if (k > COLLECTIONS.length) throw new Error(`[products-catalog] ${def.prefix}: trùng tên ${base}`);
    }

    const no = String(i + 1).padStart(2, '0');
    const id = `cat-${def.prefix}-${no}`;
    const h = hash(id);
    const [, dims, lo, hi, kg, size, typeDesc] = type;
    const [, materialInfo, defaultColor, matPhrase, factor, matFeature] = mat;
    const style = def.styles[(h >>> 3) % def.styles.length];
    const basePrice = nicePrice((lo + ((hi - lo) * (h % 1000)) / 1000) * factor);
    const reviews = reviewsFor(id, REVIEW_POOLS[def.reviews], h);
    const rating = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 5;
    const pool = def.features;
    const f1 = pool[h % pool.length];
    const f2 = pool[(h + 1 + ((h >>> 5) % (pool.length - 1))) % pool.length];

    out.push({
      id,
      name,
      slug: slugify(name),
      category: def.category,
      categoryName: def.categoryName,
      categoryGroup: def.group,
      productionType: 'READY_STOCK',
      customizable: false,
      basePrice,
      originalPrice: h % 3 === 0 ? nicePrice(basePrice * (1.12 + (h % 4) * 0.04)) : null,
      description: `${typeDesc}, ${matPhrase}.${colorLabel ? ` Phiên bản ${colorLabel.toLowerCase()}.` : ''} ${STYLE_LINES[style]}`,
      story: h % 2 === 0 ? collection[1] : '',
      rating,
      reviewCount: reviews.length,
      inStock: 3 + (h % 48),
      images: productImages(imageId),
      badge: h % 10 === 0 ? 'Bán chạy' : h % 10 === 1 || h % 10 === 2 ? 'Mới' : '',
      dimensions: dims,
      materialInfo,
      weight: kg >= 1 ? `${Math.round(kg * (0.9 + (h % 3) * 0.1) * 10) / 10}kg` : `${Math.round(kg * 1000)}g`,
      features: [...new Set([matFeature, f1, f2])],
      reviews,
      customization: null,
      threeModelType: null,
      flashSaleSlot: null,
      style,
      color: (colorWord && colorFilter(colorWord)) || defaultColor,
      printMaterial: null,
      sizeCategory: size,
      spaces: def.spaces[h % def.spaces.length],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Chất liệu dùng lại
// ---------------------------------------------------------------------------------------------
const M = {
  oak: ['Gỗ Sồi', 'Gỗ sồi trắng tự nhiên ghép thanh, phủ dầu lau gốc nước an toàn', 'Be', 'làm từ gỗ sồi vân thẳng, phủ dầu lau giữ cảm giác gỗ mộc', 1, 'Gỗ sồi tự nhiên, vân thẳng đẹp'],
  walnut: ['Gỗ Óc Chó', 'Gỗ óc chó tự nhiên kết hợp veneer óc chó, sơn PU mờ', 'Be', 'làm từ gỗ óc chó tông nâu trầm, vân gỗ sang trọng', 1.35, 'Gỗ óc chó tông nâu trầm sang trọng'],
  ash: ['Gỗ Tần Bì', 'Gỗ tần bì sấy chuẩn độ ẩm 10–12%, sơn lót chống mối mọt', 'Be', 'làm từ gỗ tần bì chắc khoẻ, ít cong vênh', 1.05, 'Gỗ tần bì sấy chuẩn, hạn chế cong vênh'],
  rubber: ['Gỗ Cao Su', 'Gỗ cao su ghép thanh đã tẩm sấy, sơn PU 3 lớp', 'Be', 'làm từ gỗ cao su tẩm sấy bền chắc, giá dễ chịu', 0.8, 'Gỗ cao su tẩm sấy, giá tốt'],
  pine: ['Gỗ Thông', 'Gỗ thông New Zealand ghép thanh, phủ dầu mộc', 'Be', 'làm từ gỗ thông sáng màu, vân gỗ tự nhiên', 0.85, 'Gỗ thông tự nhiên nhẹ, thơm mùi gỗ'],
  whiteMatte: ['Trắng Mờ', 'MDF lõi xanh chống ẩm, sơn trắng mờ 5 lớp', 'Trắng', 'hoàn thiện sơn trắng mờ sạch sẽ, dễ phối mọi không gian', 0.9, 'MDF lõi xanh chống ẩm'],
  blackMatte: ['Đen Nhám', 'Thép sơn tĩnh điện đen nhám, mặt gỗ ép phủ melamine', 'Đen', 'phối khung thép sơn tĩnh điện đen nhám', 0.95, 'Khung thép sơn tĩnh điện chống gỉ'],
  rattan: ['Mây Đan', 'Khung gỗ tần bì, mặt mây tự nhiên đan tay', 'Be', 'kết hợp khung gỗ và mây tự nhiên đan tay bởi thợ làng nghề', 1.15, 'Mây tự nhiên đan tay thủ công'],
  whiteWood: ['Gỗ Sơn Trắng', 'Gỗ cao su sơn trắng mờ 3 lớp', 'Trắng', 'gỗ sơn trắng nhẹ nhàng, sạch sẽ', 0.9, 'Sơn gốc nước an toàn'],
  marbleTop: ['Mặt Đá', 'Mặt đá ceramic vân cẩm thạch dày 12mm, chân thép sơn tĩnh điện', 'Trắng', 'mặt đá vân cẩm thạch chống trầy, chịu nhiệt', 1.4, 'Mặt đá ceramic chống trầy, chịu nhiệt'],
  brass: ['Đồng Thau', 'Đồng thau đúc / mạ đồng thau đánh xước', 'Be', 'phủ sắc đồng thau sang trọng, bắt sáng đẹp', 1.3, 'Đồng thau bền màu'],
  metal: ['Kim Loại', 'Thép sơn tĩnh điện chống gỉ', 'Đen', 'thân kim loại sơn tĩnh điện bền màu', 1, 'Sơn tĩnh điện chống gỉ, bền màu'],
};

// ---------------------------------------------------------------------------------------------
// Định nghĩa từng loại
// ---------------------------------------------------------------------------------------------
const DEFS = [
  // =============================== NỘI THẤT ===============================
  {
    prefix: 'sofa', category: 'sofa', categoryName: 'Sofa', group: 'FURNITURE', count: 36, offset: 2, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Modern', 'Vintage', 'Japanese'],
    spaces: [['phong-khach'], ['phong-khach', 'goc-chill']],
    types: [
      ['Sofa Văng 2 Chỗ', 'Dài 160cm x Sâu 82cm x Cao 78cm', 4900000, 9900000, 32, 'Lớn', 'Sofa văng 2 chỗ gọn gàng, vừa vặn cho căn hộ nhỏ hoặc phòng ngủ master'],
      ['Sofa 3 Chỗ Tay Vuông', 'Dài 210cm x Sâu 90cm x Cao 80cm', 8900000, 18900000, 48, 'Lớn', 'Sofa 3 chỗ tay vuông, đệm ngồi sâu cho cả nhà quây quần xem phim'],
      ['Sofa 3 Chỗ Chesterfield', 'Dài 215cm x Sâu 92cm x Cao 76cm', 14900000, 24900000, 60, 'Lớn', 'Sofa Chesterfield 3 chỗ tay cuộn, lưng chần nút cổ điển'],
      ['Sofa Góc Chữ L', 'Dài 260cm x Rộng 160cm x Cao 82cm', 12900000, 26900000, 72, 'Lớn', 'Sofa góc chữ L đổi chiều được, tận dụng tối đa góc phòng khách'],
      ['Sofa Bed Đa Năng', 'Dài 190cm x Sâu 88cm x Cao 80cm (mở giường 190x110cm)', 6900000, 12900000, 45, 'Lớn', 'Sofa bed kéo ra thành giường chỉ trong vài giây, tiện khi nhà có khách'],
      ['Sofa Đơn Thư Giãn', 'Dài 90cm x Sâu 85cm x Cao 82cm', 3500000, 7900000, 22, 'Trung bình', 'Sofa đơn thư giãn ôm lưng, hợp góc đọc sách cạnh cửa sổ'],
    ],
    materials: [
      ['Vải Linen', 'Vải linen pha cotton chống nhăn, khung gỗ thông sấy, đệm mút D40 bọc gòn', 'Be', 'bọc vải linen thoáng mát, mềm tay', 1, 'Vỏ vải linen tháo rời giặt được'],
      ['Vải Bouclé', 'Vải bouclé sợi xoăn, khung gỗ dầu, đệm mút D40 + lò xo túi', 'Trắng', 'bọc vải bouclé sợi xoăn mềm như mây', 1.15, 'Vải bouclé mềm, chống xù lông'],
      ['Nhung Tăm', 'Vải nhung tăm chống bám bụi, khung gỗ thông, đệm mút D35', 'Xanh', 'bọc nhung tăm mịn, bắt sáng đẹp', 1.1, 'Nhung tăm chống bám bụi'],
      ['Da Bò', 'Da bò thật lớp 1 xử lý chống nứt, khung gỗ dầu, đệm mút D40', 'Be', 'bọc da bò thật lên màu đẹp theo thời gian', 1.6, 'Da bò thật lớp 1, bảo hành da 3 năm'],
      ['Da Microfiber', 'Da PU microfiber chống bong tróc, khung gỗ thông sấy', 'Xám', 'bọc da microfiber dễ lau chùi, hợp nhà có trẻ nhỏ', 1.2, 'Da microfiber không bong tróc, lau sạch dễ dàng'],
      ['Vải Nỉ', 'Vải nỉ dày chống thấm nhẹ, khung gỗ cao su, đệm mút D35', 'Xám', 'bọc vải nỉ ấm áp, chống thấm nước nhẹ', 0.9, 'Vải nỉ chống thấm, chống bám lông thú cưng'],
    ],
    features: ['Bảo hành khung 5 năm', 'Giao và lắp đặt miễn phí nội thành', 'Lò xo túi độc lập ở đệm ngồi', 'Đệm lưng rời có thể tháo vệ sinh'],
  },
  {
    prefix: 'bed', category: 'bed', categoryName: 'Giường', group: 'FURNITURE', count: 37, offset: 5, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Japanese', 'Modern', 'Vintage'],
    spaces: [['phong-ngu']],
    types: [
      ['Giường Ngủ 1m6', 'Rộng 170cm x Dài 212cm x Cao 95cm (nệm 1m6 x 2m)', 5900000, 13900000, 70, 'Lớn', 'Giường ngủ 1m6 đầu giường cao tựa lưng, phản nan gỗ thoáng khí cho nệm'],
      ['Giường Ngủ 1m8', 'Rộng 190cm x Dài 212cm x Cao 100cm (nệm 1m8 x 2m)', 6900000, 15900000, 82, 'Lớn', 'Giường ngủ 1m8 rộng rãi cho vợ chồng và bé nhỏ'],
      ['Giường Bệt Kiểu Nhật', 'Rộng 175cm x Dài 210cm x Cao 25cm (nệm 1m6 x 2m)', 4900000, 9900000, 50, 'Lớn', 'Giường bệt thấp kiểu Nhật giúp phòng trông rộng và thoáng hơn'],
      ['Giường Bọc Nệm Đầu Cong', 'Rộng 170cm x Dài 212cm x Cao 110cm (nệm 1m6 x 2m)', 6900000, 13900000, 78, 'Lớn', 'Giường bọc nệm với đầu giường bo cong mềm mại, điểm nhấn sang trọng cho phòng ngủ'],
      ['Giường Đơn 1m2', 'Rộng 130cm x Dài 210cm x Cao 90cm (nệm 1m2 x 2m)', 3900000, 7900000, 45, 'Lớn', 'Giường đơn 1m2 cho phòng con hoặc phòng khách nhỏ'],
    ],
    materials: [M.oak, M.walnut, M.ash, M.rubber, M.whiteMatte,
      ['Bọc Nệm Vải', 'Khung gỗ dầu, đầu giường bọc vải linen chần bông, phản gỗ thông', 'Be', 'đầu giường bọc vải chần bông êm ái khi tựa lưng', 1.1, 'Đầu giường bọc nệm êm, tựa lưng đọc sách'],
      ['Bọc Da', 'Khung gỗ dầu, đầu giường bọc da PU cao cấp, phản gỗ thông', 'Đen', 'đầu giường bọc da PU sang trọng, dễ lau chùi', 1.2, 'Da PU cao cấp dễ vệ sinh'],
      ['Khung Sắt', 'Khung thép hộp sơn tĩnh điện, phản nan thép', 'Đen', 'khung sắt sơn tĩnh điện thanh mảnh, gầm cao thoáng', 0.75, 'Khung thép chắc chắn, không cọt kẹt']],
    features: ['Phản nan thoáng khí, chống ẩm nệm', 'Lắp ráp bằng ốc âm, không lộ đầu vít', 'Giao và lắp đặt miễn phí nội thành', 'Chịu tải đến 400kg', 'Bảo hành kết cấu 5 năm'],
  },
  {
    prefix: 'table', category: 'table', categoryName: 'Bàn', group: 'FURNITURE', count: 20, offset: 1, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Modern', 'Japanese'],
    spaces: [['phong-khach'], ['phong-lam-viec', 'phong-hoc'], ['phong-khach', 'phong-lam-viec']],
    types: [
      ['Bàn Ăn 4 Ghế', 'Dài 120cm x Rộng 75cm x Cao 75cm', 3900000, 8900000, 35, 'Lớn', 'Bàn ăn 4 chỗ vừa vặn cho gia đình nhỏ'],
      ['Bàn Ăn 6 Ghế', 'Dài 160cm x Rộng 85cm x Cao 75cm', 5900000, 13900000, 48, 'Lớn', 'Bàn ăn 6 chỗ rộng rãi cho những bữa cơm đông đủ'],
      ['Bàn Làm Việc', 'Dài 120cm x Sâu 60cm x Cao 75cm', 2490000, 5900000, 26, 'Lớn', 'Bàn làm việc mặt rộng, có lỗ luồn dây gọn gàng'],
      ['Bàn Học Có Giá Sách', 'Dài 110cm x Sâu 55cm x Cao 140cm', 2690000, 5490000, 38, 'Lớn', 'Bàn học liền giá sách phía trên, góc học tập gọn trong một khối'],
      ['Bàn Trà Phòng Khách', 'Dài 100cm x Rộng 55cm x Cao 42cm', 1990000, 4900000, 18, 'Trung bình', 'Bàn trà phòng khách có kệ dưới để sách báo, điều khiển'],
    ],
    materials: [M.oak, M.walnut, M.ash, M.blackMatte, M.marbleTop,
      ['Mặt Kính', 'Mặt kính cường lực 8mm, khung thép sơn đen, hộc gỗ', 'Đen', 'mặt kính cường lực trong suốt, khung thép đen', 1.15, 'Kính cường lực an toàn']],
    features: ['Mặt bàn chống thấm, lau sạch dễ dàng', 'Chân đệm cao su chống trầy sàn', 'Bảo hành kết cấu 3 năm', 'Giao và lắp đặt miễn phí nội thành'],
  },
  {
    prefix: 'side-table', category: 'side_table', categoryName: 'Bàn phụ', group: 'FURNITURE', count: 11, offset: 4, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Modern', 'Japanese'],
    spaces: [['phong-khach', 'goc-chill'], ['phong-ngu'], ['phong-khach', 'phong-ngu']],
    types: [
      ['Bàn Phụ Tròn', 'Đường kính 45cm x Cao 50cm', 690000, 1890000, 6, 'Nhỏ', 'Bàn phụ tròn đặt cạnh sofa để tách cà phê, chậu cây nhỏ'],
      ['Bộ Bàn Phụ Lồng Nhau', 'Lớn 50x35x45cm, nhỏ 40x30x38cm', 990000, 2190000, 9, 'Nhỏ', 'Bộ bàn phụ lồng nhau, kéo ra khi cần, gọn gàng khi cất'],
      ['Bàn Phụ Chữ C', 'Rộng 45cm x Sâu 30cm x Cao 62cm', 790000, 1690000, 5, 'Nhỏ', 'Bàn phụ chữ C có kệ dưới, đặt cạnh sofa hoặc giường'],
      ['Bàn Phụ Chân Trụ', 'Đường kính 40cm x Cao 55cm', 890000, 2290000, 8, 'Nhỏ', 'Bàn phụ chân trụ gọn gàng, đứng vững trên đế nặng'],
      ['Bàn Cà Phê Mini', 'Đường kính 60cm x Cao 45cm', 990000, 2490000, 8, 'Trung bình', 'Bàn cà phê mini cho ban công hoặc góc chill'],
      ['Tab Đầu Giường 1 Ngăn', 'Rộng 45cm x Sâu 38cm x Cao 50cm', 890000, 2290000, 9, 'Nhỏ', 'Tab đầu giường có ngăn để điện thoại, sách và kính'],
    ],
    materials: [M.oak, M.walnut, M.whiteMatte, M.blackMatte, M.marbleTop],
    features: ['Nhẹ, dễ di chuyển', 'Chân đệm chống trầy sàn', 'Lắp ráp trong 5 phút', 'Mặt phủ chống nước'],
  },
  {
    prefix: 'chair', category: 'chair', categoryName: 'Ghế', group: 'FURNITURE', count: 21, offset: 3, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Modern', 'Retro', 'Vintage'],
    spaces: [['phong-khach'], ['phong-lam-viec', 'phong-hoc'], ['phong-khach', 'goc-chill']],
    types: [
      ['Ghế Ăn', 'Rộng 45cm x Sâu 50cm x Cao 80cm (cao ngồi 45cm)', 690000, 1690000, 5, 'Trung bình', 'Ghế ăn tựa lưng cong ôm người, ngồi lâu không mỏi'],
      ['Ghế Gỗ Tựa Lưng', 'Rộng 46cm x Sâu 52cm x Cao 82cm (cao ngồi 45cm)', 790000, 1890000, 6, 'Trung bình', 'Ghế gỗ tựa lưng thanh mảnh, hợp bàn ăn lẫn bàn làm việc'],
      ['Ghế Kim Loại Ban Công', 'Rộng 48cm x Sâu 52cm x Cao 82cm', 590000, 1290000, 5, 'Trung bình', 'Ghế kim loại chịu nắng mưa, hợp ban công và sân vườn'],
      ['Ghế Bành Armchair', 'Rộng 75cm x Sâu 78cm x Cao 85cm', 2490000, 5900000, 16, 'Trung bình', 'Ghế bành armchair đệm dày, góc thư giãn lý tưởng'],
      ['Ghế Thư Giãn Khung Uốn', 'Rộng 68cm x Sâu 82cm x Cao 100cm', 1990000, 3900000, 12, 'Trung bình', 'Ghế thư giãn khung gỗ uốn đàn hồi nhẹ, ngả lưng thoải mái'],
      ['Ghế Làm Việc Xoay', 'Rộng 60cm x Sâu 58cm x Cao 82–92cm', 1490000, 3900000, 12, 'Trung bình', 'Ghế làm việc xoay 360°, chỉnh được độ cao'],
      ['Ghế Thư Giãn Bập Bênh', 'Rộng 68cm x Sâu 90cm x Cao 105cm', 2190000, 4900000, 14, 'Trung bình', 'Ghế bập bênh thư giãn nhẹ nhàng, hợp hiên nhà và góc đọc sách'],
    ],
    materials: [M.oak, M.walnut, M.ash, M.rattan, M.whiteWood,
      ['Bọc Vải', 'Khung gỗ tần bì, mặt ngồi bọc vải linen, đệm mút D35', 'Xám', 'đệm ngồi bọc vải êm ái', 1.1, 'Đệm ngồi bọc vải, tháo được để giặt'],
      ['Bọc Da', 'Khung gỗ / thép, bọc da PU cao cấp, đệm mút D40', 'Be', 'bọc da PU mềm, dễ lau chùi', 1.25, 'Da PU cao cấp dễ vệ sinh'],
      ['Bọc Nhung', 'Khung gỗ dầu, bọc nhung mịn, đệm mút D40', 'Hồng', 'bọc nhung mịn, sắc màu nổi bật', 1.2, 'Nhung mịn chống bám bụi'],
      ['Nhựa Đúc', 'Thân nhựa PP đúc nguyên khối, chân gỗ sồi', 'Trắng', 'thân nhựa đúc nguyên khối nhẹ và bền', 0.8, 'Nhựa PP đúc nguyên khối, chịu lực 150kg'],
      ['Kim Loại', 'Thép sơn tĩnh điện ngoài trời', 'Xanh', 'thép sơn tĩnh điện chịu nắng mưa', 0.85, 'Sơn tĩnh điện ngoài trời, chống gỉ']],
    features: ['Chịu tải đến 150kg', 'Chân đệm cao su chống trầy sàn', 'Bảo hành kết cấu 2 năm', 'Lắp ráp đơn giản, có sẵn dụng cụ'],
  },
  {
    prefix: 'stool', category: 'stool', categoryName: 'Ghế đôn', group: 'FURNITURE', count: 12, offset: 6, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Japanese', 'Modern'],
    spaces: [['phong-khach', 'goc-chill'], ['phong-ngu']],
    types: [
      ['Ghế Đôn Tròn', 'Đường kính 35cm x Cao 45cm', 390000, 990000, 3, 'Nhỏ', 'Ghế đôn tròn nhỏ gọn, vừa làm ghế ngồi vừa làm bàn phụ'],
      ['Ghế Đôn Bọc Nệm', 'Đường kính 40cm x Cao 45cm', 590000, 1290000, 4, 'Nhỏ', 'Ghế đôn bọc nệm êm, đặt cuối giường hoặc trước bàn trang điểm'],
      ['Ghế Đôn Quầy Bar', 'Đường kính 35cm x Cao 75cm', 690000, 1590000, 5, 'Trung bình', 'Ghế đôn cao cho quầy bar hoặc bàn đảo bếp'],
    ],
    materials: [M.oak, M.walnut, M.whiteWood,
      ['Kim Loại', 'Mặt gỗ, chân thép sơn tĩnh điện', 'Đen', 'chân thép sơn tĩnh điện chắc chắn', 0.9, 'Chân thép chịu lực tốt'],
      ['Bọc Bouclé', 'Khung gỗ cao su, mặt bọc vải bouclé, đệm mút D35', 'Trắng', 'mặt ngồi bọc vải bouclé mềm mại', 1.1, 'Vải bouclé mềm, chống xù'],
      ['Bọc Da', 'Khung gỗ, bọc da PU, đệm mút D35', 'Be', 'bọc da PU mềm, dễ lau chùi', 1.15, 'Da PU dễ vệ sinh']],
    features: ['Nhẹ, dễ di chuyển', 'Chịu tải 120kg', 'Chân đệm chống trượt', 'Lắp ráp đơn giản'],
  },
  {
    prefix: 'cabinet', category: 'cabinet', categoryName: 'Tủ', group: 'FURNITURE', count: 42, offset: 8, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Modern', 'Vintage', 'Japanese'],
    spaces: [['phong-ngu'], ['phong-khach'], ['phong-ngu', 'phong-khach']],
    types: [
      ['Tủ Quần Áo 2 Cánh', 'Rộng 100cm x Sâu 58cm x Cao 200cm', 4900000, 9900000, 85, 'Lớn', 'Tủ quần áo 2 cánh có thanh treo và đợt kệ xếp đồ'],
      ['Tủ Quần Áo 3 Cánh', 'Rộng 150cm x Sâu 58cm x Cao 210cm', 6900000, 14900000, 120, 'Lớn', 'Tủ quần áo 3 cánh rộng rãi, có ngăn kéo và thanh treo'],
      ['Tủ Quần Áo Âm Tường', 'Thiết kế theo kích thước tường (tham khảo Rộng 240cm x Cao 240cm)', 18900000, 39900000, 220, 'Lớn', 'Hệ tủ quần áo âm tường kệ mở, chia khoang treo, ngăn kéo và kệ giày'],
      ['Tủ Ngăn Kéo Thấp', 'Rộng 120cm x Sâu 45cm x Cao 80cm', 3900000, 7900000, 50, 'Lớn', 'Tủ ngăn kéo thấp ray giảm chấn, mặt tủ rộng đặt đèn và đồ trang trí'],
      ['Tủ Ngăn Kéo 5 Tầng', 'Rộng 80cm x Sâu 45cm x Cao 115cm', 2900000, 5900000, 45, 'Lớn', 'Tủ 5 ngăn kéo cao, chứa quần áo gấp và phụ kiện'],
      ['Tủ Giày Cánh Lật', 'Rộng 90cm x Sâu 24cm x Cao 115cm', 1990000, 3900000, 30, 'Trung bình', 'Tủ giày cánh lật siêu mỏng, đặt vừa hành lang hẹp'],
      ['Tủ Sideboard', 'Rộng 150cm x Sâu 42cm x Cao 78cm', 4500000, 9900000, 50, 'Lớn', 'Tủ sideboard chứa đồ phòng ăn, mặt tủ trưng bày decor'],
      ['Kệ Tivi Thấp', 'Rộng 180cm x Sâu 40cm x Cao 50cm', 2900000, 6900000, 42, 'Lớn', 'Kệ tivi thấp có cánh và hộc mở, đặt TV đến 75 inch'],
      ['Giá Tivi Chân Gỗ', 'Rộng 60cm x Sâu 50cm x Cao 150cm, cho TV 43–65 inch', 1990000, 3900000, 15, 'Lớn', 'Giá tivi dáng chân gỗ đứng, không cần khoan tường, đổi vị trí dễ dàng'],
      ['Tủ Đầu Giường 2 Ngăn', 'Rộng 50cm x Sâu 40cm x Cao 55cm', 990000, 2490000, 14, 'Nhỏ', 'Tủ đầu giường ngăn kéo, mặt tủ đặt đèn ngủ và sách'],
    ],
    materials: [M.oak, M.walnut, M.ash, M.whiteMatte, M.rattan,
      ['Cánh Kính', 'MDF chống ẩm phủ melamine, cánh kính cường lực khung nhôm', 'Xám', 'cánh kính cường lực khung nhôm sang trọng', 1.15, 'Cánh kính cường lực an toàn'],
      ['Sơn Màu', 'MDF lõi xanh chống ẩm, sơn màu 5 lớp, tay nắm kim loại', 'Trắng', 'sơn màu bền đẹp, điểm nhấn cho căn phòng', 1, 'Sơn gốc nước an toàn, bền màu']],
    features: ['Ray ngăn kéo và bản lề giảm chấn', 'Kèm chốt chống lật cho nhà có trẻ nhỏ', 'MDF lõi xanh chống ẩm', 'Giao và lắp đặt miễn phí nội thành', 'Bảo hành 3 năm'],
  },
  {
    prefix: 'shelf', category: 'bookshelf', categoryName: 'Kệ Sách & Kệ Treo Tường', group: 'FURNITURE', count: 38, offset: 10, reviews: 'furniture',
    styles: ['Minimalist', 'Scandinavian', 'Modern', 'Japanese', 'Vintage'],
    spaces: [['phong-lam-viec', 'phong-hoc'], ['phong-khach'], ['phong-hoc', 'phong-khach']],
    types: [
      ['Kệ Sách 5 Tầng', 'Rộng 80cm x Sâu 30cm x Cao 180cm', 1490000, 3900000, 28, 'Lớn', 'Kệ sách 5 tầng đứng, chứa được khoảng 200 cuốn sách'],
      ['Kệ Sách Thấp 3 Tầng', 'Rộng 100cm x Sâu 30cm x Cao 90cm', 990000, 2490000, 18, 'Trung bình', 'Kệ sách thấp, mặt trên trưng bày decor và cây xanh'],
      ['Kệ Sách Âm Tường', 'Thiết kế theo kích thước tường (tham khảo Rộng 200cm x Cao 240cm)', 9900000, 24900000, 120, 'Lớn', 'Hệ kệ sách âm tường kịch trần, biến cả bức tường thành thư viện'],
      ['Kệ Ô Vuông 9 Ngăn', 'Rộng 110cm x Sâu 32cm x Cao 110cm', 1290000, 2900000, 30, 'Lớn', 'Kệ ô vuông đặt sách, hộp vải hoặc làm vách ngăn phòng'],
      ['Kệ Treo Tường 3 Thanh', 'Rộng 60cm x Sâu 18cm (bộ 3 thanh)', 390000, 990000, 4, 'Nhỏ', 'Bộ thanh kệ treo tường ốc âm, gọn gàng cho phòng nhỏ'],
      ['Kệ Treo Tường Khung Sắt', 'Rộng 45cm x Sâu 15cm x Cao 60cm', 490000, 1190000, 4, 'Nhỏ', 'Kệ treo tường khung sắt phối gỗ, trưng bày cây nhỏ và đồ decor'],
      ['Kệ Góc Tường', 'Rộng 40cm x Sâu 40cm x Cao 160cm', 790000, 1890000, 12, 'Trung bình', 'Kệ đứng nhiều tầng tận dụng góc chết trong phòng'],
    ],
    materials: [M.oak, M.walnut, M.pine, M.whiteMatte, M.blackMatte],
    features: ['Mỗi tầng chịu tải 25kg', 'Kèm phụ kiện chống lật / ốc âm tường', 'Lắp ráp dễ dàng, có video hướng dẫn', 'Bảo hành kết cấu 2 năm'],
  },

  // =============================== ĐÈN & ÁNH SÁNG ===============================
  {
    prefix: 'desk-lamp', category: 'desk_lamp', categoryName: 'Đèn Bàn', group: 'FURNITURE', count: 39, offset: 0, reviews: 'light',
    styles: ['Minimalist', 'Modern', 'Scandinavian', 'Retro', 'Vintage'],
    spaces: [['phong-lam-viec'], ['phong-hoc'], ['phong-lam-viec', 'phong-hoc']],
    types: [
      ['Đèn Bàn Cần Gập', 'Đế 15cm x Cao 45cm (vươn tối đa 60cm)', 390000, 990000, 1.6, 'Nhỏ', 'Đèn bàn cần gập nhiều khớp, xoay chỉnh hướng sáng linh hoạt'],
      ['Đèn Bàn Mái Vòm', 'Đường kính chụp 18cm x Cao 40cm', 490000, 1290000, 1.5, 'Nhỏ', 'Đèn bàn chụp mái vòm, chiếu sáng tập trung xuống mặt bàn'],
      ['Đèn Bàn Chụp Vải', 'Đường kính chụp 28cm x Cao 50cm', 590000, 1490000, 2, 'Trung bình', 'Đèn bàn chụp vải cho ánh sáng khuếch tán dịu nhẹ'],
      ['Đèn Bàn Thư Viện', 'Rộng 30cm x Cao 40cm', 890000, 1990000, 2.2, 'Trung bình', 'Đèn bàn kiểu thư viện cổ điển, chụp ngang chiếu sáng trang sách'],
      ['Đèn Bàn Kẹp Bàn', 'Kẹp mặt bàn dày tối đa 5cm, cần uốn dài 50cm', 350000, 890000, 1, 'Nhỏ', 'Đèn kẹp cạnh bàn, cần uốn linh hoạt, giải phóng mặt bàn'],
      ['Đèn Bàn Chống Cận LED', 'Đế 18cm x Cao 45cm', 590000, 1490000, 1.4, 'Nhỏ', 'Đèn bàn LED chống cận, ánh sáng không nhấp nháy, 3 mức nhiệt màu'],
      ['Đèn Bàn Sạc Không Dây', 'Đế 14cm x Cao 25cm', 490000, 1190000, 0.8, 'Nhỏ', 'Đèn bàn LED pin sạc, mang đi khắp nhà không vướng dây'],
    ],
    materials: [M.metal, M.walnut, M.brass,
      ['Nhôm', 'Thân nhôm anode, bóng LED 10W, pin sạc 2000mAh', 'Trắng', 'thân nhôm nhẹ, tản nhiệt tốt', 1.1, 'LED chống cận, không nhấp nháy']],
    features: ['Chỉ số hoàn màu CRI > 90', 'Công tắc cảm ứng 3 mức sáng', 'Bảo hành bóng LED 12 tháng', 'Không nhấp nháy, bảo vệ mắt'],
  },
  {
    prefix: 'night-lamp', category: 'night_lamp', categoryName: 'Đèn Ngủ', group: 'FURNITURE', count: 39, offset: 3, reviews: 'light',
    styles: ['Minimalist', 'Scandinavian', 'Japanese', 'Vintage', 'Modern'],
    spaces: [['phong-ngu'], ['phong-ngu', 'goc-chill']],
    types: [
      ['Đèn Ngủ Chụp Vải', 'Đường kính chụp 25cm x Cao 42cm', 390000, 1290000, 1.8, 'Nhỏ', 'Đèn ngủ chụp vải đặt tab đầu giường, ánh sáng vàng ấm dịu mắt'],
      ['Đèn Ngủ Mái Vòm', 'Đường kính chụp 20cm x Cao 32cm', 450000, 1390000, 1.4, 'Nhỏ', 'Đèn ngủ chụp mái vòm, hắt sáng xuống mặt tủ đầu giường'],
      ['Đèn Ngủ Cầu Tròn', 'Đường kính cầu 18cm x Cao 25cm', 350000, 1190000, 1, 'Nhỏ', 'Đèn ngủ cầu tròn, ánh sáng toả đều mềm mại'],
      ['Đèn Ngủ Để Bàn', 'Đường kính 14cm x Cao 25cm', 250000, 890000, 0.8, 'Nhỏ', 'Đèn ngủ để bàn nhỏ gọn, ánh sáng dịu cho giấc ngủ ngon'],
    ],
    materials: [M.metal, M.brass, M.oak, M.walnut,
      ['Gốm Men Mờ', 'Thân gốm men mờ, chụp vải lanh, bóng LED E14 5W', 'Trắng', 'thân gốm men mờ thủ công', 1.1, 'Thân gốm làm thủ công, mỗi chiếc một vân men'],
      ['Thủy Tinh Mờ', 'Thủy tinh mờ thổi thủ công, đế kim loại, LED 5W', 'Trắng', 'thủy tinh mờ cho ánh sáng khuếch tán dịu nhẹ', 1.15, 'Thủy tinh mờ thổi thủ công'],
      ['Giấy Washi', 'Khung tre, chụp giấy washi Nhật, LED 5W', 'Be', 'chụp giấy washi Nhật cho ánh sáng mộc mạc', 1, 'Giấy washi nhập khẩu, ánh sáng ấm dịu'],
      ['Vải Lanh', 'Chụp vải lanh, thân kim loại sơn mờ, bóng LED E27 7W', 'Trắng', 'chụp vải lanh cho ánh sáng mềm', 1, 'Chụp vải lanh tháo rời vệ sinh được'],
      ['Đá Muối', 'Khối đá muối Himalaya tự nhiên, đế gỗ, bóng 15W', 'Be', 'khối đá muối tự nhiên toả ánh cam ấm', 1.2, 'Đá muối tự nhiên, mỗi khối một hình dáng'],
      ['Gỗ Lũa', 'Thân gỗ lũa tự nhiên, chụp vải, đui E27', 'Be', 'thân gỗ lũa độc bản', 1.4, 'Gỗ lũa tự nhiên, mỗi chiếc một dáng riêng']],
    features: ['Ánh sáng vàng ấm 2700K dễ ngủ', 'Điều chỉnh độ sáng vô cấp', 'Không nhấp nháy, không tia UV', 'Bảo hành 12 tháng'],
  },
  {
    prefix: 'pendant', category: 'pendant_lamp', categoryName: 'Đèn Thả & Đèn Cây', group: 'FURNITURE', count: 43, offset: 7, reviews: 'light',
    styles: ['Minimalist', 'Modern', 'Scandinavian', 'Vintage', 'Japanese'],
    spaces: [['phong-khach'], ['phong-khach', 'goc-chill'], ['phong-khach', 'phong-lam-viec']],
    types: [
      ['Đèn Thả Bàn Ăn', 'Đường kính chụp 30cm, dây treo chỉnh 50–150cm', 690000, 1890000, 2, 'Trung bình', 'Đèn thả trên bàn ăn, ánh sáng tập trung giúp món ăn ngon mắt hơn'],
      ['Đèn Thả Chụp Lớn', 'Đường kính chụp 50cm, dây treo chỉnh 60–150cm', 1290000, 3290000, 3, 'Lớn', 'Đèn thả chụp lớn làm điểm nhấn trung tâm phòng khách'],
      ['Đèn Thả Chụp Tròn', 'Đường kính chụp 40cm, dây treo chỉnh 50–150cm', 890000, 2290000, 2.5, 'Trung bình', 'Đèn thả chụp tròn cho ánh sáng toả đều'],
      ['Đèn Thả Chùm Nhiều Bóng', 'Đế trần 60cm, 3–7 bóng treo so le', 1490000, 3900000, 4, 'Lớn', 'Đèn thả chùm nhiều bóng treo so le cho đảo bếp hoặc bàn ăn dài'],
      ['Đèn Chùm Cổ Điển', 'Đường kính 70cm x Cao 60cm', 3900000, 8900000, 8, 'Lớn', 'Đèn chùm cổ điển nhiều tay, sang trọng cho phòng khách trần cao'],
      ['Đèn Chùm Pha Lê', 'Đường kính 60cm x Cao 70cm', 4900000, 12900000, 10, 'Lớn', 'Đèn chùm pha lê lấp lánh, bắt sáng rực rỡ'],
      ['Đèn Cây Đứng', 'Đế 30cm x Cao 160cm', 990000, 2690000, 5, 'Lớn', 'Đèn cây đứng cạnh sofa, ánh sáng hắt ấm áp cho phòng khách'],
      ['Đèn Cây Cần Câu', 'Đế 32cm x Cao 180cm (vươn 100cm)', 1490000, 3490000, 7, 'Lớn', 'Đèn cây cần câu vươn qua ghế đọc sách, không cần khoan trần'],
    ],
    materials: [M.brass, M.oak,
      ['Nhôm Sơn Mờ', 'Chụp nhôm sơn tĩnh điện mờ, đui E27, dây vải bọc', 'Đen', 'chụp nhôm sơn mờ tinh gọn', 1, 'Đui E27 phổ thông, dễ thay bóng'],
      ['Trắng Sứ', 'Chụp thép sơn trắng sứ bóng nhẹ, đui E27', 'Trắng', 'sơn trắng sứ sạch sẽ, hợp nhà tông sáng', 1, 'Sơn tĩnh điện chống bám bụi'],
      ['Mây Tre Đan', 'Chụp mây tre đan thủ công, đui E27', 'Be', 'chụp mây tre đan thủ công cho bóng đổ đẹp mắt', 1.1, 'Mây tre đan tay bởi làng nghề'],
      ['Thủy Tinh Khói', 'Chụp thủy tinh màu thổi thủ công, đui E27', 'Be', 'chụp thủy tinh thổi thủ công cho ánh sáng huyền ảo', 1.25, 'Thủy tinh thổi thủ công'],
      ['Thủy Tinh Mờ', 'Chụp thủy tinh mờ, đui E27', 'Trắng', 'chụp thủy tinh mờ cho ánh sáng dịu', 1.15, 'Thủy tinh mờ không chói'],
      ['Vải Lanh', 'Chụp vải lanh, khung thép, đui E27', 'Trắng', 'chụp vải lanh khuếch tán ánh sáng mềm', 1, 'Chụp vải tháo rời vệ sinh được'],
      ['Giấy Xếp', 'Chụp giấy xếp nếp chống cháy, đui E27', 'Be', 'chụp giấy xếp nếp nhẹ tênh', 0.9, 'Giấy xếp nếp chống cháy lan'],
      ['Bê Tông', 'Đui bê tông đúc, bóng dây tóc Edison', 'Xám', 'đui bê tông đúc phong cách công nghiệp', 0.95, 'Bê tông đúc thủ công'],
      ['Pha Lê', 'Khung kim loại mạ, chuỗi pha lê K9', 'Trắng', 'chuỗi pha lê K9 lấp lánh', 1.5, 'Pha lê K9 trong suốt, bắt sáng']],
    features: ['Tặng kèm bóng LED ánh vàng', 'Tương thích bóng thông minh', 'Hỗ trợ lắp đặt nội thành', 'Bảo hành 12 tháng'],
  },
  {
    // Danh mục "Đèn decor" lọc theo từ khoá trên category 'lamp' (xem catalog-taxonomy.ts) — tên phải có
    // chữ "Decor" và tránh các từ khoá của nhóm đèn khác để không bị tính trùng.
    prefix: 'decor-lamp', category: 'lamp', categoryName: 'Đèn Decor', group: 'DECOR', count: 39, offset: 11, reviews: 'light',
    styles: ['Modern', 'Cute/Kawaii', 'Japanese', 'Retro', 'Vintage'],
    spaces: [['goc-chill'], ['phong-khach', 'goc-chill'], ['phong-ngu', 'goc-chill']],
    types: [
      ['Đèn Decor Nấm', 'Đường kính 25cm x Cao 30cm', 390000, 1190000, 1.5, 'Nhỏ', 'Đèn decor dáng nấm tròn trịa, điểm nhấn đáng yêu cho kệ sách'],
      ['Đèn Decor Neon Chữ', 'Rộng 50cm x Cao 25cm', 450000, 1290000, 0.8, 'Nhỏ', 'Đèn decor neon uốn chữ, làm nền chụp ảnh và điểm nhấn tường'],
      ['Đèn Decor Neon Hình', 'Rộng 35cm x Cao 40cm', 450000, 1190000, 0.7, 'Nhỏ', 'Đèn decor neon uốn hình biểu tượng, treo tường cực cá tính'],
      ['Đèn Decor Khối Cầu', 'Đường kính 22cm x Cao 22cm', 590000, 1490000, 1.8, 'Nhỏ', 'Đèn decor khối cầu thủy tinh phát sáng như một vầng sáng nhỏ'],
      ['Đèn Decor Dáng Bầu', 'Đường kính 24cm x Cao 32cm', 450000, 1190000, 1.2, 'Nhỏ', 'Đèn decor dáng bầu tròn trịa, ánh sáng dịu như một vầng trăng nhỏ'],
      ['Đèn Decor Dung Nham', 'Đường kính 11cm x Cao 40cm', 490000, 990000, 1.6, 'Nhỏ', 'Đèn decor dung nham với những khối sáp trôi lững lờ, thư giãn mắt sau giờ làm'],
      ['Đèn Decor Gợn Sóng', 'Rộng 20cm x Cao 45cm', 690000, 1590000, 1.5, 'Nhỏ', 'Đèn decor dải LED gợn sóng uốn quanh thân, đổ bóng nghệ thuật'],
      ['Đèn Decor Kiểu Lồng', 'Đường kính 30cm x Cao 35cm', 250000, 790000, 0.5, 'Nhỏ', 'Đèn decor kiểu lồng đèn giấy, ánh sáng lung linh ấm áp'],
      ['Đèn Decor Khảm Màu', 'Đường kính 20cm x Cao 30cm', 590000, 1490000, 1.5, 'Nhỏ', 'Đèn decor khảm kính màu kiểu Thổ Nhĩ Kỳ, hắt hoa văn rực rỡ lên tường'],
      ['Đèn Decor Tiffany', 'Đường kính chụp 30cm x Cao 45cm', 1290000, 2990000, 3, 'Trung bình', 'Đèn decor chụp kính màu ghép kiểu Tiffany, ánh sáng rực rỡ như ô cửa kính nhà thờ'],
      ['Đèn Decor Dầu Cổ', 'Đường kính 12cm x Cao 35cm', 450000, 990000, 0.9, 'Nhỏ', 'Đèn decor dáng đèn dầu cổ, dùng bóng LED an toàn'],
    ],
    materials: [M.metal,
      ['Acrylic', 'Thân acrylic, LED neon flex 12V, adapter kèm theo', 'Trắng', 'chất liệu acrylic nhẹ, bền, ánh sáng đều', 1, 'LED tiết kiệm điện, không nóng'],
      ['Gỗ', 'Thân gỗ tự nhiên, LED 5W', 'Be', 'thân gỗ tự nhiên ấm áp', 1.1, 'Gỗ tự nhiên phủ dầu'],
      ['Thủy Tinh Trong', 'Thủy tinh trong thổi thủ công, đế kim loại, LED 4W', 'Trắng', 'thủy tinh trong suốt bắt sáng lấp lánh', 1.1, 'Thủy tinh thổi thủ công'],
      ['Thủy Tinh Màu', 'Thủy tinh màu, đế kim loại, bóng 25W', 'Pastel', 'thủy tinh màu rực rỡ', 1.15, 'Thủy tinh màu bền màu'],
      ['Giấy Gạo', 'Khung tre, chụp giấy gạo, LED 4W', 'Trắng', 'chụp giấy gạo cho ánh sáng mềm như sương', 0.9, 'Giấy gạo thủ công, ánh sáng mềm']],
    features: ['Cắm USB hoặc adapter kèm theo', 'Ánh sáng không nóng, an toàn', 'Điểm nhấn chụp ảnh sống ảo', 'Bảo hành 6 tháng', 'Đóng gói hộp quà sẵn'],
  },

  // =============================== DECOR ===============================
  {
    prefix: 'vase', category: 'vase', categoryName: 'Bình Hoa & Lọ Decor', group: 'DECOR', count: 15, offset: 1, reviews: 'decor',
    styles: ['Minimalist', 'Japanese', 'Vintage', 'Scandinavian'],
    spaces: [['phong-khach', 'goc-chill'], ['phong-khach'], ['phong-ngu', 'goc-chill']],
    types: [
      ['Bình Hoa Dáng Cao', 'Đường kính 14cm x Cao 35cm', 290000, 790000, 1.4, 'Trung bình', 'Bình hoa dáng cao cắm cành dài, hoa tươi hay hoa khô'],
      ['Lọ Hoa Mini', 'Đường kính 8cm x Cao 12cm', 120000, 290000, 0.3, 'Mini', 'Lọ hoa mini cắm 1–2 cành, xinh xắn trên bàn làm việc'],
      ['Bình Gốm Bụng Tròn', 'Đường kính 22cm x Cao 26cm', 390000, 990000, 2, 'Trung bình', 'Bình gốm bụng tròn đầy đặn, đẹp ngay cả khi không cắm hoa'],
      ['Bình Gốm Dáng Vòng', 'Rộng 20cm x Dày 7cm x Cao 21cm', 290000, 690000, 0.9, 'Nhỏ', 'Bình gốm dáng vòng tròn rỗng giữa, vừa cắm hoa vừa là tác phẩm trang trí'],
      ['Bộ 3 Lọ Decor', '3 lọ cao 10cm, 15cm, 20cm', 350000, 890000, 1.2, 'Nhỏ', 'Bộ 3 lọ decor cao thấp khác nhau, xếp thành nhóm trên kệ'],
      ['Bình Hoa Miệng Loe', 'Đường kính miệng 16cm x Cao 25cm', 290000, 790000, 1.1, 'Trung bình', 'Bình hoa miệng loe cắm bó hoa tươi xoè đẹp'],
    ],
    materials: [
      ['Gốm Bát Tràng', 'Gốm Bát Tràng nung 1200°C, men mờ, chống thấm nước', 'Trắng', 'gốm Bát Tràng nung nhiệt cao, men mịn tay', 1, 'Gốm Bát Tràng chống thấm, cắm hoa tươi được'],
      ['Gốm Men Rạn', 'Gốm men rạn thủ công, nung 1250°C', 'Xám', 'gốm men rạn với vân rạn tự nhiên', 1.2, 'Men rạn tự nhiên, không chiếc nào giống chiếc nào'],
      ['Gốm Đất Nung', 'Đất nung mộc không men bên ngoài, lòng phủ men chống thấm', 'Be', 'đất nung mộc thô ráp ấm áp', 0.85, 'Đất nung mộc, lòng bình phủ men chống thấm'],
      ['Gốm Vẽ Tay', 'Gốm men bóng vẽ hoạ tiết thủ công', 'Xanh', 'gốm vẽ tay hoạ tiết tỉ mỉ', 1.4, 'Hoạ tiết vẽ tay bởi nghệ nhân']],
    features: ['Đóng gói chống sốc 3 lớp', 'Đáy có đệm chống trầy mặt bàn', 'Tặng kèm thiệp viết tay', 'Đổi mới nếu vỡ khi vận chuyển'],
  },
  {
    prefix: 'candle', category: 'candle_holder', categoryName: 'Đế Nến Decor', group: 'DECOR', count: 13, offset: 2, reviews: 'decor',
    styles: ['Minimalist', 'Vintage', 'Scandinavian', 'Modern'],
    spaces: [['phong-ngu', 'goc-chill'], ['phong-khach', 'goc-chill']],
    types: [
      ['Đế Nến Trụ', 'Đường kính 10cm x Cao 8cm', 150000, 390000, 0.5, 'Mini', 'Đế nến cho nến cốc hoặc nến trụ, tạo góc ánh sáng ấm áp'],
      ['Chân Nến Cao', 'Đế 9cm x Cao 25cm', 190000, 590000, 0.6, 'Nhỏ', 'Chân nến cao cho nến que, sang trọng trên bàn ăn tối'],
      ['Chân Nến 5 Nhánh', 'Rộng 35cm x Cao 40cm', 590000, 1490000, 1.8, 'Trung bình', 'Chân nến 5 nhánh cổ điển, điểm nhấn cho bàn tiệc và kệ lò sưởi'],
    ],
    materials: [M.brass,
      ['Kim Loại', 'Thép / hợp kim kẽm mạ, đánh bóng', 'Đen', 'kim loại mạ bền màu', 1, 'Kim loại mạ chống gỉ'],
      ['Thủy Tinh', 'Thủy tinh dày chịu nhiệt', 'Trắng', 'thủy tinh chịu nhiệt, ánh nến lung linh', 0.9, 'Thủy tinh chịu nhiệt']],
    features: ['Chịu nhiệt, an toàn khi đốt nến lâu', 'Đế chống trượt', 'Tặng kèm 1 nến thơm', 'Gói quà miễn phí'],
  },
  {
    prefix: 'clock', category: 'clock', categoryName: 'Đồng Hồ Decor', group: 'DECOR', count: 17, offset: 4, reviews: 'decor',
    styles: ['Minimalist', 'Vintage', 'Scandinavian', 'Retro'],
    spaces: [['phong-lam-viec', 'phong-khach'], ['phong-ngu'], ['phong-hoc']],
    types: [
      ['Đồng Hồ Để Bàn', 'Rộng 15cm x Sâu 6cm x Cao 15cm', 290000, 790000, 0.6, 'Nhỏ', 'Đồng hồ để bàn máy kim trôi chạy êm, không tiếng tích tắc'],
      ['Đồng Hồ Báo Thức', 'Đường kính 11cm x Cao 14cm', 250000, 590000, 0.4, 'Mini', 'Đồng hồ báo thức chuông to rõ, đặt đầu giường'],
      ['Đồng Hồ Treo Tường', 'Đường kính 30cm x Dày 4cm', 390000, 1190000, 1, 'Trung bình', 'Đồng hồ treo tường mặt số dễ đọc từ xa'],
    ],
    materials: [M.brass,
      ['Gỗ', 'Vỏ gỗ tự nhiên, mặt kính khoáng, máy Quartz Nhật', 'Be', 'vỏ gỗ tự nhiên ấm áp', 1.1, 'Máy Quartz Nhật chạy chính xác'],
      ['Kim Loại', 'Vỏ kim loại sơn tĩnh điện, máy Quartz', 'Đen', 'vỏ kim loại sơn bền màu', 1, 'Kim trôi, không tiếng ồn'],
      ['Nhựa', 'Vỏ nhựa ABS cao cấp, máy Quartz', 'Trắng', 'vỏ nhựa ABS nhẹ, bền', 0.8, 'Nhẹ, an toàn khi rơi']],
    features: ['Dùng 1 pin AA, tặng kèm pin', 'Bảo hành máy 12 tháng', 'Mặt kính chống trầy', 'Gói quà miễn phí'],
  },
  {
    prefix: 'sculpture', category: 'sculpture', categoryName: 'Tượng Trang Trí & Abstract', group: 'DECOR', count: 38, offset: 9, reviews: 'decor',
    styles: ['Minimalist', 'Modern', 'Japanese', 'Vintage', 'Cute/Kawaii'],
    spaces: [['phong-khach', 'goc-chill'], ['phong-lam-viec'], ['phong-khach', 'phong-lam-viec']],
    types: [
      ['Tượng Bán Thân', 'Rộng 18cm x Sâu 12cm x Cao 30cm', 490000, 1490000, 2, 'Trung bình', 'Tượng bán thân phong cách cổ điển châu Âu, điểm nhấn nghệ thuật cho kệ sách'],
      ['Chậu Tượng Bán Thân', 'Rộng 16cm x Sâu 14cm x Cao 22cm (lòng chậu 10cm)', 290000, 790000, 1.5, 'Nhỏ', 'Tượng bán thân kiêm chậu cây — trồng sen đá hay dương xỉ trên đỉnh đầu'],
      ['Tượng Mặt Người Tối Giản', 'Rộng 12cm x Sâu 10cm x Cao 28cm', 390000, 1190000, 1.5, 'Nhỏ', 'Tượng mặt người nét tối giản, trầm tư và nghệ thuật'],
      ['Tượng Dáng Người', 'Rộng 10cm x Sâu 8cm x Cao 30cm', 390000, 1490000, 1.2, 'Nhỏ', 'Tượng dáng người thanh mảnh, gợi chuyển động mềm mại'],
      ['Tượng Trừu Tượng Vòng Xoắn', 'Rộng 15cm x Sâu 8cm x Cao 25cm', 290000, 990000, 1.2, 'Nhỏ', 'Tượng trừu tượng dáng xoắn, điểm nhấn hiện đại cho kệ tivi'],
      ['Tượng Trừu Tượng Ngọn Lửa', 'Rộng 18cm x Sâu 10cm x Cao 35cm', 690000, 1890000, 2.5, 'Trung bình', 'Tượng trừu tượng dáng ngọn lửa với những đường cắt khoét nghệ thuật'],
      ['Tượng Sóng Lượn', 'Rộng 30cm x Sâu 8cm x Cao 18cm', 450000, 1490000, 1.6, 'Trung bình', 'Tượng sóng lượn mềm mại như dải lụa'],
      ['Khối Hình Học Decor', 'Bộ khối cao 8–15cm', 250000, 790000, 1, 'Nhỏ', 'Khối hình học trang trí, xếp chồng theo ý thích'],
      ['Tượng Thiên Thần', 'Rộng 10cm x Sâu 8cm x Cao 18cm', 190000, 590000, 0.6, 'Mini', 'Tượng thiên thần nhỏ nhắn, mang lại cảm giác bình yên'],
      ['Tượng Chim', 'Rộng 15cm x Sâu 8cm x Cao 12cm', 190000, 590000, 0.5, 'Mini', 'Tượng chú chim tròn trịa, sắc men vui mắt'],
      ['Tượng Thú Ngồi', 'Rộng 10cm x Sâu 12cm x Cao 15cm', 190000, 590000, 0.5, 'Mini', 'Tượng thú cưng ngộ nghĩnh, đặt bàn làm việc hay kệ sách'],
      ['Tượng Thỏ', 'Rộng 8cm x Sâu 8cm x Cao 15cm', 190000, 490000, 0.4, 'Mini', 'Tượng thỏ đáng yêu, quà tặng xinh xắn'],
      ['Tượng Voi Mini', 'Bộ 3 chú voi cao 5–8cm', 190000, 490000, 0.4, 'Mini', 'Bộ voi mini vẽ tay, biểu tượng may mắn'],
      ['Tượng Đàn Voi', 'Rộng 35cm x Sâu 10cm x Cao 18cm', 690000, 1890000, 2, 'Trung bình', 'Tượng đàn voi đi nối đuôi, biểu tượng đoàn kết và sung túc'],
      ['Tượng Rắn Cuộn', 'Đường kính 18cm x Cao 12cm', 390000, 990000, 1.2, 'Nhỏ', 'Tượng rắn cuộn tròn ngủ yên, nét tạo hình mềm mại'],
      ['Tượng Gỗ Nhân Vật', 'Rộng 10cm x Sâu 8cm x Cao 35cm', 590000, 1690000, 1.2, 'Trung bình', 'Tượng gỗ nhân vật chạm khắc thủ công từng chi tiết'],
      ['Tượng Phật Ngồi Thiền', 'Rộng 15cm x Sâu 10cm x Cao 22cm', 390000, 1290000, 1.5, 'Nhỏ', 'Tượng Phật ngồi thiền an nhiên, mang lại cảm giác tĩnh tại'],
      ['Tượng Đầu Phật', 'Rộng 18cm x Sâu 18cm x Cao 30cm', 590000, 1590000, 3, 'Trung bình', 'Tượng đầu Phật đặt sân vườn hoặc góc thiền'],
    ],
    materials: [
      ['Gốm Trắng', 'Gốm trắng men mờ nung 1200°C', 'Trắng', 'gốm trắng men mờ tinh khôi', 1, 'Gốm nung cao, men mờ mịn tay'],
      ['Gốm Đất Nung', 'Đất nung tạo hình thủ công', 'Be', 'đất nung nặn tay mộc mạc', 0.9, 'Nặn tay bởi nghệ nhân'],
      ['Gốm Vẽ Tay', 'Gốm men bóng vẽ hoạ tiết thủ công', 'Pastel', 'gốm vẽ tay sắc màu tươi tắn', 1, 'Hoạ tiết vẽ tay, mỗi chiếc một nét'],
      ['Gốm Men Bóng', 'Gốm men bóng nung 1200°C', 'Pastel', 'gốm men bóng sắc màu rực rỡ', 1, 'Men bóng dễ lau chùi'],
      ['Đá Sa Thạch', 'Đá sa thạch tự nhiên tạc thủ công', 'Be', 'đá sa thạch tạc tay, bề mặt thô mộc', 1.4, 'Đá tự nhiên tạc tay bởi nghệ nhân'],
      ['Gỗ Mít', 'Gỗ mít nguyên khối đục tay, phủ dầu', 'Be', 'gỗ mít nguyên khối đục tay, vân gỗ vàng ấm', 1.25, 'Gỗ nguyên khối đục tay'],
      ['Đồng Đúc', 'Hợp kim đồng đúc khuôn, phủ patina', 'Đen', 'đồng đúc phủ patina cổ điển', 1.6, 'Đồng đúc phủ patina bền màu'],
      ['Kim Loại', 'Hợp kim kẽm mạ bóng', 'Xám', 'kim loại mạ bóng phản chiếu ánh sáng', 1.2, 'Lớp mạ bền màu'],
      ['Resin', 'Resin đúc khuôn, sơn hoàn thiện thủ công', 'Be', 'resin đúc nhẹ, sơn tỉ mỉ từng chi tiết', 0.9, 'Resin nhẹ, không lo vỡ'],
      ['Thủy Tinh Màu', 'Thủy tinh màu ghép lớp, đế acrylic', 'Pastel', 'thủy tinh màu ghép lớp bắt sáng rực rỡ', 1.5, 'Thủy tinh màu ghép thủ công']],
    features: ['Đế lót nỉ chống trầy mặt kệ', 'Đóng gói hộp quà cứng', 'Đổi mới nếu vỡ khi vận chuyển', 'Làm thủ công, mỗi chiếc khác biệt nhẹ'],
  },
  {
    prefix: 'plant', category: 'plant_pot', categoryName: 'Chậu Cây Mini & Cây Decor', group: 'DECOR', count: 37, offset: 5, reviews: 'plant',
    styles: ['Minimalist', 'Scandinavian', 'Japanese', 'Cute/Kawaii'],
    spaces: [['phong-khach', 'goc-chill'], ['phong-lam-viec'], ['phong-lam-viec', 'goc-chill']],
    types: [
      ['Chậu Sen Đá Mini', 'Đường kính 9cm x Cao 12cm (kèm cây)', 120000, 290000, 0.5, 'Mini', 'Chậu sen đá mini kèm cây, gần như không cần chăm'],
      ['Chậu Sen Đá Mix', 'Đường kính 20cm x Cao 12cm (kèm 5–7 cây)', 290000, 690000, 1.5, 'Nhỏ', 'Chậu sen đá mix nhiều loại, như một khu vườn thu nhỏ'],
      ['Chậu Xương Rồng Mini', 'Đường kính 8cm x Cao 15cm (kèm cây)', 99000, 250000, 0.4, 'Mini', 'Chậu xương rồng mini cho bàn làm việc, tưới 2 tuần một lần'],
      ['Chậu Nha Đam', 'Đường kính 12cm x Cao 25cm (kèm cây)', 150000, 350000, 0.8, 'Nhỏ', 'Chậu nha đam dễ sống, lọc không khí tốt'],
      ['Chậu Cây Lưỡi Hổ', 'Đường kính 18cm x Cao 55cm (kèm cây)', 290000, 690000, 3, 'Trung bình', 'Chậu lưỡi hổ lọc không khí, chịu bóng râm tốt'],
      ['Chậu Monstera', 'Đường kính 25cm x Cao 70cm (kèm cây)', 490000, 1290000, 5, 'Lớn', 'Chậu monstera lá xẻ nhiệt đới, điểm nhấn xanh cho phòng khách'],
      ['Chậu Cây Bàng Singapore', 'Đường kính 22cm x Cao 70cm (kèm cây)', 490000, 1290000, 5, 'Lớn', 'Chậu bàng Singapore lá to bóng, sang trọng cho góc phòng'],
      ['Chậu Trầu Bà', 'Đường kính 16cm x Cao 35cm (kèm cây)', 190000, 450000, 1.5, 'Nhỏ', 'Chậu trầu bà rủ lá, đặt kệ cao hay bàn làm việc đều đẹp'],
      ['Chậu Cây Vạn Niên Thanh', 'Đường kính 18cm x Cao 45cm (kèm cây)', 290000, 690000, 2.5, 'Trung bình', 'Chậu vạn niên thanh lá đốm bạc, chịu bóng tốt'],
      ['Chậu Cây Môn Kiểng', 'Đường kính 16cm x Cao 40cm (kèm cây)', 290000, 690000, 2, 'Trung bình', 'Chậu môn kiểng lá gân trắng nổi bật, phong cách nhiệt đới'],
      ['Chậu Cây Ô Liu', 'Đường kính 20cm x Cao 60cm (kèm cây)', 590000, 1490000, 4, 'Lớn', 'Chậu ô liu lá bạc thanh mảnh, mang hơi thở Địa Trung Hải'],
      ['Chậu Cây Bonsai', 'Đường kính 18cm x Cao 35cm (kèm cây)', 590000, 1890000, 3, 'Trung bình', 'Chậu bonsai tạo dáng sẵn, điểm nhấn tĩnh tại cho bàn trà'],
      ['Chậu Cây Ngọc Bích', 'Đường kính 14cm x Cao 25cm (kèm cây)', 190000, 490000, 1.2, 'Nhỏ', 'Chậu cây ngọc bích lá mọng, biểu tượng tài lộc'],
      ['Chậu Cây Đồng Tiền', 'Đường kính 12cm x Cao 22cm (kèm cây)', 150000, 390000, 0.8, 'Nhỏ', 'Chậu cây đồng tiền lá tròn xinh xắn, dễ chăm'],
      ['Chậu Cây Đa Búp Đỏ', 'Đường kính 20cm x Cao 50cm (kèm cây)', 390000, 890000, 3.5, 'Trung bình', 'Chậu đa búp đỏ lá dày bóng, lọc không khí hiệu quả'],
      ['Chậu Cây Dây Nhện', 'Đường kính 15cm x Cao 25cm (kèm cây)', 150000, 390000, 1, 'Nhỏ', 'Chậu cây dây nhện lá sọc trắng xanh, rủ mềm mại'],
      ['Chậu Cây Lá Nhỏ', 'Đường kính 14cm x Cao 25cm (kèm cây)', 150000, 390000, 1, 'Nhỏ', 'Chậu cây lá nhỏ xanh mướt, tạo cảm giác tươi mát cho bàn làm việc'],
      ['Chậu Cây Sống Đời', 'Đường kính 14cm x Cao 22cm (kèm cây)', 150000, 350000, 1, 'Nhỏ', 'Chậu cây sống đời lá mọng, bền bỉ và dễ chăm'],
    ],
    materials: [
      ['Gốm Trắng', 'Chậu gốm trắng men mờ, có lỗ thoát nước và đĩa lót', 'Trắng', 'chậu gốm trắng men mờ có đĩa lót', 1, 'Lỗ thoát nước kèm đĩa lót'],
      ['Gốm Hoa Văn', 'Chậu gốm khắc hoa văn, có lỗ thoát nước', 'Be', 'chậu gốm khắc hoa văn tinh tế', 1.15, 'Hoa văn khắc nổi thủ công'],
      ['Gốm Xanh Rêu', 'Chậu gốm men xanh rêu, có lỗ thoát nước', 'Xanh', 'chậu gốm men xanh rêu hài hoà với lá cây', 1.05, 'Men xanh rêu bền màu'],
      ['Gốm Xanh Lam', 'Chậu gốm men xanh lam, có lỗ thoát nước', 'Xanh', 'chậu gốm men xanh lam nổi bật', 1.05, 'Men xanh lam bền màu'],
      ['Gốm Hồng Pastel', 'Chậu gốm men hồng pastel, có lỗ thoát nước', 'Hồng', 'chậu gốm men hồng pastel ngọt ngào', 1.05, 'Màu pastel xinh xắn'],
      ['Đất Nung', 'Chậu đất nung mộc, có lỗ thoát nước', 'Be', 'chậu đất nung mộc giữ ẩm tự nhiên', 0.85, 'Đất nung giữ ẩm, thoát nước tốt'],
      ['Xi Măng', 'Chậu xi măng đúc thủ công, có lỗ thoát nước', 'Xám', 'chậu xi măng đúc thủ công mộc mạc', 0.95, 'Xi măng thoáng khí, tốt cho rễ'],
      ['Giỏ Cói', 'Giỏ cói đan tay, lòng nhựa chống thấm', 'Be', 'giỏ cói đan tay mộc mạc', 1.1, 'Giỏ cói đan tay, lòng chống thấm']],
    features: ['Kèm hướng dẫn chăm cây chi tiết', 'Cây được thuần trong nhà trước khi giao', 'Đất trộn sẵn xơ dừa, trấu', 'Đổi cây mới nếu héo trong 7 ngày'],
  },
  {
    prefix: 'frame', category: 'frame', categoryName: 'Khung Tranh & Khung Ảnh', group: 'DECOR', count: 39, offset: 6, reviews: 'decor',
    styles: ['Minimalist', 'Scandinavian', 'Vintage', 'Modern'],
    spaces: [['phong-khach'], ['phong-ngu'], ['phong-khach', 'phong-ngu']],
    types: [
      ['Khung Ảnh Để Bàn 13x18', 'Ảnh 13x18cm, khung 17x22cm', 120000, 290000, 0.4, 'Mini', 'Khung ảnh để bàn có chân dựng, đổi chiều ngang dọc'],
      ['Khung Ảnh Treo Tường A4', 'Ảnh 21x30cm, khung 25x34cm', 150000, 390000, 0.6, 'Nhỏ', 'Khung ảnh A4 treo tường, móc treo sẵn phía sau'],
      ['Khung Tranh A3', 'Tranh 30x42cm, khung 34x46cm', 250000, 590000, 1, 'Trung bình', 'Khung tranh A3 có passe-partout, vừa poster và tranh in'],
      ['Khung Tranh Cổ Điển', 'Tranh 40x50cm, khung 52x62cm', 590000, 1490000, 2.5, 'Lớn', 'Khung tranh cổ điển chạm hoa văn, nâng tầm mọi bức tranh'],
      ['Tranh Canvas Trừu Tượng', 'Tranh 60x80cm, khung căng gỗ thông', 690000, 1590000, 2, 'Lớn', 'Tranh canvas trừu tượng in giclée, sắc màu bền đẹp'],
      ['Bộ Tranh Canvas Mini', 'Bộ 6 tranh 20x20cm', 590000, 1290000, 2, 'Trung bình', 'Bộ tranh canvas mini nhiều khung, ghép thành mảng tường sinh động'],
      ['Bộ 2 Khung Tranh', '2 khung 30x40cm', 390000, 890000, 1.6, 'Trung bình', 'Bộ 2 khung tranh đồng bộ treo cạnh nhau'],
      ['Bộ 4 Khung Ảnh', '4 khung các cỡ 20x25 đến 30x40cm', 490000, 1090000, 2.2, 'Lớn', 'Bộ 4 khung ảnh xếp so le, lưu giữ những khoảnh khắc đáng nhớ'],
      ['Bộ 6 Khung Tranh', '6 khung 30x40cm', 790000, 1590000, 3.5, 'Lớn', 'Bộ 6 khung tranh xếp lưới đều, điểm nhấn cho mảng tường sofa'],
      ['Bộ Khung Gallery 7 Ô', '7 khung các cỡ 10x15 đến 30x40cm', 790000, 1690000, 4, 'Lớn', 'Bộ 7 khung gallery kèm giấy sơ đồ treo, dựng mảng tường ảnh dễ dàng'],
    ],
    materials: [
      ['Viền Gỗ Sồi', 'Viền gỗ sồi tự nhiên, mặt kính cường lực', 'Be', 'viền gỗ sồi tự nhiên mảnh mai', 1.1, 'Viền gỗ sồi thật, không phải nhựa giả gỗ'],
      ['Viền Gỗ Óc Chó', 'Viền gỗ óc chó tự nhiên, mặt kính cường lực', 'Be', 'viền gỗ óc chó trầm ấm', 1.3, 'Gỗ óc chó tự nhiên'],
      ['Viền Đen Mảnh', 'Viền nhôm sơn đen mảnh 1.5cm, mặt mica chống vỡ', 'Đen', 'viền đen mảnh hiện đại', 1, 'Mặt mica chống vỡ, an toàn'],
      ['Viền Trắng', 'Viền gỗ sơn trắng mờ, mặt kính', 'Trắng', 'viền trắng nhẹ nhàng', 1, 'Viền trắng hợp mọi tông tường'],
      ['Viền Đồng', 'Viền kim loại mạ đồng, mặt kính', 'Be', 'viền mạ đồng ấm áp', 1.25, 'Lớp mạ đồng bền màu'],
      ['Viền Bạc', 'Viền kim loại mạ bạc, mặt kính', 'Xám', 'viền mạ bạc thanh lịch', 1.25, 'Lớp mạ bạc bền màu'],
      ['Viền Mạ Vàng', 'Viền gỗ chạm hoa văn, mạ vàng giả cổ', 'Be', 'viền chạm hoa văn mạ vàng cổ điển', 1.6, 'Chạm hoa văn thủ công'],
      ['Canvas Căng Khung', 'Vải canvas in giclée, khung căng gỗ thông', 'Trắng', 'vải canvas căng khung, không cần kính', 1, 'Mực in giclée bền màu 50 năm']],
    features: ['Móc treo và đinh tặng kèm', 'Mặt lưng gài nhanh, thay ảnh dễ', 'Đóng gói chống sốc từng góc', 'Nhận in ảnh theo yêu cầu'],
  },
  {
    prefix: 'organizer', category: 'organizer', categoryName: 'Khay Bàn & Hộp Đựng', group: 'DECOR', count: 17, offset: 3, reviews: 'desk',
    styles: ['Minimalist', 'Scandinavian', 'Japanese', 'Modern'],
    spaces: [['phong-lam-viec'], ['phong-hoc'], ['phong-lam-viec', 'phong-hoc']],
    types: [
      ['Hộp Đựng Bút', 'Đường kính 8cm x Cao 11cm', 99000, 350000, 0.3, 'Mini', 'Hộp đựng bút gọn gàng góc bàn học'],
      ['Khay Bàn Làm Việc', 'Rộng 30cm x Sâu 20cm x Cao 3cm', 250000, 590000, 0.8, 'Nhỏ', 'Khay chia ngăn đựng điện thoại, tai nghe, đồng hồ và bút'],
      ['Đế Sạc Đa Năng', 'Rộng 25cm x Sâu 12cm x Cao 15cm', 390000, 890000, 0.9, 'Nhỏ', 'Đế sạc đa năng gom điện thoại, đồng hồ, tai nghe về một chỗ'],
      ['Kệ Tài Liệu 3 Tầng', 'Rộng 32cm x Sâu 25cm x Cao 30cm', 290000, 690000, 1.2, 'Nhỏ', 'Kệ tài liệu 3 tầng cho giấy A4, sổ tay và hồ sơ'],
      ['Kệ Kê Màn Hình', 'Rộng 60cm x Sâu 22cm x Cao 10cm', 390000, 890000, 2, 'Trung bình', 'Kệ kê màn hình dáng cong nâng tầm mắt, gầm để bàn phím gọn gàng'],
    ],
    materials: [M.oak, M.walnut,
      ['Bê Tông', 'Bê tông đúc thủ công phủ chống bám bẩn', 'Xám', 'bê tông đúc thủ công phong cách công nghiệp', 0.9, 'Nặng tay, đứng vững'],
      ['Nhựa ABS', 'Nhựa ABS cao cấp', 'Trắng', 'nhựa ABS nhẹ, bền', 0.8, 'Nhẹ, dễ lau chùi'],
      ['Tre Ép', 'Tre ép nhiều lớp phủ dầu', 'Be', 'tre ép thân thiện môi trường', 0.85, 'Tre ép bền, chống mốc'],
      ['Kim Loại', 'Thép không gỉ đánh xước', 'Xám', 'thép không gỉ bền đẹp', 0.9, 'Không gỉ, dễ vệ sinh'],
      ['Thủy Tinh', 'Thủy tinh dày trong suốt', 'Trắng', 'thủy tinh trong suốt tinh tế', 0.8, 'Thủy tinh dày khó vỡ'],
      ['Gốm', 'Gốm men mờ nung 1200°C', 'Be', 'gốm men mờ mộc mạc', 0.9, 'Gốm nung cao, men mịn']],
    features: ['Đáy lót nỉ chống trầy bàn', 'Gọn bàn làm việc chỉ trong 5 phút', 'Gói quà miễn phí', 'Bảo hành 6 tháng'],
  },
  {
    prefix: 'tray', category: 'tray', categoryName: 'Khay Trang Trí & Decor Bàn', group: 'DECOR', count: 19, offset: 8, reviews: 'decor',
    styles: ['Minimalist', 'Japanese', 'Vintage', 'Scandinavian'],
    spaces: [['phong-khach'], ['phong-khach', 'phong-lam-viec'], ['phong-ngu']],
    types: [
      ['Khay Tròn Decor', 'Đường kính 30cm x Cao 3cm', 190000, 490000, 0.8, 'Nhỏ', 'Khay tròn gom nến, lọ hoa, sách nhỏ thành một cụm decor gọn'],
      ['Khay Chữ Nhật Có Quai', 'Dài 40cm x Rộng 25cm x Cao 5cm', 250000, 590000, 1.2, 'Trung bình', 'Khay chữ nhật có quai, bưng trà bánh tiện tay'],
      ['Khay Gỗ Oval', 'Dài 45cm x Rộng 18cm x Cao 2cm', 250000, 590000, 0.9, 'Trung bình', 'Khay gỗ oval dài, bày đồ ăn nhẹ hoặc làm đế decor bàn ăn'],
      ['Khay Oval Đựng Chìa Khoá', 'Dài 22cm x Rộng 12cm x Cao 2cm', 150000, 350000, 0.3, 'Mini', 'Khay oval để chìa khoá, ví, tai nghe ở lối vào nhà'],
      ['Đĩa Decor Trang Sức', 'Đường kính 12cm x Cao 2cm', 120000, 290000, 0.2, 'Mini', 'Đĩa nhỏ đựng nhẫn, khuyên tai trên bàn trang điểm'],
      ['Thớt Gỗ Phục Vụ', 'Dài 38cm x Rộng 20cm x Dày 2cm', 190000, 490000, 1, 'Trung bình', 'Thớt gỗ phục vụ bày phô mai, bánh mì hoặc làm đế decor bếp'],
    ],
    materials: [M.brass,
      ['Gỗ Xoài', 'Gỗ xoài nguyên tấm phủ dầu an toàn thực phẩm', 'Be', 'gỗ xoài nguyên tấm vân đẹp', 1, 'Phủ dầu an toàn thực phẩm'],
      ['Gốm Men Mờ', 'Gốm men mờ nung 1200°C', 'Trắng', 'gốm men mờ mộc mạc', 1, 'Gốm nung cao, men an toàn'],
      ['Kim Loại Sơn', 'Thép sơn tĩnh điện', 'Đen', 'kim loại sơn tĩnh điện tinh gọn', 0.95, 'Sơn tĩnh điện chống gỉ'],
      ['Sơn Mài', 'Gỗ sơn mài nhiều lớp thủ công', 'Trắng', 'sơn mài thủ công bóng mịn', 1.4, 'Sơn mài truyền thống nhiều lớp']],
    features: ['Đáy lót nỉ chống trầy', 'Dễ vệ sinh bằng khăn ẩm', 'Gói quà miễn phí', 'Đổi mới nếu lỗi khi vận chuyển'],
  },
  {
    prefix: 'bookend', category: 'bookend', categoryName: 'Giá Đỡ & Bookend', group: 'DECOR', count: 39, offset: 12, reviews: 'desk',
    styles: ['Minimalist', 'Modern', 'Scandinavian', 'Japanese'],
    spaces: [['phong-hoc', 'phong-lam-viec'], ['phong-khach'], ['phong-lam-viec']],
    types: [
      ['Chặn Sách Hình Cầu', 'Đường kính 10cm (cặp 2 chiếc)', 290000, 790000, 2, 'Nhỏ', 'Cặp chặn sách hình cầu nặng tay, vừa giữ sách đứng thẳng vừa làm decor'],
      ['Giá Đỡ Sách Đọc', 'Rộng 30cm x Sâu 22cm, chỉnh 5 góc nghiêng', 190000, 490000, 0.7, 'Nhỏ', 'Giá đỡ sách đọc, đọc lâu không mỏi cổ'],
      ['Giá Đỡ Điện Thoại', 'Rộng 8cm x Sâu 10cm x Cao 12cm', 99000, 350000, 0.3, 'Mini', 'Giá đỡ điện thoại xem video, gọi video rảnh tay'],
      ['Giá Đỡ Máy Tính Bảng', 'Rộng 15cm x Sâu 14cm x Cao 18cm', 190000, 590000, 0.6, 'Nhỏ', 'Giá đỡ máy tính bảng chỉnh góc nghiêng, hợp đọc sách và học online'],
      ['Giá Đỡ Laptop', 'Rộng 25cm x Sâu 23cm, cao 6–15cm', 290000, 690000, 1, 'Nhỏ', 'Giá đỡ laptop nâng màn hình ngang tầm mắt, tản nhiệt tốt hơn'],
      ['Kệ Kê Laptop Gỗ Cong', 'Rộng 50cm x Sâu 24cm x Cao 12cm', 490000, 990000, 1.8, 'Trung bình', 'Kệ kê laptop gỗ uốn cong liền khối, gầm cất bàn phím gọn gàng'],
      ['Bàn Laptop Kê Giường', 'Rộng 60cm x Sâu 35cm x Cao 26cm', 390000, 890000, 2.5, 'Trung bình', 'Bàn laptop chân gập kê giường, làm việc hay ăn sáng trên giường đều tiện'],
      ['Giá Treo Tai Nghe', 'Đế 12cm x Cao 26cm', 190000, 590000, 0.6, 'Nhỏ', 'Giá treo tai nghe giữ đệm tai luôn đúng form, bàn làm việc gọn hơn'],
      ['Giá Đỡ Đồng Hồ Đeo Tay', 'Rộng 10cm x Sâu 6cm x Cao 8cm', 150000, 390000, 0.3, 'Mini', 'Giá đỡ đồng hồ đeo tay, trưng bày và giữ dây không bị gập'],
      ['Giá Treo Phụ Kiện', 'Rộng 15cm x Sâu 10cm x Cao 25cm', 190000, 490000, 0.8, 'Nhỏ', 'Giá treo phụ kiện cho đồng hồ, vòng tay, chìa khoá'],
      ['Giá Treo Bông Tai', 'Rộng 30cm x Sâu 10cm x Cao 25cm', 190000, 490000, 0.6, 'Nhỏ', 'Giá treo bông tai nhiều tầng, dễ tìm dễ chọn mỗi sáng'],
      ['Đế Đỡ Trang Sức', 'Đường kính 10cm x Cao 3cm', 99000, 290000, 0.3, 'Mini', 'Đế gỗ nhỏ trưng nhẫn và trang sức, xinh xắn trên bàn trang điểm'],
      ['Giá Treo Đồ Đứng', 'Đế 40cm x Cao 175cm', 590000, 1490000, 6, 'Lớn', 'Giá treo đồ đứng cho áo khoác, mũ và túi xách ở lối vào'],
      ['Giá Treo Đồ Gắn Tường', 'Dài 60cm x Sâu 8cm, 5 móc', 190000, 590000, 1, 'Nhỏ', 'Thanh móc treo gắn tường cho áo khoác, khăn và túi xách'],
      ['Giá Treo Quần Áo', 'Rộng 100cm x Sâu 40cm x Cao 150cm', 590000, 1290000, 6, 'Lớn', 'Giá treo quần áo khung thép, phơi và trưng bày quần áo gọn gàng'],
      ['Giá Để Tạp Chí', 'Rộng 35cm x Sâu 25cm x Cao 50cm', 290000, 790000, 2, 'Trung bình', 'Giá để tạp chí, sách báo cạnh sofa hoặc ghế đọc sách'],
    ],
    materials: [M.oak, M.walnut, M.whiteWood,
      ['Thép Sơn Đen', 'Thép dày sơn tĩnh điện đen nhám, đế lót cao su', 'Đen', 'thép sơn tĩnh điện đen nhám', 0.9, 'Đế cao su chống trượt'],
      ['Thép Sơn Trắng', 'Thép sơn tĩnh điện trắng', 'Trắng', 'thép sơn tĩnh điện trắng thanh lịch', 0.9, 'Sơn tĩnh điện chống gỉ'],
      ['Đá Cẩm Thạch', 'Đá cẩm thạch tự nhiên mài mờ', 'Trắng', 'đá cẩm thạch nặng tay, vân độc bản', 1.4, 'Đá tự nhiên nặng, chặn sách vững'],
      ['Nhôm Bạc', 'Hợp kim nhôm anode bạc', 'Xám', 'nhôm anode bạc tinh gọn', 1, 'Nhôm anode bền, không gỉ']],
    features: ['Đế lót chống trượt', 'Lắp đặt trong vài phút', 'Gói quà miễn phí', 'Bảo hành 6 tháng'],
  },
];

const CATALOG_PRODUCTS = DEFS.flatMap(generate);

module.exports = { CATALOG_PRODUCTS };
