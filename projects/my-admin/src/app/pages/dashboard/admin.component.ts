import { Component, ElementRef, OnDestroy, OnInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { RoomService } from '../../core/services/room.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { CommunityService } from '../../core/services/community.service';
import { NewsService } from '../../core/services/news.service';
import { VideoService } from '../../core/services/video.service';
import { ChatService, ChatSession } from '../../core/services/chat.service';
import { ReviewService, AdminReview } from '../../core/services/review.service';
import { Product, ProductionType, ProductCategory } from '../../core/models/product.model';
import { Order, ProductionStep, OrderStatus, ShippingOptions } from '../../core/models/order.model';
import { CustomRequest, CustomRequestStatus } from '../../core/models/custom-request.model';
import { Room } from '../../core/models/room.model';
import { CommunityPost } from '../../core/models/community.model';
import { NewsArticle, ArticleCategory, ARTICLE_CATEGORIES } from '../../core/models/news.model';
import { Video } from '../../core/models/video.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { LumeaMapComponent } from '../../components/lumea-map/lumea-map.component';
import { environment } from '../../../environments/environment';

/** Bộ lọc tab Cộng đồng: bài đăng hôm nay, đang hiển thị, bị bộ lọc tự động chặn, nhân viên đã ẩn. */
export type CommunityFilter = 'TODAY' | 'ALL' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN' | 'STAFF_PICK';

/** Khách hàng tổng hợp từ đơn hàng thật (gom theo SĐT) — không có hạng thành viên giả. */
export interface CustomerSummary {
  phone: string;
  name: string;
  email: string;
  city: string;
  hasAccount: boolean;
  orders: Order[];
  deliveredCount: number;
  returnedCount: number;
  cancelledCount: number;
  openCount: number;
  totalSpend: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export type CustomerFilter = 'ALL' | 'LOYAL' | 'NEW' | 'RISK' | 'ACCOUNT';

/** Bộ lọc tab Đánh giá — ưu tiên việc cần làm: đánh giá xấu chưa phản hồi. */
export type ReviewFilter = 'NEEDS_ACTION' | 'UNREPLIED' | 'ALL' | 'PINNED' | 'HIDDEN';

/** Một bước sản xuất (nút trong modal chi tiết đơn in 3D). */
export interface ProductionStepOption { step: ProductionStep; label: string; title: string; percent: number; notes: string; }

export type AdminTab =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'suppliers'
  | 'orders'
  | 'custom-requests'
  | 'customers'
  | 'messages'
  | 'reviews'
  | 'promotions'
  | 'banners'
  | 'community'
  | 'articles'
  | 'videos'
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
export class AdminComponent implements OnInit, OnDestroy {
  readonly clientAppUrl = environment.clientAppUrl;

  activeTab: AdminTab = 'dashboard';
  globalSearch = '';
  readonly today = new Date();

  // Sidebar thu gọn (chỉ hiện icon) — pattern tham khảo từ my-admin-vita
  isSidebarCollapsed = false;

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  // Nhóm menu gập/mở để sidebar không phải cuộn dài. Chưa bấm gì thì chỉ mở nhóm chứa tab
  // đang xem; sau khi người dùng tự gập/mở một nhóm thì giữ theo lựa chọn đó.
  private navGroupState: Record<string, boolean> = {};

  isNavGroupOpen(group: string): boolean {
    return this.navGroupState[group] ?? this.tabMeta[this.activeTab].group === group;
  }

  toggleNavGroup(group: string): void {
    this.navGroupState[group] = !this.isNavGroupOpen(group);
  }

  /** Bấm tên nhóm trên breadcrumb: mở tab đầu tiên của nhóm (theo thứ tự trong tabMeta) và mở nhóm trên sidebar. */
  goToGroup(group: string): void {
    const firstTab = (Object.keys(this.tabMeta) as AdminTab[]).find(tab => this.tabMeta[tab].group === group);
    if (firstTab) this.activeTab = firstTab;
    this.navGroupState[group] = true;
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
    'customers': { group: 'Khách hàng & CSKH', title: 'Khách hàng', subtitle: 'Khách mua hàng tổng hợp từ đơn, lịch sử mua và tỉ lệ nhận hàng COD' },
    'messages': { group: 'Khách hàng & CSKH', title: 'Tin nhắn hỗ trợ', subtitle: 'Trả lời khách nhắn qua khung chat trên cửa hàng — tin mới hiện ngay, không cần tải lại' },
    'reviews': { group: 'Khách hàng & CSKH', title: 'Đánh giá', subtitle: 'Đánh giá đăng ngay không cần duyệt — theo dõi, phản hồi khách chưa hài lòng và ẩn nội dung vi phạm' },
    'promotions': { group: 'Khách hàng & CSKH', title: 'Khuyến mãi & voucher', subtitle: 'Mã giảm giá và chương trình ưu đãi' },
    'banners': { group: 'Nội dung & truyền thông', title: 'Banner & Hero', subtitle: 'Nội dung trình bày trên trang chủ cửa hàng' },
    'community': { group: 'Nội dung & truyền thông', title: 'Cộng đồng', subtitle: 'Kiểm duyệt bài khách hàng đăng: bài mới hôm nay, bài bị chặn do vi phạm, bài đã ẩn' },
    'articles': { group: 'Nội dung & truyền thông', title: 'Tin tức', subtitle: 'Bài viết do nhân viên Luméa soạn, hiển thị ở trang Tin tức của cửa hàng' },
    'videos': { group: 'Nội dung & truyền thông', title: 'Video', subtitle: 'Video chủ đề phát ở trang chủ cửa hàng — chỉ nhân viên được đăng' },
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

  // 1. Dashboard State
  totalRevenue = 0;
  podOrdersCount = 0;
  pendingRequestsCount = 0;
  customizableProductsCount = 0;
  /** Ngưỡng coi là sắp hết hàng (tồn kho ≤ số này). */
  readonly LOW_STOCK_THRESHOLD = 5;

  // 2. Products State
  products: Product[] = [];
  productSubTab: 'all' | 'ready' | 'customizable' = 'all';
  productSearch = '';
  productCategoryFilter = 'ALL';
  /** Khớp ProductCategory của my-client (cây danh mục: core/data/catalog-taxonomy.ts bên my-client). */
  readonly productCategoryOptions: { value: ProductCategory; label: string; group: 'FURNITURE' | 'DECOR'; section: string }[] = [
    { value: 'sofa', label: 'Sofa', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'bed', label: 'Giường', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'table', label: 'Bàn', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'side_table', label: 'Bàn Phụ & Side Table', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'chair', label: 'Ghế', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'stool', label: 'Ghế Đôn & Ghế Phụ', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'cabinet', label: 'Tủ', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'bookshelf', label: 'Kệ Sách & Kệ Treo Tường', group: 'FURNITURE', section: 'Nội thất' },
    { value: 'desk_lamp', label: 'Đèn Bàn', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
    { value: 'night_lamp', label: 'Đèn Ngủ', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
    { value: 'pendant_lamp', label: 'Đèn Trang Trí (thả/cây)', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
    { value: 'lamp', label: 'Đèn Decor', group: 'FURNITURE', section: 'Đèn & ánh sáng' },
    { value: 'vase', label: 'Bình Hoa & Lọ Decor', group: 'DECOR', section: 'Decor' },
    { value: 'candle_holder', label: 'Đế Nến', group: 'DECOR', section: 'Decor' },
    { value: 'clock', label: 'Đồng Hồ Decor', group: 'DECOR', section: 'Decor' },
    { value: 'sculpture', label: 'Tượng & Figure', group: 'DECOR', section: 'Decor' },
    { value: 'plant_pot', label: 'Chậu Cây', group: 'DECOR', section: 'Decor' },
    { value: 'frame', label: 'Khung Ảnh', group: 'DECOR', section: 'Decor' },
    { value: 'organizer', label: 'Khay & Hộp Đựng', group: 'FURNITURE', section: 'Đồ dùng & phụ kiện' },
    { value: 'tray', label: 'Khay Decor', group: 'DECOR', section: 'Đồ dùng & phụ kiện' },
    { value: 'bookend', label: 'Giá Đỡ & Bookend', group: 'DECOR', section: 'Đồ dùng & phụ kiện' },
  ];

  /** Chọn danh mục trong form → tự điền categoryName/categoryGroup tương ứng. */
  onProductCategoryChange(value: ProductCategory): void {
    const opt = this.productCategoryOptions.find(o => o.value === value);
    this.productForm.category = value;
    if (opt) {
      this.productForm.categoryName = opt.label;
      this.productForm.categoryGroup = opt.group;
    }
  }
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
  // Nhóm lớn khớp mega menu của my-client (Nội thất / Đèn & ánh sáng / Decor / Đồ dùng & phụ kiện).
  // productCount tính lại từ sản phẩm thật mỗi khi danh sách sản phẩm thay đổi (xem refreshCategoryCounts).
  categories = [
    { id: 'cat-1', name: 'Nội thất', slug: 'noi-that', group: 'FURNITURE', icon: 'home', productCount: 0, active: true, desc: 'Sofa, giường, bàn, ghế, tủ, kệ' },
    { id: 'cat-2', name: 'Đèn & ánh sáng', slug: 'anh-sang', group: 'FURNITURE', icon: 'sparkles', productCount: 0, active: true, desc: 'Đèn bàn, đèn ngủ, đèn trang trí, đèn decor' },
    { id: 'cat-3', name: 'Decor', slug: 'decor', group: 'DECOR', icon: 'image', productCount: 0, active: true, desc: 'Đồ trang trí, tượng & figure, chậu cây, khung ảnh' },
    { id: 'cat-4', name: 'Đồ dùng & phụ kiện', slug: 'do-dung', group: 'DECOR', icon: 'archive', productCount: 0, active: true, desc: 'Khay & hộp đựng, giá đỡ & bookend' },
  ];

  /** Đếm số sản phẩm thật theo nhóm lớn (dựa trên section của productCategoryOptions). */
  private refreshCategoryCounts(): void {
    const sectionOf = new Map(this.productCategoryOptions.map(o => [o.value as string, o.section]));
    for (const cat of this.categories) {
      // Danh mục admin tự thêm (không thuộc 4 nhóm lớn) giữ nguyên số đã nhập.
      if (!this.productCategoryOptions.some(o => o.section === cat.name)) continue;
      cat.productCount = this.products.filter(p => sectionOf.get(p.category) === cat.name).length;
    }
  }
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
  /** Ô nhập lý do huỷ trong modal chi tiết đơn (hiện khi bấm "Huỷ đơn"). */
  cancellingOrder = false;
  cancelOrderReason = '';
  readonly cancelOrderReasons = [
    'Khách yêu cầu huỷ',
    'Không liên lạc được khách',
    'Hết hàng / hết vật liệu in',
    'Đơn trùng hoặc đặt nhầm',
    'Nghi ngờ đơn ảo',
  ];
  readonly returnReasons = [
    'Khách không nghe máy khi giao',
    'Khách từ chối nhận hàng',
    'Sai địa chỉ / không tìm được nhà',
    'Hàng hư hỏng khi vận chuyển',
  ];
  /** Giao thất bại: đang nhập lý do trong modal. */
  returningOrder = false;
  returnOrderReason = '';
  /** Tạo vận đơn: hãng gợi ý cho đơn đang mở + form nhập. */
  shippingOptions: ShippingOptions | null = null;
  shipForm = { carrier: '', trackingCode: '', fee: 0, note: '' };
  shipping = false;

  /** 4 bước sản xuất cho đơn có sản phẩm in 3D theo yêu cầu. */
  readonly productionSteps: ProductionStepOption[] = [
    { step: 'FILE_PREPARATION', label: 'Chuẩn bị file', title: 'Đã tiếp nhận file mô hình 3D', percent: 20, notes: 'File STL/3MF đã sẵn sàng' },
    { step: '3D_PRINTING', label: 'Đang in 3D', title: 'Đang in 3D với độ nét cao', percent: 55, notes: 'Máy in Bambu Lab đang in' },
    { step: 'POST_PROCESSING', label: 'Xử lý bề mặt', title: 'Đang xử lý bề mặt & hoàn thiện', percent: 80, notes: 'Chà nhám và phủ satin' },
    { step: 'PACKAGING', label: 'Đóng gói', title: 'Đã đóng gói, chờ bàn giao vận chuyển', percent: 95, notes: 'Đã dán tem bảo hành Luméa' },
  ];

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
  customerSearch = '';
  customerFilter: CustomerFilter = 'ALL';
  selectedCustomer: CustomerSummary | null = null;
  showCustomerModal = false;

  // 9. Đánh giá sản phẩm (dữ liệu thật từ Product.reviews)
  reviews: AdminReview[] = [];
  reviewFilter: ReviewFilter = 'NEEDS_ACTION';
  reviewStarFilter: 'ALL' | number = 'ALL';
  reviewSearch = '';
  reviewReplyInputs: { [key: string]: string } = {};
  /** Đánh giá đang mở ô soạn/sửa phản hồi. */
  replyingReviewId: string | null = null;
  hidingReview: AdminReview | null = null;
  hideReviewReason = '';
  readonly hideReviewReasons = [
    'Ngôn từ thô tục / xúc phạm',
    'Spam hoặc quảng cáo',
    'Lộ thông tin cá nhân',
    'Đánh giá nhầm sản phẩm',
    'Nội dung không liên quan',
  ];
  readonly reviewReplyTemplates = [
    'Cảm ơn bạn đã tin chọn Luméa! Rất vui vì sản phẩm làm bạn hài lòng.',
    'Luméa rất tiếc về trải nghiệm chưa tốt của bạn. Bộ phận CSKH sẽ liên hệ để hỗ trợ đổi/trả ngay ạ.',
    'Cảm ơn góp ý của bạn, xưởng in 3D sẽ cải thiện ở các lô sản phẩm tiếp theo.',
  ];

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

  // 12. Cộng đồng — bài khách đăng ở my-client (GET /community/admin, gồm cả bài bị chặn/ẩn)
  communityPosts: CommunityPost[] = [];
  communityFilter: CommunityFilter = 'TODAY';
  communitySearch = '';
  /** Bài đang mở modal "Ẩn bài" để nhập lý do. */
  hidingPost: CommunityPost | null = null;
  hideReason = '';
  readonly hideReasonPresets = [
    'Ảnh không liên quan đến decor / nội thất',
    'Spam hoặc quảng cáo',
    'Ngôn từ không phù hợp',
    'Hình ảnh vi phạm bản quyền',
    'Lộ thông tin cá nhân',
  ];

  // 12b. Tin nhắn hỗ trợ — khung chat của khách trên my-client (socket.io)
  chatSearch = '';
  chatDraft = '';
  readonly chatQuickReplies = [
    'Chào bạn, Luméa có thể hỗ trợ gì cho bạn ạ?',
    'Bạn cho mình xin mã đơn hàng để kiểm tra nhé.',
    'Đơn của bạn đang được in 3D, dự kiến giao trong 3–5 ngày ạ.',
    'Cảm ơn bạn đã liên hệ Luméa!',
  ];
  @ViewChild('chatScroll') chatScroll?: ElementRef<HTMLDivElement>;

  // 13. Tin tức — nhân viên soạn, client đọc ở /news
  articles: NewsArticle[] = [];
  articleSearch = '';
  articleCategoryFilter: ArticleCategory | 'ALL' = 'ALL';
  readonly articleCategories: ArticleCategory[] = ARTICLE_CATEGORIES;
  showArticleModal = false;
  editingArticle: NewsArticle | null = null;
  articleForm = this.emptyArticleForm();
  savingArticle = false;

  // 13b. Video trang chủ — nhân viên đăng, client phát ở mục video
  videos: Video[] = [];
  showVideoModal = false;
  editingVideo: Video | null = null;
  videoForm = this.emptyVideoForm();
  savingVideo = false;

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
    private communityService: CommunityService,
    private newsService: NewsService,
    private videoService: VideoService,
    public chatService: ChatService,
    private reviewService: ReviewService,
    public adminAuth: AdminAuthService,
    private router: Router
  ) {
    effect(() => {
      this.products = this.productService.products();
      this.customizableProductsCount = this.products.filter(p => p.customizable).length;
      this.refreshCategoryCounts();
    });
    effect(() => {
      this.customRequests = this.customRequestService.requests();
      this.pendingRequestsCount = this.customRequests.filter(r => r.status === 'PENDING_REVIEW').length;
    });
    effect(() => {
      this.rooms = this.roomService.rooms();
    });
    effect(() => {
      this.communityPosts = this.communityService.posts();
    });
    effect(() => {
      this.articles = this.newsService.articles();
    });
    effect(() => {
      this.videos = this.videoService.videos();
    });
    effect(() => {
      this.reviews = this.reviewService.reviews();
    });
    // Có tin mới trong hội thoại đang mở thì cuộn xuống cuối (chờ Angular vẽ tin mới xong).
    effect(() => {
      this.chatService.activeMessages();
      setTimeout(() => {
        const el = this.chatScroll?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnInit(): void {
    this.refreshData();
    this.chatService.connect();
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  refreshData(): void {
    this.communityService.refresh();
    this.newsService.refresh();
    this.videoService.refresh();
    this.reviewService.refresh();
    this.orderService.fetchAll().subscribe(orders => {
      this.orders = orders;
      // Doanh thu không tính đơn đã huỷ.
      this.totalRevenue = this.orders.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + o.total, 0);
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

  logout(): void {
    this.recordAudit('Hệ Thống', 'Đăng xuất', 'Đăng xuất khỏi hệ thống', 'INFO');
    this.adminAuth.logout();
    this.router.navigate(['/login']);
  }

  // --- Đếm cho thẻ thống kê dạng bộ lọc (pattern stat-card của my-admin-vita) ---
  private matchesOrderFilter(o: Order, filter: 'ALL' | OrderStatus): boolean {
    return filter === 'ALL' || o.status === filter;
  }

  orderCount(status: 'ALL' | OrderStatus): number {
    return this.orders.filter(o => this.matchesOrderFilter(o, status)).length;
  }

  /** Đơn cần nhân viên làm gì đó ngay: khách báo đã chuyển khoản chờ đối soát. */
  get transferToVerifyCount(): number {
    return this.orders.filter(o => o.transferReportedAt && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED').length;
  }

  /** Đơn COD đã giao, shipper đã thu tiền nhưng chưa đối soát với hãng vận chuyển. */
  get codToReconcile(): { count: number; amount: number } {
    const list = this.orders.filter(o => o.paymentMethod === 'COD' && o.status === 'DELIVERED' && o.paymentStatus !== 'PAID');
    return { count: list.length, amount: list.reduce((sum, o) => sum + o.total, 0) };
  }

  /** Số đơn trước đây của cùng SĐT bị giao thất bại (bom hàng) — cảnh báo khi gọi xác nhận đơn COD. */
  customerReturnCount(o: Order): number {
    const phone = o.shippingAddress?.phone;
    if (!phone) return 0;
    return this.orders.filter(x => x.orderNumber !== o.orderNumber && x.status === 'RETURNED' && x.shippingAddress?.phone === phone).length;
  }

  customRequestCount(status: 'ALL' | CustomRequestStatus): number {
    return status === 'ALL' ? this.customRequests.length : this.customRequests.filter(r => r.status === status).length;
  }

  inventoryCount(status: string): number {
    return status === 'ALL' ? this.inventoryItems.length : this.inventoryItems.filter(i => i.status === status).length;
  }

  customerCount(filter: CustomerFilter): number {
    return this.customers.filter(c => this.matchesCustomerFilter(c, filter)).length;
  }

  private matchesReviewFilter(r: AdminReview, filter: ReviewFilter): boolean {
    switch (filter) {
      case 'NEEDS_ACTION': return r.status !== 'HIDDEN' && r.rating <= 2 && !r.reply?.text;
      case 'UNREPLIED': return r.status !== 'HIDDEN' && !r.reply?.text;
      case 'PINNED': return !!r.pinned && r.status !== 'HIDDEN';
      case 'HIDDEN': return r.status === 'HIDDEN';
      default: return true;
    }
  }

  reviewCount(filter: ReviewFilter): number {
    return this.reviews.filter(r => this.matchesReviewFilter(r, filter)).length;
  }

  /** Điểm trung bình & phân bố sao, chỉ tính đánh giá đang hiển thị (giống khách nhìn thấy). */
  get reviewStats(): { average: number; total: number; byStar: { star: number; count: number; percent: number }[] } {
    const visible = this.reviews.filter(r => r.status !== 'HIDDEN');
    const total = visible.length;
    const average = total ? visible.reduce((sum, r) => sum + r.rating, 0) / total : 0;
    const byStar = [5, 4, 3, 2, 1].map(star => {
      const count = visible.filter(r => r.rating === star).length;
      return { star, count, percent: total ? Math.round((count / total) * 100) : 0 };
    });
    return { average, total, byStar };
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
    const q = this.orderSearch.toLowerCase().trim();
    return this.orders.filter(o => {
      const matchSearch = !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
        (o.shippingAddress?.phone || '').includes(q);
      return this.matchesOrderFilter(o, this.orderFilter) && matchSearch;
    });
  }

  orderStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      PENDING: 'Chờ gọi xác nhận',
      CONFIRMED: 'Chờ giao',
      IN_PRODUCTION: 'Đang in 3D',
      SHIPPED: 'Đang giao',
      DELIVERED: 'Hoàn thành',
      CANCELLED: 'Đã huỷ',
      RETURNED: 'Hoàn hàng',
    };
    return labels[status] || status;
  }

  orderStatusClass(status: OrderStatus): string {
    const classes: Record<OrderStatus, string> = {
      PENDING: 'bg-[#FEF3C7] text-[#92400E]',
      CONFIRMED: 'bg-[#EEF4F8] text-[#355C7D]',
      IN_PRODUCTION: 'bg-[#FEF3C7] text-[#92400E]',
      SHIPPED: 'bg-[#EEF4F8] text-[#355C7D]',
      DELIVERED: 'bg-[#EDF7F1] text-[#2D6A4F]',
      CANCELLED: 'bg-[#EFE6D3] text-[#7A6F67]',
      RETURNED: 'bg-[#F9F1F2] text-[#9E2A2B]',
    };
    return classes[status] || '';
  }

  paymentMethodLabel(method: Order['paymentMethod'] | string): string {
    const labels: Record<string, string> = { COD: 'COD', BANK_TRANSFER: 'Chuyển khoản', MOMO: 'MoMo', ZALOPAY: 'ZaloPay', VNPAY: 'VNPay', ATM: 'Thẻ ATM' };
    return labels[method] || method;
  }

  /** Nhãn thanh toán: đã trả / thất bại / khách báo đã chuyển khoản / chưa trả. */
  paymentStatusLabel(o: Order): string {
    if (o.paymentStatus === 'PAID') return 'Đã thanh toán';
    if (o.paymentStatus === 'FAILED') return 'Thanh toán lỗi';
    if (o.status === 'CANCELLED' || o.status === 'RETURNED') return 'Không thu';
    if (o.paymentMethod === 'COD' && o.status === 'DELIVERED') return 'Chờ đối soát COD';
    if (o.transferReportedAt) return 'Khách báo đã CK';
    return o.paymentMethod === 'COD' ? 'Thu khi giao' : 'Chưa thanh toán';
  }

  paymentStatusClass(o: Order): string {
    if (o.paymentStatus === 'PAID') return 'bg-[#EDF7F1] text-[#2D6A4F]';
    if (o.paymentStatus === 'FAILED') return 'bg-[#F9F1F2] text-[#9E2A2B]';
    if (o.status === 'CANCELLED' || o.status === 'RETURNED') return 'bg-[#EFE6D3] text-[#7A6F67]';
    if (o.paymentMethod === 'COD' && o.status === 'DELIVERED') return 'bg-[#EEF4F8] text-[#355C7D]';
    if (o.transferReportedAt) return 'bg-[#EEF4F8] text-[#355C7D]';
    return 'bg-[#FEF3C7] text-[#92400E]';
  }

  /** Ngày đặt dễ đọc — backend có sẵn createdAtLabel ("25/09/2026 18:34"). */
  orderDateLabel(o: Order): string {
    if (o.createdAtLabel) return o.createdAtLabel;
    const d = new Date(o.createdAt);
    return isNaN(d.getTime()) ? o.createdAt : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  isOrderFinal(o: Order): boolean {
    return o.status === 'DELIVERED' || o.status === 'CANCELLED' || o.status === 'RETURNED';
  }

  /** Đơn đã sẵn sàng tạo vận đơn: (COD) đã gọi xác nhận, và đơn in 3D đã tới bước Đóng gói. */
  canShip(o: Order): boolean {
    if (o.paymentMethod === 'COD' && !o.phoneConfirmedAt) return false;
    if (o.status === 'CONFIRMED') return true;
    return o.status === 'IN_PRODUCTION' && this.isProductionStepDone(o, 'PACKAGING');
  }

  /** Bước sản xuất đã đạt tới (để tô các bước đã xong trong modal). */
  isProductionStepDone(o: Order, step: ProductionStep): boolean {
    const order: ProductionStep[] = ['FILE_PREPARATION', '3D_PRINTING', 'POST_PROCESSING', 'ASSEMBLY_TESTING', 'PACKAGING', 'DISPATCHED'];
    const current = o.productionProgress?.currentStep;
    return !!current && order.indexOf(current) >= order.indexOf(step);
  }

  viewOrderDetail(order: Order): void {
    this.selectedOrder = order;
    this.cancellingOrder = false;
    this.cancelOrderReason = '';
    this.returningOrder = false;
    this.returnOrderReason = '';
    this.showOrderDetailModal = true;
    this.loadShippingOptions(order);
  }

  private loadShippingOptions(order: Order): void {
    this.shippingOptions = null;
    this.shipForm = { carrier: '', trackingCode: '', fee: 0, note: '' };
    if (!this.canShip(order) && order.status !== 'PENDING') return;
    this.orderService.getShippingOptions(order.orderNumber).subscribe({
      next: (opts) => {
        if (this.selectedOrder?.orderNumber !== order.orderNumber) return;
        this.shippingOptions = opts;
        this.shipForm.carrier = opts.carriers.find(c => c.suitable)?.id || '';
      },
    });
  }

  confirmOrderPhone(o: Order): void {
    this.applyOrderUpdate(this.orderService.confirmPhone(o.orderNumber), `Đã xác nhận đơn ${o.orderNumber} với khách`, 'Gọi xác nhận đơn COD');
  }

  /** Không gọi được khách: mở sẵn ô huỷ với lý do tương ứng. */
  cannotReachCustomer(): void {
    this.cancellingOrder = true;
    this.cancelOrderReason = 'Không liên lạc được khách';
  }

  /** Cập nhật đơn và đồng bộ lại modal đang mở theo dữ liệu server trả về. */
  private applyOrderUpdate(request: ReturnType<OrderService['updateOrderStatus']>, message: string, audit: string): void {
    request.subscribe({
      next: (updated) => {
        this.refreshData();
        if (this.selectedOrder?.orderNumber === updated.orderNumber) {
          this.selectedOrder = updated;
          if (this.canShip(updated) && !this.shippingOptions) this.loadShippingOptions(updated);
        }
        this.showToast(message, 'success');
        this.recordAudit('Đơn Hàng', audit, `Đơn ${updated.orderNumber}`, 'SUCCESS');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được đơn hàng', 'error'),
    });
  }

  setProductionStep(o: Order, step: ProductionStepOption): void {
    this.applyOrderUpdate(
      this.orderService.updateOrderStatus(o.orderNumber, 'IN_PRODUCTION', {
        currentStep: step.step,
        percentage: step.percent,
        stepTitle: step.title,
        notes: step.notes,
        updatedAt: this.nowLabel(),
      }),
      `Đơn ${o.orderNumber}: ${step.title} (${step.percent}%)`,
      `Cập nhật tiến độ in 3D: ${step.label}`
    );
  }

  /** Tạo vận đơn với hãng đã chọn → đơn chuyển sang "Đang giao". */
  submitShipment(o: Order): void {
    if (!this.shipForm.carrier || this.shipping) return;
    this.shipping = true;
    this.orderService.ship(o.orderNumber, { ...this.shipForm, fee: Number(this.shipForm.fee) || 0 }).subscribe({
      next: (updated) => {
        this.shipping = false;
        this.refreshData();
        this.selectedOrder = updated;
        this.showToast(`Đã tạo vận đơn ${updated.shipment?.carrierName} ${updated.shipment?.trackingCode || ''}`, 'success');
        this.recordAudit('Đơn Hàng', 'Tạo vận đơn', `Đơn ${o.orderNumber} — ${updated.shipment?.carrierName} ${updated.shipment?.trackingCode || ''}`, 'SUCCESS');
      },
      error: (err) => {
        this.shipping = false;
        this.showToast(err?.error?.error || 'Không tạo được vận đơn', 'error');
      },
    });
  }

  confirmReturnOrder(o: Order): void {
    const reason = this.returnOrderReason.trim();
    if (!reason) return;
    this.applyOrderUpdate(this.orderService.updateOrderStatus(o.orderNumber, 'RETURNED', undefined, reason), `Đơn ${o.orderNumber} giao thất bại — hàng hoàn về kho`, `Giao thất bại: ${reason}`);
    this.returningOrder = false;
  }

  markOrderDelivered(o: Order): void {
    const codNote = o.paymentMethod === 'COD' ? ' Shipper đã thu tiền COD (còn chờ đối soát với hãng).' : '';
    if (!confirm(`Xác nhận đơn ${o.orderNumber} đã giao thành công?${codNote} Khách sẽ được cộng Xu thưởng và đơn không sửa được nữa.`)) return;
    this.applyOrderUpdate(this.orderService.updateOrderStatus(o.orderNumber, 'DELIVERED'), `Đơn ${o.orderNumber} đã hoàn thành`, 'Giao thành công');
  }

  confirmCancelOrder(o: Order): void {
    const reason = this.cancelOrderReason.trim();
    if (!reason) return;
    this.applyOrderUpdate(this.orderService.updateOrderStatus(o.orderNumber, 'CANCELLED', undefined, reason), `Đã huỷ đơn ${o.orderNumber}`, `Huỷ đơn: ${reason}`);
    this.cancellingOrder = false;
  }

  setOrderPaid(o: Order, paid: boolean): void {
    this.orderService.setPaymentStatus(o.orderNumber, paid ? 'PAID' : 'UNPAID').subscribe({
      next: (updated) => {
        this.refreshData();
        if (this.selectedOrder?.orderNumber === updated.orderNumber) this.selectedOrder = updated;
        this.showToast(paid ? `Đã xác nhận nhận tiền đơn ${o.orderNumber}` : 'Đã chuyển về chưa thanh toán', paid ? 'success' : 'info');
        this.recordAudit('Đơn Hàng', paid ? 'Xác nhận đã thanh toán' : 'Huỷ xác nhận thanh toán', `Đơn ${o.orderNumber}`, paid ? 'SUCCESS' : 'WARNING');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được thanh toán', 'error'),
    });
  }

  private nowLabel(): string {
    const now = new Date();
    return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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

  // --- Customers (tổng hợp từ đơn hàng, chỉ đọc) ---
  /** Gom đơn theo SĐT người nhận: mỗi SĐT là 1 khách, tên/email lấy theo đơn gần nhất. */
  get customers(): CustomerSummary[] {
    const byPhone = new Map<string, Order[]>();
    for (const o of this.orders) {
      const phone = (o.shippingAddress?.phone || '').replace(/\s+/g, '');
      if (!phone) continue;
      byPhone.set(phone, [...(byPhone.get(phone) || []), o]);
    }
    return [...byPhone.entries()].map(([phone, orders]) => {
      const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = sorted[0];
      const delivered = orders.filter(o => o.status === 'DELIVERED');
      return {
        phone,
        name: latest.shippingAddress.fullName,
        email: latest.shippingAddress.email || '',
        city: latest.shippingAddress.city,
        hasAccount: orders.some(o => !!o.userId),
        orders: sorted,
        deliveredCount: delivered.length,
        returnedCount: orders.filter(o => o.status === 'RETURNED').length,
        cancelledCount: orders.filter(o => o.status === 'CANCELLED').length,
        openCount: orders.filter(o => !this.isOrderFinal(o)).length,
        totalSpend: delivered.reduce((sum, o) => sum + o.total, 0),
        firstOrderAt: sorted[sorted.length - 1].createdAt,
        lastOrderAt: latest.createdAt,
      };
    }).sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime());
  }

  private matchesCustomerFilter(c: CustomerSummary, filter: CustomerFilter): boolean {
    switch (filter) {
      case 'LOYAL': return c.deliveredCount >= 2;
      case 'NEW': return c.orders.length === 1;
      case 'RISK': return c.returnedCount > 0;
      case 'ACCOUNT': return c.hasAccount;
      default: return true;
    }
  }

  get filteredCustomers(): CustomerSummary[] {
    const q = this.customerSearch.toLowerCase().trim();
    return this.customers.filter(c =>
      this.matchesCustomerFilter(c, this.customerFilter) &&
      (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q))
    );
  }

  /** Tỉ lệ nhận hàng thành công trên các đơn đã có kết quả giao — dùng đánh giá rủi ro COD. */
  customerSuccessRate(c: CustomerSummary): number | null {
    const finished = c.deliveredCount + c.returnedCount;
    return finished ? Math.round((c.deliveredCount / finished) * 100) : null;
  }

  viewCustomerDetail(c: CustomerSummary): void {
    this.selectedCustomer = c;
    this.showCustomerModal = true;
  }

  openCustomerOrder(o: Order): void {
    this.showCustomerModal = false;
    this.activeTab = 'orders';
    this.viewOrderDetail(o);
  }

  // --- Dashboard (tính từ đơn hàng & sản phẩm thật) ---
  /** Đơn tính doanh thu: bỏ đơn huỷ và đơn giao thất bại. */
  private isRevenueOrder(o: Order): boolean {
    return o.status !== 'CANCELLED' && o.status !== 'RETURNED';
  }

  /** Doanh số 7 ngày gần nhất (hôm nay là cột cuối), chiều cao cột theo ngày cao nhất. */
  get weeklySales(): { day: string; date: string; amount: number; orders: number; height: string; isPeak: boolean }[] {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.today);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const rows = days.map(d => {
      const list = this.orders.filter(o => this.isRevenueOrder(o) && new Date(o.createdAt).toDateString() === d.toDateString());
      return {
        day: d.getDay() === 0 ? 'CN' : 'T' + (d.getDay() + 1),
        date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        amount: list.reduce((sum, o) => sum + o.total, 0),
        orders: list.length,
      };
    });
    const max = Math.max(...rows.map(r => r.amount));
    return rows.map(r => ({
      ...r,
      // Ngày không có đơn vẫn hiện 1 vạch mỏng để biết là 0 chứ không phải lỗi.
      height: max > 0 ? Math.max(2, Math.round((r.amount / max) * 95)) + '%' : '2%',
      isPeak: max > 0 && r.amount === max,
    }));
  }

  get weekTotal(): number {
    return this.weeklySales.reduce((sum, r) => sum + r.amount, 0);
  }

  get weekPeak(): { day: string; date: string; amount: number; orders: number } | null {
    const peak = this.weeklySales.find(r => r.isPeak);
    return peak || null;
  }

  /** Doanh thu tháng này so với tháng trước (cả tháng). */
  get monthRevenue(): { current: number; previous: number; changePct: number | null } {
    const now = this.today;
    const sumMonth = (year: number, month: number) => this.orders
      .filter(o => {
        const d = new Date(o.createdAt);
        return this.isRevenueOrder(o) && d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, o) => sum + o.total, 0);
    const current = sumMonth(now.getFullYear(), now.getMonth());
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = sumMonth(prevDate.getFullYear(), prevDate.getMonth());
    return { current, previous, changePct: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null };
  }

  /** Số đơn đang ở từng bước của xưởng in 3D. */
  get printQueue(): { label: string; hint: string; count: number }[] {
    const inProduction = this.orders.filter(o => o.status === 'IN_PRODUCTION');
    const count = (steps: ProductionStep[]) => inProduction.filter(o => steps.includes(o.productionProgress?.currentStep as ProductionStep)).length;
    return [
      { label: '1. Chuẩn bị file & slicing', hint: 'Kiểm tra file, xuất G-code', count: count(['FILE_PREPARATION']) },
      { label: '2. Đang chạy máy in', hint: 'Máy FDM/SLA đang in', count: count(['3D_PRINTING']) },
      { label: '3. Xử lý bề mặt', hint: 'Chà nhám, phủ satin', count: count(['POST_PROCESSING', 'ASSEMBLY_TESTING']) },
      { label: '4. Đóng gói, chờ giao', hint: 'Kiểm tra chất lượng & tem', count: count(['PACKAGING']) },
    ];
  }

  get stockAlerts(): { outOfStock: Product[]; lowStock: Product[] } {
    return {
      outOfStock: this.products.filter(p => (p.inStock ?? 0) <= 0),
      lowStock: this.products.filter(p => (p.inStock ?? 0) > 0 && p.inStock <= this.LOW_STOCK_THRESHOLD),
    };
  }

  // --- Đánh giá ---
  get filteredReviews(): AdminReview[] {
    const q = this.reviewSearch.trim().toLowerCase();
    return this.reviews.filter(r =>
      this.matchesReviewFilter(r, this.reviewFilter) &&
      (this.reviewStarFilter === 'ALL' || r.rating === this.reviewStarFilter) &&
      (!q || r.productName.toLowerCase().includes(q) || r.author.toLowerCase().includes(q) || r.comment.toLowerCase().includes(q))
    );
  }

  reviewClientUrl(r: AdminReview): string {
    return `${this.clientAppUrl}/product/${r.productSlug}`;
  }

  startReply(r: AdminReview): void {
    this.replyingReviewId = r.id;
    this.reviewReplyInputs[r.id] = r.reply?.text || '';
  }

  saveReviewReply(r: AdminReview): void {
    const text = (this.reviewReplyInputs[r.id] || '').trim();
    if (!text) return;
    const isEdit = !!r.reply?.text;
    this.reviewService.update(r, { reply: text }).subscribe({
      next: () => {
        this.replyingReviewId = null;
        this.reviewReplyInputs[r.id] = '';
        this.showToast(isEdit ? 'Đã cập nhật phản hồi' : 'Đã đăng phản hồi — khách thấy ngay dưới đánh giá', 'success');
        this.recordAudit('Đánh Giá', isEdit ? 'Sửa phản hồi đánh giá' : 'Phản hồi đánh giá', `${r.author} — ${r.productName}`, 'INFO');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không lưu được phản hồi', 'error'),
    });
  }

  deleteReviewReply(r: AdminReview): void {
    if (!confirm('Xoá phản hồi của Luméa cho đánh giá này?')) return;
    this.reviewService.update(r, { reply: '' }).subscribe({
      next: () => this.showToast('Đã xoá phản hồi', 'info'),
      error: (err) => this.showToast(err?.error?.error || 'Không xoá được phản hồi', 'error'),
    });
  }

  toggleReviewPinned(r: AdminReview): void {
    this.reviewService.update(r, { pinned: !r.pinned }).subscribe({
      next: (updated) => this.showToast(updated.pinned ? 'Đã ghim — đánh giá hiện đầu trang sản phẩm' : 'Đã bỏ ghim', 'info'),
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được đánh giá', 'error'),
    });
  }

  openHideReview(r: AdminReview): void {
    this.hidingReview = r;
    this.hideReviewReason = this.hideReviewReasons[0];
  }

  confirmHideReview(): void {
    const r = this.hidingReview;
    if (!r) return;
    this.reviewService.update(r, { status: 'HIDDEN', hiddenReason: this.hideReviewReason.trim() }).subscribe({
      next: () => {
        this.hidingReview = null;
        this.showToast(`Đã ẩn đánh giá của ${r.author}`, 'info');
        this.recordAudit('Đánh Giá', 'Ẩn đánh giá', `${r.author} — ${r.productName}: ${this.hideReviewReason}`, 'WARNING');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không ẩn được đánh giá', 'error'),
    });
  }

  showReviewAgain(r: AdminReview): void {
    this.reviewService.update(r, { status: 'VISIBLE' }).subscribe({
      next: () => {
        this.showToast('Đánh giá đã hiển thị lại', 'success');
        this.recordAudit('Đánh Giá', 'Hiện lại đánh giá', `${r.author} — ${r.productName}`, 'SUCCESS');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được đánh giá', 'error'),
    });
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

  // --- Cộng đồng (kiểm duyệt) ---
  private isPostedToday(post: CommunityPost): boolean {
    if (!post.postedAt) return false;
    return new Date(post.postedAt).toDateString() === this.today.toDateString();
  }

  private matchesCommunityFilter(post: CommunityPost, filter: CommunityFilter): boolean {
    switch (filter) {
      case 'TODAY': return this.isPostedToday(post);
      case 'STAFF_PICK': return !!post.isStaffPick;
      case 'ALL': return true;
      default: return (post.status || 'PUBLISHED') === filter;
    }
  }

  communityCount(filter: CommunityFilter): number {
    return this.communityPosts.filter(p => this.matchesCommunityFilter(p, filter)).length;
  }

  get filteredCommunityPosts(): CommunityPost[] {
    const q = this.communitySearch.trim().toLowerCase();
    return this.communityPosts.filter(p =>
      this.matchesCommunityFilter(p, this.communityFilter) &&
      (!q || p.title.toLowerCase().includes(q) || (p.caption || '').toLowerCase().includes(q) || (p.author?.name || '').toLowerCase().includes(q))
    );
  }

  /** Bài bị bộ lọc tự động chặn — nhân viên nên xem lại vì có thể chặn nhầm. */
  get rejectedPostsCount(): number {
    return this.communityCount('REJECTED');
  }

  toggleStaffPick(post: CommunityPost): void {
    this.communityService.moderate(post.id, { isStaffPick: !post.isStaffPick }).subscribe({
      next: (updated) => {
        this.showToast(updated.isStaffPick ? 'Đã gắn nhãn Staff Pick cho bài đăng' : 'Đã bỏ nhãn Staff Pick', 'info');
        this.recordAudit('Cộng Đồng', 'Gắn nhãn Staff Pick', `${post.title}: ${updated.isStaffPick}`, 'INFO');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được bài đăng', 'error'),
    });
  }

  openHidePost(post: CommunityPost): void {
    this.hidingPost = post;
    this.hideReason = this.hideReasonPresets[0];
  }

  confirmHidePost(): void {
    const post = this.hidingPost;
    if (!post) return;
    this.communityService.moderate(post.id, { status: 'HIDDEN', reason: this.hideReason.trim() }).subscribe({
      next: () => {
        this.hidingPost = null;
        this.showToast(`Đã ẩn bài của ${post.author?.name || 'khách hàng'} và gửi thông báo cho người đăng`, 'info');
        this.recordAudit('Cộng Đồng', 'Ẩn bài đăng', `${post.title} — ${this.hideReason}`, 'WARNING');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không ẩn được bài đăng', 'error'),
    });
  }

  /** Hiển thị lại bài đã ẩn, hoặc duyệt bài bị bộ lọc tự động chặn nhầm. */
  publishCommunityPost(post: CommunityPost): void {
    const wasRejected = post.status === 'REJECTED';
    this.communityService.moderate(post.id, { status: 'PUBLISHED' }).subscribe({
      next: () => {
        this.showToast(wasRejected ? 'Đã duyệt bài — bài hiện đã hiển thị trên Cộng đồng' : 'Đã hiển thị lại bài đăng', 'success');
        this.recordAudit('Cộng Đồng', wasRejected ? 'Duyệt bài bị chặn tự động' : 'Hiển thị lại bài đăng', post.title, 'SUCCESS');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được bài đăng', 'error'),
    });
  }

  deleteCommunityPost(post: CommunityPost): void {
    if (!confirm(`Xoá vĩnh viễn bài "${post.title}"? Thao tác này không hoàn tác được.`)) return;
    this.communityService.delete(post.id).subscribe({
      next: () => {
        this.showToast('Đã xoá bài đăng', 'info');
        this.recordAudit('Cộng Đồng', 'Xoá bài đăng', post.title, 'WARNING');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không xoá được bài đăng', 'error'),
    });
  }

  // --- Tin nhắn hỗ trợ ---
  get filteredChatSessions(): ChatSession[] {
    const q = this.chatSearch.trim().toLowerCase();
    const sessions = this.chatService.sessions();
    if (!q) return sessions;
    return sessions.filter(s =>
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.customerPhone || '').includes(q) ||
      s.lastText.toLowerCase().includes(q)
    );
  }

  /** Tên hiển thị: khách đã đăng nhập thì lấy tên, khách vãng lai thì lấy 4 số cuối mã phiên. */
  chatDisplayName(session: ChatSession | null): string {
    if (!session) return '';
    return session.customerName || session.customerPhone || `Khách vãng lai #${session.sessionId.slice(-4)}`;
  }

  /** Giờ nếu là hôm nay, ngày/tháng nếu cũ hơn. */
  chatTimeLabel(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  openChat(session: ChatSession): void {
    this.chatService.openSession(session.sessionId);
    this.chatDraft = '';
  }

  sendChat(): void {
    if (!this.chatDraft.trim()) return;
    this.chatService.send(this.chatDraft);
    this.chatDraft = '';
  }

  // --- Tin tức ---
  private emptyArticleForm() {
    return {
      title: '',
      category: 'Xu hướng' as ArticleCategory,
      excerpt: '',
      content: '',
      coverImage: '',
      videoUrl: '',
      readTime: '5 phút đọc',
      authorName: 'Luméa Editorial',
      authorRole: 'Biên tập viên Luméa',
      tags: '',
      featured: false,
    };
  }

  get filteredArticles(): NewsArticle[] {
    const q = this.articleSearch.trim().toLowerCase();
    return this.articles.filter(a =>
      (this.articleCategoryFilter === 'ALL' || a.category === this.articleCategoryFilter) &&
      (!q || a.title.toLowerCase().includes(q) || (a.author?.name || '').toLowerCase().includes(q))
    );
  }

  get totalArticleViews(): number {
    return this.articles.reduce((sum, a) => sum + (a.viewsCount || 0), 0);
  }

  get featuredArticlesCount(): number {
    return this.articles.filter(a => a.featured).length;
  }

  openAddArticleModal(): void {
    this.editingArticle = null;
    this.articleForm = { ...this.emptyArticleForm(), authorName: this.adminAuth.currentAdmin()?.fullName || 'Luméa Editorial' };
    this.showArticleModal = true;
  }

  openEditArticle(art: NewsArticle): void {
    this.editingArticle = art;
    this.articleForm = {
      title: art.title,
      category: art.category,
      excerpt: art.excerpt || '',
      content: art.content || '',
      coverImage: art.coverImage || '',
      videoUrl: art.videoUrl || '',
      readTime: art.readTime || '',
      authorName: art.author?.name || '',
      authorRole: art.author?.role || '',
      tags: (art.tags || []).join(', '),
      featured: !!art.featured,
    };
    this.showArticleModal = true;
  }

  saveArticle(): void {
    const f = this.articleForm;
    if (this.savingArticle) return;
    if (!f.title.trim() || !f.content.trim()) {
      this.showToast('Vui lòng nhập tiêu đề và nội dung bài viết', 'warning');
      return;
    }
    const editing = this.editingArticle;
    const payload = {
      title: f.title.trim(),
      category: f.category,
      excerpt: f.excerpt.trim(),
      content: f.content,
      coverImage: f.coverImage.trim(),
      videoUrl: f.videoUrl.trim() || undefined,
      readTime: f.readTime.trim(),
      featured: f.featured,
      tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
      author: {
        name: f.authorName.trim() || 'Luméa Editorial',
        role: f.authorRole.trim(),
        avatar: editing?.author?.avatar || '',
      },
    };
    this.savingArticle = true;
    const request = editing ? this.newsService.update(editing.id, payload) : this.newsService.create(payload);
    request.subscribe({
      next: (art) => {
        this.savingArticle = false;
        this.showArticleModal = false;
        this.showToast(editing ? `Đã cập nhật bài "${art.title}"` : `Đã đăng bài "${art.title}" lên trang Tin tức`, 'success');
        this.recordAudit('Tin Tức', editing ? 'Sửa bài viết' : 'Đăng bài viết', art.title, 'SUCCESS');
      },
      error: (err) => {
        this.savingArticle = false;
        this.showToast(err?.error?.error || 'Không lưu được bài viết', 'error');
      },
    });
  }

  toggleArticleFeatured(art: NewsArticle): void {
    this.newsService.update(art.id, { featured: !art.featured }).subscribe({
      next: (updated) => this.showToast(updated.featured ? 'Đã đặt làm bài nổi bật' : 'Đã bỏ nổi bật', 'info'),
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được bài viết', 'error'),
    });
  }

  deleteArticle(art: NewsArticle): void {
    if (!confirm(`Xoá bài "${art.title}"? Toàn bộ ý kiến bạn đọc của bài cũng bị xoá.`)) return;
    this.newsService.delete(art.id).subscribe({
      next: () => {
        this.showToast('Đã xoá bài viết', 'info');
        this.recordAudit('Tin Tức', 'Xoá bài viết', art.title, 'WARNING');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không xoá được bài viết', 'error'),
    });
  }

  // --- Video ---
  private emptyVideoForm() {
    return { title: '', description: '', youtubeId: '', poster: '', link: '', ctaLabel: 'Xem thêm', active: true };
  }

  /** ID YouTube đọc từ ô nhập (link đầy đủ, youtu.be, shorts hoặc ID trần) — để xem trước; server tự kiểm tra lại. */
  get previewYoutubeId(): string | null {
    const raw = this.videoForm.youtubeId.trim();
    const match = raw.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
    if (match) return match[1];
    return /^[\w-]{11}$/.test(raw) ? raw : null;
  }

  youtubeThumb(youtubeId: string): string {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  get sortedVideos(): Video[] {
    return [...this.videos].sort((a, b) => a.order - b.order);
  }

  get activeVideosCount(): number {
    return this.videos.filter(v => v.active).length;
  }

  openAddVideoModal(): void {
    this.editingVideo = null;
    this.videoForm = this.emptyVideoForm();
    this.showVideoModal = true;
  }

  openEditVideo(video: Video): void {
    this.editingVideo = video;
    this.videoForm = {
      title: video.title,
      description: video.description || '',
      youtubeId: `https://youtu.be/${video.youtubeId}`,
      poster: video.poster || '',
      link: video.link || '',
      ctaLabel: video.ctaLabel || '',
      active: video.active,
    };
    this.showVideoModal = true;
  }

  saveVideo(): void {
    const f = this.videoForm;
    if (this.savingVideo) return;
    if (!f.title.trim() || !f.youtubeId.trim()) {
      this.showToast('Vui lòng nhập tiêu đề và link YouTube', 'warning');
      return;
    }
    const editing = this.editingVideo;
    const payload = { ...f, title: f.title.trim(), youtubeId: f.youtubeId.trim() };
    this.savingVideo = true;
    const request = editing ? this.videoService.update(editing.id, payload) : this.videoService.create(payload);
    request.subscribe({
      next: (video) => {
        this.savingVideo = false;
        this.showVideoModal = false;
        this.showToast(editing ? `Đã cập nhật video "${video.title}"` : `Đã đăng video "${video.title}" lên trang chủ`, 'success');
        this.recordAudit('Video', editing ? 'Sửa video' : 'Đăng video', video.title, 'SUCCESS');
      },
      error: (err) => {
        this.savingVideo = false;
        this.showToast(err?.error?.error || 'Không lưu được video', 'error');
      },
    });
  }

  toggleVideoActive(video: Video): void {
    this.videoService.update(video.id, { active: !video.active }).subscribe({
      next: (updated) => this.showToast(updated.active ? 'Video đã hiển thị trên trang chủ' : 'Đã ẩn video khỏi trang chủ', 'info'),
      error: (err) => this.showToast(err?.error?.error || 'Không cập nhật được video', 'error'),
    });
  }

  /** Đổi chỗ với video liền trước/sau. Dữ liệu cũ có thể trùng order nên lấy vị trí trong danh
   *  sách đã sắp làm thứ tự mới cho cả hai video. */
  moveVideo(video: Video, direction: -1 | 1): void {
    const sorted = this.sortedVideos;
    const index = sorted.findIndex(v => v.id === video.id);
    const other = sorted[index + direction];
    if (!other) return;
    this.videoService.update(video.id, { order: index + direction + 1 }).subscribe();
    this.videoService.update(other.id, { order: index + 1 }).subscribe();
  }

  deleteVideo(video: Video): void {
    if (!confirm(`Xoá video "${video.title}" khỏi trang chủ?`)) return;
    this.videoService.delete(video.id).subscribe({
      next: () => {
        this.showToast('Đã xoá video', 'info');
        this.recordAudit('Video', 'Xoá video', video.title, 'WARNING');
      },
      error: (err) => this.showToast(err?.error?.error || 'Không xoá được video', 'error'),
    });
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

  /** Tổng số món trong đơn (cộng dồn số lượng). */
  orderItemQuantity(order: Order): number {
    return (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
  }

  getOrderCustomText(order: Order): string {
    return order.items?.[0]?.selectedCustomization?.customText || '';
  }
}
