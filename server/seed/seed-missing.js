// Bổ sung dữ liệu mẫu còn thiếu vào MongoDB đã có sẵn dữ liệu — CHỈ THÊM bản ghi chưa tồn tại
// (so theo `id`), không xoá hay ghi đè bản ghi hiện có. Khác seed.js (chỉ nạp khi collection rỗng).
// Chạy: node seed/seed-missing.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const Product = require('../models/Product');
const CommunityPost = require('../models/CommunityPost');
const NewsArticle = require('../models/NewsArticle');
const Coupon = require('../models/Coupon');

const { MOCK_COMMUNITY_POSTS, MOCK_NEWS_ARTICLES, MOCK_COUPONS } = require('./mock-data.generated');
const { DEV_MOCK_PRODUCTS } = require('./product-detail.generated');

async function addMissing(Model, data, label, key = 'id') {
  const existing = new Set((await Model.find({}, { [key]: 1, _id: 0 }).lean()).map(d => d[key]));
  const missing = data.filter(d => !existing.has(d[key]));
  if (missing.length === 0) {
    console.log(`[seed-missing] ${label}: không thiếu bản ghi nào.`);
    return;
  }
  await Model.insertMany(missing);
  console.log(`[seed-missing] ${label}: đã thêm ${missing.length} bản ghi (${missing.map(d => d[key]).join(', ')}).`);
}

async function run() {
  await connectDB();
  await addMissing(Product, DEV_MOCK_PRODUCTS, 'Product');
  await addMissing(CommunityPost, MOCK_COMMUNITY_POSTS, 'CommunityPost');
  await addMissing(NewsArticle, MOCK_NEWS_ARTICLES, 'NewsArticle');
  await addMissing(Coupon, MOCK_COUPONS, 'Coupon', 'code');
  await mongoose.connection.close();
  console.log('[seed-missing] Hoàn tất.');
}

run().catch(err => {
  console.error('[seed-missing] Lỗi:', err);
  process.exit(1);
});
