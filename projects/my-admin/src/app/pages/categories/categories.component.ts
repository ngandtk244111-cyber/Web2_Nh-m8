import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { slugify } from '../../shared/utils/order-labels';
import { PRODUCT_CATEGORY_OPTIONS, categorySectionOf } from '../products/product-options';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  group: 'FURNITURE' | 'DECOR' | string;
  icon: string;
  productCount: number;
  active: boolean;
  desc: string;
}

/** Nhóm lớn khớp mega menu của my-client (Nội thất / Đèn & ánh sáng / Decor / Đồ dùng & phụ kiện). */
const DEFAULT_CATEGORIES: AdminCategory[] = [
  { id: 'cat-1', name: 'Nội thất', slug: 'noi-that', group: 'FURNITURE', icon: 'bi-house', productCount: 0, active: true, desc: 'Sofa, giường, bàn, ghế, tủ, kệ' },
  { id: 'cat-2', name: 'Đèn & ánh sáng', slug: 'anh-sang', group: 'FURNITURE', icon: 'bi-lightbulb', productCount: 0, active: true, desc: 'Đèn bàn, đèn ngủ, đèn trang trí, đèn decor' },
  { id: 'cat-3', name: 'Decor', slug: 'decor', group: 'DECOR', icon: 'bi-flower1', productCount: 0, active: true, desc: 'Đồ trang trí, tượng & figure, chậu cây, khung ảnh' },
  { id: 'cat-4', name: 'Đồ dùng & phụ kiện', slug: 'do-dung', group: 'DECOR', icon: 'bi-archive', productCount: 0, active: true, desc: 'Khay & hộp đựng, giá đỡ & bookend' },
];

/** Bản cũ lưu tên icon lucide — đổi sang Bootstrap Icons khi hiển thị. */
const LEGACY_ICONS: Record<string, string> = {
  home: 'bi-house', sparkles: 'bi-lightbulb', image: 'bi-flower1', archive: 'bi-archive', box: 'bi-box-seam',
};

export const CATEGORY_ICONS = ['bi-house', 'bi-lightbulb', 'bi-flower1', 'bi-archive', 'bi-box-seam', 'bi-lamp', 'bi-easel', 'bi-gift', 'bi-tree', 'bi-palette', 'bi-stars', 'bi-tag'];

type CategoryForm = Omit<AdminCategory, 'id' | 'productCount'>;

/** Danh mục hiển thị trên cửa hàng — lưu trong cấu hình admin (PUT /admin/config/categories). */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
})
export class CategoriesComponent implements OnInit {
  private productService = inject(ProductService);
  readonly adminAuth = inject(AdminAuthService);
  private config = inject(AdminConfigService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly icons = CATEGORY_ICONS;
  readonly configLoaded = computed(() => this.config.config() !== null);

  /** Chưa lưu lần nào thì dùng mặc định trong code. */
  readonly categories = computed<AdminCategory[]>(() => {
    const saved = this.config.get<AdminCategory[]>('categories');
    const list = saved?.length ? saved : DEFAULT_CATEGORIES;
    const products = this.productService.products();
    return list.map(c => {
      // Danh mục admin tự thêm (không thuộc 4 nhóm lớn) giữ nguyên số đã nhập.
      const isSection = PRODUCT_CATEGORY_OPTIONS.some(o => o.section === c.name);
      return {
        ...c,
        icon: LEGACY_ICONS[c.icon] || c.icon || 'bi-tag',
        productCount: isSection ? products.filter(p => categorySectionOf(p.category) === c.name).length : (c.productCount || 0),
      };
    });
  });

  search = signal('');
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.categories().filter(c => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q) || (c.desc || '').toLowerCase().includes(q));
  });

  showModal = false;
  editingId: string | null = null;
  form: CategoryForm = this.emptyForm();
  saving = false;

  ngOnInit(): void {
    this.config.load();
  }

  get activeCount(): number {
    return this.categories().filter(c => c.active).length;
  }

  get totalProducts(): number {
    return this.productService.products().length;
  }

  private emptyForm(): CategoryForm {
    return { name: '', slug: '', group: 'DECOR', icon: 'bi-tag', desc: '', active: true };
  }

  openAdd(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.showModal = true;
  }

  openEdit(c: AdminCategory): void {
    this.editingId = c.id;
    this.form = { name: c.name, slug: c.slug, group: c.group, icon: c.icon, desc: c.desc || '', active: c.active };
    this.showModal = true;
  }

  /** Lưu cả danh sách; chỉ đóng modal khi server xác nhận. */
  private persist(list: AdminCategory[], onSaved: () => void): void {
    this.saving = true;
    this.config.save('categories', list).subscribe({
      next: () => {
        this.saving = false;
        onSaved();
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được danh mục lên server');
      },
    });
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) {
      this.toast.warning('Vui lòng nhập tên danh mục');
      return;
    }
    const entry = { ...this.form, name, slug: this.form.slug.trim() || slugify(name), desc: this.form.desc.trim() };
    const isEdit = !!this.editingId;
    const list = isEdit
      ? this.categories().map(c => c.id === this.editingId ? { ...c, ...entry } : c)
      : [...this.categories(), { ...entry, id: 'cat-' + Date.now(), productCount: 0 }];
    this.persist(list, () => {
      this.showModal = false;
      this.toast.success(isEdit ? `Đã cập nhật danh mục "${name}"` : `Đã thêm danh mục "${name}"`);
      this.audit.record('Danh Mục', isEdit ? 'Cập nhật danh mục' : 'Thêm danh mục', name, isEdit ? 'INFO' : 'SUCCESS');
    });
  }

  toggleActive(c: AdminCategory): void {
    const active = !c.active;
    this.persist(this.categories().map(x => x.id === c.id ? { ...x, active } : x), () => {
      this.toast.info(`Danh mục "${c.name}" đã ${active ? 'hiển thị' : 'ẩn'}`);
      this.audit.record('Danh Mục', 'Đổi trạng thái danh mục', `${c.name} -> ${active ? 'ACTIVE' : 'HIDDEN'}`, 'INFO');
    });
  }
}
