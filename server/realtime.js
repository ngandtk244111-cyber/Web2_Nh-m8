// Giữ tham chiếu tới instance socket.io để các nơi không có `io` trong tay (model hook, route)
// vẫn phát được sự kiện realtime. socket.js gọi setIO() ngay khi khởi tạo.
let io = null;

function setIO(instance) {
  io = instance;
}

/** Phòng socket của 1 đơn hàng — trang Tra cứu đơn (my-client) join theo mã đơn. */
function orderRoom(orderNumber) {
  return `order:${orderNumber}`;
}

/** Đẩy bản mới nhất của đơn tới mọi người đang theo dõi mã đơn đó. */
function emitOrderUpdated(order) {
  if (!io || !order?.orderNumber) return;
  const payload = typeof order.toJSON === 'function' ? order.toJSON() : order;
  io.to(orderRoom(order.orderNumber)).emit('order:updated', payload);
}

module.exports = { setIO, orderRoom, emitOrderUpdated };
