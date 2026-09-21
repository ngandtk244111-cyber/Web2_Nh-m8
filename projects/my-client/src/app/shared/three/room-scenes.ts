import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Room } from '../../core/models/room.model';
import { ResourceManager } from './resource-manager';

/** Kích thước mục tiêu (đơn vị three.js) sau khi canh giữa + scale 1 model .glb thật,
 * để khớp với tầm camera đang dùng cho các phòng dựng bằng code (bàn ~2-3 đơn vị). */
const GLB_ROOM_TARGET_SIZE = 6;

export class RoomSceneManager {
  readonly roomGroup = new THREE.Group();
  private lightsGroup = new THREE.Group();
  private occluders: THREE.Object3D[] = [];
  private readonly gltfLoader = new GLTFLoader();
  private loadToken = 0;

  /**
   * gltf.scene gốc (model .glb thật) — KHÔNG phải wrapper bọc ngoài. Object3D.worldToLocal /
   * localToWorld tự cộng dồn toàn bộ chuỗi transform từ nó lên tới root (bao gồm cả scale của
   * wrapper LẪN phần dịch chuyển canh giữa gắn trực tiếp lên chính object này), nên phải dùng
   * đúng object này chứ không phải wrapper — dùng nhầm wrapper sẽ thiếu mất phần dịch chuyển
   * canh giữa và gây lệch toạ độ (đặc biệt lệch nhiều theo trục có box.min lớn, ví dụ trục Y).
   */
  private glbObject: THREE.Object3D | null = null;

  getOccluders(): THREE.Object3D[] {
    return this.occluders;
  }

  /**
   * Quy đổi 1 điểm toạ độ GỐC (đọc trực tiếp từ file .glb, ví dụ lấy từ công cụ
   * click-to-get-position) sang toạ độ world thật trong scene hiện tại.
   * Với phòng dựng bằng code (không có model thật), toạ độ local = world nên trả về nguyên vẹn.
   */
  rawToWorldPosition(raw: [number, number, number]): THREE.Vector3 {
    const point = new THREE.Vector3(raw[0], raw[1], raw[2]);
    if (!this.glbObject) return point;
    this.glbObject.updateMatrixWorld(true);
    return this.glbObject.localToWorld(point);
  }

  /**
   * Chiều ngược lại: từ 1 điểm world thật (ví dụ điểm raycaster bắt được khi click chuột)
   * ra toạ độ GỐC tương ứng trong file .glb — dùng cho công cụ debug click-to-get-position.
   */
  worldToRawPosition(world: THREE.Vector3): THREE.Vector3 {
    if (!this.glbObject) return world.clone();
    this.glbObject.updateMatrixWorld(true);
    return this.glbObject.worldToLocal(world.clone());
  }

  buildRoom(room: Room, scene: THREE.Scene, onReady?: () => void): void {
    // Clear and dispose previous room objects and lights
    ResourceManager.deepDispose(this.roomGroup);
    ResourceManager.deepDispose(this.lightsGroup);
    this.occluders = [];
    this.glbObject = null;

    if (!scene.children.includes(this.roomGroup)) {
      scene.add(this.roomGroup);
    }
    if (!scene.children.includes(this.lightsGroup)) {
      scene.add(this.lightsGroup);
    }

    const token = ++this.loadToken;

    if (room.roomType === 'glb_scene' && room.modelUrl) {
      this.gltfLoader.load(
        room.modelUrl,
        (gltf) => {
          if (token !== this.loadToken) return;
          // Đảm bảo ma trận world của model đã cập nhật đúng theo scale/rotation gốc của
          // file trước khi mình đọc bounding box hoặc gắn thêm transform lên trên nó.
          gltf.scene.updateMatrixWorld(true);
          this.setupGenericLighting();
          this.centerAndNormalize(gltf.scene, room.modelFocusBounds);
          this.roomGroup.add(gltf.scene);
          onReady?.();
        },
        undefined,
        (err) => {
          console.error('Failed to load room .glb, falling back to minimal study', err);
          if (token !== this.loadToken) return;
          this.buildMinimalStudy();
          onReady?.();
        }
      );
      return;
    }

    if (room.roomType === 'cozy_bedroom') {
      this.buildCozyBedroom();
    } else {
      this.buildMinimalStudy();
    }
    onReady?.();
  }

  /**
   * Model .glb tải từ ngoài (Sketchfab...) thường không cùng gốc toạ độ/scale với
   * setup camera hiện tại. Hàm này tự canh giữa theo tâm bounding box và scale lại
   * theo chiều lớn nhất để luôn vừa khung nhìn, bất kể đơn vị gốc của file là gì.
   */
  private centerAndNormalize(
    object: THREE.Object3D,
    focusBounds?: { min: [number, number, number]; max: [number, number, number] }
  ): void {
    const box = focusBounds
      ? new THREE.Box3(
          new THREE.Vector3(...focusBounds.min),
          new THREE.Vector3(...focusBounds.max)
        )
      : new THREE.Box3().setFromObject(object);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = GLB_ROOM_TARGET_SIZE / maxDim;
    console.log(`[Room Debug] centerAndNormalize: size=${size.toArray().map(n => n.toFixed(2))} maxDim=${maxDim.toFixed(2)} scale=${scale.toFixed(4)} center=${center.toArray().map(n => n.toFixed(2))} box.min.y=${box.min.y.toFixed(2)}`);

    object.position.set(-center.x, -box.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(object);
    wrapper.scale.setScalar(scale);
    wrapper.updateMatrixWorld(true);

    object.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });

    this.roomGroup.add(wrapper);
    this.occluders.push(wrapper);
    this.glbObject = object;
  }

  private setupGenericLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    this.lightsGroup.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff3e0, 1.6);
    sunLight.position.set(5, 10, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    this.lightsGroup.add(sunLight);

    const fill = new THREE.DirectionalLight(0xdde8ff, 0.6);
    fill.position.set(-6, 4, -4);
    this.lightsGroup.add(fill);
  }

  private buildMinimalStudy(): void {
    // --- LIGHTING ---
    const ambient = new THREE.AmbientLight(0xfff5ea, 0.85);
    this.lightsGroup.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    sunLight.position.set(5, 8, 4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 20;
    sunLight.shadow.bias = -0.0005;
    this.lightsGroup.add(sunLight);

    const deskPoint = new THREE.PointLight(0xffb066, 1.2, 4);
    deskPoint.position.set(-1.2, 1.2, 0.2);
    this.lightsGroup.add(deskPoint);

    // --- MATERIALS ---
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd9ceba, roughness: 0.8 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 });
    const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.5 });
    const vaseMat = new THREE.MeshStandardMaterial({ color: 0x9caf88, roughness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfffcf5, roughness: 0.3, emissive: 0xffd599, emissiveIntensity: 0.4 });

    // 1. Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.8;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // 2. Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
    backWall.position.set(0, 2.2, -2.5);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);
    this.occluders.push(backWall);

    // 3. Side Wall
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(-3.5, 2.2, 0);
    sideWall.receiveShadow = true;
    this.roomGroup.add(sideWall);
    this.occluders.push(sideWall);

    // 4. Desk
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.3), deskTopMat);
    deskTop.position.set(0, 0.0, 0.1);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    this.roomGroup.add(deskTop);
    this.occluders.push(deskTop);

    const legCoords = [
      [-1.35, -0.4, -0.45],
      [1.35, -0.4, -0.45],
      [-1.35, -0.4, 0.65],
      [1.35, -0.4, 0.65],
    ];
    for (const [lx, ly, lz] of legCoords) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 12), metalMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      this.roomGroup.add(leg);
    }

    // 5. Laptop (Center)
    const laptop = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.02, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 })
    );
    laptop.position.set(0, 0.05, 0.15);
    laptop.castShadow = true;
    this.roomGroup.add(laptop);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.38, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 })
    );
    screen.position.set(0, 0.22, -0.04);
    screen.rotation.x = -0.25;
    this.roomGroup.add(screen);

    // 6. Moon Lamp [hs-1: -1.2, 0.45, 0.2]
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), lampMat);
    moon.position.set(-1.2, 0.45, 0.2);
    moon.castShadow = true;
    this.roomGroup.add(moon);

    const lampStand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16), deskTopMat);
    lampStand.position.set(-1.2, 0.06, 0.2);
    this.roomGroup.add(lampStand);

    // 7. Desk Organizer [hs-2: 0.3, 0.2, 0.5]
    const org = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.15, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x4a4e69, roughness: 0.7 })
    );
    org.position.set(0.3, 0.12, 0.5);
    org.castShadow = true;
    this.roomGroup.add(org);

    // 8. Parametric Vase [hs-3: 1.1, 0.4, -0.1]
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 16), vaseMat);
    vase.position.set(1.1, 0.25, -0.1);
    vase.castShadow = true;
    this.roomGroup.add(vase);

    // 9. Floating Wall Shelf [hs-4: 0, 1.3, -1.2]
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.3), deskTopMat);
    shelf.position.set(0, 1.3, -1.2);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    this.roomGroup.add(shelf);
    this.occluders.push(shelf);

    // Books on shelf
    const bookColors = [0xb88161, 0x81b29a, 0x3d405a];
    for (let i = 0; i < 3; i++) {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.25, 0.22),
        new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.9 })
      );
      book.position.set(-0.6 + i * 0.1, 1.45, -1.2);
      book.castShadow = true;
      this.roomGroup.add(book);
    }
  }

  private buildCozyBedroom(): void {
    // --- LIGHTING ---
    const ambient = new THREE.AmbientLight(0xffeedd, 0.8);
    this.lightsGroup.add(ambient);

    const warmLight = new THREE.DirectionalLight(0xffdfba, 1.4);
    warmLight.position.set(4, 7, 3);
    warmLight.castShadow = true;
    warmLight.shadow.mapSize.width = 1024;
    warmLight.shadow.mapSize.height = 1024;
    warmLight.shadow.camera.near = 0.5;
    warmLight.shadow.camera.far = 20;
    warmLight.shadow.bias = -0.0005;
    this.lightsGroup.add(warmLight);

    const bedsideGlow = new THREE.PointLight(0xffa84c, 1.4, 4);
    bedsideGlow.position.set(-1.0, 0.9, 0.4);
    this.lightsGroup.add(bedsideGlow);

    // --- MATERIALS ---
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd4c7b2, roughness: 0.85 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xede8df, roughness: 0.95 });
    const woodOakMat = new THREE.MeshStandardMaterial({ color: 0xba8c5a, roughness: 0.7 });
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.9 });
    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x938574, roughness: 0.9 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.9 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xc49a45, roughness: 0.35, metalness: 0.7 });
    const mobiusMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfffcf5, roughness: 0.3, emissive: 0xffe2b2, emissiveIntensity: 0.5 });

    // 1. Floor & Rug
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.8;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xdfd9cb, roughness: 0.95 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.3, -0.79, 0.3);
    rug.receiveShadow = true;
    this.roomGroup.add(rug);

    // 2. Walls
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
    backWall.position.set(0, 2.2, -2.5);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);
    this.occluders.push(backWall);

    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(-3.5, 2.2, 0);
    sideWall.receiveShadow = true;
    this.roomGroup.add(sideWall);
    this.occluders.push(sideWall);

    // 3. Japandi Platform Bed
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 2.6), woodOakMat);
    bedBase.position.set(0.6, -0.65, -0.3);
    bedBase.castShadow = true;
    bedBase.receiveShadow = true;
    this.roomGroup.add(bedBase);
    this.occluders.push(bedBase);

    // Mattress
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 2.3), mattressMat);
    mattress.position.set(0.6, -0.35, -0.3);
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    this.roomGroup.add(mattress);
    this.occluders.push(mattress);

    // Blanket folded at bottom
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.12, 1.4), blanketMat);
    blanket.position.set(0.6, -0.21, 0.2);
    blanket.castShadow = true;
    this.roomGroup.add(blanket);

    // Pillows
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.45), pillowMat);
    p1.position.set(0.15, -0.15, -1.1);
    p1.rotation.x = 0.2;
    p1.castShadow = true;
    this.roomGroup.add(p1);

    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.45), pillowMat);
    p2.position.set(1.05, -0.15, -1.1);
    p2.rotation.x = 0.2;
    p2.castShadow = true;
    this.roomGroup.add(p2);

    // Bed Headboard
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.1), woodOakMat);
    headboard.position.set(0.6, 0.0, -1.55);
    headboard.castShadow = true;
    this.roomGroup.add(headboard);
    this.occluders.push(headboard);

    // 4. Side Table [hs-6: -1.0, -0.2, 0.4]
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 24), woodOakMat);
    tableTop.position.set(-1.0, -0.2, 0.4);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.roomGroup.add(tableTop);
    this.occluders.push(tableTop);

    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 12), woodOakMat);
      const angle = (i * Math.PI * 2) / 3;
      leg.position.set(-1.0 + Math.cos(angle) * 0.25, -0.5, 0.4 + Math.sin(angle) * 0.25);
      leg.rotation.z = Math.cos(angle) * 0.15;
      leg.rotation.x = Math.sin(angle) * 0.15;
      leg.castShadow = true;
      this.roomGroup.add(leg);
    }

    // 5. Moon Lamp on Side Table [hs-5: -1.0, 0.5, 0.4]
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), lampMat);
    moon.position.set(-1.0, 0.05, 0.4);
    moon.castShadow = true;
    this.roomGroup.add(moon);

    const moonTripod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), woodOakMat);
    moonTripod.position.set(-1.0, -0.17, 0.4);
    this.roomGroup.add(moonTripod);

    // 6. Candle Holder [hs-8: -0.7, 0.25, 0.6] -> placed near bed table/shelf
    const candleHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16), brassMat);
    candleHolder.position.set(-0.7, -0.14, 0.6);
    candleHolder.castShadow = true;
    this.roomGroup.add(candleHolder);

    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.9 })
    );
    candle.position.set(-0.7, -0.04, 0.6);
    this.roomGroup.add(candle);

    // 7. Low floating shelf on right wall with Möbius sculpture [hs-7: 1.2, 0.6, -0.3]
    const rightShelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.35), woodOakMat);
    rightShelf.position.set(1.2, 0.4, -0.3);
    rightShelf.castShadow = true;
    rightShelf.receiveShadow = true;
    this.roomGroup.add(rightShelf);
    this.occluders.push(rightShelf);

    const mobius = new THREE.Mesh(new THREE.TorusKnotGeometry(0.15, 0.04, 64, 12, 2, 3), mobiusMat);
    mobius.position.set(1.2, 0.65, -0.3);
    mobius.castShadow = true;
    this.roomGroup.add(mobius);
  }
}

