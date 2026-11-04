// Khách hàng và nhân viên đều xác thực bằng token ký bởi server (header Authorization: Bearer ...).
// Không tin userId/adminId client gửi qua body/query. Token của 2 bên ký khác tiền tố, không dùng lẫn được.

const crypto = require('crypto');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { adminHasPermission } = require('../utils/permissions');

// Id không đúng định dạng ObjectId coi như không có — tránh lỗi CastError (500) ở các query phía sau.
function validId(value) {
  return value && mongoose.isValidObjectId(value) ? String(value) : null;
}

const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const USER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Không đặt ADMIN_TOKEN_SECRET thì dùng khóa ngẫu nhiên theo tiến trình: vẫn an toàn nhưng
// nhân viên phải đăng nhập lại mỗi lần server khởi động lại.
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.ADMIN_TOKEN_SECRET) {
  console.warn('[auth] ADMIN_TOKEN_SECRET chưa đặt — token admin sẽ mất hiệu lực khi server khởi động lại.');
}

// Ký kèm hash mật khẩu: đổi mật khẩu là mọi token cũ của tài khoản đó mất hiệu lực ngay.
function signAdminToken(id, expiresAt, passwordHash) {
  return crypto.createHmac('sha256', tokenSecret).update(`${id}.${expiresAt}.${passwordHash}`).digest('base64url');
}

function createAdminToken(admin) {
  const id = String(admin._id);
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  return `${id}.${expiresAt}.${signAdminToken(id, expiresAt, admin.password)}`;
}

/** Trả về id admin nếu token đúng chữ ký, còn hạn và tài khoản còn hoạt động; ngược lại null. */
async function adminIdFromToken(token) {
  const [id, expiresAt, signature] = typeof token === 'string' ? token.split('.') : [];
  if (!validId(id) || !signature || !(Number(expiresAt) > Date.now())) return null;
  const admin = await Admin.findOne({ _id: id, active: true }, { password: 1 }).lean();
  if (!admin) return null;
  const expected = Buffer.from(signAdminToken(id, expiresAt, admin.password));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? id : null;
}

function adminIdFromRequest(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' ? adminIdFromToken(token) : Promise.resolve(null);
}

// Bắt buộc có token nhân viên hợp lệ — dùng cho các route chỉ my-admin được gọi. Nhân viên bị
// khóa hoặc đã nghỉ việc bị chặn ngay ở lần gọi kế tiếp.
async function requireAdminId(req, res, next) {
  try {
    const adminId = await adminIdFromRequest(req);
    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Phiên quản trị không hợp lệ — vui lòng đăng nhập lại.' });
    }
    req.adminId = adminId;
    next();
  } catch (err) {
    next(err);
  }
}

// Bắt buộc token nhân viên hợp lệ và có ít nhất 1 trong các quyền (dạng 'products.edit'). Đọc vai trò
// từ DB ở mỗi request nên đổi quyền có hiệu lực ngay, không phải đăng nhập lại.
function requirePermission(...rules) {
  return [requireAdminId, async (req, res, next) => {
    try {
      if (await adminHasPermission(req.adminId, ...rules)) return next();
      res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này' });
    } catch (err) {
      next(err);
    }
  }];
}

// Ký kèm hash mật khẩu giống token nhân viên. Tài khoản Google/Facebook không có mật khẩu.
function signUserToken(id, expiresAt, passwordHash) {
  return crypto.createHmac('sha256', tokenSecret).update(`user:${id}.${expiresAt}.${passwordHash || ''}`).digest('base64url');
}

function createUserToken(user) {
  const id = String(user._id);
  const expiresAt = Date.now() + USER_TOKEN_TTL_MS;
  return `${id}.${expiresAt}.${signUserToken(id, expiresAt, user.password)}`;
}

/** Trả về id khách nếu token đúng chữ ký, còn hạn và tài khoản còn hoạt động; ngược lại null. */
async function userIdFromToken(token) {
  const [id, expiresAt, signature] = typeof token === 'string' ? token.split('.') : [];
  if (!validId(id) || !signature || !(Number(expiresAt) > Date.now())) return null;
  const user = await User.findOne({ _id: id, active: true }, { password: 1 }).lean();
  if (!user) return null;
  const expected = Buffer.from(signUserToken(id, expiresAt, user.password));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? id : null;
}

function userIdFromRequest(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' ? userIdFromToken(token) : Promise.resolve(null);
}

// Bắt buộc có token khách hàng hợp lệ.
async function requireUserId(req, res, next) {
  try {
    const userId = await userIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ — vui lòng đăng nhập lại.' });
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

// Gắn userId nếu token hợp lệ, không bắt buộc, không chặn request nếu thiếu.
async function attachUserId(req, _res, next) {
  try {
    const userId = await userIdFromRequest(req);
    if (userId) req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireUserId, attachUserId, requireAdminId, requirePermission, createAdminToken, adminIdFromToken, adminIdFromRequest,
  createUserToken, userIdFromToken, userIdFromRequest, validId,
};
