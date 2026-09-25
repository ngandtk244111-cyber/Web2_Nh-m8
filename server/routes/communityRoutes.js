const express = require('express');
const CommunityPost = require('../models/CommunityPost');
const Notification = require('../models/Notification');
const { awardCoins } = require('../utils/coins');
const { checkContent } = require('../utils/moderation');
const { requireAdminId } = require('../middleware/auth');

const router = express.Router();

const COMMUNITY_POST_REWARD = 15;
const MODERATION_STATUSES = ['PUBLISHED', 'HIDDEN', 'REJECTED'];


// Bài cũ (tạo trước khi có kiểm duyệt) không có trường status — coi như đang hiển thị.
const PUBLIC_FILTER = { status: { $nin: ['HIDDEN', 'REJECTED'] } };

async function notifyAuthor(post, title, message) {
  if (!post.userId) return;
  await Notification.create({ userId: String(post.userId), title, message, link: '/community' });
}

router.get('/', async (_req, res) => {
  try {
    const posts = await CommunityPost.find(PUBLIC_FILTER).sort({ _id: -1 });
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin — mọi bài kể cả bị ẩn/bị chặn, kèm postedAt thật để lọc "đăng hôm nay".
router.get('/admin', requireAdminId, async (_req, res) => {
  try {
    const posts = await CommunityPost.find().sort({ _id: -1 }).lean();
    res.json({
      success: true,
      posts: posts.map(p => ({ ...p, status: p.status || 'PUBLISHED', postedAt: p.postedAt || p._id.getTimestamp() })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin — đổi trạng thái hiển thị (ẩn / mở lại) và/hoặc gắn nhãn "Staff Pick".
router.patch('/:id/moderation', requireAdminId, async (req, res) => {
  try {
    const { status, reason, isStaffPick } = req.body;
    const update = {};
    if (status !== undefined) {
      if (!MODERATION_STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
      Object.assign(update, {
        status,
        moderationReason: status === 'PUBLISHED' ? '' : String(reason || '').trim(),
        moderatedBy: req.adminId,
        moderatedAt: new Date(),
      });
    }
    if (isStaffPick !== undefined) update.isStaffPick = !!isStaffPick;

    const before = await CommunityPost.findOne({ id: req.params.id });
    if (!before) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    const post = await CommunityPost.findOneAndUpdate({ id: req.params.id }, update, { new: true });

    if (status === 'HIDDEN' && before.status !== 'HIDDEN') {
      await notifyAuthor(post, 'Bài đăng Cộng đồng đã bị ẩn',
        `Bài "${post.title}" đã bị ẩn khỏi Cộng đồng Luméa${update.moderationReason ? ': ' + update.moderationReason : ''}.`);
    } else if (status === 'PUBLISHED' && before.status && before.status !== 'PUBLISHED') {
      await notifyAuthor(post, 'Bài đăng Cộng đồng đã được hiển thị lại',
        `Bài "${post.title}" đã được nhân viên Luméa duyệt và hiển thị trên Cộng đồng.`);
    }

    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAdminId, async (req, res) => {
  try {
    await CommunityPost.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    // Không cho client tự đặt các trường kiểm duyệt / số liệu.
    const { userId, status: _s, moderationReason: _r, moderatedBy: _b, moderatedAt: _a, isStaffPick: _p, postedAt: _t, ...body } = req.body;


    const violation = checkContent(body.title, body.caption, ...(Array.isArray(body.tags) ? body.tags : []));

    const post = await CommunityPost.create({
      ...body,
      userId: userId || null,
      id: 'post-' + Date.now(),
      likesCount: 0,
      commentsCount: 0,
      comments: [],
      createdAt: 'Vừa xong',
      postedAt: new Date(),
      ...(violation ? {
        status: 'REJECTED',
        moderationReason: `${violation.reason} (từ khoá: "${violation.matched}")`,
        moderatedBy: 'AUTO',
        moderatedAt: new Date(),
      } : {}),
    });

    // Bài bị chặn: vẫn lưu để nhân viên xem lại, không thưởng Xu, báo lỗi cho người đăng.
    if (violation) {
      return res.status(422).json({
        success: false,
        error: `Bài đăng chưa được hiển thị vì vi phạm tiêu chuẩn cộng đồng: ${violation.reason.toLowerCase()}. Vui lòng chỉnh lại nội dung.`,
      });
    }

    // Thưởng Xu cho bài đăng có ảnh thật (imageUrl bắt buộc ở schema) và có gắn tag sản phẩm,
    // chỉ áp dụng cho người dùng đã đăng nhập.
    if (userId && Array.isArray(post.productTags) && post.productTags.length > 0) {
      await awardCoins({
        userId,
        reason: 'COMMUNITY_POST',
        refId: post.id,
        amount: COMMUNITY_POST_REWARD,
        note: 'Chia sẻ góc decor lên Cộng đồng Luméa',
      });
    }

    res.json({ success: true, post });
  } catch (err) {
    console.error('create community post error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// isLiked là trạng thái cục bộ theo trình duyệt (app không có đăng nhập bắt buộc để xem cộng
// đồng) — client tự quyết định gọi like hay unlike dựa trên localStorage, server chỉ giữ đếm.
router.post('/:id/like', async (req, res) => {
  try {
    const post = await CommunityPost.findOneAndUpdate({ id: req.params.id }, { $inc: { likesCount: 1 } }, { new: true });
    if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/unlike', async (req, res) => {
  try {
    const post = await CommunityPost.findOneAndUpdate({ id: req.params.id }, { $inc: { likesCount: -1 } }, { new: true });
    if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { text, authorName = 'Bạn' } = req.body;
    const newComment = {
      id: 'c-' + Date.now(),
      authorName,
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      text,
      createdAt: 'Vừa xong',
    };

    const post = await CommunityPost.findOneAndUpdate(
      { id: req.params.id },
      { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
