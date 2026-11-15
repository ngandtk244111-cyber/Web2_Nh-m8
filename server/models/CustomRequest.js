const mongoose = require('mongoose');

const customRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  requestCode: { type: String, required: true, unique: true },
  createdAt: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
  title: { type: String, required: true },
  // Chủ yêu cầu (null nếu khách gửi khi chưa đăng nhập) — GET / chỉ trả yêu cầu của đúng user này.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, default: '' },
  status: {
    type: String,
    enum: ['PENDING_REVIEW', 'QUOTED', 'IN_DISCUSSION', 'PREVIEW_READY', 'APPROVED', 'CONVERTED_TO_ORDER', 'REJECTED'],
    default: 'PENDING_REVIEW',
  },
  brief: { type: mongoose.Schema.Types.Mixed, required: true },
  customerImages: { type: [String], default: [] },
  aiConceptImage: { type: String, default: null },
  quotationPrice: { type: Number, default: null },
  estimatedDays: { type: Number, default: null },
  adminNote: { type: String, default: '' },
  preview3dModelType: { type: String, default: null },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // Báo giá hiện hành (model Quote) và đơn đã tạo từ báo giá. quotationPrice/estimatedDays ở trên
  // được giữ để tương thích dữ liệu cũ và hiển thị nhanh, luôn đồng bộ theo báo giá đã gửi mới nhất.
  currentQuoteVersion: { type: Number, default: null },
  acceptedQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
  orderNumber: { type: String, default: null },
});

module.exports = mongoose.model('CustomRequest', customRequestSchema);
