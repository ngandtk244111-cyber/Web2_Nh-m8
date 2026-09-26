import { 
  AfterViewInit,
  Component, 
  ElementRef, 
  EventEmitter, 
  Input, 
  NgZone, 
  OnChanges, 
  OnDestroy, 
  OnInit, 
  Output, 
  QueryList,
  SimpleChanges, 
  ViewChild, 
  ViewChildren 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { Room, RoomHotspot } from '../../core/models/room.model';
import { Product } from '../../core/models/product.model';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { MascotService } from '../../core/services/mascot.service';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ViewerRuntime } from '../../shared/three/viewer-runtime';
import { RoomSceneManager } from '../../shared/three/room-scenes';
import { HotspotManager } from '../../shared/three/hotspot-manager';
import { QualityManager, QualityMode } from '../../shared/three/quality-manager';

interface HotspotViewModel {
  hotspot: RoomHotspot;
  product?: Product;
}

@Component({
  selector: 'app-room-viewer',
  standalone: true,
  imports: [CommonModule, AppIconComponent, VndPipe],
  templateUrl: './room-viewer.component.html',
  styleUrl: './room-viewer.component.css'
})
export class RoomViewerComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChildren('hotspotPin') hotspotPinElements!: QueryList<ElementRef<HTMLDivElement>>;

  @Input() room!: Room;
  @Input() qualityMode: QualityMode = 'auto';
  /** true: giãn theo chiều cao của phần tử cha (tối thiểu 440px) thay vì chiều cao cố định theo breakpoint. */
  @Input() fill = false;
  @Output() hotspotClicked = new EventEmitter<Product>();

  hotspotViewModels: HotspotViewModel[] = [];
  selectedHotspot: HotspotViewModel | null = null;
  hasError = false;

  readonly qualityOptions: { mode: QualityMode; label: string; description: string }[] = [
    { mode: 'auto', label: 'Tự động', description: 'Tự điều chỉnh FPS theo thiết bị' },
    { mode: 'power_saving', label: 'Tiết kiệm', description: 'Dành cho máy yếu / tiết kiệm pin' },
    { mode: 'balanced', label: 'Cân bằng', description: 'Độ nét chuẩn, mượt mà' },
    { mode: 'high', label: 'Cao', description: 'Khử răng cưa tối đa, bóng đổ mềm' },
  ];

  private runtime: ViewerRuntime | null = null;
  private roomScenes = new RoomSceneManager();
  private hotspotManager = new HotspotManager();
  private qualityManager = new QualityManager('auto');

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private ngZone: NgZone,
    private mascotService: MascotService
  ) {}

  private debugPointerStart: { x: number; y: number } | null = null;
  private onDebugPointerDown = (e: PointerEvent) => {
    this.debugPointerStart = { x: e.clientX, y: e.clientY };
  };
  private onDebugPointerUp = (e: PointerEvent) => {
    if (!this.debugPointerStart) return;
    const dx = e.clientX - this.debugPointerStart.x;
    const dy = e.clientY - this.debugPointerStart.y;
    this.debugPointerStart = null;
    // Bỏ qua nếu chuột đã kéo (đang xoay phòng), chỉ tính là click khi gần như đứng yên.
    if (Math.sqrt(dx * dx + dy * dy) > 6) return;
    this.logClickedPosition(e);
  };

  ngOnInit(): void {
    this.qualityManager.setMode(this.qualityMode);
    this.prepareHotspots();
    this.initRuntime();
  }

  ngAfterViewInit(): void {
    this.bindHotspotElements();
    this.hotspotPinElements.changes.subscribe(() => {
      this.bindHotspotElements();
    });

    // Công cụ debug: click vào phòng 3D để lấy nhanh toạ độ (world + toạ độ gốc file .glb)
    // in ra console, dùng để điền vào hotspots trong mock-data.ts.
    const el = this.canvasContainer.nativeElement;
    el.addEventListener('pointerdown', this.onDebugPointerDown);
    el.addEventListener('pointerup', this.onDebugPointerUp);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qualityMode'] && !changes['qualityMode'].firstChange) {
      this.qualityManager.setMode(this.qualityMode);
    }

    if (changes['room'] && !changes['room'].firstChange) {
      this.selectedHotspot = null;
      this.prepareHotspots();
      this.buildScene();
      this.resetCamera();
    }
  }

  ngOnDestroy(): void {
    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
    }
    this.hotspotManager.clear();

    const el = this.canvasContainer?.nativeElement;
    if (el) {
      el.removeEventListener('pointerdown', this.onDebugPointerDown);
      el.removeEventListener('pointerup', this.onDebugPointerUp);
    }
  }

  private prepareHotspots(): void {
    if (!this.room) return;
    this.hotspotViewModels = this.room.hotspots.map(h => ({
      hotspot: h,
      product: this.productService.getProductById(h.productId),
    }));
    this.applyHotspotWorldPositions();
  }

  /**
   * Hotspot cho phòng glb_scene được khai báo bằng toạ độ GỐC của file .glb (dễ lấy bằng công
   * cụ click-to-get-position bên dưới). Hàm này quy đổi sang toạ độ world thật của scene trước
   * khi đưa cho HotspotManager chiếu lên màn hình — phải gọi lại sau khi model .glb tải xong
   * (wrapper canh giữa/scale chỉ tồn tại lúc đó), nên được gọi cả ở đây lẫn trong buildScene().
   */
  private applyHotspotWorldPositions(): void {
    if (!this.room) return;
    const worldHotspots: RoomHotspot[] = this.room.hotspots.map(h => {
      const world = this.roomScenes.rawToWorldPosition(h.position);
      return { ...h, position: [world.x, world.y, world.z] };
    });
    this.hotspotManager.setHotspots(worldHotspots);
  }

  /** Debug: click vào phòng 3D -> in ra console toạ độ world + toạ độ gốc file .glb tại điểm click. */
  private logClickedPosition(e: PointerEvent): void {
    if (!this.runtime) return;

    const rect = this.canvasContainer.nativeElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.runtime.camera);
    const hits = raycaster.intersectObject(this.roomScenes.roomGroup, true);

    if (hits.length === 0) {
      console.log('[Room Debug] Không trúng mesh nào tại điểm click.');
      return;
    }

    const worldPoint = hits[0].point;
    const rawPoint = this.roomScenes.worldToRawPosition(worldPoint.clone());

    console.log('%c[Room Debug] Toạ độ tại điểm vừa click:', 'color:#CD818E;font-weight:bold;');
    console.log(
      'Toạ độ GỐC (dán thẳng vào "position" của hotspot trong mock-data.ts):',
      `[${rawPoint.x.toFixed(3)}, ${rawPoint.y.toFixed(3)}, ${rawPoint.z.toFixed(3)}]`
    );
    console.log(
      'Toạ độ world (chỉ để tham khảo, không dùng để dán vào hotspot):',
      `[${worldPoint.x.toFixed(3)}, ${worldPoint.y.toFixed(3)}, ${worldPoint.z.toFixed(3)}]`
    );
    console.log('Mesh trúng:', hits[0].object.name || '(không tên)');
  }

  private bindHotspotElements(): void {
    if (!this.hotspotPinElements) return;
    this.hotspotPinElements.forEach(pin => {
      const id = pin.nativeElement.getAttribute('data-id');
      if (id) {
        this.hotspotManager.bindElement(id, pin.nativeElement);
      }
    });
    if (this.runtime) {
      this.runtime.requestRender(2);
    }
  }

  private initRuntime(): void {
    try {
      this.hasError = false;
      const container = this.canvasContainer.nativeElement;

      const initCam = this.room?.cameraInitial || { x: 0, y: 1.8, z: 4.2, fov: 46 };
      const lookAt = this.room?.cameraLookAt || [0, 0.6, 0];
      const isWalkthrough = !!this.room?.walkthroughMode;
      const isFreeExplore = !!this.room?.freeExploreMode;
      const initDistance = new THREE.Vector3(initCam.x, initCam.y, initCam.z)
        .distanceTo(new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]));

      this.runtime = new ViewerRuntime({
        container,
        ngZone: this.ngZone,
        qualityManager: this.qualityManager,
        cameraFov: initCam.fov || 46,
        cameraInitialPos: new THREE.Vector3(initCam.x, initCam.y, initCam.z),
        controlsTarget: new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]),
        // Walkthrough: khoá bán kính orbit sát với khoảng cách camera ban đầu (chỉ nhích nhẹ để
        // zoom), để người dùng chỉ xoay quanh đúng góc nội thất đã canh sẵn thay vì bay ra xa
        // thấy hết tường/không gian trống xung quanh.
        controlsMinDistance: isWalkthrough ? Math.max(0.5, initDistance - 0.6) : (isFreeExplore ? 0.05 : 2.0),
        controlsMaxDistance: isWalkthrough ? initDistance + 0.6 : (isFreeExplore ? 100 : 6.5),
        // Khoá góc nghiêng dọc: chỉ cho xoay ngang quanh phòng, không ngước lên trần / cúi xuống sàn.
        // Bỏ khoá tạm thời khi đang ở chế độ khám phá tự do để dễ định hướng bay vào trong.
        controlsMinPolarAngle: isFreeExplore ? 0 : Math.PI / 2,
        controlsMaxPolarAngle: isFreeExplore ? Math.PI : Math.PI / 2,
        clearColor: 0xf3f1ec,
        onRender: () => {
          // Update hotspot transforms directly in the render callback outside NgZone
          if (this.runtime) {
            const w = this.canvasContainer.nativeElement.clientWidth;
            const h = this.canvasContainer.nativeElement.clientHeight;
            this.hotspotManager.updatePositions(this.runtime.camera, w, h, false);
          }
        },
        onContextLost: () => {
          this.hasError = true;
          this.mascotService.react('angry');
        },
        onContextRestored: () => {
          this.hasError = false;
          this.buildScene();
        },
      });

      this.runtime.scene.background = new THREE.Color('#F3F1EC');
      this.runtime.scene.fog = new THREE.FogExp2('#F3F1EC', 0.04);

      this.buildScene();
      this.runtime.requestRender(5);
    } catch (err) {
      console.error('RoomViewer initialization failed:', err);
      this.hasError = true;
      this.mascotService.react('angry');
    }
  }

  private buildScene(): void {
    if (!this.runtime || !this.room) return;
    this.roomScenes.buildRoom(this.room, this.runtime.scene, () => {
      this.hotspotManager.setOccluders(this.roomScenes.getOccluders());
      this.applyHotspotWorldPositions();
      if (this.runtime) {
        this.runtime.requestRender(5);
      }
    });
  }

  selectHotspot(item: HotspotViewModel): void {
    this.selectedHotspot = item;
    if (item.product) {
      this.hotspotClicked.emit(item.product);
    }
    if (this.runtime) {
      this.runtime.requestRender(2);
    }
  }

  viewProduct(product: Product): void {
    this.router.navigate(['/product', product.slug]);
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
    this.mascotService.react('happy');
  }

  /** Chọn điểm đánh dấu từ bên ngoài (vd: danh sách sản phẩm cạnh viewer ở trang chủ). */
  selectHotspotByProduct(productId: string): void {
    const item = this.hotspotViewModels.find(vm => vm.hotspot.productId === productId);
    if (item) this.selectHotspot(item);
  }

  resetCamera(): void {
    if (!this.runtime || !this.room) return;
    const initCam = this.room.cameraInitial || { x: 0, y: 1.8, z: 4.2 };
    const lookAt = this.room.cameraLookAt || [0, 0.6, 0];
    this.runtime.smoothResetCamera(
      new THREE.Vector3(initCam.x, initCam.y, initCam.z),
      new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]),
      350
    );
  }

  setQuality(mode: QualityMode): void {
    this.qualityMode = mode;
    this.qualityManager.setMode(mode);
  }

  retryInit(): void {
    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
    }
    this.initRuntime();
  }
}
