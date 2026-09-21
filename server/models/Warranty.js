const mongoose = require('mongoose');

const warrantySchema = new mongoose.Schema({
  warrantyCode: { type: String, required: true, unique: true },
  orderNumber: { type: String, required: true },
  productName: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  purchasedAt: { type: Date, required: true },
  warrantyMonths: { type: Number, default: 12 },
  status: { type: String, enum: ['ACTIVE', 'CLAIMED', 'EXPIRED'], default: 'ACTIVE' },
  claimHistory: [{
    note: String,
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

warrantySchema.virtual('expiresAt').get(function () {
  const d = new Date(this.purchasedAt);
  d.setMonth(d.getMonth() + this.warrantyMonths);
  return d;
});

warrantySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Warranty', warrantySchema);
