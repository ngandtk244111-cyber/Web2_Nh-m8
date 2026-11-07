import { CartItem } from './cart.model';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'; // giao thất bại / khách không nhận — hàng hoàn về kho

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

/** Yêu cầu trả hàng / hoàn tiền khách gửi sau khi nhận hàng. */
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

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  /** Chuỗi ngày giờ đã định dạng tiếng Việt do backend trả về (vd: "18/09/2026 20:38"). */
  createdAtLabel?: string;
  status: OrderStatus;
  hasPrintOnDemandItems: boolean;
  productionProgress?: ProductionProgress;
  /** Xưởng làm các món in 3D / thiết kế riêng — ghi khi đơn vào "Đang sản xuất". */
  productionWorkshops?: { workshopId: string | null; workshopName: string; items: string[] }[];
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'VNPAY';
  paymentStatus: 'PAID' | 'UNPAID' | 'FAILED' | 'REFUNDED';
  /** Hoàn tiền khi đơn đã trả trước bị huỷ. */
  refund?: OrderRefund | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  notes?: string;
  /** Khách đã bấm "Tôi đã chuyển khoản" — cần nhân viên đối soát rồi xác nhận PAID. */
  transferReportedAt?: string | null;
  cancelReason?: string;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  userId?: string | null;
  /** Nhân viên đã gọi xác nhận đơn với khách (bắt buộc trước khi giao đơn COD). */
  phoneConfirmedAt?: string | null;
  /** false = đơn COD nhỏ dưới ngưỡng trong Cài đặt, giao không cần gọi. Đơn cũ không có trường này = phải gọi. */
  phoneConfirmRequired?: boolean;
  /** Shipper đã thu tiền COD — còn chờ đối soát với hãng vận chuyển. */
  codCollectedAt?: string | null;
  returnReason?: string;
  returnedAt?: string | null;
  shipment?: Shipment | null;
  returnRequest?: ReturnRequest | null;
}

export interface OrderRefund {
  /** PENDING: chờ hoàn · COMPLETED: đã hoàn · VOID: không cần hoàn (tiền chưa về tài khoản shop). */
  status: 'PENDING' | 'COMPLETED' | 'VOID';
  amount: number;
  channel: string;
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
  requestedAt: string;
  dueAt: string | null;
  completedAt?: string | null;
  transactionRef?: string;
  adminNote?: string;
}

export interface Shipment {
  carrier: string;
  carrierName: string;
  trackingCode: string;
  trackingUrl: string;
  fee: number;
  note: string;
  shippedAt: string | null;
}

/** Hãng vận chuyển kèm đánh giá có phù hợp với đơn không (server tính theo cân nặng/kích thước/địa chỉ). */
export interface CarrierOption {
  id: string;
  name: string;
  scope: 'LOCAL' | 'NATIONWIDE';
  description: string;
  suitable: boolean;
  reason: string;
}

export interface ShippingOptions {
  bulky: boolean;
  bulkyItems: string[];
  totalKg: number;
  local: boolean;
  devMode: boolean;
  carriers: CarrierOption[];
}
