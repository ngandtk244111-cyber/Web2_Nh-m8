import { 
  Component, 
  ElementRef, 
  Input, 
  NgZone, 
  OnChanges, 
  OnDestroy, 
  OnInit, 
  SimpleChanges, 
  ViewChild 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { AppIconComponent } from '../icon/icon.component';
import { ViewerRuntime } from '../../shared/three/viewer-runtime';
import { ProductSceneManager } from '../../shared/three/product-scenes';
import { QualityManager, QualityMode, QualityTier } from '../../shared/three/quality-manager';
import { TextCanvasTexturePool } from '../../shared/three/resource-manager';

@Component({
  selector: 'app-three-viewer',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './three-viewer.component.html',
  styleUrl: './three-viewer.component.css'
})
export class ThreeViewerComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;

  @Input() modelType: string = 'moon_lamp';
  @Input() colorHex: string = '#FDFBF7';
  @Input() roughness: number = 0.85;
  @Input() metalness: number = 0.05;
  @Input() scaleMultiplier: number = 1.0;
  @Input() customText: string = '';
  @Input() showAccessories: boolean = true;
  @Input() qualityMode: QualityMode = 'auto';

  isLoading = true;
  hasError = false;

  readonly qualityOptions: { mode: QualityMode; label: string; description: string }[] = [
    { mode: 'auto', label: 'Tự động', description: 'Tự điều chỉnh FPS theo thiết bị' },
    { mode: 'power_saving', label: 'Tiết kiệm', description: 'Dành cho máy yếu / tiết kiệm pin' },
    { mode: 'balanced', label: 'Cân bằng', description: 'Độ nét chuẩn, mượt mà' },
    { mode: 'high', label: 'Cao', description: 'Khử răng cưa tối đa, bóng đổ mềm' },
  ];

  private runtime: ViewerRuntime | null = null;
  private productScenes = new ProductSceneManager();
  private textPool = new TextCanvasTexturePool();
  private qualityManager = new QualityManager('auto');

  // Text engraving debounce timer
  private textDebounceTimer: any = null;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.qualityManager.setMode(this.qualityMode);
    this.initRuntime();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qualityMode'] && !changes['qualityMode'].firstChange) {
      this.qualityManager.setMode(this.qualityMode);
    }

    if (!this.runtime) return;

    if (changes['modelType'] && !changes['modelType'].firstChange) {
      this.rebuildScene();
    } else {
      if (changes['colorHex'] || changes['roughness'] || changes['metalness']) {
        this.productScenes.updateMaterialProps(this.colorHex, this.roughness, this.metalness);
        this.runtime.requestRender(3);
      }
      if (changes['scaleMultiplier']) {
        this.productScenes.updateScale(this.scaleMultiplier);
        this.runtime.requestRender(3);
      }
      if (changes['showAccessories']) {
        this.productScenes.updateAccessories(this.showAccessories);
        this.runtime.requestRender(3);
      }
      if (changes['customText']) {
        this.debounceTextUpdate(this.customText);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.textDebounceTimer) {
      clearTimeout(this.textDebounceTimer);
    }
    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
    }
    this.textPool.dispose();
  }

  private initRuntime(): void {
    try {
      this.hasError = false;
      this.isLoading = true;

      const container = this.canvasContainer.nativeElement;

      this.runtime = new ViewerRuntime({
        container,
        ngZone: this.ngZone,
        qualityManager: this.qualityManager,
        cameraFov: 42,
        cameraInitialPos: new THREE.Vector3(0, 1.2, 3.2),
        controlsTarget: new THREE.Vector3(0, 0, 0),
        controlsMinDistance: 1.5,
        controlsMaxDistance: 6.0,
        controlsMaxPolarAngle: Math.PI / 2 + 0.1,
        alpha: true,
        onContextLost: () => {
          this.hasError = true;
        },
        onContextRestored: () => {
          this.hasError = false;
          this.rebuildScene();
        },
      });

      this.setupLightingAndShadows();
      this.runtime.scene.add(this.productScenes.rootGroup);

      this.rebuildScene();
    } catch (err) {
      console.error('ThreeViewer initialization failed:', err);
      this.hasError = true;
      this.isLoading = false;
    }
  }

  private setupLightingAndShadows(): void {
    if (!this.runtime) return;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.runtime.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    mainLight.position.set(4, 6, 4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 15;
    mainLight.shadow.bias = -0.001;
    this.runtime.scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xddeeff, 0.8);
    rimLight.position.set(-4, 3, -3);
    this.runtime.scene.add(rimLight);

    // Soft ground shadow plane
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.55;
    shadowPlane.receiveShadow = true;
    this.runtime.scene.add(shadowPlane);
  }

  private rebuildScene(): void {
    this.isLoading = true;
    this.productScenes.buildModel({
      modelType: this.modelType,
      colorHex: this.colorHex,
      roughness: this.roughness,
      metalness: this.metalness,
      scaleMultiplier: this.scaleMultiplier,
      customText: this.customText,
      showAccessories: this.showAccessories,
    }, this.textPool, () => {
      this.isLoading = false;
      if (this.runtime) {
        this.runtime.requestRender(5);
      }
    });
  }

  private debounceTextUpdate(text: string): void {
    if (this.textDebounceTimer) {
      clearTimeout(this.textDebounceTimer);
    }
    this.textDebounceTimer = setTimeout(() => {
      this.productScenes.updateText(text, this.textPool);
      if (this.runtime) {
        this.runtime.requestRender(3);
      }
    }, 150);
  }

  setQuality(mode: QualityMode): void {
    this.qualityMode = mode;
    this.qualityManager.setMode(mode);
  }

  resetCamera(): void {
    if (!this.runtime) return;
    this.runtime.smoothResetCamera(
      new THREE.Vector3(0, 1.2, 3.2),
      new THREE.Vector3(0, 0, 0),
      350
    );
  }

  retryInit(): void {
    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
    }
    this.initRuntime();
  }
}
