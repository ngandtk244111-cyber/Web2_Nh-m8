import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  ViewChildren,
  QueryList,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Room } from '../../../core/models/room.model';
import { Product } from '../../../core/models/product.model';
import { RoomService } from '../../../core/services/room.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { ResourceManager } from '../../../shared/three/resource-manager';
import { RoomSceneManager } from '../../../shared/three/room-scenes';

/** Điểm sản phẩm trong phòng + vị trí trên màn hình (cập nhật mỗi vài khung hình). */
interface Spot {
  id: string;
  index: number;
  label: string;
  note: string;
  productId: string;
  world: THREE.Vector3;
  x: number;
  y: number;
  visible: boolean;
  occluded: boolean;
}

/** Hiệu ứng camera bay (giống AuraPC: lerp vị trí + điểm nhìn, ease in-out cubic). */
interface CameraFlight {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  progress: number;
  duration: number;
  onDone?: () => void;
}

/** Máy có card đồ hoạ dựng phòng trong vài giây; quá mốc này thường là Chrome đang vẽ 3D bằng CPU. */
const SLOW_LOAD_MS = 20000;
/** Walkthrough: tâm xoay đặt ngay trước mắt camera -> đứng yên nhìn quanh. */
const WALK_PIVOT = 0.05;
/** Bấm chấm: camera tiến tới còn ~42% khoảng cách tới món đồ, theo đúng hướng đang nhìn. */
const FOCUS_DISTANCE_RATIO = 0.42;
const AUTO_ROTATE_SPEED = 0.5;

/**
 * Trang "Xem phòng 3D" toàn màn hình (mở ở tab mới từ Shop The Room / trang chủ).
 * Phòng đặt trên sân khấu nền kem ấm, tự xoay chậm, chấm sáng trên từng món đồ; bấm chấm -> camera bay tới cận cảnh + bảng thông tin sản phẩm trượt ra bên phải.
 */
@Component({
  selector: 'app-room-3d',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './room-3d.component.html',
  styleUrl: './room-3d.component.css',
})
export class Room3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stage', { static: true }) stage!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private ngZone = inject(NgZone);
  @ViewChildren('spotElement') spotElements!: QueryList<ElementRef<HTMLButtonElement>>;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private lastOcclusionPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastOcclusionQuaternion = new THREE.Quaternion(0, 0, 0, 0);

  private roomId = toSignal(this.route.paramMap.pipe(map(p => p.get('id') || '')), { initialValue: '' });
  readonly rooms = this.roomService.rooms;
  readonly room = computed(() => this.rooms().find(r => r.id === this.roomId()));
  /** loading: chưa có danh sách phòng; not-found: có danh sách nhưng không có mã phòng này. */
  readonly status = computed(() => (this.room() ? 'ready' : this.rooms().length ? 'not-found' : 'loading'));

  readonly modelLoaded = signal(false);
  readonly modelError = signal(false);
  readonly loadProgress = signal<number | null>(null);
  /** Trình duyệt không tạo được WebGL (đang tắt tăng tốc phần cứng, card đồ hoạ lỗi, quá nhiều tab 3D...). */
  readonly webglError = signal(false);
  /** Đã chờ lâu bất thường mà phòng chưa dựng xong -> hiện gợi ý + nút tải lại. */
  readonly slowLoad = signal(false);
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  readonly textVisible = signal(false);
  readonly active = signal<Spot | null>(null);
  /** Ngăn "Mua trọn bộ phòng" bên phải. */
  readonly buyOpen = signal(false);
  /** Thẻ thông tin phòng (góc dưới trái) đang thu nhỏ thành nút. */
  readonly cardCollapsed = signal(false);
  selectedProductIds = new Set<string>();
  private rpKey = '';
  private rpCache: Product[] = [];
  spots: Spot[] = [];

  private viewReady = signal(false);
  private loadedRoomId = '';
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private roomScenes = new RoomSceneManager();
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private animationId = 0;
  private frameCount = 0;
  private flight: CameraFlight | null = null;
  private textTimer: ReturnType<typeof setTimeout> | null = null;

  private defaultPos = new THREE.Vector3();
  private defaultTarget = new THREE.Vector3();
  /** Phòng giới hạn góc xoay ngang (chỉ có tường sau): tự xoay qua lại trong ±azimuthLimit quanh azimuthCenter. */
  private azimuthCenter = 0;
  private azimuthLimit: number | null = null;

  constructor() {
    effect(() => {
      const room = this.room();
      if (room && this.viewReady() && room.id !== this.loadedRoomId) this.loadRoom(room);
    });
  }

  ngAfterViewInit(): void {
    try {
      this.initThree();
    } catch (err) {
      console.error('Không tạo được WebGL cho phòng 3D', err);
      this.webglError.set(true);
      return;
    }
    this.viewReady.set(true);
  }

  reload(): void {
    location.reload();
  }

  ngOnDestroy(): void {
    if (this.textTimer) clearTimeout(this.textTimer);
    if (this.slowTimer) clearTimeout(this.slowTimer);
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.controls?.dispose();
    if (this.scene) { this.scene.environment = null; ResourceManager.deepDispose(this.scene); }
    this.environmentTarget?.dispose();
    this.renderer?.dispose();
  }

  /* ============================== SCENE ============================== */

  private initThree(): void {
    const el = this.stage.nativeElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1e8dc);
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.05, 300);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(environment);
    this.scene.environment = this.environmentTarget.texture;
    environment.dispose();
    pmrem.dispose();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    el.appendChild(this.renderer.domElement);

    this.createBackground();
    this.createGround();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;

    window.addEventListener('resize', this.onResize);
    this.ngZone.runOutsideAngular(() => this.animate());
  }

  /** Nền phòng trưng bày: vòm gradient kem ấm (sáng dần lên trên) — không sao, không lưới. */
  private createBackground(): void {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(120, 32, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0xfbf8f3) },
          midColor: { value: new THREE.Color(0xf1e8dc) },
          bottomColor: { value: new THREE.Color(0xe6d8c6) },
        },
        vertexShader: `varying vec3 vWP; void main(){ vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 topColor,midColor,bottomColor; varying vec3 vWP; void main(){ float h=normalize(vWP).y; vec3 c=mix(bottomColor,midColor,smoothstep(-0.05,0.12,h)); c=mix(c,topColor,smoothstep(0.12,0.7,h)); gl_FragColor=vec4(c,1.0); }`,
      }),
    );
    this.scene.add(dome);
  }

  /** Sàn sân khấu: vệt sáng tròn dưới chân phòng, mờ dần ra màu nền. */
  private createGround(): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, '#fbf7f1');
    g.addColorStop(0.35, '#f1e8dc');
    g.addColorStop(1, '#e6d8c6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.scene.add(ground);
  }

  /** Dựng phòng + đặt camera / giới hạn xoay theo cấu hình phòng (cùng quy ước với room-viewer). */
  private loadRoom(room: Room): void {
    this.loadedRoomId = room.id;
    this.lastOcclusionPosition.set(Infinity, Infinity, Infinity);
    this.flight = null;
    this.active.set(null);
    this.buyOpen.set(false);
    this.selectedProductIds = new Set(room.hotspots.map(h => h.productId));
    this.modelLoaded.set(false);
    this.modelError.set(false);
    this.loadProgress.set(null);
    this.textVisible.set(false);
    this.slowLoad.set(false);
    if (this.textTimer) clearTimeout(this.textTimer);
    if (this.slowTimer) clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => this.slowLoad.set(true), SLOW_LOAD_MS);

    const cam = room.cameraInitial || { x: 0, y: 1.8, z: 4.2, fov: 46 };
    const lookAt = room.cameraLookAt || [0, 0.6, 0];
    const walk = !!room.walkthroughMode;
    const eye = new THREE.Vector3(cam.x, cam.y, cam.z);
    const look = new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]);
    const target = walk ? eye.clone().add(look.clone().sub(eye).normalize().multiplyScalar(WALK_PIVOT)) : look;

    this.defaultPos.copy(eye);
    this.defaultTarget.copy(target);
    this.camera.fov = cam.fov || 46;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(eye);

    const c = this.controls;
    const spherical = new THREE.Spherical().setFromVector3(eye.clone().sub(target));
    const deg = THREE.MathUtils.degToRad;
    c.target.copy(target);
    c.minDistance = c.maxDistance = spherical.radius;
    if (walk) {
      // Đứng giữa phòng xoay đầu nhìn quanh: ngang 360°, dọc cúi ~40° / ngước ~25°.
      c.minPolarAngle = Math.min(deg(50), spherical.phi);
      c.maxPolarAngle = Math.max(deg(115), spherical.phi);
      c.rotateSpeed = -0.6;
    } else {
      const polar = cam.orbitPolar || [60, 88];
      c.minPolarAngle = Math.min(deg(polar[0]), spherical.phi);
      c.maxPolarAngle = Math.max(deg(polar[1]), spherical.phi);
      c.rotateSpeed = 1;
    }
    if (!walk && cam.orbitAzimuth) {
      this.azimuthCenter = spherical.theta;
      this.azimuthLimit = deg(cam.orbitAzimuth);
      c.minAzimuthAngle = spherical.theta - this.azimuthLimit;
      c.maxAzimuthAngle = spherical.theta + this.azimuthLimit;
    } else {
      this.azimuthLimit = null;
      c.minAzimuthAngle = -Infinity;
      c.maxAzimuthAngle = Infinity;
    }
    c.autoRotate = false;
    c.autoRotateSpeed = walk ? AUTO_ROTATE_SPEED * 0.6 : AUTO_ROTATE_SPEED;
    c.enabled = true;
    c.update();

    this.spots = room.hotspots.map((h, i) => ({
      id: h.id,
      index: i + 1,
      label: h.label,
      note: h.annotationNote,
      productId: h.productId,
      world: new THREE.Vector3(...h.position),
      x: 0, y: 0, visible: false, occluded: false,
    }));

    this.roomScenes.buildRoom(room, this.scene, () => {
      // Toạ độ hotspot khai báo theo file .glb gốc -> đổi sang toạ độ world sau khi model đã canh giữa.
      for (const s of this.spots) {
        const h = room.hotspots.find(x => x.id === s.id)!;
        s.world.copy(this.roomScenes.rawToWorldPosition(h.position));
      }
      this.renderer.shadowMap.needsUpdate = true;
      this.controls.autoRotate = true;
      this.ngZone.run(() => {
        this.modelLoaded.set(true);
        this.slowLoad.set(false);
        if (this.slowTimer) clearTimeout(this.slowTimer);
        this.textTimer = setTimeout(() => this.textVisible.set(true), 700);
      });
    }, percent => this.ngZone.run(() => this.loadProgress.set(percent)),
       () => this.ngZone.run(() => { this.modelError.set(true); if (this.slowTimer) clearTimeout(this.slowTimer); }));
  }

  /* ============================== RENDER LOOP ============================== */

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.flight) {
      const f = this.flight;
      f.progress = Math.min(1, f.progress + delta / f.duration);
      const t = ease(f.progress);
      this.camera.position.lerpVectors(f.fromPos, f.toPos, t);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, t);
      this.camera.lookAt(this.controls.target);
      if (f.progress >= 1) {
        this.flight = null;
        f.onDone?.();
      }
    } else if (this.controls.enabled) {
      this.bounceAutoRotate();
      this.controls.update();
    }

    this.frameCount++;
    if (this.modelLoaded() && this.frameCount % 3 === 0) {
      const changed = this.camera.position.distanceToSquared(this.lastOcclusionPosition) > 0.0001 ||
        1 - Math.abs(this.camera.quaternion.dot(this.lastOcclusionQuaternion)) > 0.00001;
      const checkOcclusion = this.frameCount % 12 === 0 && changed;
      if (checkOcclusion) {
        this.lastOcclusionPosition.copy(this.camera.position);
        this.lastOcclusionQuaternion.copy(this.camera.quaternion);
      }
      this.projectSpots(checkOcclusion);
    }

    this.renderer.render(this.scene, this.camera);
  };

  /** Phòng chỉ cho xoay ±N°: chạm biên thì đổi chiều tự xoay (qua lại thay vì đứng im ở biên). */
  private bounceAutoRotate(): void {
    if (this.azimuthLimit === null || !this.controls.autoRotate) return;
    let d = this.controls.getAzimuthalAngle() - this.azimuthCenter;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const edge = this.azimuthLimit - 0.02;
    // autoRotateSpeed dương làm góc ngang giảm dần.
    if (d <= -edge) this.controls.autoRotateSpeed = -AUTO_ROTATE_SPEED;
    else if (d >= edge) this.controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  }

  /** Chiếu điểm 3D -> toạ độ màn hình; ẩn chấm nằm sau camera, ra ngoài khung hoặc bị đồ vật che. */
  private projectSpots(checkOcclusion: boolean): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const focused = this.active() !== null || this.flight !== null;
    const v = new THREE.Vector3();

    const elements = this.spotElements?.toArray() || [];
    for (const [index, s] of this.spots.entries()) {
      if (checkOcclusion) s.occluded = this.isOccluded(s.world);
      v.copy(s.world).project(this.camera);
      s.x = (v.x * 0.5 + 0.5) * w;
      s.y = (-v.y * 0.5 + 0.5) * h;
      s.visible = !focused && !s.occluded && v.z > -1 && v.z < 1
        && s.x > 30 && s.x < w - 30 && s.y > 70 && s.y < h - 60;
      const el = elements[index]?.nativeElement;
      if (el) {
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
        el.classList.toggle('r3__spot--hidden', !s.visible);
        el.tabIndex = s.visible ? 0 : -1;
      }
    }
  }

  private isOccluded(point: THREE.Vector3): boolean {
    const origin = this.camera.position;
    const dist = origin.distanceTo(point);
    this.raycaster.set(origin, point.clone().sub(origin).normalize());
    this.raycaster.near = 0.05;
    this.raycaster.far = dist;
    const hit = this.raycaster.intersectObjects(this.roomScenes.getOccluders(), false)[0];
    // Điểm có thể nằm sát/bên trong món đồ (vd giữa lòng ghế) -> chừa sai số để không tự che chính nó;
    // chỉ ẩn khi có vật chắn rõ ràng phía trước (tường, món đồ khác).
    return !!hit && hit.distance < dist - Math.max(0.35, dist * 0.15);
  }

  /* ============================== INTERACTIONS ============================== */

  productOf(s: Spot): Product | undefined {
    return this.productService.getProductById(s.productId);
  }

  focusSpot(s: Spot): void {
    const from = this.camera.position.clone();
    const toPos = s.world.clone().add(from.clone().sub(s.world).multiplyScalar(FOCUS_DISTANCE_RATIO));
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.buyOpen.set(false);
    this.active.set(s);
    this.flight = {
      fromPos: from, toPos,
      fromTarget: this.controls.target.clone(), toTarget: s.world.clone(),
      progress: 0, duration: 1.2,
    };
  }

  /** Món trước / món tiếp theo trong phòng (bay từ góc tổng quan để luôn giữ đúng hướng nhìn). */
  stepSpot(dir: 1 | -1): void {
    const cur = this.active();
    if (!cur || !this.spots.length) return;
    const next = this.spots[(this.spots.indexOf(cur) + dir + this.spots.length) % this.spots.length];
    const from = this.camera.position.clone();
    const toPos = next.world.clone().add(this.defaultPos.clone().sub(next.world).multiplyScalar(FOCUS_DISTANCE_RATIO));
    this.active.set(next);
    this.flight = {
      fromPos: from, toPos,
      fromTarget: this.controls.target.clone(), toTarget: next.world.clone(),
      progress: 0, duration: 1.2,
    };
  }

  zoomOut(): void {
    this.active.set(null);
    this.flight = {
      fromPos: this.camera.position.clone(), toPos: this.defaultPos.clone(),
      fromTarget: this.controls.target.clone(), toTarget: this.defaultTarget.clone(),
      progress: 0, duration: 1,
      onDone: () => {
        this.controls.enabled = true;
        this.controls.autoRotate = true;
        this.controls.update();
      },
    };
  }

  addToCart(p: Product): void {
    if (p.customizable) {
      window.open(this.router.serializeUrl(this.router.createUrlTree(['/product', p.slug])), '_blank', 'noopener');
      return;
    }
    this.cartService.addToCart(p, 1);
  }

  /** Đang xem cận cảnh một món: Esc = quay về tổng quan (phòng xoay lại). */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.active()) this.zoomOut();
    else this.buyOpen.set(false);
  }

  /** Bấm vào khoảng trống trong phòng lúc đang xem một món -> quay về tổng quan (kéo chuột thì bỏ qua). */
  private pointerStart: { x: number; y: number } | null = null;
  onStageDown(e: PointerEvent): void {
    this.pointerStart = { x: e.clientX, y: e.clientY };
  }
  onStageUp(e: PointerEvent): void {
    const st = this.pointerStart;
    this.pointerStart = null;
    if (!st || this.flight || Math.hypot(e.clientX - st.x, e.clientY - st.y) >= 6) return;
    if (this.active()) this.zoomOut();
    else this.buyOpen.set(false);
  }

  /** Nút Đóng: đang xem một món thì chỉ thoát về tổng quan; ở tổng quan mới đóng trang. */
  closeTab(): void {
    if (this.active()) {
      this.zoomOut();
      return;
    }
    window.close();
    // Mở trực tiếp (không phải tab do web mở) thì trình duyệt chặn window.close -> về Shop The Room.
    setTimeout(() => this.router.navigate(['/shop-the-room'], { queryParams: { roomId: this.roomId() } }), 150);
  }

  trackSpot(_: number, s: Spot): string {
    return s.id;
  }

  /* ---------- Mua trọn bộ phòng ---------- */

  toggleBuy(): void {
    if (this.active()) this.zoomOut();
    this.buyOpen.update(v => !v);
  }

  /** Sản phẩm trong phòng theo thứ tự chấm (cache: sản phẩm có thể tải về sau phòng). */
  get roomProducts(): Product[] {
    const key = this.loadedRoomId + ':' + this.productService.products().length;
    if (key !== this.rpKey) {
      this.rpKey = key;
      this.rpCache = this.spots.map(s => this.productOf(s)).filter((p): p is Product => !!p);
    }
    return this.rpCache;
  }

  get selectedTotal(): number {
    return this.roomProducts.reduce((sum, p) => sum + (this.selectedProductIds.has(p.id) ? p.basePrice : 0), 0);
  }

  isAllSelected(): boolean {
    return this.roomProducts.length > 0 && this.roomProducts.every(p => this.selectedProductIds.has(p.id));
  }

  toggleSelectAll(): void {
    this.selectedProductIds = this.isAllSelected() ? new Set() : new Set(this.roomProducts.map(p => p.id));
  }

  toggleProductSelection(id: string): void {
    if (this.selectedProductIds.has(id)) this.selectedProductIds.delete(id);
    else this.selectedProductIds.add(id);
  }

  addSelectedToCart(): void {
    if (!this.cartService.ensureLoggedIn()) return;
    for (const p of this.roomProducts) {
      if (this.selectedProductIds.has(p.id)) this.cartService.addToCart(p, 1);
    }
  }

  /** Tổng giá các món trong phòng (hiện trên thẻ thông tin phòng). */
  roomTotal(): number {
    return this.spots.reduce((sum, s) => sum + (this.productOf(s)?.basePrice || 0), 0);
  }

  shortName(r: Room): string {
    return r.name.split('(')[0].trim();
  }

  private onResize = (): void => {
    const el = this.stage.nativeElement;
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
  };
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
