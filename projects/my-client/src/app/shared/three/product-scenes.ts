import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextCanvasTexturePool } from './resource-manager';

export interface ProductSceneContext {
  modelType: string;
  colorHex: string;
  roughness: number;
  metalness: number;
  scaleMultiplier: number;
  customText: string;
  showAccessories: boolean;
}

/**
 * Thư mục chứa model .glb thật cho từng threeModelType (đặt tại
 * projects/my-client/src/assets/models/<modelType>.glb). Nếu file chưa tồn tại,
 * ProductSceneManager tự fallback về hình khối dựng bằng code như trước — không cần
 * sửa code gì thêm khi thêm file model thật vào sau này.
 */
const REAL_MODEL_BASE_PATH = 'assets/models';

export class ProductSceneManager {
  readonly rootGroup = new THREE.Group();
  private customizableMesh: THREE.Mesh | null = null;
  private customizableMaterial: THREE.MeshStandardMaterial | null = null;
  private accessoriesGroup = new THREE.Group();
  private realAccessoryNodes: THREE.Object3D[] = [];
  private textMesh: THREE.Mesh | null = null;
  private textAnchor: THREE.Object3D | null = null;
  private currentModelType = '';

  private readonly gltfLoader = new GLTFLoader();
  private loadToken = 0;

  constructor() {
    this.rootGroup.add(this.accessoriesGroup);
  }

  buildModel(ctx: ProductSceneContext, textPool: TextCanvasTexturePool, onReady?: () => void): void {
    // Clear root and accessories
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]);
    }
    while (this.accessoriesGroup.children.length > 0) {
      this.accessoriesGroup.remove(this.accessoriesGroup.children[0]);
    }

    this.rootGroup.add(this.accessoriesGroup);
    this.customizableMesh = null;
    this.textMesh = null;
    this.textAnchor = null;
    this.realAccessoryNodes = [];
    this.currentModelType = ctx.modelType;

    // Create shared customizable material
    this.customizableMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(ctx.colorHex),
      roughness: ctx.roughness,
      metalness: ctx.metalness,
    });

    const token = ++this.loadToken;
    const modelUrl = `${REAL_MODEL_BASE_PATH}/${ctx.modelType}.glb`;

    this.gltfLoader.load(
      modelUrl,
      (gltf) => {
        if (token !== this.loadToken) return; // a newer buildModel() call superseded this one
        this.applyRealModel(gltf);
        this.finishBuild(ctx, textPool, onReady);
      },
      undefined,
      () => {
        // Không tìm thấy / lỗi tải file .glb thật -> dùng hình khối dựng bằng code
        if (token !== this.loadToken) return;
        this.buildProceduralModel(ctx.modelType, this.customizableMaterial!);
        this.finishBuild(ctx, textPool, onReady);
      }
    );
  }

  private finishBuild(ctx: ProductSceneContext, textPool: TextCanvasTexturePool, onReady?: () => void): void {
    this.updateScale(ctx.scaleMultiplier);
    this.updateAccessories(ctx.showAccessories);
    this.updateText(ctx.customText, textPool);
    onReady?.();
  }

  /**
   * Gắn model .glb thật vào scene. Quy ước đặt tên node trong file .glb:
   * - "Customizable" (không phân biệt hoa/thường): mesh sẽ nhận màu/chất liệu người dùng chọn.
   * - "Accessories": node/group phụ kiện, sẽ ẩn/hiện theo tuỳ chọn "Hiện phụ kiện".
   * - "TextAnchor": vị trí đặt tấm khắc tên tuỳ chỉnh (nếu sản phẩm hỗ trợ khắc tên).
   */
  private applyRealModel(gltf: GLTF): void {
    const modelRoot = gltf.scene;
    this.rootGroup.add(modelRoot);

    modelRoot.traverse((obj) => {
      obj.castShadow = true;
      obj.receiveShadow = true;

      const name = obj.name.toLowerCase();

      if ((obj as THREE.Mesh).isMesh && name.includes('customizable') && this.customizableMaterial) {
        const mesh = obj as THREE.Mesh;
        mesh.material = this.customizableMaterial;
        if (!this.customizableMesh) {
          this.customizableMesh = mesh;
        }
      }

      if (name.includes('accessories')) {
        this.realAccessoryNodes.push(obj);
      }

      if (name.includes('textanchor')) {
        this.textAnchor = obj;
      }
    });
  }

  private buildProceduralModel(modelType: string, mat: THREE.MeshStandardMaterial): void {
    switch (modelType) {
      case 'moon_lamp':
        this.buildMoonLamp(mat);
        break;
      case 'geometric_vase':
        this.buildGeometricVase(mat);
        break;
      case 'desk_organizer':
        this.buildDeskOrganizer(mat);
        break;
      case 'cube_stool':
        this.buildCubeStool(mat);
        break;
      case 'wall_shelf':
        this.buildWallShelf(mat);
        break;
      default:
        this.buildAbstractSculpture(mat);
        break;
    }
  }

  private buildMoonLamp(mat: THREE.MeshStandardMaterial): void {
    // 1. Moon sphere
    const sphereGeo = new THREE.SphereGeometry(0.7, 40, 40);
    const pos = sphereGeo.attributes['position'];
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      const w = pos.getZ(i);
      const noise = Math.sin(u * 12) * Math.cos(v * 12) * Math.sin(w * 12) * 0.025;
      pos.setXYZ(i, u + u * noise, v + v * noise, w + w * noise);
    }
    sphereGeo.computeVertexNormals();

    this.customizableMesh = new THREE.Mesh(sphereGeo, mat);
    this.customizableMesh.castShadow = true;
    this.customizableMesh.receiveShadow = true;
    this.customizableMesh.position.y = 0.35;
    this.rootGroup.add(this.customizableMesh);

    // 2. Wooden tripod stand (Accessory)
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.8,
    });

    const basePlateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.04, 32);
    const basePlate = new THREE.Mesh(basePlateGeo, woodMat);
    basePlate.position.y = -0.36;
    basePlate.receiveShadow = true;
    basePlate.castShadow = true;
    this.accessoriesGroup.add(basePlate);

    for (let i = 0; i < 3; i++) {
      const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.45, 12);
      const leg = new THREE.Mesh(legGeo, woodMat);
      const angle = (i * Math.PI * 2) / 3;
      leg.position.set(Math.cos(angle) * 0.28, -0.45, Math.sin(angle) * 0.28);
      leg.rotation.z = Math.cos(angle) * 0.25;
      leg.rotation.x = Math.sin(angle) * 0.25;
      leg.castShadow = true;
      this.accessoriesGroup.add(leg);
    }
  }

  private buildGeometricVase(mat: THREE.MeshStandardMaterial): void {
    const vaseGeo = new THREE.CylinderGeometry(0.4, 0.55, 1.2, 24, 16);
    const pos = vaseGeo.attributes['position'];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const angle = Math.atan2(pos.getZ(i), pos.getX(i));
      const twist = Math.sin(angle * 6 + y * 4) * 0.07;
      const radius = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2) + twist;
      pos.setX(i, Math.cos(angle) * radius);
      pos.setZ(i, Math.sin(angle) * radius);
    }
    vaseGeo.computeVertexNormals();

    this.customizableMesh = new THREE.Mesh(vaseGeo, mat);
    this.customizableMesh.castShadow = true;
    this.customizableMesh.receiveShadow = true;
    this.customizableMesh.position.y = 0.05;
    this.rootGroup.add(this.customizableMesh);

    // Dried eucalyptus flowers inside vase as accessory
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.9 });
    for (let i = -1; i <= 1; i++) {
      const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8);
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(i * 0.08, 0.75, i * 0.04);
      stem.rotation.z = i * 0.15;
      stem.castShadow = true;
      this.accessoriesGroup.add(stem);
    }
  }

  private buildDeskOrganizer(mat: THREE.MeshStandardMaterial): void {
    const baseGeo = new THREE.BoxGeometry(1.4, 0.35, 0.9);
    this.customizableMesh = new THREE.Mesh(baseGeo, mat);
    this.customizableMesh.castShadow = true;
    this.customizableMesh.receiveShadow = true;
    this.customizableMesh.position.y = -0.25;
    this.rootGroup.add(this.customizableMesh);

    const penHolderGeo = new THREE.BoxGeometry(0.4, 0.65, 0.4);
    const penHolder = new THREE.Mesh(penHolderGeo, mat);
    penHolder.position.set(-0.4, 0.15, 0.15);
    penHolder.castShadow = true;
    this.rootGroup.add(penHolder);

    const phoneStandGeo = new THREE.BoxGeometry(0.65, 0.45, 0.15);
    const phoneStand = new THREE.Mesh(phoneStandGeo, mat);
    phoneStand.position.set(0.25, 0.05, -0.2);
    phoneStand.rotation.x = -0.25;
    phoneStand.castShadow = true;
    this.rootGroup.add(phoneStand);

    // Rubber pads accessory
    const padMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const padCoords = [
      [-0.6, -0.44, -0.38],
      [0.6, -0.44, -0.38],
      [-0.6, -0.44, 0.38],
      [0.6, -0.44, 0.38],
    ];
    for (const [px, py, pz] of padCoords) {
      const padGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(px, py, pz);
      this.accessoriesGroup.add(pad);
    }
  }

  private buildCubeStool(mat: THREE.MeshStandardMaterial): void {
    const topGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.08, 32);
    this.customizableMesh = new THREE.Mesh(topGeo, mat);
    this.customizableMesh.castShadow = true;
    this.customizableMesh.receiveShadow = true;
    this.customizableMesh.position.y = 0.25;
    this.rootGroup.add(this.customizableMesh);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 16);
      const leg = new THREE.Mesh(legGeo, legMat);
      const angle = (i * Math.PI * 2) / 4 + Math.PI / 4;
      leg.position.set(Math.cos(angle) * 0.45, -0.15, Math.sin(angle) * 0.45);
      leg.castShadow = true;
      this.accessoriesGroup.add(leg);
    }
  }

  private buildWallShelf(mat: THREE.MeshStandardMaterial): void {
    const shelfGeo = new THREE.BoxGeometry(1.5, 0.06, 0.4);
    this.customizableMesh = new THREE.Mesh(shelfGeo, mat);
    this.customizableMesh.castShadow = true;
    this.customizableMesh.receiveShadow = true;
    this.customizableMesh.position.y = 0.0;
    this.rootGroup.add(this.customizableMesh);

    // Book props accessory
    const bookColors = [0xb88161, 0x81b29a, 0x3d405a];
    for (let i = 0; i < 3; i++) {
      const bMat = new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.85 });
      const bookGeo = new THREE.BoxGeometry(0.08, 0.35, 0.28);
      const book = new THREE.Mesh(bookGeo, bMat);
      book.position.set(-0.35 + i * 0.12, 0.2, 0);
      book.castShadow = true;
      this.accessoriesGroup.add(book);
    }
  }

  private buildAbstractSculpture(mat: THREE.MeshStandardMaterial): void {
    const knotGeo = new THREE.TorusKnotGeometry(0.55, 0.16, 80, 16, 2, 3);
    this.customizableMesh = new THREE.Mesh(knotGeo, mat);
    this.customizableMesh.castShadow = true;
    this.customizableMesh.receiveShadow = true;
    this.customizableMesh.position.y = 0.1;
    this.rootGroup.add(this.customizableMesh);

    const pedestalGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.15, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.45;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    this.accessoriesGroup.add(pedestal);
  }

  // In-place material updates without rebuilding mesh
  updateMaterialProps(colorHex: string, roughness: number, metalness: number): void {
    if (!this.customizableMaterial) return;
    this.customizableMaterial.color.set(colorHex);
    this.customizableMaterial.roughness = roughness;
    this.customizableMaterial.metalness = metalness;
    this.customizableMaterial.needsUpdate = true;
  }

  // In-place scale update
  updateScale(scaleMultiplier: number): void {
    const s = Math.max(0.5, Math.min(2.5, scaleMultiplier));
    this.rootGroup.scale.set(s, s, s);
  }

  // In-place accessories toggle
  updateAccessories(show: boolean): void {
    this.accessoriesGroup.visible = show;
    this.realAccessoryNodes.forEach(node => { node.visible = show; });
  }

  // In-place text plate update reusing pooled texture
  updateText(text: string, textPool: TextCanvasTexturePool): void {
    const trimmed = text.trim();

    if (!trimmed) {
      if (this.textMesh) {
        this.textMesh.visible = false;
      }
      return;
    }

    textPool.drawText(trimmed);

    if (!this.textMesh) {
      const textPlateGeo = new THREE.PlaneGeometry(0.7, 0.18);
      const textPlateMat = new THREE.MeshBasicMaterial({
        map: textPool.getTexture(),
        transparent: true,
        depthWrite: false,
      });
      this.textMesh = new THREE.Mesh(textPlateGeo, textPlateMat);
      this.rootGroup.add(this.textMesh);
    }

    this.textMesh.visible = true;

    if (this.textAnchor) {
      this.textMesh.position.copy(this.textAnchor.position);
    } else if (this.currentModelType === 'moon_lamp') {
      this.textMesh.position.set(0, -0.34, 0.36);
    } else {
      this.textMesh.position.set(0, -0.22, 0.46);
    }
  }
}

