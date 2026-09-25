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
  returnReason?: string;
  /** Vận đơn do shop tạo với hãng vận chuyển (có khi đơn đã giao cho vận chuyển). */
  shipment?: {
    carrierName: string;
    trackingCode: string;
    trackingUrl: string;
    shippedAt: string | null;
  } | null;
}
