import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { ProductService } from '../../core/services/product.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { Room, RoomHotspot } from '../../core/models/room.model';
import { Product } from '../../core/models/product.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { environment } from '../../../environments/environment';

type RoomType = Room['roomType'];

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'glb_scene', label: 'Mô hình GLB (file .glb thật)' },
  { value: 'minimal_study', label: 'Phòng làm việc tối giản (dựng sẵn)' },
  { value: 'cozy_bedroom', label: 'Phòng ngủ ấm cúng (dựng sẵn)' },
];

/** Camera mặc định khi tạo phòng mới (server bắt buộc có cameraInitial). */
const DEFAULT_CAMERA = { x: 3.2, y: 2.2, z: 4.2, fov: 50 };

const emptyForm = () => ({
  name: '',
  theme: '',
  tagline: '',
  description: '',
  coverImage: '',
  roomType: 'glb_scene' as RoomType,
  modelUrl: '',
  totalLookPrice: null as number | null,
  hotspots: [] as RoomHotspot[],
});

/** Phòng mẫu 3D ("Shop the room" ở my-client): thông tin phòng + các điểm gắn sản phẩm. */
@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule, VndPipe],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.css',
})
export class RoomsComponent implements OnInit {
  private roomService = inject(RoomService);
  private productService = inject(ProductService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly roomTypes = ROOM_TYPES;
  readonly clientAppUrl = environment.clientAppUrl;
  readonly rooms = this.roomService.rooms;
  readonly products = computed(() => [...this.productService.products()].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
  private readonly productById = computed(() => new Map(this.productService.products().map(p => [p.id, p])));

  showModal = false;
  editing: Room | null = null;
  form = emptyForm();
  saving = false;
  uploading = false;

  ngOnInit(): void {
    this.roomService.refresh();
  }

  roomTypeLabel(type: RoomType): string {
    return ROOM_TYPES.find(t => t.value === type)?.label || type;
  }

  product(id: string): Product | undefined {
    return this.productById().get(id);
  }

  roomProducts(room: Room): Product[] {
    return room.hotspots.map(h => this.product(h.productId)).filter((p): p is Product => !!p);
  }

  productNames(room: Room): string {
    return this.roomProducts(room).map(p => p.name).join(', ');
  }

  /** Giá trọn bộ: lấy giá đã nhập, không có thì cộng giá các sản phẩm gắn trong phòng. */
  lookPrice(room: Room): number {
    return room.totalLookPrice || this.roomProducts(room).reduce((sum, p) => sum + p.basePrice, 0);
  }

  missingProducts(room: Room): number {
    return room.hotspots.filter(h => !this.product(h.productId)).length;
  }

  openCreate(): void {
    this.editing = null;
    this.form = emptyForm();
    this.showModal = true;
  }

  openEdit(room: Room): void {
    this.editing = room;
    this.form = {
      name: room.name,
      theme: room.theme || '',
      tagline: room.tagline || '',
      description: room.description || '',
      coverImage: room.coverImage || '',
      roomType: room.roomType,
      modelUrl: room.modelUrl || '',
      totalLookPrice: room.totalLookPrice ?? null,
      // Sửa trên bản sao; vị trí 3D giữ nguyên (canh chỉnh trong my-client).
      hotspots: room.hotspots.map(h => ({ ...h, position: [...h.position] as [number, number, number] })),
    };
    this.showModal = true;
  }

  addHotspot(): void {
    this.form.hotspots.push({ id: 'hs-' + Date.now(), productId: '', label: '', position: [0, 0.5, 0], annotationNote: '' });
  }

  removeHotspot(index: number): void {
    this.form.hotspots.splice(index, 1);
  }

  onHotspotProduct(h: RoomHotspot): void {
    const p = this.product(h.productId);
    if (p && !h.label.trim()) h.label = p.name;
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading = true;
    this.productService.uploadImage(file).subscribe({
      next: url => {
        this.form.coverImage = url;
        this.uploading = false;
      },
      error: err => {
        this.uploading = false;
        this.toast.apiError(err, 'Không tải được ảnh lên server');
      },
    });
  }

  save(): void {
    const f = this.form;
    if (this.saving) return;
    if (!f.name.trim()) {
      this.toast.warning('Vui lòng nhập tên phòng');
      return;
    }
    if (f.roomType === 'glb_scene' && !f.modelUrl.trim()) {
      this.toast.warning('Phòng dạng GLB cần đường dẫn file mô hình .glb');
      return;
    }
    if (f.hotspots.some(h => !h.productId)) {
      this.toast.warning('Mỗi điểm gắn cần chọn sản phẩm (hoặc xoá điểm đó)');
      return;
    }
    const editing = this.editing;
    // Giữ nguyên camera/bounds của phòng đang sửa; bỏ trường hệ thống của Mongo khỏi bản gửi lên.
    const { _id, __v, createdAt, updatedAt, ...kept } = (editing || { cameraInitial: DEFAULT_CAMERA }) as Room & Record<string, unknown>;
    const payload: Partial<Room> = {
      ...kept,
      name: f.name.trim(),
      theme: f.theme.trim(),
      tagline: f.tagline.trim(),
      description: f.description.trim(),
      coverImage: f.coverImage.trim(),
      roomType: f.roomType,
      modelUrl: f.modelUrl.trim() || undefined,
      totalLookPrice: f.totalLookPrice ? Number(f.totalLookPrice) : undefined,
      hotspots: f.hotspots.map(h => ({ ...h, label: h.label.trim(), annotationNote: (h.annotationNote || '').trim() })),
    };
    this.saving = true;
    const request = editing ? this.roomService.update(editing.id, payload) : this.roomService.create(payload);
    request.subscribe({
      next: room => {
        this.saving = false;
        this.showModal = false;
        this.toast.success(editing ? `Đã cập nhật phòng "${room.name}"` : `Đã tạo phòng "${room.name}"`);
        this.audit.record('Phòng Mẫu', editing ? 'Sửa phòng mẫu' : 'Tạo phòng mẫu', room.name, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được phòng mẫu');
      },
    });
  }

  async remove(room: Room): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá phòng mẫu?',
      message: `"${room.name}" sẽ biến mất khỏi trang Shop the room của cửa hàng.`,
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.roomService.delete(room.id).subscribe({
      next: () => {
        this.toast.info('Đã xoá phòng mẫu');
        this.audit.record('Phòng Mẫu', 'Xoá phòng mẫu', room.name, 'WARNING');
      },
      error: err => this.toast.apiError(err, 'Không xoá được phòng mẫu'),
    });
  }
}
