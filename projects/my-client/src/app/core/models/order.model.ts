import { CartItem } from './cart.model';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'; // giao thất bại / không nhận hàng

export type ProductionStep =
  | 'FILE_PREPARATION' // Kiểm tra thiết kế & Slicing
  | '3D_PRINTING'      // Đang in 3D
  | 'POST_PROCESSING'  // Xử lý bề mặt, gỡ support, chà nhám, sấy
  | 'ASSEMBLY_TESTING' // Lắp ráp linh kiện/đèn, kiểm tra chất lượng
  | 'PACKAGING'        // Đóng gói chống va đập
  | 'DISPATCHED';      // Bàn giao đơn vị vận chuyển

export interface ProductionProgress {
  currentStep: ProductionStep;
  percentage: number;
  stepTitle: string;
  notes: string;
  updatedAt: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email: string;
  street: string;
  district: string;
  city: string;
  notes?: string;
}

/** Yêu cầu trả hàng / hoàn tiền sau khi nhận hàng. */
export type ReturnStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
export interface ReturnRequest {
  status: ReturnStatus;
  reason: string;
  description?: string;
  refundAmount: number;
  adminNote?: string;
  requestedAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  rejectedAt?: string | null;
}

/** Lý do trả hàng — trùng danh sách RETURN_REASONS ở server/routes/orderRoutes.js. */
export const RETURN_REASONS = [
  'Sản phẩm bị lỗi, hư hỏng',
  'Giao sai mẫu / sai màu / sai kích thước',
  'Thiếu sản phẩm hoặc phụ kiện',
  'Sản phẩm khác với mô tả',
  'Khác',
];
/** Số ngày được gửi yêu cầu trả hàng kể từ khi nhận hàng. */
export const RETURN_WINDOW_DAYS = 7;

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  /** Chuỗi ngày giờ đã định dạng tiếng Việt do backend trả về (vd: "18/09/2026 20:38"). */
  createdAtLabel?: string;
  status: OrderStatus;
  hasPrintOnDemandItems: boolean;
  productionProgress?: ProductionProgress;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'VNPAY' | 'ATM';
  paymentStatus: 'PAID' | 'UNPAID' | 'FAILED';
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  notes?: string;
  cancelReason?: string;
  /** Tài khoản đặt đơn (null nếu khách vãng lai). */
  userId?: string | null;
  returnReason?: string;
  deliveredAt?: string | null;
  updatedAt?: string;
  /** Yêu cầu trả hàng / hoàn tiền của khách (null nếu chưa có). */
  returnRequest?: ReturnRequest | null;
  /** Vận đơn do shop tạo với hãng vận chuyển (có khi đơn đã giao cho vận chuyển). */
  shipment?: {
    carrierName: string;
    trackingCode: string;
    trackingUrl: string;
    shippedAt: string | null;
  } | null;
}
