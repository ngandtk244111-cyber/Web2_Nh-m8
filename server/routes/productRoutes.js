const express = require('express');
const Product = require('../models/Product');
const { awardCoins } = require('../utils/coins');
const { requireAdminId } = require('../middleware/auth');

const router = express.Router();

const REVIEW_REWARD = 15;

router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAdminId, async (req, res) => {
  try {
    const id = req.body.id || 'prod-' + Date.now();
    const product = await Product.create({ ...req.body, id });
    res.json({ success: true, product });
  } catch (err) {
    console.error('create product error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAdminId, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Gửi đánh giá thật, lưu vào Product.reviews (persist thật, không còn chỉ mutate ở client).
router.post('/:id/reviews', async (req, res) => {
  try {
    const { userId, author, rating, comment, images } = req.body;
    if (!author || !rating || !comment) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đánh giá' });
    }

    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });

    const review = {
      id: 'rev-' + Date.now(),
      author,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      rating,
      date: new Date().toLocaleDateString('vi-VN'),
      comment,
      verifiedPurchase: !!userId,
      images: images || [],
    };

    product.reviews.unshift(review);
    await product.save();

    // Thưởng Xu cho đánh giá đầu tiên của user này trên đúng sản phẩm này.
    if (userId) {
      await awardCoins({
        userId,
        reason: 'PRODUCT_REVIEW',
        refId: product.id,
        amount: REVIEW_REWARD,
        note: `Đánh giá sản phẩm "${product.name}"`,
      });
    }

    res.json({ success: true, product, review });
  } catch (err) {
    console.error('submit review error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAdminId, async (req, res) => {
  try {
    await Product.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
