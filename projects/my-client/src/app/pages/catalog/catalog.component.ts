import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import {
  ProductService,
  ProductFilters,
  PriceRangeKey,
  PRICE_RANGES,
  CustomizationTag,
  CUSTOMIZATION_OPTIONS,
  SortKey,
  createEmptyFilters,
} from '../../core/services/product.service';
import { Product, ProductStyle, ProductColor, SizeCategory, SpaceKey } from '../../core/models/product.model';
import {
  CATALOG_DEPARTMENTS,
  CATALOG_SPACES,
  MATERIAL_GROUPS,
  CatalogDepartment,
  CatalogSubcategory,
  DepartmentKey,
  findDepartment,
  findSpace,
  findSubcategory,
  selectionForLegacyCategory,
} from '../../core/data/catalog-taxonomy';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { AppIconComponent } from '../../components/icon/icon.component';
import { MascotService } from '../../core/services/mascot.service';

type ViewMode = 'grid' | 'list';

interface ActiveChip {
  label: string;
  remove: () => void;
}

const STYLE_OPTIONS: ProductStyle[] = ['Minimalist', 'Scandinavian', 'Vintage', 'Cute/Kawaii', 'Modern', 'Retro', 'Japanese'];
const COLOR_OPTIONS: ProductColor[] = ['Trắng', 'Đen', 'Xám', 'Be', 'Pastel', 'Xanh', 'Hồng'];
const SIZE_OPTIONS: SizeCategory[] = ['Mini', 'Nhỏ', 'Trung bình', 'Lớn', 'Theo yêu cầu'];

const SEE_MORE_THRESHOLD = 5;

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCardComponent, AppIconComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit {
  readonly departments = CATALOG_DEPARTMENTS;
  readonly spaces = CATALOG_SPACES;
  readonly materialGroups = MATERIAL_GROUPS;
  readonly priceRanges = PRICE_RANGES;
  readonly styleOptions = STYLE_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;
  readonly sizeOptions = SIZE_OPTIONS;
  readonly customizationOptions = CUSTOMIZATION_OPTIONS;
  readonly seeMoreThreshold = SEE_MORE_THRESHOLD;

  selectedDepartments = new Set<DepartmentKey>();
  selectedSubcategories = new Set<string>();
  selectedSpaces = new Set<SpaceKey>();
  /** Giá bán: single-select (radio) — "Tất Cả" = null. */
  selectedPriceRange: PriceRangeKey | null = null;
  selectedStyles = new Set<ProductStyle>();
  selectedColors = new Set<ProductColor>();
  selectedMaterialGroups = new Set<string>();
  selectedSizes = new Set<SizeCategory>();
  selectedCustomizations = new Set<CustomizationTag>();
  customizableOnly = false;
  has3DOnly = false;
  onSaleOnly = false;
  printOnDemandOnly = false;
  readyStockOnly = false;
  searchQuery = '';
  sortBy: SortKey = 'bestseller';

  viewMode: ViewMode = 'grid';
  mobileFiltersOpen = false;

  expandedGroups = new Set<string>(['department', 'subcategory', 'space', 'price', 'feature']);
  seeMoreExpanded = new Set<string>();

  filteredProducts: Product[] = [];

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private mascotService: MascotService
  ) {}

  ngOnInit(): void {
    // Mỗi lần URL đổi (bấm mega menu, footer, trang chủ...) dựng lại toàn bộ bộ lọc từ query params.
    this.route.queryParams.subscribe(params => {
      this.clearSelections();
      this.readParams(params);
      this.applyFilters();

      // Chỉ phản ứng mascot khi đây là một lượt tìm kiếm thật (có query text từ URL).
      if (params['q']) {
        this.mascotService.react(this.filteredProducts.length === 0 ? 'sad' : 'happy');
      }
    });
  }

  /**
   * Query params hỗ trợ:
   *   dept, cat, space, style (có thể nhiều giá trị, ngăn bằng dấu phẩy), q,
   *   has3d=1, custom=1, sale=1, print=1,
   *   và các link cũ: category=<ProductCategory>, customizableOnly=true, productionType=READY_STOCK|PRINT_ON_DEMAND.
   */
  private readParams(params: Params): void {
    const list = (key: string): string[] => (params[key] ? String(params[key]).split(',').filter(Boolean) : []);
    const flag = (key: string): boolean => params[key] === '1' || params[key] === 'true';

    list('dept').forEach(k => findDepartment(k) && this.selectedDepartments.add(k as DepartmentKey));
    list('cat').forEach(k => {
      const found = findSubcategory(k);
      if (found) {
        this.selectedSubcategories.add(k);
        this.selectedDepartments.add(found.dept.key);
      }
    });
    list('space').forEach(k => findSpace(k) && this.selectedSpaces.add(k as SpaceKey));
    list('style').forEach(k => (STYLE_OPTIONS as string[]).includes(k) && this.selectedStyles.add(k as ProductStyle));

    if (params['category']) {
      const legacy = selectionForLegacyCategory(params['category']);
      if (legacy.dept) this.selectedDepartments.add(legacy.dept);
      legacy.subs.forEach(k => {
        this.selectedSubcategories.add(k);
        this.selectedDepartments.add(findSubcategory(k)!.dept.key);
      });
    }

    this.has3DOnly = flag('has3d');
    this.customizableOnly = flag('custom') || flag('customizableOnly');
    this.onSaleOnly = flag('sale');
    this.printOnDemandOnly = flag('print') || params['productionType'] === 'PRINT_ON_DEMAND';
    this.readyStockOnly = params['productionType'] === 'READY_STOCK';
    this.searchQuery = params['q'] || '';
  }

  private clearSelections(): void {
    this.selectedDepartments.clear();
    this.selectedSubcategories.clear();
    this.selectedSpaces.clear();
    this.selectedPriceRange = null;
    this.selectedStyles.clear();
    this.selectedColors.clear();
    this.selectedMaterialGroups.clear();
    this.selectedSizes.clear();
    this.selectedCustomizations.clear();
    this.customizableOnly = false;
    this.has3DOnly = false;
    this.onSaleOnly = false;
    this.printOnDemandOnly = false;
    this.readyStockOnly = false;
    this.searchQuery = '';
  }

  applyFilters(): void {
    const filters: ProductFilters = {
      ...createEmptyFilters(),
      departments: [...this.selectedDepartments],
      subcategories: [...this.selectedSubcategories],
      spaces: [...this.selectedSpaces],
      materialGroups: [...this.selectedMaterialGroups],
      priceRanges: this.selectedPriceRange ? [this.selectedPriceRange] : [],
      styles: [...this.selectedStyles],
      colors: [...this.selectedColors],
      sizes: [...this.selectedSizes],
      customizations: [...this.selectedCustomizations],
      has3D: this.has3DOnly,
      customizableOnly: this.customizableOnly,
      onSale: this.onSaleOnly,
      productionType: this.printOnDemandOnly ? 'PRINT_ON_DEMAND' : this.readyStockOnly ? 'READY_STOCK' : 'ALL',
      searchQuery: this.searchQuery,
      sortBy: this.sortBy,
    };
    this.filteredProducts = this.productService.filterProducts(filters);
  }

  // ---------- Tiêu đề trang theo ngữ cảnh ----------

  get pageTitle(): string {
    if (this.selectedSubcategories.size === 1) return findSubcategory([...this.selectedSubcategories][0])!.sub.label;
    if (this.selectedDepartments.size === 1 && this.selectedSubcategories.size === 0) {
      return findDepartment([...this.selectedDepartments][0])!.label;
    }
    if (this.selectedSpaces.size === 1 && this.selectedDepartments.size === 0) return findSpace([...this.selectedSpaces][0])!.label;
    if (this.has3DOnly) return 'Sản phẩm có mô hình 3D';
    if (this.customizableOnly) return 'Sản phẩm có thể tùy biến';
    if (this.printOnDemandOnly) return 'Sản phẩm in 3D';
    if (this.onSaleOnly) return 'Sản phẩm đang giảm giá';
    if (this.readyStockOnly) return 'Hàng có sẵn';
    if (this.searchQuery.trim()) return `Kết quả cho “${this.searchQuery.trim()}”`;
    return 'Tất cả sản phẩm';
  }

  get pageSubtitle(): string {
    if (this.selectedDepartments.size === 1) {
      return findDepartment([...this.selectedDepartments][0])!.description;
    }
    if (this.has3DOnly) return 'Xoay, phóng to và xem trước mô hình 3D ngay trên trang sản phẩm.';
    if (this.customizableOnly) return 'Đổi màu, chất liệu, kích thước hoặc khắc tên theo ý bạn.';
    return 'Nội thất, đèn, decor và sản phẩm 3D tuỳ biến cho mọi không gian sống.';
  }

  /** Các bộ lọc đang bật — hiển thị thành chip có nút xoá phía trên kết quả. */
  get activeChips(): ActiveChip[] {
    const chips: ActiveChip[] = [];
    for (const key of this.selectedDepartments) {
      const dept = findDepartment(key)!;
      // Nhóm lớn đã có danh mục con được chọn thì chỉ hiện chip danh mục con.
      if (dept.subcategories.some(s => this.selectedSubcategories.has(s.key))) continue;
      chips.push({ label: dept.label, remove: () => this.toggleDepartment(key) });
    }
    for (const key of this.selectedSubcategories) {
      chips.push({ label: findSubcategory(key)!.sub.label, remove: () => this.toggleSubcategory(key) });
    }
    for (const key of this.selectedSpaces) {
      chips.push({ label: findSpace(key)!.label, remove: () => this.toggleSpace(key) });
    }
    if (this.selectedPriceRange) {
      const range = PRICE_RANGES.find(r => r.key === this.selectedPriceRange)!;
      chips.push({ label: range.label, remove: () => this.setPriceRange(null) });
    }
    this.selectedColors.forEach(c => chips.push({ label: c, remove: () => this.toggleColor(c) }));
    this.selectedMaterialGroups.forEach(g =>
      chips.push({ label: MATERIAL_GROUPS.find(m => m.key === g)!.label, remove: () => this.toggleMaterialGroup(g) }));
    this.selectedStyles.forEach(s => chips.push({ label: s, remove: () => this.toggleStyle(s) }));
    this.selectedSizes.forEach(s => chips.push({ label: s, remove: () => this.toggleSize(s) }));
    this.selectedCustomizations.forEach(t =>
      chips.push({ label: CUSTOMIZATION_OPTIONS.find(o => o.key === t)!.label, remove: () => this.toggleCustomization(t) }));
    if (this.customizableOnly) chips.push({ label: 'Có thể tùy biến', remove: () => this.toggleFlag('customizableOnly') });
    if (this.has3DOnly) chips.push({ label: 'Có mô hình 3D', remove: () => this.toggleFlag('has3DOnly') });
    if (this.onSaleOnly) chips.push({ label: 'Đang giảm giá', remove: () => this.toggleFlag('onSaleOnly') });
    if (this.printOnDemandOnly) chips.push({ label: 'In 3D theo yêu cầu', remove: () => this.toggleFlag('printOnDemandOnly') });
    if (this.readyStockOnly) chips.push({ label: 'Hàng có sẵn', remove: () => this.toggleFlag('readyStockOnly') });
    if (this.searchQuery.trim()) chips.push({ label: `“${this.searchQuery.trim()}”`, remove: () => { this.searchQuery = ''; this.applyFilters(); } });
    return chips;
  }

  get activeFilterCount(): number {
    return this.activeChips.length;
  }

  // ---------- Dải danh mục có ảnh phía trên kết quả ----------

  /** Đang xem trong đúng 1 nhóm lớn (vd. bấm Sofa → Nội thất): dải hiện các danh mục con cùng nhóm. */
  get stripDepartment(): CatalogDepartment | undefined {
    return this.selectedDepartments.size === 1 ? findDepartment([...this.selectedDepartments][0]) : undefined;
  }

  /** Chọn đúng 1 danh mục con (thay cho lựa chọn cũ trong cùng nhóm), giữ nguyên các bộ lọc khác. */
  selectOnlySubcategory(key: string): void {
    const found = findSubcategory(key);
    if (!found) return;
    this.selectedSubcategories.clear();
    this.selectedSubcategories.add(key);
    this.selectedDepartments.clear();
    this.selectedDepartments.add(found.dept.key);
    this.applyFilters();
  }

  /** Xem cả nhóm lớn (bỏ danh mục con đang chọn). */
  selectOnlyDepartment(key: DepartmentKey): void {
    this.selectedSubcategories.clear();
    this.selectedDepartments.clear();
    this.selectedDepartments.add(key);
    this.applyFilters();
  }

  // ---------- Sidebar: nhóm lớn / danh mục con ----------

  /** Loại sản phẩm hiển thị theo nhóm lớn đang chọn; chưa chọn nhóm nào thì hiện tất cả (có tiêu đề nhóm). */
  get visibleSubcategoryGroups(): CatalogDepartment[] {
    return this.selectedDepartments.size
      ? this.departments.filter(d => this.selectedDepartments.has(d.key))
      : this.departments;
  }

  toggleDepartment(key: DepartmentKey): void {
    if (this.selectedDepartments.has(key)) {
      this.selectedDepartments.delete(key);
      // Bỏ nhóm lớn thì bỏ luôn các danh mục con của nhóm đó.
      findDepartment(key)!.subcategories.forEach(s => this.selectedSubcategories.delete(s.key));
    } else {
      this.selectedDepartments.add(key);
    }
    this.applyFilters();
  }

  clearDepartments(): void {
    this.selectedDepartments.clear();
    this.selectedSubcategories.clear();
    this.applyFilters();
  }

  toggleSubcategory(key: string): void {
    const found = findSubcategory(key);
    if (!found) return;
    if (this.selectedSubcategories.has(key)) {
      this.selectedSubcategories.delete(key);
    } else {
      this.selectedSubcategories.add(key);
      this.selectedDepartments.add(found.dept.key);
    }
    this.applyFilters();
  }

  isSubSelected(sub: CatalogSubcategory): boolean {
    return this.selectedSubcategories.has(sub.key);
  }

  toggleSpace(key: SpaceKey): void {
    if (this.selectedSpaces.has(key)) this.selectedSpaces.delete(key);
    else this.selectedSpaces.add(key);
    this.applyFilters();
  }

  // ---------- Các nhóm lọc khác ----------

  toggleGroup(key: string): void {
    if (this.expandedGroups.has(key)) this.expandedGroups.delete(key);
    else this.expandedGroups.add(key);
  }

  isGroupExpanded(key: string): boolean {
    return this.expandedGroups.has(key);
  }

  toggleSeeMore(key: string): void {
    if (this.seeMoreExpanded.has(key)) this.seeMoreExpanded.delete(key);
    else this.seeMoreExpanded.add(key);
  }

  isSeeMoreExpanded(key: string): boolean {
    return this.seeMoreExpanded.has(key);
  }

  visibleStyleOptions(): ProductStyle[] {
    return this.isSeeMoreExpanded('style') ? this.styleOptions : this.styleOptions.slice(0, SEE_MORE_THRESHOLD);
  }

  visibleColorOptions(): ProductColor[] {
    return this.isSeeMoreExpanded('color') ? this.colorOptions : this.colorOptions.slice(0, SEE_MORE_THRESHOLD);
  }

  visibleMaterialGroups(): typeof MATERIAL_GROUPS {
    return this.isSeeMoreExpanded('material') ? this.materialGroups : this.materialGroups.slice(0, SEE_MORE_THRESHOLD);
  }

  toggleStyle(style: ProductStyle): void {
    if (this.selectedStyles.has(style)) this.selectedStyles.delete(style);
    else this.selectedStyles.add(style);
    this.applyFilters();
  }

  toggleColor(color: ProductColor): void {
    if (this.selectedColors.has(color)) this.selectedColors.delete(color);
    else this.selectedColors.add(color);
    this.applyFilters();
  }

  setPriceRange(key: PriceRangeKey | null): void {
    this.selectedPriceRange = key;
    this.applyFilters();
  }

  toggleMaterialGroup(key: string): void {
    if (this.selectedMaterialGroups.has(key)) this.selectedMaterialGroups.delete(key);
    else this.selectedMaterialGroups.add(key);
    this.applyFilters();
  }

  toggleSize(size: SizeCategory): void {
    if (this.selectedSizes.has(size)) this.selectedSizes.delete(size);
    else this.selectedSizes.add(size);
    this.applyFilters();
  }

  toggleCustomization(tag: CustomizationTag): void {
    if (this.selectedCustomizations.has(tag)) this.selectedCustomizations.delete(tag);
    else this.selectedCustomizations.add(tag);
    this.applyFilters();
  }

  toggleFlag(flag: 'customizableOnly' | 'has3DOnly' | 'onSaleOnly' | 'printOnDemandOnly' | 'readyStockOnly'): void {
    this[flag] = !this[flag];
    if (flag === 'printOnDemandOnly' && this.printOnDemandOnly) this.readyStockOnly = false;
    if (flag === 'readyStockOnly' && this.readyStockOnly) this.printOnDemandOnly = false;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  setSort(sortBy: SortKey): void {
    this.sortBy = sortBy;
    this.applyFilters();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  openMobileFilters(): void {
    this.mobileFiltersOpen = true;
  }

  closeMobileFilters(): void {
    this.mobileFiltersOpen = false;
  }

  resetFilters(): void {
    this.clearSelections();
    this.sortBy = 'bestseller';
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.applyFilters();
  }
}
