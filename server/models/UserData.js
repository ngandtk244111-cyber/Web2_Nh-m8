const mongoose = require('mongoose');

// Dữ liệu cá nhân trước đây chỉ nằm trên trình duyệt: giỏ hàng, yêu thích, đã xem, mã đã lưu.
// Mỗi tài khoản 1 document, đổi thiết bị vẫn còn. Giỏ hàng chỉ giữ productId, thông tin sản phẩm
// lấy mới từ Product mỗi lần đọc nên không bị cũ (xem routes/userDataRoutes.js).
const cartItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  productId: { type: String, required: true },
  // Chỉ có với sản phẩm đặt riêng (id custom-...): loại này không nằm trong collection Product.
  customProduct: { type: mongoose.Schema.Types.Mixed, default: null },
  quantity: { type: Number, required: true, min: 1 },
  selectedCustomization: { type: mongoose.Schema.Types.Mixed, default: null },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
}, { _id: false });

const userDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  cart: { type: [cartItemSchema], default: [] },
  favorites: { type: [String], default: [] },
  recentlyViewed: { type: [String], default: [] },
  savedCoupons: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('UserData', userDataSchema);
