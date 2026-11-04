// Bổ sung ẢNH THỨ 2 cho sản phẩm chỉ có 1 ảnh, để mọi thẻ sản phẩm có cùng hiệu ứng rê chuột (ảnh 1 -> ảnh 2).
//
// Ảnh 2 là ẢNH KHÔNG GIAN (phòng khách, phòng ngủ...) hợp với loại sản phẩm — KHÔNG dùng ảnh của sản phẩm
// khác (khách sẽ tưởng là món khác). Ảnh chọn cố định theo mã sản phẩm nên các thẻ cạnh nhau ít trùng.
// Khi nhóm có ảnh thật (góc chụp khác của chính món đó) thì thay vào images[1] của sản phẩm.
//
// Chạy: node seed/add-second-images.js   (chỉ đụng sản phẩm còn < 2 ảnh; chạy lại nhiều lần vẫn an toàn)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const url = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

// Ảnh nội thất đã có sẵn trên web (bìa tin tức, phòng mẫu, danh mục không gian...), lọc thủ công theo không gian.
const POOLS = {
  'phong-khach': [
    'photo-1493663284031-b7e3aefcae8e', 'photo-1502672260266-1c1ef2d93688', 'photo-1513694203232-719a280e022f',
    'photo-1524758631624-e2822e304c36', 'photo-1583847268964-b28dc8f51f92', 'photo-1586023492125-27b2c045efd7',
    'photo-1600121848594-d8644e57abab', 'photo-1615529182904-14819c35db37', 'photo-1616046229478-9901c5536a45',
    'photo-1616486338812-3dadae4b4ace', 'photo-1618220179428-22790b461013', 'photo-1505873242700-f289a29e1e0f',
    'photo-1567016376408-0226e4d0c1ea', 'photo-1505691938895-1758d7feb511', 'photo-1598928506311-c55ded91a20c',
    'photo-1600210492486-724fe5c67fb0', 'photo-1615874694520-474822394e73',
  ],
  'phong-ngu': [
    'photo-1505693416388-ac5ce068fe85', 'photo-1540518614846-7eded433c457', 'photo-1616594039964-ae9021a400a0',
    'photo-1522771739844-6a9f6d5f14af', 'photo-1617325247661-675ab4b64ae2', 'photo-1631049307264-da0ec9d70304',
    'photo-1595526114035-0d45ed16cfbf', 'photo-1615874959474-d609969a20ed', 'photo-1586105251261-72a756497a11',
    'photo-1617104678098-de229db51175', 'photo-1571508601891-ca5e7a713859', 'photo-1618773928121-c32242e63f39',
    'photo-1617098900591-3f90928e8c54', 'photo-1592229505726-ca121723b8ef',
  ],
  'phong-lam-viec': [
    'photo-1486946255434-2466348c2166', 'photo-1518455027359-f3f8164ba6bd', 'photo-1611269154421-4e27233ac5c7',
    'photo-1594026112284-02bb6f3352fe', 'photo-1594620302200-9a762244a156',
  ],
  'phong-hoc': [
    'photo-1594620302200-9a762244a156', 'photo-1486946255434-2466348c2166', 'photo-1611269154421-4e27233ac5c7',
    'photo-1518455027359-f3f8164ba6bd', 'photo-1513519245088-0e12902e5a38',
  ],
  'goc-chill': [
    'photo-1524758631624-e2822e304c36', 'photo-1567016376408-0226e4d0c1ea', 'photo-1615529182904-14819c35db37',
    'photo-1616046229478-9901c5536a45', 'photo-1618220179428-22790b461013', 'photo-1586023492125-27b2c045efd7',
    'photo-1583847268964-b28dc8f51f92', 'photo-1616593969747-4797dc75033e',
  ],
  'phong-an': [
    'photo-1544457070-4cd773b4d71e', 'photo-1577140917170-285929fb55b7', 'photo-1560185007-cde436f6a4d0',
    'photo-1617806118233-18e1de247200', 'photo-1604578762246-41134e37f9cc',
  ],
};

// Không gian mặc định theo loại sản phẩm — khớp DEFAULT_SPACES ở projects/my-client/.../catalog-taxonomy.ts
const DEFAULT_SPACES = {
  sofa: ['phong-khach'], bed: ['phong-ngu'], table: ['phong-khach'], side_table: ['phong-khach'],
  chair: ['phong-lam-viec'], stool: ['goc-chill'], cabinet: ['phong-ngu'], bookshelf: ['phong-hoc'],
  lamp: ['phong-ngu'], desk_lamp: ['phong-lam-viec'], night_lamp: ['phong-ngu'], pendant_lamp: ['phong-khach'],
  organizer: ['phong-lam-viec'], plant_pot: ['goc-chill'], vase: ['phong-khach'], sculpture: ['goc-chill'],
  clock: ['phong-lam-viec'], frame: ['phong-khach'], candle_holder: ['goc-chill'], tray: ['phong-khach'],
  bookend: ['phong-hoc'],
};

function hash(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function spaceFor(p) {
  if (/bàn ăn/i.test(p.name || '')) return 'phong-an';
  const s = (p.spaces && p.spaces[0]) || (DEFAULT_SPACES[p.category] || ['phong-khach'])[0];
  return POOLS[s] ? s : 'phong-khach';
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('products');
  const all = await col.find({}, { projection: { id: 1, name: 1, category: 1, spaces: 1, images: 1 } }).toArray();
  // Ảnh chính của mọi sản phẩm: không bao giờ dùng làm ảnh 2 (tránh hiện "món khác").
  const mainIds = new Set(all.map(p => ((p.images || [])[0] || '').match(/photo-[0-9]+-[0-9a-f]+/)?.[0]).filter(Boolean));
  let updated = 0;
  for (const p of all) {
    const images = p.images || [];
    if (images.length >= 2 || images.length === 0) continue;
    const pool = POOLS[spaceFor(p)].filter(id => !mainIds.has(id));
    if (!pool.length) continue;
    const second = url(pool[hash(p.id) % pool.length]);
    await col.updateOne({ _id: p._id }, { $set: { images: [images[0], second] } });
    updated++;
  }
  console.log(`Đã thêm ảnh 2 cho ${updated} sản phẩm.`);
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
