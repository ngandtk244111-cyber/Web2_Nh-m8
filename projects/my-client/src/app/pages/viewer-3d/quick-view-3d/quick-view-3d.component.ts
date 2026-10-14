import { Component, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AppIconComponent } from '../../../components/icon/icon.component';
import {
  ProductModelStageComponent,
  StageAngle,
  StageState,
} from '../../../components/product-model-stage/product-model-stage.component';
import { ProductService } from '../../../core/services/product.service';
import { has3DModel, departmentOf } from '../../../core/data/catalog-taxonomy';
import { modelCreditFor } from '../../../core/data/model-credits';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { productFromRoute } from '../product-from-route';

/**
 * Phòng XEM NHANH 3D — mở từ nút "Xem nhanh 3D" ở trang danh sách sản phẩm (tab mới).
 * Mục đích: lướt nhanh hình khối sản phẩm (xoay, zoom, các góc) kèm thông tin cốt lõi rồi sang trang chi tiết.
 */
@Component({
  selector: 'app-quick-view-3d',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, ProductModelStageComponent, VndPipe],
  templateUrl: './quick-view-3d.component.html',
  styleUrl: './quick-view-3d.component.css',
})
export class QuickView3dComponent {
  @ViewChild(ProductModelStageComponent) stage?: ProductModelStageComponent;

  private readonly productService = inject(ProductService);
  private readonly title = inject(Title);
  readonly route = productFromRoute();

  stageState: StageState = 'loading';
  autoRotate = true;
  /** Góc nhìn đang chọn — null khi đang xoay tự động hoặc người dùng tự xoay/zoom. */
  activeAngle: StageAngle | null = null;

  readonly angles: { key: StageAngle; label: string }[] = [
    { key: 'front', label: 'Trước' },
    { key: 'left', label: 'Trái' },
    { key: 'right', label: 'Phải' },
    { key: 'back', label: 'Sau' },
    { key: 'top', label: 'Trên' },
  ];

  constructor() {
    effect(() => {
      const p = this.route.product();
      this.title.setTitle(p ? `Xem nhanh 3D · ${p.name} | Luméa` : 'Xem nhanh 3D | Luméa');
    });
  }

  has3D = has3DModel;

  price(p = this.route.product()!): number {
    return this.productService.currentPrice(p);
  }

  discount(p = this.route.product()!): number {
    return this.productService.discountPercent(p);
  }

  department(): string {
    const p = this.route.product();
    return p ? departmentOf(p)?.label ?? p.categoryName : '';
  }

  /** Đoạn giới thiệu ngắn: 2 đoạn đầu của mô tả. */
  summary(): string {
    const d = this.route.product()?.description ?? '';
    return d.split('\n\n').slice(0, 2).join('\n\n');
  }

  credit(): string | null {
    return modelCreditFor(this.route.product()?.modelUrl);
  }

  setAngle(angle: StageAngle): void {
    this.autoRotate = false;
    this.activeAngle = angle;
    this.stage?.setAngle(angle);
  }

  zoom(factor: number): void {
    this.activeAngle = null;
    this.stage?.zoom(factor);
  }

  reset(): void {
    this.activeAngle = 'front';
    this.stage?.resetView();
  }

  toggleRotate(): void {
    this.autoRotate = !this.autoRotate;
    if (this.autoRotate) this.activeAngle = null;
  }

  closeTab(): void {
    window.close();
  }
}
