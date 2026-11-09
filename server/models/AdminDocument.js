const mongoose = require('mongoose');

// Chứng từ nhân viên tải lên: hoá đơn / phiếu giao nhận kèm lần nhập - xuất kho, hợp đồng với xưởng.
// Lưu nhị phân trong MongoDB (như ảnh sản phẩm) để không mất khi deploy lại; chỉ nhân viên đã đăng
// nhập mới tải xuống được (routes/adminDocumentRoutes.js) vì đây là giấy tờ nội bộ.
const adminDocumentSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  name: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AdminDocument', adminDocumentSchema);
