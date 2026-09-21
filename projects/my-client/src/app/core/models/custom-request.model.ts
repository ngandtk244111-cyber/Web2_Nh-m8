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
}
