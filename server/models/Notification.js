const mongoose = require('mongoose');

// userId = null nghĩa là thông báo chung (mọi người xem được, kể cả khách chưa đăng nhập)
const notificationSchema = new mongoose.Schema({
  userId: { type: String, default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: null },
  read: { type: Boolean, default: false },
  visibleAt: { type: Date, default: null },
  refKey: { type: String, default: null },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, refKey: 1 });

const { emitNotificationUpdated } = require('../realtime');
notificationSchema.post('save', doc => emitNotificationUpdated(doc));
notificationSchema.post('insertMany', docs => docs.forEach(emitNotificationUpdated));

// The deterministic id makes a repeated order/quote event idempotent, including concurrent writes.
notificationSchema.statics.notifyUser = async function (userId, data) {
  if (!userId) return;
  try {
    const id = require('crypto').createHash('sha256').update(String(userId) + ':' + data.refKey).digest('hex').slice(0, 24);
    const result = await this.findOneAndUpdate({ _id: id }, { $setOnInsert: { ...data, userId: String(userId), read: false } }, { upsert: true, new: true, includeResultMetadata: true });
    if (!result.lastErrorObject?.updatedExisting) emitNotificationUpdated(result.value);
  } catch (err) { if (err.code !== 11000) console.error('Customer notification error', err.message); }
};

module.exports = mongoose.model('Notification', notificationSchema);
