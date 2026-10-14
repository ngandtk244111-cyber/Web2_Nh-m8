import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { AppIconComponent } from '../../components/icon/icon.component';
import {
  CATALOG_DEPARTMENTS,
  CATALOG_SPACES,
  THREE_D_CUSTOM_LINKS,
  CatalogDepartment,
  CatalogLink,
  departmentLink,
  departmentMatches,
  spaceLink,
  spacesOf,
  subcategoryLink,
  subcategoryMatches,
} from '../../core/data/catalog-taxonomy';

interface DepartmentView {
  dept: CatalogDepartment;
  link: CatalogLink;
  count: number;
  subs: (CatalogLink & { image: string; count: number })[];
}

/** Trang "Tất cả danh mục": toàn bộ cây danh mục (nhóm lớn → danh mục con), không gian và 3D & Custom. */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css'
})
export class CategoriesComponent {
  private readonly productService = inject(ProductService);

  readonly departments = computed<DepartmentView[]>(() => {
    const products = this.productService.products();
    return CATALOG_DEPARTMENTS.map(dept => ({
      dept,
      link: departmentLink(dept),
      count: products.filter(p => departmentMatches(dept, p)).length,
      subs: dept.subcategories.map(sub => ({
        ...subcategoryLink(sub),
        image: sub.image,
        count: products.filter(p => subcategoryMatches(sub, p)).length,
      })),
    }));
  });

  readonly spaces = computed(() => {
    const products = this.productService.products();
    return CATALOG_SPACES.map(space => ({
      ...spaceLink(space),
      image: space.image,
      count: products.filter(p => spacesOf(p).includes(space.key)).length,
    }));
  });

  readonly threeDLinks = THREE_D_CUSTOM_LINKS;

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
