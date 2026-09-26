import { Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { AnnouncementTickerComponent } from '../announcement-ticker/announcement-ticker.component';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { NotificationService } from '../../core/services/notification.service';
import { FavoriteService } from '../../core/services/favorite.service';
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
export class HeaderComponent implements OnDestroy {
  mobileMenuOpen = false;
  megaMenuOpen = false;
  megaMenuClosing = false;
  notificationsOpen = false;
  searchSuggestionsOpen = false;
  cartPreviewOpen = false;
  expandedMobileGroup: string | null = null;
  private megaMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;

  /** Header rút gọn khi cuộn xuống quá ngưỡng này (px) — ẩn top bar/Menu/vị trí giao hàng. */
  private readonly SCROLL_COMPACT_THRESHOLD = 80;
  isScrolled = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const y = window.scrollY || document.documentElement.scrollTop;
    const scrolled = y > this.SCROLL_COMPACT_THRESHOLD;
    if (scrolled !== this.isScrolled) this.isScrolled = scrolled;
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

  readonly exploreMenu: { label: string; link: string }[] = [
    { label: 'Phòng 3D', link: '/shop-the-room' },
    { label: 'Tùy biến 3D', link: '/customizer-3d' },
    { label: 'Thiết kế riêng', link: '/custom-request' },
    { label: 'Quiz phong cách', link: '/style-quiz' },
    { label: 'Cộng đồng', link: '/community' },
    { label: 'Insights', link: '/news' },
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
      items: dept.subcategories.map(sub => ({ ...subcategoryLink(sub), image: sub.image })),
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

  constructor(
    public cartService: CartService,
    private router: Router,
    public authService: AuthService,
    public loginModalService: LoginModalService,
    public notificationService: NotificationService,
    public favoriteService: FavoriteService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnDestroy(): void {
    this.cancelMegaMenuCloseTimer();
    this.onMegaMenuTriggerLeave();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.notificationsOpen = false;
      this.searchSuggestionsOpen = false;
      this.cartPreviewOpen = false;
    }
  }

  toggleCartPreview(): void {
    this.cartPreviewOpen = !this.cartPreviewOpen;
    if (this.cartPreviewOpen) {
      this.notificationsOpen = false;
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
    this.activeMegaSectionKey = key;
  }

  /** Đổi nhóm → panel dựng lại để chạy hiệu ứng xuất hiện của các thẻ. */
  trackSection(_: number, section: MegaMenuSection): string {
    return section.key;
  }

  private openMegaMenu(): void {
    this.cancelMegaMenuCloseTimer();
    if (this.megaMenuOpen && !this.megaMenuClosing) return;
    this.megaMenuOpenedAt = Date.now();
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
  }

  openSearchSuggestions(): void {
    this.searchSuggestionsOpen = true;
    this.notificationsOpen = false;
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
    this.router.navigate(['/catalog'], q ? { queryParams: { q } } : {});
  }
}
