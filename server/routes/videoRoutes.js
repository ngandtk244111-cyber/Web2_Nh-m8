const express = require('express');
const Video = require('../models/Video');
const DEFAULT_VIDEOS = require('../seed/default-videos');
const { requireAdminId } = require('../middleware/auth');

const router = express.Router();

// Lần đầu chạy (collection rỗng) thì nạp bộ video mặc định, để trang chủ client không bị trống
// và admin có sẵn dữ liệu để sửa.
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  if ((await Video.estimatedDocumentCount()) === 0) {
    await Video.insertMany(DEFAULT_VIDEOS.map((v, i) => ({ ...v, id: `video-${Date.now()}-${i}`, order: i + 1 })));
  }
  seeded = true;
}

// Chấp nhận cả link YouTube đầy đủ lẫn ID trần: youtu.be/ID, watch?v=ID, shorts/ID, embed/ID.
function parseYoutubeId(input) {
  const raw = String(input || '').trim();
  const match = raw.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  if (match) return match[1];
  return /^[\w-]{11}$/.test(raw) ? raw : null;
}

function pickVideoFields(body) {
  const fields = {};
  for (const key of ['title', 'description', 'poster', 'link', 'ctaLabel', 'active', 'order']) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  return fields;
}

// Public — chỉ video đang bật, theo thứ tự hiển thị.
router.get('/', async (_req, res) => {
  try {
    await ensureSeeded();
    const videos = await Video.find({ active: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin — toàn bộ video, kể cả đang ẩn.
router.get('/admin', requireAdminId, async (_req, res) => {
  try {
    await ensureSeeded();
    const videos = await Video.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAdminId, async (req, res) => {
  try {
    const youtubeId = parseYoutubeId(req.body.youtubeId);
    if (!youtubeId) return res.status(400).json({ success: false, error: 'Link hoặc ID YouTube không hợp lệ' });
    if (!String(req.body.title || '').trim()) return res.status(400).json({ success: false, error: 'Thiếu tiêu đề video' });

    const last = await Video.findOne().sort({ order: -1 });
    const video = await Video.create({
      order: (last?.order || 0) + 1,
      ...pickVideoFields(req.body),
      youtubeId,
      id: 'video-' + Date.now(),
      createdBy: req.adminId,
    });
    res.json({ success: true, video });
  } catch (err) {
    console.error('create video error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAdminId, async (req, res) => {
  try {
    const update = pickVideoFields(req.body);
    if (req.body.youtubeId !== undefined) {
      const youtubeId = parseYoutubeId(req.body.youtubeId);
      if (!youtubeId) return res.status(400).json({ success: false, error: 'Link hoặc ID YouTube không hợp lệ' });
      update.youtubeId = youtubeId;
    }
    const video = await Video.findOneAndUpdate({ id: req.params.id }, update, { new: true });
    if (!video) return res.status(404).json({ success: false, error: 'Không tìm thấy video' });
    res.json({ success: true, video });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAdminId, async (req, res) => {
  try {
    await Video.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
