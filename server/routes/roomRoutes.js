const express = require('express');
const { sendError } = require('../utils/http-error');
const Room = require('../models/Room');
const { requireAdminId } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: 1 });
    res.json({ success: true, rooms });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', requireAdminId, async (req, res) => {
  try {
    const id = req.body.id || 'room-' + Date.now();
    const room = await Room.create({ ...req.body, id });
    res.json({ success: true, room });
  } catch (err) {
    console.error('create room error', err);
    sendError(res, err);
  }
});

router.put('/:id', requireAdminId, async (req, res) => {
  try {
    const room = await Room.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!room) return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
    res.json({ success: true, room });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/:id', requireAdminId, async (req, res) => {
  try {
    await Room.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
