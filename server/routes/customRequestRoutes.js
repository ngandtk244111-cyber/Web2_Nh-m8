const express = require('express');
const { sendError } = require('../utils/http-error');
const { validatePrintRequest } = require('../utils/print-request-rules');
const CustomRequest = require('../models/CustomRequest');
const User = require('../models/User');
const { requireAdminId, attachUserId, isActiveAdmin, validId } = require('../middleware/auth');

const router = express.Router();

function nowLabel() {
  const now = new Date();
  return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Yêu cầu chứa thông tin liên hệ + brief của khách: admin xem tất cả, khách chỉ xem của mình (theo
// userId, hoặc theo email với yêu cầu cũ gửi trước khi có userId), chưa đăng nhập thì danh sách rỗng —
// khách vãng lai vẫn mở được yêu cầu vừa gửi qua GET /:id (mã yêu cầu).
router.get('/', attachUserId, async (req, res) => {
  try {
    let filter;
    if (await isActiveAdmin(validId(req.query.adminId))) {
      filter = {};
    } else if (req.userId) {
      const user = await User.findById(req.userId, { email: 1 }).lean();
      filter = { $or: [{ userId: req.userId }, ...(user?.email ? [{ userId: null, customerEmail: user.email }] : [])] };
    } else {
      return res.json({ success: true, requests: [] });
    }
    const requests = await CustomRequest.find(filter).sort({ _id: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ $or: [{ id: req.params.id }, { requestCode: req.params.id }] });
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    res.json({ success: true, request });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', attachUserId, async (req, res) => {
  try {
    const ruleError = validatePrintRequest(req.body);
    if (ruleError) return res.status(400).json({ success: false, error: ruleError });

    const dateStr = nowLabel();
    const codeNum = Math.floor(100 + Math.random() * 900);
    // Không cho client tự đặt giá/trạng thái/ghi chú nội bộ khi tạo yêu cầu.
    const { quotationPrice: _q, estimatedDays: _e, adminNote: _n, preview3dModelType: _p, adminId: _a, ...body } = req.body;
    const request = await CustomRequest.create({
      ...body,
      userId: req.userId || null,
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
    sendError(res, err);
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'Nội dung tin nhắn trống' });
    if (text.length > 2000) return res.status(400).json({ success: false, error: 'Tin nhắn tối đa 2000 ký tự' });
    // Vai trò người gửi do server quyết định: chỉ adminId hợp lệ mới gửi được với tư cách kỹ thuật viên.
    const sender = (await isActiveAdmin(validId(req.body.adminId))) ? 'SHOP_SPECIALIST' : 'CUSTOMER';
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
    sendError(res, err);
  }
});

// Khách chỉ được tự chuyển trạng thái khi duyệt báo giá (→ APPROVED) và khi đã đặt hàng
// (→ CONVERTED_TO_ORDER); không được đổi giá/thời gian. Mọi thay đổi khác cần admin.
const CUSTOMER_TRANSITIONS = {
  APPROVED: ['QUOTED', 'IN_DISCUSSION', 'PREVIEW_READY'],
  CONVERTED_TO_ORDER: ['APPROVED'],
};

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (await isActiveAdmin(validId(req.body.adminId))) return next();
    const { status } = req.body;
    const allowedFrom = CUSTOMER_TRANSITIONS[status];
    if (!allowedFrom) return res.status(401).json({ success: false, error: 'Chỉ nhân viên Luméa được cập nhật trạng thái này' });

    const userId = validId(req.body.userId);
    const request = await CustomRequest.findOneAndUpdate(
      {
        id: req.params.id,
        status: { $in: [...allowedFrom, status] },
        // Yêu cầu đã gắn tài khoản thì chỉ chính chủ được duyệt.
        $or: [{ userId: null }, ...(userId ? [{ userId }] : [])],
      },
      { status, updatedAt: new Date().toLocaleDateString('vi-VN') },
      { new: true }
    );
    if (!request) return res.status(400).json({ success: false, error: 'Không thể cập nhật trạng thái yêu cầu này' });
    res.json({ success: true, request });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/:id/status', requireAdminId, async (req, res) => {
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
    sendError(res, err);
  }
});

module.exports = router;
