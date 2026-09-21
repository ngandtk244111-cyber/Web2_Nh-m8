import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RoomService } from '../../core/services/room.service';
import { CartService } from '../../core/services/cart.service';
import { Room } from '../../core/models/room.model';
import { Product } from '../../core/models/product.model';
import { RoomViewerComponent } from '../../components/room-viewer/room-viewer.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-shop-the-room',
  standalone: true,
  imports: [CommonModule, RouterLink, RoomViewerComponent, AppIconComponent, VndPipe],
  templateUrl: './shop-the-room.component.html',
  styleUrl: './shop-the-room.component.css'
})
export class ShopTheRoomComponent implements OnInit {
  rooms: Room[] = [];
  currentRoom!: Room;
  roomProducts: Product[] = [];
  selectedProductIds: Set<string> = new Set();
  selectedTotal = 0;

  private requestedRoomId: string | null = null;
  private hasAutoSelected = false;

  constructor(
    private roomService: RoomService,
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Danh sách phòng giờ nạp bất đồng bộ từ backend — dùng effect() để tự chọn phòng ngay
    // khi dữ liệu về, thay vì trông chờ nó đã có sẵn lúc ngOnInit.
    effect(() => {
      this.rooms = this.roomService.rooms();
      if (this.hasAutoSelected || this.rooms.length === 0) return;

      const found = this.requestedRoomId
        ? this.rooms.find(r => r.id === this.requestedRoomId)
        : undefined;
      this.selectRoom(found || this.rooms[0], false);
      this.hasAutoSelected = true;
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.requestedRoomId = params['roomId'] || null;
    });
  }

  selectRoom(room: Room, updateUrl = true): void {
    this.currentRoom = room;
    this.roomService.setActiveRoom(room.id);
    this.roomProducts = this.roomService.getProductsInRoom(room);
    this.selectedProductIds = new Set(this.roomProducts.map(p => p.id));
    this.recalculateTotal();

    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { roomId: room.id },
        queryParamsHandling: 'merge',
      });
    }
  }

  toggleProductSelection(id: string): void {
    if (this.selectedProductIds.has(id)) {
      this.selectedProductIds.delete(id);
    } else {
      this.selectedProductIds.add(id);
    }
    this.recalculateTotal();
  }

  isAllSelected(): boolean {
    return this.roomProducts.length > 0 && this.selectedProductIds.size === this.roomProducts.length;
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedProductIds.clear();
    } else {
      this.selectedProductIds = new Set(this.roomProducts.map(p => p.id));
    }
    this.recalculateTotal();
  }

  recalculateTotal(): void {
    let sum = 0;
    for (const p of this.roomProducts) {
      if (this.selectedProductIds.has(p.id)) {
        sum += p.basePrice;
      }
    }
    this.selectedTotal = sum;
  }

  addSelectedToCart(): void {
    for (const p of this.roomProducts) {
      if (this.selectedProductIds.has(p.id)) {
        this.cartService.addToCart(p, 1);
      }
    }
  }

  onHotspotSelected(product: Product): void {
    // Optionally highlight or ensure selected
    this.selectedProductIds.add(product.id);
    this.recalculateTotal();
  }
}
