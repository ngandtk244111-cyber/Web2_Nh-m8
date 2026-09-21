const mongoose = require('mongoose');

// Cấu trúc lồng nhau (customization, reviews) khớp 1:1 với interface TypeScript phía
// frontend (product.model.ts) — dùng Mixed để không phải định nghĩa lại toàn bộ schema con,
// nguồn sự thật về hình dạng dữ liệu vẫn là các interface Angular.
const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  categoryName: { type: String, required: true },
  categoryGroup: { type: String, enum: ['FURNITURE', 'DECOR'], required: true },
  productionType: { type: String, enum: ['READY_STOCK', 'PRINT_ON_DEMAND'], required: true },
  customizable: { type: Boolean, default: false },
  basePrice: { type: Number, required: true },
  originalPrice: { type: Number, default: null },
  description: { type: String, default: '' },
  story: { type: String, default: '' },
  rating: { type: Number, default: 5 },
  reviewCount: { type: Number, default: 0 },
  inStock: { type: Number, default: 0 },
  images: { type: [String], default: [] },
  badge: { type: String, default: '' },
  dimensions: { type: String, default: '' },
  materialInfo: { type: String, default: '' },
  weight: { type: String, default: '' },
  features: { type: [String], default: [] },
  reviews: { type: [mongoose.Schema.Types.Mixed], default: [] },
  customization: { type: mongoose.Schema.Types.Mixed, default: null },
  threeModelType: { type: String, default: null },
  productionTime: { type: String, default: null },
  printTechnology: { type: String, default: null },
  // Gán sản phẩm vào 1 trong 3 khung Flash Sale đang xoay vòng theo ngày thực
  // (0 = hôm nay, 1 = ngày mai, 2 = ngày kia) — null nghĩa là không thuộc Flash Sale.
  flashSaleSlot: { type: Number, enum: [0, 1, 2, null], default: null },
  // Thuộc tính lọc cho trang "Tất cả sản phẩm" (độc lập với category = loại vật thể).
  style: { type: String, enum: ['Minimalist', 'Scandinavian', 'Vintage', 'Cute/Kawaii', 'Modern', 'Retro', 'Japanese', null], default: null },
  color: { type: String, enum: ['Trắng', 'Đen', 'Xám', 'Be', 'Pastel', 'Xanh', 'Hồng', null], default: null },
  printMaterial: { type: String, enum: ['PLA', 'PETG', 'Resin', 'Wood PLA', 'Nhựa tái chế', null], default: null },
  sizeCategory: { type: String, enum: ['Mini', 'Nhỏ', 'Trung bình', 'Theo yêu cầu', null], default: null },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
