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

module.exports = { awardCoins };
