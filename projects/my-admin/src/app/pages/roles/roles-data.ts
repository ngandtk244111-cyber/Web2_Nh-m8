/** Vai trò cố định — id/tên khớp ROLES ở server/utils/permissions.js. */
export interface AdminRole {
  id: string;
  name: string;
  desc: string;
}

export const SUPER_ADMIN_ROLE_ID = 'r-1';
export const SUPER_ADMIN_NAME = 'Super Admin';

export const ADMIN_ROLES: AdminRole[] = [
  { id: 'r-1', name: 'Super Admin', desc: 'Toàn quyền truy cập và kiểm soát mọi phân hệ trên hệ thống' },
  { id: 'r-2', name: 'Store Manager', desc: 'Quản lý toàn diện kinh doanh, đơn hàng, khách hàng và doanh thu' },
  { id: 'r-3', name: '3D Specialist', desc: 'Chuyên trách duyệt bản vẽ 3D, báo giá in ấn và theo dõi máy in' },
  { id: 'r-4', name: 'Warehouse Lead', desc: 'Quản lý nhập xuất tồn kho, nguyên vật liệu và điều chuyển hàng' },
  { id: 'r-5', name: 'Customer Care', desc: 'Tiếp nhận đơn, chat với khách hàng, phản hồi đánh giá và giải đáp' },
  { id: 'r-6', name: 'Content Editor', desc: 'Quản lý banner, bài viết cẩm nang và kiểm duyệt cộng đồng Decor' },
];

export const PERMISSION_MODULES: { key: string; name: string }[] = [
  { key: 'products', name: 'Sản phẩm & Danh mục' },
  { key: 'orders', name: 'Đơn hàng & Doanh thu' },
  { key: 'custom3d', name: 'Yêu cầu in 3D & Báo giá' },
  { key: 'inventory', name: 'Kho hàng & Nhà cung cấp' },
  { key: 'customers', name: 'Khách hàng & Đánh giá' },
  { key: 'marketing', name: 'Khuyến mãi & Banner' },
  { key: 'content', name: 'Cộng đồng & Bài viết' },
  { key: 'staff', name: 'Nhân sự & Phân quyền' },
  { key: 'settings', name: 'Cài đặt hệ thống & Audit' },
];

export type PermissionKey = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export const PERMISSION_KEYS: { key: PermissionKey; label: string }[] = [
  { key: 'view', label: 'Xem' },
  { key: 'create', label: 'Tạo' },
  { key: 'edit', label: 'Sửa' },
  { key: 'delete', label: 'Xoá' },
  { key: 'approve', label: 'Duyệt' },
];

export type PermissionMatrix = Record<string, Record<string, Record<PermissionKey, boolean>>>;

/** Nhân viên dạng dòng bảng (map từ tài khoản Admin của server). */
export interface StaffRow {
  id: string;
  code: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  status: 'ACTIVE' | 'LOCKED';
  joinedDate: string;
}

export function toStaffRow(a: any): StaffRow {
  return {
    id: a._id,
    code: a.code || '',
    name: a.fullName || a.username,
    username: a.username,
    email: a.email || '',
    phone: a.phone || '',
    department: a.department || '',
    role: a.role || '',
    status: a.active ? 'ACTIVE' : 'LOCKED',
    joinedDate: a.createdAt ? new Date(a.createdAt).toLocaleDateString('vi-VN') : '',
  };
}
