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

// ===================== Trang "Ưu đãi Luméa Xu": điểm danh, trò chơi, lướt nhận xu =====================
// Mọi mức thưởng + giới hạn lượt/ngày đều do server quyết định. Ngày tính theo giờ Việt Nam (UTC+7)
// và được nhúng vào refId, nên unique index (user, reason, refId) chặn nhận trùng kể cả khi gọi song song.

const CHECKIN_SCHEDULE = [100, 100, 100, 100, 100, 100, 300]; // ngày 1 → ngày 7 của chuỗi
const BROWSE_REWARD = 100;

// Trò chơi may rủi: server bốc thưởng theo trọng số — client chỉ diễn hoạt ảnh tới ô server trả về.
const WHEEL_PRIZES = [
  { amount: 10, weight: 26 },
  { amount: 50, weight: 12 },
  { amount: 20, weight: 22 },
  { amount: 200, weight: 2 },
  { amount: 10, weight: 20 },
  { amount: 100, weight: 5 },
  { amount: 30, weight: 12 },
  { amount: 20, weight: 1 },
];
const GIFT_BOX_PRIZES = [
  { amount: 10, weight: 30 },
  { amount: 20, weight: 28 },
  { amount: 50, weight: 22 },
  { amount: 80, weight: 12 },
  { amount: 150, weight: 8 },
];

const GAMES = {
  WHEEL: { reason: 'GAME_WHEEL', dailyLimit: 3, note: 'Vòng Quay May Mắn' },
  GIFT_BOX: { reason: 'GAME_GIFT_BOX', dailyLimit: 1, note: 'Hộp Quà Bí Ẩn' },
  MEMORY: { reason: 'GAME_MEMORY', dailyLimit: 3, note: 'Lật Thẻ Decor' },
};

// Lật Thẻ Decor: 8 cặp thẻ — ít nhất 8 lượt lật mới ghép xong, nên kết quả dưới mức đó là bất khả thi.
const MEMORY_PAIRS = 8;
const MEMORY_MIN_SECONDS = 8;

function vnDateKey(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftDateKey(key, days) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pickWeighted(prizes) {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    roll -= prizes[i].weight;
    if (roll < 0) return i;
  }
  return prizes.length - 1;
}

/** Đếm số ngày điểm danh liên tiếp, lùi dần từ ngày `fromKey`. */
function countStreak(dateKeys, fromKey) {
  let streak = 0;
  let cursor = fromKey;
  while (dateKeys.has(cursor)) {
    streak++;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

async function getCheckinState(userId) {
  const today = vnDateKey();
  const recent = await CoinTransaction.find({ user: userId, reason: 'DAILY_CHECKIN' })
    .sort({ createdAt: -1 })
    .limit(14)
    .select('refId');
  const keys = new Set(recent.map(t => t.refId));
  const claimedToday = keys.has(today);

  // Ngày (1..7) sẽ nhận hôm nay nếu chưa điểm danh; nếu đã điểm danh thì là ngày vừa nhận.
  // Đủ 7 ngày thì chuỗi quay lại ngày 1; bỏ lỡ 1 ngày thì chuỗi cũng về ngày 1.
  const streakDay = claimedToday
    ? ((countStreak(keys, today) - 1) % 7) + 1
    : (countStreak(keys, shiftDateKey(today, -1)) % 7) + 1;

  return { today, claimedToday, streakDay, schedule: CHECKIN_SCHEDULE };
}

function countPlaysToday(userId, reason, today) {
  return CoinTransaction.countDocuments({ user: userId, reason, refId: { $regex: `^${today}#` } });
}

async function getRewardsState(userId) {
  const checkin = await getCheckinState(userId);
  const games = {};
  for (const [key, game] of Object.entries(GAMES)) {
    const played = await countPlaysToday(userId, game.reason, checkin.today);
    games[key] = { dailyLimit: game.dailyLimit, playsLeft: Math.max(0, game.dailyLimit - played) };
  }
  const browseClaimed = await CoinTransaction.exists({ user: userId, reason: 'BROWSE_FEED', refId: checkin.today });
  return {
    checkin,
    games,
    browse: { amount: BROWSE_REWARD, claimedToday: !!browseClaimed },
    prizes: {
      WHEEL: WHEEL_PRIZES.map(p => p.amount),
      GIFT_BOX: GIFT_BOX_PRIZES.map(p => p.amount),
    },
  };
}

router.get('/rewards', requireUserId, async (req, res) => {
  try {
    res.json({ success: true, ...(await getRewardsState(req.userId)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/checkin', requireUserId, async (req, res) => {
  try {
    const state = await getCheckinState(req.userId);
    const alreadyMsg = 'Hôm nay bạn đã điểm danh rồi, quay lại vào ngày mai nhé!';
    if (state.claimedToday) {
      return res.status(409).json({ success: false, error: alreadyMsg });
    }
    const amount = CHECKIN_SCHEDULE[state.streakDay - 1];
    const result = await awardCoins({
      userId: req.userId,
      reason: 'DAILY_CHECKIN',
      refId: state.today,
      amount,
      note: `Điểm danh ngày ${state.streakDay}/7`,
    });
    if (!result) {
      return res.status(409).json({ success: false, error: alreadyMsg });
    }
    res.json({ success: true, amount, coins: result.coins, streakDay: state.streakDay });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/browse', requireUserId, async (req, res) => {
  try {
    const result = await awardCoins({
      userId: req.userId,
      reason: 'BROWSE_FEED',
      refId: vnDateKey(),
      amount: BROWSE_REWARD,
      note: 'Lướt gợi ý sản phẩm',
    });
    if (!result) {
      return res.status(409).json({ success: false, error: 'Hôm nay bạn đã nhận xu lướt gợi ý rồi.' });
    }
    res.json({ success: true, amount: BROWSE_REWARD, coins: result.coins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/games/:game/play', requireUserId, async (req, res) => {
  try {
    const key = String(req.params.game || '').toUpperCase();
    const game = GAMES[key];
    if (!game) return res.status(400).json({ success: false, error: 'Trò chơi không tồn tại' });

    const today = vnDateKey();
    const played = await countPlaysToday(req.userId, game.reason, today);
    if (played >= game.dailyLimit) {
      return res.status(429).json({ success: false, error: 'Bạn đã hết lượt chơi hôm nay, quay lại vào ngày mai nhé!' });
    }

    let amount;
    const extra = {};
    if (key === 'WHEEL') {
      const index = pickWeighted(WHEEL_PRIZES);
      amount = WHEEL_PRIZES[index].amount;
      extra.prizeIndex = index;
    } else if (key === 'GIFT_BOX') {
      amount = GIFT_BOX_PRIZES[pickWeighted(GIFT_BOX_PRIZES)].amount;
      // Hé lộ 2 hộp còn lại cho vui — chỉ để hiển thị, không ảnh hưởng phần thưởng.
      extra.otherBoxes = [0, 1].map(() => GIFT_BOX_PRIZES[pickWeighted(GIFT_BOX_PRIZES)].amount);
    } else {
      // Lật Thẻ: client gửi số lượt lật + thời gian; chặn kết quả bất khả thi rồi thưởng theo bậc.
      const moves = Number(req.body.moves);
      const seconds = Number(req.body.seconds);
      if (!Number.isFinite(moves) || !Number.isFinite(seconds) || moves < MEMORY_PAIRS || seconds < MEMORY_MIN_SECONDS) {
        return res.status(400).json({ success: false, error: 'Kết quả trò chơi không hợp lệ' });
      }
      amount = moves <= 12 ? 80 : moves <= 16 ? 50 : moves <= 22 ? 30 : 20;
    }

    const result = await awardCoins({
      userId: req.userId,
      reason: game.reason,
      refId: `${today}#${played + 1}`,
      amount,
      note: game.note,
    });
    if (!result) {
      // Hai request song song cùng chiếm lượt thứ (played + 1) — request đến sau bị unique index chặn.
      return res.status(409).json({ success: false, error: 'Lượt chơi đang được xử lý, vui lòng thử lại.' });
    }

    res.json({
      success: true,
      amount,
      coins: result.coins,
      playsLeft: Math.max(0, game.dailyLimit - played - 1),
      ...extra,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
