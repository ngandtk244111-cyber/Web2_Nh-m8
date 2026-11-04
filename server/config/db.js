const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  // Báo lỗi sau 5s thay vì 30s mặc định khi máy chưa bật MongoDB, để server mở nhanh (chatbox AI vẫn chạy).
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected:', uri);
}

module.exports = { connectDB };
