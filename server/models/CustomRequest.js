const mongoose = require('mongoose');

const customRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  requestCode: { type: String, required: true, unique: true },
  createdAt: { type: String, default: '' },
  updatedAt: { type: String, default: '' },
  title: { type: String, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, default: '' },
  status: {
    type: String,
    enum: ['PENDING_REVIEW', 'QUOTED', 'IN_DISCUSSION', 'PREVIEW_READY', 'APPROVED', 'CONVERTED_TO_ORDER', 'REJECTED'],
    default: 'PENDING_REVIEW',
  },
  brief: { type: mongoose.Schema.Types.Mixed, required: true },
  customerImages: { type: [String], default: [] },
  aiConceptImage: { type: String, default: null },
  quotationPrice: { type: Number, default: null },
  estimatedDays: { type: Number, default: null },
  adminNote: { type: String, default: '' },
  preview3dModelType: { type: String, default: null },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
});

module.exports = mongoose.model('CustomRequest', customRequestSchema);
