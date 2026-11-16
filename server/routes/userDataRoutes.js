const express = require('express');
const { sendError } = require('../utils/http-error');
const Product = require('../models/Product');
const UserData = require('../models/UserData');
const CommunityPost = require('../models/CommunityPost');
const NewsComment = require('../models/NewsComment');
const { requireUserId } = require('../middleware/auth');

const router = express.Router();

const LIMITS = { cart: 100, favorites: 500, recentlyViewed: 8, savedCoupons: 50 };

function isCustomProductId(id) {
  return String(id).startsWith('custom-');
}

function cleanIds(value, limit) {
  return Array.isArray(value)
    ? [...new Set(value.filter(id => typeof id === 'string' && id))].slice(0, limit)
    : [];
}

// Client gửi CartItem đầy đủ; chỉ lưu khoá tham chiếu, sản phẩm thường lấy lại từ DB lúc đọc.
function toStoredCartItem(item) {
  const productId = item?.product?.id;
  return {
    id: item?.id,
    productId,
    customProduct: isCustomProductId(productId) ? item.product : null,
    quantity: item?.quantity,
    selectedCustomization: item?.selectedCustomization ?? null,
    unitPrice: item?.unitPrice,
    totalPrice: item?.totalPrice,
  };
}

async function toCartItems(stored) {
  const ids = stored.filter(i => !i.customProduct).map(i => i.productId);
  const products = await Product.find({ id: { $in: ids } }).select('-reviews').lean();
  const byId = new Map(products.map(p => [p.id, p]));
  return stored.flatMap(({ productId, customProduct, ...item }) => {
    const product = customProduct || byId.get(productId);
    // Sản phẩm đã bị gỡ khỏi shop thì tự rơi khỏi giỏ.
    return product ? [{ ...item, product: { reviews: [], ...product }, selectedCustomization: item.selectedCustomization ?? undefined }] : [];
  });
}

router.get('/', requireUserId, async (req, res) => {
  try {
    const data = await UserData.findOne({ user: req.userId }).lean();
    res.json({
      success: true,
      data: {
        cart: await toCartItems(data?.cart || []),
        favorites: data?.favorites || [],
        communitySaved: data?.communitySaved || [],
        chatLastReadAt: data?.chatLastReadAt || null,
        quizResult: data?.quizResult || null,
        recentlyViewed: data?.recentlyViewed || [],
        savedCoupons: data?.savedCoupons || [],
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhập trạng thái cũ từ trình duyệt một lần; không cộng lại các lượt thích đã được đếm trước đây.
router.post('/import-social', requireUserId, async (req, res) => {
  try {
    const liked = cleanIds(req.body.communityLiked, 2000), news = cleanIds(req.body.newsLiked, 2000);
    await Promise.all([
      CommunityPost.updateMany({ id: { $in: liked } }, { $addToSet: { likedBy: req.userId } }),
      NewsComment.updateMany({ id: { $in: news } }, { $addToSet: { likedBy: req.userId } }),
      UserData.findOneAndUpdate({ user: req.userId }, { $addToSet: { communitySaved: { $each: cleanIds(req.body.communitySaved, 2000) } } }, { upsert: true, setDefaultsOnInsert: true }),
    ]);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

// Ghi đè đúng các phần client gửi lên, phần khác giữ nguyên.
router.put('/', requireUserId, async (req, res) => {
  try {
    const { cart, favorites, recentlyViewed, savedCoupons } = req.body;
    const update = {};
    if (req.body.quizResult !== undefined) {
      const state = req.body.quizResult;
      update.quizResult = state === null ? null : {
        answers: Object.fromEntries(Object.entries(state.answers || {}).filter(([id, tag]) => /^\d+$/.test(id) && ['minimalist', 'scandinavian', 'industrial', 'bohemian'].includes(tag)).slice(0, 100)),
        attemptId: typeof state.attemptId === 'string' ? state.attemptId.slice(0, 100) : null,
        coinClaimed: state.coinClaimed === true,
      };
    }
    if (Array.isArray(cart)) update.cart = cart.slice(0, LIMITS.cart).map(toStoredCartItem);
    if (favorites) update.favorites = cleanIds(favorites, LIMITS.favorites);
    if (recentlyViewed) update.recentlyViewed = cleanIds(recentlyViewed, LIMITS.recentlyViewed);
    if (Array.isArray(savedCoupons)) update.savedCoupons = savedCoupons.slice(0, LIMITS.savedCoupons);

    await UserData.findOneAndUpdate({ user: req.userId }, { $set: update }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
