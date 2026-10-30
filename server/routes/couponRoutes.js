const express = require('express');
const { sendError } = require('../utils/http-error');
const Coupon = require('../models/Coupon');
const { validId } = require('../middleware/auth');
const { usedCouponCodes } = require('../utils/vouchers');

const router = express.Router();

const COUPON_FIELDS = { _id: 0, code: 1, description: 1, discountPercent: 1, maxDiscount: 1, minSpend: 1 };

// Danh sách mã đang hoạt động (hiển thị gợi ý mã cho khách). Có userId thì bỏ các mã khách đã dùng
// (mỗi mã chỉ dùng 1 lần) và trả kèm usedCodes để client xoá khỏi danh sách mã đã lưu.
router.get('/', async (req, res) => {
  try {
    const usedCodes = await usedCouponCodes(validId(req.query.userId));
    const coupons = (await Coupon.find({ active: true }, COUPON_FIELDS).lean()).filter(c => !usedCodes.includes(c.code));
    res.json({ success: true, coupons, usedCodes });
  } catch (err) {
    sendError(res, err);
  }
});

// Kiểm tra 1 mã — điều kiện minSpend được FE kiểm tra lại theo subtotal hiện tại của giỏ.
router.get('/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const coupon = await Coupon.findOne({ code, active: true }, COUPON_FIELDS).lean();
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
    }
    if ((await usedCouponCodes(validId(req.query.userId))).includes(code)) {
      return res.status(409).json({ success: false, error: `Bạn đã dùng mã ${code} rồi — mỗi mã chỉ dùng được 1 lần.` });
    }
    res.json({ success: true, coupon });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
