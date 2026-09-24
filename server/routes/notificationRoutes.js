const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { attachUserId, requireUserId } = require('../middleware/auth');

// Thông báo chung (userId=null) + thông báo riêng của user (nếu đã đăng nhập), bỏ qua thông báo
// hẹn giờ chưa tới lúc hiện (visibleAt ở tương lai). Doc cũ không có visibleAt vẫn khớp `null`.
function visibleQuery(userId) {
  return {
    $and: [
      userId ? { $or: [{ userId: null }, { userId }] } : { userId: null },
      { $or: [{ visibleAt: null }, { visibleAt: { $lte: new Date() } }] },
    ],
  };
}

// GET /api/notifications?userId=...
router.get('/', attachUserId, async (req, res) => {
  try {
    const notifications = await Notification.find(visibleQuery(req.userId)).sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const SLOT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEAD_MS = 4 * 24 * 3600 * 1000;

// POST /api/notifications/flash-sale-reminder  (body: { userId, slotDate: 'YYYY-MM-DD', slotLabel, startAt: ISO })
// Đặt nhắc Flash Sale: lưu ngay 1 thông báo xác nhận + 1 thông báo "deal đã bắt đầu" hẹn giờ
// (visibleAt = giờ bắt đầu, createdAt = giờ bắt đầu để xếp/hiển thị đúng thời điểm).
router.post('/flash-sale-reminder', requireUserId, async (req, res) => {
  try {
    const { slotDate, slotLabel, startAt } = req.body || {};
    const start = new Date(startAt);
    if (!SLOT_DATE_RE.test(slotDate || '') || Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, error: 'Dữ liệu khung giờ không hợp lệ.' });
    }
    const lead = start.getTime() - Date.now();
    if (lead <= 0) return res.status(400).json({ success: false, error: 'Khung giờ này đã bắt đầu.' });
    if (lead > MAX_LEAD_MS) return res.status(400).json({ success: false, error: 'Khung giờ quá xa.' });

    const user = await User.findById(req.userId).select('_id').catch(() => null);
    if (!user) return res.status(401).json({ success: false, error: 'Tài khoản không hợp lệ — vui lòng đăng nhập lại.' });

    const refKey = `flash-sale:${slotDate}`;
    const existing = await Notification.findOne({ userId: req.userId, refKey });
    if (existing) return res.json({ success: true, already: true });

    const label = String(slotLabel || slotDate).slice(0, 60);
    await Notification.create({
      userId: req.userId,
      title: 'Đã đặt nhắc Flash Sale',
      message: `Bạn sẽ nhận thông báo khi Flash Sale khung ${label} bắt đầu.`,
      link: '/flash-sale',
      refKey,
    });
    await Notification.create({
      userId: req.userId,
      title: '⚡ Flash Sale đã bắt đầu!',
      message: `Khung ${label} đang diễn ra — vào săn deal ngay kẻo hết suất.`,
      link: '/flash-sale',
      refKey: `${refKey}:start`,
      visibleAt: start,
      createdAt: start,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/notifications/flash-sale-reminder?userId=...&slotDate=YYYY-MM-DD  -> hủy nhắc hẹn.
router.delete('/flash-sale-reminder', requireUserId, async (req, res) => {
  try {
    const { slotDate } = req.query;
    if (!SLOT_DATE_RE.test(slotDate || '')) {
      return res.status(400).json({ success: false, error: 'Dữ liệu khung giờ không hợp lệ.' });
    }
    const refKey = `flash-sale:${slotDate}`;
    await Notification.deleteMany({
      userId: req.userId,
      $or: [{ refKey }, { refKey: `${refKey}:start`, visibleAt: { $gt: new Date() } }],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!notification) return res.status(404).json({ success: false, error: 'Không tìm thấy thông báo.' });
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/read-all  (body: { userId? })
router.put('/read-all', attachUserId, async (req, res) => {
  try {
    await Notification.updateMany(visibleQuery(req.userId), { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
