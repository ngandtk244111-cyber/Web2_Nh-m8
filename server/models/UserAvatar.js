const mongoose = require('mongoose');

// Ảnh đại diện lưu nhị phân trong MongoDB để không mất khi server deploy lại. User.avatar giữ đường dẫn
// tới ảnh này. Mỗi lần đổi avatar là 1 document mới (URL mới, không bị cache cũ) và xoá document cũ.
const userAvatarSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('UserAvatar', userAvatarSchema);
