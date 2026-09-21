import * as THREE from 'three';

/**
 * Utility to deeply dispose Three.js objects, geometries, materials, and textures
 * to prevent GPU memory leaks.
 */
export class ResourceManager {
  /**
   * Recursively traverses an Object3D and frees all geometries, materials, and textures.
   */
  static deepDispose(obj: THREE.Object3D | null | undefined): void {
    if (!obj) return;

    obj.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }

      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => this.disposeMaterial(mat));
        } else {
          this.disposeMaterial(mesh.material);
        }
      }
    });

    if (obj.parent) {
      obj.parent.remove(obj);
    }
  }

  /**
   * Safely disposes a material and any attached textures.
   */
  static disposeMaterial(material: THREE.Material): void {
    if (!material) return;

    const textureKeys: string[] = [
      'map',
      'lightMap',
      'bumpMap',
      'normalMap',
      'specularMap',
      'envMap',
      'alphaMap',
      'aoMap',
      'displacementMap',
      'roughnessMap',
      'metalnessMap',
      'emissiveMap',
    ];

    const matAny = material as any;
    for (const key of textureKeys) {
      const tex = matAny[key] as THREE.Texture | undefined;
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
      }
    }

    material.dispose();
  }
}

/**
 * CanvasTexturePool reuses a single 2D canvas and CanvasTexture for custom engraving,
 * preventing GC churn and WebGL texture leaks when the user types in an input field.
 */
export class TextCanvasTexturePool {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;

  constructor(width = 512, height = 128) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  drawText(text: string, fontColor = '#1C1C1E', fontSize = 36): void {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);
    if (!text || !text.trim()) {
      this.texture.needsUpdate = true;
      return;
    }

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = fontColor;
    this.ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text.trim(), w / 2, h / 2);

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
