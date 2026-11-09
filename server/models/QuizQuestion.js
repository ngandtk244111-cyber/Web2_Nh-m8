const mongoose = require('mongoose');

const STYLE_TAGS = ['minimalist', 'scandinavian', 'industrial', 'bohemian'];

// Câu hỏi của trang Trắc nghiệm phong cách (my-client /style-quiz). Nhân viên sửa ở my-admin;
// mỗi lựa chọn cộng 1 điểm cho 1 phong cách, phong cách nhiều điểm nhất là kết quả.
const optionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  tag: { type: String, enum: STYLE_TAGS, required: true },
}, { _id: false });

const quizQuestionSchema = new mongoose.Schema({
  // Số nguyên vì đáp án của khách được lưu theo id câu hỏi (Record<number, tag>) ở client.
  id: { type: Number, required: true, unique: true },
  text: { type: String, required: true },
  options: { type: [optionSchema], default: [] },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const QuizQuestion = mongoose.model('QuizQuestion', quizQuestionSchema);
QuizQuestion.STYLE_TAGS = STYLE_TAGS;

module.exports = QuizQuestion;
