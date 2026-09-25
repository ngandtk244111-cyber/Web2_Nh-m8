const mongoose = require('mongoose');
const { Server } = require('socket.io');
const ChatMessage = require('./models/ChatMessage');
const Admin = require('./models/Admin');

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

  io.on('connection', (socket) => {
    // Khách (my-client) vào phòng của cuộc chat mình.
    socket.on('chat:join', (sessionId) => {
      if (sessionId) socket.join(sessionId);
    });

    // Nhân viên (my-admin) vào phòng chung — chỉ khi adminId tồn tại thật.
    socket.on('chat:staff-join', async (adminId) => {
      if (await isAdmin(adminId)) socket.join(STAFF_ROOM);
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
