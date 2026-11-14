const crypto = require('crypto');

// Bỏ các ký tự dễ nhầm (0/O, 1/I). 8 ký tự ngẫu nhiên từ crypto nên không dò được như mã 6 chữ số cũ.
const ORDER_NUMBER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderNumber() {
  return 'ORD-' + Array.from(crypto.randomBytes(8), byte => ORDER_NUMBER_CHARS[byte % ORDER_NUMBER_CHARS.length]).join('');
}

module.exports = { generateOrderNumber };
