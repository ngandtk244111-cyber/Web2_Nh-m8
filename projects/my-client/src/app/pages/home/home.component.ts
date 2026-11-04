import { Component, OnInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import {
  CATALOG_DEPARTMENTS,
  CATALOG_SPACES,
  CatalogLink,
  departmentLink,
  findSubcategory,
  spaceLink,
  subcategoryLink,
} from '../../core/data/catalog-taxonomy';
import { Room } from '../../core/models/room.model';
import { CartService } from '../../core/services/cart.service';
import { MascotService } from '../../core/services/mascot.service';
import { RoomService } from '../../core/services/room.service';
import { CommunityService } from '../../core/services/community.service';
import { ProductCarouselComponent } from '../../components/product-carousel/product-carousel.component';
import { RoomViewerComponent } from '../../components/room-viewer/room-viewer.component';
import { RecentlyViewedSectionComponent } from '../../components/recently-viewed-section/recently-viewed-section.component';
import { HeroBannerComponent } from '../../components/hero-banner/hero-banner.component';
import { PromoBannerGridComponent } from '../../components/promo-banner-grid/promo-banner-grid.component';
import { DecorDealsComponent } from '../../components/decor-deals/decor-deals.component';
import { TipPopupComponent } from '../../components/tip-popup/tip-popup.component';
import { FavoriteStylesComponent } from '../../components/favorite-styles/favorite-styles.component';
import { VideoTopicsComponent } from '../../components/video-topics/video-topics.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProductCarouselComponent,
    RoomViewerComponent,
    RecentlyViewedSectionComponent,
    HeroBannerComponent,
    PromoBannerGridComponent,
    DecorDealsComponent,
    TipPopupComponent,
    FavoriteStylesComponent,
    VideoTopicsComponent,
    AppIconComponent,
    ScrollRevealDirective
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  readyStockProducts: any[] = [];
  activeRoom: Room | undefined;
  /** Các phòng hiển thị ở section Shop The Room — chỉ phòng dựng sẵn có điểm sản phẩm
   *  (phòng scan .glb nặng và chưa gắn sản phẩm để dành cho trang /shop-the-room). */
  showcaseRooms: Room[] = [];
  /** Sản phẩm trong phòng đang xem, đúng thứ tự điểm đánh dấu (số 1..N trên viewer). */
  roomProducts: { product: Product; note: string; pin: number }[] = [];
  @ViewChild(RoomViewerComponent) roomViewer?: RoomViewerComponent;
  communityPosts: any[] = [];

  /** Dải chữ chạy ngang giữa trang — không ghi số tiền/mốc freeship để tránh lệch với trang chính sách. */
  readonly marqueeItems = [
    'Nội thất & Decor',
    'Sofa · Giường · Bàn · Ghế · Tủ · Kệ',
    'Sản phẩm in 3D theo yêu cầu',
    'Shop The Room 3D',
    'Xem trước mô hình 3D',
    'Thiết kế cùng trợ lý AI',
    'Giao hàng toàn quốc',
  ];

  /**
   * Danh mục trang chủ — lấy từ cây danh mục chung (core/data/catalog-taxonomy.ts), cùng nguồn với
   * mega menu & bộ lọc: 6 nhóm nội thất chính trước, sau đó Đèn, Decor, 3D & Custom.
   */
  readonly categories: { label: string; image: string; link: string; queryParams?: Record<string, string> }[] = [
    ...['sofa', 'giuong', 'ban', 'ghe', 'tu', 'ke'].map(key => {
      const sub = findSubcategory(key)!.sub;
      return { ...subcategoryLink(sub), image: sub.image! };
    }),
    ...CATALOG_DEPARTMENTS.filter(d => d.key !== 'noi-that')
      .map(d => ({ ...departmentLink(d), image: d.image })),
    { label: '3D & Custom', image: 'assets/hero-banner/hero-print-3d.png', link: '/catalog', queryParams: { custom: '1' } },
  ];

  /** Mua theo không gian sống — dẫn tới catalog đã lọc theo không gian. */
  readonly spaceTiles: (CatalogLink & { image: string })[] =
    CATALOG_SPACES.map(space => ({ ...spaceLink(space), image: space.image }));

  constructor(
    private productService: ProductService,
    private roomService: RoomService,
    private communityService: CommunityService,
    private cartService: CartService,
    private mascotService: MascotService
  ) {
    // Dữ liệu giờ nạp bất đồng bộ từ backend — dùng effect() để tự cập nhật khi signal đổi,
    // thay vì chỉ đọc 1 lần lúc ngOnInit (lúc đó dữ liệu có thể chưa kịp tải về).
    effect(() => {
      const products = this.productService.products();
      this.readyStockProducts = this.productService.readyStockProducts().slice(0, 10);
    });
    effect(() => {
      this.productService.products();
      // Chỉ hiện phòng có điểm sản phẩm để mua (phòng .glb nay đã nhẹ và có hotspot nên được hiện).
      this.showcaseRooms = this.roomService.rooms().filter(r => r.hotspots.length > 0);
      if (!this.activeRoom || !this.showcaseRooms.some(r => r.id === this.activeRoom!.id)) {
        this.activeRoom = this.showcaseRooms[0] ?? this.roomService.getActiveRoom();
      }
      this.updateRoomProducts();
    });
    effect(() => {
      this.communityPosts = this.communityService.posts().slice(0, 5);
    });
  }

  ngOnInit(): void {}

  /** Danh sách "Chọn phòng" nổi trên khung 3D có thể thu gọn. */
  roomListCollapsed = false;

  activeRoomIndex(): number {
    return this.showcaseRooms.findIndex(r => r.id === this.activeRoom?.id) + 1;
  }

  roomShortName(room: Room): string {
    return room.name.split('(')[0].trim();
  }

  selectRoom(room: Room): void {
    if (room.id === this.activeRoom?.id) return;
    this.activeRoom = room;
    this.updateRoomProducts();
  }

  /** Khung phòng ở trang chủ chỉ để xem — bấm vào thì mở trang phòng 3D đầy đủ (tab mới, giống nút "Xem phòng 3D"). */
  openRoom3d(): void {
    if (this.activeRoom) window.open(`/xem-phong-3d/${this.activeRoom.id}`, '_blank');
  }

  private updateRoomProducts(): void {
    this.roomProducts = (this.activeRoom?.hotspots ?? [])
      .map((h, i) => ({ product: this.productService.getProductById(h.productId), note: h.annotationNote, pin: i + 1 }))
      .filter((x): x is { product: Product; note: string; pin: number } => !!x.product);
  }

  /** Bỏ phần tên tiếng Anh trong ngoặc cho tab: "Góc Học Tập ... (Minimal Study Desk)" -> "Góc Học Tập ...". */
  shortRoomName(name: string): string {
    return name.replace(/\s*\(.*\)\s*$/, '');
  }

  get roomLookTotal(): number {
    return this.roomProducts.reduce((sum, x) => sum + x.product.basePrice, 0);
  }

  focusRoomProduct(productId: string): void {
    this.roomViewer?.selectHotspotByProduct(productId);
  }

  addRoomLookToCart(): void {
    if (this.roomProducts.length === 0) return;
    if (!this.cartService.ensureLoggedIn()) return;
    this.roomProducts.forEach(x => this.cartService.addToCart(x.product, 1));
    this.mascotService.react('happy');
  }
}
