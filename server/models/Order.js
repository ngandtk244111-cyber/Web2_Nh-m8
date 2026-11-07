const mongoose = require('mongoose');

// CartItem giữ nguyên hình dạng như model FE (product đầy đủ + qty + customization)
// để OrderService FE không phải remap dữ liệu khi chuyển từ localStorage sang backend thật.
const orderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  product: { type: mongoose.Schema.Types.Mixed, required: true },
  quantity: { type: Number, required: true },
  selectedCustomization: { type: mongoose.Schema.Types.Mixed, default: null },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  // Mã phiếu bảo hành, cấp khi đơn giao thành công (utils/warranty.js).
  warrantyCode: { type: String },
}, { _id: false });

const productionProgressSchema = new mongoose.Schema({
  currentStep: {
    type: String,
    enum: ['FILE_PREPARATION', '3D_PRINTING', 'POST_PROCESSING', 'ASSEMBLY_TESTING', 'PACKAGING', 'DISPATCHED'],
  },
  percentage: { type: Number, default: 0 },
  stepTitle: { type: String, default: '' },
  notes: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  street: { type: String, required: true },
  district: { type: String, required: true },
  city: { type: String, required: true },
  notes: { type: String, default: '' },
}, { _id: false });

// Yêu cầu xuất hoá đơn điện tử lúc đặt hàng (cá nhân hoặc công ty) — dùng để in thông tin người mua lên PDF.
const invoiceSchema = new mongoose.Schema({
  requested: { type: Boolean, default: false },
  type: { type: String, enum: ['personal', 'company'], default: 'personal' },
  email: { type: String, default: '' },
  companyName: { type: String, default: '' },
  taxCode: { type: String, default: '' },
  companyAddress: { type: String, default: '' },
  sentAt: { type: Date, default: null },
}, { _id: false });

// Yêu cầu trả hàng / hoàn tiền của khách sau khi đã nhận hàng (khác returnReason = giao thất bại).
// PENDING: chờ shop duyệt -> APPROVED: đang hoàn (shop nhận lại hàng, hoàn tiền) -> COMPLETED: đã hoàn/trả.
// REJECTED: shop từ chối (kèm lý do). Khách huỷ yêu cầu khi còn PENDING thì xoá hẳn returnRequest.
const returnRequestSchema = new mongoose.Schema({
  status: { type: String, enum: ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'], default: 'PENDING' },
  reason: { type: String, required: true },
  description: { type: String, default: '' },
  refundAmount: { type: Number, default: 0 },
  adminNote: { type: String, default: '' },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
}, { _id: false });

// Hoàn tiền khi đơn đã trả trước bị huỷ (utils/refund-policy.js). PENDING: chờ hoàn, hạn dueAt ->
// COMPLETED: đã hoàn (kèm mã giao dịch). VOID: không cần hoàn (vd. khách báo CK nhưng tiền chưa về).
const refundSchema = new mongoose.Schema({
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'VOID'], default: 'PENDING' },
  amount: { type: Number, default: 0 },
  channel: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  accountHolder: { type: String, default: '' },
  requestedAt: { type: Date, default: Date.now },
  dueAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  transactionRef: { type: String, default: '' },
  adminNote: { type: String, default: '' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAtLabel: { type: String, default: '' },
  status: {
    type: String,
    // RETURNED: giao thất bại / khách không nhận (bom hàng), hàng hoàn về kho.
    enum: ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
    default: 'CONFIRMED',
  },
  hasPrintOnDemandItems: { type: Boolean, default: false },
  productionProgress: { type: productionProgressSchema, default: null },
  items: { type: [orderItemSchema], required: true },
  shippingAddress: { type: shippingAddressSchema, required: true },
  invoice: { type: invoiceSchema, default: null },
  returnRequest: { type: returnRequestSchema, default: null },
  refund: { type: refundSchema, default: null },
  paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER', 'MOMO', 'ZALOPAY', 'ATM'], required: true },
  // FAILED: cổng MoMo/ZaloPay báo giao dịch thất bại (IPN). REFUNDED: đơn huỷ đã hoàn tiền xong.
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'], default: 'UNPAID' },
  // Khách bấm "Tôi đã chuyển khoản" — chỉ là báo, nhân viên đối soát sao kê rồi mới chuyển PAID.
  transferReportedAt: { type: Date, default: null },
  paidConfirmedBy: { type: String, default: null },
  cancelReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  // --- Cơ chế COD ---
  // Nhân viên gọi xác nhận với khách trước khi giao (bắt buộc với COD) — giảm đơn ảo/bom hàng.
  phoneConfirmedAt: { type: Date, default: null },
  // Chốt lúc đặt theo ngưỡng trong Cài đặt (utils/cod-policy.js): false = đơn COD nhỏ, giao không cần gọi.
  // Đơn cũ không có trường này coi như phải gọi.
  phoneConfirmRequired: { type: Boolean, default: true },
  phoneConfirmedBy: { type: String, default: null },
  // Shipper đã thu tiền COD khi giao thành công; tiền còn nằm ở hãng vận chuyển tới khi đối soát
  // (lúc đó nhân viên xác nhận → paymentStatus PAID).
  codCollectedAt: { type: Date, default: null },
  // Giao thất bại / khách không nhận hàng → hoàn về kho (status RETURNED).
  returnReason: { type: String, default: '' },
  returnedAt: { type: Date, default: null },
  // Vận đơn của hãng vận chuyển (xem utils/shipping.js).
  shipment: {
    type: new mongoose.Schema({
      carrier: { type: String, required: true },
      carrierName: { type: String, default: '' },
      trackingCode: { type: String, default: '' },
      trackingUrl: { type: String, default: '' },
      fee: { type: Number, default: 0 },
      note: { type: String, default: '' },
      shippedAt: { type: Date, default: null },
      createdBy: { type: String, default: null },
    }, { _id: false }),
    default: null,
  },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  notes: { type: String, default: '' },
  paymentTransactionId: { type: String, default: '' },
  // Đơn này đã trừ kho và chưa hoàn. Đơn tạo trước khi có trừ kho mặc định false, huỷ không cộng kho.
  stockReserved: { type: Boolean, default: false },
}, {
  timestamps: true,
  // Id nhân viên không gửi ra ngoài, frontend không đọc các field này. Đơn cũ từng sao chép cả
  // đánh giá của sản phẩm (có tên khách khác) nên cũng bỏ khi trả về.
  toJSON: {
    transform(_doc, ret) {
      delete ret.paidConfirmedBy;
      delete ret.phoneConfirmedBy;
      if (ret.shipment) delete ret.shipment.createdBy;
      (ret.items || []).forEach(item => { if (item.product) delete item.product.reviews; });
      return ret;
    },
  },
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'items.product.id': 1 });
orderSchema.index({ 'items.product.images': 1 });
orderSchema.index({ paymentTransactionId: 1 });

// Realtime: mọi thay đổi đơn hàng (route orders/payments, dù dùng save() hay findOneAndUpdate)
// đều được đẩy tới trang Tra cứu đơn đang mở mã đơn đó — không phải thêm lệnh emit ở từng route.
const { emitOrderUpdated } = require('../realtime');

orderSchema.post('save', function (doc) {
  emitOrderUpdated(doc);
});

orderSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;
  try {
    // Hook nhận bản trước khi sửa nếu route không truyền { new: true } — đọc lại bản mới nhất.
    const fresh = await this.model.findOne({ orderNumber: doc.orderNumber });
    emitOrderUpdated(fresh || doc);
  } catch (err) {
    console.error('order realtime emit error', err);
  }
});

module.exports = mongoose.model('Order', orderSchema);
