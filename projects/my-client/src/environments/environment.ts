export const environment = {
  apiUrl: 'http://localhost:4300/api',
  socketUrl: 'http://localhost:4300',
  /** URL của app quản trị (my-admin) — my-admin giờ là project Angular riêng, chạy port khác. */
  adminAppUrl: 'http://localhost:4201',
  /** TẠM THỜI: true = dùng mock sản phẩm (core/data/product-detail.mock.ts) thay vì gọi API. Đổi về false khi đã có data MongoDB. */
  useMockProducts: true,
  /** OAuth Client ID (Web application) tạo ở Google Cloud Console — không phải secret, an toàn để lộ ở FE. */
  googleClientId: '410709001290-tjl42cc04v60n9jab92mg4giq7r9etbr.apps.googleusercontent.com',
};
