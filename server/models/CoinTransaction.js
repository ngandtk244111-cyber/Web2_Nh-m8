const mongoose = require('mongoose');

/** Hạn sử dụng của xu: mỗi lần nhận xu có hiệu lực COIN_TTL_DAYS ngày kể từ lúc nhận. */
const COIN_TTL_DAYS = 365;

const coinTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true }, // e.g. 'STYLE_QUIZ', 'ORDER_COMPLETED'
  refId: { type: String, default: null }, // idempotency key scoped to (user, reason)
  note: { type: String, default: '' },
  /** Chỉ có ở giao dịch cộng xu (amount > 0). Giao dịch cũ chưa có field này → tính từ createdAt (xem utils/coins). */
  expiresAt: {
    type: Date,
    default: function () {
      return this.amount > 0 ? new Date(Date.now() + COIN_TTL_DAYS * 24 * 60 * 60 * 1000) : null;
    },
  },
}, { timestamps: true });

// A given user can only be rewarded once per (reason, refId) pair.
coinTransactionSchema.index({ user: 1, reason: 1, refId: 1 }, { unique: true, partialFilterExpression: { refId: { $type: 'string' } } });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
module.exports.COIN_TTL_DAYS = COIN_TTL_DAYS;
