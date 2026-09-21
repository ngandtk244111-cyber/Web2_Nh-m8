const express = require('express');
const NewsArticle = require('../models/NewsArticle');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const articles = await NewsArticle.find().sort({ _id: -1 });
    res.json({ success: true, articles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const article = await NewsArticle.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { viewsCount: 1 } },
      { new: true }
    );
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, article });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const article = await NewsArticle.create({
      ...req.body,
      id: 'news-' + Date.now(),
      viewsCount: 1,
      publishedAt: new Date().toLocaleDateString('vi-VN'),
    });
    res.json({ success: true, article });
  } catch (err) {
    console.error('create news article error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const article = await NewsArticle.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!article) return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    res.json({ success: true, article });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await NewsArticle.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
