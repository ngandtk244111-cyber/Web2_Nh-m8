const express = require('express');
const { sendError } = require('../utils/http-error');
const AdminConfig = require('../models/AdminConfig');

// Các vị trí cố định my-client đang hiển thị; my-admin chỉ lưu phần đã sửa, còn lại client dùng nội dung gốc.
const SLOT_IDS = [
  'popup-home',
  'hero-room-3d', 'hero-print-3d', 'hero-freeship', 'hero-ai-assistant', 'hero-deal-today',
  'promo-xa-kho', 'promo-deal-thang', 'promo-phong-3d',
  'side-left', 'side-right',
  'grid-room', 'grid-member', 'grid-wide',
  'brand-flash-sale', 'brand-room-3d', 'brand-print-3d', 'brand-ai', 'brand-freeship',
  'flash-sale-hero', 'coordinate-banner',
];
const TEXT_FIELDS = ['title', 'subtitle', 'eyebrow', 'ctaText', 'code', 'line1', 'line2', 'tickerLabel'];
const POPUP_ID = 'popup-home';
const LEGACY_POPUP_POSITION = 'POPUP_HOME';

/** Bản lưu trước khi có vị trí cố định: popup mang id riêng, nhận theo `position`. */
function findLegacyPopup(entries) {
  return entries
    .filter(b => b.position === LEGACY_POPUP_POSITION)
    .sort((a, b) => Number(!!b.active) - Number(!!a.active) || (a.order || 0) - (b.order || 0))[0];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function toPublicBanner(entry) {
  const banner = {};
  for (const field of TEXT_FIELDS) {
    if (isNonEmptyString(entry[field])) banner[field] = entry[field];
  }
  if (isNonEmptyString(entry.imageUrl)) banner.imageUrl = entry.imageUrl;
  // Link điều hướng trong app nên chỉ nhận đường dẫn nội bộ.
  if (/^\/(?!\/)/.test(entry.ctaLink || '')) banner.ctaLink = entry.ctaLink;
  if (/^https?:\/\//.test(entry.videoUrl || '')) banner.videoUrl = entry.videoUrl;
  if (entry.active === false) banner.active = false;
  return banner;
}

const router = express.Router();

// Công khai cho my-client, chỉ trả các vị trí và trường được phép — /api/admin/config còn chứa cài đặt và phân quyền.
router.get('/', async (_req, res) => {
  try {
    const doc = await AdminConfig.findOne({ key: 'banners' }, { value: 1 }).lean();
    const entries = Array.isArray(doc?.value) ? doc.value : [];
    const banners = {};
    for (const entry of entries) {
      if (SLOT_IDS.includes(entry.id)) banners[entry.id] = toPublicBanner(entry);
    }
    if (!banners[POPUP_ID]) {
      const legacy = findLegacyPopup(entries);
      if (legacy) banners[POPUP_ID] = toPublicBanner(legacy);
    }
    res.json({ success: true, banners });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
