/**
 * Kiểm tra lại quy tắc in 3D phía server (không tin client).
 * Giữ khớp với projects/my-client/src/app/core/data/print-request-rules.ts.
 */
const MATERIAL_MAX_CM = { PLA: 30, PETG: 30, RESIN: 20 };
const MIN_CM = 3;
const ENGRAVE_MAX_CHARS = 20;
const ENGRAVE_PATTERN = /^[\p{L}\p{N} .,\-&']*$/u;
const TITLE_MIN_CHARS = 10;
const IDEA_MIN_CHARS = 30;
/** Loại sản phẩm chỉ in được một số chất liệu (đèn không in resin). */
const PRODUCT_TYPE_MATERIALS = {
  'Đèn ngủ / đèn bàn': ['PLA', 'PETG'],
  'Bình hoa / chậu cây': ['PLA', 'PETG'],
  'Khay / hộp đựng': ['PLA', 'PETG'],
  'Giá đỡ / bookend': ['PLA', 'PETG'],
};

/** Trả về thông báo lỗi đầu tiên (tiếng Việt) hoặc null nếu hợp lệ. */
function validatePrintRequest(body) {
  const brief = body && body.brief;
  if (!brief || typeof brief !== 'object') return 'Thiếu thông tin yêu cầu.';
  if (!body.title || String(body.title).trim().length < TITLE_MIN_CHARS) return `Tiêu đề cần ít nhất ${TITLE_MIN_CHARS} ký tự.`;
  if (!body.customerName || !body.customerEmail) return 'Thiếu thông tin liên hệ.';
  if (!/^0\d{9}$/.test(String(body.customerPhone || '').replace(/[\s.]/g, ''))) return 'Số điện thoại không hợp lệ.';
  if (!brief.productType) return 'Thiếu loại sản phẩm.';

  const maxCm = MATERIAL_MAX_CM[brief.printMaterial];
  if (!maxCm) return 'Chất liệu in không hợp lệ.';
  const allowed = PRODUCT_TYPE_MATERIALS[brief.productType];
  if (allowed && !allowed.includes(brief.printMaterial)) return `Chất liệu ${brief.printMaterial} không phù hợp với "${brief.productType}".`;

  const d = brief.dimensionsCm || {};
  const dims = [d.length, d.width, d.height].map(Number);
  if (dims.some(n => !Number.isFinite(n) || n < MIN_CM || n > maxCm)) {
    return `Mỗi chiều phải từ ${MIN_CM} đến ${maxCm} cm với chất liệu ${brief.printMaterial}.`;
  }

  const idea = `${brief.theme || ''} ${brief.notes || ''}`.trim();
  if (idea.length < IDEA_MIN_CHARS) return `Mô tả ý tưởng cần ít nhất ${IDEA_MIN_CHARS} ký tự.`;

  const text = String(brief.customText || '').trim();
  if (text.length > ENGRAVE_MAX_CHARS || !ENGRAVE_PATTERN.test(text)) return `Khắc chữ tối đa ${ENGRAVE_MAX_CHARS} ký tự, chỉ chữ và số.`;

  if (!brief.estimatedBudget) return 'Thiếu ngân sách dự kiến.';
  if (brief.agreedPrintRules !== true) return 'Bạn cần đồng ý với quy tắc in 3D.';
  return null;
}

module.exports = { validatePrintRequest };
