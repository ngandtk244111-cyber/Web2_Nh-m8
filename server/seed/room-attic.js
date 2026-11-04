// Phòng mẫu gác mái cho Shop The Room (room-8).
// Mô hình chuyển từ FBX 3ds Max "AVE mansard VELUX windows set" (AVE graphics): vật liệu Corona không chuyển
// được sang glTF -> gán lại vật liệu theo tên từng nhóm (texture gỗ, bìa tạp chí/sách lấy từ bộ maps gốc),
// thêm sàn gỗ, tường thấp, vách mái nghiêng (chừa khung cửa), trần và tường trái, giảm lưới và nén toạ độ
// (KHR_mesh_quantization, GLTFLoader đọc sẵn):
// - assets/models/goc-gac-mai.glb  (~282 nghìn -> ~157 nghìn tam giác, ~4,9 MB)
//
// Toạ độ: hotspots/modelFocusBounds = toạ độ gốc .glb (mét, Y lên); camera = world sau khi viewer canh giữa + scale
// vùng modelFocusBounds về cạnh dài nhất 6 đơn vị:
// - room-8: world = (raw - [-0.1, 0, 0.85]) × 1.4286
// Phòng chỉ có tường thấp + vách mái phía sau và tường trái -> xoay ngang ±35°, góc dọc 65–88°.
//
// Chạy: node seed/room-attic.js  (ghi đè/thêm room-8 trong MONGODB_URI hiện tại)
const ATTIC_ROOM = {
  id: 'room-8',
  name: 'Góc Làm Việc Gác Mái Cửa Sổ Trời (Attic Workspace)',
  theme: 'Scandinavian Attic Study',
  tagline: 'Bàn gỗ sáng chân chữ A dưới hai ô cửa sổ mái, ghế vỏ trắng chân gỗ và đèn bàn cần gập trắng',
  description: 'Góc làm việc dựng từ mô hình 3D thật: mặt bàn gỗ sáng đặt trên hai chân chữ A sơn trắng, kê sát vách mái nghiêng với hai ô cửa sổ trời khung gỗ thông, ghế vỏ nhựa trắng chân gỗ, đèn bàn cần gập trắng, hộp hồ sơ gỗ đựng tạp chí và hộp đựng bút gỗ. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/goc-gac-mai.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/goc-gac-mai.glb',
  modelFocusBounds: { min: [-2.2, 0, -0.6], max: [2.0, 2.7, 2.3] },
  cameraInitial: { x: 2.86, y: 2.07, z: 2.5, fov: 50, orbitAzimuth: 35, orbitPolar: [65, 88] },
  cameraLookAt: [-0.14, 1.43, -1.5],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-at-1', productId: 'cat-table-15', label: 'Bàn Làm Việc Gỗ Sồi Sáng', position: [-0.75, 0.89, 0.15], annotationNote: 'Mặt gỗ sáng dài hơn 2m, đủ chỗ cho sách vở và đồ decor' },
    { id: 'hs-at-2', productId: 'furn-14', label: 'Ghế Vỏ Trắng Chân Gỗ', position: [-0.27, 0.95, 0.72], annotationNote: 'Vỏ ghế trắng ôm lưng, chân gỗ sồi giằng thép đen' },
    { id: 'hs-at-3', productId: 'cat-desk-lamp-07', label: 'Đèn Bàn Cần Gập Trắng', position: [0.93, 1.42, 0.14], annotationNote: 'Đèn kim loại sơn trắng, cần gập rọi sáng đúng chỗ đọc' },
    { id: 'hs-at-4', productId: 'cat-bookend-35', label: 'Giá Để Tạp Chí Gỗ', position: [0.68, 1.24, -0.22], annotationNote: 'Hộp hồ sơ gỗ đứng gọn tạp chí, sổ sách trên bàn' },
    { id: 'hs-at-5', productId: 'cat-organizer-06', label: 'Hộp Đựng Bút Gỗ Sồi', position: [-0.31, 1.08, -0.13], annotationNote: 'Hộp gỗ nhỏ gom bút, cuộn chỉ và đồ lặt vặt' },
  ],
};

module.exports = { ATTIC_ROOM };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await Room.findOneAndReplace({ id: ATTIC_ROOM.id }, ATTIC_ROOM, { upsert: true, runValidators: true });
    const saved = await Room.findOne({ id: ATTIC_ROOM.id }).lean();
    console.log(ATTIC_ROOM.id, '=', saved.name, '·', saved.hotspots.length, 'hotspot');
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
