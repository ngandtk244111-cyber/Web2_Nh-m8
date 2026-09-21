import { Injectable, signal } from '@angular/core';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class QuickViewService {
  readonly activeProduct = signal<Product | null>(null);

  open(product: Product): void {
    this.activeProduct.set(product);
  }

  close(): void {
    this.activeProduct.set(null);
  }
}
