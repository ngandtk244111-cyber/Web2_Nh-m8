// Phòng mẫu "Góc Làm Việc Hồng Đất & Gỗ Sồi" (room-5) cho Shop The Room.
// Mô hình: assets/models/goc-lam-viec.glb — chuyển từ OBJ "workplace" (750 nhóm, không có vật liệu/texture vì file
// RAR solid chỉ giải nén được OBJ) -> tô màu theo vị trí/kích thước từng món, thêm sàn gỗ + tường sau, giảm lưới (~5,6 MB).
//
// Toạ độ: hotspots/modelFocusBounds = toạ độ gốc .glb (mét, Y lên); camera = world sau scale:
// world = (raw - [0, 0, 0.19]) × 2.3077. Xoay quanh ±50° ngang, góc dọc 62–86° (không ra sau tường).
//
// Chạy: node seed/room-workplace.js  (ghi đè/thêm room-5 trong MONGODB_URI hiện tại)
const WORKPLACE_ROOM = {
  id: 'room-5',
  name: 'Góc Làm Việc Hồng Đất & Gỗ Sồi (Home Office)',
  theme: 'Soft Home Office',
  tagline: 'Bàn gỗ sồi, ghế nệm hồng đất, kệ treo tường và đèn cây chao vải — góc làm việc nhẹ nhàng tại nhà',
  description: 'Góc làm việc dựng từ mô hình 3D thật: bàn gỗ sồi ngăn kéo, ghế nệm hồng đất chân thép, tủ ngăn kéo trắng, kệ treo tường bày thuyền buồm và khung ảnh, đèn cây chao vải lanh. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/goc-lam-viec.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/goc-lam-viec.glb',
  modelFocusBounds: { min: [-1.3, 0, -0.62], max: [1.3, 2.1, 1.0] },
  cameraInitial: { x: 0.92, y: 3.58, z: 4.87, fov: 50, orbitAzimuth: 50, orbitPolar: [62, 86] },
  cameraLookAt: [0, 1.96, -0.67],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-wk-1', productId: 'cat-table-14', label: 'Bàn Làm Việc Gỗ Sồi', position: [0.35, 0.77, -0.15], annotationNote: 'Mặt gỗ sồi sáng, ngăn kéo gọn đồ lặt vặt' },
    { id: 'hs-wk-2', productId: 'furn-13', label: 'Ghế Bọc Nệm', position: [0, 0.8, 0.35], annotationNote: 'Ghế nệm êm, chân thép mảnh nhẹ nhàng' },
    { id: 'hs-wk-3', productId: 'cat-pendant-30', label: 'Đèn Cây Chao Vải', position: [0.88, 1.35, -0.09], annotationNote: 'Ánh sáng dịu cho góc đọc và làm việc buổi tối' },
    { id: 'hs-wk-4', productId: 'prod-4', label: 'Kệ Treo Tường', position: [-0.3, 1.46, -0.43], annotationNote: 'Kệ gỗ – kim loại bày sách, khung ảnh, đồ decor' },
    { id: 'hs-wk-5', productId: 'furn-31', label: 'Tủ Ngăn Kéo Trắng', position: [-0.85, 0.45, 0.02], annotationNote: 'Tủ 6 ngăn kéo trắng, đặt sát bàn làm việc' },
  ],
};

module.exports = { WORKPLACE_ROOM };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await Room.findOneAndReplace({ id: 'room-5' }, WORKPLACE_ROOM, { upsert: true, runValidators: true });
    const saved = await Room.findOne({ id: 'room-5' }).lean();
    console.log('room-5 =', saved.name, '·', saved.hotspots.length, 'hotspot');
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
