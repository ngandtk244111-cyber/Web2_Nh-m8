const mongoose = require('mongoose');

// Nhật ký trao đổi với xưởng đối tác (gọi điện, Zalo, email, gặp trực tiếp): ai liên hệ, lúc nào,
// nội dung gì — để cả nhóm nắm tiến độ đặt hàng / thoả thuận với xưởng. Chỉ thêm, không sửa / xoá.
const workshopContactSchema = new mongoose.Schema({
  workshopId: { type: String, required: true, index: true },
  channel: { type: String, enum: ['PHONE', 'ZALO', 'EMAIL', 'MEETING', 'OTHER'], default: 'OTHER' },
  note: { type: String, required: true },
  attachments: {
    type: [{ id: String, name: String, contentType: String, size: Number, url: String, _id: false }],
    default: [],
  },
  by: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('WorkshopContact', workshopContactSchema);
