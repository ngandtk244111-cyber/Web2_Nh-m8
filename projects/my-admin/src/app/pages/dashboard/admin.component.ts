import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { RoomService } from '../../core/services/room.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { Product, ProductionType, ProductCategory } from '../../core/models/product.model';
import { Order, ProductionStep, OrderStatus } from '../../core/models/order.model';
import { CustomRequest, CustomRequestStatus } from '../../core/models/custom-request.model';
import { Room } from '../../core/models/room.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { LumeaMapComponent } from '../../components/lumea-map/lumea-map.component';
import { environment } from '../../../environments/environment';

export type AdminTab =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'suppliers'
  | 'orders'
  | 'custom-requests'
  | 'customers'
  | 'reviews'
  | 'promotions'
  | 'banners'
  | 'community'
  | 'articles'
  | 'staff'
  | 'roles'
  | 'settings'
  | 'audit-log'
  | 'rooms';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe, LumeaMapComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  readonly clientAppUrl = environment.clientAppUrl;

  activeTab: AdminTab = 'dashboard';
  globalSearch = '';
  readonly today = new Date();

  // Sidebar thu gọn (chỉ hiện icon) — pattern tham khảo từ my-admin-vita
  isSidebarCollapsed = false;

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  // Nhóm (breadcrumb), tiêu đề & mô tả của page header theo tab đang mở
  readonly tabMeta: Record<AdminTab, { group: string; title: string; subtitle: string }> = {
    'dashboard': { group: 'Tổng quan', title: 'Tổng quan hoạt động', subtitle: 'Doanh thu, đơn hàng và tình trạng xưởng in 3D hôm nay' },
    'products': { group: 'Thương mại & kho', title: 'Sản phẩm', subtitle: 'Quản lý danh mục sản phẩm có sẵn và tuỳ biến in 3D' },
    'categories': { group: 'Thương mại & kho', title: 'Danh mục', subtitle: 'Cấu trúc nhóm sản phẩm hiển thị trên cửa hàng' },
    'inventory': { group: 'Thương mại & kho', title: 'Kho hàng & tồn kho', subtitle: 'Theo dõi số lượng, ngưỡng an toàn và điều chỉnh kho' },
    'suppliers': { group: 'Thương mại & kho', title: 'Nhà cung cấp & xưởng chế tác', subtitle: 'Đối tác vật tư, filament và gia công' },
    'orders': { group: 'Vận hành & sản xuất', title: 'Đơn hàng', subtitle: 'Tiến độ xử lý, sản xuất và giao hàng' },
    'custom-requests': { group: 'Vận hành & sản xuất', title: 'Yêu cầu in 3D riêng', subtitle: 'Brief thiết kế từ khách hàng chờ duyệt & báo giá' },
    'customers': { group: 'Khách hàng & CSKH', title: 'Khách hàng', subtitle: 'Hồ sơ, lịch sử mua và hạng thành viên' },
    'reviews': { group: 'Khách hàng & CSKH', title: 'Đánh giá', subtitle: 'Phản hồi của khách hàng về sản phẩm' },
    'promotions': { group: 'Khách hàng & CSKH', title: 'Khuyến mãi & voucher', subtitle: 'Mã giảm giá và chương trình ưu đãi' },
    'banners': { group: 'Nội dung & truyền thông', title: 'Banner & Hero', subtitle: 'Nội dung trình bày trên trang chủ cửa hàng' },
    'community': { group: 'Nội dung & truyền thông', title: 'Decor Community', subtitle: 'Bài đăng và không gian do khách hàng chia sẻ' },
    'articles': { group: 'Nội dung & truyền thông', title: 'Bài viết', subtitle: 'Cẩm nang phong cách và nội dung editorial' },
    'staff': { group: 'Hệ thống & nhân sự', title: 'Nhân viên', subtitle: 'Tài khoản nội bộ và trạng thái hoạt động' },
    'roles': { group: 'Hệ thống & nhân sự', title: 'Vai trò & phân quyền', subtitle: 'Kiểm soát quyền truy cập theo vai trò' },
    'settings': { group: 'Hệ thống & nhân sự', title: 'Cài đặt hệ thống', subtitle: 'Cấu hình chung của Luméa' },
    'audit-log': { group: 'Hệ thống & nhân sự', title: 'Audit Log', subtitle: 'Nhật ký hoạt động và sự kiện bảo mật' },
    'rooms': { group: 'Nội dung & truyền thông', title: 'Phòng mẫu', subtitle: 'Không gian trưng bày 3D' },
  };

  // Toast Notification state
  toastMessage: string | null = null;
  toastType: 'success' | 'info' | 'warning' | 'error' = 'success';
  private toastTimeout: any;

  // Profile Popover & Password Modal
  showProfileMenu = false;
  showChangePasswordModal = false;
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  twoFactorEnabled = true;

  // 1. Dashboard State
  totalRevenue = 0;
  podOrdersCount = 0;
  pendingRequestsCount = 0;
  customizableProductsCount = 0;
  weeklySales = [
    { day: 'T2', amount: 2450000, orders: 4, height: '45%' },
    { day: 'T3', amount: 3820000, orders: 7, height: '65%' },
    { day: 'T4', amount: 3100000, orders: 5, height: '55%' },
    { day: 'T5', amount: 5600000, orders: 9, height: '85%' },
    { day: 'T6', amount: 6450000, orders: 12, height: '95%' },
    { day: 'T7', amount: 4900000, orders: 8, height: '78%' },
    { day: 'CN', amount: 4200000, orders: 6, height: '70%' },
  ];

  // 2. Products State
  products: Product[] = [];
  productSubTab: 'all' | 'ready' | 'customizable' = 'all';
  productSearch = '';
  productCategoryFilter = 'ALL';
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '',
    slug: '',
    category: 'lamp' as ProductCategory,
    categoryName: 'Đèn Bàn & Đèn Ngủ',
    categoryGroup: 'FURNITURE' as 'FURNITURE' | 'DECOR',
    productionType: 'READY_STOCK' as ProductionType,
    customizable: false,
    basePrice: 0,
    originalPrice: 0,
    inStock: 50,
    dimensions: '',
    materialInfo: '',
    description: '',
    story: '',
    badge: '',
    image1: '',
    image2: '',
    threeModelType: '',
  };

  // 3. Categories State
  categories = [
    { id: 'cat-1', name: 'Đèn Bàn & Đèn Ngủ', slug: 'lamp', group: 'FURNITURE', icon: 'sparkles', productCount: 14, active: true, desc: 'Đèn ngủ mặt trăng, đèn decor ambient in 3D' },
    { id: 'cat-2', name: 'Bàn Ghế & Tủ Kệ', slug: 'furniture-chair', group: 'FURNITURE', icon: 'box', productCount: 18, active: true, desc: 'Bàn trà tối giản, ghế thư giãn phong cách Scandinavian' },
    { id: 'cat-3', name: 'Bình Hoa & Chậu Cây 3D', slug: 'vase-planter', group: 'DECOR', icon: 'layers', productCount: 26, active: true, desc: 'Bình hoa hình học xoắn ốc, chậu cây tự tưới PLA' },
    { id: 'cat-4', name: 'Phụ Kiện Bàn Làm Việc', slug: 'desk-organizer', group: 'DECOR', icon: 'archive', productCount: 19, active: true, desc: 'Khay bút, giá đỡ điện thoại/laptop công thái học' },
    { id: 'cat-5', name: 'Tranh & Phù Điêu Treo Tường', slug: 'wall-art', group: 'DECOR', icon: 'image', productCount: 11, active: true, desc: 'Tranh phù điêu 3D vân sóng, nghệ thuật parametric' },
    { id: 'cat-6', name: 'Đồng Hồ & Nghệ Thuật Decor', slug: 'art-clock', group: 'DECOR', icon: 'clock', productCount: 8, active: true, desc: 'Đồng hồ cát in 3D, tượng decor trừu tượng' },
  ];
  showCategoryModal = false;
  editingCategory: any = null;
  categoryForm = { name: '', slug: '', group: 'DECOR', icon: 'box', desc: '', active: true };

  // 4. Inventory State
  inventorySearch = '';
  inventoryFilter = 'ALL';
  inventoryItems = [
    { id: 'inv-1', sku: 'LM-MOON-01', name: 'Đèn Ngủ Mặt Trăng Moon Lamp 3D', category: 'lamp', currentStock: 42, minThreshold: 15, soldCount: 128, location: 'Kệ A2-04', status: 'SAFE' },
    { id: 'inv-2', sku: 'LM-VASE-02', name: 'Bình Hoa Gốm Gợn Sóng Wave Vase', category: 'vase-planter', currentStock: 4, minThreshold: 10, soldCount: 95, location: 'Kệ B1-12', status: 'LOW' },
    { id: 'inv-3', sku: 'LM-STAND-03', name: 'Đế Đèn Gỗ Tần Bì Ash Wood Stand', category: 'lamp', currentStock: 0, minThreshold: 20, soldCount: 160, location: 'Kệ A1-02', status: 'OUT' },
    { id: 'inv-4', sku: 'LM-FIL-PLA01', name: 'Cuộn Nhựa PLA Matte Trắng Kem (1kg)', category: 'material', currentStock: 65, minThreshold: 20, soldCount: 310, location: 'Kho Vật Liệu C1', status: 'SAFE' },
    { id: 'inv-5', sku: 'LM-FIL-WOOD', name: 'Cuộn Nhựa Wood Composite Hạt Gỗ', category: 'material', currentStock: 8, minThreshold: 15, soldCount: 84, location: 'Kho Vật Liệu C2', status: 'LOW' },
    { id: 'inv-6', sku: 'LM-DESK-06', name: 'Khay Bút Công Thái Học Origami', category: 'desk-organizer', currentStock: 28, minThreshold: 10, soldCount: 62, location: 'Kệ B3-05', status: 'SAFE' },
    { id: 'inv-7', sku: 'LM-PLANTER-07', name: 'Chậu Cây Tự Hút Nước Hexagon', category: 'vase-planter', currentStock: 3, minThreshold: 8, soldCount: 78, location: 'Kệ B2-08', status: 'LOW' },
  ];
  showStockModal = false;
  selectedStockItem: any = null;
  stockAdjustQty = 10;
  stockAdjustReason = 'Nhập lô hàng định kỳ từ nhà sản xuất';

  // 5. Suppliers State
  suppliers = [
    { id: 'sup-1', code: 'NCC-BAMBU', name: 'Công Ty CP Vật Liệu 3D Tech Bambu', contact: 'Nguyễn Văn Hùng', phone: '0912 345 678', email: 'hung.nguyen@bambumaterials.vn', address: 'KCN Cao Quận 9, TP.HCM', category: 'Cuộn sợi PLA, PETG, Resin in 3D', rating: 4.9, active: true },
    { id: 'sup-2', code: 'NCC-BATTRANG', name: 'Xưởng Gốm Thủ Công Bát Tràng Artisans', contact: 'Trần Thị Mai', phone: '0983 222 111', email: 'mai.art@battrangceramic.vn', address: 'Làng Cổ Bát Tràng, Gia Lâm, Hà Nội', category: 'Chân đèn gốm, chậu gốm tráng men', rating: 4.8, active: true },
    { id: 'sup-3', code: 'NCC-OAKWOOD', name: 'Xưởng Chế Tác Gỗ Sồi Tự Nhiên Mộc Xanh', contact: 'Lê Hoàng Long', phone: '0909 888 777', email: 'contact@mocxanhwood.com', address: 'Thuận An, Bình Dương', category: 'Đế đèn gỗ sồi, mặt bàn trà mini', rating: 4.7, active: true },
    { id: 'sup-4', code: 'NCC-LEDPHILIPS', name: 'Nhà Phân Phối Linh Kiện Chiếu Sáng Philips OEM', contact: 'Đỗ Minh Trí', phone: '0938 555 444', email: 'tri.do@lightingoem.vn', address: 'Đống Đa, Hà Nội', category: 'Mạch LED cảm ứng chạm, cáp Type-C', rating: 4.9, active: true },
  ];
  showSupplierModal = false;
  editingSupplier: any = null;
  supplierForm = { code: '', name: '', contact: '', phone: '', email: '', address: '', category: '', rating: 5.0, active: true };

  // 6. Orders State
  orders: Order[] = [];
  orderFilter: 'ALL' | OrderStatus = 'ALL';
  orderSearch = '';
  selectedOrder: Order | null = null;
  showOrderDetailModal = false;

  // 7. Custom 3D Requests State
  customRequests: CustomRequest[] = [];
  customRequestFilter: 'ALL' | CustomRequestStatus = 'ALL';
  customRequestSearch = '';
  quotationInputs: { [key: string]: number } = {};
  quotationDaysInputs: { [key: string]: number } = {};
  chatInputs: { [key: string]: string } = {};
  selectedRequest: CustomRequest | null = null;
  showRequestModal = false;

  // 8. Customers State
  customers = [
    { id: 'c-1', name: 'Phạm Minh Tuấn', phone: '0988 123 456', email: 'tuan.pham@gmail.com', tier: 'VÀNG', coins: 450, totalOrders: 6, totalSpend: 3450000, joinedDate: '12/03/2026', active: true, address: '124 Hoàng Hoa Thám, Ba Đình, Hà Nội' },
    { id: 'c-2', name: 'Nguyễn Bích Ngọc', phone: '0912 888 999', email: 'ngoc.nguyen@outlook.com', tier: 'KIM CƯƠNG', coins: 1280, totalOrders: 14, totalSpend: 8900000, joinedDate: '05/01/2026', active: true, address: '88 Nguyễn Đình Chiểu, P. Đa Kao, Q.1, TP.HCM' },
    { id: 'c-3', name: 'Trần Đăng Khoa', phone: '0933 456 789', email: 'khoa.tran@studio.vn', tier: 'BẠC', coins: 150, totalOrders: 3, totalSpend: 1850000, joinedDate: '28/05/2026', active: true, address: '25 Lê Lợi, TP. Đà Nẵng' },
    { id: 'c-4', name: 'Lê Phương Thảo', phone: '0977 654 321', email: 'thao.le@interiordesign.com', tier: 'VÀNG', coins: 620, totalOrders: 8, totalSpend: 5200000, joinedDate: '14/02/2026', active: true, address: '45 Thảo Điền, TP. Thủ Đức' },
    { id: 'c-5', name: 'Hoàng Anh Quân', phone: '0903 111 222', email: 'quan.hoang@gmail.com', tier: 'ĐỒNG', coins: 30, totalOrders: 1, totalSpend: 480000, joinedDate: '18/09/2026', active: true, address: '72 Nguyễn Trãi, Q.5, TP.HCM' },
  ];
  customerSearch = '';
  customerTierFilter = 'ALL';
  selectedCustomer: any = null;
  showCustomerModal = false;

  // 9. Reviews State
  reviews = [
    { id: 'rev-1', productName: 'Đèn Ngủ Mặt Trăng Moon Lamp 3D', customerName: 'Phạm Minh Tuấn', rating: 5, date: '19/09/2026', title: 'Ánh sáng cực kỳ dịu và ấm áp!', content: 'Bề mặt in 3D rất sắc nét, sờ vào thấy rõ vân nổi hố thiên thạch. Đế gỗ sồi thơm mùi gỗ mộc tự nhiên. Đóng gói hộp rất sang trọng!', status: 'APPROVED', reply: 'Luméa cảm ơn anh Tuấn rất nhiều! Chúc anh có những giấc ngủ thật êm đềm bên ánh trăng Luméa ạ.' },
    { id: 'rev-2', productName: 'Bình Hoa Gốm Gợn Sóng Wave Vase', customerName: 'Nguyễn Bích Ngọc', rating: 5, date: '18/09/2026', title: 'Đẹp vượt kỳ vọng, góc decor sáng bừng', content: 'Phom dáng uốn lượn phong cách organic hiện đại, cắm hoa cúc họa mi hay cành lá bạch đàn đều cực kỳ ăn ảnh.', status: 'APPROVED', reply: 'Dạ Luméa rất vui vì chị Ngọc yêu thích sản phẩm ạ!' },
    { id: 'rev-3', productName: 'Khay Bút Origami Minimalist', customerName: 'Trần Đăng Khoa', rating: 4, date: '15/09/2026', title: 'Chất lượng nhựa mịn, rất gọn gàng', content: 'Thiết kế góc cạnh rất bắt mắt. Điểm trừ nhỏ là đế chưa có đệm silicon chống trượt, shop nên bổ sung ở đợt sau.', status: 'APPROVED', reply: 'Luméa xin ghi nhận góp ý quý báu của anh Khoa và sẽ bổ sung đệm chống trượt ngay trong đợt sản xuất mới!' },
    { id: 'rev-4', productName: 'Đèn Ngủ Mặt Trăng Tùy Biến', customerName: 'Khách hàng ẩn danh', rating: 2, date: '12/09/2026', title: 'Giao hàng chậm 1 ngày', content: 'Sản phẩm đẹp nhưng bên vận chuyển giao hơi trễ so với dự kiến.', status: 'PENDING', reply: '' },
  ];
  reviewRatingFilter: 'ALL' | number = 'ALL';
  reviewReplyInputs: { [key: string]: string } = {};

  // 10. Promotions & Coupons State
  coupons = [
    { code: 'LUMÉANEW', description: 'Giảm 10% tối đa 50.000đ cho khách hàng mới', discountPercent: 10, maxDiscount: 50000, minSpend: 200000, usedCount: 142, limitCount: 500, status: 'ACTIVE', endDate: '31/12/2026' },
    { code: 'FREESHIP', description: 'Miễn phí vận chuyển toàn quốc đơn từ 300K', discountPercent: 100, maxDiscount: 35000, minSpend: 300000, usedCount: 389, limitCount: 1000, status: 'ACTIVE', endDate: '31/10/2026' },
    { code: 'ROOMCOMBO', description: 'Giảm 15% khi mua trọn gói Phòng Decor 3D', discountPercent: 15, maxDiscount: 200000, minSpend: 800000, usedCount: 65, limitCount: 200, status: 'ACTIVE', endDate: '15/11/2026' },
    { code: 'AUTUMN26', description: 'Ưu đãi phong cách mùa thu ấm áp Castlery', discountPercent: 12, maxDiscount: 120000, minSpend: 500000, usedCount: 18, limitCount: 300, status: 'ACTIVE', endDate: '30/11/2026' },
  ];
  showCouponModal = false;
  couponForm = { code: '', description: '', discountPercent: 10, maxDiscount: 50000, minSpend: 200000, limitCount: 500, endDate: '31/12/2026' };

  // 11. Banners State
  banners = [
    { id: 'b-1', title: 'Nghệ Thuật Không Gian Tối Giản', subtitle: 'Bộ sưu tập nội thất & decor in 3D cảm hứng Castlery phong cách Bắc Âu', ctaText: 'Khám Phá BST Mới', ctaLink: '/catalog', imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80', position: 'HERO_HOME', active: true, order: 1 },
    { id: 'b-2', title: 'In 3D Theo Yêu Cầu Riêng', subtitle: 'Tùy chỉnh chất liệu, kích thước & khắc chữ theo dấu ấn cá nhân của bạn', ctaText: 'Tạo Thiết Kế', ctaLink: '/customizer-3d', imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', position: 'MID_PAGE', active: true, order: 2 },
    { id: 'b-3', title: 'Trải Nghiệm Phòng 3D Tương Tác', subtitle: 'Xem phối cảnh nội thất chân thực trước khi chọn mua sản phẩm', ctaText: 'Vào Phòng Mẫu 3D', ctaLink: '/shop-the-room', imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', position: 'ROOM_HERO', active: true, order: 3 },
  ];
  showBannerModal = false;
  bannerForm = { title: '', subtitle: '', ctaText: '', ctaLink: '', imageUrl: '', position: 'HERO_HOME', order: 1 };

  // 12. Decor Community (UGC) State
  communityPosts = [
    { id: 'ugc-1', authorName: 'Hà My Decor', authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', title: 'Góc làm việc phong cách Wabi-sabi cùng đèn Moon Lamp', imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80', likes: 245, comments: 38, taggedProduct: 'Đèn Ngủ Mặt Trăng Moon Lamp 3D', status: 'APPROVED', isStaffPick: true, date: '19/09/2026' },
    { id: 'ugc-2', authorName: 'Thành Studio', authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', title: 'Bình hoa gợn sóng đặt trên bàn ăn sồi tự nhiên', imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80', likes: 189, comments: 16, taggedProduct: 'Bình Hoa Gốm Gợn Sóng Wave Vase', status: 'APPROVED', isStaffPick: true, date: '17/09/2026' },
    { id: 'ugc-3', authorName: 'Lê An Nhiên', authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', title: 'Kệ sách mini in 3D tone màu Terracotta cực xinh', imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&q=80', likes: 92, comments: 7, taggedProduct: 'Kệ Trang Trí Dải Lụa Ribbon Shelf', status: 'PENDING', isStaffPick: false, date: '16/09/2026' },
  ];

  // 13. Articles State
  articles = [
    { id: 'art-1', title: 'Nghệ Thuật Chọn Ánh Sáng Ấm Cho Phòng Ngủ Hiện Đại', category: 'Cảm Hứng Thiết Kế', author: 'Lê Linh Chi (Creative Lead)', readTime: '5 phút đọc', views: 1840, status: 'PUBLISHED', date: '15/09/2026', coverImage: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?auto=format&fit=crop&w=600&q=80' },
    { id: 'art-2', title: 'Công Nghệ In 3D Đang Thay Đổi Thiết Kế Nội Thất Như Thế Nào?', category: 'Kiến Thức In 3D', author: 'Đặng Tuấn Vũ (3D Specialist)', readTime: '7 phút đọc', views: 2420, status: 'PUBLISHED', date: '10/09/2026', coverImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80' },
    { id: 'art-3', title: 'Mẹo Bảo Quản & Vệ Sinh Đồ Trang Trí Nhựa Sinh Học PLA', category: 'Cẩm Nang Luméa', author: 'Nguyễn Bích Ngọc', readTime: '4 phút đọc', views: 980, status: 'PUBLISHED', date: '04/09/2026', coverImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80' },
  ];
  showArticleModal = false;
  articleForm = { title: '', category: 'Cảm Hứng Thiết Kế', author: 'Luméa Editorial', readTime: '5 phút đọc', status: 'PUBLISHED', coverImage: '' };

  // 14. Staff State
  staffList = [
    { id: 'st-1', code: 'LM-EMP01', name: 'Quản trị viên Luméa', username: 'admin', email: 'admin@lumea.vn', phone: '0901 000 001', department: 'Ban Giám Đốc & Vận Hành', role: 'Super Admin', status: 'ACTIVE', joinedDate: '01/01/2026' },
    { id: 'st-2', code: 'LM-EMP02', name: 'Đặng Tuấn Vũ', username: 'vudt_3d', email: 'vu.dang@lumea.vn', phone: '0902 333 444', department: 'Xưởng In & Thiết Kế 3D', role: '3D Specialist', status: 'ACTIVE', joinedDate: '15/02/2026' },
    { id: 'st-3', code: 'LM-EMP03', name: 'Trần Thị Thu Trang', username: 'trangtt_sales', email: 'trang.tran@lumea.vn', phone: '0903 555 666', department: 'Chăm Sóc Khách Hàng', role: 'Customer Care', status: 'ACTIVE', joinedDate: '01/03/2026' },
    { id: 'st-4', code: 'LM-EMP04', name: 'Lê Minh Quân', username: 'quanlm_stock', email: 'quan.le@lumea.vn', phone: '0904 777 888', department: 'Kho Vận & Đóng Gói', role: 'Warehouse Lead', status: 'ACTIVE', joinedDate: '20/03/2026' },
    { id: 'st-5', code: 'LM-EMP05', name: 'Vũ Hoàng Mai', username: 'maivh_mkt', email: 'mai.vu@lumea.vn', phone: '0905 999 000', department: 'Marketing & Nội Dung', role: 'Content Editor', status: 'ACTIVE', joinedDate: '10/04/2026' },
  ];
  showStaffModal = false;
  staffForm = { code: '', name: '', username: '', email: '', phone: '', department: 'Chăm Sóc Khách Hàng', role: 'Customer Care', status: 'ACTIVE' };

  // 15. Roles & Permissions State
  roles = [
    { id: 'r-1', name: 'Super Admin', desc: 'Toàn quyền truy cập và kiểm soát mọi phân hệ trên hệ thống', count: 1, isSystem: true },
    { id: 'r-2', name: 'Store Manager', desc: 'Quản lý toàn diện kinh doanh, đơn hàng, khách hàng và doanh thu', count: 2, isSystem: false },
    { id: 'r-3', name: '3D Specialist', desc: 'Chuyên trách duyệt bản vẽ 3D, báo giá in ấn và theo dõi máy in', count: 3, isSystem: false },
    { id: 'r-4', name: 'Warehouse Lead', desc: 'Quản lý nhập xuất tồn kho, nguyên vật liệu và điều chuyển hàng', count: 2, isSystem: false },
    { id: 'r-5', name: 'Customer Care', desc: 'Tiếp nhận đơn, chat với khách hàng, phản hồi đánh giá và giải đáp', count: 4, isSystem: false },
    { id: 'r-6', name: 'Content Editor', desc: 'Quản lý banner, bài viết cẩm nang và kiểm duyệt cộng đồng Decor', count: 2, isSystem: false },
  ];
  selectedRoleId = 'r-1';
  permissionModules = [
    { key: 'products', name: 'Sản phẩm & Danh mục' },
    { key: 'orders', name: 'Đơn hàng & Doanh thu' },
    { key: 'custom3d', name: 'Yêu cầu in 3D & Báo giá' },
    { key: 'inventory', name: 'Kho hàng & Nhà cung cấp' },
    { key: 'customers', name: 'Khách hàng & Đánh giá' },
    { key: 'marketing', name: 'Khuyến mãi & Banner' },
    { key: 'content', name: 'Cộng đồng & Bài viết' },
    { key: 'staff', name: 'Nhân sự & Phân quyền' },
    { key: 'settings', name: 'Cài đặt hệ thống & Audit' },
  ];
  permissionsMatrix: { [roleId: string]: { [moduleKey: string]: { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean } } } = {
    'r-1': {
      products: { view: true, create: true, edit: true, delete: true, approve: true },
      orders: { view: true, create: true, edit: true, delete: true, approve: true },
      custom3d: { view: true, create: true, edit: true, delete: true, approve: true },
      inventory: { view: true, create: true, edit: true, delete: true, approve: true },
      customers: { view: true, create: true, edit: true, delete: true, approve: true },
      marketing: { view: true, create: true, edit: true, delete: true, approve: true },
      content: { view: true, create: true, edit: true, delete: true, approve: true },
      staff: { view: true, create: true, edit: true, delete: true, approve: true },
      settings: { view: true, create: true, edit: true, delete: true, approve: true },
    },
    'r-2': {
      products: { view: true, create: true, edit: true, delete: false, approve: true },
      orders: { view: true, create: true, edit: true, delete: false, approve: true },
      custom3d: { view: true, create: true, edit: true, delete: false, approve: true },
      inventory: { view: true, create: true, edit: true, delete: false, approve: true },
      customers: { view: true, create: true, edit: true, delete: false, approve: true },
      marketing: { view: true, create: true, edit: true, delete: false, approve: true },
      content: { view: true, create: true, edit: true, delete: false, approve: true },
      staff: { view: true, create: false, edit: false, delete: false, approve: false },
      settings: { view: true, create: false, edit: false, delete: false, approve: false },
    },
    'r-3': {
      products: { view: true, create: true, edit: true, delete: false, approve: false },
      orders: { view: true, create: false, edit: true, delete: false, approve: true },
      custom3d: { view: true, create: true, edit: true, delete: false, approve: true },
      inventory: { view: true, create: false, edit: false, delete: false, approve: false },
      customers: { view: true, create: false, edit: false, delete: false, approve: false },
      marketing: { view: false, create: false, edit: false, delete: false, approve: false },
      content: { view: false, create: false, edit: false, delete: false, approve: false },
      staff: { view: false, create: false, edit: false, delete: false, approve: false },
      settings: { view: false, create: false, edit: false, delete: false, approve: false },
    },
  };

  // 16. Settings State
  settings = {
    storeName: 'Luméa Modern Home & 3D Décor',
    slogan: 'Nội thất tối giản & Decor in 3D cá nhân hóa',
    hotline: '1900 888 333',
    supportEmail: 'contact@lumea.vn',
    showroomAddress: 'Tầng 2, Tháp Design, 128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Quận 3, TP.HCM',
    businessHours: '08:30 - 21:00 (Thứ 2 - Chủ Nhật)',
    plaPerGram: 1800,
    resinPerGram: 3200,
    woodPerGram: 2400,
    finishLaborFee: 45000,
    defaultLeadDays: 4,
    earnCoinRate: 100000, // 100k = 10 xu
    coinRedeemValue: 1000, // 1 xu = 1k VNĐ
    maxCoinPerOrder: 30, // max 30% tổng đơn
    enableCod: true,
    enableBankQr: true,
    enableMomo: true,
    enableZaloPay: true,
  };
  settingsTab: 'general' | 'print3d' | 'loyalty' | 'payment' = 'general';

  // 17. Audit Log State
  auditLogs = [
    { id: 'log-1', timestamp: '25/09/2026 01:25:10', actor: 'admin (Super Admin)', module: 'Đơn Hàng', action: 'Cập nhật tiến độ in 3D', detail: 'Đơn ORD-982104: Chuyển sang bước Đang in 3D (55%)', ip: '192.168.1.10', level: 'SUCCESS' },
    { id: 'log-2', timestamp: '24/09/2026 23:45:02', actor: 'vudt_3d (3D Specialist)', module: 'Yêu Cầu In 3D', action: 'Gửi báo giá tùy biến', detail: 'Yêu cầu REQ-882: Báo giá 450.000đ, thời gian 4 ngày', ip: '192.168.1.18', level: 'INFO' },
    { id: 'log-3', timestamp: '24/09/2026 21:10:44', actor: 'admin (Super Admin)', module: 'Sản Phẩm', action: 'Cập nhật tồn kho sản phẩm', detail: 'Bình hoa gợn sóng Wave Vase: 4 -> 14 cái (Nhập kho)', ip: '192.168.1.10', level: 'SUCCESS' },
    { id: 'log-4', timestamp: '24/09/2026 18:30:15', actor: 'trangtt_sales (Customer Care)', module: 'Đánh Giá', action: 'Duyệt đánh giá khách hàng', detail: 'Duyệt đánh giá 5 sao từ khách Phạm Minh Tuấn cho Đèn Mặt Trăng', ip: '192.168.1.22', level: 'SUCCESS' },
    { id: 'log-5', timestamp: '24/09/2026 15:02:40', actor: 'quanlm_stock (Warehouse Lead)', module: 'Kho Hàng', action: 'Cảnh báo vật liệu thấp', detail: 'Cuộn nhựa Wood Composite còn 8 cuộn (Dưới ngưỡng 15)', ip: '192.168.1.15', level: 'WARNING' },
    { id: 'log-6', timestamp: '24/09/2026 10:14:00', actor: 'admin (Super Admin)', module: 'Hệ Thống', action: 'Đăng nhập thành công', detail: 'Phiên đăng nhập IP 192.168.1.10 (Chrome/Windows)', ip: '192.168.1.10', level: 'INFO' },
  ];
  auditModuleFilter = 'ALL';
  auditLevelFilter = 'ALL';
  auditSearch = '';

  // 18. Rooms State
  rooms: Room[] = [];

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private customRequestService: CustomRequestService,
    private roomService: RoomService,
    public adminAuth: AdminAuthService,
    private router: Router
  ) {
    effect(() => {
      this.products = this.productService.products();
      this.customizableProductsCount = this.products.filter(p => p.customizable).length;
    });
    effect(() => {
      this.customRequests = this.customRequestService.requests();
      this.pendingRequestsCount = this.customRequests.filter(r => r.status === 'PENDING_REVIEW').length;
    });
    effect(() => {
      this.rooms = this.roomService.rooms();
    });
  }

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.orderService.fetchAll().subscribe(orders => {
      this.orders = orders;
      this.totalRevenue = this.orders.reduce((sum, o) => sum + o.total, 0);
      this.podOrdersCount = this.orders.filter(o => o.hasPrintOnDemandItems).length;
    });
  }

  showToast(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastMessage = null;
    }, 3500);
  }

  // --- Profile & Password ---
  changePassword(): void {
    if (!this.oldPassword || !this.newPassword) {
      this.showToast('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới', 'warning');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.showToast('Mật khẩu xác nhận không khớp', 'error');
      return;
    }
    this.showChangePasswordModal = false;
    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.showToast('Đổi mật khẩu tài khoản quản trị thành công!', 'success');
    this.recordAudit('Bảo Mật', 'Đổi mật khẩu tài khoản quản trị', 'Thành công', 'SUCCESS');
  }

  toggle2FA(): void {
    this.twoFactorEnabled = !this.twoFactorEnabled;
    this.showToast(this.twoFactorEnabled ? 'Đã bật xác thực 2 lớp (2FA)' : 'Đã tắt xác thực 2 lớp', 'info');
    this.recordAudit('Bảo Mật', 'Cấu hình xác thực 2FA', this.twoFactorEnabled ? 'Bật 2FA' : 'Tắt 2FA', 'INFO');
  }

  logout(): void {
    this.recordAudit('Hệ Thống', 'Đăng xuất', 'Đăng xuất khỏi hệ thống', 'INFO');
    this.adminAuth.logout();
    this.router.navigate(['/login']);
  }

  // --- Đếm cho thẻ thống kê dạng bộ lọc (pattern stat-card của my-admin-vita) ---
  orderCount(status: 'ALL' | OrderStatus): number {
    return status === 'ALL' ? this.orders.length : this.orders.filter(o => o.status === status).length;
  }

  customRequestCount(status: 'ALL' | CustomRequestStatus): number {
    return status === 'ALL' ? this.customRequests.length : this.customRequests.filter(r => r.status === status).length;
  }

  inventoryCount(status: string): number {
    return status === 'ALL' ? this.inventoryItems.length : this.inventoryItems.filter(i => i.status === status).length;
  }

  customerCount(tier: string): number {
    return tier === 'ALL' ? this.customers.length : this.customers.filter(c => c.tier === tier).length;
  }

  reviewCount(rating: 'ALL' | number): number {
    return rating === 'ALL' ? this.reviews.length : this.reviews.filter(r => r.rating === rating).length;
  }

  couponCount(status: string): number {
    return status === 'ALL' ? this.coupons.length : this.coupons.filter(c => c.status === status).length;
  }

  staffCount(status: string): number {
    return status === 'ALL' ? this.staffList.length : this.staffList.filter(st => st.status === status).length;
  }

  auditCount(level: string): number {
    return level === 'ALL' ? this.auditLogs.length : this.auditLogs.filter(l => l.level === level).length;
  }

  // --- Bộ lọc & tìm kiếm cho tab Khuyến mãi / Nhân viên ---
  couponFilter = 'ALL';
  couponSearch = '';
  staffFilter = 'ALL';
  staffSearch = '';

  get filteredCoupons(): any[] {
    const q = this.couponSearch.toLowerCase().trim();
    return this.coupons.filter(c =>
      (this.couponFilter === 'ALL' || c.status === this.couponFilter) &&
      (!q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
  }

  get filteredStaff(): any[] {
    const q = this.staffSearch.toLowerCase().trim();
    return this.staffList.filter(st =>
      (this.staffFilter === 'ALL' || st.status === this.staffFilter) &&
      (!q || st.name.toLowerCase().includes(q) || st.username.toLowerCase().includes(q) ||
        st.code.toLowerCase().includes(q) || st.department.toLowerCase().includes(q)));
  }

  get auditModules(): string[] {
    return [...new Set(this.auditLogs.map(l => l.module))];
  }

  // --- Orders ---
  get filteredOrders(): Order[] {
    return this.orders.filter(o => {
      const matchStatus = this.orderFilter === 'ALL' || o.status === this.orderFilter;
      const q = this.orderSearch.toLowerCase().trim();
      const matchSearch = !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
        (o.shippingAddress?.phone || '').includes(q);
      return matchStatus && matchSearch;
    });
  }

  viewOrderDetail(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetailModal = true;
  }

  setProductionStep(orderNumber: string, step: ProductionStep, title: string, percent: number, notes: string): void {
    const status = step === 'DISPATCHED' ? 'SHIPPED' : 'IN_PRODUCTION';
    const nowStr = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    this.orderService.updateOrderStatus(orderNumber, status, {
      currentStep: step,
      percentage: percent,
      stepTitle: title,
      notes,
      updatedAt: nowStr,
    }).subscribe(() => {
      this.refreshData();
      if (this.selectedOrder && this.selectedOrder.orderNumber === orderNumber) {
        this.selectedOrder.status = status;
        this.selectedOrder.productionProgress = {
          currentStep: step,
          percentage: percent,
          stepTitle: title,
          notes,
          updatedAt: nowStr,
        };
      }
      this.showToast(`Đã cập nhật tiến độ đơn ${orderNumber}: ${title} (${percent}%)`, 'success');
      this.recordAudit('Đơn Hàng', 'Cập nhật tiến độ in 3D', `Đơn ${orderNumber}: ${title} (${percent}%)`, 'SUCCESS');
    });
  }

  updateOrderStatusDirect(orderNumber: string, status: OrderStatus): void {
    this.orderService.updateOrderStatus(orderNumber, status).subscribe(() => {
      this.refreshData();
      if (this.selectedOrder && this.selectedOrder.orderNumber === orderNumber) {
        this.selectedOrder.status = status;
      }
      this.showToast(`Đã chuyển trạng thái đơn ${orderNumber} sang ${status}`, 'info');
      this.recordAudit('Đơn Hàng', 'Đổi trạng thái đơn hàng', `Đơn ${orderNumber} -> ${status}`, 'INFO');
    });
  }

  // --- Products ---
  get filteredProducts(): Product[] {
    return this.products.filter(p => {
      const matchSub =
        this.productSubTab === 'all' ? true :
        this.productSubTab === 'ready' ? p.productionType === 'READY_STOCK' :
        p.productionType === 'PRINT_ON_DEMAND';

      const matchCat = this.productCategoryFilter === 'ALL' || p.category === this.productCategoryFilter;

      const q = this.productSearch.toLowerCase().trim();
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q);

      return matchSub && matchCat && matchSearch;
    });
  }

  openAddProductModal(): void {
    this.editingProduct = null;
    this.productForm = {
      name: '',
      slug: '',
      category: 'lamp',
      categoryName: 'Đèn Bàn & Đèn Ngủ',
      categoryGroup: 'FURNITURE',
      productionType: 'READY_STOCK',
      customizable: false,
      basePrice: 250000,
      originalPrice: 300000,
      inStock: 50,
      dimensions: '18 x 18 x 25 cm',
      materialInfo: 'Nhựa sinh học PLA, đế gỗ tần bì tự nhiên',
      description: 'Thiết kế tối giản mang lại sự ấm cúng cho không gian.',
      story: 'Cảm hứng từ phong cách Scandinavian ấm áp.',
      badge: 'Mới Ra Mắt',
      image1: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
      image2: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?auto=format&fit=crop&w=800&q=80',
      threeModelType: 'moon_lamp',
    };
    this.showProductModal = true;
  }

  openEditProductModal(product: Product): void {
    this.editingProduct = product;
    this.productForm = {
      name: product.name,
      slug: product.slug,
      category: product.category,
      categoryName: product.categoryName,
      categoryGroup: product.categoryGroup || 'FURNITURE',
      productionType: product.productionType,
      customizable: !!product.customizable,
      basePrice: product.basePrice,
      originalPrice: product.originalPrice || product.basePrice,
      inStock: product.inStock,
      dimensions: product.dimensions || '',
      materialInfo: product.materialInfo || '',
      description: product.description || '',
      story: product.story || '',
      badge: product.badge || '',
      image1: product.images?.[0] || '',
      image2: product.images?.[1] || '',
      threeModelType: product.threeModelType || '',
    };
    this.showProductModal = true;
  }

  saveProduct(): void {
    if (!this.productForm.name.trim()) {
      this.showToast('Vui lòng nhập tên sản phẩm', 'warning');
      return;
    }

    const payload: any = {
      name: this.productForm.name.trim(),
      slug: this.productForm.slug.trim() || this.productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: this.productForm.category,
      categoryName: this.productForm.categoryName,
      categoryGroup: this.productForm.categoryGroup,
      productionType: this.productForm.productionType,
      customizable: this.productForm.customizable,
      basePrice: Number(this.productForm.basePrice),
      originalPrice: Number(this.productForm.originalPrice),
      inStock: Number(this.productForm.inStock),
      dimensions: this.productForm.dimensions,
      materialInfo: this.productForm.materialInfo,
      description: this.productForm.description,
      story: this.productForm.story,
      badge: this.productForm.badge,
      images: [this.productForm.image1, this.productForm.image2].filter(Boolean),
      threeModelType: this.productForm.threeModelType || undefined,
      rating: this.editingProduct ? this.editingProduct.rating : 5.0,
      reviewCount: this.editingProduct ? this.editingProduct.reviewCount : 0,
    };

    if (this.editingProduct) {
      this.productService.updateProduct(this.editingProduct.id, payload).subscribe({
        next: () => {
          this.showToast(`Đã cập nhật sản phẩm "${payload.name}"!`, 'success');
          this.showProductModal = false;
          this.recordAudit('Sản Phẩm', 'Chỉnh sửa sản phẩm', payload.name, 'SUCCESS');
        },
        error: () => this.showToast('Không lưu được sản phẩm vào server', 'error')
      });
    } else {
      this.productService.addProduct(payload).subscribe({
        next: () => {
          this.showToast(`Đã tạo sản phẩm mới "${payload.name}"!`, 'success');
          this.showProductModal = false;
          this.recordAudit('Sản Phẩm', 'Thêm mới sản phẩm', payload.name, 'SUCCESS');
        },
        error: () => this.showToast('Không thêm được sản phẩm vào server', 'error')
      });
    }
  }

  showAddProductModal = false;

  deleteProduct(id: string, name: string = 'sản phẩm'): void {
    if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${name}" khỏi cửa hàng?`)) return;
    this.productService.deleteProduct(id).subscribe({
      next: () => {
        this.showToast(`Đã xóa sản phẩm "${name}"!`, 'info');
        this.recordAudit('Sản Phẩm', 'Xóa sản phẩm', `Xóa ${name} (ID: ${id})`, 'WARNING');
      },
      error: () => this.showToast('Không xóa được sản phẩm', 'error')
    });
  }

  // --- Categories ---
  openAddCategoryModal(): void {
    this.editingCategory = null;
    this.categoryForm = { name: '', slug: '', group: 'DECOR', icon: 'box', desc: '', active: true };
    this.showCategoryModal = true;
  }

  openEditCategoryModal(cat: any): void {
    this.editingCategory = cat;
    this.categoryForm = { ...cat };
    this.showCategoryModal = true;
  }

  saveCategory(): void {
    if (!this.categoryForm.name.trim()) return;
    if (this.editingCategory) {
      Object.assign(this.editingCategory, this.categoryForm);
      this.showToast(`Đã cập nhật danh mục "${this.categoryForm.name}"`, 'success');
      this.recordAudit('Danh Mục', 'Cập nhật danh mục', this.categoryForm.name, 'INFO');
    } else {
      const newCat = {
        id: 'cat-' + (this.categories.length + 1),
        ...this.categoryForm,
        productCount: 0,
      };
      this.categories.push(newCat);
      this.showToast(`Đã thêm danh mục mới "${newCat.name}"`, 'success');
      this.recordAudit('Danh Mục', 'Thêm danh mục', newCat.name, 'SUCCESS');
    }
    this.showCategoryModal = false;
  }

  toggleCategoryStatus(cat: any): void {
    cat.active = !cat.active;
    this.showToast(`Danh mục "${cat.name}" hiện đã ${cat.active ? 'HIỂN THỊ' : 'ẨN'}`, 'info');
    this.recordAudit('Danh Mục', 'Đổi trạng thái danh mục', `${cat.name} -> ${cat.active ? 'ACTIVE' : 'HIDDEN'}`, 'INFO');
  }

  // --- Inventory ---
  get filteredInventory(): any[] {
    return this.inventoryItems.filter(item => {
      const matchFilter = this.inventoryFilter === 'ALL' || item.status === this.inventoryFilter;
      const q = this.inventorySearch.toLowerCase().trim();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }

  openStockModal(item: any): void {
    this.selectedStockItem = item;
    this.stockAdjustQty = 10;
    this.stockAdjustReason = 'Nhập bổ sung từ xưởng sản xuất';
    this.showStockModal = true;
  }

  submitStockAdjust(): void {
    if (!this.selectedStockItem) return;
    this.selectedStockItem.currentStock += this.stockAdjustQty;
    if (this.selectedStockItem.currentStock <= 0) {
      this.selectedStockItem.status = 'OUT';
    } else if (this.selectedStockItem.currentStock <= this.selectedStockItem.minThreshold) {
      this.selectedStockItem.status = 'LOW';
    } else {
      this.selectedStockItem.status = 'SAFE';
    }
    this.showToast(`Đã điều chỉnh tồn kho cho ${this.selectedStockItem.name}: ${this.selectedStockItem.currentStock} cái`, 'success');
    this.recordAudit('Kho Hàng', 'Điều chỉnh tồn kho', `${this.selectedStockItem.sku}: +${this.stockAdjustQty} (${this.stockAdjustReason})`, 'SUCCESS');
    this.showStockModal = false;
  }

  // --- Suppliers ---
  openAddSupplierModal(): void {
    this.editingSupplier = null;
    this.supplierForm = { code: 'NCC-' + (this.suppliers.length + 1), name: '', contact: '', phone: '', email: '', address: '', category: '', rating: 5.0, active: true };
    this.showSupplierModal = true;
  }

  openEditSupplierModal(sup: any): void {
    this.editingSupplier = sup;
    this.supplierForm = { ...sup };
    this.showSupplierModal = true;
  }

  saveSupplier(): void {
    if (!this.supplierForm.name.trim()) return;
    if (this.editingSupplier) {
      Object.assign(this.editingSupplier, this.supplierForm);
      this.showToast(`Đã cập nhật nhà cung cấp "${this.supplierForm.name}"`, 'success');
      this.recordAudit('Nhà Cung Cấp', 'Cập nhật nhà cung cấp', this.supplierForm.name, 'INFO');
    } else {
      const newSup = {
        id: 'sup-' + (this.suppliers.length + 1),
        ...this.supplierForm,
      };
      this.suppliers.push(newSup);
      this.showToast(`Đã thêm nhà cung cấp mới "${newSup.name}"`, 'success');
      this.recordAudit('Nhà Cung Cấp', 'Thêm nhà cung cấp', newSup.name, 'SUCCESS');
    }
    this.showSupplierModal = false;
  }

  // --- 3D Custom Requests ---
  get filteredCustomRequests(): CustomRequest[] {
    return this.customRequests.filter(r => {
      const matchFilter = this.customRequestFilter === 'ALL' || r.status === this.customRequestFilter;
      const q = this.customRequestSearch.toLowerCase().trim();
      const matchSearch = !q ||
        r.requestCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.customerPhone || '').includes(q);
      return matchFilter && matchSearch;
    });
  }

  viewRequestDetail(req: CustomRequest): void {
    this.selectedRequest = req;
    this.showRequestModal = true;
  }

  submitQuotation(requestId: string): void {
    const price = this.quotationInputs[requestId];
    const days = this.quotationDaysInputs[requestId] || 4;
    if (!price || price <= 0) {
      this.showToast('Vui lòng nhập giá báo giá hợp lệ', 'warning');
      return;
    }
    this.customRequestService.updateStatus(requestId, 'QUOTED', price, days);
    this.customRequestService.sendMessage(
      requestId,
      `Shop Luméa đã kiểm tra yêu cầu và gửi báo giá chính thức: ${price.toLocaleString('vi-VN')}đ. Thời gian in và xử lý hoàn thiện khoảng ${days} ngày.`,
      'SHOP_SPECIALIST'
    );
    this.showToast(`Đã gửi báo giá ${price.toLocaleString('vi-VN')}đ cho yêu cầu!`, 'success');
    this.recordAudit('Yêu Cầu In 3D', 'Gửi báo giá tùy biến', `Mã ${requestId}: ${price.toLocaleString('vi-VN')}đ (${days} ngày)`, 'SUCCESS');
  }

  setPreviewReady(requestId: string): void {
    this.customRequestService.updateStatus(requestId, 'PREVIEW_READY', undefined, undefined, 'moon_lamp');
    this.customRequestService.sendMessage(
      requestId,
      'Bản vẽ mô phỏng 3D Preview đã được tải lên! Bạn hãy xem và bấm duyệt thiết kế nhé.',
      'SHOP_SPECIALIST'
    );
    this.showToast('Đã cấp mô hình 3D Preview cho khách hàng duyệt!', 'success');
    this.recordAudit('Yêu Cầu In 3D', 'Cấp mô hình 3D Preview', `Mã ${requestId}: Mô hình moon_lamp`, 'SUCCESS');
  }

  sendAdminChatMessage(requestId: string): void {
    const msg = (this.chatInputs[requestId] || '').trim();
    if (!msg) return;
    this.customRequestService.sendMessage(requestId, msg, 'SHOP_SPECIALIST');
    this.chatInputs[requestId] = '';
    this.showToast('Đã gửi phản hồi tư vấn cho khách!', 'info');
  }

  // --- Customers ---
  get filteredCustomers(): any[] {
    return this.customers.filter(c => {
      const matchTier = this.customerTierFilter === 'ALL' || c.tier === this.customerTierFilter;
      const q = this.customerSearch.toLowerCase().trim();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q);
      return matchTier && matchSearch;
    });
  }

  viewCustomerDetail(c: any): void {
    this.selectedCustomer = c;
    this.showCustomerModal = true;
  }

  toggleCustomerStatus(c: any): void {
    c.active = !c.active;
    this.showToast(`Khách hàng ${c.name} hiện đã ${c.active ? 'KÍCH HOẠT' : 'TẠM KHÓA'}`, 'info');
    this.recordAudit('Khách Hàng', 'Đổi trạng thái tài khoản', `${c.name} -> ${c.active ? 'ACTIVE' : 'LOCKED'}`, 'WARNING');
  }

  addCustomerCoins(c: any, coins: number): void {
    c.coins += coins;
    this.showToast(`Đã tặng ${coins} Luméa Xu cho khách hàng ${c.name}`, 'success');
    this.recordAudit('Khách Hàng', 'Thưởng Luméa Xu', `${c.name}: +${coins} Xu`, 'INFO');
  }

  // --- Reviews ---
  get filteredReviews(): any[] {
    return this.reviews.filter(r => {
      const matchRating = this.reviewRatingFilter === 'ALL' || r.rating === this.reviewRatingFilter;
      return matchRating;
    });
  }

  approveReview(r: any): void {
    r.status = 'APPROVED';
    this.showToast(`Đã duyệt hiển thị đánh giá của ${r.customerName}`, 'success');
    this.recordAudit('Đánh Giá', 'Duyệt đánh giá', `Duyệt đánh giá ${r.id}`, 'SUCCESS');
  }

  hideReview(r: any): void {
    r.status = 'HIDDEN';
    this.showToast(`Đã ẩn đánh giá của ${r.customerName}`, 'info');
    this.recordAudit('Đánh Giá', 'Ẩn đánh giá', `Ẩn đánh giá ${r.id}`, 'WARNING');
  }

  replyReview(r: any): void {
    const text = (this.reviewReplyInputs[r.id] || '').trim();
    if (!text) return;
    r.reply = text;
    this.reviewReplyInputs[r.id] = '';
    this.showToast('Đã gửi phản hồi chính thức từ Luméa!', 'success');
    this.recordAudit('Đánh Giá', 'Phản hồi đánh giá', `Phản hồi cho ${r.customerName}: "${text}"`, 'INFO');
  }

  // --- Promotions ---
  openAddCouponModal(): void {
    this.couponForm = { code: '', description: '', discountPercent: 10, maxDiscount: 50000, minSpend: 200000, limitCount: 500, endDate: '31/12/2026' };
    this.showCouponModal = true;
  }

  saveCoupon(): void {
    if (!this.couponForm.code.trim()) return;
    const newCoupon = {
      code: this.couponForm.code.toUpperCase().trim(),
      description: this.couponForm.description.trim(),
      discountPercent: Number(this.couponForm.discountPercent),
      maxDiscount: Number(this.couponForm.maxDiscount),
      minSpend: Number(this.couponForm.minSpend),
      usedCount: 0,
      limitCount: Number(this.couponForm.limitCount),
      status: 'ACTIVE',
      endDate: this.couponForm.endDate,
    };
    this.coupons.unshift(newCoupon);
    this.showCouponModal = false;
    this.showToast(`Đã tạo mã khuyến mãi "${newCoupon.code}"!`, 'success');
    this.recordAudit('Khuyến Mãi', 'Tạo Voucher mới', newCoupon.code, 'SUCCESS');
  }

  toggleCoupon(c: any): void {
    c.status = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.showToast(`Mã khuyến mãi ${c.code} hiện đã ${c.status === 'ACTIVE' ? 'BẬT' : 'TẠM NGƯNG'}`, 'info');
    this.recordAudit('Khuyến Mãi', 'Đổi trạng thái Voucher', `${c.code} -> ${c.status}`, 'INFO');
  }

  // --- Banners ---
  openAddBannerModal(): void {
    this.bannerForm = { title: '', subtitle: '', ctaText: 'Khám Phá', ctaLink: '/catalog', imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80', position: 'HERO_HOME', order: this.banners.length + 1 };
    this.showBannerModal = true;
  }

  saveBanner(): void {
    if (!this.bannerForm.title.trim()) return;
    const newBanner = {
      id: 'b-' + (this.banners.length + 1),
      ...this.bannerForm,
      active: true,
    };
    this.banners.push(newBanner);
    this.showBannerModal = false;
    this.showToast(`Đã tạo banner mới: "${newBanner.title}"`, 'success');
    this.recordAudit('Banner', 'Thêm Banner mới', newBanner.title, 'SUCCESS');
  }

  toggleBanner(b: any): void {
    b.active = !b.active;
    this.showToast(`Banner "${b.title}" hiện đã ${b.active ? 'HIỂN THỊ' : 'ẨN'}`, 'info');
    this.recordAudit('Banner', 'Đổi trạng thái banner', `${b.title} -> ${b.active ? 'ACTIVE' : 'HIDDEN'}`, 'INFO');
  }

  // --- Decor Community ---
  approveCommunityPost(post: any): void {
    post.status = 'APPROVED';
    this.showToast(`Đã duyệt bài đăng của ${post.authorName}!`, 'success');
    this.recordAudit('Cộng Đồng', 'Duyệt bài đăng UGC', post.title, 'SUCCESS');
  }

  toggleStaffPick(post: any): void {
    post.isStaffPick = !post.isStaffPick;
    this.showToast(`Bài đăng đã ${post.isStaffPick ? 'GẮN HUY HIỆU NỔI BẬT' : 'BỎ HUY HIỆU NỔI BẬT'}!`, 'info');
    this.recordAudit('Cộng Đồng', 'Gắn huy hiệu nổi bật', `${post.title}: ${post.isStaffPick}`, 'INFO');
  }

  hideCommunityPost(post: any): void {
    post.status = 'HIDDEN';
    this.showToast(`Đã ẩn bài đăng của ${post.authorName}!`, 'info');
    this.recordAudit('Cộng Đồng', 'Ẩn bài đăng UGC', post.title, 'WARNING');
  }

  // --- Articles ---
  openAddArticleModal(): void {
    this.articleForm = { title: '', category: 'Cảm Hứng Thiết Kế', author: 'Luméa Editorial', readTime: '5 phút đọc', status: 'PUBLISHED', coverImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80' };
    this.showArticleModal = true;
  }

  saveArticle(): void {
    if (!this.articleForm.title.trim()) return;
    const newArt = {
      id: 'art-' + (this.articles.length + 1),
      ...this.articleForm,
      views: 0,
      date: new Date().toLocaleDateString('vi-VN'),
    };
    this.articles.unshift(newArt);
    this.showArticleModal = false;
    this.showToast(`Đã xuất bản bài viết "${newArt.title}"!`, 'success');
    this.recordAudit('Bài Viết', 'Xuất bản bài viết', newArt.title, 'SUCCESS');
  }

  // --- Staff ---
  openAddStaffModal(): void {
    this.staffForm = {
      code: 'LM-EMP0' + (this.staffList.length + 1),
      name: '',
      username: '',
      email: '',
      phone: '',
      department: 'Chăm Sóc Khách Hàng',
      role: 'Customer Care',
      status: 'ACTIVE',
    };
    this.showStaffModal = true;
  }

  saveStaff(): void {
    if (!this.staffForm.name.trim() || !this.staffForm.username.trim()) return;
    const newStaff = {
      id: 'st-' + (this.staffList.length + 1),
      ...this.staffForm,
      joinedDate: new Date().toLocaleDateString('vi-VN'),
    };
    this.staffList.push(newStaff);
    this.showStaffModal = false;
    this.showToast(`Đã thêm nhân viên mới "${newStaff.name}"!`, 'success');
    this.recordAudit('Nhân Sự', 'Thêm nhân viên mới', `${newStaff.name} (${newStaff.role})`, 'SUCCESS');
  }

  toggleStaffStatus(st: any): void {
    st.status = st.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    this.showToast(`Nhân viên ${st.name} hiện đã ${st.status === 'ACTIVE' ? 'KÍCH HOẠT' : 'KHÓA TRUY CẬP'}!`, 'warning');
    this.recordAudit('Nhân Sự', 'Đổi trạng thái nhân sự', `${st.name} -> ${st.status}`, 'WARNING');
  }

  // --- Roles & Permissions ---
  selectRole(roleId: string): void {
    this.selectedRoleId = roleId;
  }

  togglePermission(roleId: string, moduleKey: string, permKey: 'view' | 'create' | 'edit' | 'delete' | 'approve'): void {
    if (!this.permissionsMatrix[roleId]) {
      this.permissionsMatrix[roleId] = {};
    }
    if (!this.permissionsMatrix[roleId][moduleKey]) {
      this.permissionsMatrix[roleId][moduleKey] = { view: false, create: false, edit: false, delete: false, approve: false };
    }
    this.permissionsMatrix[roleId][moduleKey][permKey] = !this.permissionsMatrix[roleId][moduleKey][permKey];
    this.showToast(`Đã cập nhật quyền ${permKey.toUpperCase()} cho module ${moduleKey}`, 'info');
    this.recordAudit('Phân Quyền', 'Cập nhật phân quyền', `Role ${roleId} - Module ${moduleKey} - ${permKey}`, 'INFO');
  }

  hasPermission(roleId: string, moduleKey: string, permKey: 'view' | 'create' | 'edit' | 'delete' | 'approve'): boolean {
    return !!this.permissionsMatrix[roleId]?.[moduleKey]?.[permKey];
  }

  // --- Settings ---
  saveSettings(): void {
    this.showToast('Đã lưu thành công toàn bộ cài đặt hệ thống Luméa!', 'success');
    this.recordAudit('Cài Đặt', 'Cập nhật cài đặt hệ thống', 'Lưu thông tin cửa hàng, bảng giá in 3D & thanh toán', 'SUCCESS');
  }

  // --- Audit Log ---
  get filteredAuditLogs(): any[] {
    return this.auditLogs.filter(log => {
      const matchMod = this.auditModuleFilter === 'ALL' || log.module === this.auditModuleFilter;
      const matchLevel = this.auditLevelFilter === 'ALL' || log.level === this.auditLevelFilter;
      const q = this.auditSearch.toLowerCase().trim();
      const matchSearch = !q || log.action.toLowerCase().includes(q) || log.detail.toLowerCase().includes(q) || log.actor.toLowerCase().includes(q);
      return matchMod && matchLevel && matchSearch;
    });
  }

  exportAuditLogs(): void {
    const csvContent = 'data:text/csv;charset=utf-8,' +
      'Thời gian,Tài khoản,Phân hệ,Hành động,Chi tiết,IP,Mức độ\n' +
      this.auditLogs.map(e => `"${e.timestamp}","${e.actor}","${e.module}","${e.action}","${e.detail}","${e.ip}","${e.level}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lumea_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Đã xuất file Audit Log thành công!', 'success');
  }

  private recordAudit(module: string, action: string, detail: string, level: string): void {
    const newLog = {
      id: 'log-' + (this.auditLogs.length + 1),
      timestamp: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN'),
      actor: `${this.adminAuth.currentAdmin()?.username || 'admin'} (${this.adminAuth.currentAdmin()?.fullName || 'Super Admin'})`,
      module,
      action,
      detail,
      ip: '192.168.1.10',
      level,
    };
    this.auditLogs.unshift(newLog);
  }

  get readyStockProducts(): Product[] {
    return this.products.filter(p => p.productionType === 'READY_STOCK');
  }

  get customizableAdminProducts(): Product[] {
    return this.products.filter(p => p.productionType === 'PRINT_ON_DEMAND');
  }

  getOrderItemName(order: Order): string {
    return order.items?.[0]?.product?.name || 'Sản phẩm Luméa';
  }

  getOrderCustomText(order: Order): string {
    return order.items?.[0]?.selectedCustomization?.customText || '';
  }
}
