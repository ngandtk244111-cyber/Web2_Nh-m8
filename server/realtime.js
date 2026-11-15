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

// Nhân viên có quyền nội dung (content.view) — nhận báo bình luận / tim bài Tin tức.
const CONTENT_ROOM = 'content';

/** Báo cho nhân viên nội dung đang mở my-admin. */
function emitToContentStaff(event, payload) {
  if (io) io.to(CONTENT_ROOM).emit(event, payload);
}

/** Báo cho mọi nhân viên đang mở my-admin (phòng "staff" của socket.js). */
function emitToStaff(event, payload) {
  if (io) io.to('staff').emit(event, payload);
}

module.exports = { setIO, orderRoom, emitOrderUpdated, emitToStaff, emitToContentStaff, CONTENT_ROOM };
