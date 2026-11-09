const express = require('express');
const { sendError } = require('../utils/http-error');
const { requirePermission } = require('../middleware/auth');
const { loadWorkshops } = require('../utils/workshops');
const { resolveAttachments } = require('../utils/documents');
const WorkshopReceipt = require('../models/WorkshopReceipt');
const Product = require('../models/Product');
const Admin = require('../models/Admin');

// Nhập hàng thành phẩm từ xưởng: cộng tồn kho + ghi lịch sử giao nhận.
const router = express.Router();

const MAX_QTY = 10000;

// Lịch sử giao nhận, mới nhất trước (lọc theo xưởng hoặc sản phẩm nếu có).
router.get('/', requirePermission('inventory.view'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.workshopId) filter.workshopId = String(req.query.workshopId);
    if (req.query.productId) filter.productId = String(req.query.productId);
    const receipts = await WorkshopReceipt.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, receipts });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhập kho 1 sản phẩm do xưởng giao. Cộng tồn bằng $inc (nguyên tử) rồi ghi lịch sử.
router.post('/', requirePermission('inventory.edit'), async (req, res) => {
  try {
    const qty = Number(req.body.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) {
      return res.status(400).json({ success: false, error: `Số lượng nhập phải là số nguyên từ 1 đến ${MAX_QTY}` });
    }
    const workshop = (await loadWorkshops()).find(w => w.id === String(req.body.workshopId || ''));
    if (!workshop) return res.status(400).json({ success: false, error: 'Vui lòng chọn xưởng giao hàng' });
    // Lô hàng nhập phải có chứng từ (hoá đơn / phiếu giao nhận của xưởng) để đối soát công nợ.
    const attachments = await resolveAttachments(req.body.attachments);
    if (!attachments.length) {
      return res.status(400).json({ success: false, error: 'Cần đính kèm ít nhất 1 chứng từ (hoá đơn, phiếu giao nhận của xưởng...)' });
    }

    const product = await Product.findOneAndUpdate(
      { id: String(req.body.productId || ''), productionType: 'READY_STOCK' },
      { $inc: { inStock: qty } },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy hàng có sẵn này' });

    const admin = await Admin.findById(req.adminId, { fullName: 1, username: 1 }).lean();
    const receipt = await WorkshopReceipt.create({
      workshopId: workshop.id,
      workshopName: workshop.name,
      productId: product.id,
      productName: product.name,
      qty,
      stockAfter: product.inStock,
      note: String(req.body.note || '').trim().slice(0, 300),
      attachments,
      by: admin ? admin.fullName || admin.username : '',
    });
    res.json({ success: true, receipt, product });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
