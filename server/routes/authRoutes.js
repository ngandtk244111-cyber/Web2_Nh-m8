const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const OtpCode = require('../models/OtpCode');
const { generateOtpCode, sendOtpSms } = require('../utils/otp');
const { requireUserId } = require('../middleware/auth');
const { awardCoins } = require('../utils/coins');

const PROFILE_COMPLETE_REWARD = 20;

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/avatars');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const PHONE_REGEX = /^0\d{9}$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_OTP_WINDOW_MS = 10 * 60 * 1000;

// Xác nhận đã có OTP xác thực thành công (consumed) cho SĐT này trong ít phút gần đây, rồi
// xoá hết OTP của SĐT đó để không dùng lại được — bắt buộc phải gọi trước khi cho phép
// register/reset-password, tránh chiếm tài khoản chỉ bằng cách biết số điện thoại.
async function consumeVerifiedOtp(phoneNumber) {
  const otpDoc = await OtpCode.findOne({ phoneNumber, consumed: true }).sort({ updatedAt: -1 });
  if (!otpDoc || Date.now() - otpDoc.updatedAt.getTime() > VERIFIED_OTP_WINDOW_MS) {
    return false;
  }
  await OtpCode.deleteMany({ phoneNumber });
  return true;
}

function validatePasswordStrength(password) {
  // Tối thiểu 8 ký tự, 1 chữ in hoa, 1 ký tự đặc biệt (tham khảo quy tắc mật khẩu VitaCare-main).
  if (!password || password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự.';
  if (!/[A-Z]/.test(password)) return 'Mật khẩu cần tối thiểu 1 chữ in hoa.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Mật khẩu cần tối thiểu 1 ký tự đặc biệt.';
  return null;
}

async function issueOtp(phoneNumber) {
  const code = generateOtpCode();
  await OtpCode.create({
    phoneNumber,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendOtpSms(phoneNumber, code);
  return code;
}

function devOtpField(code) {
  return process.env.OTP_DEV_MODE === 'true' ? { devOtp: code } : {};
}

// ===================== ĐĂNG KÝ (OTP xác thực SĐT rồi đặt mật khẩu) =====================

router.post('/register-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || !PHONE_REGEX.test(phoneNumber)) {
      return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ (VD: 0912345678)' });
    }
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Số điện thoại đã được đăng ký.' });
    }
    const code = await issueOtp(phoneNumber);
    res.json({ success: true, message: 'Đã gửi mã OTP', ...devOtpField(code) });
  } catch (err) {
    console.error('register-otp error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/verify-otp-any', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: 'Thiếu số điện thoại hoặc mã OTP' });
    }
    const otpDoc = await OtpCode.findOne({ phoneNumber, code: otp, consumed: false }).sort({ createdAt: -1 });
    if (!otpDoc || otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Mã OTP không đúng hoặc đã hết hạn' });
    }
    otpDoc.consumed = true;
    await otpDoc.save();
    res.json({ success: true });
  } catch (err) {
    console.error('verify-otp-any error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !PHONE_REGEX.test(phoneNumber)) {
      return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ' });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Số điện thoại đã được đăng ký.' });
    }
    if (!(await consumeVerifiedOtp(phoneNumber))) {
      return res.status(400).json({ success: false, error: 'Vui lòng xác thực mã OTP trước khi đăng ký.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ phoneNumber, password: hashed, lastLogin: new Date() });
    res.json({ success: true, user });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===================== ĐĂNG NHẬP (SĐT + mật khẩu, không JWT) =====================

router.post('/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập số điện thoại và mật khẩu' });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Thông tin đăng nhập sai, vui lòng thử lại.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Thông tin đăng nhập sai, vui lòng thử lại.' });
    }
    user.lastLogin = new Date();
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===================== QUÊN MẬT KHẨU (OTP rồi đặt mật khẩu mới) =====================

router.post('/forgot-password', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || !PHONE_REGEX.test(phoneNumber)) {
      return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ' });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Số điện thoại chưa đăng ký.' });
    }
    const code = await issueOtp(phoneNumber);
    res.json({ success: true, message: 'Đã gửi mã OTP', ...devOtpField(code) });
  } catch (err) {
    console.error('forgot-password error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: 'Thiếu số điện thoại hoặc mã OTP' });
    }
    const otpDoc = await OtpCode.findOne({ phoneNumber, code: otp, consumed: false }).sort({ createdAt: -1 });
    if (!otpDoc || otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Mã OTP không đúng hoặc đã hết hạn' });
    }
    otpDoc.consumed = true;
    await otpDoc.save();
    res.json({ success: true });
  } catch (err) {
    console.error('verify-otp error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { phoneNumber, newPassword } = req.body;
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    if (!(await consumeVerifiedOtp(phoneNumber))) {
      return res.status(400).json({ success: false, error: 'Vui lòng xác thực mã OTP trước khi đặt lại mật khẩu.' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('reset-password error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===================== HỒ SƠ / AVATAR =====================

router.get('/me', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/profile', requireUserId, async (req, res) => {
  try {
    const { fullName, email, address, gender, dateOfBirth } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    await user.save();

    // Thưởng 1 lần khi hồ sơ có đủ họ tên/email/giới tính/ngày sinh.
    if (user.fullName?.trim() && user.email?.trim() && user.gender && user.dateOfBirth?.trim()) {
      const reward = await awardCoins({
        userId: user._id,
        reason: 'PROFILE_COMPLETE',
        refId: 'profile-complete',
        amount: PROFILE_COMPLETE_REWARD,
        note: 'Hoàn thiện hồ sơ cá nhân',
      });
      if (reward) user.coins = reward.coins;
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/avatar', requireUserId, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Thiếu file ảnh' });

    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
    const filename = `avatar-${req.userId}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: `/uploads/avatars/${filename}` },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    res.json({ success: true, user });
  } catch (err) {
    console.error('avatar upload error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===================== SỔ ĐỊA CHỈ =====================

router.get('/addresses', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/addresses', requireUserId, async (req, res) => {
  try {
    const { label, fullName, phone, city, district, ward, address, isDefault } = req.body || {};
    if (!fullName || !phone) {
      return res.status(400).json({ success: false, error: 'Thiếu họ tên hoặc số điện thoại' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    if (isDefault) user.addresses.forEach(a => { a.isDefault = false; });
    const setDefault = !!isDefault || user.addresses.length === 0;

    user.addresses.push({
      label: label || 'Nhà riêng',
      fullName, phone,
      city: city || '', district: district || '', ward: ward || '',
      address: address || '',
      isDefault: setDefault,
    });
    await user.save();

    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    console.error('add address error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/addresses/:addressId', requireUserId, async (req, res) => {
  try {
    const { label, fullName, phone, city, district, ward, address, isDefault } = req.body || {};
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, error: 'Không tìm thấy địa chỉ' });

    if (label !== undefined) addr.label = label;
    if (fullName !== undefined) addr.fullName = fullName;
    if (phone !== undefined) addr.phone = phone;
    if (city !== undefined) addr.city = city;
    if (district !== undefined) addr.district = district;
    if (ward !== undefined) addr.ward = ward;
    if (address !== undefined) addr.address = address;
    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
      addr.isDefault = true;
    }

    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/addresses/:addressId', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, error: 'Không tìm thấy địa chỉ' });

    const wasDefault = addr.isDefault;
    user.addresses.pull(req.params.addressId);
    if (wasDefault && user.addresses.length > 0) user.addresses[0].isDefault = true;

    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/addresses/:addressId/default', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, error: 'Không tìm thấy địa chỉ' });

    user.addresses.forEach(a => { a.isDefault = false; });
    addr.isDefault = true;
    await user.save();

    res.json({ success: true, addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
