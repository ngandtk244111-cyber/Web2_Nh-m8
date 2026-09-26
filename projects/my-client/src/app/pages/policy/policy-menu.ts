export interface PolicyMenuItem {
  slug: string;
  label: string;
  icon: string;
}

export interface PolicyMenuGroup {
  title: string;
  items: PolicyMenuItem[];
}

/** Menu tổng của khu vực Hỗ trợ & Chính sách (/chinh-sach/:slug). */
export const POLICY_MENU: PolicyMenuGroup[] = [
  {
    title: 'Hỗ trợ khách hàng',
    items: [
      { slug: 'faq', label: 'Câu hỏi thường gặp', icon: 'message' },
      { slug: 'lien-he', label: 'Liên hệ', icon: 'send' },
    ],
  },
  {
    title: 'Chính sách mua hàng',
    items: [
      { slug: 'giao-hang', label: 'Chính sách giao hàng', icon: 'truck' },
      { slug: 'doi-tra', label: 'Chính sách đổi trả', icon: 'rotate' },
      { slug: 'bao-hanh', label: 'Chính sách bảo hành', icon: 'shield' },
      { slug: 'thanh-toan', label: 'Phương thức thanh toán', icon: 'credit-card' },
    ],
  },
  {
    title: 'Điều khoản & Quyền riêng tư',
    items: [
      { slug: 'bao-mat', label: 'Chính sách bảo mật', icon: 'lock' },
      { slug: 'dieu-khoan', label: 'Điều khoản sử dụng', icon: 'bookmark' },
      { slug: 'cookie', label: 'Chính sách cookie', icon: 'sliders' },
    ],
  },
];
