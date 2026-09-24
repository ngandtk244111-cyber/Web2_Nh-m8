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


export interface SearchSuggestion {
  label: string;
  link?: string;
  queryParams?: Record<string, string>;
}

export interface MegaMenuSubItem {
  label: string;
  link?: string;
  queryParams?: Record<string, string>;
}

export interface MegaMenuGroup {
  title: string;
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

  /** Từ khoá/danh mục người dùng thường tìm — map thẳng sang catalog thật (giống mega menu). */
  readonly searchSuggestions: SearchSuggestion[] = [
    { label: 'Decor bàn', queryParams: { category: 'tray' } },
    { label: 'Tượng decor', queryParams: { category: 'sculpture' } },
    { label: 'Đèn 3D', queryParams: { category: 'lamp' } },
    { label: 'Chậu cây', queryParams: { category: 'plant_pot' } },
    { label: 'Mô hình 3D', queryParams: { q: 'Mô hình 3D' } },
    { label: 'Decor phòng ngủ', link: '/shop-the-room' },
  ];

  readonly exploreMenu: { label: string; link: string }[] = [
    { label: 'Phòng 3D', link: '/shop-the-room' },
    { label: 'Tùy biến 3D', link: '/customizer-3d' },
    { label: 'Thiết kế riêng', link: '/custom-request' },
    { label: 'Quiz phong cách', link: '/style-quiz' },
    { label: 'Cộng đồng', link: '/community' },
    { label: 'Insights', link: '/news' },
  ];

  private readonly decorBanGroup: MegaMenuGroup = {
    title: 'Decor Bàn',
    items: [
      { label: 'Tượng decor', queryParams: { category: 'sculpture' } },
      { label: 'Mô hình decor', queryParams: { q: 'Mô hình decor' } },
      { label: 'Đồ trang trí bàn', queryParams: { q: 'Đồ trang trí bàn' } },
      { label: 'Khay decor', queryParams: { category: 'tray' } },
      { label: 'Hộp đựng đồ', queryParams: { category: 'organizer' } },
      { label: 'Phụ kiện bàn', queryParams: { category: 'organizer' } },
    ],
  };

  private readonly tuongMoHinhGroup: MegaMenuGroup = {
    title: 'Tượng & Mô Hình',
    items: [
      { label: 'Tượng nghệ thuật', queryParams: { category: 'sculpture' } },
      { label: 'Tượng động vật', queryParams: { q: 'Tượng động vật' } },
      { label: 'Mô hình nhân vật', queryParams: { q: 'Mô hình nhân vật' } },
      { label: 'Mô hình 3D', queryParams: { q: 'Mô hình 3D' } },
      { label: 'Figurine', queryParams: { q: 'Figurine' } },
    ],
  };

  private readonly denChieuSangGroup: MegaMenuGroup = {
    title: 'Đèn & Chiếu Sáng',
    items: [
      { label: 'Đèn bàn', queryParams: { category: 'lamp' } },
      { label: 'Đèn ngủ', queryParams: { category: 'lamp' } },
      { label: 'Đèn decor', queryParams: { category: 'lamp' } },
      { label: 'Đèn ambient', queryParams: { category: 'lamp' } },
      { label: 'Đèn 3D', queryParams: { category: 'lamp' } },
    ],
  };

  private readonly chauCayGroup: MegaMenuGroup = {
    title: 'Chậu & Cây Decor',
    items: [
      { label: 'Chậu cây', queryParams: { category: 'plant_pot' } },
      { label: 'Chậu 3D', queryParams: { category: 'plant_pot' } },
      { label: 'Cây mini', queryParams: { category: 'plant_pot' } },
      { label: 'Cây giả decor', queryParams: { category: 'plant_pot' } },
      { label: 'Terrarium', queryParams: { category: 'plant_pot' } },
    ],
  };

  private readonly phuKienGroup: MegaMenuGroup = {
    title: 'Phụ Kiện',
    items: [
      { label: 'Móc khóa', queryParams: { q: 'Móc khóa' } },
      { label: 'Phụ kiện bàn', queryParams: { category: 'organizer' } },
      { label: 'Giá đỡ', queryParams: { category: 'bookend' } },
      { label: 'Khay đựng', queryParams: { category: 'tray' } },
      { label: 'Đồ dùng decor', queryParams: { q: 'Đồ dùng decor' } },
    ],
  };

  private readonly phongCachGroup: MegaMenuGroup = {
    title: 'Decor Theo Phong Cách',
    items: [
      { label: 'Minimal', queryParams: { q: 'Minimal' } },
      { label: 'Modern', queryParams: { q: 'Modern' } },
      { label: 'Cute', queryParams: { q: 'Cute' } },
      { label: 'Vintage', queryParams: { q: 'Vintage' } },
      { label: 'Industrial', queryParams: { q: 'Industrial' } },
      { label: 'Scandinavian', queryParams: { q: 'Scandinavian' } },
    ],
  };

  private readonly khongGianGroup: MegaMenuGroup = {
    title: 'Decor Theo Không Gian',
    items: [
      { label: 'Phòng ngủ', link: '/shop-the-room' },
      { label: 'Bàn làm việc', link: '/shop-the-room' },
      { label: 'Phòng khách', link: '/shop-the-room' },
      { label: 'Góc học tập', link: '/shop-the-room' },
      { label: 'Setup gaming', link: '/shop-the-room' },
      { label: 'Văn phòng', link: '/shop-the-room' },
    ],
  };

  private readonly threeDCustomGroup: MegaMenuGroup = {
    title: '3D & Custom',
    items: [
      { label: 'Tùy biến 3D', link: '/customizer-3d' },
      { label: 'Thiết kế riêng', link: '/custom-request' },
      { label: 'In 3D theo yêu cầu', link: '/customizer-3d' },
      { label: 'Custom sản phẩm', link: '/customizer-3d' },
    ],
  };

  /** Danh sách phẳng — dùng cho accordion mobile. */
  readonly megaMenuGroups: MegaMenuGroup[] = [
    this.decorBanGroup,
    this.tuongMoHinhGroup,
    this.denChieuSangGroup,
    this.chauCayGroup,
    this.phuKienGroup,
    this.phongCachGroup,
    this.khongGianGroup,
    this.threeDCustomGroup,
  ];

  /** Chia cột — dùng cho mega menu desktop (2 nhóm/cột). */
  readonly megaMenuColumns: MegaMenuGroup[][] = [
    [this.decorBanGroup, this.tuongMoHinhGroup],
    [this.denChieuSangGroup, this.chauCayGroup],
    [this.phuKienGroup, this.phongCachGroup],
    [this.khongGianGroup, this.threeDCustomGroup],
  ];

  readonly megaMenuBanner = {
    icon: 'room',
    title: 'Thiết Kế Không Gian Theo Cách Của Bạn',
    description: 'Khám phá bộ sưu tập phòng mẫu 360° và tự tay phối decor theo phong cách riêng của bạn.',
    ctaLabel: 'Khám phá ngay',
    gradient: 'linear-gradient(160deg, #E3D5BA 0%, #E2B4BC 55%, #A3152D 100%)',
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
    if (this.megaMenuOpen) {
      this.startCloseMegaMenu();
      return;
    }
    this.cancelMegaMenuCloseTimer();
    this.megaMenuOpen = true;
    this.megaMenuClosing = false;
    this.notificationsOpen = false;
    this.cartPreviewOpen = false;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.megaMenuOpen) this.startCloseMegaMenu();
    this.searchSuggestionsOpen = false;
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
