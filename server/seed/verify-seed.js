// Kiểm tra dữ liệu trong MongoDB sau khi seed (chỉ đọc, không ghi):
//  - số bản ghi từng collection
//  - mọi document hợp lệ theo schema mongoose (trường bắt buộc, enum...)
//  - tham chiếu chéo: userId, productId, orderNumber, articleId, parentId, staff/admin id
//  - Xu của user mẫu = tổng CoinTransaction; không trùng khóa unique
// Chạy: npm run seed:verify
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { USERS } = require('./mock/accounts');

const names = ['User', 'Admin', 'Product', 'Room', 'Coupon', 'NewsArticle', 'Video', 'Order', 'Warranty', 'CoinTransaction',
  'CustomRequest', 'CommunityPost', 'NewsComment', 'NewsletterSubscriber', 'Notification', 'ChatMessage', 'AiConversation', 'OtpCode'];
const M = Object.fromEntries(names.map(n => [n, require(`../models/${n}`)]));

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

async function run() {
  await connectDB();

  const counts = {};
  for (const n of names) counts[n] = await M[n].countDocuments();
  console.table(counts);

  // 1. Validate theo schema.
  for (const n of names) {
    const docs = await M[n].find().lean();
    for (const d of docs) {
      const err = new M[n](d).validateSync();
      check(!err, `${n} ${d._id}: ${err && Object.values(err.errors).map(e => e.message).join('; ')}`);
    }
  }

  const ids = async (n, field = '_id') => new Set((await M[n].find({}, { [field]: 1 }).lean()).map(d => String(d[field])));
  const userIds = await ids('User');
  const adminIds = await ids('Admin');
  const productIds = await ids('Product', 'id');
  const orderNumbers = await ids('Order', 'orderNumber');
  const articleIds = await ids('NewsArticle', 'id');
  const commentIds = await ids('NewsComment', 'id');

  // 2. Tham chiếu.
  for (const o of await M.Order.find().lean()) {
    check(!o.userId || userIds.has(String(o.userId)), `Order ${o.orderNumber}: userId ${o.userId} không tồn tại`);
    for (const i of o.items) check(productIds.has(i.product?.id), `Order ${o.orderNumber}: sản phẩm ${i.product?.id} không tồn tại`);
    const sub = o.items.reduce((s, i) => s + i.totalPrice, 0);
    check(sub === o.subtotal && o.total === Math.max(0, o.subtotal - o.discount + o.shippingFee), `Order ${o.orderNumber}: tổng tiền lệch`);
    for (const f of ['phoneConfirmedBy', 'paidConfirmedBy']) check(!o[f] || adminIds.has(o[f]) || !/^[0-9a-f]{24}$/.test(o[f]), `Order ${o.orderNumber}: ${f} không phải admin`);
    if (['SHIPPED', 'DELIVERED', 'RETURNED'].includes(o.status)) check(!!o.shipment, `Order ${o.orderNumber}: ${o.status} nhưng thiếu vận đơn`);
  }
  for (const w of await M.Warranty.find().lean()) check(orderNumbers.has(w.orderNumber), `Warranty ${w.warrantyCode}: không có đơn ${w.orderNumber}`);
  for (const t of await M.CoinTransaction.find().lean()) check(userIds.has(String(t.user)), `CoinTransaction ${t._id}: user ${t.user} không tồn tại`);
  for (const c of await M.NewsComment.find().lean()) {
    check(articleIds.has(c.articleId), `NewsComment ${c.id}: bài ${c.articleId} không tồn tại`);
    check(!c.parentId || commentIds.has(c.parentId), `NewsComment ${c.id}: ý kiến gốc ${c.parentId} không tồn tại`);
    check(!c.userId || userIds.has(String(c.userId)), `NewsComment ${c.id}: user không tồn tại`);
  }
  for (const p of await M.CommunityPost.find().lean()) {
    check(!p.userId || userIds.has(String(p.userId)), `CommunityPost ${p.id}: user không tồn tại`);
    for (const t of p.productTags || []) check(productIds.has(t.productId), `CommunityPost ${p.id}: sản phẩm ${t.productId} không tồn tại`);
  }
  for (const a of await M.AiConversation.find().lean()) check(userIds.has(String(a.userId)), `AiConversation ${a.id}: user không tồn tại`);
  for (const n of await M.Notification.find({ userId: { $ne: null } }).lean()) check(userIds.has(n.userId), `Notification ${n._id}: user ${n.userId} không tồn tại`);
  for (const m of await M.ChatMessage.find().lean()) {
    check(!m.userId || userIds.has(m.userId), `ChatMessage ${m._id}: user không tồn tại`);
    check(!m.staffId || adminIds.has(m.staffId), `ChatMessage ${m._id}: staff không tồn tại`);
  }
  for (const s of await M.NewsletterSubscriber.find({ userId: { $ne: null } }).lean()) check(userIds.has(String(s.userId)), `Newsletter ${s.email}: user không tồn tại`);

  // 3. Xu của user mẫu = tổng giao dịch.
  const sums = await M.CoinTransaction.aggregate([{ $group: { _id: '$user', total: { $sum: '$amount' } } }]);
  const sumBy = new Map(sums.map(s => [String(s._id), s.total]));
  for (const u of await M.User.find({ _id: { $in: USERS.map(x => x._id) } }).lean()) {
    check((sumBy.get(String(u._id)) || 0) === u.coins, `User ${u.fullName}: coins=${u.coins} ≠ tổng giao dịch ${sumBy.get(String(u._id)) || 0}`);
  }

  // 4. Không trùng khóa unique (kể cả nơi DB thiếu index).
  const uniques = [['User', 'phoneNumber'], ['Admin', 'username'], ['Product', 'slug'], ['Order', 'orderNumber'], ['Coupon', 'code'],
    ['CustomRequest', 'requestCode'], ['Warranty', 'warrantyCode'], ['NewsArticle', 'slug'], ['Video', 'id'], ['NewsletterSubscriber', 'email']];
  for (const [n, f] of uniques) {
    const dup = await M[n].aggregate([{ $match: { [f]: { $type: 'string' } } }, { $group: { _id: `$${f}`, c: { $sum: 1 } } }, { $match: { c: { $gt: 1 } } }]);
    check(dup.length === 0, `${n}.${f} bị trùng: ${dup.map(d => d._id).join(', ')}`);
  }

  if (problems.length) {
    console.error(`\n[verify-seed] ${problems.length} vấn đề:`);
    problems.forEach(p => console.error('  -', p));
    process.exitCode = 1;
  } else {
    console.log('\n[verify-seed] OK — schema, tham chiếu, số Xu và khóa unique đều hợp lệ.');
  }
  await mongoose.connection.close();
}

run().catch(async err => {
  console.error('[verify-seed] Lỗi:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
