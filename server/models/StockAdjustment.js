const mongoose = require('mongoose');

// Phiếu nhập / xuất điều chỉnh tồn kho KHÔNG qua xưởng (khách trả hàng, kiểm kê, hàng lỗi...).
// Bắt buộc lý do + chứng từ đính kèm để đối soát; ghi kèm lúc cộng/trừ tồn, không sửa / xoá.
const stockAdjustmentSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  type: { type: String, enum: ['IN', 'OUT'], required: true },
  qty: { type: Number, required: true, min: 1 },
  stockAfter: { type: Number, default: null },
  reason: { type: String, required: true },
  note: { type: String, default: '' },
  attachments: {
    type: [{ id: String, name: String, contentType: String, size: Number, url: String, _id: false }],
    default: [],
  },
  by: { type: String, default: '' },
}, { timestamps: true });

stockAdjustmentSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('StockAdjustment', stockAdjustmentSchema);
