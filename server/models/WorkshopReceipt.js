const mongoose = require('mongoose');

// Lịch sử giao nhận: mỗi lần xưởng giao hàng thành phẩm và Luméa nhập kho (nút "Nhập từ xưởng" ở
// trang Tồn kho) là 1 dòng. Ghi kèm lúc cộng tồn kho, không sửa / xoá.
const workshopReceiptSchema = new mongoose.Schema({
  workshopId: { type: String, required: true },
  // Chụp lại tên lúc nhập để xưởng đổi tên / bị xoá vẫn đọc được lịch sử.
  workshopName: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  stockAfter: { type: Number, default: null },
  note: { type: String, default: '' },
  // Hoá đơn / phiếu giao nhận / ảnh hàng hoá kèm lô hàng (routes/adminDocumentRoutes.js).
  attachments: {
    type: [{ id: String, name: String, contentType: String, size: Number, url: String, _id: false }],
    default: [],
  },
  by: { type: String, default: '' },
}, { timestamps: true });

workshopReceiptSchema.index({ workshopId: 1, createdAt: -1 });
workshopReceiptSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('WorkshopReceipt', workshopReceiptSchema);
