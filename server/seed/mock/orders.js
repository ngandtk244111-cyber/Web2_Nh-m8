// Đơn hàng mẫu — phủ đủ 7 trạng thái, 5 phương thức thanh toán, đơn có/không tài khoản, đơn in 3D
// (PRINT_ON_DEMAND) ở từng bước sản xuất, nội thất cồng kềnh, giao nội thành/liên tỉnh, có mã giảm giá.
//
// Đây là "spec" gọn; build.js dựng thành document Order đầy đủ: lấy snapshot sản phẩm, tính giá
// bằng utils/pricing.js (giống route POST /api/orders), phí ship, vận đơn, mốc thời gian...
//
//   user      khóa trong accounts.js (null = khách vãng lai, dùng `guest` làm địa chỉ giao)
//   days/at   tạo đơn cách SEED_NOW bao nhiêu ngày, lúc mấy giờ ([hh, mm])
//   items     [productId, qty, customization?] — customization là chỉ số option trong product.customization
//   step      bước sản xuất hiện tại (đơn IN_PRODUCTION)
//   ship      { carrier, code, fee } — vận đơn (đơn SHIPPED/DELIVERED/RETURNED)

const guest = (fullName, phone, email, street, district, city, notes = '') =>
  ({ fullName, phone, email, street, district, city, notes });

const ORDERS = [
  // ---- Đơn cũ đã giao (phiếu bảo hành hết hạn) ----
  { no: 'ORD-210415', user: 'thaomy', days: 420, at: [19, 20], status: 'DELIVERED', pay: 'COD', paid: true,
    items: [['prod-2', 1], ['prod-12', 2]], ship: { carrier: 'LUMEA_FLEET', code: '', fee: 25000 } },
  { no: 'ORD-213872', user: 'hoang', days: 385, at: [21, 5], status: 'DELIVERED', pay: 'BANK_TRANSFER', paid: true,
    items: [['prod-5', 1]], ship: { carrier: 'AHAMOVE_TRUCK', code: 'AHM-25K8M2QX', fee: 85000 } },
  { no: 'ORD-228041', user: 'ngoclan', days: 230, at: [10, 40], status: 'DELIVERED', pay: 'MOMO', paid: true,
    items: [['mock-walnut-bookshelf', 1]], ship: { carrier: 'LUMEA_FLEET', code: '', fee: 180000 },
    notes: 'Giao giờ hành chính, cần lắp đặt tại nhà.' },

  // ---- Đã giao trong 4 tháng gần đây ----
  { no: 'ORD-231190', user: 'duchuy', days: 110, at: [8, 15], status: 'DELIVERED', pay: 'ZALOPAY', paid: true,
    items: [['prod-1', 1, { color: 1, size: 1, material: 1, text: 'Huy & Vy' }], ['prod-3', 1, { color: 2, size: 0, material: 0 }]],
    ship: { carrier: 'GHN_STANDARD', code: 'GYK7QPVN', fee: 42000 } },
  { no: 'ORD-236554', user: 'minhanh', days: 95, at: [22, 10], status: 'DELIVERED', pay: 'COD', paid: true, coupon: 'LUMÉANEW',
    items: [['prod-7', 2, { color: 1, size: 0, material: 0, text: 'Minh Anh' }], ['prod-10', 1]],
    ship: { carrier: 'GHTK', code: 'S22083021.BO.HN.A12', fee: 32000 } },
  { no: 'ORD-240317', user: 'baolong', days: 88, at: [14, 0], status: 'DELIVERED', pay: 'BANK_TRANSFER', paid: true, coupon: 'NOITHAT5',
    items: [['prod-22', 1]], ship: { carrier: 'VIETTELPOST_BULKY', code: '1784512369', fee: 650000 },
    notes: 'Gọi trước 30 phút, nhà trong hẻm xe tải nhỏ vào được.' },
  { no: 'ORD-244908', user: 'thaomy', days: 70, at: [20, 45], status: 'DELIVERED', pay: 'MOMO', paid: true,
    items: [['prod-8', 1, { color: 2, size: 0, material: 1 }], ['prod-20', 1]],
    ship: { carrier: 'GHTK', code: 'S22083021.SG.Q3.B07', fee: 28000 } },
  { no: 'ORD-247263', user: 'maianh', days: 62, at: [11, 30], status: 'DELIVERED', pay: 'COD', paid: true, coupon: 'FREESHIP',
    items: [['prod-14', 1], ['prod-15', 2], ['prod-17', 1]], ship: { carrier: 'GHTK', code: 'S22083021.SG.PN.C33', fee: 30000 } },
  { no: 'ORD-249371', user: null, days: 58, at: [9, 50], status: 'DELIVERED', pay: 'COD', paid: true,
    guest: guest('Phan Thị Hồng', '0914556677', 'hongphan.hue@gmail.com', '9 Nguyễn Huệ', 'Phường Vĩnh Ninh', 'Thừa Thiên Huế'),
    items: [['prod-24', 1]], ship: { carrier: 'VIETTELPOST_BULKY', code: '1784599021', fee: 520000 } },
  { no: 'ORD-253480', user: 'hoang', days: 48, at: [16, 20], status: 'DELIVERED', pay: 'ZALOPAY', paid: true,
    items: [['mock-walnut-side-table', 1, { color: 0, size: 1, finish: 1 }], ['mock-oak-stool', 2]],
    ship: { carrier: 'LUMEA_FLEET', code: '', fee: 120000 } },
  { no: 'ORD-260045', user: 'ngoclan', days: 35, at: [13, 5], status: 'DELIVERED', pay: 'COD', paid: false,
    items: [['prod-4', 1], ['prod-19', 1]], ship: { carrier: 'LUMEA_FLEET', code: '', fee: 35000 },
    notes: 'Đã thu COD — chờ đối soát.' },
  { no: 'ORD-263555', user: null, days: 28, at: [19, 0], status: 'DELIVERED', pay: 'MOMO', paid: true,
    guest: guest('Lâm Quốc Bảo', '0932118899', 'quocbao.lam@gmail.com', '301 Lý Thường Kiệt', 'Quận 10', 'TP. Hồ Chí Minh'),
    items: [['prod-5', 1], ['prod-13', 1]], ship: { carrier: 'LALAMOVE_VAN', code: 'LLM-9F3K2A', fee: 90000 } },
  { no: 'ORD-265377', user: 'duchuy', days: 26, at: [10, 10], status: 'DELIVERED', pay: 'BANK_TRANSFER', paid: true,
    items: [['prod-25', 1]], ship: { carrier: 'GHN_HEAVY', code: 'GYKH8R2M', fee: 210000 } },
  { no: 'ORD-267714', user: 'minhanh', days: 21, at: [21, 35], status: 'DELIVERED', pay: 'MOMO', paid: true, coupon: 'DECOR20',
    items: [['prod-27', 2], ['prod-11', 1]], ship: { carrier: 'GHN_HEAVY', code: 'GYKH9T4C', fee: 65000 } },

  // ---- Hoàn hàng / huỷ ----
  { no: 'ORD-251736', user: 'tuankiet', days: 55, at: [15, 25], status: 'RETURNED', pay: 'COD', paid: false,
    items: [['prod-9', 1]], ship: { carrier: 'GHN_STANDARD', code: 'GYK2LM8W', fee: 30000 },
    returnReason: 'Khách không nghe máy 3 lần giao, shipper hoàn hàng về kho.' },
  { no: 'ORD-258102', user: 'thuha', days: 40, at: [12, 40], status: 'CANCELLED', pay: 'MOMO', paid: false, failed: true,
    items: [['prod-16', 1]], cancelReason: 'Thanh toán MoMo thất bại, khách không đặt lại.' },
  { no: 'ORD-262918', user: 'khang', days: 30, at: [18, 15], status: 'CANCELLED', pay: 'COD', paid: false,
    items: [['prod-13', 2]], cancelReason: 'Khách đổi ý, muốn chờ mẫu màu óc chó.' },
  { no: 'ORD-278888', user: null, days: 2, at: [9, 0], status: 'CANCELLED', pay: 'BANK_TRANSFER', paid: false,
    guest: guest('Hồ Văn Nam', '0905667788', 'vannam.ho@gmail.com', '45 Nguyễn Văn Linh', 'Quận Hải Châu', 'Đà Nẵng'),
    items: [['prod-21', 1]], cancelReason: 'Khách không chuyển khoản sau 48 giờ.' },

  // ---- Đang giao ----
  { no: 'ORD-270263', user: 'thaomy', days: 6, at: [20, 0], status: 'SHIPPED', pay: 'COD', paid: false,
    items: [['prod-1', 1, { color: 0, size: 2, material: 0, text: 'Happy 25th, Ngân' }], ['prod-18', 1]],
    ship: { carrier: 'GHN_STANDARD', code: 'GYK5VB3D', fee: 36000 } },
  { no: 'ORD-271590', user: 'baolong', days: 3, at: [9, 45], status: 'SHIPPED', pay: 'ZALOPAY', paid: true,
    items: [['prod-6', 1]], ship: { carrier: 'GHN_HEAVY', code: 'GYKH2P7Q', fee: 95000 } },
  { no: 'ORD-272777', user: null, days: 2, at: [14, 30], status: 'SHIPPED', pay: 'COD', paid: false,
    guest: guest('Trịnh Mỹ Duyên', '0981223344', 'myduyen.trinh@gmail.com', '12 Ngõ Huế', 'Quận Hai Bà Trưng', 'Hà Nội', 'Giao sau 18h'),
    items: [['prod-15', 2]], ship: { carrier: 'GHTK', code: 'S22083021.HN.HBT.D19', fee: 30000 } },

  // ---- Đang sản xuất (in 3D) ----
  { no: 'ORD-273841', user: 'maianh', days: 9, at: [10, 20], status: 'IN_PRODUCTION', pay: 'MOMO', paid: true, step: 'POST_PROCESSING',
    items: [['prod-3', 2, { color: 1, size: 1, material: 1 }]] },
  { no: 'ORD-274406', user: 'hoang', days: 7, at: [22, 50], status: 'IN_PRODUCTION', pay: 'COD', paid: false, step: '3D_PRINTING',
    items: [['prod-7', 1, { color: 2, size: 1, material: 1, text: 'Keep Coding' }]] },
  { no: 'ORD-275983', user: 'tuankiet', days: 6, at: [8, 5], status: 'IN_PRODUCTION', pay: 'BANK_TRANSFER', paid: true, step: 'PACKAGING',
    items: [['prod-8', 1, { color: 1, size: 1, material: 0 }], ['prod-2', 1]] },

  // ---- Đã xác nhận ----
  { no: 'ORD-276120', user: 'thuha', days: 5, at: [15, 0], status: 'CONFIRMED', pay: 'BANK_TRANSFER', paid: false, transferReported: true,
    items: [['prod-23', 1]], notes: 'Đã chuyển khoản qua Vietcombank, nội dung ORD-276120.' },
  { no: 'ORD-277458', user: 'ngoclan', days: 4, at: [11, 15], status: 'CONFIRMED', pay: 'ZALOPAY', paid: true,
    items: [['mock-oak-side-table', 1], ['prod-21', 1]] },
  { no: 'ORD-279112', user: 'maianh', days: 1, at: [21, 10], status: 'CONFIRMED', pay: 'MOMO', paid: false,
    items: [['prod-14', 1]] },

  // ---- Chờ gọi xác nhận (COD) ----
  { no: 'ORD-278034', user: 'khang', days: 3, at: [19, 40], status: 'PENDING', pay: 'COD', paid: false,
    items: [['prod-10', 2], ['prod-12', 3]] },
  { no: 'ORD-278690', user: 'duchuy', days: 2, at: [7, 55], status: 'PENDING', pay: 'COD', paid: false,
    items: [['prod-1', 1, { color: 4, size: 0, material: 2, text: 'Đà Nẵng 2026' }]] },
  { no: 'ORD-279545', user: 'quynhchi', days: 1, at: [12, 25], status: 'PENDING', pay: 'COD', paid: false, coupon: 'LUMÉANEW',
    guest: guest('Trương Quỳnh Chi', '0767445566', 'quynhchi.truong@gmail.com', '68 Nguyễn Thị Minh Khai', 'Quận 1', 'TP. Hồ Chí Minh'),
    items: [['prod-20', 2]] },
  { no: 'ORD-279901', user: null, days: 0, at: [8, 30], status: 'PENDING', pay: 'COD', paid: false, coupon: 'ROOMCOMBO',
    guest: guest('Cao Thùy Linh', '0938990011', 'thuylinh.cao@gmail.com', '27 Võ Văn Tần', 'Quận 3', 'TP. Hồ Chí Minh', 'Cần lắp ráp tại nhà'),
    items: [['prod-26', 1]] },
];

// Tiến độ sản xuất in 3D (Order.productionProgress.currentStep).
const PRODUCTION_STEPS = {
  FILE_PREPARATION: { percentage: 15, stepTitle: 'Tiếp nhận đơn in 3D & Kiểm tra file Slicing', notes: 'Kỹ thuật viên đang kiểm tra thông số lớp in, hướng đặt layer và hỗ trợ support.' },
  '3D_PRINTING': { percentage: 40, stepTitle: 'Đang in 3D trên máy Bambu Lab X1C', notes: 'Độ dày lớp 0.16mm, dự kiến in xong trong 9 giờ.' },
  POST_PROCESSING: { percentage: 65, stepTitle: 'Gỡ support, chà nhám & xử lý bề mặt', notes: 'Đang chà nhám mịn và phủ lớp hoàn thiện theo lựa chọn của bạn.' },
  ASSEMBLY_TESTING: { percentage: 80, stepTitle: 'Lắp ráp & kiểm tra chất lượng', notes: 'Kiểm tra đèn LED, độ khít các chi tiết và màu sắc.' },
  PACKAGING: { percentage: 95, stepTitle: 'Đóng gói chống sốc', notes: 'Đã đóng gói bằng xốp định hình và hộp carton 5 lớp.' },
};

module.exports = { ORDERS, PRODUCTION_STEPS };
