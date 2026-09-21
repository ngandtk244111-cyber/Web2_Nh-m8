const { Server } = require('socket.io');
const ChatMessage = require('./models/ChatMessage');

function attachSocket(httpServer, corsOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    socket.on('chat:join', (sessionId) => {
      socket.join(sessionId);
    });

    socket.on('chat:message', async ({ sessionId, sender, text }) => {
      if (!sessionId || !text || !text.trim()) return;
      const message = await ChatMessage.create({ sessionId, sender, text: text.trim() });
      io.to(sessionId).emit('chat:message', message);
    });
  });

  return io;
}

module.exports = { attachSocket };
