// Dựng toàn bộ document mẫu từ các file dữ liệu trong thư mục này: gắn ObjectId, nối tham chiếu
// (user, sản phẩm, đơn hàng, bài viết), tính giá/phí ship bằng đúng utils của server và sinh các
// bản ghi phái sinh (bảo hành, Xu thưởng giao hàng, thông báo đơn). Không đọc/ghi database.
const bcrypt = require('bcryptjs');
const { oid, daysAgo, viLabel, viLabelPadded } = require('./helpers');
const { USERS, ADMINS, toUserDoc, toAdminDoc, userByKey, adminByKey } = require('./accounts');
const { ORDERS, PRODUCTION_STEPS } = require('./orders');
const { COUPONS, WARRANTIES, COIN_ACTIVITIES, NEWSLETTER, BROADCASTS, PERSONAL_NOTIFICATIONS } = require('./engagement');
const { CUSTOM_REQUESTS, COMMUNITY_POSTS, NEWS_COMMENTS, CHAT_SESSIONS, AI_CONVERSATIONS } = require('./content');
const { enrichProduct } = require('./product-content');

const {
  MOCK_ROOMS, MOCK_CUSTOM_REQUESTS, MOCK_COMMUNITY_POSTS, MOCK_NEWS_ARTICLES, MOCK_COUPONS,
} = require('../mock-data.generated');
const { DEV_MOCK_PRODUCTS } = require('../product-detail.generated');
const { EXTRA_PRODUCTS } = require('./products-extra');
const { FURNITURE_PRODUCTS } = require('./products-furniture');
const { CATALOG_PRODUCTS } = require('./products-catalog');
const DEFAULT_VIDEOS = require('../default-videos');

const { resolveUnitPrice, resolveShippingFee } = require('../../utils/pricing');
const { findCarrier, trackingUrlFor } = require('../../utils/shipping');

const DELIVERY_REWARD_RATE = 0.01; // khớp orderRoutes.js
const NEWSLETTER_REWARD = 10; // khớp newsletterRoutes.js
const COMMUNITY_POST_REWARD = 15; // khớp communityRoutes.js

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const addMs = (date, ms) => new Date(date.getTime() + ms);

function must(value, message) {
  if (value === undefined || value === null) throw new Error(`[mock] ${message}`);
  return value;
}

const productById = new Map(DEV_MOCK_PRODUCTS.map(p => [p.id, p]));
const couponByCode = new Map([...MOCK_COUPONS, ...COUPONS].map(c => [c.code, { active: true, ...c }]));
const articleIds = new Set(MOCK_NEWS_ARTICLES.map(a => a.id));
const user = key => must(userByKey[key], `Không có user "${key}" trong accounts.js`);
const adminId = key => String(must(adminByKey[key], `Không có admin "${key}"`)._id);
const product = id => must(productById.get(id), `Không có sản phẩm "${id}"`);

// ---------------- Đơn hàng ----------------
function pickCustomization(p, pick) {
  const config = must(p.customization, `Sản phẩm ${p.id} không hỗ trợ tùy biến`);
  const at = (list, i) => (list && list.length ? must(list[i ?? 0], `Option ${i} không có ở ${p.id}`) : null);
  return {
    color: at(config.colors, pick.color),
    material: at(config.materials, pick.material),
    size: at(config.sizes, pick.size),
    finish: at(config.finishes, pick.finish),
    ...(pick.text && config.textOption?.enabled ? { customText: pick.text } : {}),
    accessories: [],
  };
}

function shippingAddressFor(spec) {
  if (spec.guest) return spec.guest;
  const u = user(spec.user);
  const a = u.addresses.find(x => x.isDefault) || must(u.addresses[0], `User ${u.key} chưa có địa chỉ`);
  return { fullName: a.fullName, phone: a.phone, email: u.email, street: `${a.address}, ${a.ward}`, district: a.district, city: a.city, notes: '' };
}

function txnId(date, orderNumber) {
  const vn = new Date(date.getTime() + 7 * HOUR).toISOString();
  return `${vn.slice(2, 4)}${vn.slice(5, 7)}${vn.slice(8, 10)}_${orderNumber.slice(-6)}`;
}

function buildOrder(spec) {
  const createdAt = daysAgo(spec.days, ...(spec.at || [10, 0]));
  const items = spec.items.map(([productId, quantity, pick], i) => {
    const p = product(productId);
    const selectedCustomization = pick ? pickCustomization(p, pick) : null;
    // Giá lúc đặt: bỏ qua khung Flash Sale đang xoay theo ngày thực, lấy basePrice như lúc deal diễn ra.
    const unitPrice = resolveUnitPrice({ ...p, flashSaleSlot: null }, selectedCustomization);
    return { id: `ci-${i + 1}`, product: p, quantity, selectedCustomization, unitPrice, totalPrice: unitPrice * quantity };
  });

  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  let discount = 0;
  if (spec.coupon) {
    const c = must(couponByCode.get(spec.coupon), `Không có mã ${spec.coupon}`);
    if (!c.active || subtotal < c.minSpend) throw new Error(`[mock] Mã ${spec.coupon} không áp dụng được cho ${spec.no}`);
    discount = Math.min((subtotal * c.discountPercent) / 100, c.maxDiscount);
  }
  const shippingFee = resolveShippingFee(subtotal);
  const total = Math.max(0, subtotal - discount + shippingFee);
  const hasPOD = items.some(i => i.product.productionType === 'PRINT_ON_DEMAND');

  const order = {
    _id: oid(`order:${spec.no}`),
    orderNumber: spec.no,
    userId: spec.user ? user(spec.user)._id : null,
    createdAtLabel: viLabel(createdAt),
    status: spec.status,
    hasPrintOnDemandItems: hasPOD,
    productionProgress: null,
    items,
    shippingAddress: shippingAddressFor(spec),
    paymentMethod: spec.pay,
    paymentStatus: spec.paid ? 'PAID' : spec.failed ? 'FAILED' : 'UNPAID',
    subtotal, discount, shippingFee, total,
    notes: spec.notes || '',
    createdAt,
  };
  let last = createdAt;
  const staff = adminId('donhang');

  const online = spec.pay === 'MOMO' || spec.pay === 'ZALOPAY';
  if (online && (spec.paid || spec.failed)) order.paymentTransactionId = txnId(createdAt, spec.no);
  if (spec.pay === 'BANK_TRANSFER' && (spec.paid || spec.transferReported)) {
    order.transferReportedAt = addMs(createdAt, 20 * 60 * 1000);
    last = order.transferReportedAt;
  }

  const confirmed = spec.status !== 'PENDING' && !(spec.status === 'CANCELLED' && !spec.ship);
  if (spec.pay === 'COD' && confirmed) {
    order.phoneConfirmedAt = addMs(createdAt, 2 * HOUR);
    order.phoneConfirmedBy = staff;
    last = order.phoneConfirmedAt;
  }

  if (spec.ship) {
    const carrier = must(findCarrier(spec.ship.carrier), `Không có hãng ${spec.ship.carrier}`);
    const shippedAt = addMs(createdAt, (hasPOD ? 4 : 1) * DAY);
    order.shipment = {
      carrier: carrier.id, carrierName: carrier.name, trackingCode: spec.ship.code,
      trackingUrl: trackingUrlFor(carrier, spec.ship.code), fee: spec.ship.fee, note: '', shippedAt, createdBy: staff,
    };
    last = shippedAt;
    if (spec.status === 'DELIVERED') {
      order.deliveredAt = addMs(shippedAt, (carrier.scope === 'NATIONWIDE' ? 3 : 1) * DAY);
      if (spec.pay === 'COD') order.codCollectedAt = order.deliveredAt;
      last = order.deliveredAt;
    }
    if (spec.status === 'RETURNED') {
      order.returnReason = must(spec.returnReason, `${spec.no} thiếu returnReason`);
      order.returnedAt = addMs(shippedAt, 3 * DAY);
      last = order.returnedAt;
    }
  }

  if (spec.status === 'CANCELLED') {
    order.cancelReason = must(spec.cancelReason, `${spec.no} thiếu cancelReason`);
    order.cancelledAt = addMs(createdAt, spec.failed ? HOUR : DAY);
    last = order.cancelledAt;
  }

  if (spec.paid && !online) order.paidConfirmedBy = staff;

  if (hasPOD) {
    if (order.shipment) {
      order.productionProgress = { currentStep: 'DISPATCHED', percentage: 100, stepTitle: `Đã bàn giao ${order.shipment.carrierName}`, notes: 'Đã dán tem bảo hành Luméa', updatedAt: viLabel(order.shipment.shippedAt) };
    } else {
      const step = spec.status === 'IN_PRODUCTION' ? must(spec.step, `${spec.no} thiếu step`) : 'FILE_PREPARATION';
      const stepAt = spec.status === 'IN_PRODUCTION' ? addMs(createdAt, DAY) : createdAt;
      order.productionProgress = { currentStep: step, ...PRODUCTION_STEPS[step], updatedAt: viLabel(stepAt) };
      if (stepAt > last) last = stepAt;
    }
  }

  order.updatedAt = last;
  return order;
}

// ---------------- Bài cộng đồng / yêu cầu thiết kế ----------------
function relativeLabel(date) {
  const diffDays = Math.round((daysAgo(0, 23, 59) - date) / DAY);
  const hhmm = viLabel(date).split(' ')[1];
  if (diffDays <= 0) return `Hôm nay lúc ${hhmm}`;
  if (diffDays === 1) return `Hôm qua lúc ${hhmm}`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  return `${Math.floor(diffDays / 30)} tháng trước`;
}

function buildCommunityPost(spec) {
  const u = user(spec.user);
  const postedAt = daysAgo(spec.days, 20, 30);
  spec.productTags.forEach(t => product(t.productId));
  const comments = spec.comments.map((c, i) => {
    const author = user(c.author);
    return { id: `${spec.id}-c${i + 1}`, authorName: author.fullName.split(' ').slice(-2).join(' '), authorAvatar: author.avatar, text: c.text, createdAt: relativeLabel(daysAgo(c.days, 21, 0)) };
  });
  const status = spec.status || 'PUBLISHED';
  return {
    id: spec.id,
    userId: u._id,
    author: { id: String(u._id), name: u.fullName.split(' ').slice(-2).join(' '), avatar: u.avatar, handle: spec.handle, ...(spec.badge ? { badge: spec.badge } : {}) },
    title: spec.title, caption: spec.caption, imageUrl: spec.imageUrl, tags: spec.tags, productTags: spec.productTags,
    likesCount: spec.likesCount, commentsCount: comments.length, comments,
    createdAt: relativeLabel(postedAt), postedAt, status,
    moderationReason: spec.moderationReason || '',
    moderatedBy: spec.moderatedBy ? adminId(spec.moderatedBy) : null,
    moderatedAt: status === 'PUBLISHED' && !spec.isStaffPick ? null : daysAgo(spec.moderatedDaysAgo ?? spec.days - 1, 9, 0),
    isStaffPick: !!spec.isStaffPick,
  };
}

function buildCustomRequest(spec) {
  const u = spec.user ? user(spec.user) : null;
  const messages = spec.messages.map(({ at, ...m }) => ({ ...m, timestamp: viLabelPadded(at) }));
  const created = daysAgo(spec.days, 9, 0);
  const lastAt = spec.messages.reduce((max, m) => (m.at > max ? m.at : max), created);
  const { user: _u, days: _d, messages: _m, ...rest } = spec;
  return {
    userId: u?._id || null, customerName: u?.fullName, customerEmail: u?.email, customerPhone: u?.phoneNumber || '',
    customerImages: [], aiConceptImage: null, quotationPrice: null, estimatedDays: null, adminNote: '', preview3dModelType: null,
    ...rest,
    createdAt: viLabelPadded(created),
    updatedAt: viLabelPadded(lastAt),
    messages,
  };
}

// ---------------- Lắp ráp ----------------
async function buildAll() {
  const orders = ORDERS.map(buildOrder);
  const orderByNo = new Map(orders.map(o => [o.orderNumber, o]));
  const communityPosts = COMMUNITY_POSTS.map(buildCommunityPost);

  // Phiếu bảo hành — chỉ cho đơn đã giao.
  const warranties = WARRANTIES.map(w => {
    const o = must(orderByNo.get(w.order), `Bảo hành ${w.code}: không có đơn ${w.order}`);
    if (o.status !== 'DELIVERED') throw new Error(`[mock] Bảo hành ${w.code}: đơn ${w.order} chưa giao`);
    const item = must(o.items[w.item], `Bảo hành ${w.code}: đơn ${w.order} không có món #${w.item}`);
    const purchasedAt = o.deliveredAt;
    const expiresAt = new Date(purchasedAt);
    expiresAt.setMonth(expiresAt.getMonth() + w.months);
    const claimHistory = (w.claims || []).map(c => ({ _id: oid(`warranty-claim:${w.code}:${c.note}`), note: c.note, createdAt: daysAgo(c.daysAgo, 15, 0) }));
    const status = claimHistory.length ? 'CLAIMED' : expiresAt < daysAgo(0) ? 'EXPIRED' : 'ACTIVE';
    const lastClaim = claimHistory.length ? claimHistory[claimHistory.length - 1].createdAt : purchasedAt;
    return {
      warrantyCode: w.code, orderNumber: o.orderNumber, productName: item.product.name,
      customerName: o.shippingAddress.fullName, customerPhone: o.shippingAddress.phone,
      purchasedAt, warrantyMonths: w.months, status, claimHistory, createdAt: purchasedAt, updatedAt: lastClaim,
    };
  });

  // Giao dịch Xu: hoạt động độc lập + thưởng giao hàng + đăng ký bản tin + đăng bài cộng đồng.
  const coinSpecs = [
    ...COIN_ACTIVITIES,
    ...orders.filter(o => o.status === 'DELIVERED' && o.userId).map(o => ({
      userId: o.userId, reason: 'ORDER_DELIVERED', refId: o.orderNumber, amount: Math.round(o.total * DELIVERY_REWARD_RATE),
      note: `Nhận thưởng từ đơn hàng ${o.orderNumber} đã giao thành công`, at: o.deliveredAt,
    })),
    ...NEWSLETTER.filter(n => n.user).map(n => ({
      user: n.user, reason: 'NEWSLETTER_SUBSCRIBE', refId: 'newsletter-subscribe', amount: NEWSLETTER_REWARD,
      note: 'Đăng ký nhận bản tin Luméa', at: daysAgo(n.days, 20, 0),
    })),
    ...communityPosts.filter(p => p.status === 'PUBLISHED').map(p => ({
      userId: p.userId, reason: 'COMMUNITY_POST', refId: p.id, amount: COMMUNITY_POST_REWARD,
      note: 'Chia sẻ góc decor lên Cộng đồng Luméa', at: p.postedAt,
    })),
  ];
  const coinTransactions = coinSpecs.map(c => ({
    user: c.userId || user(c.user)._id, amount: c.amount, reason: c.reason, refId: c.refId, note: c.note, createdAt: c.at, updatedAt: c.at,
  }));
  const coinsByUser = new Map();
  for (const t of coinTransactions) coinsByUser.set(String(t.user), (coinsByUser.get(String(t.user)) || 0) + t.amount);

  // Thông báo: chung + riêng + theo trạng thái đơn của khách có tài khoản.
  const ORDER_NOTICE = {
    PENDING: o => ['Đặt hàng thành công', `Đơn ${o.orderNumber} đang chờ Luméa gọi điện xác nhận trước khi giao.`],
    CONFIRMED: o => ['Đơn hàng đã được xác nhận', `Đơn ${o.orderNumber} đã được xác nhận và đang chuẩn bị hàng.`],
    IN_PRODUCTION: o => ['Đơn hàng đang được sản xuất', `Đơn ${o.orderNumber}: ${o.productionProgress?.stepTitle || 'đang sản xuất'}.`],
    SHIPPED: o => ['Đơn hàng đang trên đường giao', `Đơn ${o.orderNumber} đã bàn giao ${o.shipment.carrierName}${o.shipment.trackingCode ? ` (mã ${o.shipment.trackingCode})` : ''}.`],
    DELIVERED: o => ['Giao hàng thành công', `Đơn ${o.orderNumber} đã giao thành công — bạn nhận được ${Math.round(o.total * DELIVERY_REWARD_RATE)} Xu thưởng.`],
    CANCELLED: o => ['Đơn hàng đã bị huỷ', `Đơn ${o.orderNumber} đã bị huỷ: ${o.cancelReason}`],
    RETURNED: o => ['Giao hàng không thành công', `Đơn ${o.orderNumber} đã hoàn về kho: ${o.returnReason}`],
  };
  const recent = daysAgo(7);
  const notifications = [
    ...BROADCASTS.map(b => ({ _id: oid(`notification:${b.key}`), userId: null, title: b.title, message: b.message, link: b.link, read: false, createdAt: daysAgo(b.days, 9, 0) })),
    ...PERSONAL_NOTIFICATIONS.map(n => {
      const visibleAt = n.visibleAt ? new Date(n.visibleAt) : null;
      return {
        _id: oid(`notification:${n.key}`), userId: String(user(n.user)._id), title: n.title, message: n.message, link: n.link,
        read: !!n.read, visibleAt, refKey: n.refKey || null, createdAt: visibleAt || daysAgo(n.days, 18, 0),
      };
    }),
    ...orders.filter(o => o.userId).map(o => {
      const [title, message] = ORDER_NOTICE[o.status](o);
      return {
        _id: oid(`notification:order:${o.orderNumber}`), userId: String(o.userId), title, message,
        link: `/orders/track?orderNumber=${o.orderNumber}`, read: o.updatedAt < recent, createdAt: o.updatedAt,
      };
    }),
  ].map(n => ({ visibleAt: null, refKey: null, ...n, updatedAt: n.createdAt }));

  const newsletterSubscribers = NEWSLETTER.map(n => ({
    email: n.email, userId: n.user ? user(n.user)._id : null, createdAt: daysAgo(n.days, 20, 0), updatedAt: daysAgo(n.days, 20, 0),
  }));

  const newsComments = NEWS_COMMENTS.map(c => {
    if (!articleIds.has(c.article)) throw new Error(`[mock] Ý kiến ${c.id}: không có bài ${c.article}`);
    const u = user(c.user);
    return { id: c.id, articleId: c.article, parentId: c.reply || null, userId: u._id, authorName: u.fullName, text: c.text, likesCount: c.likes, createdAt: daysAgo(c.days, 20, 15) };
  });
  const commentIds = new Set(newsComments.map(c => c.id));
  newsComments.forEach(c => { if (c.parentId && !commentIds.has(c.parentId)) throw new Error(`[mock] Ý kiến ${c.id}: không có ý kiến gốc ${c.parentId}`); });

  const chatMessages = CHAT_SESSIONS.flatMap(s => {
    const u = s.user ? user(s.user) : null;
    return s.lines.map(([sender, text, minutes], i) => {
      const at = addMs(daysAgo(s.days, 14, 0), minutes * 60 * 1000);
      const isCustomer = sender === 'customer';
      return {
        _id: oid(`chat:${s.session}:${i}`), sessionId: s.session, sender, text,
        userId: isCustomer && u ? String(u._id) : null,
        customerName: isCustomer && u ? u.fullName : null,
        customerPhone: isCustomer && u ? u.phoneNumber : null,
        staffId: isCustomer ? null : adminId(s.staff),
        readByStaff: isCustomer ? !!s.read : false,
        createdAt: at, updatedAt: at,
      };
    });
  });

  const aiConversations = AI_CONVERSATIONS.map(c => {
    const at = daysAgo(c.days, 21, 0);
    const messages = c.messages.map(({ suggestedProductIds, ...m }) => (suggestedProductIds ? {
      ...m,
      suggestedProducts: suggestedProductIds.map(id => {
        const p = product(id);
        return { id: p.id, name: p.name, slug: p.slug, image: p.images[0], price: p.basePrice, ...(p.originalPrice ? { originalPrice: p.originalPrice } : {}) };
      }),
    } : m));
    return { id: c.id, userId: user(c.user)._id, title: c.title, messages, brief: c.brief || null, conceptImage: c.conceptImage || null, createdAt: at, updatedAt: addMs(at, 10 * 60 * 1000) };
  });

  // Mật khẩu: băm 1 lần cho mỗi giá trị khác nhau.
  const hashes = new Map();
  const hash = async plain => {
    if (!hashes.has(plain)) hashes.set(plain, await bcrypt.hash(plain, 10));
    return hashes.get(plain);
  };
  const users = await Promise.all(USERS.map(async u => {
    const doc = toUserDoc(u);
    return { ...doc, password: doc.password ? await hash(doc.password) : null, coins: coinsByUser.get(String(u._id)) || 0 };
  }));
  const admins = await Promise.all(ADMINS.map(async a => ({ ...toAdminDoc(a), password: await hash(a.password) })));

  // Thứ tự = thứ tự seed: dữ liệu tham chiếu trước, dữ liệu phụ thuộc sau.
  // key: các trường xác định 1 bản ghi — đã tồn tại thì giữ nguyên, không ghi đè.
  return [
    // omitNull: unique index ở DB (sparse hay không) vẫn coi các giá trị null tường minh là trùng
    // nhau — bỏ hẳn field thay vì ghi null (chỉ 1 user mẫu không có SĐT).
    { model: 'User', key: ['_id'], docs: users, omitNull: ['phoneNumber', 'googleId', 'facebookId'] },
    { model: 'Admin', key: ['username'], docs: admins },
    { model: 'Product', key: ['id'], docs: [...DEV_MOCK_PRODUCTS, ...EXTRA_PRODUCTS, ...FURNITURE_PRODUCTS, ...CATALOG_PRODUCTS].map(enrichProduct) },
    { model: 'Room', key: ['id'], docs: MOCK_ROOMS },
    { model: 'Coupon', key: ['code'], docs: [...MOCK_COUPONS, ...COUPONS] },
    { model: 'NewsArticle', key: ['id'], docs: MOCK_NEWS_ARTICLES },
    { model: 'Video', key: ['youtubeId'], docs: DEFAULT_VIDEOS.map((v, i) => ({ id: `video-default-${i + 1}`, order: i + 1, ...v })) },
    { model: 'Order', key: ['orderNumber'], docs: orders },
    { model: 'Warranty', key: ['warrantyCode'], docs: warranties },
    { model: 'CoinTransaction', key: ['user', 'reason', 'refId'], docs: coinTransactions },
    { model: 'CustomRequest', key: ['id'], docs: [...MOCK_CUSTOM_REQUESTS, ...CUSTOM_REQUESTS.map(buildCustomRequest)] },
    { model: 'CommunityPost', key: ['id'], docs: [...MOCK_COMMUNITY_POSTS, ...communityPosts] },
    { model: 'NewsComment', key: ['id'], docs: newsComments },
    { model: 'NewsletterSubscriber', key: ['email'], docs: newsletterSubscribers },
    { model: 'Notification', key: ['_id'], docs: notifications },
    { model: 'ChatMessage', key: ['_id'], docs: chatMessages },
    { model: 'AiConversation', key: ['id'], docs: aiConversations },
  ];
}

module.exports = { buildAll };
