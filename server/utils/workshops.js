const AdminConfig = require('../models/AdminConfig');

// Xưởng sản xuất đối tác: Luméa thiết kế, đặt xưởng làm thành phẩm rồi nhập về kho (hàng có sẵn),
// hoặc gửi đơn in 3D / làm theo yêu cầu của khách cho xưởng làm. Danh sách lưu ở AdminConfig (khóa
// `workshops`); chưa lưu lần nào thì dùng DEFAULT_WORKSHOPS bên dưới.

// Nhóm hàng xưởng nhận làm. Bảng này dùng chung với my-admin (core/data/workshop-specialties.ts) —
// sửa ở đây thì sửa cả bên đó.
const SPECIALTIES = {
  upholstery: 'Sofa, giường & ghế bọc nệm',
  wood: 'Đồ gỗ (bàn, tủ, kệ)',
  ceramic: 'Gốm sứ',
  lighting: 'Đèn & thiết bị điện',
  metal_glass: 'Gương, kim loại & kính',
  textile: 'Dệt may & đồ gia dụng',
  decor: 'Decor thủ công (tượng, khung, đồng hồ)',
  print3d: 'In 3D & làm theo yêu cầu',
};

// Loại sản phẩm (category) -> nhóm hàng. Hàng in theo đơn / thiết kế riêng luôn về `print3d`.
const CATEGORY_SPECIALTY = {
  sofa: 'upholstery', bed: 'upholstery', chair: 'upholstery', stool: 'upholstery',
  table: 'wood', side_table: 'wood', cabinet: 'wood', bookshelf: 'wood', organizer: 'wood', bookend: 'wood',
  vase: 'ceramic', plant_pot: 'ceramic', candle_holder: 'ceramic', tray: 'ceramic',
  lamp: 'lighting', desk_lamp: 'lighting', night_lamp: 'lighting', pendant_lamp: 'lighting',
  mirror: 'metal_glass',
  household: 'textile',
  sculpture: 'decor', frame: 'decor', clock: 'decor',
};

const DEFAULT_WORKSHOPS = [
  { id: 'ws-1', code: 'XSX-MOCXANH', name: 'Xưởng Gỗ Mộc Xanh', contact: 'Lê Hoàng Long', phone: '0909 888 777', email: 'contact@mocxanhwood.com', address: 'Thuận An, Bình Dương', specialties: ['wood'], leadDays: 14, note: '', active: true },
  { id: 'ws-2', code: 'XSX-BATTRANG', name: 'Xưởng Gốm Bát Tràng Artisans', contact: 'Trần Thị Mai', phone: '0983 222 111', email: 'mai.art@battrangceramic.vn', address: 'Làng Cổ Bát Tràng, Gia Lâm, Hà Nội', specialties: ['ceramic', 'decor'], leadDays: 10, note: '', active: true },
  { id: 'ws-3', code: 'XSX-NEMVIET', name: 'Xưởng Bọc Nệm & Sofa Nệm Việt', contact: 'Phạm Quốc Bảo', phone: '0918 456 789', email: 'bao.pham@nemviet.vn', address: 'Dĩ An, Bình Dương', specialties: ['upholstery', 'textile'], leadDays: 21, note: '', active: true },
  { id: 'ws-4', code: 'XSX-ANHSANG', name: 'Xưởng Đèn & Điện Ánh Sáng Việt', contact: 'Đỗ Minh Trí', phone: '0938 555 444', email: 'tri.do@anhsangviet.vn', address: 'Đống Đa, Hà Nội', specialties: ['lighting'], leadDays: 10, note: '', active: true },
  { id: 'ws-5', code: 'XSX-KINHAN', name: 'Xưởng Kính & Kim Loại Kính An', contact: 'Võ Thanh Hà', phone: '0907 321 654', email: 'ha.vo@kinhan.vn', address: 'Quận 12, TP.HCM', specialties: ['metal_glass'], leadDays: 12, note: '', active: true },
  { id: 'ws-6', code: 'XSX-IN3D', name: 'Xưởng In 3D Luméa Lab', contact: 'Nguyễn Văn Hùng', phone: '0912 345 678', email: 'lab@lumea.vn', address: 'Quận 9, TP.HCM', specialties: ['print3d'], leadDays: 5, note: 'Xưởng in nội bộ — nhận đơn in 3D và thiết kế riêng', active: true },
];

async function loadWorkshops() {
  const doc = await AdminConfig.findOne({ key: 'workshops' }, { value: 1 }).lean();
  return Array.isArray(doc?.value) ? doc.value : DEFAULT_WORKSHOPS;
}

/** Nhóm hàng của 1 sản phẩm (hoặc product snapshot trong đơn). Sản phẩm đặt riêng có id `custom-...`. */
function specialtyOf(product) {
  if (!product) return null;
  if (product.productionType === 'PRINT_ON_DEMAND' || String(product.id || '').startsWith('custom-')) return 'print3d';
  return CATEGORY_SPECIALTY[product.category] || null;
}

/**
 * Xưởng phụ trách sản phẩm: xưởng admin chọn riêng (product.workshopId, nếu còn hợp tác) trước,
 * không thì xưởng đang hợp tác đầu tiên nhận nhóm hàng đó. Không có xưởng phù hợp -> null.
 */
function workshopFor(product, workshops) {
  const active = workshops.filter(w => w.active !== false);
  if (product?.workshopId) {
    const chosen = active.find(w => w.id === product.workshopId);
    if (chosen) return chosen;
  }
  const specialty = specialtyOf(product);
  return specialty ? active.find(w => (w.specialties || []).includes(specialty)) || null : null;
}

/**
 * Ghi xưởng làm các món cần sản xuất của đơn (in 3D / thiết kế riêng) khi đơn vào "Đang sản xuất".
 * Đã ghi rồi thì giữ nguyên. Không lưu — nơi gọi tự order.save().
 */
async function assignProductionWorkshops(order) {
  if (order.status !== 'IN_PRODUCTION' || (order.productionWorkshops || []).length) return;
  const workshops = await loadWorkshops();
  const groups = new Map();
  for (const item of order.items || []) {
    const product = item.product;
    if (specialtyOf(product) !== 'print3d') continue;
    const ws = workshopFor(product, workshops);
    const key = ws ? ws.id : '';
    if (!groups.has(key)) groups.set(key, { workshopId: ws ? ws.id : null, workshopName: ws ? ws.name : 'Chưa có xưởng phù hợp', items: [] });
    groups.get(key).items.push(`${product?.name || 'Sản phẩm'} × ${item.quantity || 1}`);
  }
  order.productionWorkshops = [...groups.values()];
}

module.exports = { SPECIALTIES, CATEGORY_SPECIALTY, DEFAULT_WORKSHOPS, loadWorkshops, specialtyOf, workshopFor, assignProductionWorkshops };
