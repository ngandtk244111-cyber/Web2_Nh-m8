const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const router = express.Router();

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

    res.json({ success: true, admin });
  } catch (err) {
    console.error('admin login error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
