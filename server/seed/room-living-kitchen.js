// Phòng mẫu "Phòng Khách – Bếp Mở" — thay cho room-3 (Căn Hộ Châu Âu scan cũ).
// Mô hình: assets/models/phong-khach-bep.glb, chuyển từ file 3ds Max "Living Room – Kitchen Interior"
// (Hoàng Hải Anh, 3dzip.org), chỉ giữ khu phòng khách + bếp, gán lại vật liệu, giảm lưới (~5 MB).
//
// Toạ độ:
// - hotspots[].position, modelFocusBounds: toạ độ GỐC trong file .glb (mét, trục Y hướng lên).
// - cameraInitial / cameraLookAt: toạ độ world SAU khi viewer canh giữa + scale vùng modelFocusBounds
//   về cạnh dài nhất 6 đơn vị (room-scenes.ts → centerAndNormalize): world = (raw - [-1.68, 0, -3.325]) × 0.7212.
//
// Chạy: node seed/room-living-kitchen.js  (ghi đè room-3 trong MONGODB_URI hiện tại)
const LIVING_KITCHEN_ROOM = {
  id: 'room-3',
  name: 'Phòng Khách – Bếp Mở Tối Giản (Living & Kitchen)',
  theme: 'Modern Minimal Living Room',
  tagline: 'Phòng khách liền bếp tông trắng – gỗ, sofa êm, bàn trà tròn và góc ăn nhỏ xinh',
  description:
    'Không gian phòng khách liền bếp được dựng từ mô hình 3D thật: sofa vải, bàn trà tròn, ghế bành đọc sách, '
    + 'kệ TV trắng mờ và bàn ăn tròn cho 4 người. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/phong-khach-bep.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/phong-khach-bep.glb?v=2',
  modelFocusBounds: { min: [-5.84, 0, -5.8], max: [2.48, 2.7, -0.85] },
  // Đứng giữa phòng khách (giữa bàn ăn và bàn trà, cách mọi vật ≥ 0,9 đơn vị), mắt cao 1,55 m,
  // nhìn ban đầu về sofa + ghế bành; xoay quanh 360° thấy bàn ăn, bếp, kệ TV.
  cameraInitial: { x: 0.71, y: 1.12, z: 0.81, fov: 60 },
  cameraLookAt: [2.65, 0.58, 1.17],
  // Đứng cố định một chỗ, kéo chuột xoay nhìn quanh 360° (không đi xuyên tường).
  walkthroughMode: true,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-lk-1', productId: 'furn-03', label: 'Sofa Vải 3 Chỗ', position: [0.56, 0.75, -1.3], annotationNote: 'Sofa vải êm, tựa lưng thấp cho phòng khách gọn' },
    { id: 'hs-lk-2', productId: 'furn-21', label: 'Bàn Trà Tròn', position: [0.55, 0.34, -2.44], annotationNote: 'Bàn trà tròn bo mềm, đi lại không vướng góc' },
    { id: 'hs-lk-3', productId: 'cat-chair-13', label: 'Ghế Bành Đọc Sách', position: [1.75, 0.8, -2.96], annotationNote: 'Góc đọc sách cạnh cửa sổ' },
    { id: 'hs-lk-4', productId: 'furn-18', label: 'Bàn Ăn Tròn 4 Người', position: [-2.11, 0.78, -2.57], annotationNote: 'Bàn ăn tròn mặt trắng, vừa căn hộ nhỏ' },
    { id: 'hs-lk-5', productId: 'cat-cabinet-21', label: 'Kệ TV Trắng Mờ', position: [0.6, 0.65, -3.4], annotationNote: 'Kệ TV thấp trắng mờ, liền khối với tủ kệ' },
  ],
};

module.exports = { LIVING_KITCHEN_ROOM };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await Room.findOneAndReplace({ id: 'room-3' }, LIVING_KITCHEN_ROOM, { upsert: true, runValidators: true });
    const saved = await Room.findOne({ id: 'room-3' }).lean();
    console.log('room-3 =', saved.name, '·', saved.hotspots.length, 'hotspot');
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
