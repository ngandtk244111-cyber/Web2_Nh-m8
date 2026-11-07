// Đặt tên tiếng Việt cho sản phẩm nhập từ nguồn tiếng Anh (dùng bởi seed/import-lumea-products.js).
//
// Cấu trúc tên: <Loại đồ> [Bên Trái/Phải] <tối đa 2 đặc điểm chính> [Ngoài Trời] [màu / quy cách]
//   "Dalton Storage Bed"                     -> "Giường Có Ngăn Chứa"
//   "Auburn Performance Fabric Sectional"    -> "Sofa Góc Vải Chống Bẩn"
//   "Lily Dining Table With 4 Chairs"        -> "Bàn Ăn Kèm 4 Ghế"
// Muốn đổi cách gọi 1 loại đồ / đặc điểm: sửa bảng NOUNS / MODS bên dưới rồi chạy lại bước normalize.

// Loại đồ. Cụm dài được khớp trước cụm ngắn.
const NOUNS = [
  // Sofa
  ['pit-sectional couch', 'Sofa Góc Chữ U'], ['pit-sectional', 'Sofa Góc Chữ U'],
  ['chaise sectional sleeper sofa', 'Sofa Giường Chữ L'],
  ['sleeper sectional couch', 'Sofa Giường Góc'], ['sleeper sectional', 'Sofa Giường Góc'],
  ['sleeper couch', 'Sofa Giường'], ['sleeper sofa', 'Sofa Giường'],
  ['chaise sectional couch', 'Sofa Góc Chữ L'], ['chaise sectional', 'Sofa Góc Chữ L'],
  ['sectional couch', 'Sofa Góc'], ['sectional sofa', 'Sofa Góc'], ['sectional', 'Sofa Góc'],
  ['chaise lounge cover', 'Áo Trùm Ghế Nằm'], ['chaise lounges', 'Ghế Nằm Thư Giãn'], ['chaise lounge', 'Ghế Nằm Thư Giãn'],
  ['side chaise sofa', 'Sofa Chữ L'], ['chaise sofa', 'Sofa Chữ L'],
  ['chaise couch', 'Sofa Chữ L'], ['chaise', 'Ghế Dài Sofa'], ['loveseat', 'Sofa Đôi'],
  ['couch modular component cover', 'Áo Bọc Module Sofa'], ['component cover', 'Áo Bọc Module Sofa'],
  ['combination couch cover', 'Áo Trùm Sofa Tổ Hợp'], ['couch cover', 'Áo Trùm Sofa'],
  ['couch', 'Sofa Băng'], ['sofa', 'Sofa Băng'],
  // Ghế
  ['chair and a half', 'Ghế Bành Rộng'],
  ['dining arm chair', 'Ghế Ăn Có Tay Vịn'], ['dining armchair', 'Ghế Ăn Có Tay Vịn'],
  ['dining chair cover', 'Áo Trùm Ghế Ăn'], ['dining chairs', 'Ghế Ăn'], ['dining chair', 'Ghế Ăn'],
  ['recliner armchair', 'Ghế Thư Giãn Ngả Lưng'], ['office armchair', 'Ghế Văn Phòng'], ['office chair', 'Ghế Văn Phòng'],
  ['armchairs', 'Ghế Bành'], ['armchair', 'Ghế Bành'], ['arm chair', 'Ghế Bành'],
  ['lounge chairs', 'Ghế Thư Giãn'], ['lounge chair', 'Ghế Thư Giãn'],
  ['counter stool', 'Ghế Quầy Bar'], ['bar stool', 'Ghế Bar'], ['chairs', 'Ghế'], ['chair', 'Ghế'],
  ['ottomans', 'Ghế Đôn'], ['ottoman', 'Ghế Đôn'], ['stool', 'Ghế Đôn'],
  ['dining bench', 'Ghế Băng Bàn Ăn'], ['banquette bench', 'Ghế Băng Dài'], ['banquette', 'Ghế Băng Dài'], ['bench', 'Ghế Băng'],
  // Bàn & bộ
  ['bistro dining set', 'Bộ Bàn Ăn Bistro'], ['dining set', 'Bộ Bàn Ăn'], ['bedroom set', 'Bộ Phòng Ngủ'],
  ['dining table cover', 'Áo Trùm Bàn Ăn'], ['dining table', 'Bàn Ăn'],
  ['coffee table set', 'Bộ Bàn Trà'], ['coffee table', 'Bàn Trà'],
  ['c-side table', 'Bàn Phụ Chữ C'], ['side table cover', 'Áo Trùm Bàn Phụ'], ['side table', 'Bàn Phụ'],
  ['console table', 'Bàn Console'], ['side console', 'Bàn Console'], ['storage console', 'Tủ Console'], ['console', 'Bàn Console'],
  ['bistro table', 'Bàn Bistro'], ['bar table', 'Bàn Bar'],
  ['nesting table set', 'Bộ Bàn Lồng'], ['nesting table', 'Bộ Bàn Lồng'], ['desk', 'Bàn Làm Việc'], ['table', 'Bàn'],
  // Giường, tủ, kệ
  ['bed', 'Giường'], ['nightstands', 'Tủ Đầu Giường'], ['nightstand', 'Tủ Đầu Giường'],
  ['sideboard', 'Tủ Buffet'], ['tv stand', 'Kệ Tivi'], ['dresser', 'Tủ Ngăn Kéo'], ['hutch', 'Tủ Chén'],
  ['bar cabinet', 'Tủ Rượu'], ['cabinet', 'Tủ'], ['storage combination', 'Tủ Kệ Kết Hợp'],
  ['bedroom storage', 'Tủ Phòng Ngủ'], ['pedestal', 'Hộc Tủ'],
  ['bookshelf', 'Kệ Sách'], ['open shelf', 'Kệ Mở'], ['shelf', 'Kệ'], ['drawers', 'Ngăn Kéo'],
  // Đèn, decor
  ['chandelier', 'Đèn Chùm'], ['floor lamp', 'Đèn Cây'], ['table lamp', 'Đèn Bàn'], ['lamp', 'Đèn'],
  ['vase', 'Bình Hoa'], ['scented candle', 'Nến Thơm'],
  ['wall mirror', 'Gương Treo Tường'], ['floor mirror', 'Gương Soi Toàn Thân'], ['mirror', 'Gương'],
  // Đồ dùng gia đình
  ['area rug', 'Thảm'], ['rug', 'Thảm'], ['throw pillow', 'Gối Tựa Sofa'], ['pillow insert', 'Ruột Gối'],
  ['pillowcase set', 'Bộ Vỏ Gối'], ['pillowcase', 'Vỏ Gối'], ['sheet set', 'Bộ Ga Giường'],
  ['duvet cover', 'Vỏ Chăn'], ['duvet insert', 'Ruột Chăn'], ['bedding insert', 'Ruột Chăn'],
  ['mattress protector', 'Tấm Bảo Vệ Nệm'], ['mattress', 'Nệm'],
  ['white wine glasses', 'Ly Vang Trắng'], ['wine glasses', 'Ly Rượu Vang'], ['champagne glasses', 'Ly Champagne'],
  ['drinking glasses', 'Ly Uống Nước'], ['cutlery set', 'Bộ Dao Nĩa'], ['dinnerware set', 'Bộ Bát Đĩa'],
  ['chair cover', 'Áo Trùm Ghế'], ['table cover', 'Áo Trùm Bàn'], ['armrest', 'Tay Vịn Sofa'], ['bar cart', 'Xe Đẩy Quầy Bar'],
].map(([en, vi]) => [en.split(' '), vi]).sort((a, b) => b[0].length - a[0].length);

// Đặc điểm: [tiếng Anh, tiếng Việt, loại]. Loại null = bỏ, không đưa vào tên (thuật ngữ / từ thừa).
//   shape: hình dáng, số chỗ   func: công năng   mat: chất liệu   size: kích cỡ
//   place: ngoài trời          side: trái/phải
const MODS = [
  ['performance fabric', 'Vải Chống Bẩn', 'mat'], ['cane and leather', 'Mây Phối Da', 'mat'],
  ['egyptian cotton', 'Cotton Ai Cập', 'mat'], ['mulberry silk', 'Lụa Tơ Tằm', 'mat'], ['sintered stone', 'Đá Nung Kết', 'mat'],
  ['blended down alternative', 'Lông Vũ Nhân Tạo', 'mat'], ['stainless steel', 'Inox', 'mat'],
  ['rounded rectangle', 'Chữ Nhật Bo Góc', 'shape'],
  ['left facing', 'Bên Trái', 'side'], ['right facing', 'Bên Phải', 'side'],
  ['left arm', 'Bên Trái', 'side'], ['right arm', 'Bên Phải', 'side'], ['left', 'Bên Trái', 'side'], ['right', 'Bên Phải', 'side'],
  ['2-in-1', '2 Trong 1', 'func'], ['lift-top', 'Mặt Nâng', 'func'], ['storage', 'Có Ngăn Chứa', 'func'],
  ['swivel', 'Xoay', 'func'], ['motion', 'Chỉnh Điện', 'func'], ['recliner', 'Ngả Lưng', 'func'], ['extendable', 'Mở Rộng', 'func'],
  ['fabric', 'Vải', 'mat'], ['leather', 'Da', 'mat'], ['bouclé', 'Vải Bouclé', 'mat'], ['boucle', 'Vải Bouclé', 'mat'],
  ['sherpa', 'Lông Cừu', 'mat'], ['cane', 'Mây', 'mat'], ['teak', 'Gỗ Teak', 'mat'], ['walnut', 'Gỗ Óc Chó', 'mat'],
  ['oak', 'Gỗ Sồi', 'mat'], ['wood', 'Gỗ', 'mat'], ['marble', 'Mặt Đá', 'mat'], ['travertine', 'Đá Travertine', 'mat'],
  ['glass', 'Kính', 'mat'], ['ceramic', 'Gốm', 'mat'], ['wool', 'Len', 'mat'], ['cotton', 'Cotton', 'mat'], ['lyocell', 'Lyocell', 'mat'],
  ['outdoor', 'Ngoài Trời', 'place'],
  ['round', 'Tròn', 'shape'], ['square', 'Vuông', 'shape'], ['rectangular', 'Chữ Nhật', 'shape'], ['oval', 'Oval', 'shape'],
  ['curve', 'Cong', 'shape'], ['corner', 'Góc', 'shape'], ['l-shape', 'Chữ L', 'shape'], ['l-shaped', 'Chữ L', 'shape'],
  ['u-shape', 'Chữ U', 'shape'], ['arch', 'Mái Vòm', 'shape'], ['organic', 'Dáng Tự Do', 'shape'], ['tripod', 'Ba Chân', 'shape'],
  ['bulbous', 'Dáng Tròn', 'shape'], ['sculptural', 'Dáng Điêu Khắc', 'shape'], ['pedestal', 'Chân Trụ', 'shape'],
  ['small', 'Nhỏ', 'size'], ['large', 'Lớn', 'size'], ['tall', 'Cao', 'size'], ['short', 'Thấp', 'size'],
  ['slim', 'Mỏng', 'size'], ['oversized', 'Cỡ Lớn', 'size'],
  // 'extra': bình thường bỏ khỏi tên cho gọn, chỉ dùng khi cần phân biệt 2 SP trùng tên (opts.detailed).
  ['extended', 'Bản Dài', 'extra'], ['armless', 'Không Tay Vịn', 'extra'], ['single arm', 'Một Tay Vịn', 'extra'],
  ['wide', 'Bản Rộng', 'extra'], ['angled', 'Góc Nghiêng', 'extra'], ['wedge', 'Hình Nêm', 'extra'],
  ['reversible', 'Đảo Chiều', 'extra'], ['stationary', 'Cố Định', 'extra'], ['modular', 'Module', 'extra'],
  ['amphora', 'Dáng Amphora', 'extra'], ['botanical', 'Họa Tiết Lá', 'extra'], ['calyx', 'Dáng Đài Hoa', 'extra'],
  ['drum', 'Dáng Trụ', 'extra'], ['box', 'Dáng Hộp', 'extra'], ['bumper', 'Tựa Lưng Liền', 'extra'], ['sputnik', 'Sputnik', 'extra'],
  ['white', 'Trắng', 'extra'], ['black', 'Đen', 'extra'], ['caramel', 'Caramel', 'extra'],
  ['sateen', 'Sateen', 'extra'], ['percale', 'Percale', 'extra'], ['classic', 'Cổ Điển', 'extra'], ['luxe', 'Cao Cấp', 'extra'],
  ['cool', 'Mát Lạnh', 'extra'], ['plush', 'Êm Mềm', 'extra'], ['comfort', 'Comfort', 'extra'], ['single', 'Đơn', 'extra'],
  ['dining', 'Phòng Ăn', 'extra'], ['bar', 'Quầy Bar', 'extra'], ['office', 'Văn Phòng', 'extra'],
  // Bỏ khỏi tên
  ['performance', '', null], ['limited edition', '', null], ['build-your-own', '', null], ['all-purpose', '', null],
  ['nesting', '', null], ['sleeper', '', null], ['open', '', null], ['tv', '', null], ['and', '', null], ['side', '', null],
  ['of', '', null], ['seater', '', null],
].map(([en, vi, kind]) => [en.split(' '), vi, kind]).sort((a, b) => b[0].length - a[0].length);

const VOCAB = new Set([...NOUNS, ...MODS].flatMap(([words]) => words));
const NOT_SERIES = new Set(['tan', 'france']); // "Tan France Zyra" -> chỉ giữ "Zyra" (Tan France là tên nhà thiết kế)
const MAX_MODS = 2;
// Tên dòng SP của nguồn gốc (Dalton, Claude...) KHÔNG đưa vào tên; mỗi dòng được đổi thành 1 bộ sưu tập
// Luméa = BRAND + 1 từ trong COLLECTION_WORDS, vd "Claude" -> "Luméa Sương". Các SP cùng dòng gốc dùng chung BST.
const BRAND = 'Luméa';
const COLLECTION_WORDS = [
  'An', 'Mộc', 'Sương', 'Mây', 'Nắng', 'Gió', 'Trăng', 'Cát', 'Lam', 'Ngân', 'Trúc', 'Tùng', 'Sen', 'Lan', 'Mai', 'Đào',
  'Rêu', 'Suối', 'Hồ', 'Sóng', 'Sao', 'Khói', 'Tơ', 'Lụa', 'Nhung', 'Ngọc', 'Ngà', 'Vân', 'Hà', 'Linh', 'Minh', 'Khuê',
  'Thảo', 'Uyên', 'Diệp', 'Phong', 'Vũ', 'Hải', 'Sơn', 'Thanh', 'Bình', 'Hạ', 'Thu', 'Xuân', 'Đông', 'Mộc Lan', 'Cúc',
  'Huệ', 'Quỳnh', 'Trà', 'Quế', 'Tràm', 'Bách', 'Liễu', 'Phượng', 'Bằng Lăng', 'Dã Quỳ', 'Hướng Dương', 'Thạch Thảo',
  'Oải Hương', 'Cẩm Tú', 'Tường Vi', 'Thiên Lý', 'Hoàng Lan', 'Ngọc Lan', 'Sơn Trà', 'Thủy Tiên', 'Hoàng Hôn', 'Bình Minh',
  'Ban Mai', 'Hừng Đông', 'Mưa Bụi', 'Mưa Xuân', 'Gió Nam', 'Sương Mai', 'Nắng Hạ', 'Trăng Rằm', 'Sao Mai', 'Ngân Hà',
  'Biển Xanh', 'Đồi Thông', 'Đồng Lúa', 'Phố Cổ', 'Hội An', 'Đà Lạt', 'Sa Pa', 'Hạ Long', 'Tràng An', 'Mũi Né', 'Côn Đảo',
  'Phú Quốc', 'Tam Đảo', 'Mộc Châu', 'Cao Nguyên', 'Ven Sông', 'Bến Đò', 'Mái Ngói', 'Hiên Nhà', 'Sân Vườn', 'Gác Nhỏ',
  'Ô Cửa', 'Lối Nhỏ', 'Thềm Nắng', 'Gốm Mộc', 'Lá Cọ', 'Cói', 'Lục Bình', 'Mây Tre', 'Đất Nung', 'Hổ Phách', 'Ngọc Trai',
  'San Hô', 'Pha Lê', 'Thạch Anh', 'Cẩm Thạch', 'Nguyệt Quế', 'Lưu Ly', 'Tử Đằng', 'Hoa Sứ', 'Hoa Gạo', 'Hoa Ban',
  'Hoa Sữa', 'Cỏ May', 'Thanh Bình', 'An Nhiên', 'Tĩnh Lặng', 'Ấm Áp', 'Dịu Dàng', 'Thong Thả', 'Bình Yên', 'Hoài Niệm',
  'Mộng Mơ', 'Bản Mường', 'Nương Chè', 'Rừng Thông', 'Hồ Gươm', 'Tây Hồ', 'Sông Hương', 'Núi Ngự', 'Vịnh Xanh', 'Đảo Ngọc',
  'Mây Trắng', 'Gió Đông', 'Nắng Mai', 'Trăng Non', 'Sao Băng', 'Mặt Trời', 'Cầu Vồng', 'Tuyết Trắng', 'Mưa Rào', 'Sấm Xuân',
  'Lá Thu', 'Hoa Đào', 'Hoa Mai', 'Hoa Cau', 'Hoa Bưởi', 'Hoa Súng', 'Lá Sen', 'Trúc Xanh', 'Tre Ngà', 'Gỗ Lim',
  'Gỗ Hương', 'Bách Tùng', 'Thông Reo', 'Đá Ong', 'Gạch Nung', 'Men Lam', 'Men Rạn', 'Sơn Mài', 'Khảm Trai', 'Lụa Hà Đông',
  'Bát Tràng', 'Vạn Phúc', 'Kim Bồng', 'Thanh Hà', 'Phù Lãng', 'Chu Đậu', 'Bàu Trúc', 'Ngũ Hành', 'Hàm Rồng', 'Ngọc Hân',
];

/** Gán mỗi dòng SP gốc 1 tên bộ sưu tập Luméa (theo thứ tự chữ cái -> chạy lại vẫn ra như cũ). */
function buildCollections(seriesList) {
  const list = [...new Set(seriesList.filter(Boolean))].sort();
  if (list.length > COLLECTION_WORDS.length) {
    throw new Error(`Cần ${list.length} tên bộ sưu tập nhưng COLLECTION_WORDS chỉ có ${COLLECTION_WORDS.length} — thêm từ vào danh sách.`);
  }
  return new Map(list.map((s, i) => [s, `${BRAND} ${COLLECTION_WORDS[i]}`]));
}

// Hậu tố sau dấu phẩy: màu / bản / quy cách.
const SUFFIX = [
  [/^walnut stain$|^walnut$/, 'Màu Óc Chó'], [/^white wash$/, 'Trắng Mộc'], [/^black$/, 'Đen'],
  [/^caramel oak$/, 'Màu Sồi Caramel'], [/^caramel$/, 'Màu Caramel'], [/^oak$/, 'Gỗ Sồi'], [/^tall$/, 'Bản Cao'],
  [/^bouclé$|^boucle$/, 'Vải Bouclé'], [/^angora$/, ''],
  [/^set of (\d+)$/, '(Bộ $1)'], [/^(\d+) pairs$/, '($1 Đôi)'],
];

const cap = s => s.replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
const inchToCm = s => s.replace(/(\d+(?:\.\d+)?)"/g, (m, n) => `${Math.round(Number(n) * 2.54)}cm`);
const matchAt = (words, i, list) => list.find(([w]) => w.every((x, k) => words[i + k] === x)) || null;

// Dịch 1 cụm (không chứa "with" / "&").
//   opts.series = false: bỏ tên dòng SP (dùng cho phần "Kèm ...")
//   opts.detailed = true: thêm các chi tiết 'extra' + số module, dùng để phân biệt SP trùng tên.
function translatePhrase(phrase, opts = {}) {
  const maxMods = opts.maxMods ?? (opts.detailed ? 4 : MAX_MODS);
  let words = phrase.toLowerCase().replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
  const unknown = [];
  let prefix = '';
  let people = '';

  const forIdx = words.indexOf('for'); // "For 4-6" -> "4-6 Người"
  if (forIdx >= 0) { people = `${words.slice(forIdx + 1).join(' ')} Người`; words = words.slice(0, forIdx); }
  if (/^\d+$/.test(words[0])) { prefix = `${words[0]} `; words = words.slice(1); }
  // "... Set" -> "Bộ ..." (trừ khi "set" là 1 phần tên loại đồ: sheet set, cutlery set...)
  if (words[words.length - 1] === 'set' && !matchAt(words, words.length - 2, NOUNS.filter(([w]) => w.length === 2 && w[1] === 'set'))) {
    words = words.slice(0, -1);
    if (!prefix) prefix = 'Bộ ';
  }

  // Danh từ chính = cụm khớp kết thúc muộn nhất (tiếng Anh đặt danh từ ở cuối).
  let noun = null; let nStart = -1; let nEnd = -1;
  for (let i = 0; i < words.length; i++) {
    const m = matchAt(words, i, NOUNS);
    if (m && (i + m[0].length > nEnd || (i + m[0].length === nEnd && m[0].length > nEnd - nStart))) {
      noun = m; nStart = i; nEnd = i + m[0].length;
    }
  }

  // Tên dòng SP = các từ đầu không thuộc từ điển (Dalton, Owen II...).
  let s = 0;
  while (s < (noun ? nStart : words.length) && !VOCAB.has(words[s]) && !/^\d/.test(words[s])) s++;
  const series = words.slice(0, s).filter(w => !NOT_SERIES.has(w)).map(w => (w === 'ii' ? 'II' : cap(w))).join(' ');

  let nounFrom = nStart; // "2 Chaise Lounges" -> "2 Ghế Nằm Thư Giãn"
  if (noun && nStart > s && /^\d+$/.test(words[nStart - 1])) { prefix = `${prefix}${words[nStart - 1]} `; nounFrom = nStart - 1; }

  const found = []; // [vi, kind]
  const collect = (from, to) => {
    for (let i = from; i < to;) {
      const nd = /^(\d+)-(drawer|light|piece|seater)$/.exec(words[i]);
      if (nd) {
        found.push([`${nd[1]} ${{ drawer: 'Ngăn Kéo', light: 'Bóng', seater: 'Chỗ', piece: 'Module' }[nd[2]]}`, nd[2] === 'piece' ? 'extra' : 'shape']);
        i++; continue;
      }
      if (/^\d+$/.test(words[i]) && words[i + 1] === 'seater') { found.push([`${words[i]} Chỗ`, 'shape']); i += 2; continue; }
      const m = matchAt(words, i, MODS);
      if (m) { if (m[2]) found.push([m[1], m[2]]); i += m[0].length; continue; }
      if (words[i] === 'ii') { i++; continue; }
      if (!/^[\d./-]+$/.test(words[i])) unknown.push(words[i]); // từ lạ: bỏ, không để tiếng Anh trong tên
      i++;
    }
  };
  collect(s, noun ? nounFrom : words.length);
  if (noun) collect(nEnd, words.length);

  let head = noun ? noun[1] : '';
  // Hình dáng ghi đè lên tên loại: "U-Shape Chaise Sectional" -> "Sofa Góc Chữ U"; "Corner Couch" -> "Sofa Góc".
  const has = v => found.some(([x]) => x === v);
  if (has('Chữ U') && /Chữ L/.test(head)) head = head.replace('Chữ L', 'Chữ U');
  if (/^Sofa Băng/.test(head) && (has('Góc') || has('Chữ L') || has('Chữ U'))) head = head.replace('Sofa Băng', 'Sofa Góc');
  const notInNoun = v => !head.includes(v); // "Sofa Góc" + "Góc" -> bỏ "Góc"
  const uniq = kind => [...new Set(found.filter(([v, k]) => k === kind && notInNoun(v)).map(([v]) => v))];

  // Chọn tối đa MAX_MODS đặc điểm theo ưu tiên: hình dáng -> công năng -> chất liệu -> kích cỡ.
  const picked = [];
  const kinds = opts.detailed ? ['shape', 'extra', 'func', 'mat', 'size'] : ['shape', 'func', 'mat', 'size'];
  for (const kind of kinds) {
    for (const v of uniq(kind)) if (picked.length < maxMods) picked.push([v, kind]);
  }
  const order = { shape: 1, extra: 2, size: 3, func: 4, mat: 5 };
  const mods = picked.sort((a, b) => order[a[1]] - order[b[1]]).map(([v]) => v);

  if (head === 'Tủ Ngăn Kéo' && mods.some(v => /Ngăn Kéo$/.test(v))) head = 'Tủ'; // "Tủ 5 Ngăn Kéo"
  const side = uniq('side')[0] || '';
  const place = uniq('place')[0] || '';

  const vi = [prefix + head, side, ...mods, people, place, opts.series === true ? series : '']
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { vi, unknown, series };
}

function translateName(name, opts = {}) {
  let base = inchToCm(name);
  let suffix = '';
  base = base.replace(/\s+set of (\d+)\b/i, (m, n) => { suffix += ` (Bộ ${n})`; return ''; });

  const comma = base.indexOf(',');
  if (comma >= 0) {
    const t = base.slice(comma + 1).trim().toLowerCase();
    base = base.slice(0, comma);
    const sf = SUFFIX.find(([re]) => re.test(t));
    if (sf) suffix = (sf[1] ? ` ${t.replace(sf[0], sf[1])}` : '') + suffix;
    else if (/^[\d.\s"xcm-]+$/.test(t)) suffix = ` (${t})` + suffix; // kích thước: "90cm x 60cm"
    else base = `${base} & ${t}`; // "Couch, 2 Lounge Chairs & Coffee Table Set" -> thêm món vào combo
  }

  const unknown = [];
  let series = '';
  const tr = (p, o, keepSeries) => {
    const r = translatePhrase(p, o);
    unknown.push(...r.unknown);
    if (keepSeries) series = r.series;
    return r.vi;
  };

  // "A With B" -> "A Kèm B"; "A & B" / "Coffee Table And Ottoman" -> "A & B"
  const withParts = base.split(/\s+with\s+/i);
  const andParts = withParts.shift().split(/\s+(?:&|and)\s+(?!leather|a half)/i);
  let combo = '';
  const last = andParts.length - 1;
  if (last > 0 && /\s+set$/i.test(andParts[last]) && !/(sheet|cutlery|dinnerware|pillowcase)\s+set$/i.test(andParts[last])) {
    andParts[last] = andParts[last].replace(/\s+set$/i, '');
    combo = 'Bộ ';
  }
  // Tên dòng SP chỉ giữ ở món chính; món đi kèm chỉ giữ 1 đặc điểm.
  const main = combo + andParts.map((p, i) => tr(p, i === 0 ? opts : { series: false, maxMods: 1 }, i === 0)).join(' & ');
  const extras = withParts.map(p => {
    const vi = p.split(/\s+&\s+/).map(q => tr(q, { series: false, maxMods: 1 })).join(' & ').replace(/^Bộ (Nệm)/, '$1');
    return /^(Ngăn Kéo|Kệ Mở)/.test(vi) ? `Có ${vi}` : `Kèm ${vi}`;
  });
  // opts.collections: Map dòng SP gốc -> tên BST Luméa (từ buildCollections).
  const collection = (opts.collections && opts.collections.get(series)) || '';
  // "Sofa Góc Chữ L Da Luméa Sa Pa Kèm Ghế Đôn": tên BST đứng ngay sau món chính.
  const vi = [main, collection, ...extras].filter(Boolean).join(' ').concat(suffix);
  return { vi: vi.replace(/\s+/g, ' ').trim(), unknown, series };
}

module.exports = { translateName, buildCollections };
