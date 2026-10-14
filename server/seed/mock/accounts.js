// Tài khoản mẫu: khách hàng (User) và nhân viên my-admin (Admin).
// Mật khẩu để ở dạng thô CHỈ cho dữ liệu kiểm thử — seed-all.js băm bằng bcrypt trước khi ghi DB.
// Trường `coins` của User do build.js tính bằng tổng các CoinTransaction mẫu của user đó.
const { oid, daysAgo, img } = require('./helpers');

const CUSTOMER_PASSWORD = 'Lumea@123';
const STAFF_PASSWORD = 'Staff@123';

const AVATAR = {
  f1: img('photo-1494790108377-be9c29b29330', 150),
  f2: img('photo-1534528741775-53994a69daeb', 150),
  f3: img('photo-1544005313-94ddf0286df2', 150),
  f4: img('photo-1438761681033-6461ffad8d80', 150),
  f5: img('photo-1517841905240-472988babdf9', 150),
  m1: img('photo-1500648767791-00dcc994a43e', 150),
  m2: img('photo-1507003211169-0a1dd7228f2d', 150),
  m3: img('photo-1535713875002-d1d0cf377fde', 150),
  m4: img('photo-1506794778202-cad84cf45f1d', 150),
  m5: img('photo-1472099645785-5658abf4ff4e', 150),
};

const addr = (label, fullName, phone, city, district, ward, address, isDefault = false) =>
  ({ label, fullName, phone, city, district, ward, address, isDefault });

// key: khóa nội bộ để các file mock khác tham chiếu (orders, coins, comments...).
const USERS = [
  {
    key: 'thaomy', phoneNumber: '0938112201', fullName: 'Nguyễn Thảo My', email: 'thaomy.nguyen@gmail.com',
    gender: 'female', dateOfBirth: '1999-03-14', avatar: AVATAR.f1, createdDaysAgo: 450, lastLoginDaysAgo: 0,
    addresses: [
      addr('Nhà riêng', 'Nguyễn Thảo My', '0938112201', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường Võ Thị Sáu', '42/7 Trần Quốc Thảo', true),
      addr('Công ty', 'Nguyễn Thảo My', '0938112201', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', 'Tầng 12, 115 Nguyễn Huệ'),
    ],
  },
  {
    key: 'hoang', phoneNumber: '0907223302', fullName: 'Trần Văn Hoàng', email: 'hoang.tran@design.io',
    gender: 'male', dateOfBirth: '1994-07-22', avatar: AVATAR.m2, createdDaysAgo: 400, lastLoginDaysAgo: 1,
    addresses: [
      addr('Nhà riêng', 'Trần Văn Hoàng', '0907223302', 'TP. Hồ Chí Minh', 'Quận Bình Thạnh', 'Phường 25', '88 Điện Biên Phủ', true),
    ],
  },
  {
    key: 'minhanh', phoneNumber: '0976334403', fullName: 'Lê Minh Anh', email: 'minhanh.le@outlook.com',
    gender: 'female', dateOfBirth: '2000-11-02', avatar: AVATAR.f2, createdDaysAgo: 160, lastLoginDaysAgo: 2,
    addresses: [
      addr('Nhà riêng', 'Lê Minh Anh', '0976334403', 'Hà Nội', 'Quận Cầu Giấy', 'Phường Dịch Vọng Hậu', 'Ngõ 165 Xuân Thủy, số 12', true),
    ],
  },
  {
    key: 'duchuy', phoneNumber: '0963445504', fullName: 'Phạm Đức Huy', email: 'duchuy.pham@gmail.com',
    gender: 'male', dateOfBirth: '1997-05-18', avatar: AVATAR.m1, createdDaysAgo: 150, lastLoginDaysAgo: 5,
    addresses: [
      addr('Nhà riêng', 'Phạm Đức Huy', '0963445504', 'Đà Nẵng', 'Quận Hải Châu', 'Phường Thạch Thang', '27 Lê Lợi', true),
    ],
  },
  {
    key: 'ngoclan', phoneNumber: '0918556605', fullName: 'Võ Ngọc Lan', email: 'ngoclan.vo@yahoo.com',
    gender: 'female', dateOfBirth: '1992-01-30', avatar: AVATAR.f3, createdDaysAgo: 260, lastLoginDaysAgo: 3,
    addresses: [
      addr('Nhà riêng', 'Võ Ngọc Lan', '0918556605', 'TP. Hồ Chí Minh', 'TP. Thủ Đức', 'Phường Thảo Điền', '15 Quốc Hương', true),
      addr('Nhà bố mẹ', 'Võ Văn Tâm', '0903899001', 'Bình Dương', 'TP. Thủ Dầu Một', 'Phường Phú Cường', '210 Yersin'),
    ],
  },
  {
    key: 'baolong', phoneNumber: '0889667706', fullName: 'Đặng Bảo Long', email: 'baolong.dang@gmail.com',
    gender: 'male', dateOfBirth: '1990-09-09', avatar: AVATAR.m4, createdDaysAgo: 120, lastLoginDaysAgo: 8,
    addresses: [
      addr('Nhà riêng', 'Đặng Bảo Long', '0889667706', 'Cần Thơ', 'Quận Ninh Kiều', 'Phường Tân An', '56 Hai Bà Trưng', true),
    ],
  },
  {
    // Sinh nhật đúng ngày 9/10 — dùng để kiểm thử thưởng Xu sinh nhật ở /api/coins/me.
    key: 'maianh', phoneNumber: '0356778807', fullName: 'Huỳnh Mai Anh', email: 'maianh.huynh@gmail.com',
    gender: 'female', dateOfBirth: '2001-10-09', avatar: AVATAR.f4, createdDaysAgo: 95, lastLoginDaysAgo: 0,
    addresses: [
      addr('Nhà riêng', 'Huỳnh Mai Anh', '0356778807', 'TP. Hồ Chí Minh', 'Quận Phú Nhuận', 'Phường 9', '120 Phan Xích Long', true),
    ],
  },
  {
    key: 'tuankiet', phoneNumber: '0397889908', fullName: 'Bùi Tuấn Kiệt', email: 'tuankiet.bui@gmail.com',
    gender: 'male', dateOfBirth: '1996-12-25', avatar: AVATAR.m5, createdDaysAgo: 80, lastLoginDaysAgo: 4,
    addresses: [
      addr('Nhà riêng', 'Bùi Tuấn Kiệt', '0397889908', 'Hà Nội', 'Quận Đống Đa', 'Phường Láng Hạ', '18 Thái Thịnh', true),
    ],
  },
  {
    key: 'thuha', phoneNumber: '0822990009', fullName: 'Ngô Thu Hà', email: 'thuha.ngo@gmail.com',
    gender: 'female', dateOfBirth: '1998-04-11', avatar: AVATAR.f5, createdDaysAgo: 60, lastLoginDaysAgo: 6,
    addresses: [
      addr('Căn hộ', 'Ngô Thu Hà', '0822990009', 'TP. Hồ Chí Minh', 'Quận 7', 'Phường Tân Phong', 'Block B, Sunrise City, 23 Nguyễn Hữu Thọ', true),
    ],
  },
  {
    key: 'khang', phoneNumber: '0843001110', fullName: 'Đỗ Văn Khang', email: 'vankhang.do@gmail.com',
    gender: 'male', dateOfBirth: '1995-08-03', avatar: AVATAR.m3, createdDaysAgo: 45, lastLoginDaysAgo: 10,
    addresses: [
      addr('Nhà riêng', 'Đỗ Văn Khang', '0843001110', 'Hải Phòng', 'Quận Lê Chân', 'Phường An Biên', '74 Tô Hiệu', true),
    ],
  },
  {
    // Tài khoản đăng nhập Google, chưa gắn SĐT, không có mật khẩu.
    key: 'quynhchi', phoneNumber: null, googleId: 'seed-google-110482637519', password: null,
    fullName: 'Trương Quỳnh Chi', email: 'quynhchi.truong@gmail.com', gender: '', dateOfBirth: '',
    avatar: AVATAR.f2, createdDaysAgo: 20, lastLoginDaysAgo: 1, addresses: [],
  },
  {
    // Tài khoản bị khoá — kiểm thử trạng thái active=false.
    key: 'giabao', phoneNumber: '0909112211', fullName: 'Lý Gia Bảo', email: 'giabao.ly@gmail.com',
    gender: 'male', dateOfBirth: '1993-02-17', avatar: '', createdDaysAgo: 70, lastLoginDaysAgo: 40,
    active: false, addresses: [],
  },
].map(u => ({
  _id: oid(`user:${u.key}`),
  password: u.password === null ? null : CUSTOMER_PASSWORD,
  googleId: null,
  active: true,
  ...u,
}));

const ADMINS = [
  { key: 'donhang', username: 'staff.donhang', fullName: 'Nguyễn Hoàng Phúc — Điều phối đơn hàng', active: true, lastLoginDaysAgo: 0 },
  { key: 'cskh', username: 'staff.cskh', fullName: 'Trần Bích Ngọc — Chăm sóc khách hàng', active: true, lastLoginDaysAgo: 0 },
  { key: 'noidung', username: 'staff.noidung', fullName: 'Lê Quang Vinh — Biên tập nội dung', active: true, lastLoginDaysAgo: 2 },
  // Nhân viên đã nghỉ — tài khoản bị khoá, đăng nhập phải bị từ chối.
  { key: 'nghiviec', username: 'staff.nghiviec', fullName: 'Phan Thanh Tâm (đã nghỉ việc)', active: false, lastLoginDaysAgo: 90 },
].map(a => ({ _id: oid(`admin:${a.key}`), password: STAFF_PASSWORD, ...a }));

function toUserDoc(u) {
  const { key, createdDaysAgo, lastLoginDaysAgo, ...rest } = u;
  return {
    ...rest,
    lastLogin: daysAgo(lastLoginDaysAgo, 20, 15),
    createdAt: daysAgo(createdDaysAgo, 9, 30),
    updatedAt: daysAgo(lastLoginDaysAgo, 20, 15),
  };
}

function toAdminDoc(a) {
  const { key, lastLoginDaysAgo, ...rest } = a;
  return { ...rest, lastLogin: daysAgo(lastLoginDaysAgo, 8, 5), createdAt: daysAgo(200), updatedAt: daysAgo(lastLoginDaysAgo, 8, 5) };
}

const userByKey = Object.fromEntries(USERS.map(u => [u.key, u]));
const adminByKey = Object.fromEntries(ADMINS.map(a => [a.key, a]));

module.exports = { USERS, ADMINS, toUserDoc, toAdminDoc, userByKey, adminByKey, CUSTOMER_PASSWORD, STAFF_PASSWORD };
