const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { attachUserId } = require('../middleware/auth');

// GET /api/notifications?userId=... -> thông báo chung (userId=null) + thông báo riêng của user (nếu đã đăng nhập).
router.get('/', attachUserId, async (req, res) => {
  try {
    const query = req.userId
      ? { $or: [{ userId: null }, { userId: req.userId }] }
      : { userId: null };
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, notifications });
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
    const query = req.userId
      ? { $or: [{ userId: null }, { userId: req.userId }] }
      : { userId: null };
    await Notification.updateMany(query, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
