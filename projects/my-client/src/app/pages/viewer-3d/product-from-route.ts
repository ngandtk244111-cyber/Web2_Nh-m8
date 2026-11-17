import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ProductService } from '../../core/services/product.service';

/** Sản phẩm theo :id trên URL cho các phòng xem 3D */
export function productFromRoute() {
  const route = inject(ActivatedRoute);
  const productService = inject(ProductService);
  const id = toSignal(route.paramMap.pipe(map(p => p.get('id') ?? '')), { initialValue: '' });
  const product = computed(() => productService.products().find(p => p.id === id()));
  const status = computed<'loading' | 'ready' | 'not-found'>(() =>
    product() ? 'ready' : productService.loaded() ? 'not-found' : 'loading'
  );
  return { id, product, status };
}
