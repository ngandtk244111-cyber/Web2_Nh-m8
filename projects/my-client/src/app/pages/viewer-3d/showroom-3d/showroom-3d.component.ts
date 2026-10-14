import { Component, ElementRef, HostListener, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AppIconComponent } from '../../../components/icon/icon.component';
import {
  ProductModelStageComponent,
  StageLook,
  StageState,
} from '../../../components/product-model-stage/product-model-stage.component';
import { Product } from '../../../core/models/product.model';
import { modelCreditFor } from '../../../core/data/model-credits';
import { productFromRoute } from '../product-from-route';

interface LookOption {
  key: string;
  label: string;
  look: StageLook;
  /** Màu đại diện khi chưa chụp xong thumbnail (mô hình dựng sẵn). */
  swatch?: string;
  thumb?: string;
}

/** Tên tiếng Việt cho các phiên bản vật liệu hay gặp trong file GLB. */
const VARIANT_LABELS: Record<string, string> = {
  Champagne: 'Nhung Champagne',
  Navy: 'Nhung Xanh Navy',
  Gray: 'Nhung Xám',
  Black: 'Nhung Đen',
  'Pale Pink': 'Nhung Hồng Phấn',
  'Mango Velvet': 'Nhung Vàng Xoài',
  'Peacock Velvet': 'Nhung Xanh Lông Công',
};

/**
 * PHÒNG 3D (mở từ nút "AR" ở trang chi tiết, tab mới) — bố cục tham khảo trình xem 3D của Nitori:
 * mô hình lớn giữa nền trắng, dải thumbnail phiên bản màu/chất liệu bên dưới, điều khiển dọc bên phải.
 * Chỉ xem 3D — KHÔNG dùng camera/AR thật.
 */
@Component({
  selector: 'app-showroom-3d',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, ProductModelStageComponent],
  templateUrl: './showroom-3d.component.html',
  styleUrl: './showroom-3d.component.css',
})
export class Showroom3dComponent {
  @ViewChild(ProductModelStageComponent) stage?: ProductModelStageComponent;
  @ViewChild('room') room?: ElementRef<HTMLElement>;

  private readonly title = inject(Title);
  readonly route = productFromRoute();

  stageState: StageState = 'loading';
  autoRotate = false;
  isFullscreen = false;

  options: LookOption[] = [];
  selectedKey = '';
  look: StageLook = {};
  /** Chất liệu (mô hình dựng sẵn có nhiều chất liệu): áp dụng chung với màu đang chọn. */
  materialIndex = 0;

  constructor() {
    effect(() => {
      const p = this.route.product();
      this.title.setTitle(p ? `Phòng 3D · ${p.name} | Luméa` : 'Phòng 3D | Luméa');
    });
  }

  get selected(): LookOption | undefined {
    return this.options.find(o => o.key === this.selectedKey);
  }

  credit(p: Product): string | null {
    return modelCreditFor(p.modelUrl);
  }

  onStageState(state: StageState): void {
    this.stageState = state;
    if (state === 'ready') this.captureThumbs();
  }

  /** File GLB khai báo phiên bản (KHR_materials_variants) — mỗi phiên bản là một thumbnail. */
  onVariants(names: string[], p: Product): void {
    if (names.length) {
      // Không thêm ô "Mặc định": vật liệu mặc định của file luôn trùng một phiên bản có tên.
      this.options = names.map(n => ({ key: `v:${n}`, label: VARIANT_LABELS[n] ?? n, look: { variant: n } }));
    } else {
      // Mô hình dựng sẵn: thumbnail theo bảng màu tuỳ biến của sản phẩm.
      this.options = (p.customization?.colors ?? []).map(c => ({
        key: `c:${c.hex}`,
        label: c.name,
        swatch: c.hex,
        look: { colorHex: c.hex },
      }));
    }
    this.select(this.options[0]?.key ?? '', p);
  }

  select(key: string, p: Product): void {
    const option = this.options.find(o => o.key === key);
    this.selectedKey = key;
    if (!option) return;
    const material = p.customization?.materials?.[this.materialIndex];
    this.look = option.look.variant !== undefined
      ? { ...option.look }
      : { ...option.look, roughness: material?.roughness, metalness: material?.metalness };
  }

  selectMaterial(index: number, p: Product): void {
    this.materialIndex = index;
    this.select(this.selectedKey, p);
    this.captureThumbs();
  }

  private async captureThumbs(): Promise<void> {
    if (!this.stage || !this.options.length) return;
    const p = this.route.product();
    const material = p?.customization?.materials?.[this.materialIndex];
    const looks = this.options.map(o => o.look.variant !== undefined
      ? o.look
      : { ...o.look, roughness: material?.roughness, metalness: material?.metalness });
    const thumbs = await this.stage.captureLooks(looks);
    thumbs.forEach((src, i) => { if (this.options[i]) this.options[i].thumb = src; });
  }

  zoom(factor: number): void {
    this.stage?.zoom(factor);
  }

  reset(): void {
    this.autoRotate = false;
    this.stage?.resetView();
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.room?.nativeElement.requestFullscreen();
    } catch {
      // Trình duyệt không cho toàn màn hình (vd iOS Safari) — bỏ qua.
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
  }

  closeTab(): void {
    window.close();
  }
}
