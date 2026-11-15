export interface DesignBrief {
  productType: string;
  theme: string;
  style: string;
  color: string;
  size: string;
  usage: string;
  customText?: string;
  estimatedBudget?: string;
  notes?: string;
}

export type CustomRequestStatus =
  | 'PENDING_REVIEW'   // Shop đang tiếp nhận và xem xét
  | 'QUOTED'           // Shop đã báo giá
  | 'IN_DISCUSSION'    // Đang trao đổi làm rõ chi tiết
  | 'PREVIEW_READY'    // Đã có 3D/ảnh preview mô phỏng để duyệt
  | 'APPROVED'         // Khách đã duyệt thiết kế
  | 'CONVERTED_TO_ORDER' // Đã chuyển thành đơn hàng chính thức
  | 'REJECTED';        // Hủy yêu cầu

export interface RequestChatMessage {
  id: string;
  sender: 'CUSTOMER' | 'SHOP_SPECIALIST' | 'AI_ASSISTANT';
  senderName: string;
  avatar: string;
  text: string;
  timestamp: string;
  attachments?: string[];
}

export interface CustomRequest {
  id: string;
  requestCode: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status: CustomRequestStatus;
  brief: DesignBrief;
  customerImages: string[];
  aiConceptImage?: string;
  quotationPrice?: number;
  estimatedDays?: number;
  adminNote?: string;
  preview3dModelType?: 'moon_lamp' | 'geometric_vase' | 'abstract_sculpture' | 'desk_organizer';
  messages: RequestChatMessage[];
  /** Phiên bản báo giá đang gửi khách và đơn đã tạo từ báo giá. */
  currentQuoteVersion?: number | null;
  orderNumber?: string | null;
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';

export interface QuoteItem {
  name: string;
  description?: string;
  material?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal?: number;
}

/** Báo giá có phiên bản (server tính tổng / tiền cọc, chụp chính sách cọc lúc gửi khách). */
export interface Quote {
  _id: string;
  version: number;
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  itemDiscountTotal: number;
  quoteDiscount: number;
  total: number;
  estimatedDays: number;
  note?: string;
  depositOverride?: { amount: number; reason: string } | null;
  deposit: { amount: number; remaining: number; rate: number; minimum: number; overridden: boolean; overrideReason?: string } | null;
  issuedAt: string | null;
  validUntil: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string;
  createdByName?: string;
  sentByName?: string;
  createdAt?: string;
}

export interface DepositPolicy {
  defaultDepositRate: number;
  minimumDepositAmount: number;
  quoteValidityDays: number;
  depositPaymentDeadlineHours: number;
  allowDepositOverride: boolean;
}

/** Dữ liệu nhân viên nhập cho 1 bản nháp báo giá (tổng tiền server tự tính). */
export interface QuoteInput {
  items: QuoteItem[];
  quoteDiscount: number;
  estimatedDays: number;
  note: string;
  depositOverride: { amount: number; reason: string } | null;
}
