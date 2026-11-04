const AuditLog = require('../models/AuditLog');

/** Ghi 1 dòng nhật ký; lỗi ghi log không được làm hỏng thao tác chính. */
async function writeAudit(req, admin, { module, action, detail = '', level = 'INFO' }) {
  try {
    return await AuditLog.create({
      adminId: String(admin._id),
      actor: admin.fullName ? `${admin.username} (${admin.fullName})` : admin.username,
      module,
      action,
      detail,
      level,
      ip: req.ip || '',
    });
  } catch (err) {
    console.error('audit log error', err);
    return null;
  }
}

module.exports = { writeAudit };
