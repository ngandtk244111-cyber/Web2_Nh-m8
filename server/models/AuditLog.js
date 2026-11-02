const mongoose = require('mongoose');

// Nhật ký thao tác của nhân viên. Tài khoản, IP và thời gian do server ghi, không nhận từ client.
const auditLogSchema = new mongoose.Schema({
  adminId: { type: String, default: null },
  actor: { type: String, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true },
  detail: { type: String, default: '' },
  level: { type: String, enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'], default: 'INFO' },
  ip: { type: String, default: '' },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
