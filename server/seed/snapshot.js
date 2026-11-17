// Bản chụp nội dung web (sản phẩm, phòng 3D, tin tức...) để dựng lại DB local khi không vào được Atlas.
//
//   node seed/snapshot.js export    đọc DB đang cấu hình -> seed/snapshot/*.json (chỉ đọc)
//   node seed/snapshot.js restore   xoá các collection nội dung rồi nạp lại từ bản chụp,
//                                   tạo tài khoản admin nếu chưa có. Chỉ chạy trên localhost, trừ khi thêm --force.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');

const { EJSON } = mongoose.mongo.BSON;
const DIR = path.join(__dirname, 'snapshot');
// Collection nội dung — không có email/SĐT/mật khẩu của người dùng.
const CONTENT = ['products', 'rooms', 'newsarticles', 'videos', 'coupons', 'quizquestions', 'adminconfigs'];

async function exportSnapshot() {
  const db = mongoose.connection.db;
  fs.mkdirSync(DIR, { recursive: true });
  const summary = {};
  let text = '';
  for (const name of CONTENT) {
    const docs = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    // Đánh giá của tài khoản thật: bỏ ảnh đại diện (Google / ảnh tải lên), giữ ảnh mẫu Unsplash.
    if (name === 'products') for (const p of docs) for (const r of p.reviews || []) {
      if (r.avatar && !String(r.avatar).includes('images.unsplash.com')) r.avatar = '';
    }
    const json = EJSON.stringify(docs, null, 1, { relaxed: false });
    fs.writeFileSync(path.join(DIR, `${name}.json`), json);
    summary[name] = docs.length;
    text += json;
    console.log(`[snapshot] ${name}: ${docs.length}`);
  }
  // Ảnh tải lên (lưu trong MongoDB): chỉ lấy ảnh mà nội dung ở trên dùng tới.
  const images = (await db.collection('productimages').find({}).sort({ _id: 1 }).toArray())
    .filter(img => text.includes(String(img._id)));
  fs.writeFileSync(path.join(DIR, 'productimages.json'), EJSON.stringify(images, null, 1, { relaxed: false }));
  summary.productimages = images.length;
  console.log(`[snapshot] productimages: ${images.length}`);
  fs.writeFileSync(path.join(DIR, '_info.json'), JSON.stringify({ createdAt: new Date().toISOString(), collections: summary }, null, 2));
  console.log(`[snapshot] Xong -> ${DIR}`);
}

async function restoreSnapshot() {
  const db = mongoose.connection.db;
  const host = mongoose.connection.host;
  if (!/^(localhost|127\.0\.0\.1|mongo)$/.test(host) && !process.argv.includes('--force')) {
    throw new Error(`DB đang trỏ tới ${host}, không phải localhost. restore sẽ xoá nội dung trên DB đó — thêm --force nếu chắc chắn.`);
  }
  const names = [...CONTENT, 'productimages'];
  for (const name of names) {
    const file = path.join(DIR, `${name}.json`);
    if (!fs.existsSync(file)) { console.warn(`[restore] Không có ${name}.json, bỏ qua.`); continue; }
    const docs = EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    console.log(`[restore] ${name}: ${docs.length}`);
  }

  // Tài khoản quản trị gốc — chỉ tạo khi chưa có, không đổi mật khẩu tài khoản đã tồn tại.
  const username = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
  const now = new Date();
  const res = await db.collection('admins').updateOne({ username }, { $setOnInsert: {
    username, password: await bcrypt.hash(password, 10), fullName: 'Quản trị viên Luméa',
    email: '', role: 'Super Admin', active: true, createdAt: now, updatedAt: now, __v: 0,
  } }, { upsert: true });
  console.log(res.upsertedCount ? `[restore] Đã tạo tài khoản quản trị "${username}".` : `[restore] Tài khoản quản trị "${username}" đã có, giữ nguyên.`);
}

const cmd = process.argv[2];
(async () => {
  if (!['export', 'restore'].includes(cmd)) {
    console.log('Cách dùng:\n  node seed/snapshot.js export\n  node seed/snapshot.js restore [--force]');
    process.exitCode = 1;
    return;
  }
  await connectDB();
  try {
    if (cmd === 'export') await exportSnapshot();
    else await restoreSnapshot();
  } finally {
    await mongoose.connection.close();
  }
})().catch(err => {
  console.error('[snapshot] Lỗi:', err.message || err);
  process.exit(1);
});
