const mongoose = require('mongoose');

// Ảnh sản phẩm my-admin tải lên, lưu nhị phân trong MongoDB để không mất khi server deploy lại.
// Tách collection riêng: Product.images chỉ giữ URL, danh sách sản phẩm không phải tải theo dữ liệu ảnh.
const productImageSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  uploadedBy: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('ProductImage', productImageSchema);
