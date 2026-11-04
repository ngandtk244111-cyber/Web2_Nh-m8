import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RoomService } from '../../core/services/room.service';
import { Room } from '../../core/models/room.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

/** Loại phòng để lọc — nhận theo từ khoá trong tên phòng (1 phòng có thể thuộc nhiều loại, vd Phòng khách – Bếp). */
const ROOM_TYPES: { key: string; label: string; icon: string; keywords: string[] }[] = [
  { key: 'phong-khach', label: 'Phòng Khách', icon: 'home', keywords: ['phong khach', 'living'] },
  { key: 'bep', label: 'Nhà Bếp', icon: 'box', keywords: ['bep', 'kitchen'] },
  { key: 'phong-an', label: 'Phòng Ăn', icon: 'room', keywords: ['phong an', 'ban an', 'dining'] },
  { key: 'phong-ngu', label: 'Phòng Ngủ', icon: 'room', keywords: ['phong ngu', 'bedroom'] },
  { key: 'lam-viec', label: 'Phòng Làm Việc', icon: 'pencil', keywords: ['lam viec', 'office', 'workspace', 'doc sach', 'reading'] },
  { key: 'phong-tam', label: 'Phòng Tắm', icon: 'room', keywords: ['phong tam', 'bath'] },
  { key: 'ban-cong', label: 'Ban Công', icon: 'room', keywords: ['ban cong', 'balcony'] },
];

function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/**
 * Shop The Room: hero giới thiệu phòng đang chọn (ảnh bìa + nút mở phòng 3D), hàng lọc theo loại phòng,
 * lưới thẻ phòng (bấm thẻ = đưa lên hero, bấm mũi tên = mở thẳng phòng 3D ở tab mới) và dải cam kết.
 */
@Component({
  selector: 'app-shop-the-room',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './shop-the-room.component.html',
  styleUrl: './shop-the-room.component.css'
})
export class ShopTheRoomComponent implements OnInit {
  rooms: Room[] = [];
  currentRoom!: Room;
  filter = 'all';
  roomTypes: { key: string; label: string; icon: string; count: number }[] = [];

  private requestedRoomId: string | null = null;
  private hasAutoSelected = false;

  constructor(
    private roomService: RoomService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Danh sách phòng giờ nạp bất đồng bộ từ backend — dùng effect() để tự chọn phòng ngay
    // khi dữ liệu về, thay vì trông chờ nó đã có sẵn lúc ngOnInit.
    effect(() => {
      this.rooms = this.roomService.rooms();
      this.roomTypes = ROOM_TYPES
        .map(t => ({ key: t.key, label: t.label, icon: t.icon, count: this.rooms.filter(r => this.isType(r, t.key)).length }))
        .filter(t => t.count > 0);
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

  get filteredRooms(): Room[] {
    return this.filter === 'all' ? this.rooms : this.rooms.filter(r => this.isType(r, this.filter));
  }

  private isType(room: Room, key: string): boolean {
    const type = ROOM_TYPES.find(t => t.key === key);
    const name = plain(room.name);
    return !!type && type.keywords.some(k => name.includes(k));
  }

  selectRoom(room: Room, updateUrl = true): void {
    this.currentRoom = room;
    this.roomService.setActiveRoom(room.id);

    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { roomId: room.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  /** Bấm thẻ phòng: đưa phòng đó lên phần giới thiệu phía trên. */
  pickRoom(room: Room, hero: HTMLElement): void {
    this.selectRoom(room);
    hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollChips(el: HTMLElement, dir: 1 | -1): void {
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: 'smooth' });
  }

  roomTotal(room: Room): number {
    return this.roomService.getProductsInRoom(room).reduce((sum, p) => sum + p.basePrice, 0);
  }

  shortName(room: Room): string {
    return room.name.split('(')[0].trim();
  }
}
