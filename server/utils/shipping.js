// Đơn vị vận chuyển & gợi ý hãng theo đơn hàng (đồ nội thất cồng kềnh vs đồ decor nhỏ, nội thành vs
// liên tỉnh). Chưa gọi API thật của hãng nào (cần tài khoản/token riêng): nhân viên tạo đơn trên
// hệ thống của hãng rồi nhập mã vận đơn vào my-admin. SHIPPING_DEV_MODE=true thì được bỏ trống mã
// vận đơn — server tự sinh mã giả lập để test, giống cơ chế OTP_DEV_MODE.

// Showroom/kho ở TP.HCM — đơn trong thành phố mới dùng được xe tải nội thành & đội giao của shop.
const SHOP_CITY_KEYWORDS = ['hồ chí minh', 'ho chi minh', 'hcm', 'sài gòn', 'sai gon'];

// Ngưỡng coi là hàng cồng kềnh: 1 món ≥ 3kg hoặc có cạnh ≥ 40cm, hoặc cả đơn ≥ 10kg.
const BULKY_ITEM_KG = 3;
const BULKY_EDGE_CM = 40;
const BULKY_ORDER_KG = 10;

const CARRIERS = [
  {
    id: 'LUMEA_FLEET', name: 'Đội giao & lắp đặt Luméa', scope: 'LOCAL', bulky: true, small: true,
    description: 'Xe tải của shop, giao và lắp đặt tận nơi, thu COD trực tiếp — phù hợp nội thất lớn nội thành.',
    trackingUrl: null,
  },
  {
    id: 'AHAMOVE_TRUCK', name: 'Ahamove – Xe tải', scope: 'LOCAL', bulky: true, small: false,
    description: 'Xe tải/ba gác giao trong ngày nội thành, hỗ trợ thu hộ COD.',
    trackingUrl: null,
  },
  {
    id: 'LALAMOVE_VAN', name: 'Lalamove – Xe van/tải', scope: 'LOCAL', bulky: true, small: false,
    description: 'Xe van/tải nhỏ nội thành, giao nhanh đồ cồng kềnh.',
    trackingUrl: null,
  },
  {
    id: 'GHN_HEAVY', name: 'GHN – Hàng nặng', scope: 'NATIONWIDE', bulky: true, small: false,
    description: 'Dịch vụ hàng nặng/cồng kềnh liên tỉnh, có thu hộ COD.',
    trackingUrl: 'https://donhang.ghn.vn/?order_code={code}',
  },
  {
    id: 'VIETTELPOST_BULKY', name: 'Viettel Post – Hàng cồng kềnh', scope: 'NATIONWIDE', bulky: true, small: false,
    description: 'Phủ rộng toàn quốc kể cả tỉnh xa, nhận hàng cồng kềnh, thu hộ COD.',
    trackingUrl: null,
  },
  {
    id: 'GHN_STANDARD', name: 'GHN – Chuẩn', scope: 'NATIONWIDE', bulky: false, small: true,
    description: 'Hàng nhỏ/nhẹ toàn quốc, thu hộ COD.',
    trackingUrl: 'https://donhang.ghn.vn/?order_code={code}',
  },
  {
    id: 'GHTK', name: 'Giao Hàng Tiết Kiệm', scope: 'NATIONWIDE', bulky: false, small: true,
    description: 'Hàng decor nhỏ, phí rẻ, thu hộ COD.',
    trackingUrl: 'https://i.ghtk.vn/{code}',
  },
];

function normalize(text) {
  return String(text || '').toLowerCase();
}

function isLocalAddress(shippingAddress) {
  const city = normalize(shippingAddress?.city);
  return SHOP_CITY_KEYWORDS.some(k => city.includes(k));
}

/** "1.2kg" -> 1.2, "650g" -> 0.65; không đọc được thì 0. */
function parseWeightKg(weight) {
  const text = normalize(weight).replace(',', '.');
  const match = text.match(/([\d.]+)\s*(kg|g)\b/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return match[2] === 'kg' ? value : value / 1000;
}

/** Cạnh dài nhất (cm) đọc được trong chuỗi kích thước, vd "Dài 45cm x Rộng 15cm" -> 45. */
function longestEdgeCm(dimensions) {
  const text = normalize(dimensions).replace(',', '.');
  const values = [...text.matchAll(/([\d.]+)\s*cm/g)].map(m => parseFloat(m[1]));
  // Dạng "22 x 14 x 6 cm": số đứng trước "x" không có đơn vị riêng.
  if (/\d\s*x\s*\d/.test(text) && /cm/.test(text)) {
    values.push(...[...text.matchAll(/([\d.]+)\s*(?=x)/g)].map(m => parseFloat(m[1])));
  }
  return values.length ? Math.max(...values) : 0;
}

function analyzeOrder(order) {
  let totalKg = 0;
  let bulkyItems = [];
  for (const item of order.items || []) {
    const kg = parseWeightKg(item.product?.weight);
    const edge = longestEdgeCm(item.product?.dimensions);
    totalKg += kg * (item.quantity || 1);
    if (kg >= BULKY_ITEM_KG || edge >= BULKY_EDGE_CM) bulkyItems.push(item.product?.name);
  }
  const bulky = bulkyItems.length > 0 || totalKg >= BULKY_ORDER_KG;
  return { bulky, bulkyItems, totalKg: Math.round(totalKg * 100) / 100, local: isLocalAddress(order.shippingAddress) };
}

/** Danh sách hãng kèm cờ "phù hợp" cho đơn này, hãng phù hợp xếp trước. */
function shippingOptions(order) {
  const info = analyzeOrder(order);
  const carriers = CARRIERS.map(c => {
    const scopeOk = c.scope === 'NATIONWIDE' || info.local;
    const sizeOk = info.bulky ? c.bulky : c.small;
    const reason = !scopeOk ? 'Chỉ giao nội thành TP.HCM' : !sizeOk ? (info.bulky ? 'Không nhận hàng cồng kềnh' : 'Dành cho hàng cồng kềnh') : '';
    return { ...c, suitable: scopeOk && sizeOk, reason };
  });
  carriers.sort((a, b) => Number(b.suitable) - Number(a.suitable));
  return { ...info, carriers };
}

function findCarrier(id) {
  return CARRIERS.find(c => c.id === id) || null;
}

function trackingUrlFor(carrier, code) {
  return carrier?.trackingUrl && code ? carrier.trackingUrl.replace('{code}', encodeURIComponent(code)) : '';
}

function isDevMode() {
  return process.env.SHIPPING_DEV_MODE !== 'false';
}

function devTrackingCode(carrierId) {
  return `${carrierId.split('_')[0]}${Date.now().toString().slice(-8)}`;
}

module.exports = { CARRIERS, shippingOptions, findCarrier, trackingUrlFor, isDevMode, devTrackingCode, analyzeOrder };
