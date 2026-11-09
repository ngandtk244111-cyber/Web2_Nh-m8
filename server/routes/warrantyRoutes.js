const express = require('express');
const { sendError } = require('../utils/http-error');
const Warranty = require('../models/Warranty');
const Admin = require('../models/Admin');
const { requirePermission } = require('../middleware/auth');
const { createWarranty } = require('../utils/warranty');
const { isLocked, recordFailure, normalizePhone } = require('../utils/order-access');

const router = express.Router();

/** Phiếu khớp mã + SĐT mua hàng (so SĐT chỉ theo chữ số, mã không phân biệt hoa thường). */
async function findOwnedWarranty(warrantyCode, phone) {
  const code = String(warrantyCode || '').trim().toUpperCase();
  const cleanPhone = normalizePhone(phone);
  if (!code || !cleanPhone) return null;
  const warranty = await Warranty.findOne({ warrantyCode: code });
  return warranty && normalizePhone(warranty.customerPhone) === cleanPhone ? warranty : null;
}

const MAX_EXTEND_MONTHS = 60;

async function adminName(adminId) {
  const admin = await Admin.findById(adminId, { fullName: 1, username: 1 }).lean();
  return admin ? admin.fullName || admin.username : '';
}

/** Phiếu trả cho khách: bỏ ghi chú nội bộ của nhân viên. */
function publicWarranty(warranty) {
  const obj = warranty.toJSON();
  delete obj.adminNotes;
  return obj;
}

// Admin: toàn bộ phiếu bảo hành, mới nhất trước.
router.get('/admin', requirePermission('orders.view'), async (_req, res) => {
  try {
    const warranties = await Warranty.find().sort({ createdAt: -1 });
    res.json({ success: true, warranties });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: đóng yêu cầu bảo hành đang xử lý, phiếu quay lại còn hiệu lực.
router.patch('/admin/:warrantyCode/resolve', requirePermission('orders.edit'), async (req, res) => {
  try {
    const warranty = await Warranty.findOne({ warrantyCode: req.params.warrantyCode });
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    if (warranty.status !== 'CLAIMED') {
      return res.status(400).json({ success: false, error: 'Phiếu này không có yêu cầu đang xử lý' });
    }
    warranty.claimHistory.push({ note: String(req.body.note || 'Đã xử lý yêu cầu bảo hành').trim().slice(0, 500) });
    warranty.status = 'ACTIVE';
    await warranty.save();
    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: thêm ghi chú nội bộ vào phiếu.
router.post('/admin/:warrantyCode/notes', requirePermission('orders.edit'), async (req, res) => {
  try {
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (!note) return res.status(400).json({ success: false, error: 'Vui lòng nhập nội dung ghi chú' });
    const warranty = await Warranty.findOne({ warrantyCode: req.params.warrantyCode });
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    warranty.adminNotes.push({ note, author: await adminName(req.adminId) });
    await warranty.save();
    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: gia hạn phiếu thêm N tháng. Phiếu đã hết hạn được gia hạn qua hôm nay thì có hiệu lực lại.
router.patch('/admin/:warrantyCode/extend', requirePermission('orders.edit'), async (req, res) => {
  try {
    const months = Number(req.body.months);
    if (!Number.isInteger(months) || months <= 0 || months > MAX_EXTEND_MONTHS) {
      return res.status(400).json({ success: false, error: `Số tháng gia hạn phải là số nguyên từ 1 đến ${MAX_EXTEND_MONTHS}` });
    }
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    const warranty = await Warranty.findOne({ warrantyCode: req.params.warrantyCode });
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });

    warranty.warrantyMonths += months;
    if (warranty.status === 'EXPIRED' && warranty.expiresAt > new Date()) warranty.status = 'ACTIVE';
    const until = warranty.expiresAt.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    warranty.adminNotes.push({
      note: `Gia hạn thêm ${months} tháng (đến ${until})${reason ? `: ${reason}` : ''}`,
      author: await adminName(req.adminId),
    });
    await warranty.save();
    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: issue a warranty card for a shipped order.
router.post('/', requirePermission('orders.edit'), async (req, res) => {
  try {
    const { orderNumber, productName, customerName, customerPhone, purchasedAt, warrantyMonths } = req.body;
    if (!orderNumber || !productName || !customerName || !customerPhone) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin phiếu bảo hành' });
    }

    const warranty = await createWarranty({
      orderNumber,
      productName,
      customerName,
      customerPhone,
      purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
      warrantyMonths: warrantyMonths || 12,
    });

    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

// Public lookup by warranty code + phone, no login required.
router.get('/lookup', async (req, res) => {
  try {
    const { warrantyCode, phone } = req.query;
    if (!warrantyCode || !phone) {
      return res.status(400).json({ success: false, error: 'Thiếu mã bảo hành hoặc số điện thoại' });
    }

    if (isLocked(req.ip)) {
      return res.status(429).json({ success: false, error: 'Bạn đã thử quá nhiều lần, vui lòng thử lại sau 15 phút.' });
    }
    const warranty = await findOwnedWarranty(warrantyCode, phone);
    if (!warranty) {
      recordFailure(req.ip);
      return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành phù hợp' });
    }

    const now = new Date();
    if (warranty.status === 'ACTIVE' && warranty.expiresAt < now) {
      warranty.status = 'EXPIRED';
      await warranty.save();
    }

    res.json({ success: true, warranty: publicWarranty(warranty) });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách gửi yêu cầu bảo hành — phải kèm đúng SĐT mua hàng như khi tra cứu.
router.post('/:warrantyCode/claim', async (req, res) => {
  try {
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (!note) return res.status(400).json({ success: false, error: 'Vui lòng mô tả vấn đề của sản phẩm' });

    const warranty = await findOwnedWarranty(req.params.warrantyCode, req.body.phone);
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    if (warranty.status === 'ACTIVE' && warranty.expiresAt < new Date()) {
      warranty.status = 'EXPIRED';
      await warranty.save();
    }
    if (warranty.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Phiếu bảo hành không còn hiệu lực' });
    }

    warranty.claimHistory.push({ note });
    warranty.status = 'CLAIMED';
    await warranty.save();

    res.json({ success: true, warranty: publicWarranty(warranty) });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
