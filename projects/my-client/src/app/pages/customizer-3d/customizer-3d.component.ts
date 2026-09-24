import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { 
  Product, 
  ColorOption, 
  MaterialOption, 
  SizeOption, 
  AccessoryOption,
  SelectedCustomization 
} from '../../core/models/product.model';
import { ThreeViewerComponent } from '../../components/three-viewer/three-viewer.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { ToastService } from '../../core/services/toast.service';
import { MascotService } from '../../core/services/mascot.service';

@Component({
  selector: 'app-customizer-3d',
  standalone: true,
  imports: [CommonModule, FormsModule, ThreeViewerComponent, AppIconComponent, VndPipe],
  templateUrl: './customizer-3d.component.html',
  styleUrl: './customizer-3d.component.css'
})
export class Customizer3dComponent implements OnInit {
  customizableProducts: Product[] = [];
  selectedProduct: Product | undefined;
  selectedConfig: SelectedCustomization | null = null;
  customTextInput = '';
  isFullscreen = false;

  calculatedPrice = 0;
  priceAddonsTotal = 0;

  private readonly storagePrefix = 'deco3d_draft_';
  private requestedProductId: string | null = null;
  private hasAutoSelected = false;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private mascotService: MascotService
  ) {
    // Danh sách sản phẩm tùy biến giờ nạp bất đồng bộ từ backend — dùng effect() để tự chọn
    // sản phẩm ngay khi dữ liệu về, thay vì trông chờ nó đã có sẵn lúc ngOnInit.
    effect(() => {
      this.customizableProducts = this.productService.customizableProducts();
      if (this.hasAutoSelected || this.customizableProducts.length === 0) return;

      const found = this.requestedProductId
        ? this.customizableProducts.find(p => p.id === this.requestedProductId)
        : undefined;
      this.selectProduct(found || this.customizableProducts[0], false);
      this.hasAutoSelected = true;
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.requestedProductId = params['productId'] || null;
    });
  }

  selectProduct(product: Product, updateUrl = true): void {
    this.selectedProduct = product;

    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { productId: product.id },
        queryParamsHandling: 'merge',
      });
    }

    if (product.customization) {
      // Check for saved draft in localStorage
      const draft = this.loadDraft(product.id);
      if (draft) {
        this.selectedConfig = draft;
        this.customTextInput = draft.customText || '';
      } else {
        const defColor = product.customization.colors[0];
        const defMat = product.customization.materials[0];
        const defSize = product.customization.sizes[0];
        const defFinish = product.customization.finishes[0] || { id: 'std', label: 'Tiêu chuẩn', priceDelta: 0 };
        const defAccessories = product.customization.accessories.filter(a => a.defaultSelected);

        this.selectedConfig = {
          color: defColor,
          material: defMat,
          size: defSize,
          finish: defFinish,
          customText: '',
          accessories: [...defAccessories],
        };
        this.customTextInput = '';
      }
      this.recalculatePrice();
    }
  }

  setColor(col: ColorOption): void {
    if (!this.selectedConfig) return;
    this.selectedConfig.color = col;
    this.recalculatePrice();
    this.saveCurrentDraft();
  }

  setMaterial(mat: MaterialOption): void {
    if (!this.selectedConfig) return;
    this.selectedConfig.material = mat;
    this.recalculatePrice();
    this.saveCurrentDraft();
  }

  setSize(size: SizeOption): void {
    if (!this.selectedConfig) return;
    this.selectedConfig.size = size;
    this.recalculatePrice();
    this.saveCurrentDraft();
  }

  onCustomTextChange(): void {
    if (!this.selectedConfig) return;
    this.selectedConfig.customText = this.customTextInput.trim();
    this.recalculatePrice();
    this.saveCurrentDraft();
  }

  isAccessorySelected(acc: AccessoryOption): boolean {
    return this.selectedConfig?.accessories.some(a => a.id === acc.id) ?? false;
  }

  toggleAccessory(acc: AccessoryOption): void {
    if (!this.selectedConfig) return;
    const exists = this.isAccessorySelected(acc);
    if (exists) {
      this.selectedConfig.accessories = this.selectedConfig.accessories.filter(a => a.id !== acc.id);
    } else {
      this.selectedConfig.accessories.push(acc);
    }
    this.recalculatePrice();
    this.saveCurrentDraft();
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
  }

  resetToDefaults(): void {
    if (!this.selectedProduct?.customization) return;
    const cust = this.selectedProduct.customization;
    try {
      localStorage.removeItem(this.storagePrefix + this.selectedProduct.id);
    } catch {}

    const defColor = cust.colors[0];
    const defMat = cust.materials[0];
    const defSize = cust.sizes[0];
    const defFinish = cust.finishes[0] || { id: 'std', label: 'Tiêu chuẩn', priceDelta: 0 };
    const defAccessories = cust.accessories.filter(a => a.defaultSelected);

    this.selectedConfig = {
      color: defColor,
      material: defMat,
      size: defSize,
      finish: defFinish,
      customText: '',
      accessories: [...defAccessories],
    };
    this.customTextInput = '';
    this.recalculatePrice();
  }

  recalculatePrice(): void {
    if (!this.selectedProduct || !this.selectedConfig) return;
    this.calculatedPrice = this.cartService.calculateUnitPrice(this.selectedProduct, this.selectedConfig);
    
    // Calculate sum of add-ons
    let addons = 0;
    addons += this.selectedConfig.color.priceDelta;
    addons += this.selectedConfig.material.priceDelta;
    addons += this.selectedConfig.finish.priceDelta;
    if (this.selectedConfig.customText && this.selectedProduct.customization?.textOption?.enabled) {
      addons += this.selectedProduct.customization.textOption.priceDelta;
    }
    addons += this.selectedConfig.accessories.reduce((sum, a) => sum + a.priceDelta, 0);
    this.priceAddonsTotal = addons;
  }

  addCustomizedToCart(): void {
    if (!this.selectedProduct || !this.selectedConfig) return;
    this.cartService.addToCart(this.selectedProduct, 1, this.selectedConfig);
    this.toastService.success(`Đã thêm "${this.selectedProduct.name}" (tùy biến) vào giỏ hàng`);
    // Hoàn thành tùy biến 3D là một cột mốc lớn hơn "thêm giỏ hàng" thường —
    // biểu cảm tự tin thay vì chỉ cười thường.
    this.mascotService.react('confident');
  }

  private saveCurrentDraft(): void {
    if (!this.selectedProduct || !this.selectedConfig) return;
    try {
      localStorage.setItem(
        this.storagePrefix + this.selectedProduct.id,
        JSON.stringify(this.selectedConfig)
      );
    } catch (e) {
      console.warn('Failed to save draft to localStorage', e);
    }
  }

  private loadDraft(productId: string): SelectedCustomization | null {
    try {
      const stored = localStorage.getItem(this.storagePrefix + productId);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load draft from localStorage', e);
    }
    return null;
  }
}
