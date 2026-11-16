const multer = require('multer');
const mongoose = require('mongoose');
const UserData = require('../models/UserData');
const CustomRequest = require('../models/CustomRequest');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Order = require('../models/Order');
const AdminConfig = require('../models/AdminConfig');
const NewsComment = require('../models/NewsComment');
const CommunityPost = require('../models/CommunityPost');
const Warranty = require('../models/Warranty');
const { validId } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Không nhận SVG: ảnh phục vụ từ domain API, SVG có thể chứa script.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const INVALID_TYPE_ERROR = 'File phải là ảnh JPG, PNG, WEBP hoặc GIF';
const PRODUCT_IMAGE_PATH = '/api/products/images/';

// Bọc multer để lỗi file quá lớn trả 400 tiếng Việt, không rơi vào error handler chung (500).
function uploadImage(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, err => {
      if (!err) return next();
      const error = err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh không được vượt quá 5MB' : 'Không đọc được file ảnh';
      res.status(400).json({ success: false, error });
    });
  };
}

/** Trả ảnh lưu trong MongoDB. Mỗi lần tải lên là 1 id mới nên nội dung theo id không đổi, cho cache dài. */
async function sendStoredImage(Model, rawId, res) {
  const id = validId(rawId);
  const image = id && await Model.findById(id).lean();
  if (!image) return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh' });

  res.set({
    'Content-Type': image.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(image.data.buffer ?? image.data));
}

function productImageId(url) {
  const index = String(url || '').lastIndexOf(PRODUCT_IMAGE_PATH);
  return index < 0 ? null : validId(String(url).slice(index + PRODUCT_IMAGE_PATH.length));
}

function isProductImageUsed(id) {
  const pattern = new RegExp(`${PRODUCT_IMAGE_PATH}${id}$`);
  return Promise.all([
    Product.exists({ $or: [{ images: pattern }, { 'reviews.images': pattern }] }),
    // Đơn cũ giữ bản sao sản phẩm, vẫn hiển thị ảnh tại thời điểm đặt hàng.
    Order.exists({ 'items.product.images': pattern }),
    // Banner dùng chung kho ảnh này khi admin tải ảnh lên ở tab Banner.
    AdminConfig.exists({ key: 'banners', 'value.imageUrl': pattern }),
    // Shop trả lời bình luận Tin tức kèm ảnh cũng lưu ở kho ảnh này.
    NewsComment.exists({ imageUrl: pattern }),
    CommunityPost.exists({ imageUrl: pattern }),
    Warranty.exists({ 'claimHistory.images': pattern }),
    UserData.exists({ 'cart.customProduct.images': pattern }),
    CustomRequest.exists({ $or: [{ customerImages: pattern }, { aiConceptImage: pattern }] }),
  ]).then(references => references.some(Boolean));
}

/** Xoá các ảnh trong `urls` đã không còn sản phẩm, đơn hàng hay banner nào dùng. Lỗi dọn dẹp không làm hỏng thao tác chính. */
async function removeUnusedProductImages(urls) {
  try {
    for (const id of new Set((urls || []).map(productImageId).filter(Boolean))) {
      if (!(await isProductImageUsed(id))) await ProductImage.deleteOne({ _id: id });
    }
  } catch (err) {
    console.error('product image cleanup error', err);
  }
}

// Video đánh giá có thể lớn hơn giới hạn document MongoDB: lưu theo chunk bằng GridFS.
function reviewVideos() { return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'reviewVideos' }); }
async function saveReviewVideo(buffer, uploadedBy, id) {
  const bucket = reviewVideos();
  const stream = bucket.openUploadStreamWithId(id ? new mongoose.Types.ObjectId(id) : new mongoose.Types.ObjectId(), 'review.mp4', { metadata: { uploadedBy, contentType: 'video/mp4' } });
  await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); stream.end(buffer); });
  return '/api/products/review-videos/' + stream.id;
}
async function sendReviewVideo(req, res) {
  const id = validId(req.params.videoId);
  const file = id && await mongoose.connection.db.collection('reviewVideos.files').findOne({ _id: new mongoose.Types.ObjectId(id) });
  if (!file) return res.status(404).json({ success: false, error: 'Không tìm thấy video' });
  let start = 0, end = file.length - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, file.length - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
    }
    if (!match || (!match[1] && !match[2]) || start > end || start >= file.length) return res.status(416).set('Content-Range', 'bytes */' + file.length).end();
    res.status(206).set('Content-Range', 'bytes ' + start + '-' + end + '/' + file.length);
  }
  res.set({ 'Content-Type': 'video/mp4', 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  const stream = reviewVideos().openDownloadStream(file._id, { start, end: end + 1 });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

module.exports = { saveReviewVideo, sendReviewVideo, IMAGE_TYPES, INVALID_TYPE_ERROR, uploadImage, sendStoredImage, removeUnusedProductImages, isProductImageUsed };
