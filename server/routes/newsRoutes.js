const express = require('express');
const { sendError } = require('../utils/http-error');
const NewsArticle = require('../models/NewsArticle');
const NewsComment = require('../models/NewsComment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { requirePermission, requireUserId } = require('../middleware/auth');
const { emitToContentStaff } = require('../realtime');
const { isEmailConfigured, getMailTransporter } = require('../utils/otp');

const COMMENT_MAX_LENGTH = 1000;
const STAFF_NAME = 'Luméa';
// Ảnh trả lời phải nằm trong kho ảnh của server (tải lên qua POST /api/products/images).
const STORED_IMAGE = /^(https?:\/\/[^/]+)?\/api\/products\/images\/[a-f0-9]{24}$/;

const router = express.Router();

/**
 * Shop vừa trả lời ý kiến của khách: báo trên web (chuông thông báo) và qua email nếu đã cấu hình SMTP
 * và khách có email. Lỗi gửi thông báo không làm hỏng thao tác trả lời.
 */
async function notifyCommentReply(parent, article, reply) {
  try {
    if (!parent.userId) return;
    const link = `/news/${article.slug}`;
    const preview = reply.text ? reply.text.slice(0, 120) : 'Luméa đã trả lời bạn kèm một hình ảnh.';
    await Notification.create({
      userId: String(parent.userId),
      title: 'Luméa đã trả lời bình luận của bạn',
      message: `Bài "${article.title}": ${preview}`,
      link,
    });
    if (!isEmailConfigured()) return;
    const user = await User.findById(parent.userId, { email: 1, fullName: 1 }).lean().catch(() => null);
    if (!user?.email) return;
    const url = (process.env.CLIENT_URL || 'http://localhost:4200') + link;
    await getMailTransporter().sendMail({
      from: process.env.MAIL_FROM || `"Luméa" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Luméa đã trả lời bình luận của bạn — ${article.title}`,
      text: `Chào ${user.fullName || 'bạn'},\n\nLuméa vừa trả lời bình luận của bạn trong bài "${article.title}":\n\n"${preview}"\n\nXem tại: ${url}\n\nLuméa Interior & 3D`,
    });
  } catch (err) {
    console.error('notify news comment reply error', err.message);
  }
}

// Admin — toàn bộ ý kiến (cả trả lời) kèm tên / slug bài viết, mới nhất trước.
// Khai báo trước '/:id/comments' để 'admin' không bị hiểu là id bài viết.
router.get('/admin/comments', requirePermission('content.view'), async (_req, res) => {
  try {
    const comments = await NewsComment.find().sort({ createdAt: -1 }).limit(1000).lean();
    const articles = await NewsArticle.find({ id: { $in: [...new Set(comments.map(c => c.articleId))] } }, { id: 1, title: 1, slug: 1 }).lean();
    const byId = new Map(articles.map(a => [a.id, a]));
    res.json({
      success: true,
      comments: comments.map(c => ({ ...c, articleTitle: byId.get(c.articleId)?.title || '(bài đã xoá)', articleSlug: byId.get(c.articleId)?.slug || '' })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — shop trả lời 1 ý kiến (có chữ và/hoặc ảnh). Trả lời luôn gắn vào ý kiến gốc (lồng 1 cấp).
router.post('/:id/staff-reply', requirePermission('content.edit'), async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    const imageUrl = String(req.body.imageUrl || '').trim();
    if (!text && !imageUrl) return res.status(400).json({ success: false, error: 'Nhập nội dung hoặc chọn ảnh để trả lời' });
    if (text.length > COMMENT_MAX_LENGTH) return res.status(400).json({ success: false, error: `Trả lời tối đa ${COMMENT_MAX_LENGTH} ký tự` });
    if (imageUrl && !STORED_IMAGE.test(imageUrl)) return res.status(400).json({ success: false, error: 'Ảnh không hợp lệ, vui lòng tải lại ảnh' });

    const article = await NewsArticle.findOne({ id: req.params.id }, { id: 1, title: 1, slug: 1 }).lean();
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    const target = await NewsComment.findOne({ id: String(req.body.parentId || ''), articleId: article.id });
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy ý kiến được trả lời' });

    const reply = await NewsComment.create({
      id: 'nc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      articleId: article.id,
      parentId: target.parentId || target.id,
      authorName: STAFF_NAME,
      isStaff: true,
      text,
      imageUrl,
    });
    // Báo đúng người được trả lời (có thể là 1 câu trả lời trong luồng, không chỉ ý kiến gốc).
    if (!target.isStaff) await notifyCommentReply(target, article, reply);
    res.json({ success: true, comment: reply });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/', async (_req, res) => {
  try {
    const articles = await NewsArticle.find().sort({ _id: -1 });
    res.json({ success: true, articles });
  } catch (err) {
    sendError(res, err);
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
    sendError(res, err);
  }
});

// ---------- Ý kiến bạn đọc ----------

// Trả về toàn bộ ý kiến (cả trả lời) của 1 bài — client tự dựng cây 1 cấp theo parentId.
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await NewsComment.find({ articleId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, comments });
  } catch (err) {
    sendError(res, err);
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

    const article = await NewsArticle.findOne({ id: req.params.id }, { id: 1, title: 1 }).lean();
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
    // Báo ngay cho nhân viên đang mở my-admin (toast + chuông).
    emitToContentStaff('news-comment:new', { articleId: article.id, articleTitle: article.title, author: comment.authorName, text: text.slice(0, 120) });
    res.json({ success: true, comment });
  } catch (err) {
    console.error('create news comment error', err);
    sendError(res, err);
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
    // Khách tim câu trả lời của shop -> báo nhân viên.
    if (delta > 0 && comment.isStaff) {
      const article = await NewsArticle.findOne({ id: comment.articleId }, { title: 1 }).lean();
      emitToContentStaff('news-comment:liked', { articleTitle: article?.title || '', likesCount: comment.likesCount });
    }
    res.json({ success: true, comment });
  } catch (err) {
    sendError(res, err);
  }
});

// "Nghệ Thuật Ánh Sáng" -> "nghe-thuat-anh-sang" (bỏ dấu tiếng Việt, đ -> d).
function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

router.post('/', requirePermission('content.create'), async (req, res) => {
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
    sendError(res, err);
  }
});

router.put('/:id', requirePermission('content.edit'), async (req, res) => {
  try {
    const article = await NewsArticle.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, article });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/:id', requirePermission('content.delete'), async (req, res) => {
  try {
    await NewsArticle.deleteOne({ id: req.params.id });
    await NewsComment.deleteMany({ articleId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
