const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');

/**
 * Cộng xu cho user, dùng chung cho mọi hoạt động (server tự quyết định amount, không tin client).
 * Idempotent theo (user, reason, refId) nhờ unique index ở CoinTransaction — gọi lại nhiều lần
 * với cùng bộ 3 giá trị sẽ không cộng thêm lần thứ hai (trả về null, không phải lỗi).
 */
async function awardCoins({ userId, reason, refId, amount, note }) {
  if (!userId || !reason || !refId || !amount || amount <= 0) return null;
  try {
    await CoinTransaction.create({ user: userId, amount, reason, refId: String(refId), note: note || '' });
  } catch (err) {
    if (err.code === 11000) return null; // đã cộng cho (user, reason, refId) này rồi
    throw err;
  }
  const user = await User.findByIdAndUpdate(userId, { $inc: { coins: amount } }, { new: true });
  return { amount, coins: user ? user.coins : null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const { COIN_TTL_DAYS } = CoinTransaction;
/** Báo trước cho người dùng khi xu sẽ hết hạn trong khoảng này. */
const EXPIRING_SOON_DAYS = 30;

/** Hạn của một giao dịch cộng xu — giao dịch cũ chưa lưu expiresAt thì tính theo ngày tạo. */
function expiryOf(tx) {
  if (tx.expiresAt) return new Date(tx.expiresAt);
  return new Date(new Date(tx.createdAt).getTime() + COIN_TTL_DAYS * DAY_MS);
}

/**
 * Trừ các khoản xu đã quá hạn khỏi số dư. Mỗi khoản hết hạn sinh đúng 1 giao dịch âm
 * (reason COIN_EXPIRED, refId = id khoản gốc) nên gọi lại nhiều lần cũng không trừ trùng.
 * Lưu ý: hiện server chưa có luồng tiêu xu, nên toàn bộ khoản đã nhận vẫn còn nguyên trong số dư;
 * khi thêm luồng tiêu xu cần trừ theo thứ tự hết hạn trước (FIFO) trước khi tính phần hết hạn.
 */
async function expireCoins(userId) {
  const now = new Date();
  const earned = await CoinTransaction.find({ user: userId, amount: { $gt: 0 } }).lean();
  const expiredIds = new Set(
    (await CoinTransaction.find({ user: userId, reason: 'COIN_EXPIRED' }).select('refId').lean()).map(t => t.refId)
  );

  let total = 0;
  for (const tx of earned) {
    if (expiryOf(tx) > now || expiredIds.has(String(tx._id))) continue;
    try {
      await CoinTransaction.create({
        user: userId,
        amount: -tx.amount,
        reason: 'COIN_EXPIRED',
        refId: String(tx._id),
        note: `Xu hết hạn (${tx.note || 'nhận ngày ' + new Date(tx.createdAt).toLocaleDateString('vi-VN')})`,
      });
      total += tx.amount;
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000: request khác vừa xử lý khoản này
    }
  }
  if (total <= 0) return 0;

  const user = await User.findById(userId);
  if (user) {
    user.coins = Math.max(0, (user.coins || 0) - total);
    await user.save();
  }
  return total;
}

/** Tổng xu sắp hết hạn trong EXPIRING_SOON_DAYS ngày tới + mốc hết hạn gần nhất. */
async function expiringSoon(userId) {
  const now = Date.now();
  const limit = now + EXPIRING_SOON_DAYS * DAY_MS;
  const earned = await CoinTransaction.find({ user: userId, amount: { $gt: 0 } }).lean();
  const expiredIds = new Set(
    (await CoinTransaction.find({ user: userId, reason: 'COIN_EXPIRED' }).select('refId').lean()).map(t => t.refId)
  );

  let amount = 0;
  let nearest = null;
  for (const tx of earned) {
    if (expiredIds.has(String(tx._id))) continue;
    const exp = expiryOf(tx).getTime();
    if (exp <= now || exp > limit) continue;
    amount += tx.amount;
    if (nearest === null || exp < nearest) nearest = exp;
  }
  return amount > 0 ? { amount, date: new Date(nearest).toISOString() } : null;
}

module.exports = { awardCoins, expireCoins, expiringSoon, expiryOf, COIN_TTL_DAYS };
