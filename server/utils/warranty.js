const Warranty = require('../models/Warranty');
const Order = require('../models/Order');

// Mỗi món trong đơn giao thành công có 1 phiếu bảo hành (12 tháng theo Chính sách bảo hành).
// Mã phiếu được ghi lên chính món đó trong đơn để khách thấy ở trang chi tiết đơn.
const DEFAULT_WARRANTY_MONTHS = 12;

function generateWarrantyCode() {
  return 'WR-' + Math.floor(100000 + Math.random() * 900000);
}

/** Tạo phiếu với mã ngẫu nhiên, sinh lại nếu trùng mã đã có (unique index). */
async function createWarranty(fields) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Warranty.create({ ...fields, warrantyCode: generateWarrantyCode() });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('Không tạo được mã bảo hành, vui lòng thử lại');
}

/**
 * Cấp phiếu cho các món chưa có mã của 1 đơn đã giao và gán mã vào order.items[i].warrantyCode
 * (chỉ sửa document trong bộ nhớ, caller tự lưu). Phiếu tạo trước đó chưa gắn món (admin tạo tay,
 * dữ liệu mẫu) được nhận lại theo tên sản phẩm thay vì tạo trùng.
 * Trả về các path đã gán, dạng { 'items.0.warrantyCode': 'WR-123456' } — rỗng nếu không có gì mới.
 */
async function issueWarrantiesForOrder(order) {
  const assigned = {};
  if (order.status !== 'DELIVERED') return assigned;
  if (order.items.every(item => item.warrantyCode)) return assigned;

  const existing = await Warranty.find({ orderNumber: order.orderNumber });
  for (const [index, item] of order.items.entries()) {
    if (item.warrantyCode) continue;

    let warranty = existing.find(w => w.itemId === item.id)
      || existing.find(w => !w.itemId && w.productName === item.product?.name);
    if (warranty && !warranty.itemId) {
      warranty.itemId = item.id;
      await warranty.save();
    }
    if (!warranty) {
      warranty = await createWarranty({
        orderNumber: order.orderNumber,
        itemId: item.id,
        productName: item.product?.name || 'Sản phẩm Luméa',
        productImage: item.product?.images?.[0] || '',
        customerName: order.shippingAddress.fullName,
        customerPhone: order.shippingAddress.phone,
        purchasedAt: order.deliveredAt || order.updatedAt || new Date(),
        warrantyMonths: DEFAULT_WARRANTY_MONTHS,
      });
      existing.push(warranty);
    }

    item.warrantyCode = warranty.warrantyCode;
    assigned[`items.${index}.warrantyCode`] = warranty.warrantyCode;
  }
  return assigned;
}

/** Bù mã bảo hành cho các đơn đã giao từ trước khi có tính năng tự cấp (gọi khi khách xem đơn). */
async function ensureOrderWarranties(orders) {
  for (const order of orders) {
    const assigned = await issueWarrantiesForOrder(order);
    if (Object.keys(assigned).length) await Order.updateOne({ _id: order._id }, { $set: assigned });
  }
}

module.exports = { createWarranty, issueWarrantiesForOrder, ensureOrderWarranties };
