const mongoose = require('mongoose');

// Trả lỗi cho mọi catch trong routes: lỗi do dữ liệu client gửi sai (sai kiểu, thiếu trường bắt buộc,
// giá trị ngoài enum, id không đúng định dạng) là 400 — chỉ lỗi thật của server mới là 500.
function sendError(res, err) {
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map(e => e.message).join('; ');
    return res.status(400).json({ success: false, error: `Dữ liệu không hợp lệ: ${details}` });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, error: `Giá trị không hợp lệ ở trường "${err.path}"` });
  }
  console.error(err);
  return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
}

module.exports = { sendError };
