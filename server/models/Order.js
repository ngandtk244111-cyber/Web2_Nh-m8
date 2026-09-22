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
    enum: ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'CONFIRMED',
  },
  hasPrintOnDemandItems: { type: Boolean, default: false },
  productionProgress: { type: productionProgressSchema, default: null },
  items: { type: [orderItemSchema], required: true },
  shippingAddress: { type: shippingAddressSchema, required: true },
  paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER', 'MOMO', 'ZALOPAY', 'ATM'], required: true },
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID' },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  notes: { type: String, default: '' },
  paymentTransactionId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
