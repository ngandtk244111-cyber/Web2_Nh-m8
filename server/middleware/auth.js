// Không còn dùng JWT (tham khảo cơ chế auth của VitaCare-main: đăng nhập bằng SĐT + mật khẩu,
// server tin tưởng thẳng userId do client gửi lên qua body/query, không có token nào cả).
// Route GET dùng ?userId=..., route POST/PUT/DELETE dùng body { userId, ... }.

function extractUserId(req) {
  return req.body?.userId || req.query?.userId || null;
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
  return req.body?.adminId || req.query?.adminId || null;
}

// Bắt buộc phải có adminId hợp lệ trong request — dùng cho các route ghi dữ liệu chỉ my-admin
// được phép gọi (CRUD sản phẩm/phòng, duyệt yêu cầu thiết kế, cập nhật tiến độ đơn...). Cùng
// mức bảo mật với requireUserId (tin thẳng id client gửi lên, không verify token) — chấp nhận
// đánh đổi để nhất quán với toàn bộ auth hiện có của Lam-a-main thay vì chỉ riêng admin dùng JWT.
function requireAdminId(req, res, next) {
  const adminId = extractAdminId(req);
  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Thiếu adminId — vui lòng đăng nhập lại.' });
  }
  req.adminId = adminId;
  next();
}

module.exports = { requireUserId, attachUserId, requireAdminId };
