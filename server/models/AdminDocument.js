const mongoose = require('mongoose');

// Chứng từ nhân viên tải lên
const adminDocumentSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  name: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AdminDocument', adminDocumentSchema);
