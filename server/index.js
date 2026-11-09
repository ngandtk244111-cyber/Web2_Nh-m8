// Đọc server/.env theo vị trí file, không theo thư mục đang đứng — chạy `node server/index.js` từ gốc repo vẫn nạp đủ biến.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./config/db');
const { attachSocket } = require('./socket');

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200').split(',').map(s => s.trim());

// Render đặt server sau proxy: cần dòng này để req.ip là IP thật của nhân viên trong Audit Log.
app.set('trust proxy', 1);
// maxAge: trình duyệt nhớ kết quả preflight 10 phút, không phải hỏi lại trước mỗi request có token.
app.use(cors({ origin: corsOrigins, maxAge: 600 }));
app.use(express.json());
// Avatar cũ chưa chuyển sang MongoDB (seed/migrate-storage.js). Ảnh mới lưu trong DB, không qua thư mục này.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/me/data', require('./routes/userDataRoutes'));
app.use('/api/admin/auth', require('./routes/adminAuthRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/warranty', require('./routes/warrantyRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/vouchers', require('./routes/voucherRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/custom-requests', require('./routes/customRequestRoutes'));
app.use('/api/community', require('./routes/communityRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/style-quiz', require('./routes/styleQuizRoutes'));
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/newsletter', require('./routes/newsletterRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/workshop-receipts', require('./routes/workshopReceiptRoutes'));
app.use('/api/ai/conversations', require('./routes/aiConversationRoutes'));
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
  .then(() => require('./models/User').unsetNullLoginIds())
  // Database cũ có thể còn index phoneNumber_1 KHÔNG sparse (tạo trước khi schema thêm sparse) -> tài khoản
  // Google/Facebook thứ 2 không có SĐT bị E11000. syncIndexes dựng lại index cho khớp schema User.
  .then(() => require('./models/User').syncIndexes())
  .then(() => require('./utils/permissions').ensureSuperAdmin())
  .catch(err => {
    // Không có MongoDB vẫn mở server: chatbox AI (Gemini) vẫn trả lời được, chỉ thiếu gợi ý sản phẩm từ DB.
    // Các chức năng cần dữ liệu (sản phẩm, đơn hàng, đăng nhập...) sẽ lỗi cho tới khi MongoDB chạy.
    console.error('Failed to connect to MongoDB:', err.message);
    console.warn('⚠ Server vẫn chạy KHÔNG có database — chỉ chatbox AI hoạt động. Cài/bật MongoDB rồi khởi động lại để dùng đầy đủ.');
  })
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Luméa server listening on http://localhost:${PORT}`);
      if (!process.env.GEMINI_API_KEY) console.warn('⚠ GEMINI_API_KEY trống trong server/.env — chatbox AI sẽ không trả lời.');
    });
  });
