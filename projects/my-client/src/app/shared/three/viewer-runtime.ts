import { NgZone } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { QualityManager, QualitySettings } from './quality-manager';
import { ResourceManager } from './resource-manager';

export interface ViewerRuntimeOptions {
  container: HTMLElement;
  ngZone: NgZone;
  qualityManager?: QualityManager;
  cameraFov?: number;
  cameraNear?: number;
  cameraFar?: number;
  cameraInitialPos?: THREE.Vector3;
  controlsTarget?: THREE.Vector3;
  controlsMinDistance?: number;
  controlsMaxDistance?: number;
  controlsMinPolarAngle?: number;
  controlsMaxPolarAngle?: number;
  alpha?: boolean;
  clearColor?: THREE.ColorRepresentation;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onRender?: (deltaMs: number) => void;
}

export class ViewerRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;

  readonly container: HTMLElement;
  readonly ngZone: NgZone;
  readonly qualityManager: QualityManager;

  private isInteracting = false;
  private isDestroyed = false;
  private isPaused = false;
  private isContextLost = false;

  private dirtyFrames = 0;
  private rafId: number | null = null;
  private lastTime = 0;

  // Previous camera and target for damping convergence detection
  private lastCameraPos = new THREE.Vector3();
  private lastTargetPos = new THREE.Vector3();
  private readonly convergenceThresholdSq = 0.000002; // Very tight epsilon

  // Observers & Listeners
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private visibilityHandler: (() => void) | null = null;
  private qualitySubscription: (() => void) | null = null;

  // Smooth camera reset
  private resetAnimation: {
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    targetTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null = null;

  private onRenderHook?: (deltaMs: number) => void;
  private onContextLostHook?: () => void;
  private onContextRestoredHook?: () => void;

  constructor(options: ViewerRuntimeOptions) {
    this.container = options.container;
    this.ngZone = options.ngZone;
    this.qualityManager = options.qualityManager || new QualityManager('auto');
    this.onRenderHook = options.onRender;
    this.onContextLostHook = options.onContextLost;
    this.onContextRestoredHook = options.onContextRestored;

    this.scene = new THREE.Scene();

    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 500;

    const fov = options.cameraFov ?? 45;
    const near = options.cameraNear ?? 0.1;
    const far = options.cameraFar ?? 100;
    this.camera = new THREE.PerspectiveCamera(fov, w / h, near, far);

    const initPos = options.cameraInitialPos ?? new THREE.Vector3(0, 1.5, 3.5);
    this.camera.position.copy(initPos);

    // Run WebGL initialization and controls binding outside NgZone
    this.ngZone.runOutsideAngular(() => {
      this.initRenderer(options, w, h);
      this.initControls(options);
      this.initObservers();
      this.initQualitySubscription();
    });
  }

  private initRenderer(options: ViewerRuntimeOptions, width: number, height: number): void {
    const initialSettings = this.qualityManager.getSettings();

    this.renderer = new THREE.WebGLRenderer({
      antialias: initialSettings.antialias,
      alpha: options.alpha ?? false,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(width, height, false);
    const dpr = Math.min(window.devicePixelRatio || 1, initialSettings.maxDpr);
    this.renderer.setPixelRatio(dpr);

    if (initialSettings.shadowsEnabled) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = false; // Only update on demand
      this.renderer.shadowMap.needsUpdate = true;
    } else {
      this.renderer.shadowMap.enabled = false;
    }

    if (options.clearColor !== undefined) {
      this.renderer.setClearColor(options.clearColor);
    }

    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    this.container.appendChild(this.renderer.domElement);

    // WebGL context lost & restored listeners
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.isContextLost = true;
      this.stopLoop();
      if (this.onContextLostHook) {
        this.ngZone.run(() => this.onContextLostHook?.());
      }
    });

    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.isContextLost = false;
      this.requestRender(5);
      if (this.onContextRestoredHook) {
        this.ngZone.run(() => this.onContextRestoredHook?.());
      }
    });
  }

  private initControls(options: ViewerRuntimeOptions): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;

    if (options.controlsTarget) {
      this.controls.target.copy(options.controlsTarget);
    }
    if (options.controlsMinDistance !== undefined) {
      this.controls.minDistance = options.controlsMinDistance;
    }
    if (options.controlsMaxDistance !== undefined) {
      this.controls.maxDistance = options.controlsMaxDistance;
    }
    if (options.controlsMinPolarAngle !== undefined) {
      this.controls.minPolarAngle = options.controlsMinPolarAngle;
    }
    if (options.controlsMaxPolarAngle !== undefined) {
      this.controls.maxPolarAngle = options.controlsMaxPolarAngle;
    }

    this.controls.addEventListener('start', () => {
      // If user starts interacting while smooth reset is running, interrupt it immediately
      this.resetAnimation = null;
      this.isInteracting = true;
      this.startLoop();
    });

    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    this.controls.addEventListener('end', () => {
      this.isInteracting = false;
      // Controls damping will decay over next few frames, handled in loop
    });

    this.lastCameraPos.copy(this.camera.position);
    this.lastTargetPos.copy(this.controls.target);
  }

  private initObservers(): void {
    // 1. ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isDestroyed || !this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.requestRender(3);
      }
    });
    this.resizeObserver.observe(this.container);

    // 2. IntersectionObserver (pause rendering when canvas is out of viewport)
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting) {
        this.isPaused = false;
        this.requestRender(3);
      } else {
        this.isPaused = true;
        this.stopLoop();
      }
    }, { threshold: 0.05 });
    this.intersectionObserver.observe(this.container);

    // 3. Tab visibilitychange
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.isPaused = true;
        this.stopLoop();
      } else {
        this.isPaused = false;
        this.requestRender(3);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private initQualitySubscription(): void {
    this.qualitySubscription = this.qualityManager.subscribe((settings: QualitySettings) => {
      if (this.isDestroyed || !this.renderer) return;

      const currentDpr = Math.min(window.devicePixelRatio || 1, settings.maxDpr);
      this.renderer.setPixelRatio(currentDpr);

      if (settings.shadowsEnabled) {
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.needsUpdate = true;
      } else {
        this.renderer.shadowMap.enabled = false;
      }

      this.requestRender(4);
    });
  }

  /**
   * Request a render frame on demand. Passing a count > 1 ensures multiple settling frames
   * (e.g. after model swap, resize, or texture update).
   */
  requestRender(frames = 2): void {
    if (this.isDestroyed || this.isPaused || this.isContextLost) return;
    this.dirtyFrames = Math.max(this.dirtyFrames, frames);
    this.renderer.shadowMap.needsUpdate = true;
    this.startLoop();
  }

  private startLoop(): void {
    if (this.rafId !== null || this.isDestroyed || this.isPaused || this.isContextLost) return;
    this.lastTime = performance.now();
    this.ngZone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.renderLoop);
    });
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private renderLoop = (timestamp: number): void => {
    this.rafId = null;
    if (this.isDestroyed || this.isPaused || this.isContextLost) return;

    const deltaMs = Math.min(timestamp - this.lastTime, 100);
    this.lastTime = timestamp;

    let hasCameraMovement = false;

    // Handle smooth reset animation
    if (this.resetAnimation) {
      const elapsed = timestamp - this.resetAnimation.startTime;
      const progress = Math.min(elapsed / this.resetAnimation.duration, 1.0);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(this.resetAnimation.startPos, this.resetAnimation.targetPos, ease);
      this.controls.target.lerpVectors(this.resetAnimation.startTarget, this.resetAnimation.targetTarget, ease);
      hasCameraMovement = true;

      if (progress >= 1.0) {
        this.resetAnimation = null;
      }
    }

    // Update controls (damping)
    this.controls.update();

    // Check if camera or target moved significantly
    const camDistSq = this.camera.position.distanceToSquared(this.lastCameraPos);
    const targetDistSq = this.controls.target.distanceToSquared(this.lastTargetPos);

    if (camDistSq > this.convergenceThresholdSq || targetDistSq > this.convergenceThresholdSq) {
      hasCameraMovement = true;
      this.lastCameraPos.copy(this.camera.position);
      this.lastTargetPos.copy(this.controls.target);
    }

    // External onRender hook (e.g. updating hotspot coordinates directly)
    if (this.onRenderHook) {
      this.onRenderHook(deltaMs);
    }

    // Perform the actual WebGL draw
    this.renderer.render(this.scene, this.camera);

    // Record frame time for adaptive quality tier adjustment
    if (this.isInteracting || hasCameraMovement) {
      this.qualityManager.recordFrame(deltaMs);
    }

    // Decrement dirty frames if not interacting
    if (this.dirtyFrames > 0) {
      this.dirtyFrames--;
    }

    // Keep rendering if interacting, damping movement continues, or dirty frames remain
    const shouldContinue = this.isInteracting || hasCameraMovement || (this.resetAnimation !== null) || (this.dirtyFrames > 0);

    if (shouldContinue) {
      this.rafId = requestAnimationFrame(this.renderLoop);
    }
  };

  /**
   * Smoothly resets the camera to a given target position with an interruptible animation.
   */
  smoothResetCamera(
    targetCameraPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    durationMs = 350
  ): void {
    this.resetAnimation = {
      startPos: this.camera.position.clone(),
      targetPos: targetCameraPos.clone(),
      startTarget: this.controls.target.clone(),
      targetTarget: targetLookAt.clone(),
      startTime: performance.now(),
      duration: durationMs,
    };
    this.requestRender(10);
  }

  destroy(): void {
    this.isDestroyed = true;
    this.stopLoop();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.qualitySubscription) {
      this.qualitySubscription();
      this.qualitySubscription = null;
    }

    if (this.controls) {
      this.controls.dispose();
    }

    ResourceManager.deepDispose(this.scene);

    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
  }
}

