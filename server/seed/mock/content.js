// Nội dung do khách & nhân viên tạo ra: yêu cầu thiết kế riêng, bài Cộng đồng, ý kiến bạn đọc
// dưới bài Tin tức, chat hỗ trợ và lịch sử trò chuyện với trợ lý AI.
// Tham chiếu: `user` = khóa trong accounts.js, productId = Product.id, articleId = NewsArticle.id.
const { daysAgo, img } = require('./helpers');

const BOT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=DecoAI';
const TECH_AVATAR = img('photo-1570295999919-56ceb5ecca61', 150);
const TECH_NAME = 'Kỹ Thuật Viên Tuấn (Luméa)';

// ---------------- Yêu cầu thiết kế riêng (bổ sung cho req-1, req-2 có sẵn) ----------------
// requestCode dùng 4 chữ số để không trùng mã 3 chữ số route POST /api/custom-requests tự sinh.
const msg = (id, sender, text, days, hh, mm) => ({
  id, sender, text, at: daysAgo(days, hh, mm),
  senderName: sender === 'CUSTOMER' ? 'Bạn (Khách hàng)' : sender === 'AI_ASSISTANT' ? 'Luméa Bot' : TECH_NAME,
  avatar: sender === 'CUSTOMER' ? img('photo-1535713875002-d1d0cf377fde', 150) : sender === 'AI_ASSISTANT' ? BOT_AVATAR : TECH_AVATAR,
});
const intro = days => msg('msg-init', 'AI_ASSISTANT', 'Yêu cầu thiết kế riêng của bạn đã được chuyển tới kỹ thuật viên 3D của shop. Shop sẽ xem xét tính khả thi và phản hồi kèm báo giá trong vòng 24h.', days, 9, 1);

const CUSTOM_REQUESTS = [
  {
    id: 'req-seed-3', requestCode: 'REQ-2026-0103', user: 'minhanh', days: 1, status: 'PENDING_REVIEW',
    title: 'Chậu cây mini hình chú mèo Shiba',
    brief: { productType: 'Chậu cây mini để bàn', theme: 'Chó Shiba ngồi ôm chậu', style: 'Cute/Kawaii', color: 'Cam đất & trắng kem', size: 'Cao khoảng 12cm', usage: 'Trồng sen đá trên bàn học', customText: 'Mochi', estimatedBudget: '150.000đ - 250.000đ', notes: 'Có lỗ thoát nước và đĩa lót.' },
    customerImages: [img('photo-1583337130417-3346a1be7dee', 600)],
    messages: [intro(1)],
  },
  {
    id: 'req-seed-4', requestCode: 'REQ-2026-0098', user: 'duchuy', days: 6, status: 'IN_DISCUSSION', quotationPrice: 520000, estimatedDays: 5,
    title: 'Mô hình cầu Rồng Đà Nẵng làm đèn ngủ',
    brief: { productType: 'Đèn ngủ / mô hình trang trí', theme: 'Cầu Rồng Đà Nẵng phun lửa', style: 'Modern, chi tiết vảy rồng', color: 'Vàng đồng ánh kim', size: 'Dài 35cm', usage: 'Quà tặng đối tác', customText: 'Đà Nẵng 2026', estimatedBudget: '400.000đ - 600.000đ' },
    aiConceptImage: img('photo-1559592413-7cec4d0cae2b', 600),
    adminNote: 'Mô hình dài 35cm cần chia 3 phần in rồi ghép, đề xuất Silk PLA vàng đồng.',
    messages: [
      intro(6),
      msg('m-2', 'SHOP_SPECIALIST', 'Chào anh Huy! Mô hình cầu Rồng dài 35cm shop sẽ in 3 phần rồi ghép chốt ẩn. Báo giá 520.000đ gồm LED vàng ấm trong thân rồng, thời gian 5 ngày.', 5, 14, 20),
      msg('m-3', 'CUSTOMER', 'Bên mình có thể làm đế gỗ khắc logo công ty không? Mình cần 3 bộ.', 5, 20, 5),
      msg('m-4', 'SHOP_SPECIALIST', 'Được anh nhé, đế gỗ sồi khắc laser thêm 60.000đ/bộ. Anh gửi file logo dạng vector giúp shop.', 4, 9, 30),
    ],
  },
  {
    id: 'req-seed-5', requestCode: 'REQ-2026-0091', user: 'ngoclan', days: 12, status: 'APPROVED', quotationPrice: 1250000, estimatedDays: 7, preview3dModelType: 'geometric_vase',
    title: 'Bộ 3 bình hoa hình học cho kệ TV',
    brief: { productType: 'Bình hoa trang trí (bộ 3)', theme: 'Sóng nước xoắn', style: 'Japandi', color: 'Be, xám đá, trắng sứ', size: '18cm / 24cm / 30cm', usage: 'Kệ TV phòng khách', estimatedBudget: 'Khoảng 1.200.000đ', notes: 'Phủ chống thấm để cắm hoa tươi.' },
    aiConceptImage: img('photo-1581783342308-f792dbdd27c5', 600),
    adminNote: 'Khách đã duyệt bản 3D, chờ xác nhận đặt cọc.',
    messages: [
      intro(12),
      msg('m-2', 'SHOP_SPECIALIST', 'Shop báo giá trọn bộ 3 bình 1.250.000đ, in PETG mờ kháng nước, 7 ngày hoàn thiện. Bản xem trước 3D đã có trong mục Preview.', 11, 15, 0),
      msg('m-3', 'CUSTOMER', 'Mình ưng bản xem trước rồi, chốt giúp mình nhé!', 10, 21, 40),
    ],
  },
  {
    id: 'req-seed-6', requestCode: 'REQ-2026-0084', user: 'thaomy', days: 20, status: 'CONVERTED_TO_ORDER', quotationPrice: 380000, estimatedDays: 4, preview3dModelType: 'moon_lamp',
    title: 'Đèn mặt trăng khắc chòm sao sinh nhật',
    brief: { productType: 'Đèn ngủ mặt trăng', theme: 'Chòm sao Song Ngư', style: 'Minimalist', color: 'Trắng ngà', size: '18cm', usage: 'Quà sinh nhật bạn thân', customText: 'Happy 25th, Ngân', estimatedBudget: '350.000đ - 400.000đ' },
    adminNote: 'Đã chuyển thành đơn ORD-270263.',
    messages: [
      intro(20),
      msg('m-2', 'SHOP_SPECIALIST', 'Shop khắc chòm sao Song Ngư phát sáng ở mặt sau đèn, báo giá 380.000đ, 4 ngày.', 19, 10, 45),
      msg('m-3', 'CUSTOMER', 'Ok shop, mình đặt luôn ạ.', 19, 12, 0),
    ],
  },
  {
    id: 'req-seed-7', requestCode: 'REQ-2026-0077', user: 'khang', days: 26, status: 'REJECTED',
    title: 'Mô hình nhân vật hoạt hình có bản quyền cỡ lớn',
    brief: { productType: 'Tượng trang trí', theme: 'Nhân vật hoạt hình nổi tiếng', style: 'Giống bản gốc 100%', color: 'Nhiều màu', size: 'Cao 60cm', usage: 'Bán lại ở cửa hàng', estimatedBudget: '2.000.000đ' },
    adminNote: 'Từ chối: tái tạo nhân vật có bản quyền để kinh doanh.',
    messages: [
      intro(26),
      msg('m-2', 'SHOP_SPECIALIST', 'Rất tiếc shop không nhận in lại nhân vật có bản quyền để bán lại. Nếu bạn muốn, shop có thể thiết kế một linh vật riêng theo phong cách tương tự nhé!', 25, 11, 10),
    ],
  },
  {
    id: 'req-seed-8', requestCode: 'REQ-2026-0109', user: 'tuankiet', days: 3, status: 'QUOTED', quotationPrice: 290000, estimatedDays: 3, preview3dModelType: 'desk_organizer',
    title: 'Giá đỡ tai nghe & tay cầm game cho góc setup',
    brief: { productType: 'Giá đỡ phụ kiện bàn làm việc', theme: 'Cyberpunk, đường vát góc', style: 'Modern', color: 'Đen nhám, viền xanh neon', size: 'Cao 26cm', usage: 'Bàn chơi game', customText: 'KIET', estimatedBudget: '250.000đ - 350.000đ' },
    messages: [
      intro(3),
      msg('m-2', 'SHOP_SPECIALIST', 'Shop báo giá 290.000đ, in PETG đen nhám với viền dạ quang xanh, 3 ngày. Bạn xác nhận để shop dựng bản 3D nhé.', 2, 16, 30),
    ],
  },
  {
    id: 'req-seed-9', requestCode: 'REQ-2026-0112', user: 'maianh', days: 2, status: 'PREVIEW_READY', quotationPrice: 450000, estimatedDays: 5, preview3dModelType: 'abstract_sculpture',
    title: 'Tượng trừu tượng hai bàn tay đan vào nhau',
    brief: { productType: 'Tượng điêu khắc trang trí', theme: 'Hai bàn tay đan vào nhau', style: 'Wabi-sabi', color: 'Trắng đá cẩm thạch', size: 'Cao 22cm', usage: 'Quà kỷ niệm ngày cưới', customText: '09.10.2026', estimatedBudget: '400.000đ - 500.000đ' },
    aiConceptImage: img('photo-1544457070-4cd773b4d71e', 600),
    messages: [
      intro(2),
      msg('m-2', 'SHOP_SPECIALIST', 'Bản xem trước 3D đã sẵn sàng, chị xoay thử và góp ý giúp shop nhé. Giá hoàn thiện 450.000đ.', 1, 17, 0),
    ],
  },
  {
    id: 'req-seed-10', user: null, requestCode: 'REQ-2026-0114', days: 0, status: 'PENDING_REVIEW',
    customerName: 'Cao Thùy Linh', customerEmail: 'thuylinh.cao@gmail.com', customerPhone: '0938990011',
    title: 'Biển tên căn hộ bằng gỗ & in 3D',
    brief: { productType: 'Biển tên treo cửa', theme: 'Lá monstera', style: 'Scandinavian', color: 'Gỗ sồi & xanh lá', size: '30 x 12cm', usage: 'Treo cửa căn hộ', customText: 'Nhà Linh & Bin', estimatedBudget: 'Dưới 300.000đ' },
    messages: [intro(0)],
  },
];

// ---------------- Bài Cộng đồng (bổ sung cho post-1..post-9 có sẵn) ----------------
const COMMUNITY_POSTS = [
  {
    id: 'post-seed-10', user: 'minhanh', days: 18, badge: 'Top Creator', handle: '@minhanh_decor', isStaffPick: true,
    title: 'Kệ sách mini trên bàn học',
    caption: 'Thêm cặp bookend sóng in 3D là góc học tập gọn hẳn. Đèn Arc chiếu xiên rất dễ chịu khi đọc sách đêm 📚',
    imageUrl: img('photo-1524758631624-e2822e304c36'), tags: ['#bookend', '#studydesk', '#minimalist'],
    productTags: [{ productId: 'prod-27', xPercent: 40, yPercent: 55, note: 'Bookend Sóng In 3D' }, { productId: 'prod-11', xPercent: 75, yPercent: 30, note: 'Đèn Arc Desk Lamp' }],
    likesCount: 96, comments: [
      { author: 'thuha', text: 'Bookend màu gì vậy bạn? Nhìn sang quá!', days: 17 },
      { author: 'minhanh', text: '@Thu Hà màu Be nha bạn ơi 😄', days: 17 },
    ],
  },
  {
    id: 'post-seed-11', user: 'ngoclan', days: 9, handle: '@lan.thaodien',
    title: 'Phòng khách tông be ấm với kệ sách Vincent',
    caption: 'Sau 2 tháng dùng kệ sách gỗ óc chó, mình rất ưng: chắc chắn, vân gỗ đẹp. Kết hợp bình gốm trắng cho đỡ nặng nề.',
    imageUrl: img('photo-1586023492125-27b2c045efd7'), tags: ['#livingroom', '#walnut', '#warmtone'],
    productTags: [{ productId: 'mock-walnut-bookshelf', xPercent: 30, yPercent: 45, note: 'Kệ Sách Vincent 5 Tầng' }, { productId: 'prod-2', xPercent: 62, yPercent: 40, note: 'Bình Gốm Ceramic' }],
    likesCount: 58, comments: [{ author: 'hoang', text: 'Kệ này lắp đặt có lâu không chị?', days: 8 }],
  },
  {
    id: 'post-seed-12', user: 'duchuy', days: 4, handle: '@huy.danang',
    title: 'Đèn mặt trăng khắc tên tặng bạn gái',
    caption: 'Màu Terracotta lên đèn ấm cực, khắc tên hai đứa ở đế. Ai cần ý tưởng quà kỷ niệm thì tham khảo nhé 🌙',
    imageUrl: img('photo-1513506003901-1e6a229e2d15'), tags: ['#moonlamp', '#quatang', '#custom'],
    productTags: [{ productId: 'prod-1', xPercent: 50, yPercent: 50, note: 'Moon Lamp khắc tên' }],
    likesCount: 41, comments: [],
  },
  {
    id: 'post-seed-13', user: 'thuha', days: 1, handle: '@thuha.home',
    title: 'Góc chill ban công với chậu sen đá mini',
    caption: 'Ban công 2m2 nhưng vẫn có chỗ uống trà. Mấy chậu gốm mint nhỏ xinh mua trong Flash Sale giá hời lắm!',
    imageUrl: img('photo-1485955900006-10f4d324d411'), tags: ['#balcony', '#gocchill', '#senda'],
    productTags: [{ productId: 'prod-12', xPercent: 35, yPercent: 70, note: 'Chậu Sen Đá Mint' }, { productId: 'prod-19', xPercent: 68, yPercent: 65, note: 'Chậu Bonsai Xanh Rêu' }],
    likesCount: 12, comments: [],
  },
  {
    // Nhân viên ẩn bài vì nội dung mua bán — kiểm thử bộ lọc HIDDEN ở my-admin.
    id: 'post-seed-14', user: 'khang', days: 14, handle: '@khang.hp', status: 'HIDDEN',
    moderationReason: 'Nội dung mua bán, quảng cáo ngoài nền tảng', moderatedBy: 'cskh', moderatedDaysAgo: 13,
    title: 'Pass lại đồ decor giá rẻ',
    caption: 'Mình pass lại vài món decor, ai cần ib Zalo mình nhé.',
    imageUrl: img('photo-1493663284031-b7e3aefcae8e'), tags: ['#pass'], productTags: [], likesCount: 2, comments: [],
  },
  {
    // Bị bộ lọc tự động chặn ngay lúc đăng.
    id: 'post-seed-15', user: 'giabao', days: 72, handle: '@giabao', status: 'REJECTED',
    moderationReason: 'Ngôn từ xúc phạm (từ khoá: "đồ lừa đảo")', moderatedBy: null, moderatedDaysAgo: 72,
    title: 'Đánh giá shop',
    caption: 'Shop này toàn đồ lừa đảo, đừng mua.',
    imageUrl: img('photo-1505873242700-f289a29e1e0f'), tags: [], productTags: [], likesCount: 0, comments: [],
  },
];

// ---------------- Ý kiến bạn đọc dưới bài Tin tức ----------------
// reply = id ý kiến gốc (chỉ lồng 1 cấp như route POST /api/news/:id/comments).
const NEWS_COMMENTS = [
  { id: 'nc-seed-01', article: 'news-1', user: 'hoang', text: 'Bài viết rất chi tiết! Mình đang phân vân PETG hay PLA cho chậu cây ngoài ban công, giờ thì rõ rồi.', days: 40, likes: 12 },
  { id: 'nc-seed-02', article: 'news-1', user: 'duchuy', reply: 'nc-seed-01', text: 'PETG chịu nắng tốt hơn đó bạn, mình dùng 6 tháng chưa bạc màu.', days: 39, likes: 5 },
  { id: 'nc-seed-03', article: 'news-1', user: 'tuankiet', text: 'Có bài nào so sánh Resin với PLA về độ chi tiết không ad?', days: 20, likes: 3 },
  { id: 'nc-seed-04', article: 'news-2', user: 'thaomy', text: 'Xu hướng số 3 đúng gu mình quá, bàn làm việc toàn màu be với gỗ 😍', days: 33, likes: 18 },
  { id: 'nc-seed-05', article: 'news-2', user: 'minhanh', reply: 'nc-seed-04', text: 'Đồng ý! Thêm đèn vàng ấm nữa là chuẩn bài.', days: 32, likes: 6 },
  { id: 'nc-seed-06', article: 'news-2', user: 'khang', text: 'Năm nay có vẻ màu xanh rêu lên ngôi nhỉ.', days: 15, likes: 2 },
  { id: 'nc-seed-07', article: 'news-3', user: 'ngoclan', text: 'Phòng khách nhà mình đang theo đúng bảng màu này, rất dễ chịu.', days: 28, likes: 9 },
  { id: 'nc-seed-08', article: 'news-4', user: 'thuha', text: 'Sen đá để bàn làm việc máy lạnh cả ngày có sống được không mọi người?', days: 25, likes: 4 },
  { id: 'nc-seed-09', article: 'news-4', user: 'maianh', reply: 'nc-seed-08', text: 'Được nha, nhưng 2–3 ngày nên đem ra chỗ có nắng một lần.', days: 24, likes: 7 },
  { id: 'nc-seed-10', article: 'news-4', user: 'thaomy', reply: 'nc-seed-08', text: 'Mình thấy cây lưỡi hổ mini hợp phòng máy lạnh hơn đó.', days: 24, likes: 3 },
  { id: 'nc-seed-11', article: 'news-5', user: 'minhanh', text: 'Đổi sang bóng 2700K xong ngủ ngon hẳn, cảm ơn bài viết!', days: 22, likes: 11 },
  { id: 'nc-seed-12', article: 'news-6', user: 'baolong', text: 'Mẹo dùng khăn microfiber lau đồ in 3D rất hữu ích, trước giờ mình toàn dùng khăn giấy bị xước.', days: 19, likes: 5 },
  { id: 'nc-seed-13', article: 'news-7', user: 'hoang', text: 'Japandi là phong cách yêu thích của mình, mong shop ra thêm nội thất gỗ sồi.', days: 17, likes: 14 },
  { id: 'nc-seed-14', article: 'news-7', user: 'ngoclan', reply: 'nc-seed-13', text: 'Bộ sưu tập Ashen gỗ sồi mới ra đó bạn ơi.', days: 16, likes: 4 },
  { id: 'nc-seed-15', article: 'news-8', user: 'maianh', text: 'Wabi-sabi đọc xong thấy thương mấy món đồ cũ trong nhà ghê.', days: 14, likes: 8 },
  { id: 'nc-seed-16', article: 'news-9', user: 'duchuy', text: 'Bàn làm việc quay lưng ra cửa có cách hoá giải nào khác không ạ?', days: 12, likes: 6 },
  { id: 'nc-seed-17', article: 'news-9', user: 'tuankiet', reply: 'nc-seed-16', text: 'Đặt thêm gương nhỏ trên bàn để nhìn thấy cửa là được nè.', days: 12, likes: 2 },
  { id: 'nc-seed-18', article: 'news-10', user: 'khang', text: 'Mệnh Kim thì sofa màu trắng xám là hợp đúng không ad?', days: 10, likes: 3 },
  { id: 'nc-seed-19', article: 'news-11', user: 'thuha', text: 'Before–after ấn tượng thật, studio 25m2 mà nhìn rộng gấp đôi.', days: 9, likes: 15 },
  { id: 'nc-seed-20', article: 'news-11', user: 'thaomy', reply: 'nc-seed-19', text: 'Bí quyết là gương lớn với nội thất chân cao đó.', days: 8, likes: 6 },
  { id: 'nc-seed-21', article: 'news-12', user: 'minhanh', text: 'Góc 1m2 của mình cũng được truyền cảm hứng từ bài này 😄', days: 7, likes: 9 },
  { id: 'nc-seed-22', article: 'news-13', user: 'hoang', text: 'Quy trình rõ ràng, giờ mới biết in 3D custom cần kiểm tra file slicing kỹ vậy.', days: 6, likes: 4 },
  { id: 'nc-seed-23', article: 'news-13', user: 'duchuy', text: 'Thời gian in một đèn mặt trăng 18cm khoảng bao lâu vậy shop?', days: 4, likes: 1 },
  { id: 'nc-seed-24', article: 'news-14', user: 'ngoclan', text: 'Mẹo giường có ngăn kéo rất hay cho phòng nhỏ.', days: 3, likes: 5 },
  { id: 'nc-seed-25', article: 'news-14', user: 'quynhchi', text: 'Mình vừa chuyển nhà, bài này cứu mình luôn!', days: 1, likes: 0 },
];

// ---------------- Chat hỗ trợ (widget my-client ↔ my-admin) ----------------
// customer: null = khách vãng lai; read = nhân viên đã mở xem tin của khách hay chưa.
const CHAT_SESSIONS = [
  {
    session: 'sess-seed-0001', user: 'thaomy', staff: 'cskh', days: 14, read: true,
    lines: [
      ['customer', 'Shop ơi đơn ORD-270263 của mình khi nào giao vậy ạ?', 0],
      ['staff', 'Chào Thảo My! Đơn đã bàn giao GHN, dự kiến giao trong 2 ngày tới nhé.', 4],
      ['customer', 'Dạ cảm ơn shop nhiều 💛', 6],
    ],
  },
  {
    session: 'sess-seed-0002', user: 'duchuy', staff: 'cskh', days: 3, read: true,
    lines: [
      ['customer', 'Đèn mặt trăng có bảo hành mạch LED không shop?', 0],
      ['staff', 'Có anh nhé, bảo hành 12 tháng cả mạch LED và pin sạc. Anh tra cứu bằng mã WR trên phiếu.', 3],
      ['customer', 'Ok, mình vừa gửi yêu cầu bảo hành rồi.', 10],
      ['staff', 'Shop đã nhận, kỹ thuật viên sẽ liên hệ anh trong hôm nay.', 12],
    ],
  },
  {
    session: 'sess-seed-0003', user: null, guestName: null, days: 1, read: false,
    lines: [
      ['customer', 'Sofa Verde có giao ra Hà Nội không ạ?', 0],
      ['customer', 'Phí ship khoảng bao nhiêu shop?', 2],
    ],
  },
  {
    session: 'sess-seed-0004', user: 'thuha', staff: 'donhang', days: 5, read: true,
    lines: [
      ['customer', 'Mình đã chuyển khoản đơn ORD-276120 rồi nha shop.', 0],
      ['staff', 'Shop đã nhận thông tin, đang đối soát sao kê và sẽ xác nhận trong ngày ạ.', 15],
    ],
  },
  {
    session: 'sess-seed-0005', user: 'maianh', days: 0, read: false,
    lines: [
      ['customer', 'Bản xem trước tượng hai bàn tay đẹp quá, mình muốn đổi sang màu be được không?', 0],
    ],
  },
  {
    session: 'sess-seed-0006', user: null, staff: 'cskh', days: 8, read: true,
    lines: [
      ['customer', 'Mã FREESHIP còn dùng được không ạ?', 0],
      ['staff', 'Còn bạn nhé, áp dụng cho đơn từ 300.000đ, giảm tối đa 30.000đ phí vận chuyển.', 2],
    ],
  },
];

// ---------------- Lịch sử trò chuyện với trợ lý AI (khách đã đăng nhập) ----------------
const AI_INIT = {
  id: 'ai-init', sender: 'AI', time: 'Vừa xong',
  text: 'Chào bạn! Mình là AI Idea Assistant của Luméa ✨. Bạn đang có ý tưởng đồ decor hay nội thất in 3D nào trong đầu, hay muốn mình gợi ý sản phẩm có sẵn trong shop? Cứ mô tả tự nhiên cho mình nghe nhé.',
  quickReplies: ['Đèn ngủ mini hình mèo dễ thương', 'Bình hoa hình học phong cách Japandi', 'Có bình hoa nào dưới 300k không?', 'Khay đựng phụ kiện bàn làm việc'],
};

const AI_CONVERSATIONS = [
  {
    id: 'conv_seed_thaomy_1', user: 'thaomy', days: 21, title: 'Đèn ngủ hình mèo cho phòng ngủ',
    brief: { productType: 'Đèn ngủ mini', theme: 'Mèo cuộn tròn', style: 'Minimalist', color: 'Trắng ngà', size: '18cm', usage: 'Đầu giường' },
    conceptImage: img('photo-1574158622682-e40e69881006', 700),
    messages: [
      AI_INIT,
      { id: 'msg_seed_1', sender: 'USER', text: 'Mình muốn một cái đèn ngủ hình mèo cuộn tròn, màu trắng ngà', time: '21:02' },
      { id: 'msg_seed_2', sender: 'AI', text: 'Ý tưởng dễ thương quá! Mình đã ghi nhận: đèn ngủ mini hình mèo cuộn tròn, tông trắng ngà, phong cách tối giản. Bạn muốn kích thước khoảng bao nhiêu và đặt ở đâu?', time: '21:02', quickReplies: ['Khoảng 18cm', 'Đặt đầu giường'] },
      { id: 'msg_seed_3', sender: 'USER', text: 'Khoảng 18cm, đặt đầu giường', time: '21:03' },
      { id: 'msg_seed_4', sender: 'AI', text: 'Tuyệt! Mình đã tạo concept tham khảo. Bạn có thể gửi yêu cầu thiết kế để kỹ thuật viên báo giá nhé.', time: '21:03', quickReplies: ['Gửi yêu cầu thiết kế'] },
    ],
  },
  {
    id: 'conv_seed_hoang_1', user: 'hoang', days: 2, title: 'Gợi ý bình hoa dưới 300k',
    messages: [
      AI_INIT,
      { id: 'msg_seed_1', sender: 'USER', text: 'Có bình hoa nào dưới 300k không?', time: '10:15' },
      {
        id: 'msg_seed_2', sender: 'AI', time: '10:15',
        text: 'Dưới đây là một số lựa chọn phù hợp từ cửa hàng Luméa:\n\n1. **Bình Cỏ Pampas Gốm Nâu Handmade** (175.000đ)\n2. **Bình Hoa Hình Học Parametric Wave Vase In 3D** (195.000đ)\n3. **Bình Hoa Gốm Trắng Ceramic Abstract Vase** (240.000đ)',
        quickReplies: ['Mình thích kiểu tối giản', 'Mẫu in 3D có tùy biến được không?'],
        suggestedProductIds: ['prod-20', 'prod-3', 'prod-2'],
      },
    ],
  },
  {
    id: 'conv_seed_minhanh_1', user: 'minhanh', days: 9, title: 'Setup góc học tập 1m2',
    messages: [
      AI_INIT,
      { id: 'msg_seed_1', sender: 'USER', text: 'Gợi ý giúp mình đồ cho góc học tập 1m2', time: '19:40' },
      {
        id: 'msg_seed_2', sender: 'AI', time: '19:41',
        text: 'Với góc 1m2, bạn nên ưu tiên đồ đa năng, gọn: khay organizer, đèn bàn tay dài và giá đỡ sách để tiết kiệm diện tích.',
        suggestedProductIds: ['prod-7', 'prod-11', 'prod-27'],
      },
    ],
  },
  {
    id: 'conv_seed_tuankiet_1', user: 'tuankiet', days: 4, title: 'Giá treo tai nghe phong cách gaming',
    brief: { productType: 'Giá đỡ tai nghe', theme: 'Cyberpunk', style: 'Modern', color: 'Đen nhám, viền neon', size: 'Cao 26cm', usage: 'Bàn chơi game' },
    messages: [
      AI_INIT,
      { id: 'msg_seed_1', sender: 'USER', text: 'Mình cần giá treo tai nghe kiểu cyberpunk, đen nhám viền neon', time: '23:10' },
      { id: 'msg_seed_2', sender: 'AI', text: 'Mình đã tổng hợp brief: giá đỡ tai nghe cao 26cm, đen nhám viền xanh neon. Bạn muốn khắc tên lên đế không?', time: '23:10', quickReplies: ['Khắc chữ KIET', 'Không cần'] },
      { id: 'msg_seed_3', sender: 'USER', text: 'Khắc chữ KIET', time: '23:11' },
    ],
  },
];

module.exports = { CUSTOM_REQUESTS, COMMUNITY_POSTS, NEWS_COMMENTS, CHAT_SESSIONS, AI_CONVERSATIONS };
