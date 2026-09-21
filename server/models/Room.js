const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  theme: { type: String, default: '' },
  tagline: { type: String, default: '' },
  description: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  cameraInitial: { type: mongoose.Schema.Types.Mixed, required: true },
  cameraLookAt: { type: [Number], default: undefined },
  walkthroughMode: { type: Boolean, default: false },
  freeExploreMode: { type: Boolean, default: false },
  roomType: { type: String, enum: ['minimal_study', 'cozy_bedroom', 'glb_scene'], required: true },
  modelUrl: { type: String, default: null },
  modelFocusBounds: { type: mongoose.Schema.Types.Mixed, default: null },
  hotspots: { type: [mongoose.Schema.Types.Mixed], default: [] },
  totalLookPrice: { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
