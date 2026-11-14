/** Menu sidebar: mỗi mục là 1 route riêng, quyền xem khớp server/utils/permissions.js. */
export interface AdminNavItem {
  path: string;
  label: string;
  icon: string;
  /** Quyền cần có để thấy mục và vào route (dạng 'orders.view'); bỏ trống = ai cũng vào được. */
  perm?: string;
}

export interface AdminNavGroup {
  key: string;
  label: string;
  icon: string;
  items: AdminNavItem[];
}

export const DASHBOARD_NAV: AdminNavItem = { path: 'dashboard', label: 'Tổng quan', icon: 'bi-grid-1x2' };

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'orders', label: 'Đơn hàng', icon: 'bi-receipt',
    items: [
      { path: 'orders', label: 'Danh sách đơn hàng', icon: 'bi-receipt', perm: 'orders.view' },
      { path: 'custom-requests', label: 'Yêu cầu in 3D', icon: 'bi-printer', perm: 'custom3d.view' },
      { path: 'returns', label: 'Đổi trả & hoàn tiền', icon: 'bi-arrow-counterclockwise', perm: 'orders.view' },
      { path: 'warranty', label: 'Bảo hành', icon: 'bi-shield-check', perm: 'orders.view' },
    ],
  },
  {
    key: 'catalog', label: 'Sản phẩm & kho', icon: 'bi-box-seam',
    items: [
      { path: 'products', label: 'Sản phẩm', icon: 'bi-box-seam', perm: 'products.view' },
      { path: 'categories', label: 'Danh mục', icon: 'bi-tags', perm: 'products.view' },
      { path: 'inventory', label: 'Tồn kho', icon: 'bi-archive', perm: 'inventory.view' },
      { path: 'workshops', label: 'Xưởng sản xuất', icon: 'bi-buildings', perm: 'inventory.view' },    ],
  },
  {
    key: 'customers', label: 'Khách hàng', icon: 'bi-people',
    items: [
      { path: 'customers', label: 'Danh sách khách hàng', icon: 'bi-people', perm: 'customers.view' },
      { path: 'messages', label: 'Tin nhắn hỗ trợ', icon: 'bi-chat-dots', perm: 'customers.view' },
      { path: 'reviews', label: 'Đánh giá', icon: 'bi-star', perm: 'customers.view' },
    ],
  },
  {
    key: 'marketing', label: 'Marketing & nội dung', icon: 'bi-megaphone',
    items: [
      { path: 'promotions', label: 'Khuyến mãi', icon: 'bi-ticket-perforated', perm: 'marketing.view' },
      { path: 'banners', label: 'Banner trang chủ', icon: 'bi-image', perm: 'marketing.view' },
      { path: 'articles', label: 'Tin tức', icon: 'bi-newspaper', perm: 'content.view' },
      { path: 'videos', label: 'Video', icon: 'bi-play-btn', perm: 'content.view' },
      { path: 'style-quiz', label: 'Trắc nghiệm phong cách', icon: 'bi-ui-checks', perm: 'content.view' },
      { path: 'community', label: 'Cộng đồng', icon: 'bi-camera', perm: 'content.view' },
      { path: 'rooms', label: 'Phòng mẫu 3D', icon: 'bi-house-door', perm: 'content.view' },
    ],
  },
  {
    key: 'system', label: 'Hệ thống', icon: 'bi-gear',
    items: [
      { path: 'staff', label: 'Nhân viên', icon: 'bi-person-badge', perm: 'staff.view' },
      { path: 'roles', label: 'Phân quyền', icon: 'bi-shield-lock', perm: 'staff.view' },
      { path: 'settings', label: 'Cài đặt', icon: 'bi-sliders', perm: 'settings.view' },
      { path: 'audit-log', label: 'Nhật ký hoạt động', icon: 'bi-journal-text', perm: 'settings.view' },
    ],
  },
];
