const express = require('express');
const { sendError } = require('../utils/http-error');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { awardVoucher } = require('../utils/vouchers');
const { checkContent } = require('../utils/moderation');
const { requireAdminId, validId } = require('../middleware/auth');

const router = express.Router();


// Đánh giá đăng ngay, không chờ duyệt. Nhân viên chỉ ẩn khi vi phạm (status HIDDEN), phản hồi
// công khai (reply) và ghim đánh giá hay lên đầu (pinned). Client không bao giờ thấy bài bị ẩn.
function toPublicProduct(product) {
  const obj = typeof product.toJSON === 'function' ? product.toJSON() : product;
  const reviews = (obj.reviews || [])
    .filter(r => r.status !== 'HIDDEN')
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  return { ...obj, reviews };
}

router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products: products.map(toPublicProduct) });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — gom đánh giá của mọi sản phẩm (kể cả đã ẩn), mới nhất trước.
router.get('/reviews/admin', requireAdminId, async (_req, res) => {
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
router.patch('/:id/reviews/:reviewId', requireAdminId, async (req, res) => {
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
      review.reply = text ? { text, date: new Date().toLocaleDateString('vi-VN'), adminId: req.adminId } : null;
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

router.post('/', requireAdminId, async (req, res) => {
  try {
    const id = req.body.id || 'prod-' + Date.now();
    const product = await Product.create({ ...req.body, id });
    res.json({ success: true, product });
  } catch (err) {
    console.error('create product error', err);
    sendError(res, err);
  }
});

router.put('/:id', requireAdminId, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
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
router.get('/:id/can-review', async (req, res) => {
  try {
    const userId = validId(req.query.userId);
    res.json({ success: true, canReview: await hasPurchased(userId, req.params.id) });
  } catch (err) {
    sendError(res, err);
  }
});

// Gửi đánh giá thật, lưu vào Product.reviews. Chỉ khách đã mua sản phẩm mới được đánh giá.
router.post('/:id/reviews', async (req, res) => {
  try {
    const { author, comment, images } = req.body;
    const userId = validId(req.body.userId);
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

    const review = {
      id: 'rev-' + Date.now(),
      userId: userId || null,
      author,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      rating,
      date: new Date().toLocaleDateString('vi-VN'),
      comment,
      verifiedPurchase,
      images: images || [],
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

router.delete('/:id', requireAdminId, async (req, res) => {
  try {
    await Product.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
