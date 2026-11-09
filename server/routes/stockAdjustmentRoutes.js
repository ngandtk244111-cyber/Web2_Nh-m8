const express = require('express');
const { sendError } = require('../utils/http-error');
const { requirePermission } = require('../middleware/auth');
const { resolveAttachments } = require('../utils/documents');
const StockAdjustment = require('../models/StockAdjustment');
const Product = require('../models/Product');
const Admin = require('../models/Admin');

// Nhập / xuất điều chỉnh tồn kho hàng có sẵn (không qua xưởng): bắt buộc lý do + ít nhất 1 chứng từ.
const router = express.Router();

const MAX_QTY = 10000;

router.get('/', requirePermission('inventory.view'), async (req, res) => {
  try {
    const filter = req.query.productId ? { productId: String(req.query.productId) } : {};
    const adjustments = await StockAdjustment.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, adjustments });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', requirePermission('inventory.edit'), async (req, res) => {
  try {
    const type = req.body.type === 'OUT' ? 'OUT' : 'IN';
    const qty = Number(req.body.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) {
      return res.status(400).json({ success: false, error: `Số lượng phải là số nguyên từ 1 đến ${MAX_QTY}` });
    }
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ success: false, error: 'Vui lòng ghi lý do điều chỉnh' });
    const attachments = await resolveAttachments(req.body.attachments);
    if (!attachments.length) {
      return res.status(400).json({ success: false, error: 'Cần đính kèm ít nhất 1 chứng từ (hoá đơn, phiếu giao nhận, ảnh hàng hoá...)' });
    }

    // Cộng / trừ nguyên tử; xuất thì điều kiện tồn >= số xuất nằm ngay trong lệnh update.
    const productId = String(req.body.productId || '');
    const product = await Product.findOneAndUpdate(
      type === 'OUT'
        ? { id: productId, productionType: 'READY_STOCK', inStock: { $gte: qty } }
        : { id: productId, productionType: 'READY_STOCK' },
      { $inc: { inStock: type === 'OUT' ? -qty : qty } },
      { new: true }
    );
    if (!product) {
      const exists = await Product.exists({ id: productId, productionType: 'READY_STOCK' });
      return res.status(exists ? 400 : 404).json({
        success: false,
        error: exists ? 'Tồn kho không đủ để xuất số lượng này' : 'Không tìm thấy hàng có sẵn này',
      });
    }

    const admin = await Admin.findById(req.adminId, { fullName: 1, username: 1 }).lean();
    const adjustment = await StockAdjustment.create({
      productId: product.id,
      productName: product.name,
      type,
      qty,
      stockAfter: product.inStock,
      reason,
      note: String(req.body.note || '').trim().slice(0, 500),
      attachments,
      by: admin ? admin.fullName || admin.username : '',
    });
    res.json({ success: true, adjustment, product });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
