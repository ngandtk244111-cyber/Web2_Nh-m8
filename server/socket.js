const { Server } = require('socket.io');
const ChatMessage = require('./models/ChatMessage');
const Order = require('./models/Order');
const { adminIdFromToken, userIdFromToken } = require('./middleware/auth');
const { adminHasPermission } = require('./utils/permissions');
const { canWatchOrder, isLocked, recordFailure } = require('./utils/order-access');
const { setIO, orderRoom } = require('./realtime');
const { buildAutoReply } = require('./chatAutoReply');

// Phòng chung của nhân viên my-admin: nhận mọi tin nhắn của mọi cuộc chat để cập nhật hộp thư.
const STAFF_ROOM = 'staff';
const MAX_MESSAGE_LENGTH = 2000;
const AUTO_REPLY_DELAY_MS = 900;
// Trong 10 phút: trợ lý vừa gửi menu -> chỉ xác nhận ngắn; nhân viên vừa trả lời -> trợ lý không chen vào.
const AUTO_REPLY_COOLDOWN_MS = 10 * 60 * 1000;

function attachSocket(httpServer, corsOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
  });
  setIO(io);

  // Trạng thái online suy ra trực tiếp từ các phòng socket.io (không lưu DB): còn socket trong phòng = online.
  const staffOnline = () => (io.sockets.adapter.rooms.get(STAFF_ROOM)?.size || 0) > 0;
  const onlineSessionIds = () => {
    const ids = new Set();
    for (const s of io.sockets.sockets.values()) {
      if (s.data.sessionId) ids.add(s.data.sessionId);
    }
    return [...ids];
  };

  // Trợ lý tự động: hiện "đang soạn tin" một nhịp rồi gửi câu trả lời + nút dẫn tới đúng trang.
  async function scheduleAutoReply(sessionId, text) {
    try {
      const [customerCount, lastAuto, lastStaff] = await Promise.all([
        ChatMessage.countDocuments({ sessionId, sender: 'customer' }),
        ChatMessage.findOne({ sessionId, auto: true }).sort({ createdAt: -1 }).select('createdAt').lean(),
        ChatMessage.findOne({ sessionId, sender: 'staff', auto: { $ne: true } }).sort({ createdAt: -1 }).select('createdAt').lean(),
      ]);
      const isRecent = (doc) => !!doc && Date.now() - new Date(doc.createdAt).getTime() < AUTO_REPLY_COOLDOWN_MS;
      const reply = buildAutoReply(text, {
        isFirstMessage: customerCount <= 1,
        staffOnline: staffOnline(),
        recentAutoReply: isRecent(lastAuto),
        staffChatting: isRecent(lastStaff),
      });
      if (!reply) return;

      io.to(sessionId).emit('chat:typing', { sessionId, typing: true, from: 'staff' });
      setTimeout(async () => {
        try {
          const message = await ChatMessage.create({
            sessionId, sender: 'staff', text: reply.text, links: reply.links, auto: true, readByStaff: true,
          });
          io.to(sessionId).emit('chat:typing', { sessionId, typing: false, from: 'staff' });
          io.to([sessionId, STAFF_ROOM]).emit('chat:message', message);
        } catch (err) {
          console.error('chat auto-reply error', err);
        }
      }, AUTO_REPLY_DELAY_MS);
    } catch (err) {
      console.error('chat auto-reply error', err);
    }
  }

  io.on('connection', (socket) => {
    // Trang Tra cứu đơn: theo dõi trực tiếp 1 mã đơn, cùng điều kiện với GET /orders/by-number/:orderNumber
    // (chủ tài khoản hoặc đúng SĐT nhận hàng) vì sự kiện cập nhật chứa thông tin giao hàng.
    socket.on('order:watch', async ({ orderNumber, userToken, phone } = {}) => {
      try {
        const code = String(orderNumber || '').trim().toUpperCase();
        const ip = String(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address).split(',')[0].trim();
        if (!code || isLocked(ip)) return;
        const order = await Order.findOne({ orderNumber: code });
        if (order && await canWatchOrder(order, { userToken, phone })) socket.join(orderRoom(code));
        else recordFailure(ip);
      } catch (err) {
        console.error('order:watch error', err);
      }
    });
    socket.on('order:unwatch', (orderNumber) => {
      const code = String(orderNumber || '').trim().toUpperCase();
      if (code) socket.leave(orderRoom(code));
    });

    // Khách (my-client) vào phòng của cuộc chat mình — báo cho nhân viên khách này đang online,
    // và trả lại cho khách biết hiện có nhân viên trực hay không (chấm xanh trên khung chat).
    socket.on('chat:join', (sessionId) => {
      if (!sessionId) return;
      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      io.to(STAFF_ROOM).emit('chat:presence', { sessionId, online: true });
      socket.emit('chat:staff-status', { online: staffOnline() });
    });

    // Nhân viên (my-admin) vào phòng chung — chỉ khi token hợp lệ.
    socket.on('chat:staff-join', async (adminToken) => {
      const adminId = await adminIdFromToken(adminToken);
      if (!adminId || !(await adminHasPermission(adminId, 'customers.view'))) return;
      const wasOnline = staffOnline();
      socket.join(STAFF_ROOM);
      socket.data.isStaff = true;
      socket.data.adminId = adminId;
      socket.emit('chat:presence-list', { sessionIds: onlineSessionIds() });
      if (!wasOnline) io.except(STAFF_ROOM).emit('chat:staff-status', { online: true });
    });

    // "Đang gõ...": khách -> mọi nhân viên; nhân viên -> đúng cuộc chat của khách. Vai trò lấy theo
    // socket đã xác thực ở chat:staff-join, không tin cờ client gửi lên.
    socket.on('chat:typing', ({ sessionId, typing } = {}) => {
      if (!sessionId) return;
      const payload = { sessionId, typing: !!typing };
      if (socket.data.isStaff) socket.to(sessionId).emit('chat:typing', { ...payload, from: 'staff' });
      else if (socket.data.sessionId === sessionId) socket.to(STAFF_ROOM).emit('chat:typing', { ...payload, from: 'customer' });
    });

    socket.on('disconnect', () => {
      if (socket.data.isStaff && !staffOnline()) {
        io.emit('chat:staff-status', { online: false });
      }
      const sessionId = socket.data.sessionId;
      if (sessionId && !io.sockets.adapter.rooms.get(sessionId)?.size) {
        io.to(STAFF_ROOM).emit('chat:presence', { sessionId, online: false });
        io.to(STAFF_ROOM).emit('chat:typing', { sessionId, typing: false, from: 'customer' });
      }
    });

    // Vai trò người gửi do server quyết định: có token hợp lệ mới là "staff", còn lại là khách.
    socket.on('chat:message', async ({ sessionId, text, adminToken, userToken, customerName, customerPhone } = {}) => {
      try {
        const clean = String(text || '').trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!sessionId || !clean) return;

        const adminId = adminToken ? await adminIdFromToken(adminToken) : null;
        const fromStaff = !!adminId;
        if (fromStaff && !(await adminHasPermission(adminId, 'customers.edit'))) return;
        const userId = !fromStaff && userToken ? await userIdFromToken(userToken) : null;
        const message = await ChatMessage.create({
          sessionId,
          text: clean,
          ...(fromStaff
            ? { sender: 'staff', staffId: adminId, readByStaff: true }
            : { sender: 'customer', userId, customerName: customerName || null, customerPhone: customerPhone || null }),
        });
        io.to([sessionId, STAFF_ROOM]).emit('chat:message', message);
        if (!fromStaff) scheduleAutoReply(sessionId, clean);
      } catch (err) {
        console.error('chat:message error', err);
      }
    });
  });

  return io;
}

module.exports = { attachSocket };
