// Chuyển bài viết sang chuyên mục Luméa Living (gộp Tin tức + Mẹo sống):
//   Xu hướng · Mẹo sống · Phong cách · Phong thủy · Cảm hứng · 3D & Design.
// Bài mẫu (news-1..6) nhận đúng chuyên mục + cờ featured như mock-data; bài khác còn chuyên mục cũ
// được quy đổi theo bảng LEGACY. Chạy lại nhiều lần vẫn an toàn.
// Chạy: node seed/migrate-news-categories.js   (sau đó node seed/seed-missing.js để thêm bài mới)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const NewsArticle = require('../models/NewsArticle');
const { MOCK_NEWS_ARTICLES } = require('./mock-data.generated');

const LEGACY = {
  'Xu hướng Decor': 'Xu hướng',
  'Kiến thức In 3D': '3D & Design',
  'Bộ sưu tập & Room Look': 'Cảm hứng',
  'Kinh nghiệm & Hậu trường': '3D & Design',
};

async function run() {
  await connectDB();

  let updated = 0;
  for (const a of MOCK_NEWS_ARTICLES) {
    const res = await NewsArticle.updateOne(
      { id: a.id, category: { $in: Object.keys(LEGACY) } },
      { $set: { category: a.category, featured: a.featured } }
    );
    updated += res.modifiedCount;
  }

  for (const [from, to] of Object.entries(LEGACY)) {
    const res = await NewsArticle.updateMany({ category: from }, { $set: { category: to } });
    updated += res.modifiedCount;
  }

  console.log(`[migrate-news-categories] Đã cập nhật ${updated} bài viết.`);
  await mongoose.connection.close();
}

run().catch(err => {
  console.error('[migrate-news-categories] Lỗi:', err);
  process.exit(1);
});
