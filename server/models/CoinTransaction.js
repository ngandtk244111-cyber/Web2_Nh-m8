const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true }, // e.g. 'STYLE_QUIZ', 'ORDER_COMPLETED'
  refId: { type: String, default: null }, // idempotency key scoped to (user, reason)
  note: { type: String, default: '' },
}, { timestamps: true });

// A given user can only be rewarded once per (reason, refId) pair.
coinTransactionSchema.index({ user: 1, reason: 1, refId: 1 }, { unique: true, partialFilterExpression: { refId: { $type: 'string' } } });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
