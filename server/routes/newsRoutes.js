const express = require('express');
const NewsArticle = require('../models/NewsArticle');
const NewsComment = require('../models/NewsComment');
const User = require('../models/User');
const { requireAdminId, requireUserId } = require('../middleware/auth');

const COMMENT_MAX_LENGTH = 1000;

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const articles = await NewsArticle.find().sort({ _id: -1 });
    res.json({ success: true, articles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const article = await NewsArticle.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { viewsCount: 1 } },
      { new: true }
    );
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, article });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Ý kiến bạn đọc ----------

// Trả về toàn bộ ý kiến (cả trả lời) của 1 bài — client tự dựng cây 1 cấp theo parentId.
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await NewsComment.find({ articleId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, comments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Gửi ý kiến bắt buộc đăng nhập; tên hiển thị lấy từ tài khoản ở server, không tin tên client gửi.
router.post('/:id/comments', requireUserId, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'Nội dung ý kiến trống' });
    if (text.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({ success: false, error: `Ý kiến tối đa ${COMMENT_MAX_LENGTH} ký tự` });
    }

    const article = await NewsArticle.exists({ id: req.params.id });
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });

    // Chỉ lồng 1 cấp: trả lời một câu trả lời thì gắn vào ý kiến gốc của nó.
    let parentId = null;
    if (req.body.parentId) {
      const parent = await NewsComment.findOne({ id: req.body.parentId, articleId: req.params.id });
      if (!parent) return res.status(404).json({ success: false, error: 'Không tìm thấy ý kiến được trả lời' });
      parentId = parent.parentId || parent.id;
    }

    const user = await User.findById(req.userId).select('fullName phoneNumber');
    if (!user) return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại — vui lòng đăng nhập lại.' });

    const comment = await NewsComment.create({
      id: 'nc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      articleId: req.params.id,
      parentId,
      userId: user._id,
      authorName: user.fullName || user.phoneNumber || 'Bạn đọc',
      text,
    });
    res.json({ success: true, comment });
  } catch (err) {
    console.error('create news comment error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trạng thái đã thích là cục bộ theo trình duyệt (giống like bài Cộng đồng) — server chỉ giữ đếm.
router.post('/comments/:commentId/:action', async (req, res) => {
  try {
    if (!['like', 'unlike'].includes(req.params.action)) {
      return res.status(404).json({ success: false, error: 'Không hỗ trợ thao tác này' });
    }
    const delta = req.params.action === 'like' ? 1 : -1;
    const comment = await NewsComment.findOneAndUpdate(
      { id: req.params.commentId, ...(delta < 0 ? { likesCount: { $gt: 0 } } : {}) },
      { $inc: { likesCount: delta } },
      { new: true }
    );
    if (!comment) return res.status(404).json({ success: false, error: 'Không tìm thấy ý kiến' });
    res.json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// "Nghệ Thuật Ánh Sáng" -> "nghe-thuat-anh-sang" (bỏ dấu tiếng Việt, đ -> d).
function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

router.post('/', requireAdminId, async (req, res) => {
  try {
    // Admin không nhập slug thì tự sinh từ tiêu đề; thêm hậu tố nếu trùng bài đã có.
    let slug = slugify(req.body.slug || req.body.title);
    if (!slug) return res.status(400).json({ success: false, error: 'Thiếu tiêu đề bài viết' });
    if (await NewsArticle.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;

    const { adminId: _adminId, ...body } = req.body;
    const article = await NewsArticle.create({
      ...body,
      slug,
      id: 'news-' + Date.now(),
      viewsCount: 1,
      publishedAt: new Date().toLocaleDateString('vi-VN'),
    });
    res.json({ success: true, article });
  } catch (err) {
    console.error('create news article error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAdminId, async (req, res) => {
  try {
    const article = await NewsArticle.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, article });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAdminId, async (req, res) => {
  try {
    await NewsArticle.deleteOne({ id: req.params.id });
    await NewsComment.deleteMany({ articleId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
