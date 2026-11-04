// Phòng mẫu "Phòng Ăn Mây Đan & Gỗ Sẫm" (room-4) cho Shop The Room.
// Mô hình: assets/models/phong-an.glb — chuyển từ bộ bàn ăn Crate & Barrel (OBJ 1,08 triệu tam giác,
// vật liệu không gắn texture) -> gán lại gỗ Basque, mây đan, tranh, khăn lanh, sàn ván; giảm lưới (~8 MB).
//
// Toạ độ:
// - hotspots[].position, modelFocusBounds: toạ độ GỐC trong file .glb (mét, trục Y hướng lên).
// - cameraInitial / cameraLookAt: toạ độ world SAU khi viewer canh giữa + scale vùng modelFocusBounds về
//   cạnh dài nhất 6 đơn vị: world = (raw - [0, 0, -0.125]) × 1.875.
// - Phòng chỉ có 1 bức tường phía sau -> xoay quanh bàn ±55° ngang, góc dọc 62–86° (không ra sau tường).
//
// Chạy: node seed/room-dining.js  (ghi đè/thêm room-4 trong MONGODB_URI hiện tại)
const DINING_ROOM = {
  id: 'room-4',
  name: 'Phòng Ăn Mây Đan & Gỗ Sẫm (Dining Room)',
  theme: 'Warm Rustic Dining',
  tagline: 'Bàn ăn gỗ sẫm 6 ghế mây đan, đèn thả lưới và tranh trừu tượng cho bữa tối ấm cúng',
  description:
    'Góc phòng ăn dựng từ mô hình 3D thật: bàn gỗ sẫm vân mộc cho 6 người, ghế mây đan có nệm, cụm đèn thả '
    + 'lưới kim loại, tranh trừu tượng khổ lớn và khay trang trí giữa bàn. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/phong-an.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/phong-an.glb',
  modelFocusBounds: { min: [-1.6, 0, -1.45], max: [1.6, 2.6, 1.2] },
  cameraInitial: { x: 0.75, y: 3.0, z: 5.48, fov: 50, orbitAzimuth: 55, orbitPolar: [62, 86] },
  cameraLookAt: [0, 1.5, 0.23],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-da-1', productId: 'furn-19', label: 'Bàn Ăn Gỗ 6 Chỗ', position: [-0.7, 0.78, 0.3], annotationNote: 'Mặt gỗ dày vân mộc, đủ chỗ cho 6 người' },
    { id: 'hs-da-2', productId: 'cat-chair-03', label: 'Ghế Ăn', position: [0.45, 0.8, 0.8], annotationNote: 'Ghế ăn tựa lưng thoáng, ngồi lâu không mỏi' },
    { id: 'hs-da-3', productId: 'cat-pendant-01', label: 'Đèn Thả Chùm', position: [0.25, 1.85, 0.1], annotationNote: 'Cụm đèn thả nhiều bóng làm điểm nhấn trên bàn ăn' },
    { id: 'hs-da-4', productId: 'cat-frame-02', label: 'Tranh Treo Tường', position: [0.75, 1.3, -1.18], annotationNote: 'Tranh khổ lớn cân bố cục bức tường sau bàn' },
    { id: 'hs-da-5', productId: 'prod-13', label: 'Khay Gỗ Decor', position: [0.45, 0.82, 0], annotationNote: 'Khay gỗ gom nến, bình hoa giữa bàn' },
  ],
};

module.exports = { DINING_ROOM };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await Room.findOneAndReplace({ id: 'room-4' }, DINING_ROOM, { upsert: true, runValidators: true });
    const saved = await Room.findOne({ id: 'room-4' }).lean();
    console.log('room-4 =', saved.name, '·', saved.hotspots.length, 'hotspot');
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
