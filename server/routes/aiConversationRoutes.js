const express = require('express');
const AiConversation = require('../models/AiConversation');
const { requireUserId } = require('../middleware/auth');

const router = express.Router();

const LIST_LIMIT = 30;
const MAX_MESSAGES = 200;

// Danh sách hội thoại (không kèm tin nhắn) — mới cập nhật lên đầu.
router.get('/', requireUserId, async (req, res) => {
  try {
    const conversations = await AiConversation.find({ userId: req.userId })
      .select('id title updatedAt -_id')
      .sort({ updatedAt: -1 })
      .limit(LIST_LIMIT)
      .lean();
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireUserId, async (req, res) => {
  try {
    const conversation = await AiConversation.findOne({ id: req.params.id, userId: req.userId })
      .select('-_id -__v')
      .lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Không tìm thấy cuộc trò chuyện' });
    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lưu (tạo mới hoặc ghi đè) toàn bộ nội dung 1 hội thoại sau mỗi lượt chat.
router.put('/:id', requireUserId, async (req, res) => {
  try {
    const { title, messages, brief = null, conceptImage = null } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages phải là mảng' });
    }
    // Chỉ chủ sở hữu mới ghi được: id đã thuộc user khác thì upsert sẽ đụng unique index -> 409.
    await AiConversation.findOneAndUpdate(
      { id: req.params.id, userId: req.userId },
      {
        $set: {
          title: String(title || 'Cuộc trò chuyện mới').slice(0, 120),
          messages: messages.slice(-MAX_MESSAGES),
          brief,
          conceptImage,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Mã hội thoại đã tồn tại' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireUserId, async (req, res) => {
  try {
    await AiConversation.deleteOne({ id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
