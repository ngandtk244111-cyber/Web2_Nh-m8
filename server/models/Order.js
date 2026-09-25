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
  paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER', 'MOMO', 'ZALOPAY', 'ATM'], required: true },
  // FAILED: cổng MoMo/ZaloPay báo giao dịch thất bại (IPN).
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID', 'FAILED'], default: 'UNPAID' },
  // Khách bấm "Tôi đã chuyển khoản" — chỉ là báo, nhân viên đối soát sao kê rồi mới chuyển PAID.
  transferReportedAt: { type: Date, default: null },
  paidConfirmedBy: { type: String, default: null },
  cancelReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  // --- Cơ chế COD ---
  // Nhân viên gọi xác nhận với khách trước khi giao (bắt buộc với COD) — giảm đơn ảo/bom hàng.
  phoneConfirmedAt: { type: Date, default: null },
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
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
