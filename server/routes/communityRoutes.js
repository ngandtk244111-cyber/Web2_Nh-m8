const express = require('express');
const { sendError } = require('../utils/http-error');
const CommunityPost = require('../models/CommunityPost');
const ProductImage = require('../models/ProductImage');
const UserData = require('../models/UserData');
const { IMAGE_TYPES, INVALID_TYPE_ERROR, uploadImage } = require('../utils/images');
const User = require('../models/User');
const { randomUUID } = require('crypto');
const Notification = require('../models/Notification');
const { awardVoucher } = require('../utils/vouchers');
const { checkContent } = require('../utils/moderation');
const { requirePermission, attachUserId, validId } = require('../middleware/auth');

const router = express.Router();

// Ảnh cộng đồng dùng chung kho ảnh MongoDB, không phụ thuộc ổ đĩa của backend.
const { requireUserId } = require('../middleware/auth');

const MODERATION_STATUSES = ['PUBLISHED', 'HIDDEN', 'REJECTED'];


// Bài cũ (tạo trước khi có kiểm duyệt) không có trường status — coi như đang hiển thị.
const PUBLIC_FILTER = { status: { $nin: ['HIDDEN', 'REJECTED'] } };

async function notifyAuthor(post, title, message) {
  if (!post.userId) return;
  await Notification.create({ userId: String(post.userId), title, message, link: '/community?post=' + encodeURIComponent(post.id) });
}

router.get('/', attachUserId, async (req, res) => {
  try {
    const posts = await CommunityPost.find(req.query.mine === 'true' && req.userId ? { userId: req.userId } : PUBLIC_FILTER).sort({ _id: -1 });
    const ids = [...new Set(posts.flatMap(p => [p.userId || p.author?.id, ...p.comments.map(c => c.userId)]).filter(id => validId(String(id))).map(String))];
    const users = await User.find({ _id: { $in: ids } }).select('fullName avatar').lean();
    const profiles = new Map(users.map(u => [String(u._id), u]));
    const data = req.userId ? await UserData.findOne({ user: req.userId }).select('communitySaved').lean() : null;
    const saved = new Set(data?.communitySaved || []);
    const withProfile = (id, author) => {
      const user = profiles.get(String(id));
      return user ? { ...author, name: user.fullName || 'Thành viên', avatar: user.avatar || '', handle: '' } : author;
    };
    res.json({ success: true, posts: posts.map(p => {
      const post = p.toJSON();
      post.isLiked = (p.likedBy || []).includes(req.userId);
      post.isSaved = saved.has(p.id);
      post.author = withProfile(p.userId || p.author?.id, post.author);
      post.comments = post.comments.map(c => {
        const user = profiles.get(String(c.userId));
        return user ? { ...c, authorName: user.fullName || 'Thành viên', authorAvatar: user.avatar || '' } : c;
      });
      return post;
    }) });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — mọi bài kể cả bị ẩn/bị chặn, kèm postedAt thật để lọc "đăng hôm nay".
router.get('/admin', requirePermission('content.view'), async (_req, res) => {
  try {
    const posts = await CommunityPost.find().select('-likedBy').sort({ _id: -1 }).lean();
    res.json({
      success: true,
      posts: posts.map(p => ({ ...p, status: p.status || 'PUBLISHED', postedAt: p.postedAt || p._id.getTimestamp() })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — đổi trạng thái hiển thị (ẩn / mở lại) và/hoặc gắn nhãn "Staff Pick".
router.patch('/:id/moderation', requirePermission('content.approve'), async (req, res) => {
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
    sendError(res, err);
  }
});

router.delete('/:id', requirePermission('content.delete'), async (req, res) => {
  try {
    await CommunityPost.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/upload-image', requireUserId, uploadImage('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Thiếu file ảnh' });
    if (!IMAGE_TYPES.includes(req.file.mimetype)) return res.status(400).json({ success: false, error: INVALID_TYPE_ERROR });
    const image = await ProductImage.create({ data: req.file.buffer, contentType: req.file.mimetype, uploadedBy: req.userId });
    res.json({ success: true, url: `/api/products/images/${image._id}` });
  } catch (err) {
    console.error('community upload error', err);
    sendError(res, err);
  }
});

router.post('/', requireUserId, async (req, res) => {
  try {
    // Không cho client tự đặt các trường kiểm duyệt / số liệu.
    const { userId: _u, status: _s, moderationReason: _r, moderatedBy: _b, moderatedAt: _a, isStaffPick: _p, postedAt: _t, ...body } = req.body;
    const { userId } = req;
    const user = await User.findById(userId).lean();


    const violation = checkContent(body.title, body.caption, ...(Array.isArray(body.tags) ? body.tags : []));

    const post = await CommunityPost.create({
      ...body,
      userId,
      author: { id: userId, name: user.fullName || 'Thành viên', avatar: user.avatar || '', handle: '' },
      id: 'post-' + randomUUID(),
      likesCount: 0,
      commentsCount: 0,
      comments: [],
      createdAt: new Date().toISOString(),
      postedAt: new Date(),
      ...(violation ? {
        status: 'REJECTED',
        moderationReason: `${violation.reason} (từ khoá: "${violation.matched}")`,
        moderatedBy: 'AUTO',
        moderatedAt: new Date(),
      } : {}),
    });

    // Bài bị chặn: vẫn lưu để nhân viên xem lại, báo lỗi cho người đăng.
    if (violation) {
      return res.status(422).json({
        success: false,
        error: `Bài đăng chưa được hiển thị vì vi phạm tiêu chuẩn cộng đồng: ${violation.reason.toLowerCase()}. Vui lòng chỉnh lại nội dung.`,
      });
    }

    // Tặng voucher cho bài đăng có ảnh thật (imageUrl bắt buộc ở schema) và có gắn tag sản phẩm,
    // chỉ áp dụng cho người dùng đã đăng nhập.
    if (userId && Array.isArray(post.productTags) && post.productTags.length > 0) {
      await awardVoucher({
        userId,
        tierKey: 'V20K',
        source: 'COMMUNITY_POST',
        refId: post.id,
        note: 'Chia sẻ góc decor lên Cộng đồng Luméa',
      });
    }

    res.json({ success: true, post });
  } catch (err) {
    console.error('create community post error', err);
    sendError(res, err);
  }
});

// Khách chỉ sửa/xóa bài của chính mình; quyền kiểm duyệt vẫn thuộc admin.
router.patch('/:id', requireUserId, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const caption = String(req.body.caption || '').trim();
    const imageUrl = String(req.body.imageUrl || '').trim();
    if (!title || !imageUrl) return res.status(400).json({ success: false, error: 'Vui lòng nhập tiêu đề và ảnh bài viết' });
    const violation = checkContent(title, caption);
    if (violation) return res.status(422).json({ success: false, error: violation.reason });
    const post = await CommunityPost.findOneAndUpdate(
      { id: req.params.id, userId: req.userId },
      { $set: { title, caption, imageUrl, productTags: Array.isArray(req.body.productTags) ? req.body.productTags : [] } },
      { new: true, runValidators: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết của bạn' });
    res.json({ success: true, post });
  } catch (err) { sendError(res, err); }
});

router.delete('/:id/mine', requireUserId, async (req, res) => {
  try {
    const result = await CommunityPost.deleteOne({ id: req.params.id, userId: req.userId });
    if (!result.deletedCount) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết của bạn' });
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

router.post('/:id/save', requireUserId, async (req, res) => {
  try {
    if (!await CommunityPost.exists({ id: req.params.id, $or: [PUBLIC_FILTER, { userId: req.userId }] })) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    const isSaved = req.body.saved === true;
    await UserData.findOneAndUpdate({ user: req.userId }, { [isSaved ? '$addToSet' : '$pull']: { communitySaved: req.params.id } }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ success: true, isSaved });
  } catch (err) { sendError(res, err); }
});

for (const action of ['like', 'unlike']) router.post('/:id/' + action, requireUserId, async (req, res) => {
  try {
    const like = action === 'like';
    const post = await CommunityPost.findOneAndUpdate(
      { id: req.params.id, ...PUBLIC_FILTER, likedBy: like ? { $ne: req.userId } : req.userId },
      [{ $set: {
        likesCount: { $max: [0, { $add: [{ $ifNull: ['$likesCount', 0] }, like ? 1 : -1] }] },
        likedBy: { [like ? '$setUnion' : '$setDifference']: [{ $ifNull: ['$likedBy', []] }, [req.userId]] },
      } }], { new: true }
    ) || await CommunityPost.findOne({ id: req.params.id, ...PUBLIC_FILTER });
    if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, post: { ...post.toJSON(), isLiked: (post.likedBy || []).includes(req.userId) } });
  } catch (err) { sendError(res, err); }
});

router.post('/:id/comments', requireUserId, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    const user = await User.findById(req.userId).lean();
    const authorName = user.fullName || 'Thành viên';
    const parentPost = await CommunityPost.findOne({ id: req.params.id, ...PUBLIC_FILTER });
    if (!parentPost) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    const parentId = String(req.body.parentId || '');
    const parent = parentId ? parentPost.comments.find(c => c.id === parentId) : null;
    if (parentId && !parent) return res.status(400).json({ success: false, error: 'Bình luận được trả lời không còn tồn tại' });
    if (!text) return res.status(400).json({ success: false, error: 'Nội dung bình luận trống' });
    if (text.length > 1000) return res.status(400).json({ success: false, error: 'Bình luận tối đa 1000 ký tự' });
    const violation = checkContent(authorName, text);
    if (violation) {
      return res.status(422).json({ success: false, error: `Bình luận vi phạm tiêu chuẩn cộng đồng: ${violation.reason.toLowerCase()}.` });
    }
    const newComment = {
      id: 'c-' + randomUUID(),
      userId: req.userId,
      parentId: parentId || null,
      replyTo: parent?.authorName || null,
      authorName,
      authorAvatar: user.avatar || '',
      text,
      createdAt: new Date().toISOString(),
    };

    const post = await CommunityPost.findOneAndUpdate(
      { id: req.params.id },
      { $push: { comments: newComment }, $inc: { commentsCount: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    const recipients = new Set([String(parentPost.userId || ''), String(parent?.userId || '')]);
    recipients.delete('');
    recipients.delete(String(req.userId));
    await Promise.all([...recipients].map(userId => Notification.notifyUser(userId, {
      title: parent && String(parent.userId) === userId ? 'Có người trả lời bình luận của bạn' : 'Bài viết của bạn có bình luận mới',
      message: authorName + ': ' + text.slice(0, 160),
      link: '/community?post=' + encodeURIComponent(parentPost.id) + '&comment=' + encodeURIComponent(newComment.id),
      refKey: 'community-comment:' + newComment.id,
    })));
    res.json({ success: true, post });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
