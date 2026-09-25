const { MOCK_COUPONS } = require('../seed/mock-data.generated');

const SHIPPING_FEE = 30000;
const FREE_SHIPPING_THRESHOLD = 500000;

// Tính lại unitPrice từ sản phẩm THẬT trong DB + lựa chọn tùy biến của khách — không tin bất kỳ
// priceDelta/unitPrice nào client gửi lên (khớp công thức calculateUnitPrice() ở cart.service.ts
// phía FE, nhưng tự tra lại từng option theo id/hex trong product.customization thay vì tin
// thẳng client, để chống sửa giá qua DevTools — tham khảo pattern verify giá server-side của
// AuraPC-main paymentRoutes.js).
// Khung Flash Sale cố định 8:00-22:00 mỗi ngày (giờ Việt Nam, UTC+7) — khớp FlashSaleService ở FE.
// product.flashSaleSlot là chỉ số ngày tương đối (0/1/2 = hôm nay/ngày mai/ngày kia). Giá khuyến mãi
// (basePrice) chỉ hiệu lực khi khung đang diễn ra; chưa tới giờ hoặc đã hết thì tính giá gốc.
const FLASH_START_HOUR = 8;
const FLASH_END_HOUR = 22;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function isFlashSaleLive(product, nowMs = Date.now()) {
  const vn = new Date(nowMs + VN_OFFSET_MS);
  return product.flashSaleSlot === 0 && vn.getUTCHours() >= FLASH_START_HOUR && vn.getUTCHours() < FLASH_END_HOUR;
}

function effectiveBasePrice(product) {
  const isFlashProduct = product.flashSaleSlot != null && product.originalPrice > product.basePrice;
  return isFlashProduct && !isFlashSaleLive(product) ? product.originalPrice : product.basePrice;
}

function resolveUnitPrice(product, selectedCustomization) {
  const basePrice = effectiveBasePrice(product);
  if (!selectedCustomization) return basePrice;

  const config = product.customization;
  if (!config) return basePrice; // sản phẩm không hỗ trợ tùy biến -> bỏ qua lựa chọn gửi lên

  let base = basePrice;

  if (selectedCustomization.color?.hex) {
    const opt = config.colors?.find(c => c.hex === selectedCustomization.color.hex);
    if (!opt) throw new Error(`Tùy chọn màu không hợp lệ cho sản phẩm "${product.name}"`);
    base += opt.priceDelta || 0;
  }

  if (selectedCustomization.material?.id) {
    const opt = config.materials?.find(m => m.id === selectedCustomization.material.id);
    if (!opt) throw new Error(`Tùy chọn chất liệu không hợp lệ cho sản phẩm "${product.name}"`);
    base += opt.priceDelta || 0;
  }

  if (selectedCustomization.finish?.id) {
    const opt = config.finishes?.find(f => f.id === selectedCustomization.finish.id);
    if (!opt) throw new Error(`Tùy chọn hoàn thiện không hợp lệ cho sản phẩm "${product.name}"`);
    base += opt.priceDelta || 0;
  }

  if (selectedCustomization.customText?.trim() && config.textOption?.enabled) {
    base += config.textOption.priceDelta || 0;
  }

  if (selectedCustomization.accessories?.length) {
    for (const acc of selectedCustomization.accessories) {
      const opt = config.accessories?.find(a => a.id === acc.id);
      if (!opt) throw new Error(`Phụ kiện không hợp lệ cho sản phẩm "${product.name}"`);
      base += opt.priceDelta || 0;
    }
  }

  let scaleMultiplier = 1;
  if (selectedCustomization.size?.id) {
    const opt = config.sizes?.find(s => s.id === selectedCustomization.size.id);
    if (!opt) throw new Error(`Tùy chọn kích thước không hợp lệ cho sản phẩm "${product.name}"`);
    scaleMultiplier = opt.priceMultiplier || 1;
  }

  return Math.round(base * scaleMultiplier);
}

// Coupon vẫn là MOCK_COUPONS tĩnh (chưa có collection Promotion riêng) — tái dùng đúng file
// mock-data.generated.js mà server/seed/seed.js đã dùng, để không phải định nghĩa lại danh sách.
function resolveDiscount(subtotal, couponCode) {
  if (!couponCode) return 0;
  const coupon = MOCK_COUPONS.find(c => c.code === couponCode);
  if (!coupon || subtotal < coupon.minSpend) return 0;
  const calc = (subtotal * coupon.discountPercent) / 100;
  return Math.min(calc, coupon.maxDiscount);
}

function resolveShippingFee(subtotal) {
  if (subtotal === 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

// Đối chiếu items của đơn hàng với sản phẩm THẬT trong DB, trả về items đã tính lại giá +
// subtotal thật. Ném lỗi (message tiếng Việt, hiển thị được thẳng cho khách) nếu sản phẩm không
// tồn tại hoặc lựa chọn tùy biến không khớp option nào trong DB.
async function verifyAndPriceOrderItems(items, Product) {
  const productIds = items.map(i => i.product?.id).filter(Boolean);
  const dbProducts = await Product.find({ id: { $in: productIds } }).lean();
  const productMap = new Map(dbProducts.map(p => [p.id, p]));

  const pricedItems = items.map(item => {
    const dbProduct = productMap.get(item.product?.id);
    if (!dbProduct) {
      throw new Error(`Sản phẩm "${item.product?.name || item.product?.id}" không tồn tại hoặc đã bị gỡ khỏi shop`);
    }

    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) throw new Error('Số lượng sản phẩm không hợp lệ');

    const unitPrice = resolveUnitPrice(dbProduct, item.selectedCustomization);
    const totalPrice = unitPrice * quantity;

    return {
      ...item,
      product: dbProduct, // dùng dữ liệu sản phẩm THẬT từ DB, không dùng bản client gửi lên
      quantity,
      unitPrice,
      totalPrice,
    };
  });

  const subtotal = pricedItems.reduce((sum, i) => sum + i.totalPrice, 0);
  return { pricedItems, subtotal };
}

module.exports = {
  resolveUnitPrice,
  resolveDiscount,
  resolveShippingFee,
  verifyAndPriceOrderItems,
  SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
};
