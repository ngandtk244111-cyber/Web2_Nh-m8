const express = require('express');
const { sendError } = require('../utils/http-error');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Order = require('../models/Order');
const { awardVoucher } = require('../utils/vouchers');
const { checkContent } = require('../utils/moderation');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { isEmailConfigured, getMailTransporter } = require('../utils/otp');
const { emitToStaff } = require('../realtime');
const { requirePermission, attachUserId } = require('../middleware/auth');
const { IMAGE_TYPES, INVALID_TYPE_ERROR, uploadImage, sendStoredImage, removeUnusedProductImages, saveReviewVideo, sendReviewVideo } = require('../utils/images');

const router = express.Router();

// Ảnh đánh giá lưu ProductImage; video lưu GridFS để không phụ thuộc ổ đĩa backend.
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireUserId } = require('../middleware/auth');
const reviewUploadDir = path.join(__dirname, '../uploads/reviews');
const reviewUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 6 } });
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_LENGTH = 500;

// Validate duration from MP4 movie/track metadata; fragmented clips are not supported.
function videoDuration(buffer, start = 0, end = buffer.length) {
  let duration = 0;
  for (let offset = start; offset + 8 <= end;) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (size < 8 || offset + size > end || type === 'moof') throw new Error('Video MP4 không hợp lệ');
    if (['moov', 'trak', 'mdia'].includes(type)) duration = Math.max(duration, videoDuration(buffer, offset + 8, offset + size));
    if (type === 'mvhd' || type === 'mdhd') {
      const version = buffer[offset + 8];
      const pos = offset + (version === 1 ? 28 : 20);
      if (version > 1 || pos + (version === 1 ? 12 : 8) > offset + size) throw new Error('Video MP4 không hợp lệ');
      const scale = buffer.readUInt32BE(pos);
      const ticks = version === 1 ? Number(buffer.readBigUInt64BE(pos + 4)) : buffer.readUInt32BE(pos + 4);
      if (!scale) throw new Error('Video thiếu thời lượng');
      duration = Math.max(duration, ticks / scale);
    }
    offset += size;
  }
  return duration;
}

async function reviewMedia(body, userId, previous = {}) {
  const images = body.images ?? [];
  const video = body.video || '';
  if (!Array.isArray(images) || images.length > MAX_REVIEW_IMAGES || typeof video !== 'string') throw Object.assign(new Error('Tối đa 5 ảnh và 1 video'), { status: 400 });
  const local = url => new URL(url, 'http://localhost').pathname;
  const owned = async (url, isVideo) => {
    if (typeof url !== 'string') return false;
    let pathname;
    try { pathname = local(url); } catch { return false; }
    const imageId = pathname.match(/^\/api\/products\/images\/([a-f0-9]{24})$/)?.[1];
    if (!isVideo && imageId) return !!await ProductImage.exists({ _id: imageId, uploadedBy: userId, contentType: { $in: IMAGE_TYPES } });
    const videoId = pathname.match(/^\/api\/products\/review-videos\/([a-f0-9]{24})$/)?.[1];
    if (isVideo && videoId) return !!await require('mongoose').connection.db.collection('reviewVideos.files').findOne({ _id: new (require('mongoose').Types.ObjectId)(videoId), 'metadata.uploadedBy': userId });
    // Giữ khả năng chỉnh sửa đánh giá cũ trong lúc chuyển file lên MongoDB.
    return pathname.startsWith('/uploads/reviews/review-' + userId + '-') && /\.mp4$/i.test(pathname) === isVideo && fs.existsSync(path.join(reviewUploadDir, path.basename(pathname)));
  };
  for (const image of images) if (typeof image !== 'string' || (!(previous.images || []).includes(image) && !await owned(image, false))) throw Object.assign(new Error('Ảnh đánh giá không hợp lệ'), { status: 400 });
  if (video && video !== previous.video && !await owned(video, true)) throw Object.assign(new Error('Video đánh giá không hợp lệ'), { status: 400 });
  return { images: images.map(url => (previous.images || []).includes(url) ? url : local(url)), video: video ? local(video) : '' };
}

router.get('/review-videos/:videoId', async (req, res) => {
  try { await sendReviewVideo(req, res); } catch (err) { sendError(res, err); }
});

router.post('/review-images', requireUserId, (req, res) => {
  reviewUpload.fields([{ name: 'images', maxCount: MAX_REVIEW_IMAGES }, { name: 'video', maxCount: 1 }])(req, res, async err => {
    if (err) return res.status(400).json({ success: false, error: 'Tối đa 5 ảnh (5 MB/ảnh) và 1 video MP4 (20 MB, 30 giây)' });
    try {
      const images = req.files?.images || [];
      const video = req.files?.video?.[0];
      if (!images.length && !video) throw new Error('Thiếu ảnh/video');
      if (images.some(f => !IMAGE_EXT[f.mimetype] || f.size > 5 * 1024 * 1024)) throw new Error('Ảnh JPG, PNG, WEBP hoặc GIF tối đa 5 MB/ảnh');
      const imageSignature = f => {
        const b = f.buffer;
        return (f.mimetype === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255)
          || (f.mimetype === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
          || (f.mimetype === 'image/gif' && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6)))
          || (f.mimetype === 'image/webp' && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP');
      };
      if (images.some(f => !imageSignature(f))) throw new Error('Nội dung ảnh không đúng định dạng');
      if (video) {
        const seconds = videoDuration(video.buffer);
        if (video.mimetype !== 'video/mp4' || video.buffer.toString('ascii', 4, 8) !== 'ftyp' || !(seconds > 0 && seconds <= 30)) throw new Error('Video phải là MP4, tối đa 20 MB và 30 giây');
      }
      const urls = await Promise.all(images.map(async file => {
        const image = await ProductImage.create({ data: file.buffer, contentType: file.mimetype, uploadedBy: req.userId });
        return '/api/products/images/' + image._id;
      }));
      res.json({ success: true, urls, video: video ? await saveReviewVideo(video.buffer, req.userId) : '' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
});

/**
 * Trang "Đánh giá" trong tài khoản: mỗi món trong đơn ĐÃ GIAO là 1 dòng — chưa có đánh giá thì vào
 * "Chưa đánh giá", có rồi thì vào "Đã đánh giá" (kèm nội dung để xem lại / sửa).
 * Đánh giá mới lưu orderNumber; đánh giá cũ (trước khi có orderNumber) được gán cho 1 đơn chứa sản phẩm đó.
 */
router.get('/my-reviews', requireUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ userId }).sort({ deliveredAt: -1, _id: -1 }).lean();
    const ids = [...new Set(orders.flatMap(o => (o.items || []).map(i => i.product?.id).filter(Boolean)))];
    const products = await Product.find({ id: { $in: ids } }, { id: 1, name: 1, slug: 1, images: 1, reviews: 1 }).lean();
    const byId = new Map(products.map(p => [p.id, p]));

    const usedLegacy = new Set();
    const pending = [];
    const reviewed = [];
    for (const order of orders) {
      const seen = new Set();
      for (const item of order.items || []) {
        const pid = item.product?.id;
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
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
        else if (order.status === 'DELIVERED') pending.push(entry);
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
  'style', 'color', 'printMaterial', 'sizeCategory', 'spaces', 'workshopId'];

function pickEditable(body) {
  return Object.fromEntries(EDITABLE_FIELDS.filter(f => body[f] !== undefined).map(f => [f, body[f]]));
}


// Đánh giá đăng ngay, không chờ duyệt. Nhân viên chỉ ẩn khi vi phạm (status HIDDEN), phản hồi
// công khai (reply) và ghim đánh giá hay lên đầu (pinned). Client không bao giờ thấy bài bị ẩn.
function toPublicProduct(product) {
  const obj = typeof product.toJSON === 'function' ? product.toJSON() : product;
  const reviews = (obj.reviews || [])
    .filter(r => r.status !== 'HIDDEN')
    .map(({ userId, orderNumber, ...r }) => r.anonymous ? { ...r, author: 'Người mua ẩn danh', avatar: '' } : r)
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

// Chỉ lấy vài sản phẩm theo id (vd các món gắn hotspot trong phòng 3D) — không phải chờ tải cả danh sách.
// GET /api/products/by-ids?ids=a,b,c
const BY_IDS_LIMIT = 60;
router.get('/by-ids', async (req, res) => {
  try {
    const ids = [...new Set(String(req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean))].slice(0, BY_IDS_LIMIT);
    if (!ids.length) return res.json({ success: true, products: [] });
    const products = await Product.find({ id: { $in: ids } }).select('-reviews');
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

// ---------------------------------------------------------------- Tự trả lời đánh giá tốt
// Đánh giá từ 4 sao được shop trả lời bằng mẫu cảm ơn (đổi mẫu theo đánh giá cho đỡ lặp).
// Đánh giá 1–3 sao vẫn để nhân viên trả lời tay. reply.auto = true để admin biết đây là trả lời tự động.
const AUTO_REPLY_MIN_RATING = 4;
const AUTO_REPLY_TEMPLATES = [
  'Cảm ơn bạn đã tin chọn {product}! Luméa rất vui vì sản phẩm làm bạn hài lòng.',
  'Cảm ơn bạn đã dành thời gian đánh giá {product}. Mong {product} sẽ đồng hành cùng không gian sống của bạn thật lâu!',
  'Luméa cảm ơn bạn rất nhiều! Hẹn gặp lại bạn ở những món đồ tiếp theo nhé.',
  'Cảm ơn đánh giá tuyệt vời của bạn! Đội ngũ Luméa sẽ tiếp tục cố gắng để mang đến sản phẩm chất lượng hơn nữa.',
];

/** Đánh giá tốt, đang hiển thị, chưa có phản hồi. */
const needsAutoReply = (review) => review.rating >= AUTO_REPLY_MIN_RATING && review.status !== 'HIDDEN' && !review.reply?.text;

function autoReplyFor(review, productName) {
  const seed = [...String(review.id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const text = AUTO_REPLY_TEMPLATES[seed % AUTO_REPLY_TEMPLATES.length].replaceAll('{product}', productName);
  return { text, date: new Date().toLocaleDateString('vi-VN'), auto: true };
}

// Admin — trả lời một lượt mọi đánh giá tốt chưa phản hồi (dùng cho đánh giá cũ). Không gửi thông báo
// cho khách để tránh dồn hàng nghìn email cùng lúc.
router.post('/reviews/admin/auto-reply', requirePermission('customers.edit'), async (_req, res) => {
  try {
    const products = await Product.find({ reviews: { $elemMatch: { rating: { $gte: AUTO_REPLY_MIN_RATING } } } }, { id: 1, name: 1, reviews: 1 });
    let replied = 0;
    for (const product of products) {
      let changed = false;
      for (const review of product.reviews) {
        if (!needsAutoReply(review)) continue;
        review.reply = autoReplyFor(review, product.name);
        changed = true;
        replied++;
      }
      if (changed) {
        product.markModified('reviews');
        await product.save();
      }
    }
    res.json({ success: true, replied });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — ẩn/hiện, phản hồi công khai, ghim 1 đánh giá.
/**
 * Shop vừa trả lời đánh giá: báo khách trên web (chuông thông báo) và qua email nếu server đã cấu hình
 * SMTP và khách có email. Lỗi gửi thông báo không làm hỏng thao tác trả lời.
 */
async function notifyReviewReply(review, product, replyText) {
  try {
    const link = `/product/${product.slug}`;
    await Notification.create({
      userId: String(review.userId),
      title: 'Luméa đã trả lời đánh giá của bạn',
      message: `Về "${product.name}": ${replyText.slice(0, 140)}${replyText.length > 140 ? '…' : ''}`,
      link,
    });
    if (!isEmailConfigured()) return;
    const user = await User.findById(review.userId, { email: 1, fullName: 1 }).lean().catch(() => null);
    if (!user?.email) return;
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const shopUrl = (process.env.CLIENT_URL || 'http://localhost:4200') + link;
    await getMailTransporter().sendMail({
      from: process.env.MAIL_FROM || `"Luméa" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Luméa đã trả lời đánh giá của bạn về ${product.name}`,
      html: `<p>Xin chào ${esc(user.fullName) || 'bạn'},</p>
        <p>Luméa đã trả lời đánh giá của bạn về <strong>${esc(product.name)}</strong>:</p>
        <blockquote style="border-left:3px solid #A3152D;margin:0;padding:6px 12px;color:#333">${esc(replyText)}</blockquote>
        <p><a href="${shopUrl}">Xem đánh giá trên Luméa</a></p>`,
    });
  } catch (err) {
    console.error('notify review reply error', err.message);
  }
}

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
    let newReply = '';
    if (reply !== undefined) {
      const text = String(reply || '').trim();
      if (text && text !== review.reply?.text) newReply = text;
      review.reply = text ? { text, date: new Date().toLocaleDateString('vi-VN') } : null;
    }
    if (pinned !== undefined) review.pinned = !!pinned;

    product.markModified('reviews');
    await product.save();
    if (newReply && review.userId) await notifyReviewReply(review, product, newReply);
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

// content.edit: nhân viên nội dung tải ảnh khi trả lời bình luận Tin tức.
router.post('/images',requirePermission('products.create', 'products.edit', 'marketing.edit', 'content.edit'), uploadImage('image'), async (req, res) => {
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
    ? Order.exists({ userId, status: 'DELIVERED', 'items.product.id': productId }).then(Boolean)
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
router.post('/:id/reviews', requireUserId, async (req, res) => {
  try {
    const { comment } = req.body;
    const user = await User.findById(req.userId).select('fullName avatar').lean();
    const author = user?.fullName || 'Khách hàng Luméa';
    const avatar = user?.avatar || '';
    const anonymous = req.body.anonymous === true;
    const { images, video } = await reviewMedia(req.body, req.userId);
    const orderNumber = String(req.body.orderNumber || '');
    if (!orderNumber) return res.status(400).json({ success: false, error: 'Vui lòng đánh giá từ đơn đã giao trong Hồ sơ > Đánh giá' });
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

    const order = await Order.exists({ orderNumber, userId, status: 'DELIVERED', 'items.product.id': product.id });
    if (!order) return res.status(403).json({ success: false, error: 'Chỉ đánh giá được sản phẩm trong đơn đã giao của bạn' });

    const review = {
      id: 'rev-' + require('crypto').randomUUID(),
      userId: userId || null,
      author,
      avatar,
      anonymous,
      video,
      rating,
      date: new Date().toLocaleDateString('vi-VN'),
      createdAt: new Date().toISOString(),
      comment,
      verifiedPurchase: true,
      images,
      orderNumber,
      status: 'VISIBLE',
    };
    if (needsAutoReply(review)) review.reply = autoReplyFor(review, product.name);

    const added = await Product.updateOne({
      _id: product._id,
      reviews: { $not: { $elemMatch: { userId, orderNumber } } },
    }, { $push: { reviews: { $each: [review], $position: 0 } } });
    if (!added.modifiedCount) return res.status(409).json({ success: false, error: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi' });
    // Báo ngay cho nhân viên đang mở my-admin (chuông thông báo + toast).
    emitToStaff('review:new', { productName: product.name, author, rating });

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

    res.json({ success: true, review });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
    console.error('submit review error', err);
    sendError(res, err);
  }
});

// "Xem lại đánh giá" -> sửa số sao / nội dung / ảnh của đánh giá do chính khách viết.
router.put('/:id/reviews/:reviewId', requireUserId, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '');
    const anonymous = req.body.anonymous === true;
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
    const previous = product.reviews[idx];
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    if (previous.editedAt || !previous.createdAt || previous.createdAt < cutoff) return res.status(409).json({ success: false, error: 'Chỉ được sửa một lần trong 30 ngày kể từ ngày đăng' });
    const { images, video } = await reviewMedia(req.body, req.userId, previous);
    const editedAt = new Date().toISOString();
    // Trả lời tự động đi theo số sao: hạ xuống dưới 4 sao thì gỡ lời cảm ơn để nhân viên trả lời tay,
    // nâng lên từ 4 sao mà chưa có phản hồi thì tự trả lời. Phản hồi nhân viên viết tay giữ nguyên.
    let reply = previous.reply || null;
    if (reply?.auto && rating < AUTO_REPLY_MIN_RATING) reply = null;
    if (needsAutoReply({ ...previous, rating, reply })) reply = autoReplyFor(previous, product.name);
    const result = await Product.updateOne({
      _id: product._id,
      reviews: { $elemMatch: { id: previous.id, userId: req.userId, createdAt: { $gte: cutoff }, editedAt: { $exists: false } } },
    }, { $set: { 'reviews.$.rating': rating, 'reviews.$.comment': comment, 'reviews.$.images': images, 'reviews.$.video': video, 'reviews.$.anonymous': anonymous, 'reviews.$.editedAt': editedAt, 'reviews.$.reply': reply } });
    if (!result.modifiedCount) return res.status(409).json({ success: false, error: 'Đánh giá đã được sửa hoặc đã hết hạn' });
    const review = { ...previous, rating, comment, images, video, anonymous, editedAt, reply };
    res.json({ success: true, review });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
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
