const express = require('express');
const CustomRequest = require('../models/CustomRequest');

const router = express.Router();

function nowLabel() {
  const now = new Date();
  return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

router.get('/', async (_req, res) => {
  try {
    const requests = await CustomRequest.find().sort({ _id: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ $or: [{ id: req.params.id }, { requestCode: req.params.id }] });
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const dateStr = nowLabel();
    const codeNum = Math.floor(100 + Math.random() * 900);
    const request = await CustomRequest.create({
      ...req.body,
      id: 'req-' + Date.now(),
      requestCode: `REQ-2026-${codeNum}`,
      createdAt: dateStr,
      updatedAt: dateStr,
      status: 'PENDING_REVIEW',
      messages: [
        {
          id: 'msg-init',
          sender: 'AI_ASSISTANT',
          senderName: 'Luméa Bot',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=DecoAI',
          text: 'Yêu cầu thiết kế riêng của bạn đã được chuyển tới kỹ thuật viên 3D của shop. Shop sẽ xem xét tính khả thi và phản hồi kèm báo giá trong vòng 24h.',
          timestamp: dateStr,
        },
      ],
    });
    res.json({ success: true, request });
  } catch (err) {
    console.error('create custom request error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const { text, sender = 'CUSTOMER' } = req.body;
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: 'msg-' + Date.now(),
      sender,
      senderName: sender === 'CUSTOMER' ? 'Bạn (Khách hàng)' : 'Kỹ Thuật Viên Tuấn (Luméa)',
      avatar: sender === 'CUSTOMER'
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
        : 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
      text,
      timestamp,
    };

    const request = await CustomRequest.findOneAndUpdate(
      { id: req.params.id },
      { $push: { messages: newMsg }, $set: { updatedAt: timestamp } },
      { new: true }
    );
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, quotationPrice, estimatedDays, preview3dModelType } = req.body;
    const update = { updatedAt: new Date().toLocaleDateString('vi-VN') };
    if (status !== undefined) update.status = status;
    if (quotationPrice !== undefined) update.quotationPrice = quotationPrice;
    if (estimatedDays !== undefined) update.estimatedDays = estimatedDays;
    if (preview3dModelType !== undefined) update.preview3dModelType = preview3dModelType;

    const request = await CustomRequest.findOneAndUpdate({ id: req.params.id }, update, { new: true });
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
