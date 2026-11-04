const express = require('express');
const { sendError } = require('../utils/http-error');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { createAdminToken, requireAdminId } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { getAdminAccess } = require('../utils/permissions');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin || !admin.active) {
      return res.status(401).json({ success: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const matched = await bcrypt.compare(password, admin.password);
    if (!matched) {
      return res.status(401).json({ success: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    admin.lastLogin = new Date();
    await admin.save();
    await writeAudit(req, admin, { module: 'Hệ Thống', action: 'Đăng nhập', detail: 'Đăng nhập thành công' });

    res.json({ success: true, admin, token: createAdminToken(admin), ...(await getAdminAccess(admin)) });
  } catch (err) {
    console.error('admin login error', err);
    sendError(res, err);
  }
});

// my-admin gọi khi mở trang để biết quyền hiện tại, ẩn các tab không được xem.
router.get('/me', requireAdminId, async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId);
    res.json({ success: true, admin, ...(await getAdminAccess(admin)) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/change-password', requireAdminId, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }

    const admin = await Admin.findById(req.adminId);
    if (!(await bcrypt.compare(oldPassword, admin.password))) {
      return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không đúng' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    await writeAudit(req, admin, { module: 'Bảo Mật', action: 'Đổi mật khẩu', detail: 'Đổi mật khẩu tài khoản quản trị', level: 'WARNING' });

    // Token cũ đã mất hiệu lực vì được ký kèm hash mật khẩu — cấp token mới cho phiên hiện tại.
    res.json({ success: true, token: createAdminToken(admin) });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
