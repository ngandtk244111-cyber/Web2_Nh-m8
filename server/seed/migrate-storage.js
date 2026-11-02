// Chuyển dữ liệu cũ về đúng chỗ lưu trên MongoDB. Mặc định chỉ báo cáo, không ghi gì.
//   npm run migrate:storage             xem trước
//   npm run migrate:storage -- --apply  ghi thật
// Chạy lại nhiều lần vẫn an toàn: phần đã chuyển sẽ được bỏ qua.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
// Xem trước phải thật sự chỉ đọc: tắt việc mongoose tự tạo index khi nạp model.
mongoose.set('autoIndex', APPLY);

const { connectDB } = require('../config/db');
const User = require('../models/User');
const UserAvatar = require('../models/UserAvatar');
const Order = require('../models/Order');
const ProductImage = require('../models/ProductImage');
const { IMAGE_TYPES, isProductImageUsed } = require('../utils/images');

const ORPHAN_IMAGE_AGE_MS = 24 * 60 * 60 * 1000;
const UPLOADS_ROOT = path.join(__dirname, '..');
const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

async function migrateAvatars() {
  const users = await User.find({ avatar: /^\/uploads\/avatars\// }, { avatar: 1 }).lean();
  let moved = 0;
  let missing = 0;
  for (const user of users) {
    const file = path.join(UPLOADS_ROOT, path.normalize(user.avatar));
    const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
    if (!fs.existsSync(file) || !IMAGE_TYPES.includes(contentType)) {
      missing++;
      console.warn(`  Bỏ qua ${user._id}: không đọc được ${user.avatar}`);
      continue;
    }
    moved++;
    if (!APPLY) continue;
    const avatar = await UserAvatar.create({ user: user._id, data: fs.readFileSync(file), contentType });
    await User.updateOne({ _id: user._id }, { avatar: `/api/auth/avatars/${avatar._id}` });
  }
  console.log(`Avatar: ${moved} ảnh cần chuyển sang MongoDB, ${missing} ảnh không có file.`);
}

async function stripOrderReviews() {
  const filter = { 'items.product.reviews': { $exists: true } };
  const count = await Order.countDocuments(filter);
  if (APPLY && count) await Order.updateMany(filter, { $unset: { 'items.$[].product.reviews': 1 } });
  console.log(`Đơn hàng: ${count} đơn có bản sao đánh giá cần bỏ.`);
}

// Ảnh tải lên rồi huỷ form: không gắn với sản phẩm nào. Chừa 24 giờ cho form đang mở dở.
async function removeOrphanImages() {
  const images = await ProductImage.find({ createdAt: { $lt: new Date(Date.now() - ORPHAN_IMAGE_AGE_MS) } }, { _id: 1 }).lean();
  let orphans = 0;
  for (const { _id } of images) {
    if (await isProductImageUsed(_id)) continue;
    orphans++;
    if (APPLY) await ProductImage.deleteOne({ _id });
  }
  console.log(`Ảnh sản phẩm: ${orphans} ảnh không còn nơi dùng.`);
}

async function main() {
  await connectDB();
  console.log(APPLY ? 'Chế độ GHI THẬT' : 'Chế độ xem trước (thêm --apply để ghi)');
  await migrateAvatars();
  await stripOrderReviews();
  await removeOrphanImages();
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
