const express = require('express');
const { sendError } = require('../utils/http-error');
const Coupon = require('../models/Coupon');
const { attachUserId, requirePermission } = require('../middleware/auth');
const { usedCouponCodes, couponUsageCounts, isCouponOpen } = require('../utils/vouchers');

const router = express.Router();

const COUPON_FIELDS = { _id: 0, code: 1, description: 1, discountPercent: 1, maxDiscount: 1, minSpend: 1, limitCount: 1, endDate: 1 };

/** Ngày hết hạn dạng YYYY-MM-DD: mã dùng được hết ngày đó theo giờ Việt Nam. */
function parseEndDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toAdminCoupon(coupon, usage) {
  const obj = typeof coupon.toObject === 'function' ? coupon.toObject() : coupon;
  const usedCount = usage.get(obj.code) || 0;
  const status = !obj.active ? 'PAUSED' : isCouponOpen(obj, usedCount) ? 'ACTIVE' : 'EXPIRED';
  return { ...obj, usedCount, status };
}

// Admin — toàn bộ mã kể cả đã tắt/hết hạn, kèm số lượt đã dùng.
router.get('/admin', requirePermission('marketing.view'), async (_req, res) => {
  try {
    const [coupons, usage] = await Promise.all([Coupon.find().sort({ createdAt: -1 }).lean(), couponUsageCounts()]);
    res.json({ success: true, coupons: coupons.map(c => toAdminCoupon(c, usage)) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/admin', requirePermission('marketing.create'), async (req, res) => {
  try {
    const endDate = parseEndDate(req.body.endDate);
    if (endDate === undefined) return res.status(400).json({ success: false, error: 'Ngày hết hạn không hợp lệ' });
    const { code, description, discountPercent, maxDiscount, minSpend, limitCount } = req.body;
    const coupon = await Coupon.create({ code, description, discountPercent, maxDiscount, minSpend, limitCount, endDate });
    res.json({ success: true, coupon: toAdminCoupon(coupon, new Map()) });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/admin/:code', requirePermission('marketing.edit'), async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndUpdate(
      { code: String(req.params.code).toUpperCase() },
      { active: !!req.body.active },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ success: false, error: 'Không tìm thấy mã giảm giá' });
    res.json({ success: true, coupon: toAdminCoupon(coupon, await couponUsageCounts()) });
  } catch (err) {
    sendError(res, err);
  }
});

// Danh sách mã đang hoạt động (hiển thị gợi ý mã cho khách). Đã đăng nhập thì bỏ các mã khách đã dùng
// (mỗi mã chỉ dùng 1 lần) và trả kèm usedCodes để client xoá khỏi danh sách mã đã lưu.
router.get('/', attachUserId, async (req, res) => {
  try {
    const usedCodes = await usedCouponCodes(req.userId);
    const usage = await couponUsageCounts();
    const coupons = (await Coupon.find({ active: true }, COUPON_FIELDS).lean())
      .filter(c => !usedCodes.includes(c.code) && isCouponOpen(c, usage.get(c.code) || 0));
    res.json({ success: true, coupons, usedCodes });
  } catch (err) {
    sendError(res, err);
  }
});

// Kiểm tra 1 mã — điều kiện minSpend được FE kiểm tra lại theo subtotal hiện tại của giỏ.
router.get('/:code', attachUserId, async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const coupon = await Coupon.findOne({ code, active: true }, COUPON_FIELDS).lean();
    if (!coupon || !isCouponOpen(coupon, (await couponUsageCounts()).get(code) || 0)) {
      return res.status(404).json({ success: false, error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
    }
    if ((await usedCouponCodes(req.userId)).includes(code)) {
      return res.status(409).json({ success: false, error: `Bạn đã dùng mã ${code} rồi — mỗi mã chỉ dùng được 1 lần.` });
    }
    res.json({ success: true, coupon });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
