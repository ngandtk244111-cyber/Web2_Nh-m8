// Khuyến mãi & hậu mãi: mã giảm giá, phiếu bảo hành, thông báo, đăng ký bản tin.

// Bổ sung cho 3 mã có sẵn (LUMÉANEW, FREESHIP, ROOMCOMBO) trong mock-data.generated.js.
const COUPONS = [
  { code: 'DECOR20', description: 'Giảm 20% đồ decor, tối đa 80.000đ cho đơn từ 400.000đ', discountPercent: 20, maxDiscount: 80000, minSpend: 400000, active: true },
  { code: 'NOITHAT5', description: 'Giảm 5% nội thất lớn, tối đa 500.000đ cho đơn từ 3.000.000đ', discountPercent: 5, maxDiscount: 500000, minSpend: 3000000, active: true },
  { code: 'SALE1010', description: 'Siêu sale 10.10 — giảm 10% tối đa 100.000đ cho đơn từ 300.000đ', discountPercent: 10, maxDiscount: 100000, minSpend: 300000, active: true },
  { code: 'XINCHAOTHU', description: 'Chào thu 2026 — đã hết hạn', discountPercent: 12, maxDiscount: 60000, minSpend: 250000, active: false },
  { code: 'TET2026', description: 'Ưu đãi Tết Bính Ngọ — đã kết thúc', discountPercent: 15, maxDiscount: 120000, minSpend: 500000, active: false },
];

// Phiếu bảo hành cho đơn đã giao: { order, item (chỉ số món trong đơn), months, claims }.
// Trạng thái ACTIVE/EXPIRED do build.js tính theo ngày giao + số tháng; có claims thì là CLAIMED.
const WARRANTIES = [
  { code: 'WR-410276', order: 'ORD-210415', item: 0, months: 12 },
  { code: 'WR-413905', order: 'ORD-213872', item: 0, months: 12 },
  { code: 'WR-428117', order: 'ORD-228041', item: 0, months: 6 },
  { code: 'WR-431640', order: 'ORD-231190', item: 0, months: 12,
    claims: [{ note: 'Đèn chập chờn khi sạc, khách gửi về bảo hành thay mạch LED.', daysAgo: 30 }] },
  { code: 'WR-431641', order: 'ORD-231190', item: 1, months: 12 },
  { code: 'WR-436558', order: 'ORD-236554', item: 0, months: 12 },
  { code: 'WR-440322', order: 'ORD-240317', item: 0, months: 24 },
  { code: 'WR-444911', order: 'ORD-244908', item: 0, months: 12 },
  { code: 'WR-449375', order: 'ORD-249371', item: 0, months: 24,
    claims: [{ note: 'Mặt bàn có vết nứt nhỏ ở mép, hẹn kỹ thuật viên đến kiểm tra.', daysAgo: 6 }] },
  { code: 'WR-453482', order: 'ORD-253480', item: 0, months: 24 },
  { code: 'WR-453483', order: 'ORD-253480', item: 1, months: 24 },
  { code: 'WR-463559', order: 'ORD-263555', item: 0, months: 24 },
  { code: 'WR-465380', order: 'ORD-265377', item: 0, months: 24 },
  { code: 'WR-467718', order: 'ORD-267714', item: 1, months: 12 },
];

// Đăng ký bản tin.
const NEWSLETTER = [
  { email: 'thaomy.nguyen@gmail.com', user: 'thaomy', days: 380 },
  { email: 'minhanh.le@outlook.com', user: 'minhanh', days: 120 },
  { email: 'ngoclan.vo@yahoo.com', user: 'ngoclan', days: 200 },
  { email: 'maianh.huynh@gmail.com', user: 'maianh', days: 60 },
  { email: 'tuankiet.bui@gmail.com', user: 'tuankiet', days: 50 },
  { email: 'quynhchi.truong@gmail.com', user: 'quynhchi', days: 15 },
  { email: 'hongphan.hue@gmail.com', user: null, days: 57 },
  { email: 'quocbao.lam@gmail.com', user: null, days: 27 },
  { email: 'kientruc.nhaxinh@gmail.com', user: null, days: 44 },
  { email: 'linh.decor.studio@gmail.com', user: null, days: 33 },
  { email: 'ngocdiep.interior@outlook.com', user: null, days: 21 },
  { email: 'phuongthao.dang@gmail.com', user: null, days: 12 },
  { email: 'trungnghia.vo@yahoo.com', user: null, days: 8 },
  { email: 'hoangyen.home@gmail.com', user: null, days: 3 },
  { email: 'thanhtung.makerspace@gmail.com', user: null, days: 1 },
];

// Thông báo chung (userId = null) — mọi khách đều thấy.
const BROADCASTS = [
  { key: 'b1', title: '⚡ Flash Sale 10.10 sắp mở', message: 'Khung 8:00–22:00 ngày 10/10 giảm đến 40% đèn ngủ & bình hoa in 3D. Đặt nhắc ngay!', link: '/flash-sale', days: 1 },
  { key: 'b2', title: 'Ra mắt bộ sưu tập Gỗ Óc Chó Vincent', message: 'Bàn phụ, kệ sách và ghế đôn gỗ óc chó hoàn thiện thủ công — miễn phí lắp đặt nội thành TP.HCM.', link: '/catalog', days: 6 },
  { key: 'b3', title: 'Mã SALE1010 đã sẵn sàng', message: 'Giảm 10% tối đa 100.000đ cho đơn từ 300.000đ, áp dụng đến hết 10/10.', link: '/catalog', days: 3 },
  { key: 'b4', title: 'Luméa Living: Japandi tối giản', message: 'Bài viết mới về cách phối nội thất Nhật Bản gặp Bắc Âu cho căn hộ nhỏ.', link: '/news', days: 9 },
];

// Thông báo riêng của từng khách (ngoài các thông báo đơn hàng do build.js sinh theo trạng thái đơn).
const PERSONAL_NOTIFICATIONS = [
  { key: 'p1', user: 'thaomy', title: 'Yêu cầu thiết kế đã có báo giá', message: 'Đèn ngủ Luna Cat Lamp được báo giá 380.000đ, sản xuất trong 4 ngày.', link: '/custom-request', days: 22, read: true },
  { key: 'p2', user: 'hoang', title: 'Bản xem trước 3D đã sẵn sàng', message: 'Khay bút Núi Phú Sĩ đã có bản dựng 3D — mở để xem và duyệt thiết kế.', link: '/custom-request', days: 24, read: false },
  { key: 'p3', user: 'maianh', title: 'Đã đặt nhắc Flash Sale', message: 'Bạn sẽ nhận thông báo khi Flash Sale khung 10/10 bắt đầu.', link: '/flash-sale', days: 0, read: false, refKey: 'flash-sale:2026-10-10' },
  // Thông báo hẹn giờ: chỉ hiện khi tới visibleAt (giống route POST /api/notifications/flash-sale-reminder).
  { key: 'p3-start', user: 'maianh', title: '⚡ Flash Sale đã bắt đầu!', message: 'Khung 10/10 đang diễn ra — vào săn deal ngay kẻo hết suất.', link: '/flash-sale', read: false, refKey: 'flash-sale:2026-10-10:start', visibleAt: '2026-10-10T08:00:00+07:00' },
  { key: 'p4', user: 'minhanh', title: 'Bài đăng Cộng đồng được chọn Staff Pick', message: 'Bài "Kệ sách mini trên bàn học" đã được đội ngũ Luméa chọn làm Staff Pick 🎉', link: '/community', days: 11, read: true },
  { key: 'p5', user: 'khang', title: 'Bài đăng Cộng đồng đã bị ẩn', message: 'Bài "Pass lại đồ decor giá rẻ" đã bị ẩn khỏi Cộng đồng Luméa: Nội dung mua bán, quảng cáo ngoài nền tảng.', link: '/community', days: 13, read: false },
];

module.exports = { COUPONS, WARRANTIES, NEWSLETTER, BROADCASTS, PERSONAL_NOTIFICATIONS };
