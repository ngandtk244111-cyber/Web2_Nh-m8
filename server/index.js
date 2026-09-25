require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');
const { attachSocket } = require('./socket');

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200').split(',').map(s => s.trim());

app.use(cors({ origin: corsOrigins }));
app.use(express.json());
// Ảnh avatar upload — phục vụ tĩnh qua /uploads/... (xem authRoutes.js route POST /avatar).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin/auth', require('./routes/adminAuthRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/warranty', require('./routes/warrantyRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/coins', require('./routes/coinRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/custom-requests', require('./routes/customRequestRoutes'));
app.use('/api/community', require('./routes/communityRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/newsletter', require('./routes/newsletterRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Centralized error handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

const httpServer = http.createServer(app);
attachSocket(httpServer, corsOrigins);

const PORT = process.env.PORT || 4300;

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Luméa server listening on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
