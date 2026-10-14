import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Product } from '../../core/models/product.model';
import { has3DModel } from '../../core/data/catalog-taxonomy';
import { ViewerRuntime } from '../../shared/three/viewer-runtime';
import { ProductSceneManager, PRODUCT_FLOOR_Y } from '../../shared/three/product-scenes';
import { QualityManager } from '../../shared/three/quality-manager';
import { TextCanvasTexturePool } from '../../shared/three/resource-manager';
import { AppIconComponent } from '../icon/icon.component';

export type StageState = 'loading' | 'ready' | 'error' | 'no-model';
export type StageAngle = 'front' | 'left' | 'right' | 'back' | 'top';

/** Một lựa chọn hiển thị: phiên bản vật liệu trong file GLB, hoặc màu/chất liệu cho mô hình dựng sẵn. */
export interface StageLook {
  variant?: string | null;
  colorHex?: string;
  roughness?: number;
  metalness?: number;
}

/**
 * Sân khấu 3D dùng chung cho các phòng xem sản phẩm (xem nhanh 3D & phòng 3D). Chỉ lo phần hiển thị
 * mô hình — xoay 360°, zoom, góc nhìn, đổi phiên bản — còn giao diện xung quanh do từng phòng tự dựng.
 * Nguồn mô hình: Product.modelUrl (GLB/GLTF thật) > Product.threeModelType (xem ProductSceneManager).
 */
@Component({
  selector: 'app-product-model-stage',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './product-model-stage.component.html',
  styleUrl: './product-model-stage.component.css',
})
export class ProductModelStageComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasHost', { static: true }) canvasHost!: ElementRef<HTMLDivElement>;

  @Input({ required: true }) product!: Product;
  @Input() look: StageLook = {};
  @Input() autoRotate = false;

  @Output() stateChange = new EventEmitter<StageState>();
  /** Tên các phiên bản vật liệu có trong file GLB (rỗng với mô hình dựng sẵn). */
  @Output() variantsChange = new EventEmitter<string[]>();

  state: StageState = 'loading';

  private readonly ngZone = inject(NgZone);
  private runtime: ViewerRuntime | null = null;
  private readonly scenes = new ProductSceneManager();
  private readonly textPool = new TextCanvasTexturePool();
  private readonly quality = new QualityManager('high');
  private envTexture: THREE.Texture | null = null;

  // Khung nhìn mặc định tính theo kích thước mô hình sau khi tải.
  private target = new THREE.Vector3(0, -0.2, 0);
  private viewDistance = 3;

  ngAfterViewInit(): void {
    // Hoãn sang microtask: init phát stateChange, không được đổi state cha trong lượt change detection hiện tại.
    queueMicrotask(() => this.init());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.runtime) return;
    if (changes['product'] && !changes['product'].firstChange) {
      this.loadModel();
      return;
    }
    if (changes['look']) this.applyLook(this.look);
    if (changes['autoRotate']) this.setAutoRotate(this.autoRotate);
  }

  ngOnDestroy(): void {
    this.runtime?.destroy();
    this.runtime = null;
    this.envTexture?.dispose();
    this.textPool.dispose();
  }

  // ---------------- Điều khiển dùng từ phòng xem ----------------

  zoom(factor: number): void {
    const rt = this.runtime;
    if (!rt) return;
    const dir = rt.camera.position.clone().sub(rt.controls.target);
    const dist = THREE.MathUtils.clamp(dir.length() * factor, rt.controls.minDistance, rt.controls.maxDistance);
    rt.smoothResetCamera(rt.controls.target.clone().add(dir.setLength(dist)), rt.controls.target.clone(), 260);
  }

  setAngle(angle: StageAngle): void {
    const rt = this.runtime;
    if (!rt) return;
    const d = this.viewDistance;
    const offsets: Record<StageAngle, THREE.Vector3> = {
      front: new THREE.Vector3(0, d * 0.28, d),
      back: new THREE.Vector3(0, d * 0.28, -d),
      left: new THREE.Vector3(-d, d * 0.22, 0.001),
      right: new THREE.Vector3(d, d * 0.22, 0.001),
      top: new THREE.Vector3(0.001, d, 0.15),
    };
    rt.smoothResetCamera(this.target.clone().add(offsets[angle].setLength(d)), this.target.clone(), 450);
  }

  resetView(): void {
    this.setAngle('front');
  }

  setAutoRotate(on: boolean): void {
    if (!this.runtime) return;
    this.runtime.controls.autoRotate = on;
    this.runtime.controls.autoRotateSpeed = 1.6;
    this.runtime.requestRender(2);
  }

  /**
   * Ảnh chụp mô hình ở từng lựa chọn (dùng làm thumbnail phiên bản) — chụp từ chính cảnh 3D theo góc
   * nhìn chuẩn, nền trắng. Xong thì trả lại lựa chọn đang hiển thị.
   */
  async captureLooks(looks: StageLook[], width = 220, height = 160): Promise<string[]> {
    const rt = this.runtime;
    if (!rt || this.state !== 'ready') return [];
    const cam = rt.camera.clone();
    cam.position.copy(this.target.clone().add(new THREE.Vector3(0.55, 0.32, 1).setLength(this.viewDistance * 0.92)));
    cam.lookAt(this.target);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();

    // Render vào 1 khung giữa canvas có đúng tỉ lệ thumbnail (đơn vị CSS px) rồi cắt đúng khung đó,
    // để ảnh không bị kéo giãn theo tỉ lệ của canvas chính.
    const src = rt.renderer.domElement;
    const cssW = src.clientWidth;
    const cssH = src.clientHeight;
    if (!cssW || !cssH) return [];
    const aspect = width / height;
    let vw = cssH * aspect;
    let vh = cssH;
    if (vw > cssW) {
      vw = cssW;
      vh = cssW / aspect;
    }
    const vx = (cssW - vw) / 2;
    const vy = (cssH - vh) / 2;
    const px = src.width / cssW;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const results: string[] = [];
    try {
      rt.renderer.setScissorTest(true);
      rt.renderer.setViewport(vx, vy, vw, vh);
      rt.renderer.setScissor(vx, vy, vw, vh);
      for (const look of looks) {
        await this.applyLook(look, false);
        rt.renderer.render(rt.scene, cam);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(src, vx * px, vy * px, vw * px, vh * px, 0, 0, width, height);
        results.push(canvas.toDataURL('image/jpeg', 0.85));
      }
    } finally {
      rt.renderer.setScissorTest(false);
      rt.renderer.setViewport(0, 0, cssW, cssH);
    }
    await this.applyLook(this.look);
    return results;
  }

  // ---------------- Nội bộ ----------------

  private setState(state: StageState): void {
    this.state = state;
    this.stateChange.emit(state);
  }

  private init(): void {
    if (!has3DModel(this.product)) {
      this.setState('no-model');
      return;
    }
    try {
      this.runtime = new ViewerRuntime({
        container: this.canvasHost.nativeElement,
        ngZone: this.ngZone,
        qualityManager: this.quality,
        cameraFov: 35,
        cameraInitialPos: new THREE.Vector3(0, 0.8, 3.2),
        controlsTarget: this.target.clone(),
        controlsMinDistance: 0.9,
        controlsMaxDistance: 7,
        controlsMaxPolarAngle: Math.PI / 2 + 0.05,
        alpha: true,
        onContextLost: () => this.ngZone.run(() => this.setState('error')),
        onContextRestored: () => this.loadModel(),
      });
      const renderer = this.runtime.renderer;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      this.runtime.controls.enablePan = false;

      // Ánh sáng môi trường (phản chiếu mềm cho vải nhung, kim loại, gốm men).
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.runtime.scene.environment = this.envTexture;

      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(3, 5, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 15;
      key.shadow.bias = -0.0008;
      this.runtime.scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.14 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = PRODUCT_FLOOR_Y - 0.002;
      floor.receiveShadow = true;
      this.runtime.scene.add(floor, this.scenes.rootGroup);

      this.loadModel();
    } catch (err) {
      console.error('Không khởi tạo được WebGL cho phòng xem 3D', err);
      this.setState('error');
    }
  }

  private loadModel(): void {
    if (!this.runtime) return;
    this.setState('loading');
    const p = this.product;
    const colors = p.customization?.colors ?? [];
    const material = p.customization?.materials?.[0];
    this.scenes.buildModel({
      modelType: p.threeModelType ?? '',
      modelUrl: p.modelUrl,
      colorHex: this.look.colorHex ?? colors[0]?.hex ?? '#EDE6DA',
      roughness: this.look.roughness ?? material?.roughness ?? 0.7,
      metalness: this.look.metalness ?? material?.metalness ?? 0.05,
      scaleMultiplier: 1,
      customText: '',
      showAccessories: true,
    }, this.textPool, () => this.ngZone.run(async () => {
      this.frameModel();
      this.variantsChange.emit(this.scenes.getVariantNames());
      await this.applyLook(this.look);
      this.setState('ready');
      this.setAutoRotate(this.autoRotate);
    }), () => this.ngZone.run(() => this.setState('error')));
  }

  /** Đặt camera vừa khít mô hình (mô hình to nhỏ khác nhau tuỳ sản phẩm). */
  private frameModel(): void {
    const rt = this.runtime!;
    const box = new THREE.Box3().setFromObject(this.scenes.rootGroup);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    this.target.copy(box.getCenter(new THREE.Vector3()));
    // Vừa khít theo cả chiều cao lẫn chiều ngang khung hình (lấy cạnh ngang lớn nhất vì mô hình xoay quanh
    // trục đứng), chừa lề ~30% để xoay 360° không bị cắt.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(rt.camera.fov) / 2);
    const aspect = Math.max(rt.camera.aspect, 0.3);
    const span = Math.max(size.x, size.z);
    const fitHeight = size.y / 2 / tanHalf + span / 2;
    const fitWidth = span / 2 / (tanHalf * aspect) + span / 2;
    this.viewDistance = Math.max(fitHeight, fitWidth) * 1.3;
    rt.controls.minDistance = this.viewDistance * 0.35;
    rt.controls.maxDistance = this.viewDistance * 2.4;
    rt.controls.target.copy(this.target);
    rt.camera.position.copy(this.target.clone().add(new THREE.Vector3(0, 0.28, 1).setLength(this.viewDistance)));
    rt.camera.updateProjectionMatrix();
    rt.requestRender(5);
  }

  private async applyLook(look: StageLook, render = true): Promise<void> {
    const p = this.product;
    if (p.modelUrl) {
      await this.scenes.selectVariant(look.variant ?? null);
    } else {
      const colors = p.customization?.colors ?? [];
      const material = p.customization?.materials?.[0];
      this.scenes.updateMaterialProps(
        look.colorHex ?? colors[0]?.hex ?? '#EDE6DA',
        look.roughness ?? material?.roughness ?? 0.7,
        look.metalness ?? material?.metalness ?? 0.05,
      );
    }
    if (render) this.runtime?.requestRender(4);
  }
}
