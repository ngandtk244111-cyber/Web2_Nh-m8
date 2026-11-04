// Các phòng mẫu Shop The Room chuyển từ file 3ds Max (.max):
// - room-9  "M004 Nordic style" (3d66): VRayMtl, đơn vị inch -> mét (× 0,0254)
// - room-10 "Living Room - Kitchen" (Phạm Thanh Nhàn): CoronaMtl, đơn vị mm -> mét
// Đọc trực tiếp chunk .max (group/parent, pivot offset, Editable Poly/Mesh, UV kênh 1, UVW Map, Multi/Sub,
// texture qua FileAssetMetaData), cắt vùng phòng, giảm lưới, nén texture (KHR_mesh_quantization):
// - assets/models/phong-doc-bac-au.glb          (~2,3 triệu -> ~200 nghìn tam giác, ~10 MB)
//   rèm có FFD bù scale -> dựng lại cao 2,6 m; bỏ chao đèn trùng và hộp đan khuất dưới kệ
// - assets/models/phong-khach-da-cam-thach.glb  (~12 triệu -> ~490 nghìn tam giác, ~15 MB)
//   sàn phủ đá Calacatta (texture gốc của file), bỏ dây leo treo và các chậu lan quá nặng
//
// Toạ độ: hotspots/modelFocusBounds = toạ độ gốc .glb (mét, Y lên); camera = world sau khi viewer canh giữa + scale
// vùng modelFocusBounds về cạnh dài nhất 6 đơn vị:
// - room-9:  world = (raw - [4.235, 0, -2.565]) × 1.232
// - room-10: world = (raw - [4.535, 0, 6.74]) × 0.738
//
// Chạy: node seed/room-max-scenes.js  (ghi đè/thêm room-9, room-10 trong MONGODB_URI hiện tại)
const NORDIC_ROOM = {
  id: 'room-9',
  name: 'Phòng Đọc Sách Bắc Âu Gỗ Óc Chó (Nordic Reading Room)',
  theme: 'Nordic Walnut Study',
  tagline: 'Bàn óc chó bo góc dưới đèn thả mây đan, kệ sách gỗ sồi kịch trần và sàn gỗ ấm',
  description: 'Phòng đọc dựng từ mô hình 3D thật: bàn gỗ óc chó bo góc với hai ghế khung gỗ nệm vải xanh, đèn thả chụp mây đan, kệ sách gỗ sồi nhiều tầng chia đôi không gian, ghế bành vải xám rêu bên cửa sổ khung đen, rèm voan trắng phối rèm vải than chì và tranh canvas đen trắng. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/phong-doc-bac-au.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/phong-doc-bac-au.glb',
  modelFocusBounds: { min: [2.57, 0, -5.0], max: [5.9, 2.65, -0.13] },
  cameraInitial: { x: -0.29, y: 1.91, z: 2.73, fov: 55, orbitAzimuth: 30, orbitPolar: [65, 88] },
  cameraLookAt: [0.2, 1.23, -0.78],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-nd-1', productId: 'cat-table-12', label: 'Bàn Gỗ Óc Chó Bo Góc', position: [4.42, 0.76, -3.03], annotationNote: 'Mặt óc chó vân đậm bo tròn góc, chân vát thanh mảnh' },
    { id: 'hs-nd-2', productId: 'cat-chair-03', label: 'Ghế Gỗ Óc Chó Nệm Vải', position: [4.12, 0.55, -2.3], annotationNote: 'Khung óc chó tựa cong, nệm ngồi bọc vải hoa văn xanh' },
    { id: 'hs-nd-3', productId: 'cat-pendant-25', label: 'Đèn Thả Chụp Mây Đan', position: [4.51, 2.0, -3.12], annotationNote: 'Chụp mây đan thủ công hắt ánh sáng ấm xuống mặt bàn' },
    { id: 'hs-nd-4', productId: 'cat-shelf-18', label: 'Kệ Sách Gỗ Sồi Nhiều Tầng', position: [5.37, 1.65, -1.96], annotationNote: 'Kệ gỗ sồi sáng kịch trần, vừa chứa sách vừa làm vách ngăn' },
    { id: 'hs-nd-5', productId: 'cat-chair-13', label: 'Ghế Bành Vải Xám Rêu', position: [4.95, 0.62, -4.4], annotationNote: 'Ghế bành vải xám ôm lưng, góc đọc sách bên cửa sổ' },
    { id: 'hs-nd-6', productId: 'cat-frame-18', label: 'Tranh Canvas Đen Trắng', position: [2.6, 1.55, -3.13], annotationNote: 'Canvas trừu tượng tông xám khung gỗ tối trên tường trắng' },
  ],
};

const MARBLE_LIVING_ROOM = {
  id: 'room-10',
  name: 'Phòng Khách Sàn Đá Calacatta (Marble Living Room)',
  theme: 'Modern Luxe Living',
  tagline: 'Sofa chần nút trắng phối da bò cognac trên sàn đá Calacatta, tranh thủy mặc và bàn ăn đèn vòng',
  description: 'Phòng khách liền bàn ăn dựng từ mô hình 3D thật: dãy sofa module chần nút trắng nối sofa văng da bò cognac, ghế bành da nâu đỏ, bàn trà mặt kính viền đen trên thảm xám, tường tranh thủy mặc khổ lớn, rèm vải lanh be buông kịch trần, kệ tivi trắng âm tường và bàn ăn sáu ghế da dưới đèn thả vòng tròn — tất cả trên nền đá cẩm thạch Calacatta vân xám. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/phong-khach-da-cam-thach.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/phong-khach-da-cam-thach.glb',
  modelFocusBounds: { min: [0.47, 0, 3.24], max: [8.6, 3.5, 10.24] },
  cameraInitial: { x: 0.49, y: 1.25, z: 2.11, fov: 55, orbitAzimuth: 30, orbitPolar: [65, 88] },
  cameraLookAt: [-0.985, 0.66, -1.28],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-lv-1', productId: 'cat-sofa-26', label: 'Sofa Góc Chần Nút Trắng', position: [3.56, 0.6, 4.0], annotationNote: 'Module chần nút trắng kem, nệm sâu kèm gối tựa da cognac' },
    { id: 'hs-lv-2', productId: 'cat-sofa-07', label: 'Sofa Văng Da Bò Cognac', position: [1.28, 0.55, 4.4], annotationNote: 'Da bò nâu cognac khâu chỉ nổi, nối liền dãy sofa trắng' },
    { id: 'hs-lv-3', productId: 'cat-chair-17', label: 'Ghế Bành Da Nâu Đỏ', position: [4.6, 0.6, 5.5], annotationNote: 'Lưng cong ôm người, da nâu đỏ trên chân kim loại đen' },
    { id: 'hs-lv-4', productId: 'furn-22', label: 'Bàn Trà Viền Đen Mặt Sáng', position: [3.03, 0.3, 5.3], annotationNote: 'Khối thấp viền đen bo góc, mặt sáng đặt bình hoa khô' },
    { id: 'hs-lv-5', productId: 'cat-cabinet-21', label: 'Kệ Tivi Thấp Trắng', position: [3.16, 0.45, 9.86], annotationNote: 'Kệ trắng mờ dài 3m chạy dọc tường tivi, ngăn mở để loa' },
    { id: 'hs-lv-6', productId: 'cat-table-04', label: 'Bàn Ăn 6 Ghế', position: [7.0, 0.78, 8.97], annotationNote: 'Bàn ăn sáu chỗ đặt giữa không gian mở cạnh phòng khách' },
    { id: 'hs-lv-7', productId: 'cat-chair-09', label: 'Ghế Ăn Bọc Da Nâu', position: [6.5, 0.7, 8.45], annotationNote: 'Ghế ăn bọc da nâu trầm, chân kim loại đen thanh mảnh' },
    { id: 'hs-lv-8', productId: 'cat-pendant-11', label: 'Đèn Thả Vòng Tròn', position: [6.98, 2.3, 9.0], annotationNote: 'Hai vòng đèn mảnh treo lệch tầng phía trên bàn ăn' },
  ],
};

// room-11 "Living Room - Kitchen" (Quan Tran): CoronaMtl, đơn vị mm -> mét
// - assets/models/phong-khach-marble-den.glb (~9 triệu -> ~410 nghìn tam giác, ~10 MB)
//   bỏ 4 trực thăng Apache nằm cách phòng ~4,8 km, phòng trống phía sau và đồ trang trí khuất sau tường tivi
// - camera: room-scenes.ts gắn model thẳng vào roomGroup (bỏ scale của wrapper) nên world thực = raw - [7.8, 0, -1.675]
const BLACK_MARBLE_ROOM = {
  id: 'room-11',
  name: 'Phòng Khách Đá Marble Đen & Bếp Óc Chó (Black Marble Living)',
  theme: 'Black Marble Luxe',
  tagline: 'Tường tivi đá marble đen vân trắng, vách lam gỗ, tượng điêu khắc và bàn ăn tròn mặt đá dưới đèn thả nhiều tầng',
  description: 'Phòng khách liền bếp dựng từ mô hình 3D thật: sofa chần nút trắng kê sát tường tranh chân dung đen trắng, thảm lông xám khói và bàn trà khối đen, tường tivi ốp đá marble đen vân trắng trên kệ thấp cùng chất liệu, vách lam gỗ óc chó chạy dài, tượng điêu khắc trắng dáng người ném đĩa, bàn ăn tròn mặt đá đen bốn ghế trắng dưới đèn thả xếp tầng, rèm voan trắng phối rèm vải xám tro và bếp chữ I gỗ óc chó. Chạm vào từng số để xem sản phẩm tương tự tại Luméa.',
  coverImage: 'assets/rooms/phong-khach-marble-den.jpg',
  roomType: 'glb_scene',
  modelUrl: 'assets/models/phong-khach-marble-den.glb',
  modelFocusBounds: { min: [3.3, 0, -4.45], max: [12.3, 3.1, 1.1] },
  cameraInitial: { x: 3.2, y: 1.75, z: -0.23, fov: 55, orbitAzimuth: 20, orbitPolar: [65, 88] },
  cameraLookAt: [0.3, 1.29, -0.82],
  walkthroughMode: false,
  freeExploreMode: false,
  hotspots: [
    { id: 'hs-mb-1', productId: 'cat-sofa-24', label: 'Sofa Chần Nút Trắng', position: [5.9, 0.65, -1.55], annotationNote: 'Đệm chần nút vải trắng, tay thấp vuông vức kèm gối tựa phối màu' },
    { id: 'hs-mb-2', productId: 'cat-side-table-07', label: 'Bàn Trà Khối Đen Nhám', position: [6.08, 0.38, -2.7], annotationNote: 'Khối đen nhám thấp đặt giữa thảm lông xám khói' },
    { id: 'hs-mb-3', productId: 'cat-cabinet-35', label: 'Kệ Thấp Đen Dưới Tường Đá', position: [7, 0.3, -4.2], annotationNote: 'Kệ thấp đen chạy dài dưới mảng tường marble đen vân trắng' },
    { id: 'hs-mb-4', productId: 'cat-sculpture-05', label: 'Tượng Dáng Người Trắng', position: [8, 1.3, -4.1], annotationNote: 'Tượng trắng dáng người ném đĩa — điểm nhấn nghệ thuật cạnh vách lam gỗ' },
    { id: 'hs-mb-5', productId: 'cat-table-06', label: 'Bàn Ăn Tròn Mặt Đá Đen', position: [9.5, 0.78, -3.5], annotationNote: 'Mặt tròn đá đen vân trắng trên chân côn đen' },
    { id: 'hs-mb-6', productId: 'cat-chair-06', label: 'Ghế Ăn Trắng', position: [9, 0.5, -3], annotationNote: 'Ghế ăn trắng lưng cong ôm người, chân mảnh' },
    { id: 'hs-mb-7', productId: 'cat-pendant-26', label: 'Đèn Thả Xếp Tầng Trắng', position: [9.47, 1.85, -3.52], annotationNote: 'Chụp trắng xếp nhiều tầng toả sáng dịu xuống bàn ăn' },
    { id: 'hs-mb-8', productId: 'cat-frame-18', label: 'Tranh Canvas Đen Trắng', position: [5.53, 1.6, -1.06], annotationNote: 'Tranh chân dung đen trắng điểm đỏ treo trên sofa' },
  ],
};

const MAX_SCENE_ROOMS = [NORDIC_ROOM, MARBLE_LIVING_ROOM, BLACK_MARBLE_ROOM];

module.exports = { NORDIC_ROOM, MARBLE_LIVING_ROOM, BLACK_MARBLE_ROOM, MAX_SCENE_ROOMS };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Room = require('../models/Room');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const room of MAX_SCENE_ROOMS) {
      await Room.findOneAndReplace({ id: room.id }, room, { upsert: true, runValidators: true });
      const saved = await Room.findOne({ id: room.id }).lean();
      console.log(room.id, '=', saved.name, '·', saved.hotspots.length, 'hotspot');
    }
    await mongoose.disconnect();
  })().catch(err => { console.error(err); process.exit(1); });
}
