import { CustomRequestStatus } from '../../core/models/custom-request.model';

export const REQUEST_STATUS_LABELS: Record<CustomRequestStatus, string> = {
  PENDING_REVIEW: 'Chờ xem xét',
  QUOTED: 'Đã báo giá',
  IN_DISCUSSION: 'Đang trao đổi',
  PREVIEW_READY: 'Đã cấp 3D preview',
  APPROVED: 'Khách đã duyệt',
  CONVERTED_TO_ORDER: 'Đã thành đơn hàng',
  REJECTED: 'Đã huỷ',
};

const REQUEST_STATUS_CLASSES: Record<CustomRequestStatus, string> = {
  PENDING_REVIEW: 'status-yellow',
  QUOTED: 'status-blue',
  IN_DISCUSSION: 'status-purple',
  PREVIEW_READY: 'status-purple',
  APPROVED: 'status-green',
  CONVERTED_TO_ORDER: 'status-green',
  REJECTED: 'status-gray',
};

export function requestStatusLabel(s: CustomRequestStatus): string {
  return REQUEST_STATUS_LABELS[s] || s;
}

export function requestStatusClass(s: CustomRequestStatus): string {
  return REQUEST_STATUS_CLASSES[s] || 'status-gray';
}

/** Thứ tự các bước để vẽ dòng thời gian trên trang chi tiết. */
export const REQUEST_FLOW: CustomRequestStatus[] = ['PENDING_REVIEW', 'QUOTED', 'PREVIEW_READY', 'APPROVED', 'CONVERTED_TO_ORDER'];
