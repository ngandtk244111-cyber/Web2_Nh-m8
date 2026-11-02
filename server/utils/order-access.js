const { adminIdFromRequest, userIdFromRequest, userIdFromToken } = require('../middleware/auth');

// Mã đơn nằm trên tin nhắn, ảnh chụp... nên không đủ làm bằng chứng để xem họ tên, SĐT, địa chỉ:
// phải là nhân viên, chính chủ tài khoản, hoặc nhập đúng SĐT nhận hàng.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function matchesPhone(order, phone) {
  const clean = normalizePhone(phone);
  return !!clean && clean === normalizePhone(order.shippingAddress?.phone);
}

function isOwner(order, userId) {
  return !!userId && !!order.userId && String(order.userId) === String(userId);
}

async function canViewOrder(req, order, phone) {
  if (await adminIdFromRequest(req)) return true;
  return isOwner(order, await userIdFromRequest(req)) || matchesPhone(order, phone);
}

async function canWatchOrder(order, { userToken, phone } = {}) {
  return isOwner(order, await userIdFromToken(userToken)) || matchesPhone(order, phone);
}

// Giới hạn trong bộ nhớ: đủ để chặn dò mã + SĐT trên 1 tiến trình server, không cần thêm thư viện.
function isLocked(key) {
  const entry = failures.get(key);
  if (entry && entry.resetAt <= Date.now()) failures.delete(key);
  return (failures.get(key)?.count || 0) >= MAX_FAILURES;
}

function recordFailure(key) {
  const entry = failures.get(key);
  if (entry) entry.count++;
  else failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
}

function clearExpiredFailures() {
  for (const [key, entry] of failures) {
    if (entry.resetAt <= Date.now()) failures.delete(key);
  }
}
setInterval(clearExpiredFailures, WINDOW_MS).unref();

module.exports = { canViewOrder, canWatchOrder, isLocked, recordFailure };
