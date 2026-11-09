const express = require('express');
const { sendError } = require('../utils/http-error');
const { requirePermission } = require('../middleware/auth');
const { loadWorkshops } = require('../utils/workshops');
const { resolveAttachments } = require('../utils/documents');
const WorkshopContact = require('../models/WorkshopContact');
const Admin = require('../models/Admin');

// Nhật ký trao đổi với xưởng: xem theo xưởng, thêm 1 dòng sau mỗi lần liên hệ.
const router = express.Router();

const CHANNELS = ['PHONE', 'ZALO', 'EMAIL', 'MEETING', 'OTHER'];

router.get('/', requirePermission('inventory.view'), async (req, res) => {
  try {
    const filter = req.query.workshopId ? { workshopId: String(req.query.workshopId) } : {};
    const contacts = await WorkshopContact.find(filter).sort({ createdAt: -1 }).limit(300);
    res.json({ success: true, contacts });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', requirePermission('inventory.edit'), async (req, res) => {
  try {
    const workshop = (await loadWorkshops()).find(w => w.id === String(req.body.workshopId || ''));
    if (!workshop) return res.status(400).json({ success: false, error: 'Không tìm thấy xưởng' });
    const note = String(req.body.note || '').trim().slice(0, 1000);
    if (!note) return res.status(400).json({ success: false, error: 'Vui lòng ghi nội dung trao đổi' });
    const admin = await Admin.findById(req.adminId, { fullName: 1, username: 1 }).lean();
    const contact = await WorkshopContact.create({
      workshopId: workshop.id,
      channel: CHANNELS.includes(req.body.channel) ? req.body.channel : 'OTHER',
      note,
      attachments: await resolveAttachments(req.body.attachments),
      by: admin ? admin.fullName || admin.username : '',
    });
    res.json({ success: true, contact });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
