const express = require('express');
const { sendError } = require('../utils/http-error');
const User = require('../models/User');
const UserVoucher = require('../models/UserVoucher');
const { requireUserId } = require('../middleware/auth');
const { VOUCHER_TIERS, awardVoucher } = require('../utils/vouchers');

const router = express.Router();

// ===================== Voucher của tôi + trò chơi nhận voucher =====================
// Thay cho hệ thống Xu: khách chơi game / hoàn thành hoạt động để nhận voucher giảm giá dùng ngay khi thanh toán.
// Mọi phần thưởng + giới hạn lượt/ngày do server quyết định. Ngày tính theo giờ Việt Nam (UTC+7).

// Phần thưởng có thể nhận qua POST /claim (client chỉ gửi lý do, server tự chọn mệnh giá).
const CLAIM_RULES = {
  STYLE_QUIZ: { tierKey: 'P10', note: 'Hoàn thành Trắc Nghiệm Phong Cách' },
};

const BIRTHDAY_TIER = 'P15';

// Vòng quay: server bốc thưởng theo trọng số — client chỉ diễn hoạt ảnh tới ô server trả về.
const WHEEL_PRIZES = [
  { tierKey: 'V10K', weight: 26 },
  { tierKey: 'P5', weight: 20 },
  { tierKey: 'V20K', weight: 18 },
  { tierKey: 'P15', weight: 2 },
  { tierKey: 'V10K', weight: 16 },
  { tierKey: 'V50K', weight: 6 },
  { tierKey: 'P8', weight: 10 },
  { tierKey: 'V100K', weight: 2 },
];
const GIFT_BOX_PRIZES = [
  { tierKey: 'V10K', weight: 30 },
  { tierKey: 'V20K', weight: 28 },
  { tierKey: 'P5', weight: 22 },
  { tierKey: 'P10', weight: 12 },
  { tierKey: 'V50K', weight: 8 },
];

const GAMES = {
  WHEEL: { source: 'GAME_WHEEL', dailyLimit: 1, note: 'Vòng Quay May Mắn' },
  GIFT_BOX: { source: 'GAME_GIFT_BOX', dailyLimit: 1, note: 'Hộp Quà Bí Ẩn' },
  MEMORY: { source: 'GAME_MEMORY', dailyLimit: 1, note: 'Lật Thẻ Nhận Voucher' },
};

// Lật thẻ: 8 cặp thẻ — ít nhất 8 lượt lật mới ghép xong, nên kết quả dưới mức đó là bất khả thi.
const MEMORY_PAIRS = 8;
const MEMORY_MIN_SECONDS = 8;

function vnDateKey(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

function countPlaysToday(userId, source, today) {
  return UserVoucher.countDocuments({ user: userId, source, refId: { $regex: `^${today}#` } });
}

function publicVoucher(v) {
  return {
    _id: v._id,
    code: v.code,
    title: v.title,
    description: v.description,
    discountPercent: v.discountPercent,
    discountAmount: v.discountAmount,
    maxDiscount: v.maxDiscount,
    minSpend: v.minSpend,
    source: v.source,
    expiresAt: v.expiresAt,
    usedAt: v.usedAt,
    usedOrderNumber: v.usedOrderNumber,
    createdAt: v.createdAt,
  };
}

/** dateOfBirth lưu dạng "YYYY-MM-DD" — đúng ngày/tháng hôm nay thì tặng voucher sinh nhật (1 lần/năm). */
async function checkBirthday(user) {
  if (!user.dateOfBirth) return null;
  const dob = new Date(user.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  if (dob.getUTCDate() !== today.getUTCDate() || dob.getUTCMonth() !== today.getUTCMonth()) return null;
  return awardVoucher({
    userId: user._id,
    tierKey: BIRTHDAY_TIER,
    source: 'BIRTHDAY',
    refId: `birthday-${today.getUTCFullYear()}`,
    note: 'Quà sinh nhật từ Luméa 🎂',
  });
}

router.get('/me', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    const birthday = await checkBirthday(user);
    const vouchers = await UserVoucher.find({ user: user._id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      success: true,
      vouchers: vouchers.map(publicVoucher),
      ...(birthday ? { birthdayVoucher: publicVoucher(birthday) } : {}),
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/rewards', requireUserId, async (req, res) => {
  try {
    const today = vnDateKey();
    const games = {};
    for (const [key, game] of Object.entries(GAMES)) {
      const played = await countPlaysToday(req.userId, game.source, today);
      games[key] = { dailyLimit: game.dailyLimit, playsLeft: Math.max(0, game.dailyLimit - played) };
    }
    res.json({
      success: true,
      games,
      prizes: { WHEEL: WHEEL_PRIZES.map(p => VOUCHER_TIERS[p.tierKey].label) },
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/claim', requireUserId, async (req, res) => {
  try {
    const { reason, refId } = req.body;
    const rule = CLAIM_RULES[reason];
    if (!rule) return res.status(400).json({ success: false, error: 'Lý do nhận voucher không hợp lệ' });
    if (!refId) return res.status(400).json({ success: false, error: 'Thiếu mã tham chiếu (refId)' });
    const voucher = await awardVoucher({ userId: req.userId, tierKey: rule.tierKey, source: reason, refId, note: rule.note });
    res.json({ success: true, alreadyApplied: !voucher, voucher: voucher ? publicVoucher(voucher) : null });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/games/:game/play', requireUserId, async (req, res) => {
  try {
    const key = String(req.params.game || '').toUpperCase();
    const game = GAMES[key];
    if (!game) return res.status(400).json({ success: false, error: 'Trò chơi không tồn tại' });

    const today = vnDateKey();
    const played = await countPlaysToday(req.userId, game.source, today);
    if (played >= game.dailyLimit) {
      return res.status(429).json({ success: false, error: 'Bạn đã hết lượt chơi hôm nay, quay lại vào ngày mai nhé!' });
    }

    let tierKey;
    const extra = {};
    if (key === 'WHEEL') {
      const index = pickWeighted(WHEEL_PRIZES);
      tierKey = WHEEL_PRIZES[index].tierKey;
      extra.prizeIndex = index;
    } else if (key === 'GIFT_BOX') {
      tierKey = GIFT_BOX_PRIZES[pickWeighted(GIFT_BOX_PRIZES)].tierKey;
      // Hé lộ 2 hộp còn lại cho vui — chỉ để hiển thị, không ảnh hưởng phần thưởng.
      extra.otherBoxes = [0, 1].map(() => VOUCHER_TIERS[GIFT_BOX_PRIZES[pickWeighted(GIFT_BOX_PRIZES)].tierKey].label);
    } else {
      // Lật thẻ: client gửi số lượt lật + thời gian; chặn kết quả bất khả thi rồi thưởng theo bậc.
      const moves = Number(req.body.moves);
      const seconds = Number(req.body.seconds);
      if (!Number.isFinite(moves) || !Number.isFinite(seconds) || moves < MEMORY_PAIRS || seconds < MEMORY_MIN_SECONDS) {
        return res.status(400).json({ success: false, error: 'Kết quả trò chơi không hợp lệ' });
      }
      tierKey = moves <= 12 ? 'P10' : moves <= 16 ? 'V50K' : moves <= 22 ? 'V20K' : 'V10K';
    }

    const voucher = await awardVoucher({
      userId: req.userId,
      tierKey,
      source: game.source,
      refId: `${today}#${played + 1}`,
      note: game.note,
    });
    if (!voucher) {
      // Hai request song song cùng chiếm lượt thứ (played + 1) — request đến sau bị unique index chặn.
      return res.status(409).json({ success: false, error: 'Lượt chơi đang được xử lý, vui lòng thử lại.' });
    }

    res.json({
      success: true,
      voucher: publicVoucher(voucher),
      label: VOUCHER_TIERS[tierKey].label,
      playsLeft: Math.max(0, game.dailyLimit - played - 1),
      ...extra,
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
