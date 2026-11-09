const AdminDocument = require('../models/AdminDocument');
const { validId } = require('../middleware/auth');

const MAX_ATTACHMENTS = 10;

/**
 * Chuẩn hoá danh sách chứng từ client gửi kèm (lấy từ POST /api/admin-documents): chỉ giữ chứng từ có
 * thật trong kho, thông tin (tên, loại, dung lượng) đọc lại từ DB chứ không tin client.
 */
async function resolveAttachments(raw) {
  const ids = [...new Set((Array.isArray(raw) ? raw : []).map(a => validId(a?.id)).filter(Boolean))].slice(0, MAX_ATTACHMENTS);
  if (!ids.length) return [];
  const docs = await AdminDocument.find({ _id: { $in: ids } }, { name: 1, contentType: 1, size: 1 }).lean();
  return docs.map(d => ({ id: String(d._id), name: d.name, contentType: d.contentType, size: d.size, url: `/api/admin-documents/${d._id}` }));
}

module.exports = { resolveAttachments };
