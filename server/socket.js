const mongoose = require('mongoose');
const { Server } = require('socket.io');
const ChatMessage = require('./models/ChatMessage');
const Admin = require('./models/Admin');
const { setIO, orderRoom } = require('./realtime');

// Phòng chung của nhân viên my-admin: nhận mọi tin nhắn của mọi cuộc chat để cập nhật hộp thư.
const STAFF_ROOM = 'staff';
const MAX_MESSAGE_LENGTH = 2000;

async function isAdmin(adminId) {
  if (!adminId || !mongoose.isValidObjectId(adminId)) return false;
  return !!(await Admin.exists({ _id: adminId }));
}

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

  io.on('connection', (socket) => {
    // Trang Tra cứu đơn: theo dõi trực tiếp 1 mã đơn (cùng mức công khai với GET /orders/by-number/:orderNumber).
    socket.on('order:watch', (orderNumber) => {
      const code = String(orderNumber || '').trim().toUpperCase();
      if (code) socket.join(orderRoom(code));
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

    // Nhân viên (my-admin) vào phòng chung — chỉ khi adminId tồn tại thật.
    socket.on('chat:staff-join', async (adminId) => {
      if (!(await isAdmin(adminId))) return;
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

    // Vai trò người gửi do server quyết định: có adminId hợp lệ mới là "staff", còn lại là khách.
    socket.on('chat:message', async ({ sessionId, text, adminId, userId, customerName, customerPhone } = {}) => {
      try {
        const clean = String(text || '').trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!sessionId || !clean) return;

        const fromStaff = adminId ? await isAdmin(adminId) : false;
        const message = await ChatMessage.create({
          sessionId,
          text: clean,
          ...(fromStaff
            ? { sender: 'staff', staffId: adminId, readByStaff: true }
            : { sender: 'customer', userId: userId || null, customerName: customerName || null, customerPhone: customerPhone || null }),
        });
        io.to([sessionId, STAFF_ROOM]).emit('chat:message', message);
      } catch (err) {
        console.error('chat:message error', err);
      }
    });
  });

  return io;
}

module.exports = { attachSocket };
