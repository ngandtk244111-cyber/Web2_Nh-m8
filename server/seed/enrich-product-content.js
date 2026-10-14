// Bổ sung nội dung trang chi tiết (mô tả nhiều phần, câu chuyện, điểm nổi bật, ảnh không gian, đánh
// giá) cho sản phẩm ĐÃ CÓ trong MongoDB — dữ liệu ở seed/mock/product-content.js.
//
// Chỉ GỘP thêm: mô tả/câu chuyện thay khi bản mới dài hơn, features/images/reviews nối phần chưa có.
// Không xoá ảnh, đánh giá hay điểm nổi bật hiện có. Chạy lại nhiều lần không phát sinh trùng lặp.
// Chạy: npm run seed:product-content   (thêm -- --dry-run để chỉ xem trước)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Product = require('../models/Product');
const { enrichProduct } = require('./mock/product-content');

const DRY_RUN = process.argv.includes('--dry-run');
const FIELDS = ['description', 'story', 'features', 'images', 'reviews', 'rating', 'reviewCount', 'modelUrl'];

async function run() {
  await connectDB();
  const products = await Product.find().lean();
  const rows = [];

  for (const p of products) {
    const next = enrichProduct(p);
    const $set = {};
    for (const f of FIELDS) {
      if (JSON.stringify(next[f]) !== JSON.stringify(p[f])) $set[f] = next[f];
    }
    if (!Object.keys($set).length) continue;

    const err = new Product({ ...p, ...$set }).validateSync();
    if (err) throw new Error(`${p.id}: ${err.message}`);
    if (!DRY_RUN) await Product.updateOne({ _id: p._id }, { $set });

    rows.push({
      id: p.id,
      'mô tả (ký tự)': `${(p.description || '').length} → ${next.description.length}`,
      'câu chuyện': `${(p.story || '').length} → ${next.story.length}`,
      'điểm nổi bật': `${p.features.length} → ${next.features.length}`,
      'ảnh': `${p.images.length} → ${next.images.length}`,
      'đánh giá': `${p.reviews.length} → ${next.reviews.length}`,
    });
  }

  console.log(DRY_RUN ? '[product-content] DRY RUN — không ghi DB.' : '[product-content] Đã cập nhật:');
  if (rows.length) console.table(rows);
  else console.log('Không có sản phẩm nào cần bổ sung (đã đủ nội dung).');
  await mongoose.connection.close();
}

run().catch(async err => {
  console.error('[product-content] Lỗi:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
