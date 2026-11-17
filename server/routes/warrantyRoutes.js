const express = require('express');
const { sendError } = require('../utils/http-error');
const Warranty = require('../models/Warranty');
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const ProductImage = require('../models/ProductImage');
const multer = require('multer');
const { IMAGE_TYPES, INVALID_TYPE_ERROR } = require('../utils/images');
const { emitWarrantyUpdated } = require('../realtime');
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

const OPEN_CLAIM = ['CLAIMED', 'PROCESSING'];
const CLAIM_RESULTS = ['REPAIR', 'REPRINT', 'REPLACE', 'REJECTED'];

// Admin: tiếp nhận yêu cầu (đã liên hệ khách) -> "Đang xử lý". Ghi chú hiện cho khách khi tra cứu.
router.patch('/admin/:warrantyCode/process', requirePermission('orders.edit'), async (req, res) => {
  try {
    const warranty = await Warranty.findOne({ warrantyCode: req.params.warrantyCode });
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    if (warranty.status !== 'CLAIMED') return res.status(400).json({ success: false, error: 'Phiếu này không có yêu cầu chờ tiếp nhận' });
    const note = String(req.body.note || '').trim().slice(0, 500) || 'Luméa đã tiếp nhận yêu cầu và sẽ liên hệ với bạn.';
    warranty.claimHistory.push({ note, by: 'STAFF' });
    warranty.status = 'PROCESSING';
    await warranty.save();
    emitWarrantyUpdated(warranty);
    res.json({ success: true, warranty });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin: đóng yêu cầu với kết quả (sửa chữa / in lại / đổi mới / từ chối). Phiếu quay lại còn hiệu lực.
router.patch('/admin/:warrantyCode/resolve', requirePermission('orders.edit'), async (req, res) => {
  try {
    const warranty = await Warranty.findOne({ warrantyCode: req.params.warrantyCode });
    if (!warranty) return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    if (!OPEN_CLAIM.includes(warranty.status)) {
      return res.status(400).json({ success: false, error: 'Phiếu này không có yêu cầu đang xử lý' });
    }
    const result = CLAIM_RESULTS.includes(req.body.result) ? req.body.result : null;
    if (!result) return res.status(400).json({ success: false, error: 'Vui lòng chọn kết quả xử lý' });
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (result === 'REJECTED' && !note) return res.status(400).json({ success: false, error: 'Vui lòng ghi lý do không bảo hành' });
    warranty.claimHistory.push({ note, by: 'STAFF', result });
    warranty.status = 'ACTIVE';
    await warranty.save();
    emitWarrantyUpdated(warranty);
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

// Admin: cấp phiếu cho các món của 1 đơn ĐÃ GIAO
router.post('/', requirePermission('orders.edit'), async (req, res) => {
  try {
    const orderNumber = String(req.body.orderNumber || '').trim();
    const order = await Order.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    if (order.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, error: 'Chỉ cấp phiếu bảo hành cho đơn đã giao thành công' });
    }
    const months = Number(req.body.warrantyMonths || 12);
    if (!Number.isInteger(months) || months < 1 || months > MAX_EXTEND_MONTHS) {
      return res.status(400).json({ success: false, error: `Thời hạn bảo hành từ 1 đến ${MAX_EXTEND_MONTHS} tháng` });
    }
    const wanted = Array.isArray(req.body.itemIds) && req.body.itemIds.length ? req.body.itemIds.map(String) : null;

    const created = [];
    const assigned = {};
    for (const [index, item] of order.items.entries()) {
      if (wanted && !wanted.includes(item.id)) continue;
      if (item.warrantyCode) continue;
      let warranty = await Warranty.findOne({ orderNumber: order.orderNumber, itemId: item.id });
      if (!warranty) {
        warranty = await createWarranty({
          orderNumber: order.orderNumber,
          itemId: item.id,
          productName: item.product?.name || 'Sản phẩm Luméa',
          productImage: item.product?.images?.[0] || '',
          customerName: order.shippingAddress.fullName,
          customerPhone: order.shippingAddress.phone,
          purchasedAt: order.deliveredAt || order.updatedAt || new Date(),
          warrantyMonths: months,
        });
        created.push(warranty);
      }
      assigned[`items.${index}.warrantyCode`] = warranty.warrantyCode;
    }
    if (Object.keys(assigned).length) await Order.updateOne({ _id: order._id }, { $set: assigned });
    if (!created.length) {
      return res.status(400).json({ success: false, error: 'Các sản phẩm đã chọn đều đã có phiếu bảo hành' });
    }
    res.json({ success: true, warranties: created, warranty: created[0] });
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

// Ảnh kèm yêu cầu: tối đa 3 ảnh, mỗi ảnh 5MB, lưu chung kho ảnh MongoDB (ProductImage).
const MAX_CLAIM_IMAGES = 3;
const claimUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: MAX_CLAIM_IMAGES } });
function readClaimImages(req, res, next) {
  claimUpload.array('images', MAX_CLAIM_IMAGES)(req, res, err => {
    if (!err) return next();
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh không được vượt quá 5MB'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Gửi tối đa ${MAX_CLAIM_IMAGES} ảnh`
      : 'Không đọc được file ảnh';
    res.status(400).json({ success: false, error });
  });
}

// Khách gửi yêu cầu bảo hành (kèm ảnh tình trạng sản phẩm) — phải kèm đúng SĐT mua hàng như khi tra cứu.
router.post('/:warrantyCode/claim', readClaimImages, async (req, res) => {
  try {
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (!note) return res.status(400).json({ success: false, error: 'Vui lòng mô tả vấn đề của sản phẩm' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: 'Vui lòng gửi kèm ít nhất 1 ảnh tình trạng sản phẩm' });
    if (files.some(f => !IMAGE_TYPES.includes(f.mimetype))) return res.status(400).json({ success: false, error: INVALID_TYPE_ERROR });

    if (isLocked(req.ip)) {
      return res.status(429).json({ success: false, error: 'Bạn đã thử quá nhiều lần, vui lòng thử lại sau 15 phút.' });
    }
    const warranty = await findOwnedWarranty(req.params.warrantyCode, req.body.phone);
    if (!warranty) {
      recordFailure(req.ip);
      return res.status(404).json({ success: false, error: 'Không tìm thấy phiếu bảo hành' });
    }
    if (warranty.status === 'ACTIVE' && warranty.expiresAt < new Date()) {
      warranty.status = 'EXPIRED';
      await warranty.save();
    }
    if (warranty.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Phiếu bảo hành không còn hiệu lực' });
    }

    const images = await Promise.all(files.map(async f => {
      const image = await ProductImage.create({ data: f.buffer, contentType: f.mimetype });
      return `/api/products/images/${image._id}`;
    }));
    warranty.claimHistory.push({ note, by: 'CUSTOMER', images });
    warranty.status = 'CLAIMED';
    await warranty.save();
    emitWarrantyUpdated(warranty, true);

    res.json({ success: true, warranty: publicWarranty(warranty) });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
