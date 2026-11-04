const express = require('express');
const { sendError } = require('../utils/http-error');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Order = require('../models/Order');
const { awardVoucher } = require('../utils/vouchers');
const { checkContent } = require('../utils/moderation');
const { requirePermission, attachUserId } = require('../middleware/auth');
const { IMAGE_TYPES, INVALID_TYPE_ERROR, uploadImage, sendStoredImage, removeUnusedProductImages } = require('../utils/images');

const router = express.Router();

// Ảnh kèm đánh giá (tối đa 5 ảnh) — lưu ở server/uploads/reviews, phục vụ qua /uploads/...
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireUserId } = require('../middleware/auth');
const reviewUploadDir = path.join(__dirname, '../uploads/reviews');
fs.mkdirSync(reviewUploadDir, { recursive: true });
const reviewUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5 } });
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_LENGTH = 500;

router.post('/review-images', reviewUpload.array('images', MAX_REVIEW_IMAGES), requireUserId, async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: 'Thiếu file ảnh' });
    if (files.some(f => !IMAGE_EXT[f.mimetype])) {
      return res.status(400).json({ success: false, error: 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF' });
    }
    const urls = files.map((f, i) => {
      const filename = `review-${req.userId}-${Date.now()}-${i}${IMAGE_EXT[f.mimetype]}`;
      fs.writeFileSync(path.join(reviewUploadDir, filename), f.buffer);
      return `/uploads/reviews/${filename}`;
    });
    res.json({ success: true, urls });
  } catch (err) {
    console.error('review upload error', err);
    sendError(res, err);
  }
});

/**
 * Trang "Đánh giá" trong tài khoản: mỗi món trong đơn ĐÃ GIAO là 1 dòng — chưa có đánh giá thì vào
 * "Chưa đánh giá", có rồi thì vào "Đã đánh giá" (kèm nội dung để xem lại / sửa).
 * Đánh giá mới lưu orderNumber; đánh giá cũ (trước khi có orderNumber) được gán cho 1 đơn chứa sản phẩm đó.
 */
router.get('/my-reviews', requireUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ userId, status: 'DELIVERED' }).sort({ deliveredAt: -1, _id: -1 }).lean();
    const ids = [...new Set(orders.flatMap(o => (o.items || []).map(i => i.product?.id).filter(Boolean)))];
    const products = await Product.find({ id: { $in: ids } }, { id: 1, name: 1, slug: 1, images: 1, reviews: 1 }).lean();
    const byId = new Map(products.map(p => [p.id, p]));

    const usedLegacy = new Set();
    const pending = [];
    const reviewed = [];
    for (const order of orders) {
      for (const item of order.items || []) {
        const pid = item.product?.id;
        if (!pid) continue;
        const product = byId.get(pid);
        const mine = (product?.reviews || []).filter(r => String(r.userId || '') === String(userId));
        let review = mine.find(r => r.orderNumber === order.orderNumber);
        if (!review) {
          review = mine.find(r => !r.orderNumber && !usedLegacy.has(r.id));
          if (review) usedLegacy.add(review.id);
        }
        const entry = {
          orderNumber: order.orderNumber,
          date: order.deliveredAt || order.createdAt,
          productId: pid,
          name: product?.name || item.product?.name || '',
          slug: product?.slug || item.product?.slug || '',
          image: product?.images?.[0] || item.product?.images?.[0] || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        };
        if (review) reviewed.push({ ...entry, review });
        else pending.push(entry);
      }
    }
    res.json({ success: true, pending, reviewed });
  } catch (err) {
    sendError(res, err);
  }
});
// Field my-admin được phép ghi — không nhận id, _id, reviews, rating, reviewCount hay toán tử $... từ body.
const EDITABLE_FIELDS = ['name', 'slug', 'category', 'categoryName', 'categoryGroup', 'productionType', 'customizable',
  'basePrice', 'originalPrice', 'description', 'story', 'inStock', 'images', 'badge', 'dimensions', 'materialInfo', 'weight',
  'features', 'customization', 'threeModelType', 'modelUrl', 'productionTime', 'printTechnology', 'flashSaleSlot',
  'style', 'color', 'printMaterial', 'sizeCategory', 'spaces'];

function pickEditable(body) {
  return Object.fromEntries(EDITABLE_FIELDS.filter(f => body[f] !== undefined).map(f => [f, body[f]]));
}


// Đánh giá đăng ngay, không chờ duyệt. Nhân viên chỉ ẩn khi vi phạm (status HIDDEN), phản hồi
// công khai (reply) và ghim đánh giá hay lên đầu (pinned). Client không bao giờ thấy bài bị ẩn.
function toPublicProduct(product) {
  const obj = typeof product.toJSON === 'function' ? product.toJSON() : product;
  const reviews = (obj.reviews || [])
    .filter(r => r.status !== 'HIDDEN')
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  return { ...obj, reviews };
}

// Danh sách không kèm nội dung đánh giá để nhẹ (điểm và số lượng vẫn có); trang chi tiết lấy qua /slug/:slug.
router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().select('-reviews').sort({ createdAt: -1 });
    res.json({ success: true, products: products.map(toPublicProduct) });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — gom đánh giá của mọi sản phẩm (kể cả đã ẩn), mới nhất trước.
router.get('/reviews/admin', requirePermission('customers.view'), async (_req, res) => {
  try {
    const products = await Product.find({ 'reviews.0': { $exists: true } }, { id: 1, name: 1, slug: 1, images: 1, reviews: 1 }).lean();
    const reviews = products.flatMap(p => (p.reviews || []).map(r => ({
      ...r,
      status: r.status || 'VISIBLE',
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      productImage: (p.images || [])[0] || '',
    })));
    // id đánh giá có dạng "rev-<timestamp>" nên sắp theo id là sắp theo thời gian gửi.
    reviews.sort((a, b) => String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
    res.json({ success: true, reviews });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — ẩn/hiện, phản hồi công khai, ghim 1 đánh giá.
router.patch('/:id/reviews/:reviewId', requirePermission('customers.edit'), async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    const review = product.reviews.find(r => r.id === req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Không tìm thấy đánh giá' });

    const { status, hiddenReason, reply, pinned } = req.body;
    if (status !== undefined) {
      if (!['VISIBLE', 'HIDDEN'].includes(status)) return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
      review.status = status;
      review.hiddenReason = status === 'HIDDEN' ? String(hiddenReason || '').trim() : '';
    }
    if (reply !== undefined) {
      const text = String(reply || '').trim();
      review.reply = text ? { text, date: new Date().toLocaleDateString('vi-VN') } : null;
    }
    if (pinned !== undefined) review.pinned = !!pinned;

    product.markModified('reviews');
    await product.save();
    res.json({ success: true, review: { ...review, productId: product.id, productName: product.name, productSlug: product.slug, productImage: (product.images || [])[0] || '' } });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, product: toPublicProduct(product) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', requirePermission('products.create'), async (req, res) => {
  try {
    const product = await Product.create({ ...pickEditable(req.body), id: 'prod-' + Date.now() });
    res.json({ success: true, product });
  } catch (err) {
    console.error('create product error', err);
    sendError(res, err);
  }
});

// Nhập hàng loạt từ file Excel của my-admin. Tạo từng dòng để 1 dòng lỗi (vd trùng slug) không chặn cả lô.
const BULK_LIMIT = 500;
router.post('/bulk', requirePermission('products.create'), async (req, res) => {
  try {
    const rows = Array.isArray(req.body.products) ? req.body.products : [];
    if (!rows.length) return res.status(400).json({ success: false, error: 'Không có sản phẩm nào để nhập' });
    if (rows.length > BULK_LIMIT) {
      return res.status(400).json({ success: false, error: `Mỗi lần nhập tối đa ${BULK_LIMIT} sản phẩm` });
    }

    const stamp = Date.now();
    let created = 0;
    const failed = [];
    for (const [index, row] of rows.entries()) {
      try {
        await Product.create({ ...pickEditable(row || {}), id: `prod-${stamp}-${index}` });
        created++;
      } catch (err) {
        failed.push({ index, error: err.code === 11000 ? 'Slug đã tồn tại' : err.message });
      }
    }
    res.json({ success: true, created, failed });
  } catch (err) {
    console.error('bulk create products error', err);
    sendError(res, err);
  }
});

router.post('/images',requirePermission('products.create', 'products.edit', 'marketing.edit'), uploadImage('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Thiếu file ảnh' });
    if (!IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: INVALID_TYPE_ERROR });
    }

    const image = await ProductImage.create({ data: req.file.buffer, contentType: req.file.mimetype, uploadedBy: req.adminId });
    res.json({ success: true, path: `/api/products/images/${image._id}` });
  } catch (err) {
    console.error('product image upload error', err);
    sendError(res, err);
  }
});

// Công khai vì my-client dùng thẳng URL này làm src. Nội dung ảnh không đổi theo id nên cho cache dài.
router.get('/images/:imageId', async (req, res) => {
  try {
    await sendStoredImage(ProductImage, req.params.imageId, res);
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/:id', requirePermission('products.edit'), async (req, res) => {
  try {
    const previous = await Product.findOneAndUpdate({ id: req.params.id }, { $set: pickEditable(req.body) }, { runValidators: true }).select('images').lean();
    if (!previous) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    await removeUnusedProductImages(previous.images);
    const product = await Product.findOne({ id: req.params.id });
    res.json({ success: true, product });
  } catch (err) {
    sendError(res, err);
  }
});

/** Khách đã mua sản phẩm khi có đơn (chưa huỷ) chứa đúng sản phẩm này. */
function hasPurchased(userId, productId) {
  return userId
    ? Order.exists({ userId, status: { $nin: ['CANCELLED', 'RETURNED'] }, 'items.product.id': productId }).then(Boolean)
    : Promise.resolve(false);
}

// Trang chi tiết sản phẩm hỏi trước để chỉ hiện form đánh giá cho khách đã mua.
router.get('/:id/can-review', attachUserId, async (req, res) => {
  try {
    res.json({ success: true, canReview: await hasPurchased(req.userId, req.params.id) });
  } catch (err) {
    sendError(res, err);
  }
});

// Gửi đánh giá thật, lưu vào Product.reviews. Chỉ khách đã mua sản phẩm mới được đánh giá.
router.post('/:id/reviews', attachUserId, async (req, res) => {
  try {
    const { author, comment, avatar } = req.body;
    const images = (Array.isArray(req.body.images) ? req.body.images : []).filter(x => typeof x === 'string').slice(0, MAX_REVIEW_IMAGES);
    const orderNumber = req.body.orderNumber ? String(req.body.orderNumber) : null;
    const userId = req.userId;
    if (String(comment || '').length > MAX_REVIEW_LENGTH) {
      return res.status(400).json({ success: false, error: `Nội dung đánh giá tối đa ${MAX_REVIEW_LENGTH} ký tự` });
    }
    const rating = Number(req.body.rating);
    if (!String(author || '').trim() || !String(comment || '').trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đánh giá' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Số sao đánh giá phải từ 1 đến 5' });
    }

    // Chặn tự động ngôn từ thô tục / spam — cùng bộ lọc với bài đăng Cộng đồng. Đánh giá chê
    // sản phẩm bình thường không bị ảnh hưởng.
    const violation = checkContent(author, comment);
    if (violation) {
      return res.status(422).json({
        success: false,
        error: `Đánh giá chưa được đăng vì vi phạm tiêu chuẩn cộng đồng: ${violation.reason.toLowerCase()}. Vui lòng chỉnh lại nội dung.`,
      });
    }

    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });

    const verifiedPurchase = await hasPurchased(userId, product.id);
    if (!verifiedPurchase) {
      return res.status(403).json({ success: false, error: 'Chỉ khách đã mua sản phẩm này mới có thể đánh giá.' });
    }
    // Đánh giá từ trang "Đánh giá" của tài khoản: đúng đơn đã giao của khách, mỗi món trong 1 đơn chỉ 1 lần.
    if (orderNumber) {
      const order = await Order.exists({ orderNumber, userId, status: 'DELIVERED', 'items.product.id': product.id });
      if (!order) return res.status(403).json({ success: false, error: 'Chỉ đánh giá được sản phẩm trong đơn đã giao của bạn.' });
      if ((product.reviews || []).some(r => String(r.userId || '') === String(userId) && r.orderNumber === orderNumber)) {
        return res.status(409).json({ success: false, error: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi.' });
      }
    }

    const review = {
      id: 'rev-' + Date.now(),
      userId: userId || null,
      author,
      avatar: (typeof avatar === 'string' && avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      rating,
      date: new Date().toLocaleDateString('vi-VN'),
      createdAt: new Date().toISOString(),
      comment,
      verifiedPurchase,
      images,
      orderNumber,
      status: 'VISIBLE',
    };

    product.reviews.unshift(review);
    await product.save();

    // Tặng voucher cho đánh giá đầu tiên của user này trên đúng sản phẩm này.
    if (userId) {
      await awardVoucher({
        userId,
        tierKey: 'V10K',
        source: 'PRODUCT_REVIEW',
        refId: product.id,
        note: `Đánh giá sản phẩm "${product.name}"`,
      });
    }

    res.json({ success: true, product: toPublicProduct(product), review });
  } catch (err) {
    console.error('submit review error', err);
    sendError(res, err);
  }
});

// "Xem lại đánh giá" -> sửa số sao / nội dung / ảnh của đánh giá do chính khách viết.
router.put('/:id/reviews/:reviewId', requireUserId, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '');
    const images = (Array.isArray(req.body.images) ? req.body.images : []).filter(x => typeof x === 'string').slice(0, MAX_REVIEW_IMAGES);
    if (!comment.trim()) return res.status(400).json({ success: false, error: 'Vui lòng nhập nội dung đánh giá' });
    if (comment.length > MAX_REVIEW_LENGTH) {
      return res.status(400).json({ success: false, error: `Nội dung đánh giá tối đa ${MAX_REVIEW_LENGTH} ký tự` });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Số sao đánh giá phải từ 1 đến 5' });
    }
    const violation = checkContent(comment);
    if (violation) {
      return res.status(422).json({
        success: false,
        error: `Đánh giá chưa được lưu vì vi phạm tiêu chuẩn cộng đồng: ${violation.reason.toLowerCase()}. Vui lòng chỉnh lại nội dung.`,
      });
    }

    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    const idx = (product.reviews || []).findIndex(r => r.id === req.params.reviewId);
    if (idx < 0) return res.status(404).json({ success: false, error: 'Không tìm thấy đánh giá' });
    if (String(product.reviews[idx].userId || '') !== String(req.userId)) {
      return res.status(403).json({ success: false, error: 'Bạn chỉ sửa được đánh giá của chính mình.' });
    }
    const review = { ...product.reviews[idx], rating, comment, images, editedAt: new Date().toISOString() };
    product.reviews.set(idx, review);
    product.markModified('reviews');
    await product.save();
    res.json({ success: true, review });
  } catch (err) {
    console.error('update review error', err);
    sendError(res, err);
  }
});

router.delete('/:id', requirePermission('products.delete'), async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id }).select('images').lean();
    if (!deleted) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    await removeUnusedProductImages(deleted.images);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
