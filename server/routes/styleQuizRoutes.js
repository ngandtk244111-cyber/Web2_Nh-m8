const express = require('express');
const { sendError } = require('../utils/http-error');
const QuizQuestion = require('../models/QuizQuestion');
const QuizResult = require('../models/QuizResult');
const { QUESTIONS, RESULTS } = require('../seed/default-style-quiz');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();
const { STYLE_TAGS } = QuizQuestion;
const RESULT_LIST_FIELDS = ['traits', 'tips', 'avoid', 'productStyles', 'comboCategories'];

// Lần đầu chạy (collection rỗng) thì nạp bộ câu hỏi/kết quả mặc định — như videoRoutes.
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  if ((await QuizQuestion.estimatedDocumentCount()) === 0) await QuizQuestion.insertMany(QUESTIONS);
  for (const result of RESULTS) {
    await QuizResult.updateOne({ tag: result.tag }, { $setOnInsert: result }, { upsert: true });
    // Bản ghi tạo trước khi có các trường mới -> chỉ bổ sung trường còn thiếu, không đè nội dung admin đã sửa.
    for (const field of RESULT_LIST_FIELDS) {
      await QuizResult.updateOne({ tag: result.tag, [field]: { $exists: false } }, { $set: { [field]: result[field] } });
    }
  }
  seeded = true;
}

const sortQuestions = (a, b) => a.order - b.order || a.id - b.id;

/** Chuẩn hoá câu hỏi từ body; trả về { data } hoặc { error }. */
function readQuestion(body) {
  const text = String(body.text || '').trim();
  if (!text) return { error: 'Vui lòng nhập nội dung câu hỏi' };
  const raw = Array.isArray(body.options) ? body.options : [];
  const options = raw
    .map((o, i) => ({ id: 'abcdef'[i], label: String(o?.label || '').trim(), tag: o?.tag }))
    .filter(o => o.label);
  if (options.length < 2 || options.length > 6) return { error: 'Mỗi câu cần từ 2 đến 6 lựa chọn có nội dung' };
  if (options.some(o => !STYLE_TAGS.includes(o.tag))) return { error: 'Mỗi lựa chọn phải gắn với một phong cách' };
  const data = { text, options };
  if (body.active !== undefined) data.active = !!body.active;
  if (body.order !== undefined) data.order = Number(body.order) || 0;
  return { data };
}

// Public — câu hỏi đang bật (đúng thứ tự) + 4 kết quả.
router.get('/', async (_req, res) => {
  try {
    await ensureSeeded();
    const [questions, results] = await Promise.all([
      QuizQuestion.find({ active: true }).lean(),
      QuizResult.find().lean(),
    ]);
    res.json({ success: true, questions: questions.sort(sortQuestions), results });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin — toàn bộ câu hỏi, kể cả đang ẩn.
router.get('/admin', requirePermission('content.view'), async (_req, res) => {
  try {
    await ensureSeeded();
    const [questions, results] = await Promise.all([QuizQuestion.find().lean(), QuizResult.find().lean()]);
    res.json({ success: true, questions: questions.sort(sortQuestions), results });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/questions', requirePermission('content.create'), async (req, res) => {
  try {
    const { data, error } = readQuestion(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const last = await QuizQuestion.findOne().sort({ id: -1 }).lean();
    const lastOrder = await QuizQuestion.findOne().sort({ order: -1 }).lean();
    const question = await QuizQuestion.create({
      order: (lastOrder?.order || 0) + 1,
      ...data,
      id: (last?.id || 0) + 1,
    });
    res.json({ success: true, question });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/questions/:id', requirePermission('content.edit'), async (req, res) => {
  try {
    // Chỉ đổi thứ tự / bật-tắt thì không cần gửi lại nội dung câu hỏi.
    const partial = req.body.text === undefined && req.body.options === undefined;
    let update;
    if (partial) {
      update = {};
      if (req.body.active !== undefined) update.active = !!req.body.active;
      if (req.body.order !== undefined) update.order = Number(req.body.order) || 0;
    } else {
      const { data, error } = readQuestion(req.body);
      if (error) return res.status(400).json({ success: false, error });
      update = data;
    }
    const question = await QuizQuestion.findOneAndUpdate({ id: Number(req.params.id) }, update, { new: true });
    if (!question) return res.status(404).json({ success: false, error: 'Không tìm thấy câu hỏi' });
    res.json({ success: true, question });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/questions/:id', requirePermission('content.delete'), async (req, res) => {
  try {
    await QuizQuestion.deleteOne({ id: Number(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/results/:tag', requirePermission('content.edit'), async (req, res) => {
  try {
    if (!STYLE_TAGS.includes(req.params.tag)) return res.status(404).json({ success: false, error: 'Không có phong cách này' });
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ success: false, error: 'Vui lòng nhập tên phong cách' });
    const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean);
    const paletteHex = list(req.body.paletteHex);
    if (paletteHex.some(h => !/^#[0-9a-f]{6}$/i.test(h))) {
      return res.status(400).json({ success: false, error: 'Mã màu phải có dạng #RRGGBB' });
    }
    const update = {
      title,
      description: String(req.body.description || '').trim(),
      image: String(req.body.image || '').trim(),
      suggestedCategories: list(req.body.suggestedCategories),
      paletteHex,
    };
    // Danh sách dạng nhiều dòng (đặc điểm, bí quyết...): nhận mảng hoặc chuỗi xuống dòng.
    const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => String(x).trim()).filter(Boolean);
    for (const field of RESULT_LIST_FIELDS) {
      if (req.body[field] !== undefined) update[field] = field === 'productStyles' || field === 'comboCategories' ? list(req.body[field]) : lines(req.body[field]);
    }
    const result = await QuizResult.findOneAndUpdate({ tag: req.params.tag }, update, { new: true, upsert: true });
    res.json({ success: true, result });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
