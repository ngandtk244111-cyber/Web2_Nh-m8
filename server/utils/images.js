const multer = require('multer');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Order = require('../models/Order');
const AdminConfig = require('../models/AdminConfig');
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
    Product.exists({ images: pattern }),
    // Đơn cũ giữ bản sao sản phẩm, vẫn hiển thị ảnh tại thời điểm đặt hàng.
    Order.exists({ 'items.product.images': pattern }),
    // Banner dùng chung kho ảnh này khi admin tải ảnh lên ở tab Banner.
    AdminConfig.exists({ key: 'banners', 'value.imageUrl': pattern }),
  ]).then(([product, order, banner]) => !!(product || order || banner));
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

module.exports = { IMAGE_TYPES, INVALID_TYPE_ERROR, uploadImage, sendStoredImage, removeUnusedProductImages, isProductImageUsed };
