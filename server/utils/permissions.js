const Admin = require('../models/Admin');
const AdminConfig = require('../models/AdminConfig');

// Vai trò cố định của my-admin. Nhân viên lưu theo `name`, bảng quyền lưu theo `id`.
const ROLES = [
  { id: 'r-1', name: 'Super Admin' },
  { id: 'r-2', name: 'Store Manager' },
  { id: 'r-3', name: '3D Specialist' },
  { id: 'r-4', name: 'Warehouse Lead' },
  { id: 'r-5', name: 'Customer Care' },
  { id: 'r-6', name: 'Content Editor' },
];
const SUPER_ADMIN_ID = 'r-1';
const SUPER_ADMIN_NAME = 'Super Admin';
const MODULES = ['products', 'orders', 'custom3d', 'inventory', 'customers', 'marketing', 'content', 'staff', 'settings', 'payments'];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'];
// Phân hệ có bộ hành động riêng. payments.config = sửa tài khoản ngân hàng nhận tiền — tách khỏi
// settings.edit; mặc định chỉ Super Admin có, vai trò khác chỉ có khi Super Admin cấp.
const MODULE_ACTIONS = { payments: ['view', 'config'] };
const actionsFor = (module) => MODULE_ACTIONS[module] || ACTIONS;

/** Viết gọn từng dòng quyền: 'vced' = view, create, edit, delete; 'a' = approve. */
function perms(letters) {
  return { view: letters.includes('v'), create: letters.includes('c'), edit: letters.includes('e'), delete: letters.includes('d'), approve: letters.includes('a') };
}

// Mặc định khi Super Admin chưa chỉnh gì; bản đã lưu ở AdminConfig (khóa `permissions`) được ưu tiên.
const DEFAULT_MATRIX = {
  'r-2': {
    products: perms('vcea'), orders: perms('vcea'), custom3d: perms('vcea'), inventory: perms('vcea'), customers: perms('vcea'),
    marketing: perms('vcea'), content: perms('vcea'), staff: perms('v'), settings: perms('v'),
  },
  'r-3': { products: perms('vce'), orders: perms('vea'), custom3d: perms('vcea'), inventory: perms('v'), customers: perms('v') },
  'r-4': { products: perms('ve'), orders: perms('v'), inventory: perms('vcea') },
  'r-5': { orders: perms('ve'), custom3d: perms('ve'), customers: perms('vcea') },
  'r-6': { products: perms('v'), marketing: perms('vce'), content: perms('vcdea') },
};

function superAdminPermissions() {
  return Object.fromEntries(MODULES.map(m => [m, Object.fromEntries(actionsFor(m).map(a => [a, true]))]));
}

/** Bảng quyền đầy đủ của mọi vai trò. Super Admin luôn toàn quyền để không ai khóa được hệ thống. */
async function getPermissionMatrix() {
  const doc = await AdminConfig.findOne({ key: 'permissions' }, { value: 1 }).lean();
  const stored = doc?.value || {};
  const matrix = { [SUPER_ADMIN_ID]: superAdminPermissions() };
  for (const { id } of ROLES.filter(r => r.id !== SUPER_ADMIN_ID)) {
    matrix[id] = Object.fromEntries(MODULES.map(m => [
      m,
      Object.fromEntries(actionsFor(m).map(a => [a, !!(stored[id]?.[m]?.[a] ?? DEFAULT_MATRIX[id]?.[m]?.[a])])),
    ]));
  }
  return matrix;
}

/** Quyền của 1 nhân viên theo `role`. Không có vai trò hoặc vai trò lạ thì không có quyền gì. */
async function getAdminAccess(admin) {
  const role = ROLES.find(r => r.name === admin?.role);
  const matrix = role ? await getPermissionMatrix() : null;
  return {
    isSuperAdmin: role?.id === SUPER_ADMIN_ID,
    permissions: role ? matrix[role.id] : {},
  };
}

function allows(permissions, rule) {
  const [module, action] = rule.split('.');
  return !!permissions[module]?.[action];
}

/** Đúng nếu nhân viên có ít nhất 1 trong các quyền `rules` (dạng 'products.edit'). */
async function adminHasPermission(adminId, ...rules) {
  const admin = await Admin.findById(adminId, { role: 1 }).lean();
  const { permissions } = await getAdminAccess(admin);
  return rules.some(rule => allows(permissions, rule));
}

/**
 * Tài khoản tạo trước khi có phân quyền chưa có vai trò. Nếu chưa có Super Admin nào đang hoạt động,
 * gán cho tài khoản quản trị gốc của seed (cùng biến ADMIN_DEFAULT_USERNAME) để chủ hệ thống không bị
 * khóa; các tài khoản còn lại do Super Admin gán ở tab Nhân viên. Không suy đoán theo thứ tự tạo vì
 * tài khoản nhân viên mẫu có thể cũ hơn tài khoản gốc.
 */
async function ensureSuperAdmin() {
  if (await Admin.exists({ role: SUPER_ADMIN_NAME, active: true })) return;
  const username = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const owner = await Admin.findOne({ username, active: true, role: { $in: ['', null] } });
  if (!owner) {
    console.warn(`[auth] Chưa có Super Admin và không tìm thấy tài khoản "${username}" chưa có vai trò để gán — cần gán thủ công trong DB.`);
    return;
  }
  owner.role = SUPER_ADMIN_NAME;
  await owner.save();
  console.log(`[auth] Đã gán Super Admin cho tài khoản ${owner.username}.`);
}

module.exports = { ROLES, SUPER_ADMIN_NAME, getPermissionMatrix, getAdminAccess, allows, adminHasPermission, ensureSuperAdmin };
