// room-12 "Living Room - Kitchen" (Hoàng Anh Dũng, 3dzip 12891): CoronaMtl, đơn vị mm -> mét
// - assets/models/phong-khach-bep-tan-co-dien.glb (~21,5 triệu -> ~350 nghìn tam giác, ~10 MB)
//   sàn/tường gốc dựng bằng ProBoolean/Box không chuyển được -> dựng lại sàn đá Statuario (texture gốc của file)
//   và tường bao; bỏ rặng tre + cây sứ ngoài cửa sổ, các bình hoa quá nặng và tivi bị lệch trục khi chuyển
// - camera: room-scenes.ts gắn model thẳng vào roomGroup (bỏ scale của wrapper) nên world thực = raw - [-0.075, 0, 1.175]
//
// Chạy: node seed/room-neoclassic.js  (ghi đè/thêm room-12 trong MONGODB_URI hiện tại)
const NEOCLASSIC_ROOM = {
  id: 'room-12',
  name: 'Phòng Khách – Bếp Tân Cổ Điển Đen Trắng (Neo-classic Living & Kitchen)',
  theme: 'Neo-classic Monochrome',
  tagline: 'Sofa cong da đen, bốn ghế bành xám than trên sàn đá Statuario, quầy bar rượu và bàn ăn tám ghế dưới đèn chùm đen',
  description: 'Không gian mở dựng từ mô hình 3D thật: sofa cong bọc da đen cùng bốn ghế bành xám than quây quanh bàn trà khung trắng mặt kính đen trên thảm xám vân loang, bàn tròn mặt đá đen chân vàng đón khách ở lối vào, vách kệ rượu nan trắng ngăn sang bếp chữ L trắng có quầy bar hai ghế nhung, và bàn ăn mặt trắng tám ghế nhung nâu dưới hai đèn chùm ống đen — tất cả trên nền đá Statuario trắng vân xám, rèm satin be buông kịch trần. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/phong-khach-bep-tan-co-dien.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/phong-khach-bep-tan-co-dien.glb',
  modelFocusBounds: { min: [-5.75, 0, -3.1], max: [5.6, 3.2, 5.45] },
  cameraInitial: { x: -5.03, y: 1.75, z: 1.53, fov: 55, orbitAzimuth: 20, orbitPolar: [65, 88] },
  cameraLookAt: [1.08, 0.9, -1.58],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-nc-1', productId: 'cat-sofa-04', label: 'Sofa Cong Da Đen', position: [-4.66, 0.7, -0.58], annotationNote: 'Sofa lưng cong bọc da đen bóng, kê sát tường cửa sổ' },
    { id: 'hs-nc-2', productId: 'cat-chair-13', label: 'Ghế Bành Xám Than', position: [-2.52, 0.75, 1.17], annotationNote: 'Bốn ghế bành lưng ôm xám than quây quanh bàn trà' },
    { id: 'hs-nc-3', productId: 'furn-22', label: 'Bàn Trà Khung Trắng', position: [-3.05, 0.5, -0.33], annotationNote: 'Khung trắng viền vàng, mặt kính đen và khay dưới' },
    { id: 'hs-nc-4', productId: 'cat-side-table-01', label: 'Bàn Tròn Mặt Đá Đen', position: [-0.84, 0.65, 2.62], annotationNote: 'Mặt đá đen vân vàng trên chân vòng kim loại vàng ở lối vào' },
    { id: 'hs-nc-5', productId: 'cat-table-04', label: 'Bàn Ăn Mặt Trắng 8 Chỗ', position: [3.43, 0.85, 3.37], annotationNote: 'Bàn ăn dài mặt trắng chân tân cổ điển cho tám người' },
    { id: 'hs-nc-6', productId: 'cat-chair-09', label: 'Ghế Ăn Nhung Nâu', position: [4.18, 0.95, 2.95], annotationNote: 'Lưng tròn bọc nhung nâu trầm, chân cong sơn đen' },
    { id: 'hs-nc-7', productId: 'furn-15', label: 'Ghế Quầy Bar', position: [3.68, 0.95, 1.36], annotationNote: 'Ghế bar nệm nhung chân cao đặt cạnh đảo bếp trắng' },
    { id: 'hs-nc-8', productId: 'cat-pendant-06', label: 'Đèn Chùm Ống Đen', position: [3.39, 2.35, 2.81], annotationNote: 'Chùm nhiều ống đen xếp tầng treo trên bàn ăn' },
    // Cặp bàn phụ + đèn bàn hai bên sofa (giống hệt nhau) — gắn số vào cặp phía lối vào (Helix012 / Cylinder885755).
    { id: 'hs-nc-9', productId: 'cat-night-lamp-16', label: 'Đèn Bàn Chụp Vải Kem', position: [-4.18, 1.12, 1.11], annotationNote: 'Chụp vải trụ màu kem trên thân kim loại uốn hoa văn, đặt cạnh sofa' },
    { id: 'hs-nc-10', productId: 'lumea-ban-0221', label: 'Bàn Phụ Tròn Mặt Đá', position: [-4.18, 0.5, 1.26], annotationNote: 'Mặt tròn đá tối trên ba chân uốn xoắn, kê đèn đọc sách cạnh sofa' },
  ],
};

module.exports = { NEOCLASSIC_ROOM };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await Room.findOneAndReplace({ id: NEOCLASSIC_ROOM.id }, NEOCLASSIC_ROOM, { upsert: true, runValidators: true });
    const saved = await Room.findOne({ id: NEOCLASSIC_ROOM.id }).lean();
    console.log(saved.id, '=', saved.name, '·', saved.hotspots.length, 'hotspot');
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
