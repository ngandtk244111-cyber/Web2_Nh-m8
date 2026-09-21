const express = require('express');
const CommunityPost = require('../models/CommunityPost');
const { awardCoins } = require('../utils/coins');

const router = express.Router();

const COMMUNITY_POST_REWARD = 15;

router.get('/', async (_req, res) => {
  try {
    const posts = await CommunityPost.find().sort({ _id: -1 });
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, ...body } = req.body;
    const post = await CommunityPost.create({
      ...body,
      userId: userId || null,
      id: 'post-' + Date.now(),
      likesCount: 0,
      commentsCount: 0,
      comments: [],
      createdAt: 'Vừa xong',
    });

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
