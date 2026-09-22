// Nạp dữ liệu mẫu (chuyển từ mock-data.ts của my-client) vào MongoDB — chỉ chạy 1 lần,
// bỏ qua collection nào đã có dữ liệu để không tạo trùng khi chạy lại.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');

const Product = require('../models/Product');
const Room = require('../models/Room');
const CustomRequest = require('../models/CustomRequest');
const CommunityPost = require('../models/CommunityPost');
const NewsArticle = require('../models/NewsArticle');
const Admin = require('../models/Admin');

const {
  MOCK_PRODUCTS,
  MOCK_ROOMS,
  MOCK_CUSTOM_REQUESTS,
  MOCK_COMMUNITY_POSTS,
  MOCK_NEWS_ARTICLES,
} = require('./mock-data.generated');

async function seedCollection(Model, data, label) {
  const count = await Model.countDocuments();
  if (count > 0) {
    console.log(`[seed] ${label}: đã có ${count} bản ghi, bỏ qua.`);
    return;
  }
  await Model.insertMany(data);
  console.log(`[seed] ${label}: đã nạp ${data.length} bản ghi.`);
}

// Tạo sẵn 1 tài khoản admin mặc định nếu collection Admin còn trống, để có thể đăng nhập
// my-admin lần đầu mà không cần thao tác tay trên MongoDB. Đổi ADMIN_DEFAULT_USERNAME/
// ADMIN_DEFAULT_PASSWORD trong .env nếu muốn khác — luôn nên đổi password mặc định trước khi
// deploy thật.
async function seedDefaultAdmin() {
  const count = await Admin.countDocuments();
  if (count > 0) {
    console.log(`[seed] Admin: đã có ${count} tài khoản, bỏ qua.`);
    return;
  }

  const username = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
  const hashed = await bcrypt.hash(password, 10);

  await Admin.create({ username, password: hashed, fullName: 'Quản trị viên Luméa' });
  console.log(`[seed] Admin: đã tạo tài khoản mặc định "${username}" — nhớ đổi mật khẩu trước khi deploy thật.`);
}

async function run() {
  await connectDB();

  await seedCollection(Product, MOCK_PRODUCTS, 'Product');
  await seedCollection(Room, MOCK_ROOMS, 'Room');
  await seedCollection(CustomRequest, MOCK_CUSTOM_REQUESTS, 'CustomRequest');
  await seedCollection(CommunityPost, MOCK_COMMUNITY_POSTS, 'CommunityPost');
  await seedCollection(NewsArticle, MOCK_NEWS_ARTICLES, 'NewsArticle');
  await seedDefaultAdmin();

  await mongoose.connection.close();
  console.log('[seed] Hoàn tất.');
}

run().catch(err => {
  console.error('[seed] Lỗi:', err);
  process.exit(1);
});
