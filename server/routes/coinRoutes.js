const express = require('express');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { requireUserId } = require('../middleware/auth');
const { awardCoins } = require('../utils/coins');

const router = express.Router();

// Server-controlled reward amounts — never trust an amount sent by the client.
const REWARD_RULES = {
  STYLE_QUIZ: { amount: 30, note: 'Hoàn thành Trắc Nghiệm Phong Cách Decor' },
};

const BIRTHDAY_REWARD_AMOUNT = 50;

/** dateOfBirth lưu dạng chuỗi "YYYY-MM-DD" (input type=date) — so khớp đúng ngày/tháng hôm nay. */
async function checkAndAwardBirthday(user) {
  if (!user.dateOfBirth) return null;
  const dob = new Date(user.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  if (dob.getUTCDate() !== today.getUTCDate() || dob.getUTCMonth() !== today.getUTCMonth()) return null;

  const year = today.getUTCFullYear();
  return awardCoins({
    userId: user._id,
    reason: 'BIRTHDAY',
    refId: `birthday-${year}`,
    amount: BIRTHDAY_REWARD_AMOUNT,
    note: 'Chúc mừng sinh nhật từ Luméa! 🎂',
  });
}

router.get('/me', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    const birthdayReward = await checkAndAwardBirthday(user);
    if (birthdayReward) user.coins = birthdayReward.coins;

    const transactions = await CoinTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({
      success: true,
      coins: user.coins,
      transactions,
      ...(birthdayReward ? { birthdayReward: { amount: birthdayReward.amount } } : {}),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/claim', requireUserId, async (req, res) => {
  try {
    const { reason, refId } = req.body;
    const rule = REWARD_RULES[reason];
    if (!rule) {
      return res.status(400).json({ success: false, error: 'Lý do thưởng xu không hợp lệ' });
    }
    if (!refId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã tham chiếu (refId)' });
    }

    let transaction;
    try {
      transaction = await CoinTransaction.create({
        user: req.userId,
        amount: rule.amount,
        reason,
        refId: String(refId),
        note: rule.note,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Already claimed for this (user, reason, refId) — idempotent, not an error.
        const user = await User.findById(req.userId);
        return res.json({ success: true, alreadyApplied: true, coins: user.coins, amount: rule.amount });
      }
      throw err;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { coins: transaction.amount } },
      { new: true }
    );

    res.json({ success: true, alreadyApplied: false, coins: user.coins, amount: transaction.amount });
  } catch (err) {
    console.error('coin claim error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
