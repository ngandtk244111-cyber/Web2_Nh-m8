const express = require('express');
const bcrypt = require('bcryptjs');
const { sendError } = require('../utils/http-error');
const { writeAudit } = require('../utils/audit');
const { requireAdminId, requirePermission, validId } = require('../middleware/auth');
const { ROLES, SUPER_ADMIN_NAME, getAdminAccess, getPermissionMatrix, allows } = require('../utils/permissions');
const { removeUnusedProductImages } = require('../utils/images');
const { DEFAULT_WORKSHOPS } = require('../utils/workshops');
const { validateBankConfig, getReceivingBank } = require('../utils/payment-config');
const Admin = require('../models/Admin');
const AdminConfig = require('../models/AdminConfig');
const AuditLog = require('../models/AuditLog');

const router = express.Router();
router.use(requireAdminId);

// Khóa cấu hình my-admin được phép lưu; `value` phải đúng kiểu để tab đọc lại không bị lỗi.
const CONFIG_KEYS = {
  categories: 'array',
  suppliers: 'array',
  workshops: 'array',
  banners: 'array',
  settings: 'object',
  permissions: 'object',
};
// Quyền đọc/ghi từng khóa cấu hình. Bảng quyền chỉ Super Admin được ghi — xem PUT /config/:key.
const CONFIG_ACCESS = {
  categories: { read: 'products.view', write: 'products.edit' },
  suppliers: { read: 'inventory.view', write: 'inventory.edit' },
  workshops: { read: 'inventory.view', write: 'inventory.edit' },
  banners: { read: 'marketing.view', write: 'marketing.edit' },
  settings: { read: 'settings.view', write: 'settings.edit' },
  permissions: { read: 'staff.view', write: null },
};
const AUDIT_LEVELS = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'];
const MIN_PASSWORD_LENGTH = 8;

async function actorAccess(req) {
  const actor = await Admin.findById(req.adminId);
  return { actor, ...(await getAdminAccess(actor)) };
}

/** Vai trò hợp lệ để gán; chỉ Super Admin được gán vai trò Super Admin. */
function roleAssignError(role, isSuperAdmin) {
  if (!ROLES.some(r => r.name === role)) return 'Vui lòng chọn vai trò hợp lệ';
  if (role === SUPER_ADMIN_NAME && !isSuperAdmin) return 'Chỉ Super Admin được gán vai trò Super Admin';
  return null;
}

function matchesConfigType(key, value) {
  if (CONFIG_KEYS[key] === 'array') return Array.isArray(value);
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

router.get('/config', async (req, res) => {
  try {
    const { permissions } = await actorAccess(req);
    const readable = Object.keys(CONFIG_KEYS).filter(key => allows(permissions, CONFIG_ACCESS[key].read));
    const docs = await AdminConfig.find({ key: { $in: readable } }, { key: 1, value: 1 }).lean();
    const config = Object.fromEntries(docs.map(d => [d.key, d.value]));
    if (readable.includes('permissions')) config.permissions = await getPermissionMatrix();
    // Chưa lưu danh sách xưởng lần nào -> trả danh sách mặc định (nguồn duy nhất ở utils/workshops.js).
    if (readable.includes('workshops') && !config.workshops) config.workshops = DEFAULT_WORKSHOPS;
    res.json({ success: true, config });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!Object.hasOwn(CONFIG_KEYS, key)) return res.status(404).json({ success: false, error: 'Không có cấu hình này' });
    const { permissions, isSuperAdmin } = await actorAccess(req);
    const { write } = CONFIG_ACCESS[key];
    if (write ? !allows(permissions, write) : !isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này' });
    }
    if (!matchesConfigType(key, req.body.value)) return res.status(400).json({ success: false, error: 'Dữ liệu cấu hình không hợp lệ' });
    const previous = await AdminConfig.findOneAndUpdate(
      { key },
      { $set: { value: req.body.value, updatedBy: req.adminId } },
      { upsert: true }
    ).lean();
    if (key === 'banners') await removeUnusedProductImages((previous?.value || []).map(b => b.imageUrl));
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// Tài khoản ngân hàng nhận cọc: tách khỏi /config để chỉ quyền payments.config được sửa và mọi
// thay đổi đều ghi nhật ký kèm giá trị cũ / mới. Đơn đã tạo giữ bản chụp riêng (paymentPlan.bank).
router.get('/payment-config', requirePermission('payments.view', 'payments.config'), async (_req, res) => {
  try {
    const doc = await AdminConfig.findOne({ key: 'payment' }, { value: 1 }).lean();
    const { bank } = validateBankConfig(doc?.value?.bank || null);
    res.json({ success: true, bank: bank || null, usingEnvFallback: !bank && !!(await getReceivingBank()) });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/payment-config', requirePermission('payments.config'), async (req, res) => {
  try {
    const { bank, error } = validateBankConfig(req.body?.bank);
    if (error) return res.status(400).json({ success: false, error });
    const previous = await AdminConfig.findOneAndUpdate(
      { key: 'payment' },
      { $set: { 'value.bank': bank, updatedBy: req.adminId } },
      { upsert: true }
    ).lean();
    const before = previous?.value?.bank;
    const fmt = (b) => (b ? `${b.bankName} (${b.bankCode}) - ${b.accountNumber} - ${b.accountName}` : '(chưa có)');
    const actor = await Admin.findById(req.adminId);
    await writeAudit(req, actor, {
      module: 'Thanh Toán', action: 'Sửa tài khoản nhận tiền', detail: `Cũ: ${fmt(before)} → Mới: ${fmt(bank)}`, level: 'WARNING',
    });
    res.json({ success: true, bank });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/audit', requirePermission('settings.view'), async (_req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, logs });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/audit', async (req, res) => {
  try {
    const module = String(req.body.module || '').trim().slice(0, 80);
    const action = String(req.body.action || '').trim().slice(0, 160);
    if (!module || !action) return res.status(400).json({ success: false, error: 'Thiếu nội dung nhật ký' });
    const level = AUDIT_LEVELS.includes(req.body.level) ? req.body.level : 'INFO';
    const admin = await Admin.findById(req.adminId);
    const log = await writeAudit(req, admin, { module, action, detail: String(req.body.detail || '').slice(0, 500), level });
    res.json({ success: true, log });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/staff', requirePermission('staff.view'), async (_req, res) => {
  try {
    const staff = await Admin.find().sort({ createdAt: 1 });
    res.json({ success: true, staff });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/staff', requirePermission('staff.create'), async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const fullName = String(req.body.fullName || '').trim();
    const password = String(req.body.password || '');
    if (!username || !fullName) return res.status(400).json({ success: false, error: 'Vui lòng nhập họ tên và tên đăng nhập' });
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    const pick = (f) => String(req.body[f] || '').trim();
    const { actor, isSuperAdmin } = await actorAccess(req);
    const roleError = roleAssignError(pick('role'), isSuperAdmin);
    if (roleError) return res.status(400).json({ success: false, error: roleError });
    const staff = await Admin.create({
      username,
      fullName,
      password: await bcrypt.hash(password, 10),
      code: pick('code'),
      email: pick('email'),
      phone: pick('phone'),
      department: pick('department'),
      role: pick('role'),
    });
    await writeAudit(req, actor, { module: 'Nhân Sự', action: 'Thêm nhân viên mới', detail: `${fullName} (${username})`, level: 'SUCCESS' });
    res.json({ success: true, staff });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/staff/:id/role', requirePermission('staff.edit'), async (req, res) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
    // Không tự đổi vai trò: chặn tự nâng quyền và tránh hệ thống mất Super Admin cuối cùng.
    if (id === req.adminId) return res.status(400).json({ success: false, error: 'Không thể tự đổi vai trò của mình' });
    const role = String(req.body.role || '').trim();
    const { actor, isSuperAdmin } = await actorAccess(req);
    const roleError = roleAssignError(role, isSuperAdmin);
    if (roleError) return res.status(400).json({ success: false, error: roleError });
    const target = await Admin.findById(id);
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
    if (target.role === SUPER_ADMIN_NAME && !isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Chỉ Super Admin được đổi vai trò của Super Admin' });
    }
    const previous = target.role || 'Chưa có vai trò';
    target.role = role;
    await target.save();
    await writeAudit(req, actor, { module: 'Nhân Sự', action: 'Đổi vai trò nhân viên', detail: `${target.username}: ${previous} -> ${role}`, level: 'WARNING' });
    res.json({ success: true, staff: target });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/staff/:id/active', requirePermission('staff.edit'), async (req, res) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
    const active = !!req.body.active;
    if (!active && id === req.adminId) {
      return res.status(400).json({ success: false, error: 'Không thể tự khóa tài khoản đang đăng nhập' });
    }
    const { actor, isSuperAdmin } = await actorAccess(req);
    const target = await Admin.findById(id, { role: 1 }).lean();
    if (target?.role === SUPER_ADMIN_NAME && !isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Chỉ Super Admin được khóa hoặc mở khóa Super Admin' });
    }
    const staff = await Admin.findByIdAndUpdate(id, { active }, { new: true });
    if (!staff) return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
    await writeAudit(req, actor, { module: 'Nhân Sự', action: active ? 'Mở khóa nhân viên' : 'Khóa nhân viên', detail: staff.username, level: 'WARNING' });
    res.json({ success: true, staff });
  } catch (err) {
    sendError(res, err);
  }
});

// Xoá hẳn tài khoản nhân viên (nghỉ việc, tạo nhầm). Nhật ký hoạt động giữ nguyên tên người đã thao tác.
// Không tự xoá mình; chỉ Super Admin xoá được Super Admin và luôn còn ít nhất 1 Super Admin.
router.delete('/staff/:id', requirePermission('staff.delete'), async (req, res) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
    if (id === req.adminId) return res.status(400).json({ success: false, error: 'Không thể tự xoá tài khoản đang đăng nhập' });
    const { actor, isSuperAdmin } = await actorAccess(req);
    const target = await Admin.findById(id, { role: 1, username: 1, fullName: 1 }).lean();
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy nhân viên' });
    if (target.role === SUPER_ADMIN_NAME) {
      if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Chỉ Super Admin được xoá Super Admin' });
      if ((await Admin.countDocuments({ role: SUPER_ADMIN_NAME })) <= 1) {
        return res.status(400).json({ success: false, error: 'Không thể xoá Super Admin cuối cùng' });
      }
    }
    await Admin.deleteOne({ _id: id });
    await writeAudit(req, actor, { module: 'Nhân Sự', action: 'Xoá tài khoản nhân viên', detail: `${target.username}${target.fullName ? ' (' + target.fullName + ')' : ''}`, level: 'WARNING' });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
