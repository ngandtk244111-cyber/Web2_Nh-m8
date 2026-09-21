const mongoose = require('mongoose');

const newsArticleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String, default: '' },
  content: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  videoUrl: { type: String, default: null },
  category: { type: String, required: true },
  readTime: { type: String, default: '' },
  publishedAt: { type: String, default: '' },
  author: { type: mongoose.Schema.Types.Mixed, required: true },
  featured: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  taggedProductIds: { type: [String], default: [] },
  viewsCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('NewsArticle', newsArticleSchema);
