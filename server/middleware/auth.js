// Không còn dùng JWT (tham khảo cơ chế auth của VitaCare-main: đăng nhập bằng SĐT + mật khẩu,
// server tin tưởng thẳng userId do client gửi lên qua body/query, không có token nào cả).
// Route GET dùng ?userId=..., route POST/PUT/DELETE dùng body { userId, ... }.

const mongoose = require('mongoose');
const Admin = require('../models/Admin');

// Id không đúng định dạng ObjectId coi như không có — tránh lỗi CastError (500) ở các query phía sau.
function validId(value) {
  return value && mongoose.isValidObjectId(value) ? String(value) : null;
}

function extractUserId(req) {
  return validId(req.body?.userId || req.query?.userId);
}

// Bắt buộc phải có userId hợp lệ trong request.
function requireUserId(req, res, next) {
  const userId = extractUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Thiếu userId — vui lòng đăng nhập lại.' });
  }
  req.userId = userId;
  next();
}

// Gắn userId nếu có, không bắt buộc, không chặn request nếu thiếu.
function attachUserId(req, _res, next) {
  const userId = extractUserId(req);
  if (userId) req.userId = userId;
  next();
}

function extractAdminId(req) {
  return validId(req.body?.adminId || req.query?.adminId);
}

/** adminId phải là tài khoản admin có thật và còn hoạt động (giống kiểm tra isAdmin ở socket.js). */
async function isActiveAdmin(adminId) {
  return !!adminId && !!(await Admin.exists({ _id: adminId, active: true }));
}

// Bắt buộc phải có adminId hợp lệ trong request — dùng cho các route ghi dữ liệu chỉ my-admin
// được phép gọi (CRUD sản phẩm/phòng, duyệt yêu cầu thiết kế, cập nhật tiến độ đơn...). adminId phải
// tồn tại trong collection Admin và còn active (nhân viên đã nghỉ việc bị chặn ngay). Cùng
// mức bảo mật với requireUserId (tin thẳng id client gửi lên, không verify token) — chấp nhận
// đánh đổi để nhất quán với toàn bộ auth hiện có của Lam-a-main thay vì chỉ riêng admin dùng JWT.
async function requireAdminId(req, res, next) {
  const adminId = extractAdminId(req);
  try {
    if (!(await isActiveAdmin(adminId))) {
      return res.status(401).json({ success: false, error: 'Phiên quản trị không hợp lệ — vui lòng đăng nhập lại.' });
    }
  } catch (err) {
    return next(err);
  }
  req.adminId = adminId;
  next();
}

module.exports = { requireUserId, attachUserId, requireAdminId, isActiveAdmin, validId };
