// Sao lưu / khôi phục MongoDB đang cấu hình trong server/.env (MONGODB_URI).
// Mỗi collection ghi ra 1 file <tên>.json dạng Extended JSON (giữ đúng ObjectId, Date...).
//
//   node seed/backup-db.js backup  "<thư mục lưu>"                         sao lưu TẤT CẢ collection
//   node seed/backup-db.js restore "<thư mục backup>" products              khôi phục 1 / vài collection
//   node seed/backup-db.js restore "<thư mục backup>" --all                 khôi phục toàn bộ
//
// Khôi phục = xoá sạch collection đó rồi ghi lại đúng dữ liệu trong file backup.
// Lưu ý: file backup có dữ liệu người dùng (email, mật khẩu đã băm...) — KHÔNG commit vào git.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const { EJSON } = mongoose.mongo.BSON;

async function backup(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const db = mongoose.connection.db;
  const cols = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name).sort();
  const summary = {};
  for (const name of cols) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, null, 2, { relaxed: false }));
    summary[name] = docs.length;
    console.log(`[backup] ${name}: ${docs.length}`);
  }
  fs.writeFileSync(path.join(dir, '_info.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    database: db.databaseName,
    host: mongoose.connection.host,
    collections: summary,
  }, null, 2));
  console.log(`[backup] Xong ${cols.length} collection -> ${dir}`);
}

async function restore(dir, names) {
  const db = mongoose.connection.db;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  const targets = names.includes('--all') ? files.map(f => f.replace(/\.json$/, '')) : names;
  if (!targets.length) throw new Error('Chưa chọn collection: thêm tên collection (vd products) hoặc --all.');
  for (const name of targets) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`Không có file ${file}`);
    const docs = EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    console.log(`[restore] ${name}: ${docs.length}`);
  }
}

const [cmd, dir, ...rest] = process.argv.slice(2);
(async () => {
  if (!['backup', 'restore'].includes(cmd) || !dir) {
    console.log('Cách dùng:\n  node seed/backup-db.js backup "<thư mục>"\n  node seed/backup-db.js restore "<thư mục>" <collection...> | --all');
    process.exitCode = 1;
    return;
  }
  await connectDB();
  try {
    if (cmd === 'backup') await backup(path.resolve(dir));
    else await restore(path.resolve(dir), rest);
  } finally {
    await mongoose.connection.close();
  }
})().catch(err => {
  console.error('[backup-db] Lỗi:', err.message || err);
  process.exit(1);
});
