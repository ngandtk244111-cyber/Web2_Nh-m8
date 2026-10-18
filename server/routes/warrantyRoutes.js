const express = require('express');
const { sendError } = require('../utils/http-error');
const Warranty = require('../models/Warranty');
const { requireAdminId } = require('../middleware/auth');

const router = express.Router();

function generateWarrantyCode() {
  return 'WR-' + Math.floor(100000 + Math.random() * 900000);
}

// Admin: issue a warranty card for a shipped order.
router.post('/', requireAdminId, async (req, res) => {
  try {
    const { orderNumber, productName, customerName, customerPhone, purchasedAt, warrantyMonths } = req.body;
    if (!orderNumber || !productName || !customerName || !customerPhone) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin phiếu bảo hành' });
    }

    const warranty = await Warranty.create({
      warrantyCode: generateWarrantyCode(),
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

    const warranty = await Warranty.findOne({ warrantyCode, customerPhone: phone });
    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành phù hợp' });
    }

    const now = new Date();
    if (warranty.status === 'ACTIVE' && warranty.expiresAt < now) {
      warranty.status = 'EXPIRED';
      await warranty.save();
    }

    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:warrantyCode/claim', async (req, res) => {
  try {
    const { warrantyCode } = req.params;
    const { note } = req.body;

    const warranty = await Warranty.findOne({ warrantyCode });
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    if (warranty.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Phiếu bảo hành không còn hiệu lực' });
    }

    warranty.claimHistory.push({ note: note || 'Yêu cầu bảo hành mới' });
    warranty.status = 'CLAIMED';
    await warranty.save();

    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
