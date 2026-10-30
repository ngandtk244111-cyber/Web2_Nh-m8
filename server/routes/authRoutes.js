const express = require('express');
const { sendError } = require('../utils/http-error');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const OtpCode = require('../models/OtpCode');
const { generateOtpCode, sendOtpSms, sendOtpEmail } = require('../utils/otp');
const { requireUserId } = require('../middleware/auth');
const { awardVoucher } = require('../utils/vouchers');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/avatars');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const PHONE_REGEX = /^0\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_OTP_WINDOW_MS = 10 * 60 * 1000;

const INVALID_CONTACT = 'Vui lòng nhập email hoặc số điện thoại hợp lệ (VD: ten@gmail.com, 0912345678).';

/**
 * Đăng ký/đăng nhập/quên mật khẩu đều nhận 1 ô `identifier` là SĐT hoặc email (giống các trang
 * TMĐT khác). Trả về { field, value } để query thẳng User/OtpCode theo đúng field, hoặc null
 * nếu không phải SĐT/email hợp lệ. Vẫn nhận phoneNumber/email riêng để không vỡ client cũ.
 */
function readContact(body) {
  const raw = String(body?.identifier ?? body?.email ?? body?.phoneNumber ?? '').trim();
  if (EMAIL_REGEX.test(raw)) return { field: 'email', value: raw.toLowerCase() };
  if (PHONE_REGEX.test(raw)) return { field: 'phoneNumber', value: raw };
  return null;
}

function contactLabel(contact) {
  return contact.field === 'email' ? 'Email' : 'Số điện thoại';
}

// Xác nhận đã có OTP xác thực thành công (consumed) cho SĐT/email này trong ít phút gần đây, rồi
// xoá hết OTP của nó để không dùng lại được — bắt buộc phải gọi trước khi cho phép
// register/reset-password, tránh chiếm tài khoản chỉ bằng cách biết SĐT/email.
async function consumeVerifiedOtp(contact) {
  const key = { [contact.field]: contact.value };
  const otpDoc = await OtpCode.findOne({ ...key, consumed: true }).sort({ updatedAt: -1 });
  if (!otpDoc || Date.now() - otpDoc.updatedAt.getTime() > VERIFIED_OTP_WINDOW_MS) {
    return false;
  }
  await OtpCode.deleteMany(key);
  return true;
}

function validatePasswordStrength(password) {
  // Tối thiểu 8 ký tự, 1 chữ in hoa, 1 ký tự đặc biệt (tham khảo quy tắc mật khẩu VitaCare-main).
  if (!password || password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự.';
  if (!/[A-Z]/.test(password)) return 'Mật khẩu cần tối thiểu 1 chữ in hoa.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Mật khẩu cần tối thiểu 1 ký tự đặc biệt.';
  return null;
}

async function issueOtp(contact) {
  const code = generateOtpCode();
  await OtpCode.create({
    [contact.field]: contact.value,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  const delivered = contact.field === 'email'
    ? await sendOtpEmail(contact.value, code)
    : await sendOtpSms(contact.value, code);
  return { code, delivered };
}

// Đánh dấu OTP đã dùng nếu đúng + còn hạn — dùng chung cho đăng ký và quên mật khẩu.
async function checkOtp(contact, otp) {
  const otpDoc = await OtpCode.findOne({ [contact.field]: contact.value, code: otp, consumed: false })
    .sort({ createdAt: -1 });
  if (!otpDoc || otpDoc.expiresAt < new Date()) return false;
  otpDoc.consumed = true;
  await otpDoc.save();
  return true;
}

// Chỉ trả mã về FE khi chưa gửi thật được (dev mode, chưa cấu hình SMTP/eSMS) — đã gửi qua
// Gmail/SMS thật thì người dùng phải lấy mã từ hộp thư/tin nhắn.
function devOtpField({ code, delivered }) {
  return !delivered && process.env.OTP_DEV_MODE === 'true' ? { devOtp: code } : {};
}

// ===================== ĐĂNG KÝ (SĐT hoặc email → OTP → đặt mật khẩu) =====================

router.post('/register-otp', async (req, res) => {
  try {
    const contact = readContact(req.body);
    if (!contact) {
      return res.status(400).json({ success: false, error: INVALID_CONTACT });
    }
    const existing = await User.findOne({ [contact.field]: contact.value });
    if (existing) {
      return res.status(400).json({ success: false, error: `${contactLabel(contact)} đã được đăng ký.` });
    }
    const otp = await issueOtp(contact);
    res.json({ success: true, message: 'Đã gửi mã OTP', ...devOtpField(otp) });
  } catch (err) {
    console.error('register-otp error', err);
    sendError(res, err);
  }
});

router.post('/verify-otp-any', async (req, res) => {
  try {
    const contact = readContact(req.body);
    const { otp } = req.body;
    if (!contact || !otp) {
      return res.status(400).json({ success: false, error: 'Thiếu email/số điện thoại hoặc mã OTP' });
    }
    if (!(await checkOtp(contact, otp))) {
      return res.status(400).json({ success: false, error: 'Mã OTP không đúng hoặc đã hết hạn' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('verify-otp-any error', err);
    sendError(res, err);
  }
});

router.post('/register', async (req, res) => {
  try {
    const contact = readContact(req.body);
    const { password, fullName } = req.body;
    if (!contact) {
      return res.status(400).json({ success: false, error: INVALID_CONTACT });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }
    const existing = await User.findOne({ [contact.field]: contact.value });
    if (existing) {
      return res.status(400).json({ success: false, error: `${contactLabel(contact)} đã được đăng ký.` });
    }
    if (!(await consumeVerifiedOtp(contact))) {
      return res.status(400).json({ success: false, error: 'Vui lòng xác thực mã OTP trước khi đăng ký.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      [contact.field]: contact.value,
      password: hashed,
      fullName: String(fullName || '').trim(),
      lastLogin: new Date(),
    });
    res.json({ success: true, user });
  } catch (err) {
    console.error('register error', err);
    sendError(res, err);
  }
});

// ===================== ĐĂNG NHẬP MẠNG XÃ HỘI (Google / Facebook) =====================
// Giống AuraPC-main: FE lấy token từ SDK của Google/Facebook, gửi lên đây để BE tự xác minh với
// provider. Đăng nhập lần đầu = tự đăng ký luôn; nếu email trùng tài khoản đã có (đăng ký bằng
// email/SĐT trước đó) thì liên kết vào tài khoản đó thay vì tạo tài khoản mới. Không bắt buộc
// gắn SĐT — SĐT nhận hàng nhập ở bước đặt hàng/sổ địa chỉ như các trang TMĐT khác.

/**
 * Google/Facebook trả `name` theo thứ tự phương Tây (tên trước, họ sau: "Băng Phùng Sương Lý") —
 * ghép lại theo thứ tự Việt Nam: họ + tên đệm + tên ("Phùng Sương Lý Băng"). Thiếu họ/tên thì dùng `name`.
 */
function vietnameseName(familyName, givenName, fallback) {
  const parts = [familyName, givenName].map(s => String(s || '').trim()).filter(Boolean);
  return parts.length === 2 ? parts.join(' ') : String(fallback || parts[0] || '').trim();
}

async function findOrCreateSocialUser({ idField, idValue, email, name, rawName, avatar }) {
  const normalizedEmail = email ? email.toLowerCase() : '';

  let user = await User.findOne({ [idField]: idValue });
  if (!user && normalizedEmail) {
    user = await User.findOne({ email: normalizedEmail });
    if (user) user[idField] = idValue;
  }

  if (!user) {
    return User.create({
      [idField]: idValue,
      email: normalizedEmail,
      fullName: name || '',
      avatar: avatar || '',
      active: true,
      lastLogin: new Date(),
    });
  }

  // Tên trống, hoặc vẫn là tên thứ tự phương Tây lưu từ lần đăng nhập trước (khách chưa tự sửa) → đổi sang họ + tên.
  if (name && (!user.fullName || (rawName && user.fullName === rawName))) user.fullName = name;
  if (!user.avatar && avatar) user.avatar = avatar;
  user.lastLogin = new Date();
  await user.save();
  return user;
}

// FE dùng Google Identity Services (google.accounts.id), lấy được 1 ID token (JWT) rồi gửi
// nguyên token đó lên đây — BE verify chữ ký + audience qua google-auth-library (không cần
// client secret, không cần redirect URI).
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đăng nhập Google.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, error: 'Server chưa cấu hình GOOGLE_CLIENT_ID.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const user = await findOrCreateSocialUser({
      idField: 'googleId',
      idValue: payload.sub,
      // Chỉ liên kết theo email khi Google đã xác minh email đó.
      email: payload.email_verified ? payload.email : '',
      name: vietnameseName(payload.family_name, payload.given_name, payload.name),
      rawName: payload.name,
      avatar: payload.picture,
    });
    if (!user.active) {
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị khoá.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('google login error', err);
    res.status(400).json({ success: false, error: 'Đăng nhập Google thất bại, vui lòng thử lại.' });
  }
});

// FE dùng Facebook JS SDK (FB.login) lấy access token rồi gửi lên đây. Nếu server có cấu hình
// FACEBOOK_APP_ID + FACEBOOK_APP_SECRET thì kiểm tra thêm token có đúng được cấp cho app của
// Luméa không (debug_token) — tránh dùng token của app khác để đăng nhập hộ.
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đăng nhập Facebook.' });
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (appId && appSecret) {
      const debug = await axios.get('https://graph.facebook.com/debug_token', {
        params: { input_token: accessToken, access_token: `${appId}|${appSecret}` },
      });
      const data = debug.data?.data;
      if (!data?.is_valid || String(data.app_id) !== String(appId)) {
        return res.status(401).json({ success: false, error: 'Phiên đăng nhập Facebook không hợp lệ.' });
      }
    }

    const fbResponse = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,first_name,last_name,email,picture.type(large)', access_token: accessToken },
    });
    const { id, email, picture } = fbResponse.data;
    const name = vietnameseName(fbResponse.data.last_name, fbResponse.data.first_name, fbResponse.data.name);

    const user = await findOrCreateSocialUser({
      idField: 'facebookId',
      idValue: id,
      email,
      name,
      rawName: fbResponse.data.name,
      avatar: picture?.data?.url,
    });
    if (!user.active) {
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị khoá.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('facebook login error', err.response?.data || err);
    res.status(400).json({ success: false, error: 'Đăng nhập Facebook thất bại, vui lòng thử lại.' });
  }
});

// ===================== ĐĂNG NHẬP (SĐT/email + mật khẩu, không JWT) =====================

router.post('/login', async (req, res) => {
  try {
    const contact = readContact(req.body);
    const { password } = req.body;
    if (!contact || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập email/số điện thoại và mật khẩu' });
    }
    const user = await User.findOne({ [contact.field]: contact.value });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Thông tin đăng nhập sai, vui lòng thử lại.' });
    }
    if (!user.password) {
      return res.status(400).json({
        success: false,
        error: 'Tài khoản này được tạo bằng Google/Facebook. Hãy đăng nhập bằng Google/Facebook hoặc dùng "Quên mật khẩu" để đặt mật khẩu.',
      });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Thông tin đăng nhập sai, vui lòng thử lại.' });
    }
    if (!user.active) {
      return res.status(403).json({ success: false, error: 'Tài khoản đã bị khoá.' });
    }
    user.lastLogin = new Date();
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('login error', err);
    sendError(res, err);
  }
});

// ===================== QUÊN MẬT KHẨU (OTP rồi đặt mật khẩu mới) =====================

router.post('/forgot-password', async (req, res) => {
  try {
    const contact = readContact(req.body);
    if (!contact) {
      return res.status(400).json({ success: false, error: INVALID_CONTACT });
    }
    const user = await User.findOne({ [contact.field]: contact.value });
    if (!user) {
      return res.status(400).json({ success: false, error: `${contactLabel(contact)} chưa đăng ký.` });
    }
    const otp = await issueOtp(contact);
    res.json({ success: true, message: 'Đã gửi mã OTP', ...devOtpField(otp) });
  } catch (err) {
    console.error('forgot-password error', err);
    sendError(res, err);
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const contact = readContact(req.body);
    const { otp } = req.body;
    if (!contact || !otp) {
      return res.status(400).json({ success: false, error: 'Thiếu email/số điện thoại hoặc mã OTP' });
    }
    if (!(await checkOtp(contact, otp))) {
      return res.status(400).json({ success: false, error: 'Mã OTP không đúng hoặc đã hết hạn' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('verify-otp error', err);
    sendError(res, err);
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const contact = readContact(req.body);
    const { newPassword } = req.body;
    if (!contact) {
      return res.status(400).json({ success: false, error: INVALID_CONTACT });
    }
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }
    const user = await User.findOne({ [contact.field]: contact.value });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    if (!(await consumeVerifiedOtp(contact))) {
      return res.status(400).json({ success: false, error: 'Vui lòng xác thực mã OTP trước khi đặt lại mật khẩu.' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('reset-password error', err);
    sendError(res, err);
  }
});

// ===================== HỒ SƠ / AVATAR =====================

router.get('/me', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    res.json({ success: true, user });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/profile', requireUserId, async (req, res) => {
  try {
    const { fullName, email, address, gender, dateOfBirth } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });

    if (email !== undefined && String(email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
      return res.status(400).json({ success: false, error: 'Email không đúng định dạng' });
    }
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = String(email).trim();
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    await user.save();

    // Thưởng 1 lần khi hồ sơ có đủ họ tên/email/giới tính/ngày sinh.
    if (user.fullName?.trim() && user.email?.trim() && user.gender && user.dateOfBirth?.trim()) {
      await awardVoucher({
        userId: user._id,
        tierKey: 'V20K',
        source: 'PROFILE_COMPLETE',
        refId: 'profile-complete',
        note: 'Hoàn thiện hồ sơ cá nhân',
      });
    }

    res.json({ success: true, user });
  } catch (err) {
    sendError(res, err);
  }
});

// multer phải chạy trước requireUserId: userId nằm trong form multipart, chưa parse thì req.body rỗng (-> 401).
router.post('/avatar', upload.single('avatar'), requireUserId, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Thiếu file ảnh' });
    if (!/^image\//.test(req.file.mimetype || '')) {
      return res.status(400).json({ success: false, error: 'File phải là ảnh (JPG, PNG, WEBP...)' });
    }

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
    sendError(res, err);
  }
});

// ===================== SỔ ĐỊA CHỈ =====================

router.get('/addresses', requireUserId, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (err) {
    sendError(res, err);
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
    sendError(res, err);
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
    sendError(res, err);
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
    sendError(res, err);
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
    sendError(res, err);
  }
});

module.exports = router;
