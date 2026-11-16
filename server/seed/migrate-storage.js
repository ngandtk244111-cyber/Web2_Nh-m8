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
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const { connectDB } = require('../config/db');
const User = require('../models/User');
const UserAvatar = require('../models/UserAvatar');
const Order = require('../models/Order');
const ProductImage = require('../models/ProductImage');
const CommunityPost = require('../models/CommunityPost');
const UserData = require('../models/UserData');
const CustomRequest = require('../models/CustomRequest');
const ChatMessage = require('../models/ChatMessage');
const NewsComment = require('../models/NewsComment');
const AiConversation = require('../models/AiConversation');
const { saveReviewVideo } = require('../utils/images');
const Product = require('../models/Product');
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
    const id = require('crypto').createHash('sha256').update('avatar:' + user._id + ':' + user.avatar).digest('hex').slice(0, 24);
    await UserAvatar.findOneAndUpdate({ _id: id }, { $setOnInsert: { user: user._id, data: fs.readFileSync(file), contentType } }, { upsert: true });
    await User.updateOne({ _id: user._id, avatar: user.avatar }, { $set: { avatar: '/api/auth/avatars/' + id } });
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

// --community-only: chỉ chuyển ảnh cộng đồng, không thay đổi dữ liệu khác.
async function migrateCommunityImages() {
  const posts = await CommunityPost.find({ imageUrl: /\/uploads\/community\// }, { imageUrl: 1 }).lean();
  let moved = 0, missing = 0;
  for (const post of posts) {
    const pathname = new URL(post.imageUrl, 'http://localhost').pathname;
    const name = pathname.match(/^\/uploads\/community\/([a-zA-Z0-9._-]+)$/)?.[1];
    const file = name && path.join(UPLOADS_ROOT, 'uploads', 'community', name);
    const contentType = file && CONTENT_TYPES[path.extname(file).toLowerCase()];
    if (!file || !fs.existsSync(file) || !IMAGE_TYPES.includes(contentType)) { missing++; continue; }
    moved++;
    if (!APPLY) continue;
    const id = require('crypto').createHash('sha256').update('community:' + name).digest('hex').slice(0, 24);
    await ProductImage.findOneAndUpdate({ _id: id }, { $setOnInsert: { data: fs.readFileSync(file), contentType } }, { upsert: true });
    await CommunityPost.updateOne({ _id: post._id, imageUrl: post.imageUrl }, { $set: { imageUrl: '/api/products/images/' + id } });
  }
  console.log(`Cộng đồng: ${moved} ảnh ${APPLY ? 'đã chuyển' : 'cần chuyển'} sang MongoDB, ${missing} ảnh thiếu file (giữ nguyên đường dẫn cũ).`);
}

async function migrateReviewMedia() {
  const products = await Product.find({ $or: [{ 'reviews.images': /\/uploads\/reviews\// }, { 'reviews.video': /\/uploads\/reviews\// }] }).select('reviews').lean();
  let moved = 0, missing = 0;
  const convert = async (url, owner) => {
    if (!url || !url.includes('/uploads/reviews/')) return url;
    const name = new URL(url, 'http://localhost').pathname.match(/^\/uploads\/reviews\/([a-zA-Z0-9._-]+)$/)?.[1];
    const file = name && path.join(UPLOADS_ROOT, 'uploads', 'reviews', name);
    const type = file && (CONTENT_TYPES[path.extname(file).toLowerCase()] || (file.endsWith('.mp4') ? 'video/mp4' : null));
    if (!file || !type || !fs.existsSync(file)) { missing++; return url; }
    moved++;
    if (!APPLY) return url;
    const id = require('crypto').createHash('sha256').update('review:' + name).digest('hex').slice(0, 24);
    if (type === 'video/mp4') {
      if (!await mongoose.connection.db.collection('reviewVideos.files').findOne({ _id: new mongoose.Types.ObjectId(id) })) await saveReviewVideo(fs.readFileSync(file), owner, id);
      return '/api/products/review-videos/' + id;
    }
    await ProductImage.findOneAndUpdate({ _id: id }, { $setOnInsert: { data: fs.readFileSync(file), contentType: type, uploadedBy: owner } }, { upsert: true });
    return '/api/products/images/' + id;
  };
  for (const product of products) for (const review of product.reviews || []) {
    const images = await Promise.all((review.images || []).map(url => convert(url, review.userId || null)));
    const video = await convert(review.video, review.userId || null);
    const update = {};
    if (JSON.stringify(images) !== JSON.stringify(review.images || [])) update['reviews.$.images'] = images;
    if (video !== review.video) update['reviews.$.video'] = video;
    if (APPLY && Object.keys(update).length) await Product.updateOne({ _id: product._id, reviews: { $elemMatch: { id: review.id, images: review.images || [] } } }, { $set: update });
  }
  console.log(`Đánh giá: ${moved} file ${APPLY ? 'đã chuyển' : 'cần chuyển'}, ${missing} file thiếu giữ nguyên.`);
}

async function migrateOwnedChats() {
  const sessions = await ChatMessage.aggregate([
    { $match: { sender: 'customer' } },
    { $group: { _id: '$sessionId', owners: { $addToSet: '$userId' } } },
  ]);
  let moved = 0, ambiguous = 0;
  for (const session of sessions) {
    if (session.owners.length !== 1 || !session.owners[0] || !mongoose.isValidObjectId(session.owners[0]) || !await User.exists({ _id: session.owners[0] })) { ambiguous++; continue; }
    const sessionId = 'user-' + session.owners[0];
    if (sessionId === session._id) continue;
    moved++;
    if (APPLY) await ChatMessage.updateMany({ sessionId: session._id }, { $set: { sessionId } });
  }
  console.log(`Chat: ${moved} phiên ${APPLY ? 'đã gắn' : 'cần gắn'} theo tài khoản, ${ambiguous} phiên chưa rõ chủ giữ nguyên.`);
}

async function optimizeCollections() {
  await migrateOwnedChats();
  await stripOrderReviews();
  for (const model of [CommunityPost, CustomRequest, ChatMessage, NewsComment, AiConversation, UserData]) {
    if (APPLY) await model.createIndexes();
    console.log('Chỉ mục truy vấn: ' + model.collection.name + (APPLY ? ' đã kiểm tra/tạo bổ sung' : ' sẽ bổ sung'));
  }
}

async function main() {
  await connectDB();
  console.log(APPLY ? 'Chế độ GHI THẬT' : 'Chế độ xem trước (thêm --apply để ghi)');
  await migrateCommunityImages();
  if (process.argv.includes('--community-only')) return;
  await migrateAvatars();
  await migrateReviewMedia();
  if (process.argv.includes('--optimize')) { await optimizeCollections(); return; }
  if (process.argv.includes('--all-media')) return;
  await stripOrderReviews();
  await removeOrphanImages();
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
