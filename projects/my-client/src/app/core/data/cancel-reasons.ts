/**
 * Lý do khách chọn khi tự huỷ đơn (giống Shopee). Server kiểm tra lại đúng danh sách này —
 * sửa ở đây thì sửa cả CUSTOMER_CANCEL_REASONS trong server/routes/orderRoutes.js.
 */
export const CANCEL_REASONS: string[] = [
  'Tôi muốn cập nhật địa chỉ/số điện thoại nhận hàng',
  'Tôi muốn thêm/thay đổi mã giảm giá',
  'Tôi muốn thay đổi sản phẩm (màu sắc, kích thước, số lượng...)',
  'Thủ tục thanh toán quá rắc rối',
  'Tôi tìm thấy chỗ mua khác tốt hơn (rẻ hơn, uy tín hơn, giao nhanh hơn...)',
  'Thời gian giao hàng quá lâu',
  'Tôi đặt nhầm / đặt trùng đơn',
  'Tôi không có nhu cầu mua nữa',
  'Tôi không tìm thấy lý do huỷ phù hợp',
];

/** Lý do cho phép ghi thêm chi tiết. */
export const CANCEL_REASON_OTHER = 'Tôi không tìm thấy lý do huỷ phù hợp';
