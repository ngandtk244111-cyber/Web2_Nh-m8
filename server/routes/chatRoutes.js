const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const { requireAdminId } = require('../middleware/auth');

const router = express.Router();

// Admin — danh sách cuộc chat, mới nhất lên đầu, kèm tin cuối và số tin khách chưa đọc.
// Tên/SĐT lấy bằng $max: null đứng trước chuỗi khi so sánh nên chỉ cần 1 tin có thông tin là đủ.
router.get('/admin/sessions', requireAdminId, async (_req, res) => {
  try {
    const sessions = await ChatMessage.aggregate([
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$sessionId',
          lastText: { $last: '$text' },
          lastSender: { $last: '$sender' },
          lastAt: { $last: '$createdAt' },
          startedAt: { $first: '$createdAt' },
          messageCount: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'customer'] }, { $ne: ['$readByStaff', true] }] }, 1, 0] },
          },
          userId: { $max: '$userId' },
          customerName: { $max: '$customerName' },
          customerPhone: { $max: '$customerPhone' },
        },
      },
      { $sort: { lastAt: -1 } },
      { $project: { _id: 0, sessionId: '$_id', lastText: 1, lastSender: 1, lastAt: 1, startedAt: 1, messageCount: 1, unread: 1, userId: 1, customerName: 1, customerPhone: 1 } },
    ]);
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin — đánh dấu đã đọc toàn bộ tin của khách trong 1 cuộc chat.
router.post('/admin/sessions/:sessionId/read', requireAdminId, async (req, res) => {
  try {
    await ChatMessage.updateMany({ sessionId: req.params.sessionId, sender: 'customer', readByStaff: { $ne: true } }, { readByStaff: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lịch sử 1 cuộc chat — client dùng để hiện lại tin cũ khi mở lại khung chat, admin khi mở hội thoại.
router.get('/:sessionId/messages', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
