// Hai phòng bếp mẫu cho Shop The Room (room-6, room-7).
// Mô hình chuyển từ OBJ 3ds Max (không có vật liệu thật, chỉ màu wire) -> gán lại vật liệu theo tên/vị trí từng
// nhóm, thêm sàn gỗ + 2 bức tường, giảm lưới và nén toạ độ (KHR_mesh_quantization, GLTFLoader đọc sẵn):
// - assets/models/bep-dao-go-soi.glb  (PIET BOON SIGNATURE kitchen, 1,43 triệu -> ~183 nghìn tam giác, ~3,4 MB)
// - assets/models/bep-dao-oc-cho.glb  (Poliform Varenna TWELVE, 1,34 triệu -> ~113 nghìn tam giác, ~2,1 MB)
//
// Toạ độ: hotspots/modelFocusBounds = toạ độ gốc .glb (mét, Y lên); camera = world sau khi viewer canh giữa + scale
// vùng modelFocusBounds về cạnh dài nhất 6 đơn vị:
// - room-6: world = (raw - [-0.9, 0, 1.5]) × 0.8955
// - room-7: world = (raw - [0.1, 0, 0.11]) × 0.9091
// Mỗi phòng chỉ có tường sau + tường trái -> xoay ngang ±45°, góc dọc 62–86° (không ra sau tường).
//
// Chạy: node seed/room-kitchens.js  (ghi đè/thêm room-6, room-7 trong MONGODB_URI hiện tại)
const KITCHEN_OAK_ROOM = {
  id: 'room-6',
  name: 'Bếp Đảo Gỗ Sồi Hun Khói & Bàn Ăn 6 Chỗ (Island Kitchen)',
  theme: 'Warm Modern Kitchen',
  tagline: 'Đảo bếp đá đen, tủ gỗ sồi hun khói, tủ rượu âm tường và bàn ăn gỗ sồi 6 ghế bọc vải',
  description: 'Gian bếp dựng từ mô hình 3D thật: đảo bếp mặt đá đen có bồn rửa và bếp nấu, dãy tủ cao gỗ sồi hun khói với tủ lạnh và tủ rượu âm tường, bàn ăn gỗ sồi 6 ghế bọc vải xám, đèn thả khung đen và bình hoa gốm trên đảo. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/bep-dao-go-soi.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/bep-dao-go-soi.glb',
  modelFocusBounds: { min: [-4.25, 0, -1.75], max: [2.45, 3.1, 4.75] },
  cameraInitial: { x: 3.76, y: 2.06, z: 4.21, fov: 50, orbitAzimuth: 45, orbitPolar: [62, 86] },
  cameraLookAt: [-0.18, 0.85, -0.45],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-kt-1', productId: 'cat-table-03', label: 'Bàn Ăn Gỗ Sồi 6 Chỗ', position: [-0.76, 0.77, 3.27], annotationNote: 'Mặt gỗ sồi dày, chân bản lớn vững chãi cho bữa cơm 6 người' },
    { id: 'hs-kt-2', productId: 'cat-chair-01', label: 'Ghế Ăn Bọc Vải Xám', position: [-0.25, 0.86, 3.9], annotationNote: 'Ghế bọc vải xám ấm, khung thép sơn đen mảnh' },
    { id: 'hs-kt-3', productId: 'cat-pendant-21', label: 'Đèn Thả Khung Đen', position: [-0.75, 1.62, 3.24], annotationNote: 'Đèn thả khung nhôm sơn đen, rọi sáng đều cả mặt bàn dài' },
    { id: 'hs-kt-4', productId: 'cat-vase-12', label: 'Bình Hoa Gốm Trắng', position: [-0.02, 1.12, 0.86], annotationNote: 'Bình gốm trắng dáng cao, cắm cành lá tươi trên đảo bếp' },
    { id: 'hs-kt-5', productId: 'cat-stool-02', label: 'Ghế Đôn Quầy Bar Gỗ Sồi', position: [1.75, 0.68, -0.59], annotationNote: 'Ghế đôn gỗ sồi chân xoè, ngồi nhanh bên quầy bếp' },
    { id: 'hs-kt-6', productId: 'cat-vase-02', label: 'Bộ Lọ Gốm Decor', position: [-3.85, 1.72, 0.5], annotationNote: 'Bộ lọ gốm be bày trên tủ thấp cạnh máy pha cà phê' },
  ],
};

const KITCHEN_WALNUT_ROOM = {
  id: 'room-7',
  name: 'Bếp Đảo Óc Chó & Quầy Bar (Walnut Island Kitchen)',
  theme: 'Minimal Walnut Kitchen',
  tagline: 'Tủ cao gỗ óc chó, đảo bếp sơn mờ mặt đá sáng nối quầy bar gỗ sồi và ghế bọc da cognac',
  description: 'Gian bếp dựng từ mô hình 3D thật: dãy tủ cao gỗ óc chó với lò và máy pha cà phê âm tủ, đảo bếp dài sơn mờ màu greige mặt đá sáng, quầy bar gỗ sồi nối chữ T với 6 ghế bọc da cognac, kệ treo tường gỗ óc chó bày ly và lọ gia vị. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/bep-dao-oc-cho.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/bep-dao-oc-cho.glb',
  modelFocusBounds: { min: [-3.2, 0, -2.78], max: [3.4, 2.9, 3.0] },
  cameraInitial: { x: 3.82, y: 2.18, z: 3.99, fov: 50, orbitAzimuth: 45, orbitPolar: [62, 86] },
  cameraLookAt: [-0.46, 0.86, -0.37],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-kw-1', productId: 'cat-stool-09', label: 'Ghế Đôn Bọc Da Nâu', position: [2.59, 0.8, 2.3], annotationNote: 'Mặt ngồi bọc da màu cognac, chân thép mảnh' },
    { id: 'hs-kw-2', productId: 'cat-table-02', label: 'Bàn Ăn Gỗ Sồi', position: [2.6, 0.96, 1.6], annotationNote: 'Mặt gỗ sồi sáng nối liền đảo bếp thành quầy bar' },
    { id: 'hs-kw-3', productId: 'prod-17', label: 'Khay Gốm Decor', position: [1.77, 1.03, 1.6], annotationNote: 'Khay gốm trắng gom trái cây, đồ lặt vặt giữa bàn' },
    { id: 'hs-kw-4', productId: 'cat-shelf-15', label: 'Kệ Treo Tường Gỗ Óc Chó', position: [0.2, 1.62, -2.6], annotationNote: 'Kệ gỗ óc chó nhiều ngăn bày ly, lọ gia vị' },
    { id: 'hs-kw-5', productId: 'cat-vase-15', label: 'Lọ Gốm Mini', position: [2.1, 1.34, -2.6], annotationNote: 'Lọ gốm trắng nhỏ xinh xếp thành hàng trên kệ' },
    { id: 'hs-kw-6', productId: 'cat-cabinet-04', label: 'Tủ Âm Tường Gỗ Óc Chó', position: [-2.52, 2.0, 1.0], annotationNote: 'Tủ cao kịch trần gỗ óc chó, chứa đồ gọn cả mảng tường' },
  ],
};

const KITCHEN_ROOMS = [KITCHEN_OAK_ROOM, KITCHEN_WALNUT_ROOM];

module.exports = { KITCHEN_ROOMS };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const room of KITCHEN_ROOMS) {
      await Room.findOneAndReplace({ id: room.id }, room, { upsert: true, runValidators: true });
      const saved = await Room.findOne({ id: room.id }).lean();
      console.log(room.id, '=', saved.name, '·', saved.hotspots.length, 'hotspot');
    }
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
