const express = require('express');
const { sendError } = require('../utils/http-error');
const ChatMessage = require('../models/ChatMessage');
const { requirePermission, requireUserId, attachUserId, adminIdFromRequest } = require('../middleware/auth');
const { adminHasPermission } = require('../utils/permissions');
const UserData = require('../models/UserData');

const router = express.Router();

// Admin — danh sách cuộc chat, mới nhất lên đầu, kèm tin cuối và số tin khách chưa đọc.
// Tên/SĐT lấy bằng $max: null đứng trước chuỗi khi so sánh nên chỉ cần 1 tin có thông tin là đủ.
router.get('/admin/sessions', requirePermission('customers.view'), async (_req, res) => {
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
    sendError(res, err);
  }
});

// Admin — đánh dấu đã đọc toàn bộ tin của khách trong 1 cuộc chat.
router.post('/admin/sessions/:sessionId/read', requirePermission('customers.view'), async (req, res) => {
  try {
    await ChatMessage.updateMany({ sessionId: req.params.sessionId, sender: 'customer', readByStaff: { $ne: true } }, { readByStaff: true });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// Cuộc chat có khóa ổn định theo tài khoản; chuyển các phiên cũ chỉ khi xác định duy nhất chủ.
router.get('/mine', requireUserId, async (req, res) => {
  try {
    const sessionId = 'user-' + req.userId;
    const oldSessions = await ChatMessage.distinct('sessionId', { userId: req.userId, sessionId: { $ne: sessionId } });
    for (const old of oldSessions) {
      const hasOtherOwner = await ChatMessage.exists({ sessionId: old, sender: 'customer', userId: { $ne: req.userId } });
      if (!hasOtherOwner) await ChatMessage.updateMany({ sessionId: old }, { $set: { sessionId } });
    }
    const [messages, data] = await Promise.all([
      ChatMessage.find({ sessionId }).sort({ createdAt: 1 }),
      UserData.findOne({ user: req.userId }).select('chatLastReadAt').lean(),
    ]);
    res.json({ success: true, sessionId, messages, lastReadAt: data?.chatLastReadAt || null });
  } catch (err) { sendError(res, err); }
});

router.post('/mine/read', requireUserId, async (req, res) => {
  try {
    await UserData.findOneAndUpdate({ user: req.userId }, { $set: { chatLastReadAt: new Date() } }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

// Lịch sử 1 cuộc chat — client dùng để hiện lại tin cũ khi mở lại khung chat, admin khi mở hội thoại.
router.get('/:sessionId/messages', attachUserId, async (req, res) => {
  try {
    const adminId = await adminIdFromRequest(req);
    const isStaff = adminId && await adminHasPermission(adminId, 'customers.view');
    if (!isStaff && (!req.userId || req.params.sessionId !== 'user-' + req.userId)) return res.status(403).json({ success: false, error: 'Bạn không có quyền xem cuộc chat này' });
    const messages = await ChatMessage.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
