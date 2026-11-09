const mongoose = require('mongoose');
const { STYLE_TAGS } = require('./QuizQuestion');

// Kết quả của 4 phong cách trong Trắc nghiệm phong cách — cố định 4 bản ghi (theo tag), chỉ sửa nội dung.
const quizResultSchema = new mongoose.Schema({
  tag: { type: String, enum: STYLE_TAGS, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  // Mã loại sản phẩm (Product.category) gợi ý xem tiếp, vd 'vase', 'lamp'.
  suggestedCategories: { type: [String], default: [] },
  paletteHex: { type: [String], default: [] },
  // Nội dung trang kết quả: dấu hiệu nhận biết, bí quyết phối đồ, điều nên tránh.
  traits: { type: [String], default: undefined },
  tips: { type: [String], default: undefined },
  avoid: { type: [String], default: undefined },
  // Product.style khớp với phong cách này — dùng để lọc sản phẩm gợi ý (vd ['Minimalist', 'Modern']).
  productStyles: { type: [String], default: undefined },
  // Loại sản phẩm của "bộ phối sẵn" — mỗi loại lấy 1 món hợp phong cách nhất.
  comboCategories: { type: [String], default: undefined },
}, { timestamps: true });

module.exports = mongoose.model('QuizResult', quizResultSchema);
