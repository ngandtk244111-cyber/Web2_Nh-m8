const express = require('express');
const Room = require('../models/Room');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: 1 });
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const id = req.body.id || 'room-' + Date.now();
    const room = await Room.create({ ...req.body, id });
    res.json({ success: true, room });
  } catch (err) {
    console.error('create room error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const room = await Room.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!room) return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Room.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
