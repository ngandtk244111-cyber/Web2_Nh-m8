const Product = require('../models/Product');
const Order = require('../models/Order');

// Chỉ hàng có sẵn mới trừ kho; hàng in theo đơn sản xuất sau khi đặt nên không giới hạn tồn.
class StockError extends Error {}

function readyStockQuantities(items) {
  const quantities = new Map();
  for (const item of items) {
    if (item.product?.productionType !== 'READY_STOCK') continue;
    quantities.set(item.product.id, (quantities.get(item.product.id) || 0) + item.quantity);
  }
  return quantities;
}

function addStock(quantities) {
  return Promise.all([...quantities].map(([id, quantity]) => Product.updateOne({ id }, { $inc: { inStock: quantity } })));
}

/**
 * Trừ kho nguyên tử theo từng sản phẩm: điều kiện inStock >= số lượng nằm ngay trong lệnh update nên
 * 2 khách đặt cùng lúc không thể mua vượt tồn. Thiếu 1 món thì hoàn lại các món đã trừ và báo lỗi.
 */
async function reserveStock(items) {
  const reserved = new Map();
  for (const [id, quantity] of readyStockQuantities(items)) {
    const updated = await Product.findOneAndUpdate({ id, inStock: { $gte: quantity } }, { $inc: { inStock: -quantity } });
    if (!updated) {
      await addStock(reserved);
      const product = await Product.findOne({ id }, { name: 1, inStock: 1 }).lean();
      const left = Math.max(0, product?.inStock || 0);
      throw new StockError(left
        ? `"${product.name}" chỉ còn ${left} sản phẩm, vui lòng giảm số lượng.`
        : `"${product?.name || id}" đã hết hàng.`);
    }
    reserved.set(id, quantity);
  }
  return { release: () => addStock(reserved) };
}

/**
 * Hoàn kho khi đơn huỷ/hoàn hàng. Đổi cờ stockReserved nguyên tử nên gọi lặp cũng chỉ hoàn 1 lần,
 * và đơn tạo trước khi có trừ kho (không có cờ) không làm tồn kho tăng khống.
 */
async function restoreStockForOrder(orderNumber) {
  const order = await Order.findOneAndUpdate({ orderNumber, stockReserved: true }, { stockReserved: false });
  if (order) await addStock(readyStockQuantities(order.items));
}

module.exports = { StockError, reserveStock, restoreStockForOrder };
