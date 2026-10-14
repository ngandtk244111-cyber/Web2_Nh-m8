// Tiện ích dùng chung cho dữ liệu mẫu: ObjectId cố định theo khóa (chạy seed bao nhiêu lần cũng ra
// đúng _id đó, nên tham chiếu chéo giữa các collection luôn khớp) và mốc thời gian cố định.
const crypto = require('crypto');
const { Types } = require('mongoose');

/** ObjectId xác định từ một chuỗi khóa, ví dụ oid('user:thaomy'). */
function oid(key) {
  return new Types.ObjectId(crypto.createHash('md5').update(`lumea-seed:${key}`).digest('hex').slice(0, 24));
}

// Mốc "hiện tại" của bộ dữ liệu mẫu (giờ Việt Nam). Mọi ngày tháng tính lùi từ đây để dữ liệu
// không đổi giữa các lần chạy.
const SEED_NOW = new Date('2026-10-08T10:00:00+07:00');

/** Thời điểm cách SEED_NOW `days` ngày, vào lúc hh:mm giờ Việt Nam. */
function daysAgo(days, hh = 10, mm = 0) {
  const d = new Date(SEED_NOW.getTime() - days * 24 * 3600 * 1000);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  vn.setUTCHours(hh, mm, 0, 0);
  return new Date(vn.getTime() - 7 * 3600 * 1000);
}

/** Nhãn ngày giờ kiểu "19/9/2026 03:45" — giống nowLabel() ở orderRoutes.js. */
function viLabel(date) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${vn.getUTCDate()}/${vn.getUTCMonth() + 1}/${vn.getUTCFullYear()} ${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`;
}

/** Nhãn "15/09/2026 10:30" (có số 0 đầu) — định dạng của yêu cầu thiết kế. */
function viLabelPadded(date) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`;
}

/** "2026-10-07" theo giờ Việt Nam — khớp vnDateKey() ở coinRoutes.js. */
function vnDateKey(date) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

const img = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

module.exports = { oid, SEED_NOW, daysAgo, viLabel, viLabelPadded, vnDateKey, img };
