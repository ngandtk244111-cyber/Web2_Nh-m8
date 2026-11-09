// Nạp bộ sản phẩm mới (file JSON xuất từ nguồn ngoài, vd "products (7).json") vào collection Product.
// Chạy theo 2 bước, bước 1 không đụng tới DB:
//
//   1) Chuẩn hoá  : node seed/import-lumea-products.js normalize "<đường dẫn file JSON gốc>"
//                   -> seed/lumea-products/products.normalized.json + seed/lumea-products/report.md
//   2) Nạp vào DB : node seed/import-lumea-products.js import            (chạy thử, chỉ in báo cáo)
//                   node seed/import-lumea-products.js import --apply    (backup -> xoá SP cũ thường -> thêm SP mới)
//
// Bước import GIỮ NGUYÊN sản phẩm cũ có 3D (modelUrl / threeModelType) và sản phẩm đang được gắn
// hotspot trong phòng 3D (Room.hotspots[].productId); mọi sản phẩm cũ khác bị xoá (đã backup ra file).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'lumea-products');
const OUT_FILE = path.join(OUT_DIR, 'products.normalized.json');
const REPORT_FILE = path.join(OUT_DIR, 'report.md');

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

// Số ngẫu nhiên cố định theo id sản phẩm: chạy lại bao nhiêu lần cũng ra cùng kết quả.
function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const between = (r, min, max, step = 1) => Math.round((min + r() * (max - min)) / step) * step;
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Giá kiểu cửa hàng: >= 1 triệu -> x.x90.000, dưới 1 triệu -> xx9.000.
function storePrice(v) {
  if (v >= 1_000_000) return Math.round(v / 100_000) * 100_000 - 10_000;
  return Math.max(9_000, Math.round(v / 10_000) * 10_000 - 1_000);
}

// ---------------------------------------------------------------------------
// Phân loại: tên sản phẩm -> ProductCategory (khớp product.model.ts / catalog-taxonomy.ts)
// ---------------------------------------------------------------------------

// Món không khớp được quy tắc nào -> bỏ qua (ghi vào report).
const SKIP_RULES = [];

// Đồ dùng gia đình (category 'household') -> loại con, dùng để sinh giá / kích thước / chất liệu.
const HOUSEHOLD_RULES = [
  [/\brugs?\b/, 'rug'],
  [/mattress protector|protector/, 'protector'],
  [/mattress/, 'mattress'],
  [/pillow insert|throw pillow|cushion/, 'pillow'],
  [/pillowcase|sheet|duvet|quilt|blanket|bedding|comforter/, 'bedding'],
  [/glasses|tumbler/, 'glasses'],
  [/cutlery|flatware/, 'cutlery'],
  [/dinnerware|bowl|plate|mug/, 'dinnerware'],
  // "Couch Cover" / "Chair Cover" là áo trùm rời; "Slipcover Loveseat" là sofa có vỏ tháo rời -> không thuộc đây.
  [/armrest|\bcover\b/, 'cover'],
  [/bar cart/, 'cart'],
];

// Thứ tự quan trọng: gương / đồ gia dụng trước (vd "Sleeper Sheet Set" không phải sofa),
// sofa trước bed (sofa bed), side table trước table, lamp trước table (table lamp)...
const CATEGORY_RULES = [
  [/mirror/, 'mirror'],
  ...HOUSEHOLD_RULES.map(([re]) => [re, 'household']),
  [/dining set|bistro set/, 'table'],
  [/bedroom set/, 'bed'],
  [/tv stand|tv console/, 'cabinet'],
  [/coffee table|dining table|console table/, 'table'],
  [/chandelier|pendant|ceiling|floor lamp/, 'pendant_lamp'],
  [/table lamp|desk lamp/, 'desk_lamp'],
  [/night ?light|bedside lamp|night lamp/, 'night_lamp'],
  [/\blamp\b/, 'pendant_lamp'],
  [/candle/, 'candle_holder'],
  [/vase/, 'vase'],
  [/planter|plant pot|\bpot\b/, 'plant_pot'],
  [/clock/, 'clock'],
  [/\bframe\b(?! bed)/, 'frame'],
  [/\btray\b/, 'tray'],
  [/bookend/, 'bookend'],
  [/sofa|couch|sectional|loveseat|chaise|sleeper|daybed/, 'sofa'],
  [/nightstand|bedside|side table|end table|accent table|c-table/, 'side_table'],
  [/\bbed\b|headboard|bed frame/, 'bed'],
  [/ottoman|stool|pouf|bench|banquette/, 'stool'],
  [/chair|recliner|rocker/, 'chair'],
  [/sideboard|cabinet|dresser|hutch|wardrobe|chest|tv stand|tv console|media|credenza|storage combination|storage console|drawer/, 'cabinet'],
  [/bookshelf|bookcase|shel(f|ves|ving)/, 'bookshelf'],
  [/table|desk|console/, 'table'],
];

const CATEGORY_INFO = {
  sofa:          { group: 'FURNITURE', name: 'Sofa' },
  bed:           { group: 'FURNITURE', name: 'Giường' },
  table:         { group: 'FURNITURE', name: 'Bàn' },
  side_table:    { group: 'FURNITURE', name: 'Bàn Phụ & Side Table' },
  chair:         { group: 'FURNITURE', name: 'Ghế' },
  stool:         { group: 'FURNITURE', name: 'Ghế Đôn & Ghế Phụ' },
  cabinet:       { group: 'FURNITURE', name: 'Tủ' },
  bookshelf:     { group: 'FURNITURE', name: 'Kệ Sách & Kệ Treo Tường' },
  desk_lamp:     { group: 'FURNITURE', name: 'Đèn Bàn' },
  night_lamp:    { group: 'FURNITURE', name: 'Đèn Ngủ' },
  pendant_lamp:  { group: 'FURNITURE', name: 'Đèn Trang Trí' },
  organizer:     { group: 'FURNITURE', name: 'Khay Bàn & Hộp Đựng' },
  vase:          { group: 'DECOR', name: 'Bình Hoa & Lọ Decor' },
  plant_pot:     { group: 'DECOR', name: 'Chậu Cây Mini & Cây Decor' },
  candle_holder: { group: 'DECOR', name: 'Đế Nến Decor' },
  clock:         { group: 'DECOR', name: 'Đồng Hồ Để Bàn' },
  frame:         { group: 'DECOR', name: 'Khung Tranh & Khung Ảnh' },
  tray:          { group: 'DECOR', name: 'Khay Trang Trí & Decor Bàn' },
  bookend:       { group: 'DECOR', name: 'Giá Đỡ & Bookend' },
  sculpture:     { group: 'DECOR', name: 'Tượng Trang Trí & Abstract' },
  mirror:        { group: 'DECOR', name: 'Gương Trang Trí' },
  household:     { group: 'DECOR', name: 'Đồ Dùng Gia Đình' },
};

// Hàng thành phẩm nhập về, không in 3D.
const ALWAYS_READY_STOCK = new Set(['mirror', 'household']);

// Đồ nội thất lớn luôn là hàng có sẵn (giống dữ liệu cũ); chỉ đồ nhỏ mới có thể in 3D theo yêu cầu.
const LARGE_FURNITURE = new Set(['sofa', 'bed', 'table', 'side_table', 'chair', 'stool', 'cabinet', 'bookshelf']);

function classify(name) {
  // "Dalton Storage Bed With Harper Side Table Set" -> phân loại theo phần trước "with".
  // "Lounge Chair & Ottoman Set" -> theo món đứng trước "&".
  const n = name.toLowerCase().split(/\s+(with|w\/|\+|&)\s+/)[0];
  for (const [re, reason] of SKIP_RULES) if (re.test(n)) return { skip: reason };
  for (const [re, cat] of CATEGORY_RULES) if (re.test(n)) return { category: cat };
  return { skip: 'không nhận diện được loại' };
}

// Phân nhóm nhỏ để sinh kích thước / giá hợp lý trong cùng 1 category.
function variantOf(category, n) {
  if (category === 'household') return (HOUSEHOLD_RULES.find(([re]) => re.test(n)) || [])[1] || 'default';
  if (category === 'mirror') return /floor|oversized/.test(n) ? 'floor' : 'wall';
  if (category === 'sofa') {
    if (/sectional|l-shape|u-shape|modular|corner/.test(n)) return 'sectional';
    if (/chaise/.test(n)) return 'chaise';
    if (/loveseat|2 seater|2-seater/.test(n)) return 'loveseat';
    return 'sofa';
  }
  if (category === 'table') {
    if (/dining/.test(n)) return 'dining';
    if (/coffee|nesting/.test(n)) return 'coffee';
    if (/desk/.test(n)) return 'desk';
    if (/console/.test(n)) return 'console';
    return 'dining';
  }
  if (category === 'chair') {
    if (/dining|office/.test(n)) return 'dining';
    if (/armchair|lounge|accent|recliner|rocker|swivel/.test(n)) return 'armchair';
    if (/bar|counter/.test(n)) return 'bar';
    return 'dining';
  }
  if (category === 'stool') {
    if (/banquette|bench/.test(n)) return 'bench';
    if (/ottoman|pouf/.test(n)) return 'ottoman';
    return 'stool';
  }
  if (category === 'cabinet') {
    if (/sideboard|credenza/.test(n)) return 'sideboard';
    if (/tv|media/.test(n)) return 'tv';
    if (/dresser|drawer|chest/.test(n)) return 'dresser';
    return 'tall';
  }
  if (category === 'side_table') return /nightstand|bedside/.test(n) ? 'nightstand' : 'side';
  if (category === 'pendant_lamp') return /floor/.test(n) ? 'floor' : 'pendant';
  return 'default';
}

// [giá min, giá max] VND theo category/variant — bám theo mặt bằng giá dữ liệu cũ của Luméa.
const PRICE_RANGES = {
  'sofa:sectional': [16e6, 32e6], 'sofa:chaise': [12e6, 24e6], 'sofa:loveseat': [8e6, 15e6], 'sofa:sofa': [9.5e6, 21e6],
  'bed:default': [8e6, 22e6],
  'table:dining': [5.5e6, 16e6], 'table:coffee': [2.4e6, 7.5e6], 'table:desk': [3.2e6, 9e6], 'table:console': [3e6, 8e6],
  'side_table:nightstand': [1.6e6, 4.8e6], 'side_table:side': [0.9e6, 3.6e6],
  'chair:armchair': [4.5e6, 12e6], 'chair:bar': [1.8e6, 4.2e6], 'chair:dining': [1.4e6, 4.5e6],
  'stool:bench': [3.5e6, 11e6], 'stool:ottoman': [1.5e6, 6.5e6], 'stool:stool': [0.6e6, 2.4e6],
  'cabinet:sideboard': [7e6, 18e6], 'cabinet:tv': [5.5e6, 14e6], 'cabinet:dresser': [6e6, 15e6], 'cabinet:tall': [6.5e6, 16e6],
  'bookshelf:default': [2.8e6, 9.5e6],
  'desk_lamp:default': [0.45e6, 2.2e6], 'night_lamp:default': [0.3e6, 0.95e6],
  'pendant_lamp:pendant': [1.6e6, 7.5e6], 'pendant_lamp:floor': [1.8e6, 5.5e6],
  'vase:default': [0.18e6, 1.2e6], 'plant_pot:default': [0.09e6, 0.45e6], 'candle_holder:default': [0.12e6, 0.55e6],
  'clock:default': [0.25e6, 1.1e6], 'frame:default': [0.15e6, 0.6e6], 'tray:default': [0.12e6, 0.6e6],
  'bookend:default': [0.15e6, 0.5e6], 'organizer:default': [0.18e6, 0.9e6],
  'mirror:wall': [1.2e6, 4.5e6], 'mirror:floor': [2.5e6, 7.5e6],
  'household:rug': [2.2e6, 9.5e6], 'household:mattress': [7e6, 18e6], 'household:protector': [0.6e6, 1.5e6],
  'household:pillow': [0.25e6, 0.9e6], 'household:bedding': [0.9e6, 3.8e6],
  'household:glasses': [0.25e6, 0.6e6], 'household:cutlery': [0.6e6, 1.9e6], 'household:dinnerware': [0.18e6, 0.5e6],
  'household:cover': [0.7e6, 3.2e6], 'household:cart': [3.5e6, 7.5e6], 'household:default': [0.3e6, 2e6],
};

// SP dạng bộ (bàn kèm ghế, giường kèm nệm, "Set Of 2", "2 Pairs"...) đắt hơn 1 món lẻ.
function bundleFactor(n) {
  const setOf = n.match(/set of (\d+)/);
  if (setOf) return Number(setOf[1]);
  const pairs = n.match(/(\d+) pairs/);
  if (pairs) return Number(pairs[1]) * 2;
  if (/dining set|bedroom set|\bwith\b|\bset\b|&/.test(n)) return 1.5;
  return 1;
}

// Kích thước (cm) theo category/variant, cùng định dạng chuỗi với dữ liệu cũ.
function dimensionsFor(r, category, variant) {
  const d = (a, b) => between(r, a, b, 5);
  switch (`${category}:${variant}`) {
    case 'sofa:sectional': return `Dài ${d(260, 330)}cm x Sâu ${d(160, 220)}cm x Cao ${d(75, 90)}cm`;
    case 'sofa:chaise': return `Dài ${d(220, 280)}cm x Sâu ${d(140, 165)}cm x Cao ${d(75, 88)}cm`;
    case 'sofa:loveseat': return `Dài ${d(150, 175)}cm x Sâu ${d(85, 95)}cm x Cao ${d(75, 88)}cm`;
    case 'sofa:sofa': return `Dài ${d(190, 240)}cm x Sâu ${d(88, 100)}cm x Cao ${d(75, 90)}cm`;
    case 'bed:default': {
      const w = pick(r, [120, 140, 160, 180]);
      return `Dài ${d(205, 215)}cm x Rộng ${w + 12}cm x Cao đầu giường ${d(90, 125)}cm (nệm ${w / 100}m x 2m)`;
    }
    case 'table:dining': return `Dài ${d(140, 220)}cm x Rộng ${d(80, 100)}cm x Cao 75cm`;
    case 'table:coffee': return `Dài ${d(90, 130)}cm x Rộng ${d(50, 75)}cm x Cao ${d(35, 45)}cm`;
    case 'table:desk': return `Rộng ${d(110, 160)}cm x Sâu ${d(55, 70)}cm x Cao 75cm`;
    case 'table:console': return `Rộng ${d(100, 150)}cm x Sâu ${d(35, 45)}cm x Cao ${d(75, 85)}cm`;
    case 'side_table:nightstand': return `Rộng ${d(40, 60)}cm x Sâu ${d(35, 45)}cm x Cao ${d(50, 60)}cm`;
    case 'side_table:side': return `Đường kính ${d(40, 55)}cm x Cao ${d(45, 60)}cm`;
    case 'chair:armchair': return `Rộng ${d(70, 90)}cm x Sâu ${d(75, 95)}cm x Cao ${d(75, 95)}cm`;
    case 'chair:bar': return `Rộng ${d(42, 50)}cm x Sâu ${d(45, 52)}cm x Cao ${d(90, 105)}cm`;
    case 'chair:dining': return `Rộng ${d(45, 58)}cm x Sâu ${d(50, 60)}cm x Cao ${d(78, 90)}cm`;
    case 'stool:bench': return `Dài ${d(120, 200)}cm x Sâu ${d(40, 60)}cm x Cao ${d(42, 48)}cm`;
    case 'stool:ottoman': return `Rộng ${d(60, 110)}cm x Sâu ${d(50, 80)}cm x Cao ${d(40, 46)}cm`;
    case 'stool:stool': return `Đường kính ${d(35, 45)}cm x Cao ${d(42, 75)}cm`;
    case 'cabinet:sideboard': return `Rộng ${d(140, 200)}cm x Sâu ${d(40, 50)}cm x Cao ${d(70, 85)}cm`;
    case 'cabinet:tv': return `Rộng ${d(150, 220)}cm x Sâu ${d(40, 45)}cm x Cao ${d(45, 55)}cm`;
    case 'cabinet:dresser': return `Rộng ${d(80, 160)}cm x Sâu ${d(45, 50)}cm x Cao ${d(80, 120)}cm`;
    case 'cabinet:tall': return `Rộng ${d(80, 110)}cm x Sâu ${d(40, 50)}cm x Cao ${d(160, 200)}cm`;
    case 'bookshelf:default': return `Rộng ${d(70, 100)}cm x Sâu ${d(30, 40)}cm x Cao ${d(150, 200)}cm`;
    case 'desk_lamp:default': return `Đường kính chao ${d(20, 35)}cm x Cao ${d(40, 60)}cm`;
    case 'night_lamp:default': return `Đường kính ${d(15, 25)}cm x Cao ${d(20, 35)}cm`;
    case 'pendant_lamp:floor': return `Đường kính đế ${d(25, 35)}cm x Cao ${d(150, 175)}cm`;
    case 'pendant_lamp:pendant': return `Đường kính ${d(45, 90)}cm x Cao ${d(35, 70)}cm (dây điều chỉnh 1.5m)`;
    case 'vase:default': return `Cao ${d(20, 45)}cm x Đường kính ${d(10, 25)}cm`;
    case 'plant_pot:default': return `Cao ${d(10, 20)}cm x Đường kính ${d(8, 18)}cm`;
    case 'candle_holder:default': return `Đường kính ${between(r, 7, 10)}cm x Cao ${between(r, 8, 12)}cm`;
    case 'mirror:wall': return `Rộng ${d(50, 90)}cm x Cao ${d(70, 120)}cm x Dày 3cm`;
    case 'mirror:floor': return `Rộng ${d(50, 90)}cm x Cao ${d(160, 190)}cm x Dày 4cm`;
    case 'household:rug': return pick(r, ['160 x 230 cm', '200 x 290 cm', '240 x 340 cm']);
    case 'household:mattress': return `Nệm ${pick(r, ['1m4', '1m6', '1m8'])} x 2m, dày ${d(20, 30)}cm`;
    case 'household:protector':
    case 'household:bedding': return `Cho nệm ${pick(r, ['1m4', '1m6', '1m8'])} x 2m`;
    case 'household:pillow': return pick(r, ['45 x 45 cm', '50 x 50 cm', '50 x 70 cm']);
    case 'household:glasses': return `Bộ 4 ly, dung tích ${pick(r, [350, 400, 450])}ml`;
    case 'household:cutlery': return pick(r, ['Bộ 16 món cho 4 người', 'Bộ 24 món cho 6 người']);
    case 'household:dinnerware': return 'Bộ 4 món: đĩa lớn, đĩa nhỏ, bát, cốc';
    case 'household:cover': return 'Theo kích thước sản phẩm đi kèm';
    case 'household:cart': return `Rộng ${d(70, 90)}cm x Sâu ${d(40, 50)}cm x Cao ${d(80, 90)}cm`;
    default: return `${d(15, 40)} x ${d(10, 30)} x ${d(5, 25)} cm`;
  }
}

// [kg min, kg max]
const WEIGHT_RANGES = {
  sofa: [35, 95], bed: [45, 90], table: [15, 55], side_table: [4, 14], chair: [5, 22], stool: [3, 25],
  cabinet: [30, 85], bookshelf: [18, 45], desk_lamp: [1, 3.5], night_lamp: [0.4, 1.2], pendant_lamp: [2, 9],
  vase: [0.3, 2.5], plant_pot: [0.2, 1.2], candle_holder: [0.2, 0.8], clock: [0.3, 1.2], frame: [0.3, 1],
  tray: [0.2, 0.9], bookend: [0.3, 1], organizer: [0.2, 1],
  'mirror:wall': [4, 12], 'mirror:floor': [12, 25],
  'household:rug': [6, 18], 'household:mattress': [25, 45], 'household:protector': [0.8, 1.5],
  'household:pillow': [0.4, 1], 'household:bedding': [1, 3], 'household:glasses': [0.8, 1.6],
  'household:cutlery': [1, 2], 'household:dinnerware': [1.5, 3], 'household:cover': [1, 4], 'household:cart': [8, 15],
};
function weightFor(r, category, variant) {
  const [a, b] = WEIGHT_RANGES[`${category}:${variant}`] || WEIGHT_RANGES[category] || [1, 5];
  const kg = a + r() * (b - a);
  return kg < 1 ? `${Math.round(kg * 100) * 10}g` : `${Math.round(kg * 10) / 10}kg`;
}

const SIZE_CATEGORY = {
  sofa: 'Lớn', bed: 'Lớn', table: 'Lớn', cabinet: 'Lớn', bookshelf: 'Lớn', pendant_lamp: 'Lớn',
  chair: 'Trung bình', side_table: 'Trung bình', stool: 'Trung bình', desk_lamp: 'Trung bình',
  night_lamp: 'Nhỏ', vase: 'Nhỏ', clock: 'Nhỏ', frame: 'Nhỏ', tray: 'Nhỏ', bookend: 'Nhỏ', organizer: 'Nhỏ',
  plant_pot: 'Mini', candle_holder: 'Mini',
  mirror: 'Trung bình', household: 'Nhỏ',
};
const SIZE_BY_VARIANT = { 'mirror:floor': 'Lớn', 'household:rug': 'Lớn', 'household:mattress': 'Lớn', 'household:cart': 'Trung bình' };

// Đồ dùng gia đình / gương: chất liệu, tính năng, không gian theo loại con (chứa từ khoá của MATERIAL_GROUPS).
const VARIANT_MATERIAL = {
  'mirror:wall': 'Mặt kính tráng bạc chống ố, khung kim loại sơn tĩnh điện',
  'mirror:floor': 'Mặt kính tráng bạc chống ố, khung gỗ sồi tự nhiên',
  'household:rug': 'Sợi len pha vải polyester dệt dày, đế chống trượt',
  'household:mattress': 'Lò xo túi độc lập, mút foam hoạt tính, vỏ vải bọc cotton',
  'household:protector': 'Vải lyocell chống thấm, bo chun 4 góc',
  'household:pillow': 'Vỏ vải cotton, ruột bông polyester tơi xốp',
  'household:bedding': 'Vải cotton sateen / lyocell mềm mát',
  'household:glasses': 'Thủy tinh không chì trong suốt',
  'household:cutlery': 'Thép không gỉ 18/10 đánh bóng',
  'household:dinnerware': 'Gốm sứ tráng men, dùng được lò vi sóng',
  'household:cover': 'Vải bọc chống thấm, chống tia UV',
  'household:cart': 'Khung kim loại sơn tĩnh điện, khay gỗ teak',
};
const VARIANT_FEATURES = {
  'mirror:wall': ['Mặt kính tráng bạc chống ố, hình ảnh rõ nét', 'Móc treo chắc chắn đi kèm', 'Giúp không gian sáng và rộng hơn'],
  'mirror:floor': ['Mặt kính tráng bạc chống ố, soi toàn thân', 'Có thể dựng tường hoặc treo', 'Chân đế chống trượt, chống lật'],
  'household:rug': ['Sợi dệt dày, êm chân', 'Đế chống trượt, an toàn trên sàn gỗ', 'Dễ vệ sinh bằng máy hút bụi'],
  'household:mattress': ['Nâng đỡ cột sống, hạn chế truyền chuyển động', 'Vỏ nệm thoáng khí, kháng khuẩn', 'Bảo hành lún xẹp 10 năm'],
  'household:protector': ['Chống thấm, bảo vệ nệm khỏi vết bẩn', 'Bo chun 4 góc, không xô lệch', 'Giặt máy được'],
  'household:pillow': ['Ruột gối tơi xốp, giữ form tốt', 'Vỏ tháo rời, giặt máy được'],
  'household:bedding': ['Vải mềm mát, thoáng khí', 'Ít nhăn, giữ màu sau nhiều lần giặt', 'Giặt máy được'],
  'household:glasses': ['Thủy tinh trong, không chì', 'Dùng được máy rửa bát'],
  'household:cutlery': ['Thép không gỉ 18/10, không han gỉ', 'Dùng được máy rửa bát'],
  'household:dinnerware': ['Dùng được lò vi sóng và máy rửa bát', 'Men bóng an toàn thực phẩm'],
  'household:cover': ['Chống thấm nước, chống tia UV', 'Bảo vệ đồ nội thất ngoài trời khỏi bụi bẩn'],
  'household:cart': ['Bánh xe xoay 360°, có khoá', 'Hai tầng khay rộng để ly và chai'],
};
const VARIANT_SPACES = {
  'household:rug': ['phong-khach', 'phong-ngu', 'goc-chill'],
  'household:mattress': ['phong-ngu'], 'household:protector': ['phong-ngu'], 'household:bedding': ['phong-ngu'],
  'household:pillow': ['phong-khach', 'phong-ngu', 'goc-chill'],
  'household:glasses': ['phong-khach'], 'household:cutlery': ['phong-khach'], 'household:dinnerware': ['phong-khach'],
  'household:cover': ['phong-khach', 'goc-chill'], 'household:cart': ['phong-khach', 'goc-chill'],
};

// Chất liệu: ưu tiên từ khoá trong tên (khớp MATERIAL_GROUPS của catalog-taxonomy.ts), rồi mặc định theo loại.
const MATERIAL_BY_NAME = [
  [/leather/, 'Da thật bọc ngoài, khung gỗ thông sấy, đệm mút D40'],
  [/bouclé|boucle/, 'Vải bouclé dày dặn, khung gỗ thông sấy, đệm mút D40'],
  [/velvet/, 'Vải nhung chống bám bụi, khung gỗ thông sấy'],
  [/performance/, 'Vải performance chống bám bẩn, khung gỗ thông sấy, đệm mút D40'],
  [/linen/, 'Vải linen pha cotton, khung gỗ thông sấy'],
  [/marble|travertine/, 'Mặt đá cẩm thạch tự nhiên, chân kim loại sơn tĩnh điện'],
  [/glass/, 'Kính cường lực, khung kim loại sơn tĩnh điện'],
  [/rattan|cane|wicker/, 'Mây đan thủ công trên khung gỗ tần bì'],
  [/walnut/, 'Gỗ óc chó phủ dầu lau gốc thực vật'],
  [/oak/, 'Gỗ sồi tự nhiên phủ dầu lau chống thấm'],
  [/acacia|teak|mango|wood/, 'Gỗ tự nhiên nguyên khối, hoàn thiện phủ dầu lau'],
  [/ceramic|stoneware|porcelain/, 'Gốm sứ tráng men mờ'],
  [/brass|metal|steel|iron|aluminium|aluminum/, 'Kim loại sơn tĩnh điện, chi tiết đồng thau'],
  [/concrete|cement/, 'Xi măng đúc mịn phủ chống thấm'],
];
const MATERIAL_DEFAULT = {
  sofa: 'Vải bọc cao cấp, khung gỗ thông sấy, đệm mút D40',
  bed: 'Khung gỗ cao su, đầu giường bọc vải linen',
  table: 'Gỗ MDF chống ẩm phủ veneer gỗ sồi',
  side_table: 'Gỗ sồi tự nhiên phủ dầu lau',
  chair: 'Khung gỗ tần bì, nệm mút bọc vải',
  stool: 'Khung gỗ, nệm mút D40 bọc vải',
  cabinet: 'Gỗ MDF chống ẩm phủ veneer gỗ sồi, bản lề giảm chấn',
  bookshelf: 'Gỗ sồi tự nhiên kết hợp khung thép sơn tĩnh điện',
  desk_lamp: 'Kim loại sơn tĩnh điện, chao vải',
  night_lamp: 'Kim loại sơn tĩnh điện, chao vải',
  pendant_lamp: 'Kim loại sơn tĩnh điện, chi tiết đồng thau',
  vase: 'Gốm sứ tráng men mờ',
  plant_pot: 'Gốm sứ tráng men mờ',
  candle_holder: 'Hợp kim đồng thau phủ bóng',
};
const PRINT_MATERIAL_TEXT = {
  PLA: 'Nhựa sinh học PLA hoàn thiện mờ',
  PETG: 'Nhựa PETG chịu nhiệt, chống nước',
  Resin: 'Resin chất lượng cao, sơn phủ mờ',
};

// Màu: lấy từ tên nếu có, không thì giữ màu của file gốc (vẫn là giá trị hợp lệ).
const COLOR_BY_NAME = [
  [/\b(white|ivory|snow|chalk|alabaster)\b/, 'Trắng'],
  [/\b(black|charcoal|ebony|onyx)\b/, 'Đen'],
  [/\b(grey|gray|stone|fog|pewter|slate|silver)\b/, 'Xám'],
  [/\b(beige|cream|oat|sand|natural|caramel|tan|taupe|camel|latte|linen|oak)\b/, 'Be'],
  [/\b(green|olive|sage|blue|navy|teal|moss|forest)\b/, 'Xanh'],
  [/\b(pink|blush|rose|terracotta)\b/, 'Hồng'],
];
const COLOR_HEX = {
  'Trắng': '#F2EFE9', 'Đen': '#2B2B2B', 'Xám': '#8E8E8E', 'Be': '#D8C7A8',
  'Pastel': '#E8D5E0', 'Xanh': '#6E8B74', 'Hồng': '#D9A5A0',
};

const FEATURES = {
  sofa: ['Đệm ngồi mút D40 đàn hồi tốt, không xẹp lún sau thời gian dài', 'Khung gỗ thông sấy chống cong vênh, mối nối chắc chắn', 'Vỏ bọc có thể tháo rời để vệ sinh', 'Chân cao thoáng, dễ lau dọn gầm'],
  bed: ['Khung giường chắc chắn, không phát tiếng kêu khi trở mình', 'Phản gỗ thông thoáng giúp nệm luôn khô ráo', 'Đầu giường bọc nệm êm, tựa lưng đọc sách thoải mái', 'Lắp ráp nhanh, có hướng dẫn chi tiết'],
  table: ['Mặt bàn phủ chống thấm, chống trầy xước khi dùng hằng ngày', 'Chân bàn chắc chắn, có núm cao su chống trượt', 'Bo cạnh mềm mại, an toàn cho gia đình có trẻ nhỏ', 'Dễ lắp đặt, phối hợp được nhiều phong cách'],
  side_table: ['Kích thước gọn, vừa cạnh sofa hoặc đầu giường', 'Mặt bàn phủ chống thấm, dễ lau chùi', 'Kết cấu vững, không rung lắc'],
  chair: ['Tựa lưng ôm theo dáng người, ngồi lâu không mỏi', 'Nệm ngồi mút D40 bọc vải dễ vệ sinh', 'Chân có núm chống trầy sàn'],
  stool: ['Nệm ngồi êm, dùng làm ghế phụ hoặc gác chân', 'Gọn nhẹ, dễ di chuyển giữa các phòng', 'Chân có núm chống trầy sàn'],
  cabinet: ['Bản lề và ray trượt giảm chấn, đóng mở êm', 'Ngăn chứa rộng, chia khoang hợp lý', 'Gỗ chống ẩm, phù hợp khí hậu nhiệt đới', 'Có chốt chống lật gắn tường đi kèm'],
  bookshelf: ['Đợt kệ chịu lực tốt, không võng khi để sách nặng', 'Có phụ kiện cố định vào tường', 'Thiết kế mở, dễ trưng bày đồ decor'],
  desk_lamp: ['Ánh sáng vàng ấm dịu mắt', 'Công tắc tiện lợi trên dây', 'Tương thích bóng đèn LED E27'],
  night_lamp: ['Ánh sáng dịu nhẹ, không chói khi ngủ', 'Tiết kiệm điện với bóng LED', 'Kích thước gọn cho tủ đầu giường'],
  pendant_lamp: ['Dây treo điều chỉnh được độ cao', 'Tương thích bóng đèn LED E27', 'Ánh sáng lan toả đều, tạo điểm nhấn cho không gian'],
  vase: ['Phù hợp cắm hoa tươi lẫn hoa khô', 'Đáy chống trượt, đặt chắc trên mặt bàn', 'Dễ phối cùng nhiều phong cách nội thất'],
  plant_pot: ['Có lỗ thoát nước kèm đĩa lót', 'Kích thước nhỏ gọn cho bàn làm việc, bậu cửa sổ'],
  candle_holder: ['Tạo ánh sáng ấm cúng cho không gian', 'Đế chắc chắn, an toàn khi sử dụng'],
};
const PRINT_FEATURES = ['In 3D theo đơn, có thể đổi màu theo yêu cầu', 'Nhựa sinh học an toàn, thân thiện môi trường', 'Hoàn thiện bề mặt mịn, đã xử lý vết lớp in'];

// "customization" trong file gốc là mảng chữ -> dựng CustomizationConfig (product.model.ts).
const ACCESSORIES = {
  sofa: [{ id: 'acc-pillow', name: 'Bộ 2 gối tựa cùng màu', priceDelta: 390000 }, { id: 'acc-legs', name: 'Chân gỗ sồi thay thế', priceDelta: 290000 }],
  bed: [{ id: 'acc-slat', name: 'Phản gỗ thông gia cố', priceDelta: 490000 }, { id: 'acc-led', name: 'Đèn LED đầu giường', priceDelta: 350000 }],
  cabinet: [{ id: 'acc-handle', name: 'Tay nắm đồng thau', priceDelta: 190000 }, { id: 'acc-divider', name: 'Bộ vách chia ngăn', priceDelta: 150000 }],
  default: [{ id: 'acc-felt', name: 'Miếng lót nỉ chống trầy', priceDelta: 49000 }, { id: 'acc-gift', name: 'Hộp quà & thiệp viết tay', priceDelta: 59000 }],
};
const FINISHES = {
  wood: [{ id: 'oil', label: 'Dầu lau mờ', priceDelta: 0 }, { id: 'lacquer', label: 'Phủ PU bóng nhẹ', priceDelta: 190000 }],
  print: [{ id: 'matte', label: 'Mờ', priceDelta: 0 }, { id: 'satin', label: 'Bóng nhẹ (satin)', priceDelta: 30000 }],
};

function buildCustomization(raw, ctx) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const opts = new Set(raw);
  const cfg = { colors: [], materials: [], sizes: [], finishes: [], textOption: { enabled: false, maxChars: 0, priceDelta: 0 }, accessories: [] };
  if (opts.has('Đổi màu')) {
    const order = [ctx.color, ...Object.keys(COLOR_HEX).filter(c => c !== ctx.color && c !== 'Pastel')];
    cfg.colors = order.slice(0, 4).map((c, i) => ({ name: c, hex: COLOR_HEX[c], priceDelta: i === 0 ? 0 : (ctx.large ? 300000 : 20000) }));
  }
  if (opts.has('Thêm chữ/tên')) {
    cfg.textOption = { enabled: true, maxChars: ctx.large ? 20 : 15, priceDelta: ctx.large ? 150000 : 30000 };
  }
  if (opts.has('Thêm phụ kiện')) {
    cfg.accessories = (ACCESSORIES[ctx.category] || ACCESSORIES.default).map(a => ({ ...a }));
  }
  if (opts.has('Thiết kế theo yêu cầu')) {
    cfg.sizes = [
      { id: 'std', label: 'Tiêu chuẩn', scale: 1, priceMultiplier: 1, dimensions: ctx.dimensions },
      { id: 'plus', label: 'Lớn hơn 15%', scale: 1.15, priceMultiplier: 1.15, dimensions: 'Tăng 15% mỗi chiều' },
    ];
    cfg.finishes = (ctx.print ? FINISHES.print : FINISHES.wood).map(f => ({ ...f }));
  }
  const empty = !cfg.colors.length && !cfg.sizes.length && !cfg.accessories.length && !cfg.textOption.enabled;
  return empty ? null : cfg;
}

// Ảnh: bỏ thumbnail video, ảnh swatch siêu nhỏ (w_16), và ảnh trùng (cùng 1 ảnh ở 2 định dạng png/jpg).
function cleanImages(images) {
  const seen = new Set();
  const out = [];
  for (const url of images || []) {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue;
    if (/\/video\//.test(url) || /[,/]w_(1[0-9]|[1-9])[,/]/.test(url)) continue;
    const key = url.split('/').pop().replace(/\.(png|jpe?g|webp)$/i, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out.slice(0, 6);
}

// Tên tiếng Việt: xem seed/lumea-products/name-vi.js
const { translateName, buildCollections } = require('./lumea-products/name-vi');
// Dòng SP gốc -> bộ sưu tập Luméa, dựng 1 lần ở đầu bước normalize.
let COLLECTIONS = new Map();

// ---------------------------------------------------------------------------
// Bước 1: chuẩn hoá
// ---------------------------------------------------------------------------

function normalizeOne(src) {
  const name = decodeEntities(src.name);
  const cls = classify(name);
  if (cls.skip) return { skipped: { id: src.id, name, reason: cls.skip, from: src.category } };

  const category = cls.category;
  const info = CATEGORY_INFO[category];
  const lower = name.toLowerCase();
  const variant = variantOf(category, lower);
  const r = rng(src.id);

  const images = cleanImages(src.images);
  if (images.length === 0) return { skipped: { id: src.id, name, reason: 'không còn ảnh hợp lệ', from: src.category } };

  const large = LARGE_FURNITURE.has(category);
  // Đồ lớn luôn là hàng có sẵn; đồ nhỏ giữ ý "in 3D / làm theo yêu cầu" của file gốc.
  const productionType = !large && !ALWAYS_READY_STOCK.has(category)
    && (src.productionType === 'PRINT_3D' || src.productionType === 'CUSTOM_MADE')
    ? 'PRINT_ON_DEMAND' : 'READY_STOCK';
  const print = productionType === 'PRINT_ON_DEMAND';
  const printMaterial = print ? (category === 'sculpture' ? 'Resin' : pick(r, ['PLA', 'PLA', 'PETG'])) : null;

  const [pMin, pMax] = PRICE_RANGES[`${category}:${variant}`] || PRICE_RANGES[`${category}:default`];
  // Khoảng giá đồ gia dụng đã tính theo bộ ("Set Of 4" ly...), chỉ cộng thêm khi là combo "A & B".
  const factor = category === 'household' ? (/&/.test(lower) ? 1.4 : 1) : bundleFactor(lower);
  const basePrice = storePrice((pMin + r() * (pMax - pMin)) * factor);
  // Giữ đúng sản phẩm nào đang giảm giá như file gốc, chỉ đưa mức giảm về 8–30%.
  const onSale = Number(src.originalPrice) > Number(src.basePrice);
  const originalPrice = onSale ? storePrice(basePrice / (1 - between(r, 8, 30) / 100)) : null;

  const color = (COLOR_BY_NAME.find(([re]) => re.test(lower)) || [])[1] || src.color || null;
  const vKey = `${category}:${variant}`;
  const materialInfo = print
    ? PRINT_MATERIAL_TEXT[printMaterial]
    : VARIANT_MATERIAL[vKey] || ((MATERIAL_BY_NAME.find(([re]) => re.test(lower)) || [])[1] || MATERIAL_DEFAULT[category] || decodeEntities(src.materialInfo));
  const dimensions = dimensionsFor(r, category, variant);
  const customization = buildCustomization(src.customization, { category, color, large, print, dimensions });

  const num = String(src.id).match(/(\d+)$/);
  const { vi: nameVi, unknown } = translateName(name, { collections: COLLECTIONS });
  return {
    nameEn: name,
    unknown,
    product: {
      id: src.id,
      name: nameVi,
      slug: `${slugify(nameVi)}-${num ? Number(num[1]) : slugify(src.id)}`,
      category,
      categoryName: info.name,
      categoryGroup: info.group,
      productionType,
      customizable: !!customization,
      basePrice,
      originalPrice,
      description: decodeEntities(src.description),
      story: '',
      rating: Math.min(5, Math.max(3.5, Number(src.rating) || 4.5)),
      reviewCount: Math.max(0, Math.round(Number(src.reviewCount) || 0)),
      inStock: Math.max(0, Math.round(Number(src.inStock) || 0)),
      images,
      badge: '',
      dimensions,
      materialInfo,
      weight: weightFor(r, category, variant),
      features: [...(print ? PRINT_FEATURES : []), ...(VARIANT_FEATURES[vKey] || FEATURES[category] || [])].slice(0, 4),
      reviews: [],
      customization,
      threeModelType: null, // mô hình trong file gốc là ảnh mẫu (Astronaut.glb), không phải sản phẩm thật
      modelUrl: null,
      productionTime: print ? pick(r, ['2-3 ngày', '3-5 ngày']) : null,
      printTechnology: print ? 'FDM độ phân giải 0.12mm' : null,
      flashSaleSlot: null,
      style: src.style || null,
      color,
      printMaterial,
      sizeCategory: SIZE_BY_VARIANT[vKey] || SIZE_CATEGORY[category] || null,
      // Rỗng -> frontend tự suy ra theo category (catalog-taxonomy.ts › spacesOf); đồ gia dụng ghi rõ theo loại con.
      spaces: VARIANT_SPACES[vKey] || [],
    },
    variant,
  };
}

// Mỗi khung Flash Sale (hôm nay / mai / kia) 4 sản phẩm đang giảm giá, trải đều các loại.
function assignFlashSale(products) {
  const onSale = products.filter(p => p.originalPrice && p.inStock > 0);
  const byCat = new Map();
  for (const p of onSale) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  const picks = [];
  const queues = [...byCat.values()];
  for (let i = 0; picks.length < 12 && queues.some(q => q.length); i++) {
    const q = queues[i % queues.length];
    if (q.length) picks.push(q.shift());
  }
  picks.forEach((p, i) => { p.flashSaleSlot = i % 3; });
  return picks;
}

function normalize(inputPath) {
  if (!inputPath) throw new Error('Thiếu đường dẫn file JSON gốc. Vd: node seed/import-lumea-products.js normalize "../products (7).json"');
  const raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  if (!Array.isArray(raw)) throw new Error('File JSON phải là 1 mảng sản phẩm.');

  COLLECTIONS = buildCollections(raw.map(src => translateName(decodeEntities(src.name)).series));
  const products = [];
  const skipped = [];
  const moves = {};
  const nameEn = new Map();
  const unknownWords = {};
  for (const src of raw) {
    const res = normalizeOne(src);
    if (res.skipped) { skipped.push(res.skipped); continue; }
    products.push(res.product);
    nameEn.set(res.product.id, res.nameEn);
    for (const w of res.unknown) unknownWords[w] = (unknownWords[w] || 0) + 1;
    const k = `${src.category} → ${res.product.category}`;
    moves[k] = (moves[k] || 0) + 1;
  }

  // Tên trùng -> đặt lại bằng tên chi tiết hơn; vẫn trùng thì thêm "Mẫu 2, 3...".
  const groupBy = list => list.reduce((m, p) => m.set(p.name, [...(m.get(p.name) || []), p]), new Map());
  const numOf = id => (String(id).match(/(\d+)$/) || [])[1];
  const resetSlug = p => { p.slug = `${slugify(p.name)}-${numOf(p.id) ? Number(numOf(p.id)) : slugify(p.id)}`; };
  for (const group of groupBy(products).values()) {
    if (group.length < 2) continue;
    for (const p of group) { p.name = translateName(nameEn.get(p.id), { detailed: true, collections: COLLECTIONS }).vi; resetSlug(p); }
  }
  // (Không dùng màu để phân biệt: màu trong file gốc là ngẫu nhiên, không khớp ảnh.)
  for (const group of groupBy(products).values()) {
    if (group.length < 2) continue;
    group.forEach((p, i) => { if (i) { p.name = `${p.name} (Mẫu ${i + 1})`; resetSlug(p); } });
  }

  // Slug trùng -> thêm hậu tố.
  const slugs = new Map();
  for (const p of products) {
    const n = slugs.get(p.slug) || 0;
    slugs.set(p.slug, n + 1);
    if (n) p.slug = `${p.slug}-${n + 1}`;
  }
  const flash = assignFlashSale(products);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(products, null, 2));
  fs.writeFileSync(REPORT_FILE, buildReport(raw.length, products, skipped, moves, flash, nameEn, unknownWords));
  const unk = Object.keys(unknownWords);
  if (unk.length) console.log(`[normalize] Từ chưa có trong từ điển dịch (đã bỏ khỏi tên): ${unk.join(', ')}`);
  console.log(`[normalize] ${raw.length} SP gốc -> ${products.length} SP hợp lệ, bỏ qua ${skipped.length}.`);
  console.log(`[normalize] Đã ghi ${path.relative(process.cwd(), OUT_FILE)} và ${path.relative(process.cwd(), REPORT_FILE)}`);
}

function buildReport(total, products, skipped, moves, flash, nameEn, unknownWords) {
  const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  const table = (obj, h1, h2 = 'Số SP') => [`| ${h1} | ${h2} |`, '|---|---|',
    ...Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`)].join('\n');
  const byCat = count(products, p => `${p.category} (${p.categoryName})`);
  const lines = [
    '# Báo cáo chuẩn hoá sản phẩm Luméa',
    '',
    `- SP trong file gốc: **${total}**`,
    `- SP hợp lệ sẽ nạp: **${products.length}**`,
    `- SP bị bỏ qua: **${skipped.length}**`,
    '',
    '## Số SP theo danh mục',
    table(byCat, 'category'),
    '',
    '## Chuyển danh mục (file gốc → sau chuẩn hoá)',
    table(moves, 'Chuyển'),
    '',
    '## Nhóm / loại sản xuất',
    table(count(products, p => `${p.categoryGroup} / ${p.productionType}`), 'categoryGroup / productionType'),
    '',
    '## Flash Sale (đã gán)',
    ...flash.map(p => `- Khung ${p.flashSaleSlot}: ${p.id} — ${p.name} (${p.basePrice.toLocaleString('vi-VN')}đ, gốc ${p.originalPrice.toLocaleString('vi-VN')}đ)`),
    '',
    '## Danh sách SP theo danh mục (để kiểm tra phân loại)',
  ];
  const groups = {};
  for (const p of products) (groups[p.category] ||= []).push(p);
  for (const [cat, list] of Object.entries(groups)) {
    lines.push('', `### ${cat} — ${CATEGORY_INFO[cat].name} (${list.length})`);
    for (const p of list) lines.push(`- ${p.id} — **${p.name}** _(gốc: ${nameEn.get(p.id)})_ — ${p.basePrice.toLocaleString('vi-VN')}đ`);
  }
  lines.push('', '## SP bị bỏ qua', '| id | Tên | Danh mục gốc | Lý do |', '|---|---|---|---|',
    ...skipped.map(s => `| ${s.id} | ${s.name.replace(/\|/g, '/')} | ${s.from} | ${s.reason} |`));
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Bước 2: nạp vào MongoDB
// ---------------------------------------------------------------------------

async function importToDb(apply) {
  if (!fs.existsSync(OUT_FILE)) throw new Error(`Chưa có ${OUT_FILE} — chạy bước normalize trước.`);
  const mongoose = require('mongoose');
  const { connectDB } = require('../config/db');
  const Product = require('../models/Product');
  const Room = require('../models/Room');
  const NewsArticle = require('../models/NewsArticle');
  const CommunityPost = require('../models/CommunityPost');

  const incoming = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  await connectDB();
  try {
    const old = await Product.find({}).lean();
    const roomIds = new Set();
    for (const room of await Room.find({}, { hotspots: 1 }).lean()) {
      for (const h of room.hotspots || []) if (h && h.productId) roomIds.add(h.productId);
    }
    const keep = old.filter(p => p.modelUrl || p.threeModelType || roomIds.has(p.id));
    const remove = old.filter(p => !keep.includes(p));
    const removeIds = new Set(remove.map(p => p.id));

    // Sản phẩm mới không được trùng id/slug với sản phẩm cũ được giữ lại.
    const keptIds = new Set(keep.map(p => p.id));
    const keptSlugs = new Set(keep.map(p => p.slug));
    const toInsert = [];
    const conflicts = [];
    for (const p of incoming) {
      if (keptIds.has(p.id) || keptSlugs.has(p.slug)) conflicts.push(p.id);
      else toInsert.push(p);
    }

    // Tham chiếu sẽ trỏ vào SP bị xoá (không lỗi, chỉ báo để biết).
    const news = await NewsArticle.find({ taggedProductIds: { $in: [...removeIds] } }, { id: 1 }).lean();
    const posts = (await CommunityPost.find({}, { id: 1, productTags: 1 }).lean())
      .filter(p => (p.productTags || []).some(t => removeIds.has(typeof t === 'string' ? t : t && t.productId)));
    const flashOld = remove.filter(p => p.flashSaleSlot != null).length;

    console.log(`\n[import] SP cũ trong DB      : ${old.length}`);
    console.log(`[import] Giữ lại (3D/phòng 3D): ${keep.length}`);
    keep.forEach(p => console.log(`           - ${p.id} — ${p.name}${roomIds.has(p.id) ? ' [phòng 3D]' : ''}${p.modelUrl || p.threeModelType ? ' [3D]' : ''}`));
    console.log(`[import] Sẽ xoá (SP thường)   : ${remove.length}${flashOld ? ` (trong đó ${flashOld} SP Flash Sale cũ)` : ''}`);
    console.log(`[import] Sẽ thêm SP mới       : ${toInsert.length}`);
    if (conflicts.length) console.log(`[import] Bỏ qua do trùng id/slug với SP giữ lại: ${conflicts.join(', ')}`);
    if (news.length) console.log(`[import] Bài tin tức gắn SP sẽ bị xoá: ${news.length} (thẻ SP đó sẽ không hiện)`);
    if (posts.length) console.log(`[import] Bài cộng đồng gắn SP sẽ bị xoá: ${posts.length}`);

    if (!apply) {
      console.log('\n[import] CHẠY THỬ — chưa ghi gì vào DB. Thêm --apply để thực hiện.');
      return;
    }

    const backupDir = path.join(OUT_DIR, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `products-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(old, null, 2));
    console.log(`\n[import] Đã backup ${old.length} SP cũ -> ${path.relative(process.cwd(), backupFile)}`);

    // Kiểm tra schema trước khi xoá, để không rơi vào cảnh đã xoá mà không thêm được.
    for (const p of toInsert) await new Product(p).validate();

    const del = await Product.deleteMany({ id: { $in: [...removeIds] } });
    console.log(`[import] Đã xoá ${del.deletedCount} SP cũ.`);
    const inserted = await Product.insertMany(toInsert, { ordered: false });
    console.log(`[import] Đã thêm ${inserted.length} SP mới. Tổng hiện có: ${await Product.countDocuments()}.`);
  } finally {
    await mongoose.connection.close();
  }
}

// ---------------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);
(async () => {
  if (cmd === 'normalize') normalize(args.find(a => !a.startsWith('--')));
  else if (cmd === 'import') await importToDb(args.includes('--apply'));
  else {
    console.log('Cách dùng:\n  node seed/import-lumea-products.js normalize "<file JSON gốc>"\n  node seed/import-lumea-products.js import [--apply]');
    process.exitCode = 1;
  }
})().catch(err => {
  console.error('[import-lumea-products] Lỗi:', err.message || err);
  process.exit(1);
});
