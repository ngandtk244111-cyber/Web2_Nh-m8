// Trả lời tự động cho chat hỗ trợ: nhận diện chủ đề theo từ khoá trong tin của khách và gợi ý
// đúng trang cần vào (tra cứu đơn, đổi trả, bảo hành...). Nhân viên vẫn có thể trả lời tiếp như thường.

// Bỏ dấu tiếng Việt + chữ thường để khách gõ "doi tra" hay "đổi trả" đều khớp.
function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const TOPICS = [
  {
    key: 'order',
    keywords: ['don hang', 'tra cuu don', 'ma don', 'kiem tra don', 'theo doi don', 'don cua toi', 'don toi', 'dat hang', 'tinh trang don', 'huy don'],
    text: 'Bạn có thể xem trạng thái đơn hàng ngay bằng mã đơn (VD: ORD-982104). Nếu đã đăng nhập, mọi đơn của bạn nằm trong mục Tài khoản.',
    links: [
      { label: 'Tra cứu đơn hàng', url: '/orders/track' },
      { label: 'Đơn hàng của tôi', url: '/account' },
    ],
  },
  {
    key: 'shipping',
    keywords: ['giao hang', 'ship', 'van chuyen', 'phi giao', 'mien phi', 'khi nao nhan', 'nhan hang'],
    text: 'Luméa miễn phí vận chuyển cho đơn từ 500.000₫, đơn nhỏ hơn đồng giá 30.000₫ toàn quốc. Hàng có sẵn giao trong 2-4 ngày làm việc; hàng in theo yêu cầu cộng thêm thời gian sản xuất.',
    links: [{ label: 'Chính sách giao hàng', url: '/chinh-sach/giao-hang' }],
  },
  {
    key: 'return',
    keywords: ['doi tra', 'tra hang', 'doi hang', 'hoan tien', 'hu hong', 'bi loi', 'loi san pham', 'giao sai', 'bi vo', 'bi hong'],
    text: 'Luméa hỗ trợ đổi trả trong 7 ngày nếu sản phẩm lỗi sản xuất, hư hỏng khi vận chuyển hoặc giao sai mẫu. Bạn xem điều kiện chi tiết tại đây nhé.',
    links: [{ label: 'Chính sách đổi trả', url: '/chinh-sach/doi-tra' }],
  },
  {
    key: 'warranty',
    keywords: ['bao hanh'],
    text: 'Bạn có thể tra cứu bảo hành bằng mã bảo hành (VD: WR-000123) và số điện thoại đặt hàng, hoặc xem phạm vi bảo hành trong chính sách.',
    links: [
      { label: 'Tra cứu bảo hành', url: '/warranty-lookup' },
      { label: 'Chính sách bảo hành', url: '/chinh-sach/bao-hanh' },
    ],
  },
  {
    key: 'payment',
    keywords: ['thanh toan', 'momo', 'zalopay', 'zalo pay', 'chuyen khoan', 'cod', 'tra gop', 'the ngan hang'],
    text: 'Luméa nhận thanh toán khi nhận hàng (COD), chuyển khoản/VietQR, ví MoMo và ZaloPay. Chi tiết từng phương thức ở trang dưới đây.',
    links: [{ label: 'Phương thức thanh toán', url: '/chinh-sach/thanh-toan' }],
  },
  {
    key: 'custom',
    keywords: ['theo yeu cau', 'dat lam', 'dat rieng', 'thiet ke rieng', 'lam rieng', 'in 3d', 'custom', 'gia cong'],
    text: 'Bạn muốn đặt làm sản phẩm riêng? Gửi yêu cầu kèm ảnh/kích thước mong muốn, đội ngũ Luméa sẽ báo giá cho bạn.',
    links: [
      { label: 'Gửi yêu cầu thiết kế', url: '/custom-request/new' },
      { label: 'Tùy biến 3D', url: '/customizer-3d' },
    ],
  },
  {
    key: 'sale',
    keywords: ['khuyen mai', 'giam gia', 'sale', 'voucher', 'ma giam', 'coupon', 'flash', 'uu dai'],
    text: 'Các ưu đãi đang chạy được cập nhật ở trang Flash Sale. Bạn cũng có thể dùng Xu Luméa để giảm giá khi thanh toán.',
    links: [
      { label: 'Xem Flash Sale', url: '/flash-sale' },
      { label: 'Xu Luméa', url: '/xu' },
    ],
  },
  {
    key: 'coins',
    keywords: ['xu', 'diem thuong', 'tich diem'],
    text: 'Xu Luméa tích được khi mua hàng và tham gia hoạt động, dùng để giảm giá cho đơn sau.',
    links: [{ label: 'Xu Luméa', url: '/xu' }],
  },
  {
    key: 'style',
    keywords: ['tu van', 'phong cach', 'phoi do', 'chon do', 'goi y', 'trang tri', 'decor', 'noi that'],
    text: 'Để chọn đồ hợp không gian, bạn thử làm bài trắc nghiệm phong cách hoặc xem các phòng mẫu đã phối sẵn. Nhân viên cũng sẽ tư vấn thêm cho bạn ngay tại đây.',
    links: [
      { label: 'Trắc nghiệm phong cách', url: '/style-quiz' },
      { label: 'Phòng mẫu', url: '/shop-the-room' },
      { label: 'Xem sản phẩm', url: '/catalog' },
    ],
  },
  {
    key: 'account',
    keywords: ['dang nhap', 'dang ky', 'mat khau', 'tai khoan', 'quen mat khau', 'otp'],
    text: 'Bạn quản lý thông tin, địa chỉ và đơn hàng trong mục Tài khoản. Nếu không đăng nhập được, hãy dùng "Quên mật khẩu" ở khung đăng nhập.',
    links: [{ label: 'Tài khoản của tôi', url: '/account' }],
  },
  {
    key: 'human',
    keywords: ['nhan vien', 'nguoi that', 'hotline', 'so dien thoai', 'lien he', 'goi dien', 'admin'],
    text: 'Mình đã chuyển cuộc trò chuyện cho nhân viên Luméa, bạn vui lòng chờ trong giây lát nhé. Thông tin liên hệ khác có ở trang Liên hệ.',
    links: [{ label: 'Liên hệ Luméa', url: '/chinh-sach/lien-he' }],
  },
];

const MATCHERS = TOPICS.map(t => ({
  topic: t,
  re: new RegExp(`(^|[^a-z0-9])(${t.keywords.map(k => k.replace(/ /g, '\\s+')).join('|')})(?=[^a-z0-9]|$)`),
}));

const WELCOME_LINKS = [
  { label: 'Tra cứu đơn hàng', url: '/orders/track' },
  { label: 'Chính sách đổi trả', url: '/chinh-sach/doi-tra' },
  { label: 'Tra cứu bảo hành', url: '/warranty-lookup' },
  { label: 'Câu hỏi thường gặp', url: '/chinh-sach/faq' },
];
const GREETING_RE = /(^|[^a-z0-9])(xin chao|chao|hello|helo|hi|hey|alo|a lo|shop oi|ban oi|ad oi|admin oi|co ai khong|good morning)(?=[^a-z0-9]|$)/;
const GREETING = 'Chào bạn, Luméa rất vui được hỗ trợ bạn! Bạn đang cần giúp về vấn đề gì? Bạn có thể nhắn câu hỏi hoặc chọn nhanh bên dưới.';
const ACK_ONLINE = 'Mình chưa có dữ liệu để trả lời câu này, mình đã chuyển tin nhắn cho nhân viên Luméa. Bạn vui lòng đợi trong giây lát nhé!';
const ACK_OFFLINE = 'Mình chưa có dữ liệu để trả lời câu này, mình đã chuyển tin nhắn cho nhân viên Luméa. Nhân viên sẽ phản hồi bạn sớm nhất khi trực tuyến nhé!';
const ONLINE = 'Hiện mình chưa có dữ liệu để trả lời câu hỏi này. Mình đã gửi yêu cầu kết nối với nhân viên Luméa, bạn vui lòng đợi trong giây lát nhé! Trong lúc chờ, bạn có thể chọn nhanh vấn đề cần hỗ trợ bên dưới.';
const OFFLINE = 'Hiện mình chưa có dữ liệu để trả lời câu hỏi này. Mình đã gửi yêu cầu kết nối với nhân viên Luméa, nhưng hiện chưa có nhân viên trực tuyến. Luméa sẽ phản hồi bạn sớm nhất có thể, bạn vui lòng đợi nhé! Trong lúc chờ, bạn có thể chọn nhanh vấn đề cần hỗ trợ bên dưới.';

/**
 * Quyết định câu trả lời tự động cho 1 tin của khách.
 * @param text nội dung khách gửi
 * @param ctx  { isFirstMessage, staffOnline, recentAutoReply, staffChatting } — recentAutoReply: đã có tin tự động
 *             trong vài phút gần đây (gửi xác nhận ngắn thay vì lặp menu); staffChatting: nhân viên thật
 *             vừa trả lời gần đây (câu không rõ chủ đề thì để nhân viên xử lý).
 * @returns {{ text: string, links: {label: string, url: string}[] } | null}
 */
function buildAutoReply(text, { isFirstMessage, staffOnline, recentAutoReply, staffChatting }) {
  const norm = normalize(text);
  const matched = MATCHERS.filter(m => m.re.test(norm)).map(m => m.topic).slice(0, 2);

  if (matched.length) {
    const parts = matched.map(t => t.text);
    const seen = new Set();
    const links = matched.flatMap(t => t.links).filter(l => !seen.has(l.url) && seen.add(l.url));
    return { text: parts.join('\n\n'), links };
  }

  // Nhân viên thật đang trò chuyện với khách -> trợ lý không chen vào.
  if (staffChatting) return null;

  // Lời chào ("chào", "hello", "shop ơi"...) -> chào lại + menu gợi ý.
  if (GREETING_RE.test(norm)) return { text: GREETING, links: WELCOME_LINKS };

  // Không rõ chủ đề: tin nào cũng phản hồi. Menu gợi ý chỉ gửi lại khi đã lâu chưa gửi, còn lại xác nhận ngắn.
  if (isFirstMessage) return { text: staffOnline ? ONLINE : OFFLINE, links: WELCOME_LINKS };
  if (recentAutoReply) return { text: staffOnline ? ACK_ONLINE : ACK_OFFLINE, links: [] };
  return { text: staffOnline ? ONLINE : OFFLINE, links: WELCOME_LINKS };
}

module.exports = { buildAutoReply };
