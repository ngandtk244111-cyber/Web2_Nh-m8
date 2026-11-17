// Nạp dữ liệu nội dung lưu sẵn trong seed/backup-data/ (sản phẩm, phòng 3D, tin tức...) vào DB local
// khi không vào được Atlas: xoá các collection nội dung rồi nạp lại, tạo tài khoản admin nếu chưa có.
// Chỉ chạy trên localhost, trừ khi thêm --force.   node seed/restore-backup.js [--force]
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');

const { EJSON } = mongoose.mongo.BSON;
const DIR = path.join(__dirname, 'backup-data');
const COLLECTIONS = ['products', 'rooms', 'newsarticles', 'videos', 'coupons', 'quizquestions', 'adminconfigs', 'productimages'];

async function restoreSnapshot() {
  const db = mongoose.connection.db;
  const host = mongoose.connection.host;
  if (!/^(localhost|127\.0\.0\.1|mongo)$/.test(host) && !process.argv.includes('--force')) {
    throw new Error(`DB đang trỏ tới ${host}, không phải localhost. Lệnh này sẽ xoá nội dung trên DB đó — thêm --force nếu chắc chắn.`);
  }
  for (const name of COLLECTIONS) {
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

(async () => {
  await connectDB();
  try {
    await restoreSnapshot();
  } finally {
    await mongoose.connection.close();
  }
})().catch(err => {
  console.error('[restore] Lỗi:', err.message || err);
  process.exit(1);
});
