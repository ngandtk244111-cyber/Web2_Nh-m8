// Nạp TOÀN BỘ dữ liệu mẫu (thư mục seed/mock/) vào MongoDB đang cấu hình trong server/.env.
//
// An toàn khi chạy lại nhiều lần: mỗi bản ghi được upsert theo khóa tự nhiên với $setOnInsert —
// bản ghi đã tồn tại (kể cả dữ liệu thật đã bị sửa) được GIỮ NGUYÊN, chỉ thêm bản ghi còn thiếu.
// Không xoá, không drop collection, không ghi đè.
//
// Chạy:  npm run seed:all            (ghi vào DB)
//        npm run seed:all -- --dry-run  (chỉ dựng + validate theo schema, không ghi)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { buildAll } = require('./mock/build');

const MODELS = {
  User: require('../models/User'),
  Admin: require('../models/Admin'),
  Product: require('../models/Product'),
  Room: require('../models/Room'),
  Coupon: require('../models/Coupon'),
  NewsArticle: require('../models/NewsArticle'),
  Video: require('../models/Video'),
  Order: require('../models/Order'),
  Warranty: require('../models/Warranty'),
  CoinTransaction: require('../models/CoinTransaction'),
  CustomRequest: require('../models/CustomRequest'),
  CommunityPost: require('../models/CommunityPost'),
  NewsComment: require('../models/NewsComment'),
  NewsletterSubscriber: require('../models/NewsletterSubscriber'),
  Notification: require('../models/Notification'),
  ChatMessage: require('../models/ChatMessage'),
  AiConversation: require('../models/AiConversation'),
};

const DRY_RUN = process.argv.includes('--dry-run');

/** Validate theo schema mongoose rồi trả về object đã cast + default, sẵn sàng ghi bằng driver. */
function prepare(Model, raw, label, index, omitNull = []) {
  const doc = new Model(raw);
  const err = doc.validateSync();
  if (err) {
    const details = Object.values(err.errors).map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`${label}[${index}] không hợp lệ — ${details}`);
  }
  const obj = doc.toObject({ depopulate: true, virtuals: false, versionKey: false });
  // Schema có timestamps mà dữ liệu không ghi sẵn thì đặt theo thời điểm seed.
  if (Model.schema.options.timestamps) {
    const now = new Date();
    if (!obj.createdAt) obj.createdAt = now;
    if (!obj.updatedAt) obj.updatedAt = obj.createdAt;
  }
  for (const f of omitNull) if (obj[f] === null) delete obj[f];
  obj.__v = 0;
  return obj;
}

async function seedCollection(Model, { model: label, key, docs, omitNull }) {
  const prepared = docs.map((raw, i) => prepare(Model, raw, label, i, omitNull));

  const seen = new Set();
  for (const obj of prepared) {
    const k = key.map(f => String(obj[f])).join('|');
    if (seen.has(k)) throw new Error(`${label}: trùng khóa ${key.join('+')} = ${k} trong dữ liệu mẫu`);
    seen.add(k);
  }

  if (DRY_RUN) return { label, total: prepared.length, inserted: 0, existing: 0, errors: [] };

  const ops = prepared.map(obj => ({
    updateOne: {
      filter: Object.fromEntries(key.map(f => [f, obj[f]])),
      update: { $setOnInsert: obj },
      upsert: true,
    },
  }));

  let result;
  const errors = [];
  try {
    result = await Model.collection.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Lỗi từng bản ghi (vd trùng unique index với dữ liệu thật) — các bản ghi khác vẫn được ghi.
    if (!err.writeErrors && !err.result) throw err;
    result = err.result;
    for (const we of [].concat(err.writeErrors || [])) {
      const op = ops[we.index]?.updateOne.filter;
      errors.push(`${JSON.stringify(op)} → ${we.errmsg || we.err?.errmsg || we.message}`);
    }
  }

  const inserted = result.upsertedCount ?? result.nUpserted ?? 0;
  const existing = result.matchedCount ?? result.nMatched ?? 0;
  return { label, total: prepared.length, inserted, existing, errors };
}

async function run() {
  const plan = await buildAll();
  if (!DRY_RUN) await connectDB();

  const report = [];
  for (const entry of plan) {
    const Model = MODELS[entry.model];
    if (!DRY_RUN) {
      // Tạo unique index còn thiếu trước khi ghi. Index đã có nhưng khác định nghĩa trong schema (vd
      // users.phoneNumber_1 không sparse) thì chỉ cảnh báo — seed không sửa/xoá index của DB.
      await Model.init().catch(err => console.warn(`[seed-all] ${entry.model}: index trong DB khác schema — ${err.message.split('.')[0]}.`));
    }
    report.push(await seedCollection(Model, entry));
  }

  console.log(DRY_RUN ? '\n[seed-all] DRY RUN — đã validate, không ghi DB.' : '\n[seed-all] Kết quả:');
  console.table(report.map(r => ({ collection: r.label, 'mẫu': r.total, 'thêm mới': r.inserted, 'đã có (giữ nguyên)': r.existing, 'lỗi': r.errors.length })));

  const failed = report.filter(r => r.errors.length);
  for (const r of failed) {
    console.error(`[seed-all] ${r.label}: ${r.errors.length} bản ghi không ghi được:`);
    r.errors.forEach(e => console.error('   -', e));
  }

  if (!DRY_RUN) await mongoose.connection.close();
  if (failed.length) process.exitCode = 1;
}

run().catch(async err => {
  console.error('[seed-all] Lỗi:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
