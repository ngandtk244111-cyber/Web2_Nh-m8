const express = require('express');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

router.get('/:sessionId/messages', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
