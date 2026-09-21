import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { Product, ProductCategory, ProductStyle, ProductColor, PrintMaterial, SizeCategory } from '../../core/models/product.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { AppIconComponent } from '../../components/icon/icon.component';

type ViewMode = 'grid' | 'list';

interface CategoryFilterGroup {
  key: string;
  label: string;
  categories: ProductCategory[];
}

/** Nhóm danh mục hiển thị cho người dùng — map sang các ProductCategory thật (1 nhóm có thể gồm nhiều category thật). */
const CATEGORY_FILTER_GROUPS: CategoryFilterGroup[] = [
  { key: 'decor-item', label: 'Đồ trang trí', categories: ['vase', 'sculpture', 'clock', 'frame', 'candle_holder', 'tray', 'bookend'] },
  { key: 'desk-decor', label: 'Decor bàn làm việc', categories: ['organizer', 'side_table'] },
  { key: 'bedroom-decor', label: 'Decor phòng ngủ', categories: ['lamp'] },
  { key: 'living-decor', label: 'Decor phòng khách', categories: ['bookshelf', 'stool'] },
  { key: 'study-decor', label: 'Decor góc học tập', categories: ['organizer', 'bookshelf'] },
  { key: 'mini-model', label: 'Mô hình mini', categories: ['sculpture'] },
  { key: 'mini-plant', label: 'Chậu cây mini', categories: ['plant_pot'] },
  { key: 'lighting-accessory', label: 'Đèn & phụ kiện decor', categories: ['lamp', 'candle_holder', 'organizer'] },
];

const STYLE_OPTIONS: ProductStyle[] = ['Minimalist', 'Scandinavian', 'Vintage', 'Cute/Kawaii', 'Modern', 'Retro', 'Japanese'];
const COLOR_OPTIONS: ProductColor[] = ['Trắng', 'Đen', 'Xám', 'Be', 'Pastel', 'Xanh', 'Hồng'];
const MATERIAL_OPTIONS: PrintMaterial[] = ['PLA', 'PETG', 'Resin', 'Wood PLA', 'Nhựa tái chế'];
const SIZE_OPTIONS: SizeCategory[] = ['Mini', 'Nhỏ', 'Trung bình', 'Theo yêu cầu'];

const SEE_MORE_THRESHOLD = 5;

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCardComponent, AppIconComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit {
  readonly categoryGroups = CATEGORY_FILTER_GROUPS;
  readonly priceRanges = PRICE_RANGES;
  readonly styleOptions = STYLE_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;
  readonly materialOptions = MATERIAL_OPTIONS;
  readonly sizeOptions = SIZE_OPTIONS;
  readonly customizationOptions = CUSTOMIZATION_OPTIONS;
  readonly seeMoreThreshold = SEE_MORE_THRESHOLD;

  selectedCategoryKeys = new Set<string>();
  /** Giá bán: single-select (radio), giống UI tham khảo — "Tất Cả" = null. */
  selectedPriceRange: PriceRangeKey | null = null;
  selectedStyles = new Set<ProductStyle>();
  selectedColors = new Set<ProductColor>();
  selectedMaterials = new Set<PrintMaterial>();
  selectedSizes = new Set<SizeCategory>();
  selectedCustomizations = new Set<CustomizationTag>();
  searchQuery = '';
  sortBy: SortKey = 'bestseller';

  viewMode: ViewMode = 'grid';
  mobileFiltersOpen = false;

  expandedGroups = new Set<string>(['category', 'price', 'style']);
  seeMoreExpanded = new Set<string>();

  filteredProducts: Product[] = [];

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Giữ tương thích với các link cũ trỏ tới /catalog?category=<ProductCategory thật>
      // (mega menu, danh mục trang chủ, promo banner) — tự chọn sẵn nhóm chứa category đó.
      const rawCategory = params['category'] as ProductCategory | undefined;
      if (rawCategory) {
        this.selectedCategoryKeys.clear();
        for (const group of CATEGORY_FILTER_GROUPS) {
          if (group.categories.includes(rawCategory)) {
            this.selectedCategoryKeys.add(group.key);
          }
        }
        if (this.selectedCategoryKeys.size === 0) {
          // Category thật không thuộc nhóm nào đã map -> lọc thẳng theo category qua search text
          // để không mất kết quả (an toàn hơn là bỏ qua).
          this.searchQuery = params['q'] || '';
        }
      }
      this.searchQuery = params['q'] || this.searchQuery;
      this.applyFilters();
    });
  }

  private buildActiveCategories(): ProductCategory[] {
    const set = new Set<ProductCategory>();
    for (const group of CATEGORY_FILTER_GROUPS) {
      if (this.selectedCategoryKeys.has(group.key)) {
        group.categories.forEach(c => set.add(c));
      }
    }
    return [...set];
  }

  applyFilters(): void {
    const filters: ProductFilters = {
      ...createEmptyFilters(),
      categories: this.buildActiveCategories(),
      priceRanges: this.selectedPriceRange ? [this.selectedPriceRange] : [],
      styles: [...this.selectedStyles],
      colors: [...this.selectedColors],
      materials: [...this.selectedMaterials],
      sizes: [...this.selectedSizes],
      customizations: [...this.selectedCustomizations],
      searchQuery: this.searchQuery,
      sortBy: this.sortBy,
    };
    this.filteredProducts = this.productService.filterProducts(filters);
  }

  get activeFilterCount(): number {
    return (
      this.selectedCategoryKeys.size +
      (this.selectedPriceRange ? 1 : 0) +
      this.selectedStyles.size +
      this.selectedColors.size +
      this.selectedMaterials.size +
      this.selectedSizes.size +
      this.selectedCustomizations.size +
      (this.searchQuery.trim() ? 1 : 0)
    );
  }

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

  visibleCategoryGroups(): CategoryFilterGroup[] {
    return this.isSeeMoreExpanded('category') ? this.categoryGroups : this.categoryGroups.slice(0, SEE_MORE_THRESHOLD);
  }

  visibleStyleOptions(): ProductStyle[] {
    return this.isSeeMoreExpanded('style') ? this.styleOptions : this.styleOptions.slice(0, SEE_MORE_THRESHOLD);
  }

  visibleColorOptions(): ProductColor[] {
    return this.isSeeMoreExpanded('color') ? this.colorOptions : this.colorOptions.slice(0, SEE_MORE_THRESHOLD);
  }

  toggleCategory(key: string): void {
    if (this.selectedCategoryKeys.has(key)) this.selectedCategoryKeys.delete(key);
    else this.selectedCategoryKeys.add(key);
    this.applyFilters();
  }

  clearCategoryFilter(): void {
    this.selectedCategoryKeys.clear();
    this.applyFilters();
  }

  toggleStyle(style: ProductStyle): void {
    if (this.selectedStyles.has(style)) this.selectedStyles.delete(style);
    else this.selectedStyles.add(style);
    this.applyFilters();
  }

  clearStyleFilter(): void {
    this.selectedStyles.clear();
    this.applyFilters();
  }

  toggleColor(color: ProductColor): void {
    if (this.selectedColors.has(color)) this.selectedColors.delete(color);
    else this.selectedColors.add(color);
    this.applyFilters();
  }

  clearColorFilter(): void {
    this.selectedColors.clear();
    this.applyFilters();
  }

  setPriceRange(key: PriceRangeKey | null): void {
    this.selectedPriceRange = key;
    this.applyFilters();
  }

  toggleMaterial(material: PrintMaterial): void {
    if (this.selectedMaterials.has(material)) this.selectedMaterials.delete(material);
    else this.selectedMaterials.add(material);
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
    this.selectedCategoryKeys.clear();
    this.selectedPriceRange = null;
    this.selectedStyles.clear();
    this.selectedColors.clear();
    this.selectedMaterials.clear();
    this.selectedSizes.clear();
    this.selectedCustomizations.clear();
    this.searchQuery = '';
    this.sortBy = 'bestseller';
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.applyFilters();
  }
}
