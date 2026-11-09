const express = require('express');
const multer = require('multer');
const { sendError } = require('../utils/http-error');
const { requireAdminId, validId } = require('../middleware/auth');
const AdminDocument = require('../models/AdminDocument');

// Kho chứng từ nội bộ của my-admin (hoá đơn nhập / xuất kho, hợp đồng xưởng...). Trả về attachment
// { id, name, contentType, size, url } để gắn vào phiếu nhập kho, phiếu điều chỉnh, hồ sơ xưởng.
const router = express.Router();

const MAX_SIZE = 10 * 1024 * 1024;
// Không nhận SVG / HTML: file phục vụ lại từ domain API.
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE, files: 5 } });

function toAttachment(doc) {
  return { id: String(doc._id), name: doc.name, contentType: doc.contentType, size: doc.size, url: `/api/admin-documents/${doc._id}` };
}

// Tải lên tối đa 5 file / lần, mỗi file ≤ 10MB, chỉ PDF hoặc ảnh.
router.post('/', requireAdminId, (req, res, next) => {
  upload.array('files', 5)(req, res, err => {
    if (!err) return next();
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi file không được vượt quá 10MB'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Tối đa 5 file mỗi lần tải lên'
      : 'Không đọc được file tải lên';
    res.status(400).json({ success: false, error });
  });
}, async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: 'Chưa chọn file nào' });
    if (files.some(f => !DOCUMENT_TYPES.includes(f.mimetype))) {
      return res.status(400).json({ success: false, error: 'Chỉ nhận file PDF hoặc ảnh JPG, PNG, WEBP' });
    }
    const docs = await AdminDocument.insertMany(files.map(f => ({
      data: f.buffer,
      contentType: f.mimetype,
      // multer đọc tên file theo latin1 — đổi lại UTF-8 để giữ dấu tiếng Việt.
      name: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 200),
      size: f.size,
      uploadedBy: req.adminId,
    })));
    res.json({ success: true, attachments: docs.map(toAttachment) });
  } catch (err) {
    sendError(res, err);
  }
});

// Xem / tải chứng từ — cần token nhân viên (my-admin gọi bằng HttpClient rồi mở blob).
router.get('/:id', requireAdminId, async (req, res) => {
  try {
    const id = validId(req.params.id);
    const doc = id && await AdminDocument.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Không tìm thấy chứng từ' });
    res.set({
      'Content-Type': doc.contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(doc.data.buffer ?? doc.data));
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
