import * as THREE from 'three';
import { RoomHotspot } from '../../core/models/room.model';

export interface HotspotItem {
  hotspot: RoomHotspot;
  domElement: HTMLElement | null;
}

export class HotspotManager {
  private hotspots: Map<string, HotspotItem> = new Map();
  private tempVec = new THREE.Vector3();
  private camForward = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private occluders: THREE.Object3D[] = [];

  setOccluders(objects: THREE.Object3D[]): void {
    this.occluders = objects;
  }

  setHotspots(items: RoomHotspot[]): void {
    this.hotspots.clear();
    for (const h of items) {
      this.hotspots.set(h.id, {
        hotspot: h,
        domElement: null,
      });
    }
  }

  bindElement(id: string, el: HTMLElement): void {
    const item = this.hotspots.get(id);
    if (item) {
      item.domElement = el;
      el.style.willChange = 'transform';
      el.style.transformOrigin = 'center center';
    }
  }

  clear(): void {
    this.hotspots.clear();
  }

  /**
   * Projects 3D hotspot positions to 2D canvas coordinates and updates DOM transforms
   * directly without invoking Angular Change Detection.
   */
  updatePositions(
    camera: THREE.PerspectiveCamera,
    containerWidth: number,
    containerHeight: number,
    checkOcclusion = false
  ): void {
    if (containerWidth <= 0 || containerHeight <= 0) return;

    camera.getWorldDirection(this.camForward);

    for (const item of this.hotspots.values()) {
      const el = item.domElement;
      if (!el) continue;

      const [hx, hy, hz] = item.hotspot.position;
      this.tempVec.set(hx, hy, hz);

      // 1. Check if point is in front of camera
      const toHotspot = this.tempVec.clone().sub(camera.position);
      const dot = toHotspot.dot(this.camForward);
      if (dot <= 0.1) {
        el.style.display = 'none';
        continue;
      }

      // 2. Project to NDC (-1 to 1)
      this.tempVec.project(camera);

      // Check if inside frustum viewport margins
      const inFrustum = (
        this.tempVec.x >= -1.05 &&
        this.tempVec.x <= 1.05 &&
        this.tempVec.y >= -1.05 &&
        this.tempVec.y <= 1.05 &&
        this.tempVec.z < 1.0
      );

      if (!inFrustum) {
        el.style.display = 'none';
        continue;
      }

      // 3. Optional Occlusion check with scene geometry
      if (checkOcclusion && this.occluders.length > 0) {
        const hotspotWorldPos = new THREE.Vector3(hx, hy, hz);
        const dir = hotspotWorldPos.clone().sub(camera.position).normalize();
        const distToHotspot = camera.position.distanceTo(hotspotWorldPos);

        this.raycaster.set(camera.position, dir);
        this.raycaster.near = 0.1;
        this.raycaster.far = distToHotspot + 0.1;

        const hits = this.raycaster.intersectObjects(this.occluders, true);
        if (hits.length > 0 && hits[0].distance < distToHotspot - 0.15) {
          el.style.display = 'none';
          continue;
        }
      }

      // 4. Map NDC to Pixel coordinates
      const px = Math.round(((this.tempVec.x + 1) * containerWidth) / 2);
      const py = Math.round(((-this.tempVec.y + 1) * containerHeight) / 2);

      // Direct GPU transform update
      el.style.display = 'block';
      el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    }
  }
}

