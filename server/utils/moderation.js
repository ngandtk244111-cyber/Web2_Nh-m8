// Kiểm duyệt tự động bài đăng Cộng đồng trước khi hiển thị công khai.
// Danh sách đơn giản theo từ khoá — đủ chặn spam/quảng cáo/ngôn từ thô tục phổ biến; bài bị chặn
// vẫn được lưu (status REJECTED) để nhân viên xem lại trong my-admin và mở lại nếu chặn nhầm.

const RULES = [
  {
    reason: 'Ngôn từ thô tục / xúc phạm',
    words: ['đm', 'dm', 'vcl', 'vkl', 'đéo', 'địt', 'lồn', 'cặc', 'đụ', 'óc chó', 'ngu như', 'fuck', 'shit', 'bitch'],
  },
  {
    reason: 'Spam / quảng cáo bên ngoài',
    words: ['zalo.me', 'bit.ly', 'inbox để mua', 'giá sỉ', 'kiếm tiền online', 'nhận hàng trả tiền', 'shopee.vn', 'lazada.vn', 'tiki.vn'],
  },
  {
    reason: 'Nội dung cờ bạc / lừa đảo',
    words: ['cá độ', 'nhà cái', 'casino', 'lô đề', 'tài xỉu', 'vay tiền nhanh'],
  },
];

function normalize(text) {
  return ` ${String(text || '').toLowerCase().replace(/\s+/g, ' ')} `;
}

// Khớp theo ranh giới từ để "dm" không bắt nhầm "admin", "adm"...
function containsWord(haystack, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(haystack);
}

/** Trả về { reason, matched } nếu vi phạm, null nếu sạch. */
function checkContent(...parts) {
  const text = normalize(parts.join(' '));
  for (const rule of RULES) {
    const matched = rule.words.find(w => containsWord(text, w));
    if (matched) return { reason: rule.reason, matched };
  }
  return null;
}

module.exports = { checkContent };
