import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { Workshop, workshopFor } from '../../core/data/workshops';
import { Product, ProductCategory, ProductionType } from '../../core/models/product.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { slugify } from '../../shared/utils/order-labels';
import { environment } from '../../../environments/environment';
import { PRODUCT_BADGE_OPTIONS, PRODUCT_CATEGORY_OPTIONS, PRODUCT_CATEGORY_SECTIONS, THREE_MODEL_TYPES } from './product-options';

interface ProductForm {
  name: string;
  slug: string;
  category: ProductCategory;
  categoryName: string;
  categoryGroup: 'FURNITURE' | 'DECOR';
  productionType: ProductionType;
  customizable: boolean;
  basePrice: number;
  originalPrice: number;
  inStock: number;
  dimensions: string;
  materialInfo: string;
  description: string;
  story: string;
  badge: string;
  image1: string;
  image2: string;
  threeModelType: string;
  modelUrl: string;
  /** '' = tự gán xưởng theo loại sản phẩm. */
  workshopId: string;
}

function emptyForm(): ProductForm {
  return {
    name: '', slug: '', category: 'lamp', categoryName: 'Đèn Decor', categoryGroup: 'FURNITURE',
    productionType: 'READY_STOCK', customizable: false, basePrice: 0, originalPrice: 0, inStock: 50,
    dimensions: '', materialInfo: '', description: '', story: '', badge: '',
    image1: '', image2: '', threeModelType: '', modelUrl: '', workshopId: '',
  };
}

function formFrom(p: Product): ProductForm {
  return {
    name: p.name, slug: p.slug, category: p.category, categoryName: p.categoryName,
    categoryGroup: p.categoryGroup || 'FURNITURE', productionType: p.productionType, customizable: !!p.customizable,
    basePrice: p.basePrice, originalPrice: p.originalPrice || p.basePrice, inStock: p.inStock,
    dimensions: p.dimensions || '', materialInfo: p.materialInfo || '', description: p.description || '',
    story: p.story || '', badge: p.badge || '', image1: p.images?.[0] || '', image2: p.images?.[1] || '',
    threeModelType: p.threeModelType || '', modelUrl: p.modelUrl || '', workshopId: p.workshopId || '',
  };
}

/** Trang thêm / sửa sản phẩm — trang riêng thay cho modal cũ (như orderdetail/customerdetail của Vita). */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, MascotLoadingComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.css',
})
export class ProductFormComponent implements OnInit {
  private productService = inject(ProductService);
  readonly adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);
  private config = inject(AdminConfigService);

  readonly activeWorkshops = computed(() => (this.config.get<Workshop[]>('workshops') || []).filter(w => w.active !== false));

  /** Xưởng sẽ tự gán nếu không chọn riêng (theo loại + kiểu sản xuất đang chọn trên form). */
  autoWorkshopName(): string {
    const auto = workshopFor({ id: this.editing()?.id || '', category: this.form.category, productionType: this.form.productionType, workshopId: null }, this.activeWorkshops());
    return auto ? auto.name : 'chưa có xưởng phù hợp';
  }

  readonly sections = PRODUCT_CATEGORY_SECTIONS;
  readonly modelTypes = THREE_MODEL_TYPES;
  readonly badgeOptions = PRODUCT_BADGE_OPTIONS;
  readonly clientAppUrl = environment.clientAppUrl;

  private editId = signal<string | null>(null);
  /** Sản phẩm đang sửa — danh sách tải bất đồng bộ nên đọc qua computed. */
  readonly editing = computed(() => {
    const id = this.editId();
    return id ? this.productService.products().find(p => p.id === id) || null : null;
  });
  readonly isEdit = computed(() => this.editId() !== null);

  form: ProductForm = emptyForm();
  /** Người dùng đã tự sửa slug thì không tự sinh theo tên nữa. */
  private slugTouched = false;
  private formLoaded = false;
  uploading: 'image1' | 'image2' | null = null;
  saving = false;

  constructor() {
    // Mở thẳng URL sửa khi danh sách chưa tải: chờ có sản phẩm rồi mới đổ vào form (chỉ 1 lần).
    effect(() => {
      const p = this.editing();
      if (p && !this.formLoaded) {
        this.form = formFrom(p);
        this.slugTouched = true;
        this.formLoaded = true;
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.editId.set(id);
    if (id && !this.productService.products().length) this.productService.refresh();
    this.config.load();
  }

  get readOnly(): boolean {
    return this.isEdit() ? !this.adminAuth.can('products.edit') : !this.adminAuth.can('products.create');
  }

  get loadingProduct(): boolean {
    return this.isEdit() && !this.editing();
  }

  get notFound(): boolean {
    return this.isEdit() && !this.editing() && this.productService.products().length > 0;
  }

  get discountPercent(): number {
    const { basePrice, originalPrice } = this.form;
    return originalPrice > basePrice && originalPrice > 0 ? Math.round((1 - basePrice / originalPrice) * 100) : 0;
  }

  onNameChange(name: string): void {
    this.form.name = name;
    if (!this.slugTouched) this.form.slug = slugify(name);
  }

  onSlugChange(slug: string): void {
    this.form.slug = slug;
    this.slugTouched = true;
  }

  onCategoryChange(value: ProductCategory): void {
    const opt = PRODUCT_CATEGORY_OPTIONS.find(o => o.value === value);
    this.form.category = value;
    if (opt) {
      this.form.categoryName = opt.label;
      this.form.categoryGroup = opt.group;
    }
  }

  onImageSelected(event: Event, slot: 'image1' | 'image2'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Cho phép chọn lại đúng file đó sau khi tải lỗi.
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toast.warning('Ảnh tối đa 5MB');
      return;
    }
    const form = this.form;
    this.uploading = slot;
    this.productService.uploadImage(file).subscribe({
      next: url => {
        form[slot] = url;
        this.uploading = null;
      },
      error: err => {
        this.uploading = null;
        this.toast.apiError(err, 'Không tải được ảnh lên server');
      },
    });
  }

  removeImage2(): void {
    this.form.image2 = '';
  }

  private validate(): string | null {
    const f = this.form;
    if (!f.name.trim()) return 'Vui lòng nhập tên sản phẩm';
    if (!f.image1) return 'Vui lòng tải lên hình ảnh chính';
    if (!(Number(f.basePrice) > 0)) return 'Giá bán phải lớn hơn 0';
    if (Number(f.originalPrice) < 0) return 'Giá gốc không hợp lệ';
    if (!Number.isInteger(Number(f.inStock)) || Number(f.inStock) < 0) return 'Tồn kho phải là số nguyên không âm';
    if (f.modelUrl.trim() && !/^(https?:\/\/|\/)/.test(f.modelUrl.trim())) return 'URL mô hình 3D phải bắt đầu bằng http(s):// hoặc /';
    return null;
  }

  save(): void {
    if (this.readOnly || this.saving) return;
    const error = this.validate();
    if (error) {
      this.toast.warning(error);
      return;
    }
    const f = this.form;
    const editing = this.editing();
    const name = f.name.trim();
    const payload: any = {
      name,
      slug: f.slug.trim() || slugify(name),
      category: f.category,
      categoryName: f.categoryName,
      categoryGroup: f.categoryGroup,
      productionType: f.productionType,
      customizable: f.customizable,
      basePrice: Number(f.basePrice),
      originalPrice: Number(f.originalPrice) || Number(f.basePrice),
      inStock: Number(f.inStock),
      dimensions: f.dimensions.trim(),
      materialInfo: f.materialInfo.trim(),
      description: f.description.trim(),
      story: f.story.trim(),
      badge: f.badge.trim(),
      // Ảnh thứ 3 trở đi (thêm từ seed/dữ liệu cũ) được giữ nguyên.
      images: [f.image1, f.image2.trim(), ...(editing?.images?.slice(2) ?? [])].filter(Boolean),
      threeModelType: f.threeModelType || null,
      modelUrl: f.modelUrl.trim() || null,
      workshopId: f.workshopId || null,
    };

    this.saving = true;
    const request = editing ? this.productService.updateProduct(editing.id, payload) : this.productService.addProduct(payload);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(editing ? `Đã cập nhật sản phẩm "${name}"` : `Đã tạo sản phẩm mới "${name}"`);
        this.audit.record('Sản Phẩm', editing ? 'Chỉnh sửa sản phẩm' : 'Thêm mới sản phẩm', name, 'SUCCESS');
        this.router.navigate(['/products']);
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, editing ? 'Không lưu được sản phẩm vào server' : 'Không thêm được sản phẩm vào server');
      },
    });
  }

  async remove(): Promise<void> {
    const p = this.editing();
    if (!p) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá sản phẩm?',
      message: `"${p.name}" sẽ bị gỡ khỏi cửa hàng. Thao tác này không hoàn tác được.`,
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.productService.deleteProduct(p.id).subscribe({
      next: () => {
        this.toast.info(`Đã xoá sản phẩm "${p.name}"`);
        this.audit.record('Sản Phẩm', 'Xóa sản phẩm', `Xóa ${p.name} (ID: ${p.id})`, 'WARNING');
        this.router.navigate(['/products']);
      },
      error: err => this.toast.apiError(err, 'Không xoá được sản phẩm'),
    });
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }
}
