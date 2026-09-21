// Nạp dữ liệu mẫu (chuyển từ mock-data.ts của my-client) vào MongoDB — chỉ chạy 1 lần,
// bỏ qua collection nào đã có dữ liệu để không tạo trùng khi chạy lại.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const Product = require('../models/Product');
const Room = require('../models/Room');
const CustomRequest = require('../models/CustomRequest');
const CommunityPost = require('../models/CommunityPost');
const NewsArticle = require('../models/NewsArticle');

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

async function run() {
  await connectDB();

  await seedCollection(Product, MOCK_PRODUCTS, 'Product');
  await seedCollection(Room, MOCK_ROOMS, 'Room');
  await seedCollection(CustomRequest, MOCK_CUSTOM_REQUESTS, 'CustomRequest');
  await seedCollection(CommunityPost, MOCK_COMMUNITY_POSTS, 'CommunityPost');
  await seedCollection(NewsArticle, MOCK_NEWS_ARTICLES, 'NewsArticle');

  await mongoose.connection.close();
  console.log('[seed] Hoàn tất.');
}

run().catch(err => {
  console.error('[seed] Lỗi:', err);
  process.exit(1);
});
