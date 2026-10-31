import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { AnnouncementTickerComponent } from '../announcement-ticker/announcement-ticker.component';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { NotificationService } from '../../core/services/notification.service';
import { FavoriteService } from '../../core/services/favorite.service';
import { ProductService, createEmptyFilters } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import {
  CATALOG_DEPARTMENTS,
  CATALOG_SPACES,
  THREE_D_CUSTOM_LINKS,
  DEAL_LINKS,
  CatalogLink,
  departmentLink,
  subcategoryLink,
  spaceLink,
  findSubcategory,
  subcategoryMatches,
} from '../../core/data/catalog-taxonomy';


export interface SearchSuggestion {
  label: string;
  link?: string;
  queryParams?: Record<string, string>;
}

export interface MegaMenuSubItem {
  label: string;
  link?: string;
  queryParams?: Record<string, string>;
  image?: string;
  /** Chỉ có ở danh mục con sản phẩm — dùng để xem trước sản phẩm khi hover ô. */
  subKey?: string;
}

/** Cột xem trước sản phẩm thay cho banner khi hover một danh mục con. */
export interface MegaMenuPreview {
  item: MegaMenuSubItem;
  products: Product[];
}

export interface MegaMenuSection {
  key: string;
  title: string;
  description: string;
  /** Link "Xem tất cả" của nhóm lớn (nếu có). */
  viewAll?: CatalogLink;
  /** Click vào tên nhóm ở cột trái sẽ đi tới đâu (chỉ nhóm sản phẩm) — các nhóm khác chỉ mở panel. */
  railLink?: CatalogLink;
  items: MegaMenuSubItem[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, AnnouncementTickerComponent, VndPipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  mobileMenuOpen = false;
  megaMenuOpen = false;
  megaMenuClosing = false;
  notificationsOpen = false;
  searchSuggestionsOpen = false;
  cartPreviewOpen = false;
  accountMenuOpen = false;
  /** Link ảnh đại diện bị lỗi (ảnh Google/Facebook hết hạn, bị chặn...) -> hiện icon thay vì ảnh vỡ. */
  brokenAvatar: string | null = null;
  expandedMobileGroup: string | null = null;
  private megaMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Header rút gọn khi cuộn xuống quá COMPACT_AT (px) — ẩn top bar/Menu/vị trí giao hàng — và chỉ bung lại khi
   * về gần đầu trang (EXPAND_AT). Khoảng cách giữa 2 ngưỡng phải lớn hơn phần chiều cao header bị co (~44px):
   * header là sticky nên khi co lại nội dung bị kéo lên, scrollY tụt theo; dùng 1 ngưỡng duy nhất sẽ khiến
   * header co/bung liên tục (giựt) quanh ngưỡng, nhất là ở trang ngắn.
   */
  private readonly SCROLL_COMPACT_AT = 120;
  private readonly SCROLL_EXPAND_AT = 20;
  isScrolled = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (!this.isScrolled && y > this.SCROLL_COMPACT_AT) this.isScrolled = true;
    else if (this.isScrolled && y < this.SCROLL_EXPAND_AT) this.isScrolled = false;
  }

  /** Từ khoá/danh mục người dùng thường tìm — map thẳng sang catalog thật (cùng taxonomy với mega menu). */
  readonly searchSuggestions: SearchSuggestion[] = [
    { label: 'Sofa', queryParams: { cat: 'sofa' } },
    { label: 'Giường', queryParams: { cat: 'giuong' } },
    { label: 'Đèn ngủ', queryParams: { cat: 'den-ngu' } },
    { label: 'Decor phòng khách', queryParams: { space: 'phong-khach' } },
    { label: 'Sản phẩm 3D', queryParams: { has3d: '1' } },
    { label: 'Có thể tùy biến', queryParams: { custom: '1' } },
  ];

  /** Tên trùng với tiêu đề trang đích (đồng bộ với footer). */
  readonly exploreMenu: { label: string; link: string }[] = [
    { label: 'Không gian 3D trực quan', link: '/shop-the-room' },
    { label: 'Tự tay thiết kế & xem trước 3D', link: '/customizer-3d' },
    { label: 'Gửi yêu cầu thiết kế riêng', link: '/custom-request/new' },
    { label: 'Trắc nghiệm phong cách', link: '/style-quiz' },
    { label: 'Cộng đồng decor', link: '/community' },
    { label: 'Tin tức & Mẹo sống', link: '/news' },
    { label: 'Voucher Luméa', link: '/voucher' },
  ];

  /**
   * Mega menu dựng từ core/data/catalog-taxonomy.ts (nguồn dữ liệu chung với catalog/filter/trang chủ):
   * Nội thất, Đèn, Decor, Đồ dùng (nhóm sản phẩm) → Không gian → 3D & Custom → Deal.
   */
  readonly megaMenuSections: MegaMenuSection[] = [
    ...CATALOG_DEPARTMENTS.map(dept => ({
      key: dept.key,
      title: dept.label,
      description: dept.description,
      viewAll: departmentLink(dept),
      railLink: departmentLink(dept),
      items: dept.subcategories.map(sub => ({ ...subcategoryLink(sub), image: sub.image, subKey: sub.key })),
    })),
    {
      key: 'khong-gian',
      title: 'Không gian',
      description: 'Chọn theo căn phòng — nội thất và decor phù hợp cho từng không gian sống.',
      viewAll: { label: 'Phòng mẫu 3D', link: '/shop-the-room' },
      items: CATALOG_SPACES.map(space => ({ ...spaceLink(space), image: space.image })),
    },
    {
      key: '3d-custom',
      title: '3D & Custom',
      description: 'Xem trước mô hình 3D, tùy biến màu/chất liệu hoặc đặt thiết kế riêng.',
      items: THREE_D_CUSTOM_LINKS,
    },
    {
      key: 'deal',
      title: 'Deal',
      description: 'Flash Sale mỗi ngày và các sản phẩm đang giảm giá.',
      items: DEAL_LINKS,
    },
  ];

  /** Nhóm đang được hover/chọn trong mega menu desktop. */
  activeMegaSectionKey = this.megaMenuSections[0].key;

  get activeMegaSection(): MegaMenuSection {
    return this.megaMenuSections.find(s => s.key === this.activeMegaSectionKey) ?? this.megaMenuSections[0];
  }

  readonly megaMenuBanner = {
    icon: 'room',
    title: 'Thiết Kế Không Gian Theo Cách Của Bạn',
    description: 'Khám phá phòng mẫu 3D, phối nội thất & decor theo phong cách riêng rồi mua trọn bộ.',
    ctaLabel: 'Khám phá ngay',
    image: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=520&q=70',
    link: '/shop-the-room',
  };

  /** Danh mục con đang hover trong mega menu — null thì cột phải hiện banner. */
  megaPreview: MegaMenuPreview | null = null;
  private readonly MEGA_PREVIEW_LIMIT = 4;

  constructor(
    public productService: ProductService,
    public cartService: CartService,
    private router: Router,
    public authService: AuthService,
    public loginModalService: LoginModalService,
    public notificationService: NotificationService,
    public favoriteService: FavoriteService,
    private elementRef: ElementRef<HTMLElement>
  ) {
    // Giữ từ khoá trên ô tìm kiếm theo URL: đang ở /catalog?q=... thì hiện lại từ khoá (kể cả khi tải lại trang
    // hay bấm Back), rời trang catalog thì xoá trống.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        const tree = this.router.parseUrl(this.router.url);
        const onCatalog = tree.root.children['primary']?.segments[0]?.path === 'catalog';
        this.searchText = onCatalog ? (tree.queryParams['q'] || this.matchSuggestionLabel(tree.queryParams)) : '';
        this.updateSearchResults();
      });
  }

  ngOnInit(): void {
    // Lắng nghe ở pha capture: nhiều component trong trang gọi stopPropagation() nên listener 'document:click'
    // thường không nhận được click -> panel không tự đóng.
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.cancelMegaMenuCloseTimer();
    this.onMegaMenuTriggerLeave();
  }

  /** Bấm ra ngoài vùng của panel nào (tài khoản/thông báo/giỏ hàng/gợi ý tìm kiếm) thì đóng panel đó. */
  private readonly onDocumentPointerDown = (event: Event): void => {
    const target = event.target as Node;
    const inside = (selector: string) =>
      !!this.elementRef.nativeElement.querySelector(selector)?.contains(target);
    if (this.notificationsOpen && !inside('.hd_notify-wrap')) this.notificationsOpen = false;
    if (this.cartPreviewOpen && !inside('.hd_cart-wrap')) this.cartPreviewOpen = false;
    if (this.accountMenuOpen && !inside('.hd_account-wrap')) this.accountMenuOpen = false;
    if (this.searchSuggestionsOpen && !inside('.hd_search-wrap')) this.searchSuggestionsOpen = false;
  };

  toggleCartPreview(): void {
    this.cartPreviewOpen = !this.cartPreviewOpen;
    if (this.cartPreviewOpen) {
      this.notificationsOpen = false;
      this.accountMenuOpen = false;
      this.searchSuggestionsOpen = false;
      if (this.megaMenuOpen) this.startCloseMegaMenu();
    }
  }

  removeCartItem(itemId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cartService.removeFromCart(itemId);
  }

  toggleMegaMenu(): void {
    if (this.megaMenuHoverTimer) {
      // Click ngay sau khi hover: coi như mở.
      this.onMegaMenuTriggerLeave();
      this.openMegaMenu();
      return;
    }
    if (this.megaMenuOpen && !this.megaMenuClosing) {
      // Vừa mở bằng hover thì cú click liền sau không được đóng lại ngay.
      if (Date.now() - this.megaMenuOpenedAt < 500) return;
      this.startCloseMegaMenu();
      return;
    }
    this.openMegaMenu();
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    this.accountMenuOpen = false;
    if (this.megaMenuOpen) this.startCloseMegaMenu();
    this.searchSuggestionsOpen = false;
    this.cartPreviewOpen = false;
  }

  /** Hover vào nút "Danh mục sản phẩm" → mở mega menu (click vẫn bật/tắt như cũ, dùng cho cảm ứng). */
  private megaMenuHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private megaMenuOpenedAt = 0;

  onMegaMenuTriggerEnter(): void {
    if (this.megaMenuHoverTimer) clearTimeout(this.megaMenuHoverTimer);
    // Trễ nhẹ để lướt chuột ngang qua không vô tình bật menu.
    this.megaMenuHoverTimer = setTimeout(() => {
      this.megaMenuHoverTimer = null;
      this.openMegaMenu();
    }, 120);
  }

  onMegaMenuTriggerLeave(): void {
    if (this.megaMenuHoverTimer) {
      clearTimeout(this.megaMenuHoverTimer);
      this.megaMenuHoverTimer = null;
    }
  }

  setActiveMegaSection(key: string): void {
    if (key !== this.activeMegaSectionKey) this.megaPreview = null;
    this.activeMegaSectionKey = key;
  }

  /** Hover ô danh mục con → cột phải hiện vài sản phẩm nổi bật (nhiều đánh giá nhất) của mục đó. */
  previewMegaItem(item: MegaMenuSubItem): void {
    if (!item.subKey || this.megaPreview?.item === item) return;
    const found = findSubcategory(item.subKey);
    if (!found) return;
    const products = this.productService.products()
      .filter(p => subcategoryMatches(found.sub, p))
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, this.MEGA_PREVIEW_LIMIT);
    this.megaPreview = { item, products };
  }

  /** Đổi nhóm → panel dựng lại để chạy hiệu ứng xuất hiện của các thẻ. */
  trackSection(_: number, section: MegaMenuSection): string {
    return section.key;
  }

  private openMegaMenu(): void {
    this.cancelMegaMenuCloseTimer();
    if (this.megaMenuOpen && !this.megaMenuClosing) return;
    this.megaMenuOpenedAt = Date.now();
    this.megaPreview = null;
    this.megaMenuOpen = true;
    this.megaMenuClosing = false;
    this.notificationsOpen = false;
    this.cartPreviewOpen = false;
  }

  /** Tự tắt mega menu (có hiệu ứng) khi chuột rời khỏi vùng nút Menu + panel. */
  onMegaMenuAreaLeave(): void {
    if (this.megaMenuOpen) this.startCloseMegaMenu();
  }

  private startCloseMegaMenu(): void {
    if (!this.megaMenuOpen || this.megaMenuClosing) return;
    this.megaMenuClosing = true;
    this.cancelMegaMenuCloseTimer();
    this.megaMenuCloseTimer = setTimeout(() => {
      this.megaMenuOpen = false;
      this.megaMenuClosing = false;
      this.megaMenuCloseTimer = null;
    }, 220);
  }

  private cancelMegaMenuCloseTimer(): void {
    if (this.megaMenuCloseTimer) {
      clearTimeout(this.megaMenuCloseTimer);
      this.megaMenuCloseTimer = null;
    }
  }

  closeMenus(): void {
    if (this.megaMenuOpen) this.startCloseMegaMenu();
    this.notificationsOpen = false;
    this.cartPreviewOpen = false;
    this.accountMenuOpen = false;
  }

  /** Lối tắt trong dropdown tài khoản ở header. */
  readonly accountMenuItems: { label: string; icon: string; link: string; queryParams?: Record<string, string> }[] = [
    { label: 'Hồ sơ cá nhân', icon: 'user', link: '/account', queryParams: { tab: 'profile' } },
    { label: 'Đơn hàng của tôi', icon: 'truck', link: '/account', queryParams: { tab: 'orders' } },
    { label: 'Sổ địa chỉ', icon: 'map-pin', link: '/account', queryParams: { tab: 'addresses' } },
    { label: 'Voucher của tôi', icon: 'tag', link: '/account', queryParams: { tab: 'vouchers' } },
    { label: 'Sản phẩm yêu thích', icon: 'heart', link: '/favorites' },
  ];

  toggleAccountMenu(): void {
    const open = !this.accountMenuOpen;
    this.closeMenus();
    this.searchSuggestionsOpen = false;
    this.accountMenuOpen = open;
  }

  /**
   * Bấm logo: đang ở trang chủ thì cuộn mượt lên đầu (router không điều hướng lại cùng URL nên
   * trước đây bấm như không ăn); ở trang khác thì về trang chủ và hiện từ đầu trang.
   */
  goHome(event: MouseEvent): void {
    // Giữ hành vi mở tab mới của trình duyệt (Ctrl/Cmd/Shift + click, chuột giữa).
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    this.closeMenus();
    this.searchSuggestionsOpen = false;
    if (this.router.url.split(/[?#]/)[0] === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.router.navigateByUrl('/').then(() => window.scrollTo({ top: 0 }));
  }

  async logout(): Promise<void> {
    this.accountMenuOpen = false;
    this.mobileMenuOpen = false;
    if (await this.authService.confirmLogout()) this.router.navigate(['/']);
  }

  openSearchSuggestions(): void {
    this.searchSuggestionsOpen = true;
    this.notificationsOpen = false;
  }

  /** Nội dung đang gõ ở ô tìm kiếm — dùng để gợi ý sản phẩm khớp ngay khi gõ. */
  searchText = '';
  searchResults: Product[] = [];
  private readonly SEARCH_RESULT_LIMIT = 6;

  onSearchInput(value: string): void {
    this.searchText = value;
    this.searchSuggestionsOpen = true;
    this.updateSearchResults();
  }

  /** URL catalog đúng bằng bộ lọc của 1 chip "Tìm kiếm phổ biến" -> trả về nhãn chip để hiện trên ô tìm kiếm. */
  private matchSuggestionLabel(params: Record<string, string>): string {
    const keys = Object.keys(params);
    const hit = this.searchSuggestions.find(s => {
      const sp = s.queryParams || {};
      const sKeys = Object.keys(sp);
      return !s.link && sKeys.length === keys.length && sKeys.every(k => String(params[k]) === sp[k]);
    });
    return hit?.label || '';
  }

  private updateSearchResults(): void {
    const q = this.searchText.trim();
    this.searchResults = q
      ? this.productService.filterProducts({ ...createEmptyFilters(), searchQuery: q }).slice(0, this.SEARCH_RESULT_LIMIT)
      : [];
  }

  selectSuggestion(item: SearchSuggestion): void {
    this.searchSuggestionsOpen = false;
    this.router.navigate([item.link || '/catalog'], { queryParams: item.queryParams });
  }

  markNotificationRead(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.notificationService.markAsRead(id);
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllAsRead();
  }

  viewAllNotifications(): void {
    this.notificationsOpen = false;
    if (this.authService.currentUser()) {
      this.router.navigate(['/notifications']);
    } else {
      this.loginModalService.open();
    }
  }

  toggleMobileGroup(title: string): void {
    this.expandedMobileGroup = this.expandedMobileGroup === title ? null : title;
  }

  goToAddresses(): void {
    if (this.authService.currentUser()) {
      this.router.navigate(['/account'], { queryParams: { tab: 'addresses' } });
    } else {
      this.loginModalService.open();
    }
  }

  search(value: string): void {
    const q = (value || '').trim();
    this.mobileMenuOpen = false;
    this.closeMenus();
    this.searchSuggestionsOpen = false;
    this.searchResults = [];
    this.router.navigate(['/catalog'], q ? { queryParams: { q } } : {});
  }
}
